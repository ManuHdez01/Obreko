// GET  /api/budget-tool/costs-config — devuelve tarifas de personal, horas/m²
//      por tipo de intervención y % de coste indirecto (con valores por
//      defecto razonables si aún no se ha guardado nada).
// POST /api/budget-tool/costs-config — guarda una configuración nueva.
//
// Body esperado en POST (JSON):
//   {
//     "laborRates": { "albanil": 18, "electricista": 22, ... },   // €/hora
//     "hoursPerM2": { "reforma integral": 3.5, "adecuacion": 2.5, ... },
//     "indirectPct": 15
//   }

import { verifySession } from './_auth.js';

const KV_KEY = 'costs:config';

const DEFAULT_CONFIG = {
  laborRates: {
    albanil: 18,
    electricista: 22,
    fontanero: 22,
    pintor: 16,
    carpintero: 20,
    instalador: 19,
  },
  hoursPerM2: {
    'reforma integral': 3.5,
    'adecuacion': 2.5,
    'obras-pequenas': 1.5,
    'mantenimiento': 1,
    'amueblar': 0.5,
  },
  indirectPct: 15,
  defaultMarginPct: 25,
  // Referencia propia de precios de mercado (€/m², sin impuestos) para el
  // benchmark. Rellenar/ajustar desde la UI según lo que veáis en ofertas
  // reales de la competencia.
  marketRates: [
    { tipo: 'reforma integral', calidad: 'media', region: '', min: 550, max: 850 },
    { tipo: 'reforma integral', calidad: 'alta', region: '', min: 850, max: 1400 },
  ],
};

export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env))) {
    return json({ error: 'No autenticado' }, 401);
  }
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  const raw = await env.BUDGET_TOOL.get(KV_KEY);
  if (!raw) return json(DEFAULT_CONFIG);

  try {
    return json(JSON.parse(raw));
  } catch {
    return json(DEFAULT_CONFIG);
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await verifySession(request, env))) {
    return json({ error: 'No autenticado' }, 401);
  }
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const laborRates = sanitizeNumberMap(payload.laborRates);
  const hoursPerM2 = sanitizeNumberMap(payload.hoursPerM2);
  const indirectPct = Number(payload.indirectPct);
  const defaultMarginPct = Number(payload.defaultMarginPct);

  if (!Object.keys(laborRates).length) return json({ error: 'laborRates vacío o inválido' }, 400);
  if (!Object.keys(hoursPerM2).length) return json({ error: 'hoursPerM2 vacío o inválido' }, 400);
  if (!isFinite(indirectPct) || indirectPct < 0 || indirectPct > 100) {
    return json({ error: 'indirectPct debe ser un número entre 0 y 100' }, 400);
  }
  if (!isFinite(defaultMarginPct) || defaultMarginPct < 0 || defaultMarginPct > 95) {
    return json({ error: 'defaultMarginPct debe ser un número entre 0 y 95' }, 400);
  }

  const marketRates = Array.isArray(payload.marketRates)
    ? payload.marketRates
        .map((r) => ({
          tipo: String(r.tipo || '').trim().slice(0, 60),
          calidad: ['economica', 'media', 'alta'].includes(r.calidad) ? r.calidad : 'media',
          region: ['tenerife', 'madrid'].includes(r.region) ? r.region : '',
          min: Number(r.min) || 0,
          max: Number(r.max) || 0,
        }))
        .filter((r) => r.tipo && r.min > 0 && r.max >= r.min)
        .slice(0, 50)
    : [];

  const config = { laborRates, hoursPerM2, indirectPct, defaultMarginPct, marketRates, updatedAt: new Date().toISOString() };
  await env.BUDGET_TOOL.put(KV_KEY, JSON.stringify(config));

  return json(config);
}

function sanitizeNumberMap(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k).trim().slice(0, 60);
    const num = Number(v);
    if (key && isFinite(num) && num >= 0) out[key] = num;
  }
  return out;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
