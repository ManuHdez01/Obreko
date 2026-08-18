// POST /api/budget-tool/compose — "montar desde texto": recibe la obra
// descrita como venga (notas sueltas, WhatsApp del cliente, Excel pegado,
// dictado transcrito...) y devuelve las partidas montadas con cantidades
// y precios orientativos, listas para añadir al proyecto.
//
// Body esperado (JSON):
//   { "text": "...", "mode": "reforma"|"amueblar", "region": "tenerife"|"madrid",
//     "calidad": "economica"|"media"|"alta", "m2": 85 }
//
// Respuesta:
//   { items: [{ name, supplier, unit, unitPrice, quantity, reasoning }], summary,
//     truncated: bool }

import { verifySession } from './_auth.js';
import { readLibrary } from './library.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

// Un presupuesto detallado de Excel son decenas de líneas: el límite viejo de
// 10.000 caracteres lo cortaba a la mitad sin avisar.
const MAX_TEXT = 60000;
// Trozo por llamada. Si el texto es más largo se parte y se montan las
// partidas en varias llamadas en paralelo, porque si no la respuesta se corta
// por max_tokens y llega un JSON a medias.
const CHUNK_CHARS = 14000;
const MAX_CHUNKS = 6;
const MAX_TOKENS = 16000;

const COMPOSE_TOOL = {
  name: 'return_items',
  description: 'Devuelve las partidas del presupuesto montadas a partir del texto.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '1-2 frases: qué se ha entendido del texto y qué dudas quedan.' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nombre claro de la partida.' },
            capitulo: { type: 'string', description: 'Capítulo del presupuesto al que pertenece, copiado tal cual del texto (ej. "CAP.1 DEMOLICIONES, DESMONTAJES Y RETIRADA DE ESCOMBROS"). Vacío si el texto no trae capítulos.' },
            tipo: { type: 'string', enum: ['material', 'obra'], description: 'material si la partida es suministro o material; obra si es mano de obra, trabajo, montaje, demolición o servicio. Si el texto separa columnas de Material y Mano de obra, usa esa separación.' },
            supplier: { type: 'string', description: 'Proveedor si el texto lo menciona o "estimación".' },
            unit: { type: 'string', description: 'ud, m2, ml, h, pa (partida alzada)...' },
            unitPrice: { type: 'number', description: 'Precio unitario orientativo en € (sin impuestos).' },
            quantity: { type: 'number' },
            reasoning: { type: 'string', description: 'De dónde sale la cantidad/precio, en pocas palabras.' },
          },
          required: ['name', 'unit', 'unitPrice', 'quantity'],
        },
      },
    },
    required: ['summary', 'items'],
  },
};

