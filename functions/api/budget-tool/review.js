// POST /api/budget-tool/review — revisor anti-pérdidas: analiza las partidas
// actuales del proyecto frente al tipo de obra y devuelve las que
// típicamente faltan (gestión de residuos, ayudas de albañilería,
// protecciones, legalizaciones...), con precio orientativo para añadirlas.
//
// Body esperado (JSON):
//   { "project": { tipo, mode, region, calidad, m2, estancias, items: [...] } }
//
// Respuesta:
//   { verdict: "completo"|"faltan-partidas",
//     missing: [{ name, reason, unit, unitPrice, quantity }],
//     warnings: ["..."] }

import { verifySession } from './_auth.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

const REVIEW_TOOL = {
  name: 'return_review',
  description: 'Devuelve la revisión del presupuesto.',
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['completo', 'faltan-partidas'] },
      missing: {
        type: 'array',
        description: 'Partidas que faltan y deberían presupuestarse. Vacío si no falta nada relevante.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            reason: { type: 'string', description: 'Por qué suele hacer falta en este tipo de obra, en una frase.' },
            unit: { type: 'string' },
            unitPrice: { type: 'number', description: 'Precio unitario orientativo € sin impuestos.' },
            quantity: { type: 'number' },
          },
          required: ['name', 'reason', 'unit', 'unitPrice', 'quantity'],
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Avisos sobre partidas existentes: cantidades que no cuadran con los m², precios fuera de rango, duplicados...',
      },
    },
    required: ['verdict', 'missing', 'warnings'],
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

  const p = payload.project && typeof payload.project === 'object' ? payload.project : {};
  const items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) return json({ error: 'El presupuesto no tiene partidas que revisar todavía.' }, 400);

  const region = p.region === 'madrid' ? 'Madrid' : 'Tenerife (Canarias)';
  const est = p.estancias || {};
  const itemsTxt = items
    .map((it) => `- ${it.name}: ${it.quantity} ${it.unit || 'ud'} × ${it.unitPrice}€ = ${it.totalPrice}€`)
    .join('\n');

  const prompt = `Eres el revisor de presupuestos de obreko, empresa de reformas en ${region}. Revisas presupuestos ANTES de enviarlos para cazar partidas olvidadas que luego se comen el margen.

Proyecto:
- Intervención: ${p.tipo || 'sin especificar'} (${p.mode === 'amueblar' ? 'amueblar' : 'reforma'})
- Superficie: ${p.m2 || '?'} m² · Estancias: ${est.cocinas ?? '?'} cocina(s), ${est.banos ?? '?'} baño(s), ${est.dormitorios ?? '?'} dormitorio(s)
- Calidad: ${p.calidad || 'media'}

Partidas actuales del presupuesto:
${itemsTxt}

Detecta:
1. Partidas que FALTAN y casi siempre hacen falta en este tipo de obra (ej.: demolición/retirada previa, gestión de escombros y tasas de vertedero, ayudas de albañilería a instalaciones, protecciones de zonas no afectadas, limpieza final de obra, medios auxiliares, legalizaciones/boletines, pequeño material). Solo las relevantes para ESTE proyecto, con precio orientativo para la región.
2. Avisos sobre lo existente: cantidades incoherentes con los m², precios claramente fuera de mercado, posibles duplicados.

Sé concreto y no infles: si el presupuesto está razonablemente completo, dilo (verdict "completo"). Usa return_review.`;

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
        tools: [REVIEW_TOOL],
        tool_choice: { type: 'tool', name: 'return_review' },
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
  const toolUse = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'return_review');
  if (!toolUse) return json({ error: 'Respuesta inesperada de Claude.' }, 502);

  return json(toolUse.input);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
