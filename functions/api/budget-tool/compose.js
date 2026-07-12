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
//   { items: [{ name, supplier, unit, unitPrice, quantity, reasoning }], summary }

import { verifySession } from './_auth.js';
import { readLibrary } from './library.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TEXT = 10000;

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

  const text = String(payload.text || '').trim().slice(0, MAX_TEXT);
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

  const prompt = `Eres el montador de presupuestos de obreko, empresa de reformas en ${region === 'tenerife' ? 'Tenerife (Canarias)' : 'Madrid'}.

Un compañero te pega la descripción de una obra tal cual la tiene (puede venir desordenada, con jerga, de un WhatsApp del cliente o de un Excel). Contexto del proyecto: modo ${mode}, calidad ${calidad}${m2 ? ', ' + m2 + ' m²' : ''}.

TEXTO:
"""
${text}
"""
${libraryHint}

Monta las partidas del presupuesto: nombre claro, unidad, cantidad (deduce de las medidas del texto; si no hay, estima razonable y dilo en reasoning) y precio unitario orientativo realista para la región y calidad (sin impuestos). No inventes trabajos que el texto no pida. Si algo es ambiguo, inclúyelo con tu mejor interpretación y señálalo en summary. Usa return_items.`;

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
        max_tokens: 4096,
        tools: [COMPOSE_TOOL],
        tool_choice: { type: 'tool', name: 'return_items' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    return json({ error: 'No se pudo contactar con la API de Claude: ' + e.message }, 502);
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return json({ error: 'Claude API rechazó la petición.', status: res.status, details: t.slice(0, 400) }, 502);
  }

  const data = await res.json();
  const toolUse = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'return_items');
  if (!toolUse) return json({ error: 'Respuesta inesperada de Claude.' }, 502);

  return json(toolUse.input);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
