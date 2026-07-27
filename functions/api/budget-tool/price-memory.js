// Memoria de precios propia de obreko.
//
// Cuando un proyecto se marca como "ganado" (ver projects.js), sus partidas
// (nombre + precio unitario) se acumulan aquí, agregadas por partida +
// modo + región (media, mínimo, máximo, nº de muestras). No se dispara en
// cada autoguardado del proyecto — solo una vez, al ganar — para no
// mezclar presupuestos a medio editar con datos reales ni disparar
// escrituras en KV en cada pulsación.
//
// Clave KV: pricehistory:<mode>:<region>:<slug(nombre)>
//   { name, mode, region, unit, samples, sum, min, max, avg, lastUpdated, lastProjectId }
//
// recordProjectPrices() la llama projects.js al ganar un proyecto.
// readPriceMemory() la usa recommend.js como fuente adicional de catálogo.

const KEY_PREFIX = 'pricehistory:';
const MAX_ENTRIES_PER_READ = 500; // límite práctico de list() por catálogo

export async function recordProjectPrices(env, project) {
  if (!env.BUDGET_TOOL) return;
  const mode = project.mode === 'amueblar' ? 'amueblar' : 'reforma';
  const region = project.region === 'madrid' ? 'madrid' : 'tenerife';
  const items = Array.isArray(project.items) ? project.items : [];

  for (const it of items) {
    const name = String(it.name || '').trim();
    const price = Number(it.unitPrice);
    if (!name || !isFinite(price) || price <= 0) continue;

    const key = KEY_PREFIX + mode + ':' + region + ':' + slugify(name);
    const raw = await env.BUDGET_TOOL.get(key);
    const prev = raw ? safeParse(raw) : null;
    const agg = prev || { name, mode, region, unit: it.unit || 'ud', samples: 0, sum: 0, min: price, max: price };

    agg.name = name; // conserva el nombre/capitalización más reciente
    agg.samples += 1;
    agg.sum += price;
    agg.min = Math.min(agg.min, price);
    agg.max = Math.max(agg.max, price);
    agg.avg = Math.round((agg.sum / agg.samples) * 100) / 100;
    agg.unit = it.unit || agg.unit || 'ud';
    agg.lastUpdated = new Date().toISOString();
    agg.lastProjectId = project.id;

    await env.BUDGET_TOOL.put(key, JSON.stringify(agg));
  }
}

export async function readPriceMemory(env, mode, region) {
  if (!env.BUDGET_TOOL) return [];
  const prefix = KEY_PREFIX + mode + ':' + region + ':';
  let list;
  try {
    list = await env.BUDGET_TOOL.list({ prefix, limit: MAX_ENTRIES_PER_READ });
  } catch {
    return [];
  }
  const out = [];
  for (const k of list.keys || []) {
    const raw = await env.BUDGET_TOOL.get(k.name);
    if (!raw) continue;
    const agg = safeParse(raw);
    if (agg) out.push(agg);
  }
  return out;
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'item';
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
