// POST /api/budget-tool/search-prices — busca precios de un término en las
// webs de los proveedores registrados (fetch server-side + extracción con
// Claude, sin selectores CSS por proveedor).
//
// Body esperado (JSON):
//   { "query": "cemento cola", "supplierId": "chafiras" | null }  // null = todos los activos de la región
//   { "region": "tenerife" | "madrid" | null }                     // filtro opcional
//
// Respuesta:
//   { results: [{ supplierId, supplierName, ok, error?, items: [{name, price, unit, url}] }],
//     cached: bool }
//
// Los resultados se cachean 24h en KV (prices:search:<hash>) para no
// machacar las webs de los proveedores ni la API de Claude.

import { verifySession } from './_auth.js';
import { readSuppliers } from './suppliers.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const CACHE_TTL_SECONDS = 24 * 3600;
const MAX_HTML_TEXT = 30000; // caracteres de texto de página que pasamos a Claude
const FETCH_TIMEOUT_MS = 12000;

const EXTRACT_TOOL = {
  name: 'return_products',
  description: 'Devuelve los productos con precio encontrados en la página.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            price: { type: 'number', description: 'Precio en euros (número, sin símbolo).' },
            unit: { type: 'string', description: 'Unidad si se indica: ud, m2, saco, bote, ml...' },
            url: { type: 'string', description: 'URL del producto si aparece; vacío si no.' },
          },
          required: ['name', 'price'],
        },
      },
    },
    required: ['items'],
  },
};

export async function onRequestPost({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY no configurado' }, 503);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const query = String(payload.query || '').trim().slice(0, 120);
  if (!query) return json({ error: 'Falta query' }, 400);
  const supplierId = payload.supplierId ? String(payload.supplierId) : null;
  const region = ['tenerife', 'madrid'].includes(payload.region) ? payload.region : null;

  let suppliers = (await readSuppliers(env)).filter((s) => s.active && s.searchUrl);
  if (supplierId) suppliers = suppliers.filter((s) => s.id === supplierId);
  else if (region) suppliers = suppliers.filter((s) => s.region === region || s.region === 'nacional');

  if (!suppliers.length) return json({ error: 'Ningún proveedor activo coincide (¿searchUrl configurada?).' }, 404);

  // Caché
  const cacheKey = 'prices:search:' + (await sha1(query.toLowerCase() + '|' + suppliers.map((s) => s.id).sort().join(',')));
  const cachedRaw = await env.BUDGET_TOOL.get(cacheKey);
  if (cachedRaw) {
    try {
      return json({ ...JSON.parse(cachedRaw), cached: true });
    } catch { /* caché corrupta: seguimos */ }
  }

  const results = [];
  for (const s of suppliers) {
    results.push(await searchOne(env, s, query));
  }

  const response = { query, results, searchedAt: new Date().toISOString() };
  // Solo cacheamos si al menos un proveedor respondió bien
  if (results.some((r) => r.ok)) {
    await env.BUDGET_TOOL.put(cacheKey, JSON.stringify(response), { expirationTtl: CACHE_TTL_SECONDS });
  }

  return json({ ...response, cached: false });
}

async function searchOne(env, supplier, query) {
  const base = { supplierId: supplier.id, supplierName: supplier.name, region: supplier.region };
  const url = supplier.searchUrl.replace('{q}', encodeURIComponent(query));

  let html;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ...base, ok: false, error: `El proveedor devolvió HTTP ${res.status} (posible bloqueo anti-bot). Usa el scraper local como respaldo.`, items: [] };
    }
    html = await res.text();
  } catch (e) {
    return { ...base, ok: false, error: 'No se pudo cargar la web del proveedor: ' + e.message, items: [] };
  }

  const text = htmlToText(html).slice(0, MAX_HTML_TEXT);
  if (text.length < 200) {
    return { ...base, ok: false, error: 'La página devolvió contenido casi vacío (render por JavaScript o bloqueo). Usa el scraper local como respaldo.', items: [] };
  }

  try {
    const items = await extractWithClaude(env, supplier.name, query, text, url);
    return { ...base, ok: true, items, sourceUrl: url };
  } catch (e) {
    return { ...base, ok: false, error: 'Extracción falló: ' + e.message, items: [] };
  }
}

async function extractWithClaude(env, supplierName, query, pageText, sourceUrl) {
  const res = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'return_products' },
      messages: [{
        role: 'user',
        content: `Texto extraído de la página de resultados de búsqueda de "${query}" en ${supplierName} (${sourceUrl}):\n\n${pageText}\n\nExtrae los productos con su precio en euros que correspondan razonablemente a la búsqueda. Ignora menús, banners, productos patrocinados sin precio y todo lo que no sea un resultado con precio. Máximo 15 productos. Usa return_products.`,
      }],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('Claude HTTP ' + res.status + ' ' + t.slice(0, 200));
  }
  const data = await res.json();
  const toolUse = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'return_products');
  if (!toolUse) throw new Error('sin extracción estructurada');
  return (toolUse.input.items || []).slice(0, 15);
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&euro;/g, '€')
    .replace(/\s+/g, ' ')
    .trim();
}

async function sha1(s) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
