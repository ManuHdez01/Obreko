// POST /api/budget-tool/transporte-estimado — estima el coste de transporte,
// portes y desplazamientos de un proyecto a partir de sus capítulos, para
// añadirlo como partida del presupuesto. Es una versión ligera y rápida de
// lo que ya hace propuesta-textos.js (que también estima transporte, pero
// como parte de generar toda la propuesta): aquí no hace falta redactar
// nada, solo un número y su porqué.
//
// Body esperado (JSON): { project: { region, tipo, m2, items: [...] } }
// Respuesta: { estimado, justificacion }

import { verifySession } from './_auth.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const MAX_PARTIDAS = 120;

const TRANSPORTE_TOOL = {
  name: 'return_transporte',
  description: 'Devuelve la estimación de transporte, portes y desplazamientos de la obra.',
  input_schema: {
    type: 'object',
    properties: {
      estimado: { type: 'number', description: 'Coste estimado en euros ENTEROS de transporte, portes y desplazamientos de esta obra.' },
      justificacion: { type: 'string', description: 'Una frase explicando de dónde sale la cifra (volumen de material, distancia, número de portes, contenedores de escombro).' },
    },
    required: ['estimado', 'justificacion'],
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

  const p = payload.project || {};
  const items = Array.isArray(p.items) ? p.items.slice(0, MAX_PARTIDAS) : [];
  if (!items.length) return json({ error: 'El presupuesto no tiene partidas todavía.' }, 400);

  const canarias = (p.region || 'tenerife') === 'tenerife';

  const porCapitulo = new Map();
  for (const it of items) {
    const cap = String(it.capitulo || '').trim() || 'Sin capítulo';
    const total = Number(it.totalPrice) || 0;
    porCapitulo.set(cap, (porCapitulo.get(cap) || 0) + total);
  }
  const capitulos = Array.from(porCapitulo.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cap, total]) => `- ${cap}: ${Math.round(total)} €`)
    .join('\n');

  const prompt = `Eres quien presupuesta la logística de obreko, empresa de reformas en ${canarias ? 'Tenerife (Canarias)' : 'Madrid'}.

Estima el coste de TRANSPORTE, PORTES Y DESPLAZAMIENTOS de esta obra: viajes de material, retirada de escombros a vertedero, desplazamientos del equipo. En euros enteros, coherente con el tamaño real del presupuesto (ni testimonial ni desproporcionado).

DATOS DE LA OBRA
${p.tipo ? 'Tipo: ' + p.tipo : ''}${p.m2 ? ' · ' + p.m2 + ' m²' : ''}

CAPÍTULOS DEL PRESUPUESTO (importe de venta, de mayor a menor peso)
${capitulos}
${canarias ? '\nCuenta con que buena parte del material llega a la isla por barco: si hay capítulos con mucho suministro (cocina, sanitarios, carpintería), eso pesa en el transporte.' : ''}

Usa return_transporte.`;

  let res;
  try {
    res = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 500,
        tools: [TRANSPORTE_TOOL],
        tool_choice: { type: 'tool', name: 'return_transporte' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    return json({ error: 'No se pudo contactar con la IA: ' + e.message }, 502);
  }

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    return json({ error: 'La IA devolvió un error (' + res.status + ')', detalle: detalle.slice(0, 300) }, 502);
  }

  const data = await res.json();
  const uso = (data.content || []).find((c) => c.type === 'tool_use');
  if (!uso || !uso.input) return json({ error: 'La IA no devolvió la estimación.' }, 502);

  return json({
    estimado: Math.round(Number(uso.input.estimado) || 0),
    justificacion: String(uso.input.justificacion || ''),
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
