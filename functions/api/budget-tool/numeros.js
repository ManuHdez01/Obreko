// GET /api/budget-tool/numeros?months=6
//
// Panel de control financiero "Números": reproduce el mismo desglose que
// el informe de Pérdidas y Ganancias de Holded (modelo abreviado, RD
// 1515/2007) — línea por línea, cuenta por cuenta — calculado a partir de
// los ASIENTOS CONTABLES (ledger-entries), la misma fuente de la que sale
// ese informe en Holded. No es una reconstrucción a partir de documentos
// de compra/venta sueltos: esos no siempre llevan cuenta contable
// asignada en el día a día (lo categoriza la gestoría al contabilizar),
// así que se usan solo para lo que no vive en el libro mayor —
// pendientes de cobro/pago y rankings de cliente/proveedor.
//
// Criterio contable: cada línea del PyG se alimenta de uno o varios
// grupos/subgrupos contables (ver PNL_GROUP_MAP / PNL_SUBGROUP_MAP). El
// importe de cada asiento se sube siempre como (haber − debe): para
// cuentas de ingreso (grupo 7x) da positivo, para cuentas de gasto
// (grupo 6x) da negativo — coincide con el signo que muestra Holded.
//
// Aviso importante (transparencia): las nóminas (grupo contable 64) solo
// aparecerán aquí si están contabilizadas por asiento; si Holded las
// gestiona únicamente desde el módulo de RRHH sin asiento contable
// espejo, no se reflejarán y el resultado será optimista en esa medida.

import { verifySession } from './_auth.js';

const HOLDED_BASE = 'https://api.holded.com/api/v2';

// Grupo contable (2 dígitos) → línea del modelo abreviado de PyG.
const PNL_GROUP_MAP = {
  70: { line: '1', label: '1. Importe neto de la cifra de negocios', sub: 'b) Prestaciones de servicios' },
  71: { line: '2', label: '2. Variación de existencias de productos terminados y en curso de fabricación', sub: null },
  73: { line: '3', label: '3. Trabajos realizados por la empresa para su activo', sub: null },
  60: { line: '4', label: '4. Aprovisionamientos', sub: null },
  61: { line: '4', label: '4. Aprovisionamientos', sub: null },
  75: { line: '5', label: '5. Otros ingresos de explotación', sub: 'a) Ingresos accesorios y otros de gestión corriente' },
  74: { line: '5', label: '5. Otros ingresos de explotación', sub: 'b) Subvenciones de explotación incorporadas al resultado del ejercicio' },
  64: { line: '6', label: '6. Gastos de personal', sub: null },
  62: { line: '7', label: '7. Otros gastos de explotación', sub: 'a) Servicios exteriores' },
  63: { line: '7', label: '7. Otros gastos de explotación', sub: 'b) Tributos' },
  65: { line: '7', label: '7. Otros gastos de explotación', sub: 'c) Pérdida, deterioro y variación de provisiones por operaciones comerciales' },
  68: { line: '8', label: '8. Amortización del inmovilizado', sub: null },
  67: { line: '13', label: '13. Otros resultados', sub: 'b) Gastos excepcionales' },
  77: { line: '13', label: '13. Otros resultados', sub: 'a) Ingresos excepcionales' },
  76: { line: '14', label: '14. Ingresos financieros', sub: null },
  66: { line: '15', label: '15. Gastos financieros', sub: null },
};

// Subgrupo (3 dígitos): casos que necesitan más precisión que el grupo.
const PNL_SUBGROUP_MAP = {
  746: { line: '9', label: '9. Imputación de subvenciones de inmovilizado no financiero y otras', sub: null },
  668: { line: '17', label: '17. Diferencias de cambio', sub: null },
  768: { line: '17', label: '17. Diferencias de cambio', sub: null },
  630: { line: '19', label: '19. Impuestos sobre beneficios', sub: null },
  631: { line: '19', label: '19. Impuestos sobre beneficios', sub: null },
  634: { line: '19', label: '19. Impuestos sobre beneficios', sub: null },
};

// Líneas que suman al "Resultado de explotación", "Resultado financiero"
// y "Impuestos" respectivamente — el resto (Resultado antes de impuestos,
// Resultado del ejercicio) son sumas de estos tres bloques.
const EXPLOTACION_LINES = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '13']);
const FINANCIERO_LINES = new Set(['14', '15', '16', '17', '18']);
const IMPUESTO_LINES = new Set(['19']);

