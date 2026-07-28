// GET /api/budget-tool/numeros?months=6
//
// Panel de control financiero "Números": ingresos y gastos calculados a
// partir de los ASIENTOS CONTABLES de Holded (accounting/ledger-entries)
// — es decir, la misma fuente de la que sale el informe de Pérdidas y
// Ganancias en Holded, no una reconstrucción a partir de documentos de
// compra/venta sueltos.
//
// Por qué el cambio: los documentos de "Compras" en Holded no siempre
// llevan cuenta contable asignada en el día a día (eso lo categoriza la
// gestoría al contabilizar), así que intentar clasificar gastos a partir
// de esos documentos dejaba una parte grande sin clasificar. El libro
// mayor sí refleja la contabilidad definitiva: cada línea ya tiene su
// cuenta correcta.
//
// Criterio contable: grupo 6x (60-69) = gastos, crecen por el DEBE.
// Grupo 7x (70-79) = ingresos, crecen por el HABER. Documentos (facturas/
// compras) solo se usan aparte para pendientes de cobro/pago y rankings
// de cliente/proveedor — datos que no viven en el libro mayor.
//
// Aviso importante (transparencia): las nóminas (grupo contable 64) solo
// aparecerán aquí si están contabilizadas por asiento; si Holded las
// gestiona únicamente desde el módulo de RRHH sin asiento contable
// espejo, no se reflejarán y el resultado será optimista en esa medida.

import { verifySession } from './_auth.js';

const HOLDED_BASE = 'https://api.holded.com/api/v2';

