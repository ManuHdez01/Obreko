// POST /api/budget-tool/propuesta-textos — adapta los textos de la propuesta
// al cliente: la presentación, el enfoque de la obra y las condiciones
// particulares, en función de qué se va a hacer y de dónde está la obra.
//
// La plantilla de propuesta trae unos textos genéricos que valen para todo y
// no dicen nada de la obra concreta. Esto los sustituye por otros escritos
// para ESTE proyecto: el tipo de trabajos, la zona, la logística de la isla,
// los proveedores que tenemos cerca.
//
// Body esperado (JSON):
//   { "project": { tipo, region, address, calidad, m2, clientName, items: [...] },
//     "suppliers": [{ name, zona, especialidad }] }
//
// Respuesta:
//   { intro, enfoque, condiciones: [{titulo, texto}], transporteEstimado,
//     transporteJustificacion }

import { verifySession } from './_auth.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const MAX_PARTIDAS = 120;

const TEXTOS_TOOL = {
  name: 'return_textos',
  description: 'Devuelve los textos de la propuesta adaptados a esta obra.',
  input_schema: {
    type: 'object',
    properties: {
      intro: {
        type: 'string',
        description: 'Dos o tres frases de presentación para el cliente, mencionando qué obra es y dónde. Cercano y profesional, sin florituras ni superlativos. Nada de precios.',
      },
      enfoque: {
        type: 'string',
        description: 'Un párrafo (4-6 frases) sobre cómo se va a abordar ESTA obra: los trabajos principales, cómo se organiza en la zona, proveedores y suministro cercanos, y lo que condiciona el trabajo en esa localización. Concreto, sin promesas vacías.',
      },
      condiciones: {
        type: 'array',
        description: 'Condiciones particulares de esta obra, además de las generales de la plantilla. Entre 3 y 5.',
        items: {
          type: 'object',
          properties: {
            titulo: { type: 'string', description: 'Título corto en mayúsculas, sin numerar.' },
            texto: { type: 'string', description: 'Dos o tres frases, en el tono legal sobrio del resto de condiciones.' },
          },
          required: ['titulo', 'texto'],
        },
      },
      transporteEstimado: {
        type: 'number',
        description: 'Estimación en euros ENTEROS del transporte, portes y desplazamientos de esta obra, para incluirla como partida estimada en el presupuesto.',
      },
      transporteJustificacion: {
        type: 'string',
        description: 'Una frase explicando de dónde sale esa estimación (volumen de material, distancia, número de portes).',
      },
    },
    required: ['intro', 'enfoque', 'condiciones', 'transporteEstimado', 'transporteJustificacion'],
  },
};

export async function onRequestPost({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY no configurado' }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const p = payload.project || {};
  const items = Array.isArray(p.items) ? p.items.slice(0, MAX_PARTIDAS) : [];
  if (!items.length) return json({ error: 'El proyecto no tiene partidas todavía.' }, 400);

  const suppliers = Array.isArray(payload.suppliers) ? payload.suppliers.slice(0, 30) : [];
  const canarias = (p.region || 'tenerife') === 'tenerife';

  // Se le pasan los capítulos con su peso, no las 100 líneas sueltas: lo que
  // importa para redactar es de qué va la obra, no cada tornillo.
  const porCapitulo = new Map();
  for (const it of items) {
    const cap = String(it.capitulo || '').trim() || 'Sin capítulo';
    const total = Number(it.totalPrice) || 0;
    porCapitulo.set(cap, (porCapitulo.get(cap) || 0) + total);
  }
  const capitulos = Array.from(porCapitulo.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cap, total]) => `- ${cap}: ${Math.round(total)} €`)
    .join('\n');

  const muestraPartidas = items.slice(0, 40).map((it) => `- ${it.name}`).join('\n');
  const listaProveedores = suppliers.length
    ? suppliers.map((s) => `- ${s.name}${s.zona ? ' (' + s.zona + ')' : ''}${s.especialidad ? ' — ' + s.especialidad : ''}`).join('\n')
    : '(no hay proveedores dados de alta)';

  const prompt = `Eres quien redacta las propuestas de obreko, empresa de reformas que trabaja en ${canarias ? 'Tenerife (Canarias)' : 'Madrid'}.

Vas a adaptar los textos de una propuesta para un cliente concreto. La plantilla trae textos genéricos; los tuyos tienen que hablar de ESTA obra.

DATOS DE LA OBRA
Tipo: ${p.tipo || 'reforma'}${p.calidad ? ' · calidad ' + p.calidad : ''}${p.m2 ? ' · ' + p.m2 + ' m²' : ''}
Dirección: ${p.address || '(sin dirección)'}
Zona de trabajo: ${canarias ? 'Tenerife' : 'Madrid'}

CAPÍTULOS DEL PRESUPUESTO (importe de venta)
${capitulos}

ALGUNAS PARTIDAS
${muestraPartidas}

PROVEEDORES DE obreko
${listaProveedores}

CÓMO ESCRIBIR
- Habla de los trabajos que se van a hacer de verdad, con el peso que tienen en el presupuesto: si la obra es casi toda albañilería, que se note.
- Aprovecha lo que sabemos de la zona: proveedores y almacenes cercanos, tiempos de suministro, accesos, y lo que condiciona trabajar ${canarias ? 'en la isla (material que viene por barco, plazos más largos en pedidos especiales, gestión del vertedero)' : 'en Madrid (accesos y horarios de carga y descarga, licencias, aparcamiento de contenedores)'}.
- Menciona proveedores solo por el beneficio para el cliente (plazo, disponibilidad, servicio). Nunca precios de compra, márgenes ni costes internos.
- Nada de superlativos vacíos ("máxima calidad", "excelencia"). Frases que un cliente pueda comprobar.

CONDICIONES PARTICULARES
Redacta entre 3 y 5, específicas de esta obra (por ejemplo: acceso y acopio de material, gestión de residuos y vertedero, suministro de material con plazo largo, trabajos condicionados por elementos ocultos).

OBLIGATORIA: una condición sobre TRANSPORTE Y PORTES dejando claro que los costes de transporte, portes y desplazamientos se facturan APARTE, según el coste real incurrido, y que el importe que figura en el presupuesto es una estimación orientativa que puede variar.

TRANSPORTE
Estima en euros enteros el coste de transporte, portes y desplazamientos de esta obra${canarias ? ' contando con que buena parte del material llega a la isla por barco' : ''}, coherente con el tamaño del presupuesto. Explica en una frase de dónde sale.

Usa return_textos.`;

  let res;
  try {
    res = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        tools: [TEXTOS_TOOL],
        tool_choice: { type: 'tool', name: 'return_textos' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    return json({ error: 'No se pudo contactar con la IA: ' + e.message }, 502);
  }

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    return json({ error: 'La IA devolvió un error (' + res.status + ')', detalle: detalle.slice(0, 300) }, 502);
  }

  const data = await res.json();
  const bloque = (data.content || []).find((c) => c.type === 'tool_use');
  if (!bloque || !bloque.input) return json({ error: 'La IA no devolvió los textos.' }, 502);

  const out = bloque.input;
  return json({
    intro: String(out.intro || ''),
    enfoque: String(out.enfoque || ''),
    condiciones: (Array.isArray(out.condiciones) ? out.condiciones : [])
      .map((c) => ({ titulo: String(c.titulo || ''), texto: String(c.texto || '') }))
      .filter((c) => c.titulo && c.texto),
    transporteEstimado: Math.round(Number(out.transporteEstimado) || 0),
    transporteJustificacion: String(out.transporteJustificacion || ''),
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
