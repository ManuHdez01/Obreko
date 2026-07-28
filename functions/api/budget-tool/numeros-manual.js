// GET  /api/budget-tool/numeros-manual  — devuelve { pyg, balance } guardados
// POST /api/budget-tool/numeros-manual  — guarda { type: 'pyg'|'balance', period, rows }
//
// Alternativa a la reconstrucción en vivo desde la API de Holded
// (functions/api/budget-tool/numeros.js): aquí se guarda tal cual el
// contenido de los Excel de "Pérdidas y ganancias" y "Balance de
// situación" que el usuario exporta directamente desde Holded y sube a
// mano. Son los números ya calculados por Holded — no se reinterpretan
// ni se recalculan, solo se muestran.
//
// rows: [{ label, total, level }] — level 0/1/2 solo afecta a la sangría
// visual (línea principal / apartado / cuenta), calculada en el propio
// navegador al parsear el Excel (ver numeros.html).

import { verifySession } from './_auth.js';

const KV_KEY = 'numeros:manual';

export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  const raw = await env.BUDGET_TOOL.get(KV_KEY);
  const data = raw ? JSON.parse(raw) : {};
  return json({ pyg: data.pyg || null, balance: data.balance || null });
}

export async function onRequestPost({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const type = payload.type === 'balance' ? 'balance' : 'pyg';
  const rows = Array.isArray(payload.rows)
    ? payload.rows
        .filter((r) => r && r.label && isFinite(Number(r.total)))
        .slice(0, 500)
        .map((r) => ({ label: String(r.label).slice(0, 200), total: Number(r.total), level: [0, 1, 2].includes(r.level) ? r.level : 0 }))
    : [];
  if (!rows.length) return json({ error: 'Sin filas válidas para guardar' }, 400);

  const raw = await env.BUDGET_TOOL.get(KV_KEY);
  const data = raw ? JSON.parse(raw) : {};
  data[type] = {
    period: payload.period ? String(payload.period).slice(0, 100) : null,
    rows,
    uploadedAt: new Date().toISOString(),
  };
  await env.BUDGET_TOOL.put(KV_KEY, JSON.stringify(data));

  return json({ ok: true, type, count: rows.length });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
