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
//     taxPct,                          // IGIC/IVA manual, informativo (7 Tenerife / 21 Madrid por defecto)
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

  // Las referencias con el formato viejo (sello de fecha y hora) se renumeran
  // solas al abrir el listado, para no tener que ir corrigiéndolas a mano.
  await migrarRefsAntiguas(env);

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
      ref: payload.ref || (await autoRef(env)),
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
  // La referencia va también en el índice: así se puede comprobar de un tirón
  // qué números se han emitido ya sin leer todos los proyectos.
  await upsertIndex(env, { id: project.id, ref: project.ref, updatedAt: now });

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

  const marginPct = Math.max(Number(p.marginPct) || 0, 0);
  // Recargo sobre coste: PVP = coste interno × (1 + margen/100)
  const marginAmount = internalCost * (marginPct / 100);
  const suggestedPrice = internalCost + marginAmount;

  // IGIC/IVA: porcentaje manual (editable en la ficha), informativo aquí —
  // el cálculo real de la propuesta al cliente sigue viviendo en
  // propuestas-interno/_tax-selector.js, esto es solo para ver el total
  // con impuesto sin salir de la herramienta de presupuestos.
  const taxPct = Number(p.taxPct) || 0;
  const taxAmount = suggestedPrice * (taxPct / 100);
  const suggestedPriceWithTax = suggestedPrice + taxAmount;

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
    taxPct, taxAmount, suggestedPriceWithTax,
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
    laborHours: 0, laborRate: 0, indirectPct: 15, marginPct: 25, taxPct: 7,
    rfqs: [], invoices: [],
    status: 'borrador', pricesLearned: false,
  };
}

const STR_FIELDS = ['ref', 'clientName', 'clientEmail', 'clientPhone', 'address', 'region', 'mode', 'tipo', 'calidad'];
const NUM_FIELDS = ['m2', 'laborHours', 'laborRate', 'indirectPct', 'marginPct', 'taxPct'];
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

// ── Referencia de los presupuestos ───────────────────────────────────────
// Formato: OBR-<año>-<contador de 4 dígitos>, p.ej. OBR-2026-0847.
// El contador no se reinicia nunca y avanza a saltos irregulares, así que la
// referencia no deja ver el ritmo de trabajo (con el formato viejo,
// OBR-2026-0712-2249, se leía el día y la hora exacta en que se creó).
// Para empezar en otro número basta con cambiar REF_INICIO y borrar la clave
// refseq del KV.
const REF_CONTADOR_KEY = 'refseq';
const REF_INICIO = 1200;
const REF_SALTO_MAX = 7;

// Formato antiguo: OBR-2026-0712-2249 (año + día + hora de creación).
const RE_REF_ANTIGUA = /^OBR-\d{4}-\d{4}-\d{4}$/;

// Renumera de una vez los presupuestos que aún llevan el formato viejo,
// en orden de creación para que los números sigan la cronología. Se deja
// intacto el que ya haya salido de la empresa con esa referencia (una
// petición de precios enviada a un proveedor la lleva en el asunto del
// correo), porque cambiarle el número a un documento ya emitido es peor
// que tener dos formatos conviviendo.
async function migrarRefsAntiguas(env) {
  const index = await readIndex(env);
  // refFija marca las que se dejan con el formato viejo a propósito, para no
  // repasarlas en cada carga del listado.
  if (!index.some((e) => !e.ref || (RE_REF_ANTIGUA.test(String(e.ref)) && !e.refFija))) return;

  const proyectos = [];
  for (const entry of index) {
    const raw = await env.BUDGET_TOOL.get('project:' + entry.id);
    if (raw) proyectos.push(JSON.parse(raw));
  }

  // El contador arranca por encima de la referencia nueva más alta que ya
  // exista (por ejemplo una puesta a mano), para no repetir número.
  const maxEmitido = proyectos.reduce((max, p) => {
    const m = String(p.ref || '').match(/^OBR-\d{4}-(\d+)$/);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  if (maxEmitido) {
    const guardado = Number(await env.BUDGET_TOOL.get(REF_CONTADOR_KEY)) || 0;
    if (maxEmitido > guardado) await env.BUDGET_TOOL.put(REF_CONTADOR_KEY, String(maxEmitido));
  }

  const renumerar = proyectos
    .filter((p) => RE_REF_ANTIGUA.test(String(p.ref || '')) && !(p.rfqs || []).some((r) => r.sentAt))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  for (const p of renumerar) {
    p.ref = await autoRef(env);
    await env.BUDGET_TOOL.put('project:' + p.id, JSON.stringify(p));
  }

  // El índice se queda con la referencia de cada proyecto (también las que no
  // se renumeran), así las siguientes cargas del listado ya no tienen que
  // repasarlos uno a uno.
  const refs = new Map(proyectos.map((p) => [p.id, p.ref || '—']));
  await env.BUDGET_TOOL.put(INDEX_KEY, JSON.stringify(
    index.map((e) => {
      const ref = refs.get(e.id) || '—';
      return { ...e, ref, refFija: RE_REF_ANTIGUA.test(ref) };
    })
  ));
}

async function autoRef(env) {
  const year = new Date().getFullYear();
  const guardado = Number(await env.BUDGET_TOOL.get(REF_CONTADOR_KEY)) || 0;
  // Red de seguridad: si la clave del contador se perdiera, se retoma desde la
  // referencia más alta ya emitida en vez de repetir números.
  const emitido = (await readIndex(env)).reduce((max, e) => {
    const m = String(e.ref || '').match(/^OBR-\d{4}-(\d+)$/);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const siguiente = Math.max(guardado, emitido, REF_INICIO) + 1 + Math.floor(Math.random() * REF_SALTO_MAX);
  await env.BUDGET_TOOL.put(REF_CONTADOR_KEY, String(siguiente));
  return `OBR-${year}-${String(siguiente).padStart(4, '0')}`;
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
