// POST /api/budget-tool/recommend — recomienda materiales/mobiliario según
// las características del inmueble, usando los precios más recientes
// publicados en KV por scripts/scrape-material-prices.js y la API de Claude.
//
// Body esperado (JSON):
//   {
//     "mode": "reforma" | "amueblar",
//     "region": "tenerife" | "madrid",
//     "tipo": "reforma integral" | "adecuacion" | "obras-pequenas" | "mantenimiento",
//     "m2": 85,
//     "estancias": { "cocinas": 1, "banos": 2, "dormitorios": 3 },
//     "calidad": "economica" | "media" | "alta"
//   }
//
// Respuesta:
//   {
//     "summary": "...",
//     "items": [{ name, supplier, category, unit, unitPrice, quantity, totalPrice, reasoning }],
//     "totalMaterialsCost": 1234.56,
//     "pricesUpdatedAt": "2026-07-01T10:00:00.000Z"
//   }

import { verifySession } from './_auth.js';
import { readLibrary } from './library.js';
import { readPriceMemory } from './price-memory.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const MAX_CATALOG_ITEMS = 220; // limita el tamaño del prompt

const RECOMMEND_TOOL = {
  name: 'return_recommendation',
  description: 'Devuelve la recomendación de materiales/mobiliario para el proyecto.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Resumen breve del criterio seguido (2-3 frases).' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            supplier: { type: 'string' },
            category: { type: 'string' },
            unit: { type: 'string' },
            unitPrice: { type: 'number' },
            quantity: { type: 'number' },
            totalPrice: { type: 'number' },
            reasoning: { type: 'string', description: 'Por qué se eligió, en una frase.' },
          },
          required: ['name', 'supplier', 'unit', 'unitPrice', 'quantity', 'totalPrice'],
        },
      },
      totalMaterialsCost: { type: 'number' },
    },
    required: ['summary', 'items', 'totalMaterialsCost'],
  },
};

