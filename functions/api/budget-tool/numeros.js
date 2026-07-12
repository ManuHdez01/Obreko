// GET /api/budget-tool/numeros?months=6
//
// Panel de control financiero "Números": trae y agrega toda la contabilidad
// disponible en Holded (Pronexo Hábitat) — ventas, compras/gastos por grupo
// contable, tesorería, cobros y pagos pendientes — y calcula los ratios
// principales del negocio.
//
// Aviso importante (transparencia): las nóminas (grupo contable 64) NO están
// incluidas. Holded las gestiona por el módulo de RRHH, no por "Compras", y
// ese módulo no está expuesto en la API pública de la misma forma. Los
// ratios de margen/runway están marcados como "aproximados" por este motivo.

import { verifySession } from './_auth.js';

const HOLDED_BASE = 'https://api.holded.com/api/v2';

// Grupos del plan general contable español relevantes en "Compras"/gastos.
const GROUP_LABELS = {
  60: 'Compras (materiales)',
  61: 'Variación de existencias',
  62: 'Servicios exteriores',
  65: 'Otras pérdidas de gestión',
  67: 'Gastos excepcionales',
  68: 'Amortizaciones',
  69: 'Deterioros y provisiones',
};

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

  // ---------- Ingresos ----------
  const revenueByMonth = new Map(monthKeys.map((m) => [m, 0]));
  const revenueByClient = new Map();
  let revenueTotal = 0;
  let invoiceCount = 0;
  let pendingCollection = 0;

  for (const doc of invoices) {
    const d = doc.date ? new Date(doc.date) : null;
    if (!d || isNaN(d) || d < from || d > now) continue;
    invoiceCount++;
    const key = monthKey(d);
    const amount = parseEsNum(doc.subtotal);

    revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + amount);
    revenueTotal += amount;
    pendingCollection += parseEsNum(doc.payments_pending);

    const clientName = doc.contact_name || '(sin nombre)';
    revenueByClient.set(clientName, (revenueByClient.get(clientName) || 0) + amount);
  }

  // ---------- Gastos (todos los grupos) ----------
  const expensesByMonth = new Map(monthKeys.map((m) => [m, 0]));
  const expensesByGroup = new Map();
  const expensesBySupplier = new Map();
  const indirectByMonth = new Map(monthKeys.map((m) => [m, 0]));
  const indirectByAccount = new Map();

  let expensesTotal = 0;
  let indirectTotal = 0;
  let documentsScanned = 0;
  let linesUnmatched = 0;
  let pendingPayment = 0;

  for (const doc of purchases) {
    const d = doc.date ? new Date(doc.date) : null;
    if (!d || isNaN(d) || d < from || d > now) continue;
    documentsScanned++;
    const key = monthKey(d);
    pendingPayment += parseEsNum(doc.payments_pending);

    let docTotal = 0;
    for (const line of doc.lines || []) {
      const acc = accountMap.get(line.account);
      const amount = parseEsNum(line.price) * parseEsNum(line.units != null ? line.units : 1) * (1 - parseEsNum(line.discount) / 100);

      if (!acc) {
        linesUnmatched++;
        expensesTotal += amount;
        expensesByMonth.set(key, (expensesByMonth.get(key) || 0) + amount);
        docTotal += amount;
        continue;
      }

      const group = String(acc.account_num).slice(0, 2);

      expensesTotal += amount;
      expensesByMonth.set(key, (expensesByMonth.get(key) || 0) + amount);
      docTotal += amount;

      const gCur = expensesByGroup.get(group) || { group, label: GROUP_LABELS[group] || `Grupo ${group}`, total: 0 };
      gCur.total += amount;
      expensesByGroup.set(group, gCur);

      if (group === '62') {
        indirectByMonth.set(key, (indirectByMonth.get(key) || 0) + amount);
        indirectTotal += amount;
        const cur = indirectByAccount.get(acc.account_num) || { account_num: acc.account_num, name: acc.name, total: 0 };
        cur.total += amount;
        indirectByAccount.set(acc.account_num, cur);
      }
    }

    const supplierName = doc.contact_name || '(sin nombre)';
    expensesBySupplier.set(supplierName, (expensesBySupplier.get(supplierName) || 0) + docTotal);
  }

  // ---------- Tesorería ----------
  // El saldo de tesorería viene en formato estándar (punto decimal), a
  // diferencia de los importes de facturas/compras (formato español).
  const cashAccounts = (treasury || []).map((t) => ({
    name: t.name,
    balance: round2(Number(t.balance) || 0),
  }));
  const cashTotal = round2(cashAccounts.reduce((s, a) => s + a.balance, 0));

  // ---------- Ratios principales ----------
  const avgMonthlyExpenses = months > 0 ? expensesTotal / months : 0;
  const topClient = topOf(revenueByClient);
  const topSupplier = topOf(expensesBySupplier);

  const ratios = {
    grossMarginPct: revenueTotal > 0 ? round2(((revenueTotal - expensesTotal) / revenueTotal) * 100) : null,
    avgInvoiceTicket: invoiceCount > 0 ? round2(revenueTotal / invoiceCount) : null,
    topClientConcentrationPct: revenueTotal > 0 && topClient ? round2((topClient.total / revenueTotal) * 100) : null,
    cashRunwayMonths: avgMonthlyExpenses > 0 ? round2(cashTotal / avgMonthlyExpenses) : null,
    avgMonthlyRevenue: round2(revenueTotal / months),
    avgMonthlyExpenses: round2(avgMonthlyExpenses),
  };

  const toRanked = (map, limit) =>
    Array.from(map.entries())
      .map(([name, total]) => ({ name, total: round2(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit || 8);

  return json({
    period: { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), months },
    revenue: {
      total: round2(revenueTotal),
      invoiceCount,
      pendingCollection: round2(pendingCollection),
      byMonth: monthKeys.map((m) => ({ month: m, total: round2(revenueByMonth.get(m) || 0) })),
      byClient: toRanked(revenueByClient),
    },
    expenses: {
      total: round2(expensesTotal),
      documentCount: documentsScanned,
      pendingPayment: round2(pendingPayment),
      byMonth: monthKeys.map((m) => ({ month: m, total: round2(expensesByMonth.get(m) || 0) })),
      byGroup: Array.from(expensesByGroup.values())
        .sort((a, b) => b.total - a.total)
        .map((g) => ({ ...g, total: round2(g.total) })),
      bySupplier: toRanked(expensesBySupplier),
    },
    indirectExpenses: {
      total: round2(indirectTotal),
      byMonth: monthKeys.map((m) => ({ month: m, total: round2(indirectByMonth.get(m) || 0) })),
      byAccount: Array.from(indirectByAccount.values())
        .sort((a, b) => b.total - a.total)
        .map((x) => ({ ...x, total: round2(x.total) })),
    },
    cash: { total: cashTotal, byAccount: cashAccounts },
    ratios,
    note: 'Los ratios de margen y runway son aproximados: excluyen nóminas (grupo contable 64), que Holded gestiona por RRHH y no está disponible vía la API de Compras. "Gastos indirectos" (grupo 62) excluye a propósito el grupo 60 (materiales), que se imputa dentro de cada partida de presupuesto.',
    documentsScanned,
    linesUnmatched,
    generatedAt: new Date().toISOString(),
  });
}

function topOf(map) {
  let best = null;
  for (const [name, total] of map.entries()) {
    if (!best || total > best.total) best = { name, total };
  }
  return best;
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
