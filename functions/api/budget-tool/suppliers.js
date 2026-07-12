// GET    /api/budget-tool/suppliers          — lista de proveedores
// POST   /api/budget-tool/suppliers          — crea o actualiza { id?, name, region, email, searchUrl, active, notes }
// DELETE /api/budget-tool/suppliers?id=<id>  — elimina proveedor
//
// searchUrl usa {q} como marcador del término de búsqueda, p.ej.:
//   https://www.leroymerlin.es/buscador?query={q}
// La búsqueda automática de precios (search-prices.js) hace fetch de esa URL
// y extrae los precios con Claude, así que añadir un proveedor nuevo solo
// requiere nombre + URL de búsqueda (+ email para RFQs).

import { verifySession } from './_auth.js';

const KV_KEY = 'suppliers:list';

const SEED_SUPPLIERS = [
  { id: 'leroy-merlin', name: 'Leroy Merlin', region: 'nacional', email: '', searchUrl: 'https://www.leroymerlin.es/buscador?query={q}', active: true, notes: 'Materiales de reforma. Envío nacional (incluye Canarias).' },
  { id: 'obramat', name: 'Obramat (Bricomart)', region: 'madrid', email: '', searchUrl: 'https://www.obramat.es/search?q={q}', active: true, notes: 'Profesional. NO envía a Canarias.' },
  { id: 'ikea', name: 'IKEA', region: 'nacional', email: '', searchUrl: 'https://www.ikea.com/es/es/search/?q={q}', active: true, notes: 'Mobiliario. Envío nacional.' },
  { id: 'chafiras', name: 'Chafiras', region: 'tenerife', email: '', searchUrl: 'https://chafiras.com/buscar?controller=search&s={q}', active: true, notes: 'Materiales de construcción en Tenerife.' },
];

export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  const suppliers = await readSuppliers(env);
  return json({ count: suppliers.length, suppliers });
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

  const name = String(payload.name || '').trim().slice(0, 120);
  if (!name) return json({ error: 'Falta name' }, 400);

  const searchUrl = String(payload.searchUrl || '').trim().slice(0, 500);
  if (searchUrl && !/^https:\/\/.+\{q\}/.test(searchUrl) && !searchUrl.includes('{q}')) {
    return json({ error: 'searchUrl debe ser https y contener el marcador {q}' }, 400);
  }

  const supplier = {
    id: payload.id ? String(payload.id).replace(/[^A-Za-z0-9_-]/g, '') : slugify(name),
    name,
    region: ['tenerife', 'madrid', 'nacional'].includes(payload.region) ? payload.region : 'nacional',
    email: String(payload.email || '').trim().slice(0, 200),
    searchUrl,
    active: payload.active !== false,
    notes: String(payload.notes || '').slice(0, 500),
  };

  const suppliers = await readSuppliers(env);
  const i = suppliers.findIndex((s) => s.id === supplier.id);
  if (i >= 0) suppliers[i] = supplier; else suppliers.push(supplier);
  await env.BUDGET_TOOL.put(KV_KEY, JSON.stringify(suppliers));

  return json({ supplier, count: suppliers.length });
}

export async function onRequestDelete({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);

  const suppliers = await readSuppliers(env);
  await env.BUDGET_TOOL.put(KV_KEY, JSON.stringify(suppliers.filter((s) => s.id !== id)));
  return json({ ok: true });
}

// Exportado para search-prices.js y rfq.js
export async function readSuppliers(env) {
  const raw = await env.BUDGET_TOOL.get(KV_KEY);
  if (!raw) {
    // Primer uso: sembrar con los proveedores iniciales
    await env.BUDGET_TOOL.put(KV_KEY, JSON.stringify(SEED_SUPPLIERS));
    return SEED_SUPPLIERS.slice();
  }
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'proveedor';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
