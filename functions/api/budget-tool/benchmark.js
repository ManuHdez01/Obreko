// POST /api/budget-tool/benchmark — compara el PVP del proyecto con los
// precios de mercado para saber si el margen aplicado deja un precio
// competitivo. Combina dos fuentes:
//   1. La tabla de referencia propia (marketRates de costs:config), si existe.
//   2. La estimación de mercado de Claude para esa intervención/región.
//
// Body esperado (JSON):
//   { "tipo": "reforma integral", "region": "tenerife", "calidad": "media",
//     "m2": 90, "pvp": 11894.83 }
//
// Respuesta:
//   { pvpPerM2, ownRange: {min,max} | null,
//     market: { low, typical, high, verdict, analysis } }

import { verifySession } from './_auth.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

const BENCHMARK_TOOL = {
  name: 'return_benchmark',
  description: 'Devuelve la comparativa de mercado.',
  input_schema: {
    type: 'object',
    properties: {
      low: { type: 'number', description: 'Precio de mercado bajo en €/m² para esta intervención.' },
      typical: { type: 'number', description: 'Precio de mercado típico en €/m².' },
      high: { type: 'number', description: 'Precio de mercado alto (gama premium) en €/m².' },
      verdict: { type: 'string', enum: ['bajo', 'competitivo', 'alto'], description: 'Dónde queda el PVP del proyecto respecto al mercado.' },
      analysis: { type: 'string', description: '2-4 frases: valoración del precio, si el margen tiene recorrido o riesgo, y qué vigilar. En español.' },
    },
    required: ['low', 'typical', 'high', 'verdict', 'analysis'],
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

  const tipo = String(payload.tipo || '').slice(0, 80);
  const region = payload.region === 'madrid' ? 'madrid' : 'tenerife';
  const calidad = ['economica', 'media', 'alta'].includes(payload.calidad) ? payload.calidad : 'media';
  const m2 = Number(payload.m2) || 0;
  const pvp = Number(payload.pvp) || 0;

  if (!m2 || !pvp) return json({ error: 'Faltan m2 o pvp del proyecto' }, 400);
  const pvpPerM2 = pvp / m2;

  // Tabla de referencia propia (opcional, mantenida en costes-config)
  let ownRange = null;
  if (env.BUDGET_TOOL) {
    try {
      const cfg = JSON.parse((await env.BUDGET_TOOL.get('costs:config')) || '{}');
      const rate = (cfg.marketRates || []).find(
        (r) => r.tipo === tipo && r.calidad === calidad && (!r.region || r.region === region)
      );
      if (rate && rate.min > 0 && rate.max > 0) ownRange = { min: rate.min, max: rate.max };
    } catch { /* sin tabla propia */ }
  }

  const prompt = `Eres el analista de precios de obreko, empresa de reformas en Tenerife y Madrid.

Proyecto a evaluar:
- Intervención: ${tipo}
- Región: ${region === 'tenerife' ? 'Tenerife (Canarias)' : 'Madrid'}
- Calidad de acabados: ${calidad}
- Superficie: ${m2} m²
- Nuestro precio de venta (sin impuestos): ${pvp.toFixed(2)} € → ${pvpPerM2.toFixed(2)} €/m²
${ownRange ? `- Referencia interna de mercado que mantiene el equipo: ${ownRange.min}–${ownRange.max} €/m²` : ''}

Estima el rango de precios de mercado actual (€/m², sin impuestos) que cobran empresas de reformas comparables en esa región para esa intervención y calidad, y valora si nuestro precio queda bajo, competitivo o alto. Ten en cuenta particularidades de la región (coste insular en Canarias, mercado madrileño). Sé conservador: si dudas, da rangos amplios y dilo en el análisis. Usa return_benchmark.`;

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
        max_tokens: 1024,
        tools: [BENCHMARK_TOOL],
        tool_choice: { type: 'tool', name: 'return_benchmark' },
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
  const toolUse = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'return_benchmark');
  if (!toolUse) return json({ error: 'Respuesta inesperada de Claude.' }, 502);

  return json({ pvpPerM2: +pvpPerM2.toFixed(2), ownRange, market: toolUse.input });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
