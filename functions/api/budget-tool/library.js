// GET    /api/budget-tool/library?q=<texto>&mode=<reforma|amueblar>  — buscar partidas
// POST   /api/budget-tool/library      — guardar/actualizar partida { id?, name, supplier, unit, unitPrice, mode, notes }
//                                        o marcar uso: { useId: "<id>" } (incrementa timesUsed)
// DELETE /api/budget-tool/library?id=  — eliminar partida
//
// Banco de precios propio del equipo: cada partida que se guarda desde un
// proyecto queda disponible para reutilizar y alimenta la recomendación IA
// con precios calibrados con los costes reales de obreko (mejor que una
// banda de mercado genérica). Se guarda en KV bajo library:items.

import { verifySession } from './_auth.js';

const KV_KEY = 'library:items';
const MAX_ITEMS = 5000;

export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').toLowerCase().trim();
  const mode = url.searchParams.get('mode');

  let items = await readLibrary(env);
  if (mode === 'reforma' || mode === 'amueblar') items = items.filter((i) => i.mode === mode);
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    items = items.filter((i) => {
      const hay = (i.name + ' ' + (i.supplier || '') + ' ' + (i.notes || '')).toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  // Más usadas primero, después más recientes
  items.sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0) || String(b.savedAt).localeCompare(String(a.savedAt)));

  return json({ count: items.length, items: items.slice(0, 100) });
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

  const items = await readLibrary(env);

  // Marcar uso (para ordenar por popularidad)
  if (payload.useId) {
    const it = items.find((i) => i.id === String(payload.useId));
    if (it) {
      it.timesUsed = (it.timesUsed || 0) + 1;
      await env.BUDGET_TOOL.put(KV_KEY, JSON.stringify(items));
    }
    return json({ ok: true });
  }

  const name = String(payload.name || '').trim().slice(0, 200);
  const unitPrice = Number(payload.unitPrice);
  if (!name) return json({ error: 'Falta name' }, 400);
  if (!isFinite(unitPrice) || unitPrice < 0) return json({ error: 'unitPrice inválido' }, 400);

  const item = {
    id: payload.id ? String(payload.id) : 'lib' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    name,
    supplier: String(payload.supplier || '').slice(0, 120),
    unit: String(payload.unit || 'ud').slice(0, 20),
    unitPrice,
    mode: payload.mode === 'amueblar' ? 'amueblar' : 'reforma',
    notes: String(payload.notes || '').slice(0, 300),
    savedAt: new Date().toISOString(),
    timesUsed: 0,
  };

  const i = items.findIndex((x) => x.id === item.id || (x.name.toLowerCase() === item.name.toLowerCase() && x.mode === item.mode));
  if (i >= 0) {
    item.timesUsed = items[i].timesUsed || 0;
    items[i] = item;
  } else {
    if (items.length >= MAX_ITEMS) return json({ error: 'Biblioteca llena (máx ' + MAX_ITEMS + ')' }, 400);
    items.push(item);
  }
  await env.BUDGET_TOOL.put(KV_KEY, JSON.stringify(items));

  return json({ item, count: items.length });
}

export async function onRequestDelete({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);

  const items = await readLibrary(env);
  await env.BUDGET_TOOL.put(KV_KEY, JSON.stringify(items.filter((i) => i.id !== id)));
  return json({ ok: true });
}

export async function readLibrary(env) {
  const raw = await env.BUDGET_TOOL.get(KV_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
