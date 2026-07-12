// POST /api/budget-tool/insights — análisis IA del negocio para el panel
// económico: lee los proyectos con su economía y devuelve un diagnóstico
// ejecutivo (riesgos de margen, desviaciones, cobros pendientes, foco).
//
// No recibe datos del cliente: los proyectos se leen directamente de KV
// para que el análisis siempre sea sobre el estado real.
//
// Respuesta:
//   { headline, highlights: [..], risks: [..], actions: [..] }

import { verifySession } from './_auth.js';
import { computeEconomics } from './projects.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

const INSIGHTS_TOOL = {
  name: 'return_insights',
  description: 'Devuelve el análisis ejecutivo del negocio.',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'Diagnóstico general en una frase.' },
      highlights: { type: 'array', items: { type: 'string' }, description: 'Lo que va bien / datos positivos relevantes (0-4).' },
      risks: { type: 'array', items: { type: 'string' }, description: 'Riesgos concretos: márgenes reales por debajo del previsto, cobros pendientes grandes, costes desviados... con el proyecto y la cifra (0-5).' },
      actions: { type: 'array', items: { type: 'string' }, description: 'Acciones recomendadas priorizadas, concretas y accionables (1-4).' },
    },
    required: ['headline', 'highlights', 'risks', 'actions'],
  },
};

export async function onRequestPost({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY no configurado' }, 503);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  // Leer todos los proyectos de KV
  const indexRaw = await env.BUDGET_TOOL.get('projects:index');
  let index = [];
  try { index = JSON.parse(indexRaw || '[]'); } catch { /* vacío */ }
  if (!index.length) return json({ error: 'No hay proyectos que analizar todavía.' }, 400);

  const rows = [];
  for (const entry of index.slice(0, 100)) {
    const raw = await env.BUDGET_TOOL.get('project:' + entry.id);
    if (!raw) continue;
    const p = JSON.parse(raw);
    const e = computeEconomics(p);
    rows.push({
      ref: p.ref, cliente: p.clientName, tipo: p.tipo, region: p.region, m2: p.m2,
      costePrevisto: r2(e.internalCost), pvp: r2(e.suggestedPrice), margenPrevistoPct: r2(e.marginPct),
      facturado: r2(e.invoicedTotal), cobrado: r2(e.collectedTotal), pendienteCobro: r2(e.invoicedTotal - e.collectedTotal),
      costeReal: r2(e.realCost), margenRealPct: e.realMarginPct == null ? null : r2(e.realMarginPct),
      rfqs: (p.rfqs || []).length, facturas: (p.invoices || []).length,
      actualizado: p.updatedAt,
    });
  }

  const prompt = `Eres el analista financiero de obreko, empresa de reformas en Tenerife y Madrid. Analiza la cartera de proyectos del portal interno de presupuestos y da un diagnóstico ejecutivo útil para el dueño.

Cartera (JSON):
${JSON.stringify(rows).slice(0, 12000)}

Céntrate en lo accionable: proyectos con margen real por debajo del previsto (y cuánto), cobros pendientes que acumulan riesgo, costes reales desviándose, proyectos parados sin facturar, concentración en pocos clientes. Cifras siempre en € con el ref del proyecto. Si la cartera es pequeña o está sana, dilo sin inventar problemas. Usa return_insights.`;

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
        tools: [INSIGHTS_TOOL],
        tool_choice: { type: 'tool', name: 'return_insights' },
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
  const toolUse = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'return_insights');
  if (!toolUse) return json({ error: 'Respuesta inesperada de Claude.' }, 502);

  return json({ ...toolUse.input, analyzedProjects: rows.length, analyzedAt: new Date().toISOString() });
}

function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
