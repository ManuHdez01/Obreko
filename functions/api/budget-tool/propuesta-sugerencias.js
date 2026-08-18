// POST /api/budget-tool/propuesta-sugerencias — alternativas de redacción para
// un bloque de texto de la propuesta. Lo usa la varita (✨) que aparece al lado
// de cada párrafo en el editor de propuestas: se pulsa, se eligen entre varias
// versiones y el bloque sigue siendo editable a mano.
//
// Body esperado (JSON):
//   { "bloque": "intro"|"objetivo"|"enfoque"|"condicion"|"trabajo"|"libre",
//     "textoActual": "...",
//     "contexto": { tipo, m2, address, region, clientName, capitulos: ["CAP.1 ...", ...] } }
//
// Respuesta:
//   { alternativas: ["...", "...", "..."] }

import { verifySession } from './_auth.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

const BLOQUES = {
  intro: 'la presentación de la portada interior: dos o tres frases dirigidas al cliente',
  objetivo: 'el objetivo de la intervención: tres o cuatro frases sobre qué se va a hacer en la vivienda',
  enfoque: 'el enfoque de la obra: cómo se organiza el trabajo, el suministro y la logística de la zona',
  condicion: 'una condición particular del contrato, en tono legal sobrio, de dos o tres frases',
  trabajo: 'una línea de la lista de trabajos incluidos: una frase corta, sin punto final',
  libre: 'un párrafo de la propuesta',
};

const SUGERENCIAS_TOOL = {
  name: 'return_alternativas',
  description: 'Devuelve varias redacciones alternativas para el bloque.',
  input_schema: {
    type: 'object',
    properties: {
      alternativas: {
        type: 'array',
        description: 'Tres versiones distintas entre sí: una más breve, una más detallada y una con otro enfoque. Solo el texto, sin comillas ni numeración.',
        items: { type: 'string' },
      },
    },
    required: ['alternativas'],
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

  const bloque = BLOQUES[payload.bloque] ? payload.bloque : 'libre';
  const textoActual = String(payload.textoActual || '').slice(0, 2000);
  const ctx = payload.contexto || {};
  const canarias = (ctx.region || 'tenerife') === 'tenerife';
  const capitulos = Array.isArray(ctx.capitulos) ? ctx.capitulos.slice(0, 20) : [];

  const prompt = `Eres quien redacta las propuestas de obreko, empresa de reformas en ${canarias ? 'Tenerife (Canarias)' : 'Madrid'}.

Estás reescribiendo ${BLOQUES[bloque]} de una propuesta concreta.

LA OBRA (úsala entera, no solo el texto actual: es lo que tienes para escribir algo mejor, no una plantilla a rellenar)
${ctx.tipo ? 'Tipo: ' + ctx.tipo : ''}${ctx.m2 ? ' · ' + ctx.m2 + ' m²' : ''}
${ctx.address ? 'Dirección: ' + ctx.address : ''}
${capitulos.length ? 'Capítulos del presupuesto (de qué trata la obra realmente):\n' + capitulos.map((c) => '- ' + c).join('\n') : ''}

IDENTIDAD DE obreko (para que el texto suene a la marca, no genérico)
Transparencia: presupuestos claros, sin costes ocultos ni sorpresas al finalizar.
Compromiso: lo que se firma se cumple, en plazos, calidad y materiales.
Cercanía: empresa local, conoce la zona, responde rápido, sin intermediarios.

TEXTO ACTUAL (punto de partida, no el techo — mejóralo, no lo repitas con otras palabras)
"""
${textoActual || '(el bloque está vacío)'}
"""

Escribe TRES alternativas para ese bloque: una más breve, una más detallada y una con otro enfoque. Las tres tienen que ser mejores que el texto actual, no solo distintas: más concretas sobre ESTA obra (usa los capítulos y los datos de arriba, no te quedes solo con lo que ya estaba escrito) y con más capacidad de convencer a quien lo lea. No te limites a parafrasear o acortar/alargar el texto actual — parte de los datos reales de la obra y redacta desde ahí.

Cómo sonar mejor sin mentir ni prometer de más: en vez de listar hechos sueltos, dales una razón que le importe al cliente (no "se instalará fontanería nueva" sino qué gana con eso: menos averías, más presión de agua, sin ruidos). Usa cifras y datos concretos de la obra (m², capítulos, zona) en vez de adjetivos genéricos. Que se note el criterio de un profesional que ya ha visto la vivienda, no un texto que serviría para cualquier reforma.

Reglas: nunca menciones precios de compra, costes internos, márgenes ni proveedores con los que compramos. Nada de superlativos vacíos ni sin respaldo ("máxima calidad", "excelencia", "los mejores"): todo lo que digas tiene que apoyarse en un hecho concreto de esta obra o en la identidad de obreko de arriba. Nunca digas que el presupuesto es "cerrado" ni "fijo": es una estimación, y si el bloque habla de precio, di que cualquier desviación se comunica al cliente de inmediato, antes de ejecutar el cambio. Mantén el registro que le toca al bloque: si es una condición legal, tono sobrio y preciso; si es la presentación o el objetivo, cercano, seguro de sí mismo y directo — nunca hueco.${canarias ? ' Si viene a cuento, aprovecha lo que condiciona trabajar en la isla (suministro por barco, plazos de pedidos especiales, gestión del vertedero) como argumento de que la obra está bien planificada, no como excusa.' : ''}

Usa return_alternativas.`;

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
        max_tokens: 2000,
        tools: [SUGERENCIAS_TOOL],
        tool_choice: { type: 'tool', name: 'return_alternativas' },
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
  const uso = (data.content || []).find((c) => c.type === 'tool_use');
  if (!uso || !uso.input) return json({ error: 'La IA no devolvió alternativas.' }, 502);

  const alternativas = (Array.isArray(uso.input.alternativas) ? uso.input.alternativas : [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 4);

  if (!alternativas.length) return json({ error: 'La IA no devolvió alternativas.' }, 502);
  return json({ alternativas });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
