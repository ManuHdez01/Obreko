// GET    /api/budget-tool/templates           — lista de plantillas
// POST   /api/budget-tool/templates           — crea/actualiza { id?, name, tipo, mode, region, items, laborHours, laborRate, indirectPct, marginPct, taxPct }
// DELETE /api/budget-tool/templates?id=<id>   — elimina plantilla
//
// Plantillas reutilizables: guardan la estructura de partidas (y la
// configuración de costes) de un proyecto para arrancar uno nuevo del
// mismo tipo sin partir de cero ni pegar un Excel cada vez. Se guardan
// en KV bajo templates:list (mismo patrón que library.js/suppliers.js).

import { verifySession } from './_auth.js';

const KV_KEY = 'templates:list';
const MAX_TEMPLATES = 200;

export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  const templates = await readTemplates(env);
  templates.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  return json({ count: templates.length, templates });
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

  const items = Array.isArray(payload.items) ? payload.items.slice(0, 500) : [];

  const template = {
    id: payload.id ? String(payload.id) : 'tpl' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    name,
    tipo: String(payload.tipo || '').slice(0, 80),
    mode: payload.mode === 'amueblar' ? 'amueblar' : 'reforma',
    region: ['tenerife', 'madrid'].includes(payload.region) ? payload.region : 'tenerife',
    items,
    laborHours: Number(payload.laborHours) || 0,
    laborRate: Number(payload.laborRate) || 0,
    indirectPct: Number(payload.indirectPct) || 0,
    marginPct: Number(payload.marginPct) || 0,
    taxPct: Number(payload.taxPct) || 0,
    savedAt: new Date().toISOString(),
  };

  const templates = await readTemplates(env);
  const i = templates.findIndex((t) => t.id === template.id);
  if (i >= 0) {
    templates[i] = template;
  } else {
    if (templates.length >= MAX_TEMPLATES) return json({ error: 'Límite de plantillas alcanzado (' + MAX_TEMPLATES + ')' }, 400);
    templates.push(template);
  }
  await env.BUDGET_TOOL.put(KV_KEY, JSON.stringify(templates));

  return json({ template, count: templates.length });
}

export async function onRequestDelete({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta id' }, 400);

  const templates = await readTemplates(env);
  await env.BUDGET_TOOL.put(KV_KEY, JSON.stringify(templates.filter((t) => t.id !== id)));
  return json({ ok: true });
}

export async function readTemplates(env) {
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
