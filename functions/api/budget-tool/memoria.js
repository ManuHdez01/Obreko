// POST /api/budget-tool/memoria — genera la memoria descriptiva comercial
// del proyecto: el texto de alcance/descripción de trabajos que va en la
// propuesta al cliente, redactado a partir de las partidas y características.
// NUNCA menciona costes internos, márgenes ni proveedores de compra.
//
// Body esperado (JSON):
//   { "project": { tipo, region, calidad, m2, estancias, clientName, address, items: [...] } }
//
// Respuesta:
//   { memoria: "texto completo", bloques: [{ titulo, texto }] }

import { verifySession } from './_auth.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

const MEMORIA_TOOL = {
  name: 'return_memoria',
  description: 'Devuelve la memoria descriptiva de la propuesta.',
  input_schema: {
    type: 'object',
    properties: {
      memoria: { type: 'string', description: 'Texto completo de la memoria, listo para pegar en la propuesta.' },
      bloques: {
        type: 'array',
        description: 'La misma memoria dividida en bloques por capítulo/estancia.',
        items: {
          type: 'object',
          properties: { titulo: { type: 'string' }, texto: { type: 'string' } },
          required: ['titulo', 'texto'],
        },
      },
    },
    required: ['memoria', 'bloques'],
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
  if (!items.length) return json({ error: 'El proyecto no tiene partidas: añade materiales antes de generar la memoria.' }, 400);

  const est = p.estancias || {};
  const itemsTxt = items.map((it) => `- ${it.name} (${it.quantity} ${it.unit || 'ud'})`).join('\n');

  const prompt = `Eres el redactor técnico-comercial de obreko, empresa de reformas en ${p.region === 'madrid' ? 'Madrid' : 'Tenerife'}. Tono de marca: directo, experto, cercano, comprometido. Claim: "Sin sorpresas. Sin excusas."

Redacta la MEMORIA DESCRIPTIVA de esta propuesta para el cliente final:
- Intervención: ${p.tipo || 'reforma'} · ${p.m2 || '?'} m² · calidad ${p.calidad || 'media'}
- Estancias: ${est.cocinas ?? '?'} cocina(s), ${est.banos ?? '?'} baño(s), ${est.dormitorios ?? '?'} dormitorio(s)
${p.address ? `- Inmueble: ${p.address}` : ''}

Trabajos presupuestados:
${itemsTxt.slice(0, 5000)}

Requisitos:
- En español, dirigida al cliente (trato de "usted" evitado: tutea con respeto, como habla obreko).
- Organizada por capítulos/estancias lógicos, describiendo QUÉ se hará y CÓMO (materiales, acabados, proceso), vendiendo el valor sin humo.
- PROHIBIDO mencionar: precios, costes, márgenes, proveedores de compra, o partidas internas.
- Cierra con una frase breve de compromiso de obreko (plazos firmados, comunicación, limpieza).
- Extensión total: 250-450 palabras.

Usa return_memoria.`;

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
        tools: [MEMORIA_TOOL],
        tool_choice: { type: 'tool', name: 'return_memoria' },
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
  const toolUse = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'return_memoria');
  if (!toolUse) return json({ error: 'Respuesta inesperada de Claude.' }, 502);

  return json(toolUse.input);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