const GROUP_LABELS = {
  60: 'Compras (materiales)',
  61: 'Variación de existencias',
  62: 'Servicios exteriores',
  64: 'Gastos de personal',
  65: 'Otras pérdidas de gestión',
  66: 'Gastos financieros',
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
  const startDate = from.toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);

  let ledgerEntries, accounts, invoices, purchases, treasury;
  try {
    [ledgerEntries, accounts, invoices, purchases, treasury] = await Promise.all([
      holdedFetchAll(env, 'accounting/ledger-entries', { start_date: startDate, end_date: endDate, limit: '200' }),
      holdedFetchAll(env, 'expenses-accounts'),
      holdedFetchAll(env, 'invoices'),
      holdedFetchAll(env, 'purchases'),
      holdedFetchAll(env, 'treasury/accounts'),
    ]);
  } catch (e) {
    return json({ error: 'Error consultando la API de Holded: ' + e.message }, 502);
  }

  const accountNameByNum = new Map(accounts.map((a) => [a.account_num, a.name]));
  const monthKeys = buildMonthKeys(from, now);

  // ---------- Pérdidas y Ganancias (libro mayor) ----------
  const revenueByMonth = new Map(monthKeys.map((m) => [m, 0]));
  const expensesByMonth = new Map(monthKeys.map((m) => [m, 0]));
  const expensesByGroup = new Map();
  const indirectByMonth = new Map(monthKeys.map((m) => [m, 0]));
  const indirectByAccount = new Map();

  let revenueTotal = 0;
  let expensesTotal = 0;
  let indirectTotal = 0;
  let entriesScanned = 0;

  // Deduplicar por (entry_number, line): protección por si la paginación
  // cursor repitiera alguna página (algunas APIs devuelven de nuevo el
  // último elemento de la página anterior al pedir la siguiente).
  const seenLines = new Set();

  for (const e of ledgerEntries) {
    const lineKey = e.entry_number + ':' + e.line;
    if (seenLines.has(lineKey)) continue;
    seenLines.add(lineKey);

    const d = e.date ? new Date(e.date) : null;
    // Filtro de fecha por si acaso start_date/end_date no lo hiciera bien
    // en el servidor (red de seguridad, igual que en facturas/compras).
    if (!d || isNaN(d) || d < from || d > now) continue;
    entriesScanned++;
    const key = monthKey(d);
    // Ojo: a diferencia de facturas/compras (formato español "1.234,56"),
    // el libro mayor usa formato estándar con punto decimal ("100.00").
    const debit = parseNum(e.debit);
    const credit = parseNum(e.credit);
    const group = String(e.account).slice(0, 2);

    if (group >= '70' && group <= '79') {
      const net = credit - debit;
      revenueTotal += net;
      revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + net);
    } else if (group >= '60' && group <= '69') {
      const net = debit - credit;
      expensesTotal += net;
      expensesByMonth.set(key, (expensesByMonth.get(key) || 0) + net);

      const gCur = expensesByGroup.get(group) || { group, label: GROUP_LABELS[group] || `Grupo ${group}`, total: 0 };
      gCur.total += net;
      expensesByGroup.set(group, gCur);

      if (group === '62') {
        indirectByMonth.set(key, (indirectByMonth.get(key) || 0) + net);
        indirectTotal += net;
        const cur = indirectByAccount.get(e.account) || { account_num: e.account, name: accountNameByNum.get(e.account) || null, total: 0 };
        cur.total += net;
        indirectByAccount.set(e.account, cur);
      }
    }
  }

  // ---------- Documentos: solo pendientes de cobro/pago y rankings ----------
  // Las cifras "oficiales" de ingresos/gastos son las del libro mayor de
  // arriba. Esto es complementario — cliente/proveedor y lo pendiente de
  // cobrar/pagar no viven en el libro mayor, solo en las facturas/compras.
  let invoiceCount = 0;
  let pendingCollection = 0;
  const revenueByClient = new Map();
  for (const doc of invoices) {
    const d = doc.date ? new Date(doc.date) : null;
    if (!d || isNaN(d) || d < from || d > now) continue;
    invoiceCount++;
    pendingCollection += parseEsNum(doc.payments_pending);
    const clientName = doc.contact_name || '(sin nombre)';
    revenueByClient.set(clientName, (revenueByClient.get(clientName) || 0) + parseEsNum(doc.subtotal));
  }

  let documentsScanned = 0;
  let pendingPayment = 0;
  const expensesBySupplier = new Map();
  for (const doc of purchases) {
    const d = doc.date ? new Date(doc.date) : null;
    if (!d || isNaN(d) || d < from || d > now) continue;
    documentsScanned++;
    pendingPayment += parseEsNum(doc.payments_pending);
    let docTotal = 0;
    for (const line of doc.lines || []) {
      docTotal += parseEsNum(line.price) * parseEsNum(line.units != null ? line.units : 1) * (1 - parseEsNum(line.discount) / 100);
    }
    const supplierName = doc.contact_name || '(sin nombre)';
    expensesBySupplier.set(supplierName, (expensesBySupplier.get(supplierName) || 0) + docTotal);
  }

  // ---------- Tesorería ----------
  const cashAccounts = (treasury || []).map((t) => ({
    name: t.name,
    balance: round2(Number(t.balance) || 0),
  }));
  const cashTotal = round2(cashAccounts.reduce((s, a) => s + a.balance, 0));

  // ---------- Ratios principales ----------
  const avgMonthlyExpenses = months > 0 ? expensesTotal / months : 0;
  const topClient = topOf(revenueByClient);

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
    period: { from: startDate, to: endDate, months },
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
    note: 'Ingresos y gastos calculados a partir de los asientos contables de Holded (Pérdidas y Ganancias): grupo 7x = ingresos, grupo 6x = gastos — la contabilidad definitiva, no una reconstrucción a partir de documentos sueltos. Puede haber un pequeño desfase si algún documento reciente aún no se ha contabilizado. Las nóminas (grupo 64) solo aparecen si están contabilizadas por asiento contable; si Holded las gestiona solo desde RRHH sin asiento espejo, no se reflejan aquí.',
    entriesScanned,
    entriesFetched: ledgerEntries.length, // diagnóstico: si es mucho mayor que entriesScanned, hay duplicados o fuga de fechas
    documentsScanned,
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

async function holdedFetchAll(env, path, extraParams) {
  let items = [];
  let cursor = null;
  for (let i = 0; i < 20; i++) {
    const params = new URLSearchParams(extraParams || {});
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString() ? '?' + params.toString() : '';
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

// Facturas/compras vienen en formato español: "1.234,56"
function parseEsNum(v) {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

// El libro mayor (debit/credit) viene en formato estándar: "100.00"
function parseNum(v) {
  const n = Number(v);
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