export async function onRequestPost({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY no configurado' }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const textoCompleto = String(payload.text || '').trim();
  const text = textoCompleto.slice(0, MAX_TEXT);
  if (text.length < 10) return json({ error: 'El texto es demasiado corto para montar nada.' }, 400);

  const mode = payload.mode === 'amueblar' ? 'amueblar' : 'reforma';
  const region = payload.region === 'madrid' ? 'madrid' : 'tenerife';
  const calidad = ['economica', 'media', 'alta'].includes(payload.calidad) ? payload.calidad : 'media';
  const m2 = Number(payload.m2) || 0;

  // Precios de referencia de la biblioteca propia, para que use los del equipo
  // cuando coincidan con lo que pide el texto
  let libraryHint = '';
  if (env.BUDGET_TOOL) {
    const lib = (await readLibrary(env)).filter((l) => l.mode === mode).slice(0, 80);
    if (lib.length) {
      libraryHint = '\n\nPrecios propios del equipo (usa ESTOS cuando la partida coincida, con supplier "Biblioteca obreko"):\n' +
        lib.map((l) => `- ${l.name}: ${l.unitPrice}€/${l.unit}${l.supplier ? ' (' + l.supplier + ')' : ''}`).join('\n');
    }
  }

  const trozos = partirTexto(text);
  const recortadoEntrada = textoCompleto.length > MAX_TEXT || trozos.length > MAX_CHUNKS;
  const usados = trozos.slice(0, MAX_CHUNKS);

  const ctx = { mode, region, calidad, m2, libraryHint };
  let respuestas;
  try {
    respuestas = await Promise.all(usados.map((t, i) => llamarClaude(env, t, i, usados.length, ctx)));
  } catch (e) {
    return json({ error: e.message }, e.status || 502);
  }

  const items = [];
  const resumenes = [];
  let truncated = recortadoEntrada;
  for (const r of respuestas) {
    items.push(...r.items);
    if (r.summary) resumenes.push(r.summary);
    if (r.truncated) truncated = true;
  }

  if (!items.length) {
    return json({ error: 'La IA no devolvió ninguna partida legible del texto.' }, 502);
  }

  return json({ items, summary: resumenes.join(' '), truncated });
}

// Parte por líneas (nunca por la mitad de una partida) en trozos que quepan
// holgados en una sola respuesta del modelo.
function partirTexto(text) {
  if (text.length <= CHUNK_CHARS) return [text];
  const trozos = [];
  let actual = '';
  let capitulo = '';
  for (const linea of text.split('\n')) {
    if (actual && actual.length + linea.length + 1 > CHUNK_CHARS) {
      trozos.push(actual);
      // El corte puede caer en mitad de un capítulo: al trozo siguiente se le
      // recuerda a cuál pertenecen sus primeras líneas, para que no las deje
      // sin capítulo.
      actual = capitulo ? `[Estas primeras líneas pertenecen al capítulo: ${capitulo}]` : '';
    }
    const cap = capituloDeLinea(linea);
    if (cap) capitulo = cap;
    actual += (actual ? '\n' : '') + linea;
  }
  if (actual) trozos.push(actual);
  return trozos;
}

// Reconoce las líneas de cabecera de capítulo tal y como las exporta un Excel
// de presupuesto: "CAP.1  DEMOLICIONES, DESMONTAJES Y RETIRADA DE ESCOMBROS",,,,,
// Una cabecera ocupa ella sola la fila: si detrás hay más columnas con datos es
// una partida ("1.1,Desmontaje de armario,ud,1,100 €"), no un capítulo.
function capituloDeLinea(linea) {
  const texto = String(linea).trim();
  let primera, resto;
  if (texto.startsWith('"')) {
    const fin = texto.indexOf('"', 1);
    if (fin === -1) return '';
    primera = texto.slice(1, fin);
    resto = texto.slice(fin + 1);
  } else {
    const coma = texto.indexOf(',');
    primera = coma === -1 ? texto : texto.slice(0, coma);
    resto = coma === -1 ? '' : texto.slice(coma);
  }
  if (resto.replace(/[,;\s]/g, '') !== '') return '';
  if (!/^CAP(?:[IÍ]TULO)?\.?\s*\d+/i.test(primera.trim())) return '';
  return primera.replace(/["']/g, '').replace(/[,;\s]+$/, '').trim();
}

async function llamarClaude(env, text, i, total, { mode, region, calidad, m2, libraryHint }) {
  const aviso = total > 1
    ? `\n\nEste es el fragmento ${i + 1} de ${total} de un presupuesto largo. Monta SOLO las partidas que aparecen en este fragmento; otro proceso monta el resto.`
    : '';

  const prompt = `Eres el montador de presupuestos de obreko, empresa de reformas en ${region === 'tenerife' ? 'Tenerife (Canarias)' : 'Madrid'}.

Un compañero te pega la descripción de una obra tal cual la tiene (puede venir desordenada, con jerga, de un WhatsApp del cliente o de un Excel). Contexto del proyecto: modo ${mode}, calidad ${calidad}${m2 ? ', ' + m2 + ' m²' : ''}.${aviso}

TEXTO:
"""
${text}
"""
${libraryHint}

Si el texto trae capítulos ("CAP.1 DEMOLICIONES...", "CAPÍTULO 2 ALBAÑILERÍA...", o títulos en mayúsculas que agrupan partidas), rellena "capitulo" en CADA partida con el capítulo al que pertenece, copiado tal cual, y devuelve las partidas en el mismo orden en que aparecen en el texto.

Marca en "tipo" si cada partida es "material" (suministro) u "obra" (mano de obra, montaje, demolición, servicio). Si el texto trae columnas separadas de Material y Mano de obra, respeta esa separación.

Monta las partidas del presupuesto: nombre claro, unidad, cantidad (deduce de las medidas del texto; si no hay, estima razonable y dilo en reasoning) y precio unitario orientativo realista para la región y calidad (sin impuestos). Si el texto ya trae cantidades y precios, respétalos en vez de reestimarlos. No inventes trabajos que el texto no pida. Si algo es ambiguo, inclúyelo con tu mejor interpretación y señálalo en summary. Usa return_items.`;

  let res;
  try {
    res = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        // Extracción mecánica: sin razonamiento extendido para que todo el
        // presupuesto de tokens se vaya en las partidas y no se corte a medias.
        thinking: { type: 'disabled' },
        tools: [COMPOSE_TOOL],
        tool_choice: { type: 'tool', name: 'return_items' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    throw Object.assign(new Error('No se pudo contactar con la API de Claude: ' + e.message), { status: 502 });
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw Object.assign(new Error('Claude API rechazó la petición (' + res.status + '): ' + t.slice(0, 200)), { status: 502 });
  }

  const data = await res.json();
  const toolUse = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'return_items');
  if (!toolUse) throw Object.assign(new Error('Respuesta inesperada de Claude.'), { status: 502 });

  const input = toolUse.input || {};
  return {
    items: normalizarItems(input.items),
    summary: typeof input.summary === 'string' ? input.summary : '',
    // Si la respuesta llega al tope de tokens, el JSON de partidas viene a
    // medias: se avisa en vez de dar el presupuesto por completo.
    truncated: data.stop_reason === 'max_tokens',
  };
}

// El modelo casi siempre devuelve el array bien, pero cuando la respuesta se
// corta puede llegar un string o algo que no es lista: antes eso reventaba en
// el navegador con "items.map is not a function".
function normalizarItems(raw) {
  let items = raw;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { return []; }
  }
  if (!Array.isArray(items)) return [];
  return items
    .filter((it) => it && typeof it === 'object' && it.name)
    .map((it) => ({
      name: String(it.name),
      supplier: it.supplier ? String(it.supplier) : 'estimación',
      unit: it.unit ? String(it.unit) : 'ud',
      capitulo: it.capitulo ? String(it.capitulo).replace(/["']/g, '').trim() : '',
      tipo: it.tipo === 'obra' ? 'obra' : 'material',
      unitPrice: Number(it.unitPrice) || 0,
      quantity: Number(it.quantity) || 1,
      reasoning: it.reasoning ? String(it.reasoning) : '',
    }));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
