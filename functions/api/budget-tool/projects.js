// GET    /api/budget-tool/projects            — lista de proyectos (resumen)
// GET    /api/budget-tool/projects?id=<id>    — detalle de un proyecto
// POST   /api/budget-tool/projects            — crea o actualiza { id?, ...campos }
// DELETE /api/budget-tool/projects?id=<id>    — elimina proyecto
//
// El proyecto es la entidad central de la herramienta de presupuestos:
//   {
//     id, ref, clientName, clientEmail, clientPhone, address,
//     region: 'tenerife'|'madrid', mode: 'reforma'|'amueblar',
//     tipo, m2, calidad, estancias: {cocinas,banos,dormitorios},
//     analysis: { ... resultado de analyze.js ... },
//     items: [{ name, supplier, unit, unitPrice, quantity, totalPrice, reasoning }],
//     laborHours, laborRate,           // editable; por defecto de costs-config
//     marginPct,                       // margen objetivo del proyecto
//     rfqs: [{ id, supplierId, supplierName, sentAt, items, status, quotedAmount }],
//     invoices: [{ id, tipo:'emitida'|'recibida', contraparte, numero, fecha,
//                  base, impuestoPct, total, estado:'pendiente'|'cobrada'|'pagada' }],
//     status: 'borrador'|'ganado'|'perdido',
//     pricesLearned: bool,  // true tras volcar las partidas a price-memory.js (solo una vez, al ganar)
//     createdAt, updatedAt
//   }
//
// El cálculo económico (computeEconomics) se recalcula en cada guardado y
// se devuelve como campo `economics` (no se persiste redundante salvo caché).

import { verifySession } from './_auth.js';
import { recordProjectPrices } from './price-memory.js';

const INDEX_KEY = 'projects:index';
const STATUS_VALUES = ['borrador', 'ganado', 'perdido'];

export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (id) {
    const raw = await env.BUDGET_TOOL.get('project:' + id);
    if (!raw) return json({ error: 'Proyecto no encontrado' }, 404);
    const project = JSON.parse(raw);
    return json({ project, economics: computeEconomics(project) });
  }

  const index = await readIndex(env);
  // Resumen con economía básica para el listado / dashboard
  const items = [];
  for (const entry of index) {
    const raw = await env.BUDGET_TOOL.get('project:' + entry.id);
    if (!raw) continue;
    const p = JSON.parse(raw);
    items.push({
      id: p.id,
      ref: p.ref,
      clientName: p.clientName,
      region: p.region,
      tipo: p.tipo,
      m2: p.m2,
      updatedAt: p.updatedAt,
      economics: computeEconomics(p),
    });
  }
  items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return json({ count: items.length, items });
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

  const now = new Date().toISOString();
  let project;

  if (payload.id) {
    const raw = await env.BUDGET_TOOL.get('project:' + payload.id);
    if (!raw) return json({ error: 'Proyecto no encontrado' }, 404);
    project = { ...JSON.parse(raw), ...sanitizeProject(payload), id: payload.id, updatedAt: now };
  } else {
    const id = genId();
    project = {
      ...defaultProject(),
      ...sanitizeProject(payload),
      id,
      ref: payload.ref || autoRef(),
      createdAt: now,
      updatedAt: now,
    };
  }

  // Al marcar un proyecto como "ganado" (una única vez, controlado por
  // pricesLearned) volcamos sus partidas a la memoria de precios — ver
  // price-memory.js. No se dispara en cada autoguardado de un borrador.
  if (project.status === 'ganado' && !project.pricesLearned) {
    await recordProjectPrices(env, project).catch(() => {});
    project.pricesLearned = true;
  }

  await env.BUDGET_TOOL.put('project:' + project.id, JSON.stringify(project));
  await upsertIndex(env, { id: project.id, updatedAt: now });

  return json({ project, economics: computeEconomics(project) });
}