function classifyPnLLine(accountNum) {
  const s = String(accountNum);
  return PNL_SUBGROUP_MAP[s.slice(0, 3)] || PNL_GROUP_MAP[s.slice(0, 2)] || null;
}

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

  // Todo el resto de la función va en un único try/catch — cualquier fallo
  // (de red, de forma de datos inesperada, lo que sea) debe volver como un
  // JSON con mensaje claro, nunca como un 502 en blanco sin explicación.
  try {
    const [ledgerEntries, chartAccounts, invoices, purchases, treasury] = await Promise.all([
      holdedFetchAll(env, 'ledger-entries', { start_date: startDate, end_date: endDate, limit: '200' }),
      holdedFetchAll(env, 'accounting-accounts'),
      holdedFetchAll(env, 'invoices'),
      holdedFetchAll(env, 'purchases'),
      holdedFetchAll(env, 'treasury/accounts'),
    ]);

    // accounting-accounts identifica cada cuenta con "number", no "id" ni
    // "account_num" (esos son de otros endpoints de Holded — cada listado
    // usa su propio nombre de campo).
    const accountNameByNum = new Map(chartAccounts.map((a) => [a.number, a.name]));
    const monthKeys = buildMonthKeys(from, now);

    // ---------- Pérdidas y Ganancias, línea por línea (libro mayor) ----------
    const revenueByMonth = new Map(monthKeys.map((m) => [m, 0]));
    const expensesByMonth = new Map(monthKeys.map((m) => [m, 0]));
    // line -> { line, label, total, subs: Map(subLabel -> { label, total, accounts: Map(num -> {account_num,name,total}) }) }
    const pnlLines = new Map();
    let revenueTotal = 0;
    let expensesTotal = 0;
    let entriesScanned = 0;

    for (const e of ledgerEntries) {
      const d = e.date ? new Date(e.date) : null;
      // Filtro de fecha por si acaso start_date/end_date no lo hiciera bien
      // en el servidor (red de seguridad, igual que en facturas/compras).
      if (!d || isNaN(d) || d < from || d > now) continue;

      const cls = classifyPnLLine(e.account);
      if (!cls) continue; // cuenta de balance (clientes, bancos, socios...), no es del PyG

      entriesScanned++;
      const key = monthKey(d);
      // Ojo: a diferencia de facturas/compras (formato español "1.234,56"),
      // el libro mayor usa formato estándar con punto decimal ("100.00").
      const net = parseNum(e.credit) - parseNum(e.debit); // + ingreso, − gasto (signo ya correcto para ambos)

      if (EXPLOTACION_LINES.has(cls.line) || FINANCIERO_LINES.has(cls.line) || IMPUESTO_LINES.has(cls.line)) {
        if (net >= 0) {
          revenueTotal += net;
          revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + net);
        } else {
          expensesTotal += -net;
          expensesByMonth.set(key, (expensesByMonth.get(key) || 0) + -net);
        }
      }

      if (!pnlLines.has(cls.line)) pnlLines.set(cls.line, { line: cls.line, label: cls.label, total: 0, subs: new Map() });
      const L = pnlLines.get(cls.line);
      L.total += net;

      const subLabel = cls.sub || cls.label;
      if (!L.subs.has(subLabel)) L.subs.set(subLabel, { label: subLabel, total: 0, accounts: new Map() });
      const S = L.subs.get(subLabel);
      S.total += net;

      if (!S.accounts.has(e.account)) S.accounts.set(e.account, { account_num: e.account, name: accountNameByNum.get(e.account) || null, total: 0 });
      S.accounts.get(e.account).total += net;
    }

    const sumLines = (set) => Array.from(pnlLines.values()).filter((l) => set.has(l.line)).reduce((s, l) => s + l.total, 0);
    const resultadoExplotacion = round2(sumLines(EXPLOTACION_LINES));
    const resultadoFinanciero = round2(sumLines(FINANCIERO_LINES));
    const resultadoAntesImpuestos = round2(resultadoExplotacion + resultadoFinanciero);
    const impuestos = round2(sumLines(IMPUESTO_LINES));
    const resultadoEjercicio = round2(resultadoAntesImpuestos + impuestos);

    const pnl = Array.from(pnlLines.values())
      .sort((a, b) => Number(a.line) - Number(b.line))
      .map((l) => ({
        line: l.line,
        label: l.label,
        total: round2(l.total),
        subs: Array.from(l.subs.values()).map((s) => ({
          label: s.label,
          total: round2(s.total),
          accounts: Array.from(s.accounts.values())
            .sort((a, b) => String(a.account_num).localeCompare(String(b.account_num)))
            .map((a) => ({ ...a, total: round2(a.total) })),
        })),
      }));

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

    // Si no se ha encontrado ni un solo asiento del PyG, casi seguro que la
    // clave de API no tiene el scope accounting:daily-ledger.read (Holded
    // puede devolver una lista vacía en vez de un error 401/403 cuando falta
    // el permiso, así que no se detecta como fallo de red).
    const scopeWarning = entriesScanned === 0
      ? 'No se ha encontrado ningún asiento contable en el periodo. Lo más probable es que a la clave de API de Holded (HOLDED_API_KEY) le falte el permiso "accounting:daily-ledger.read" (y/o "accounting:chart-of-accounts.read") — revísalo en Holded, en la configuración de la clave de API, y añade esos scopes si no están.'
      : null;

    return json({
      period: { from: startDate, to: endDate, months },
      scopeWarning,
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
        bySupplier: toRanked(expensesBySupplier),
      },
      pnl,
      resultadoExplotacion,
      resultadoFinanciero,
      resultadoAntesImpuestos,
      impuestos,
      resultadoEjercicio,
      cash: { total: cashTotal, byAccount: cashAccounts },
      ratios,
      note: 'Desglose calculado a partir de los asientos contables de Holded (Pérdidas y Ganancias), replicando el modelo abreviado (RD 1515/2007): mismas líneas y cuentas que el informe oficial. Puede haber un pequeño desfase si algún documento reciente aún no se ha contabilizado. Las nóminas (grupo 64) solo aparecen si están contabilizadas por asiento contable.',
      entriesScanned,
      entriesFetched: ledgerEntries.length, // diagnóstico: si es mucho mayor que entriesScanned, hay duplicados o fuga de fechas
      documentsScanned,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return json({ error: 'Error consultando la API de Holded: ' + e.message }, 502);
  }
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