export async function onRequestPost({ request, env }) {
  if (!(await verifySession(request, env))) {
    return json({ error: 'No autenticado' }, 401);
  }
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY no configurado' }, 503);
  }
  if (!env.BUDGET_TOOL) {
    return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const mode = payload.mode === 'amueblar' ? 'amueblar' : 'reforma';
  const region = payload.region === 'madrid' ? 'madrid' : 'tenerife';
  const tipo = String(payload.tipo || '').slice(0, 80);
  const m2 = Number(payload.m2) || 0;
  const estancias = payload.estancias && typeof payload.estancias === 'object' ? payload.estancias : {};
  const calidad = ['economica', 'media', 'alta'].includes(payload.calidad) ? payload.calidad : 'media';

  if (m2 <= 0) return json({ error: 'Falta m2 del inmueble' }, 400);

  // Catálogo: scraper local (prices:latest) + resultados de búsqueda en vivo
  // que el frontend pasa como extraCatalog (de /api/budget-tool/search-prices).
  const extraCatalog = Array.isArray(payload.extraCatalog)
    ? payload.extraCatalog
        .filter((e) => e && e.name && isFinite(Number(e.price)))
        .map((e) => ({
          supplier: String(e.supplier || 'búsqueda'),
          region: ['tenerife', 'madrid', 'nacional'].includes(e.region) ? e.region : region,
          category: mode,
          name: String(e.name).slice(0, 200),
          unit: String(e.unit || 'ud').slice(0, 20),
          price: Number(e.price),
        }))
        .slice(0, 100)
    : [];

  let allPrices = { entries: [], updatedAt: null };
  const pricesRaw = await env.BUDGET_TOOL.get('prices:latest');
  if (pricesRaw) {
    try {
      allPrices = JSON.parse(pricesRaw);
    } catch { /* catálogo base corrupto: seguimos solo con extraCatalog */ }
  }

  // La biblioteca propia va PRIMERO: son precios calibrados con los costes
  // reales del equipo, más fiables que el scraping o la estimación.
  const libraryEntries = (await readLibrary(env))
    .filter((l) => l.mode === mode)
    .map((l) => ({
      supplier: 'Biblioteca obreko' + (l.supplier ? ' · ' + l.supplier : ''),
      region,
      category: mode,
      name: l.name,
      unit: l.unit || 'ud',
      price: l.unitPrice,
    }))
    .slice(0, 120);

  // Memoria de precios: partidas de proyectos ganados (ver price-memory.js).
  // Van justo después de la biblioteca porque también son costes reales
  // propios, no estimaciones — pero se guardan solas para conservar el
  // agregado (media/min/max/nº muestras) sin mezclarlas con la biblioteca.
  const memoryEntries = (await readPriceMemory(env, mode, region))
    .map((m) => ({
      supplier: `Memoria de precios (${m.samples} proyecto${m.samples === 1 ? '' : 's'} ganado${m.samples === 1 ? '' : 's'})`,
      region,
      category: mode,
      name: m.name,
      unit: m.unit || 'ud',
      price: m.avg,
    }))
    .slice(0, 150);

  const entries = Array.isArray(allPrices.entries) ? allPrices.entries : [];
  const catalog = libraryEntries
    .concat(memoryEntries)
    .concat(
      entries
        .filter((e) => e.category === mode)
        .filter((e) => e.region === region || e.region === 'nacional')
    )
    .concat(extraCatalog)
    .slice(0, MAX_CATALOG_ITEMS);

  if (!catalog.length) {
    return json({ error: `No hay precios disponibles para "${mode}" en "${region}". Ejecuta el scraper local o usa la búsqueda de precios por proveedor.` }, 503);
  }

  const prompt = buildPrompt({ mode, region, tipo, m2, estancias, calidad, catalog });

  let claudeRes;
  try {
    claudeRes = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        tools: [RECOMMEND_TOOL],
        tool_choice: { type: 'tool', name: 'return_recommendation' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    return json({ error: 'No se pudo contactar con la API de Claude: ' + e.message }, 502);
  }

  if (!claudeRes.ok) {
    const errBody = await claudeRes.text().catch(() => '');
    return json({ error: 'Claude API rechazó la petición.', status: claudeRes.status, details: errBody.slice(0, 500) }, 502);
  }

  const claudeJson = await claudeRes.json();
  const toolUse = (claudeJson.content || []).find((c) => c.type === 'tool_use' && c.name === 'return_recommendation');
  if (!toolUse) {
    return json({ error: 'Respuesta inesperada de Claude (sin recomendación estructurada).' }, 502);
  }

  return json({
    ...toolUse.input,
    pricesUpdatedAt: allPrices.updatedAt || null,
  });
}

function buildPrompt({ mode, region, tipo, m2, estancias, calidad, catalog }) {
  const estanciasTxt = Object.entries(estancias)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ') || 'sin especificar';

  const catalogTxt = catalog
    .map((c) => `- [${c.supplier}] ${c.name} — ${c.price}€/${c.unit} (${c.category}, región ${c.region})`)
    .join('\n');

  return `Eres el sistema de selección de materiales de obreko, una empresa de reformas en Tenerife y Madrid.

Proyecto:
- Tipo de intervención: ${tipo || 'sin especificar'}
- Modo: ${mode === 'amueblar' ? 'Amueblar (mobiliario)' : 'Reforma (materiales de obra)'}
- Región: ${region}
- Superficie: ${m2} m²
- Estancias: ${estanciasTxt}
- Calidad objetivo: ${calidad}

Catálogo de precios disponible (proveedor real, precio actual):
${catalogTxt}

Selecciona los materiales/artículos más adecuados de ESTE catálogo (no inventes productos ni precios fuera de la lista) para cubrir el proyecto descrito, ajustando cantidades según la superficie y estancias. Ten en cuenta la calidad objetivo al elegir entre opciones similares. Usa la herramienta return_recommendation para devolver la selección con su coste total.`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