export async function onRequestDelete({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);

  await env.BUDGET_TOOL.delete('project:' + id);
  const index = await readIndex(env);
  await env.BUDGET_TOOL.put(INDEX_KEY, JSON.stringify(index.filter((e) => e.id !== id)));

  return json({ ok: true });
}

// ── Economía del proyecto ────────────────────────────────────────────────

export function computeEconomics(p) {
  const materialsCost = (p.items || []).reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
  const laborCost = (Number(p.laborHours) || 0) * (Number(p.laborRate) || 0);
  const indirectPct = Number(p.indirectPct) || 0;
  const indirectCost = (materialsCost + laborCost) * (indirectPct / 100);
  const internalCost = materialsCost + laborCost + indirectCost;

  const marginPct = Math.min(Number(p.marginPct) || 0, 95);
  // PVP tal que margen sobre venta = marginPct
  const suggestedPrice = marginPct > 0 ? internalCost / (1 - marginPct / 100) : internalCost;
  const marginAmount = suggestedPrice - internalCost;

  // Real: facturas
  const invoices = p.invoices || [];
  const issued = invoices.filter((i) => i.tipo === 'emitida');
  const received = invoices.filter((i) => i.tipo === 'recibida');
  const invoicedTotal = issued.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const collectedTotal = issued.filter((i) => i.estado === 'cobrada').reduce((s, i) => s + (Number(i.total) || 0), 0);
  const realCost = received.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const paidCost = received.filter((i) => i.estado === 'pagada').reduce((s, i) => s + (Number(i.total) || 0), 0);
  const realMargin = invoicedTotal - realCost;
  const realMarginPct = invoicedTotal > 0 ? (realMargin / invoicedTotal) * 100 : null;

  return {
    materialsCost, laborCost, indirectCost, internalCost,
    marginPct, suggestedPrice, marginAmount,
    invoicedTotal, collectedTotal, realCost, paidCost, realMargin, realMarginPct,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function defaultProject() {
  return {
    clientName: '', clientEmail: '', clientPhone: '', address: '',
    region: 'tenerife', mode: 'reforma', tipo: 'reforma integral',
    m2: 0, calidad: 'media',
    estancias: { cocinas: 1, banos: 1, dormitorios: 2 },
    analysis: null,
    items: [],
    laborHours: 0, laborRate: 0, indirectPct: 15, marginPct: 25,
    rfqs: [], invoices: [],
    status: 'borrador', pricesLearned: false,
  };
}

const STR_FIELDS = ['ref', 'clientName', 'clientEmail', 'clientPhone', 'address', 'region', 'mode', 'tipo', 'calidad'];
const NUM_FIELDS = ['m2', 'laborHours', 'laborRate', 'indirectPct', 'marginPct'];
const OBJ_FIELDS = ['estancias', 'analysis'];
const ARR_FIELDS = ['items', 'rfqs', 'invoices'];

function sanitizeProject(payload) {
  const out = {};
  for (const f of STR_FIELDS) if (payload[f] != null) out[f] = String(payload[f]).slice(0, 300);
  for (const f of NUM_FIELDS) if (payload[f] != null) out[f] = Number(payload[f]) || 0;
  for (const f of OBJ_FIELDS) if (payload[f] != null && typeof payload[f] === 'object') out[f] = payload[f];
  for (const f of ARR_FIELDS) if (Array.isArray(payload[f])) out[f] = payload[f].slice(0, 500);
  if (STATUS_VALUES.includes(payload.status)) out.status = payload.status;
  return out;
}

function genId() {
  return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function autoRef() {
  const d = new Date();
  return `OBR-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

async function readIndex(env) {
  const raw = await env.BUDGET_TOOL.get(INDEX_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function upsertIndex(env, entry) {
  const index = await readIndex(env);
  const i = index.findIndex((e) => e.id === entry.id);
  if (i >= 0) index[i] = entry; else index.push(entry);
  await env.BUDGET_TOOL.put(INDEX_KEY, JSON.stringify(index));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
