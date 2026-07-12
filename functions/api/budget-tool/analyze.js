// POST /api/budget-tool/analyze — interpreta uno o varios planos/fotos del
// inmueble con Claude vision y devuelve características estructuradas para
// pre-rellenar el proyecto. Guarda cada imagen en R2 (bucket ARCHIVE,
// prefijo budget-tool/) para referencia.
//
// Body esperado (JSON):
//   {
//     "projectId": "p123...",            // opcional; para asociar las imágenes
//     "kind": "plano" | "foto",
//     "files": [
//       { "mediaType": "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
//         "imageBase64": "<base64 sin prefijo data:>" },
//       ...
//     ]
//   }
//
// Respuesta:
//   { analysis: { m2Estimados, estancias: {cocinas, banos, dormitorios, otras},
//                 estadoAparente, trabajosSugeridos: [..], notas, confianza },
//     imageKeys: ["budget-tool/<projectId>/<ts>-0.<ext>", ...] }

import { verifySession } from './_auth.js';

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024; // límite práctico de la API por archivo
const MAX_FILES = 6;

const ALLOWED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const ANALYZE_TOOL = {
  name: 'return_analysis',
  description: 'Devuelve el análisis estructurado del plano o fotografía.',
  input_schema: {
    type: 'object',
    properties: {
      m2Estimados: { type: 'number', description: 'Superficie útil estimada en m². 0 si no se puede estimar.' },
      estancias: {
        type: 'object',
        properties: {
          cocinas: { type: 'number' },
          banos: { type: 'number' },
          dormitorios: { type: 'number' },
          otras: { type: 'array', items: { type: 'string' } },
        },
      },
      estadoAparente: { type: 'string', description: 'Estado del inmueble visible: a reformar, buen estado, obra nueva, etc.' },
      trabajosSugeridos: { type: 'array', items: { type: 'string' }, description: 'Trabajos de reforma que se deducen de la imagen.' },
      notas: { type: 'string', description: 'Observaciones relevantes (escala del plano, elementos singulares, dudas).' },
      confianza: { type: 'string', enum: ['alta', 'media', 'baja'], description: 'Fiabilidad de la estimación.' },
    },
    required: ['m2Estimados', 'estancias', 'estadoAparente', 'trabajosSugeridos', 'confianza'],
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

  const kind = payload.kind === 'plano' ? 'plano' : 'foto';
  const projectId = String(payload.projectId || 'sin-proyecto').replace(/[^A-Za-z0-9_-]/g, '');
  const files = Array.isArray(payload.files) ? payload.files : [];

  if (!files.length) return json({ error: 'No se ha recibido ningún archivo.' }, 400);
  if (files.length > MAX_FILES) return json({ error: `Máximo ${MAX_FILES} archivos por análisis.` }, 400);

  const parsed = [];
  for (const f of files) {
    const mediaType = String((f && f.mediaType) || '');
    const imageBase64 = String((f && f.imageBase64) || '');
    if (!ALLOWED_MEDIA.includes(mediaType)) {
      return json({ error: 'mediaType no soportado. Usa JPEG, PNG, WebP, GIF o PDF.' }, 400);
    }
    if (!imageBase64) return json({ error: 'Falta imageBase64 en uno de los archivos' }, 400);
    // base64 → bytes aprox (x0.75)
    if (imageBase64.length * 0.75 > MAX_IMAGE_BYTES) {
      return json({ error: 'Archivo demasiado grande (máx ~4.5 MB por archivo). Reduce la resolución o el tamaño del PDF.' }, 413);
    }
    parsed.push({ mediaType, imageBase64 });
  }

  // Guardar copia de cada archivo en R2 para referencia del proyecto (no bloquea el análisis si falla)
  const imageKeys = [];
  if (env.ARCHIVE) {
    const ts = Date.now();
    for (let i = 0; i < parsed.length; i++) {
      try {
        const { mediaType, imageBase64 } = parsed[i];
        const ext = mediaType.split('/')[1].replace('jpeg', 'jpg');
        const key = `budget-tool/${projectId}/${ts}-${kind}-${i}.${ext}`;
        const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
        await env.ARCHIVE.put(key, bytes, { httpMetadata: { contentType: mediaType } });
        imageKeys.push(key);
      } catch (e) {
        // seguimos sin copia de este archivo
      }
    }
  }

  const multi = parsed.length > 1;
  const prompt = kind === 'plano'
    ? `Analiza ${multi ? `estos ${parsed.length} PLANOS (u hojas del mismo plano)` : 'este PLANO'} de vivienda/local para una empresa de reformas (obreko, Tenerife y Madrid). ${multi ? 'Combina la información de todas las imágenes en una única estimación coherente. ' : ''}Extrae: superficie útil estimada (usa la escala o cotas si existen; si no, estima por proporciones y usos), número de cocinas, baños y dormitorios, otras estancias, y qué trabajos de reforma implicaría una intervención típica sobre esta distribución. Usa la herramienta return_analysis.`
    : `Analiza ${multi ? `estas ${parsed.length} FOTOGRAFÍAS del mismo inmueble` : 'esta FOTOGRAFÍA de un inmueble'} para una empresa de reformas (obreko, Tenerife y Madrid). ${multi ? 'Combina lo que se ve en todas las fotos en una única evaluación coherente del inmueble. ' : ''}Identifica: qué estancia(s) se ven, estado aparente (a reformar / buen estado / etc.), superficie estimada de lo visible si es posible, y qué trabajos de reforma se deducen (instalaciones vistas, humedades, acabados anticuados...). Usa la herramienta return_analysis.`;

  let res;
  try {
    res = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        tools: [ANALYZE_TOOL],
        tool_choice: { type: 'tool', name: 'return_analysis' },
        messages: [{
          role: 'user',
          content: [
            ...parsed.map(({ mediaType, imageBase64 }) => (
              mediaType === 'application/pdf'
                ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: imageBase64 } }
                : { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } }
            )),
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
  } catch (e) {
    return json({ error: 'No se pudo contactar con la API de Claude: ' + e.message }, 502);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    return json({ error: 'Claude API rechazó la petición.', status: res.status, details: errBody.slice(0, 500) }, 502);
  }

  const data = await res.json();
  const toolUse = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'return_analysis');
  if (!toolUse) return json({ error: 'Respuesta inesperada de Claude (sin análisis estructurado).' }, 502);

  return json({ analysis: toolUse.input, imageKeys, kind });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
