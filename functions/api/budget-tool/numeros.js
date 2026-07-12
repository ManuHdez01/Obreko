// GET /api/budget-tool/numeros?months=6
//
// Datos reales de contabilidad (Holded, Pronexo Hábitat) para el panel de
// control financiero "Números": ingresos, gastos indirectos y tesorería.
//
// Los costes de materiales (grupo contable 60) se excluyen a propósito: esos
// van directamente dentro de cada partida de presupuesto, no como coste
// estructural. Solo se calculan aquí los gastos indirectos (grupo 62 —
// servicios exteriores: alquiler, seguros, profesionales, suministros...).

import { verifySession } from './_auth.js';

const HOLDED_BASE = 'https://api.holded.com/api/v2';

export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env))) {
    return json({ error: 'No autenticado' }, 401);
  }
  if (!env.HOLDED_API_KEY) {
    return json({ error: 'HOLDED_API_KEY no configurado' }, 503);
  }

  const url = new URL(request.url);
  const months = Math.min(24, Math.max(1, Number(url.searchParams.get('months')) || 6));

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  let accounts, purchases, invoices, treasury;
  try {
    [accounts, purchases, invoices, treasury] = await Promise.all([
      holdedFetchAll(env, 'expenses-accounts'),
      holdedFetchAll(env, 'purchases'),
      holdedFetchAll(env, 'invoices'),
      holdedFetchAll(env, 'treasury/accounts'),
    ]);
  } catch (e) {
    return json({ error: 'Error consultando la API de Holded: ' + e.message }, 502);
  }

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const monthKeys = buildMonthKeys(from, now);

  // Ingresos por mes (todas las facturas de venta)
  const revenueByMonth = new Map(monthKeys.map((m) => [m, 0]));
  let revenueTotal = 0;
  for (const doc of invoices) {
    const d = doc.date ? new Date(doc.date) : null;
    if (!d || isNaN(d) || d < from || d > now) continue;
    const key = monthKey(d);
    const amount = parseEsNum(doc.subtotal);
    revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + amount);
    revenueTotal += amount;
  }

  // Gastos indirectos (grupo 62) por mes y por cuenta
  const indirectByMonth = new Map(monthKeys.map((m) => [m, 0]));
  const indirectByAccount = new Map();
  let indirectTotal = 0;
  let documentsScanned = 0;
  let linesUnmatched = 0;

  for (const doc of purchases) {
    const d = doc.date ? new Date(doc.date) : null;
    if (!d || isNaN(d) || d < from || d > now) continue;
    documentsScanned++;
    const key = monthKey(d);

    for (const line of doc.lines || []) {
      const acc = accountMap.get(line.account);
      if (!acc) {
        linesUnmatched++;
        continue;
      }
      const prefix = String(acc.account_num).slice(0, 2);
      if (prefix !== '62') continue;

      const amount = parseEsNum(line.price) * parseEsNum(line.units != null ? line.units : 1) * (1 - parseEsNum(line.discount) / 100);

      indirectByMonth.set(key, (indirectByMonth.get(key) || 0) + amount);
      indirectTotal += amount;

      const cur = indirectByAccount.get(acc.account_num) || { account_num: acc.account_num, name: acc.name, total: 0 };
      cur.total += amount;
      indirectByAccount.set(acc.account_num, cur);
    }
  }

  // El saldo de tesorería viene en formato estándar (punto decimal), a
  // diferencia de los importes de facturas/compras (formato español).
  const cashAccounts = (treasury || []).map((t) => ({
    name: t.name,
    balance: round2(Number(t.balance) || 0),
  }));
  const cashTotal = round2(cashAccounts.reduce((s, a) => s + a.balance, 0));

  return json({
    period: { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), months },
    revenue: {
      total: round2(revenueTotal),
      byMonth: monthKeys.map((m) => ({ month: m, total: round2(revenueByMonth.get(m) || 0) })),
    },
    indirectExpenses: {
      total: round2(indirectTotal),
      byMonth: monthKeys.map((m) => ({ month: m, total: round2(indirectByMonth.get(m) || 0) })),
      byAccount: Array.from(indirectByAccount.values())
        .sort((a, b) => b.total - a.total)
        .map((x) => ({ ...x, total: round2(x.total) })),
    },
    cash: { total: cashTotal, byAccount: cashAccounts },
    note: 'Excluye grupo contable 60 (compras de materiales): ese coste se imputa directamente en cada partida de presupuesto, no aquí.',
    documentsScanned,
    linesUnmatched,
    generatedAt: new Date().toISOString(),
  });
}

async function holdedFetchAll(env, path) {
  let items = [];
  let cursor = null;
  for (let i = 0; i < 20; i++) {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const r = await fetch(`${HOLDED_BASE}/${path}${qs}`, {
      headers: { Authorization: `Bearer ${env.HOLDED_API_KEY}`, Accept: 'application/json' },
    });
    if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
    const data = await r.json();
    items = items.concat(data.items || []);
    if (!data.has_more || !data.cursor) break;
    cursor = data.cursor;
  }
  return items;
}

function buildMonthKeys(from, to) {
  const keys = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  while (d <= to) {
    keys.push(monthKey(d));
    d.setMonth(d.getMonth() + 1);
  }
  return keys;
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Los importes de Holded vienen en formato español: "1.234,56"
function parseEsNum(v) {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
