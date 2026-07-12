// POST /api/budget-tool/assistant — asistente conversacional del proyecto.
// Recibe el historial de chat + el estado actual del proyecto y responde
// como un jefe de obra que ayuda a completar el presupuesto. Puede proponer
// acciones estructuradas que el frontend aplica al formulario:
//   - update_project: cambiar campos (m2, tipo, calidad, estancias, margen...)
//   - add_items: añadir materiales con precio estimado
//
// Body esperado (JSON):
//   {
//     "project": { ...estado actual del proyecto... },
//     "messages": [{ "role": "user"|"assistant", "content": "..." }, ...]
//   }
//
// Respuesta:
//   { reply: "texto para el chat",
//     actions: [{ type:'update_project', fields:{...} } | { type:'add_items', items:[...] }] }

import { verifySession } from './_auth.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const MAX_MESSAGES = 30;

const TOOLS = [
  {
    name: 'update_project',
    description: 'Actualiza campos del proyecto con datos que el usuario ha confirmado en la conversación. Úsalo solo con datos claros, no especules.',
    input_schema: {
      type: 'object',
      properties: {
        m2: { type: 'number' },
        tipo: { type: 'string', enum: ['reforma integral', 'adecuacion', 'obras-pequenas', 'mantenimiento', 'amueblar'] },
        mode: { type: 'string', enum: ['reforma', 'amueblar'] },
        region: { type: 'string', enum: ['tenerife', 'madrid'] },
        calidad: { type: 'string', enum: ['economica', 'media', 'alta'] },
        clientName: { type: 'string' },
        address: { type: 'string' },
        estancias: {
          type: 'object',
          properties: { cocinas: { type: 'number' }, banos: { type: 'number' }, dormitorios: { type: 'number' } },
        },
        laborHours: { type: 'number' },
        laborRate: { type: 'number' },
        indirectPct: { type: 'number' },
        marginPct: { type: 'number' },
      },
    },
  },
  {
    name: 'add_items',
    description: 'Añade materiales/partidas a la lista del proyecto, con precio unitario estimado en euros. Úsalo cuando el usuario pida añadir cosas concretas.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              supplier: { type: 'string', description: 'Proveedor sugerido o "estimación" si es precio orientativo.' },
              unit: { type: 'string' },
              unitPrice: { type: 'number' },
              quantity: { type: 'number' },
              reasoning: { type: 'string' },
            },
            required: ['name', 'unitPrice', 'quantity'],
          },
        },
      },
      required: ['items'],
    },
  },
];

export async function onRequestPost({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY no configurado' }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const project = payload.project && typeof payload.project === 'object' ? payload.project : {};
  const history = (Array.isArray(payload.messages) ? payload.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!history.length || history[history.length - 1].role !== 'user') {
    return json({ error: 'El último mensaje debe ser del usuario' }, 400);
  }

  const system = `Eres el asistente de presupuestos de obreko, empresa de reformas en Tenerife y Madrid. Hablas con un compañero del equipo (no con el cliente final), en español, con tono directo y práctico — como un jefe de obra con experiencia.

Tu trabajo: ayudarle a completar el presupuesto del proyecto paso a paso. Haz preguntas concretas de una en una cuando falten datos (superficie, estancias, calidad, alcance...), sugiere partidas y precios orientativos realistas para la región, y avisa de cosas que suelen olvidarse (gestión de escombros, licencias, protecciones...).

Cuando el usuario te dé o confirme datos, aplícalos con update_project. Cuando pida añadir partidas o materiales, usa add_items con precios orientativos honestos (indica en reasoning que son estimados si no vienen de proveedor). Nunca inventes que un precio viene de un proveedor real.

Estado actual del proyecto (JSON):
${JSON.stringify(stripProject(project)).slice(0, 6000)}

Campos vacíos o a 0 = pendientes de rellenar. La región ${project.region === 'madrid' ? 'es Madrid' : 'es Tenerife (Canarias: IGIC, coste insular)'}.`;

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
        max_tokens: 2048,
        system,
        tools: TOOLS,
        messages: history,
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
  let reply = '';
  const actions = [];
  for (const block of data.content || []) {
    if (block.type === 'text') reply += block.text;
    if (block.type === 'tool_use') {
      if (block.name === 'update_project') actions.push({ type: 'update_project', fields: block.input });
      if (block.name === 'add_items') actions.push({ type: 'add_items', items: (block.input.items || []).slice(0, 40) });
    }
  }

  if (!reply && actions.length) reply = 'Hecho — aplicado al proyecto.';
  return json({ reply: reply.trim(), actions });
}

// No mandamos al modelo cosas voluminosas o irrelevantes para conversar
function stripProject(p) {
  const { rfqs, invoices, analysis, ...rest } = p;
  return {
    ...rest,
    items: (p.items || []).map((it) => ({ name: it.name, quantity: it.quantity, unit: it.unit, unitPrice: it.unitPrice })),
    analysisResumen: analysis ? { m2: analysis.m2Estimados, estado: analysis.estadoAparente, trabajos: analysis.trabajosSugeridos } : null,
    facturas: (invoices || []).length,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
