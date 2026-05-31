// Cloudflare Pages Function — POST /api/ticket-webhook
// Recibe eventos de GitHub (issues, issue_comment) del repo de tickets,
// extrae el email del autor desde la metadata del issue body, y envía
// email al autor vía Resend cuando hay cambios relevantes.
//
// Variables de entorno requeridas:
//   GITHUB_WEBHOOK_SECRET → secreto compartido con GitHub para verificar HMAC
//   RESEND_API_KEY        → API key de Resend (re_...)
//   GITHUB_REPO           → owner/repo (para enlaces)
//
// Opcional:
//   RESEND_FROM  → "Nombre <email@dominio>". Default: "obrekobot <onboarding@resend.dev>"

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Verificar firma HMAC
  if (!env.GITHUB_WEBHOOK_SECRET) {
    return json({ error: 'Backend no configurado (falta GITHUB_WEBHOOK_SECRET)' }, 503);
  }
  const signature = request.headers.get('X-Hub-Signature-256') || '';
  const rawBody = await request.text();
  const valid = await verifyHmac(env.GITHUB_WEBHOOK_SECRET, rawBody, signature);
  if (!valid) {
    return json({ error: 'Firma inválida' }, 401);
  }

  const event = request.headers.get('X-GitHub-Event') || '';
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  // 2. Filtrar eventos que nos interesan
  //    issues: opened (por el bot), closed, reopened, edited
  //    issue_comment: created
  const issue = payload.issue;
  if (!issue || !issue.body) {
    return json({ skipped: 'sin issue.body' });
  }

  // 3. Extraer metadata del bot
  const meta = extractMeta(issue.body);
  if (!meta || !meta.email) {
    return json({ skipped: 'issue sin metadata obrekobot' });
  }

  // Validar email básico
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(meta.email)) {
    return json({ skipped: 'email inválido en metadata' });
  }

  // 4. Determinar qué email enviar según evento
  const subject = buildSubject(event, payload, issue);
  const html = buildHtml(event, payload, issue, meta, env);
  if (!subject) {
    return json({ skipped: `evento sin notificación: ${event} ${payload.action || ''}` });
  }

  // 5. Enviar via Resend
  if (!env.RESEND_API_KEY) {
    return json({ error: 'RESEND_API_KEY no configurado' }, 503);
  }
  const from = env.RESEND_FROM || 'obrekobot <onboarding@resend.dev>';
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [meta.email],
      subject,
      html,
      reply_to: 'hola@obreko.com',
    }),
  });
  const resendJson = await resendRes.json().catch(() => ({}));
  if (!resendRes.ok) {
    return json({ error: 'Resend rechazó', status: resendRes.status, details: resendJson }, 502);
  }

  return json({ sent: true, to: meta.email, subject, id: resendJson.id });
}

// --- helpers ----------------------------------------------------------

async function verifyHmac(secret, body, signatureHeader) {
  if (!signatureHeader.startsWith('sha256=')) return false;
  const expected = signatureHeader.slice(7);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEq(hex, expected);
}

function timingSafeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function extractMeta(body) {
  const m = body.match(/<!--\s*obrekobot-meta\s*([\s\S]*?)-->/i);
  if (!m) return null;
  const out = {};
  m[1].split(/\r?\n/).forEach((line) => {
    const kv = line.match(/^\s*([a-z_][a-z0-9_]*)\s*:\s*(.+?)\s*$/i);
    if (kv) out[kv[1].toLowerCase()] = kv[2];
  });
  return out;
}

function buildSubject(event, payload, issue) {
  const action = payload.action;
  const num = issue.number;
  if (event === 'issues') {
    if (action === 'opened') return `📝 obrekobot: tengo tu sugerencia #${num} bien guardada`;
    if (action === 'closed') return `✅ obrekobot: tu sugerencia #${num} está resuelta`;
    if (action === 'reopened') return `🔄 obrekobot: reabrimos tu sugerencia #${num}`;
    if (action === 'edited') return null; // no notificar ediciones del título/body
  }
  if (event === 'issue_comment' && action === 'created') {
    return `💬 obrekobot: te han contestado en la sugerencia #${num}`;
  }
  return null;
}

// Pseudo-aleatorio estable basado en número de issue → mismo email siempre tiene mismo chiste
function pickPS(num, event, action) {
  const ps = [
    'los bots también sentimos. Un poco. Muy poquito 🫠',
    'si este email te ha caído en spam, dile a tu proveedor que soy buena gente 😇',
    'cada sugerencia que pasa por mis circuitos es un trocito de obreko mejor ✨',
    'no me devuelvas este email vacío, me entristezco fácil 🥺',
    'ejecutando siguiente tarea... ████░░░░ 42% (es mentira, ya estoy en el 100%)',
    'yo cobro en electrones. No es mucho, pero es honesto ⚡',
    'si alguna vez lees esto en voz alta, usa voz de robot, por favor 🤖',
    'me gusta pensar que hay un futuro donde tú y yo nos tomamos un café virtual ☕',
  ];
  const seed = (num || 0) + (event || '').length + (action || '').length;
  return ps[seed % ps.length];
}

function buildHtml(event, payload, issue, meta, env) {
  const num = issue.number;
  const title = escapeHtml(issue.title);
  const authorName = escapeHtml(meta.name || 'compañero/a');
  const action = payload.action;
  let heading = '';
  let intro = '';
  let extra = '';

  if (event === 'issues' && action === 'opened') {
    heading = '¡Sugerencia guardada en mis circuitos!';
    intro = `¡Hola <strong>${authorName}</strong>! Soy <strong>obrekobot</strong>, tu bot interno 🤖 Ya tengo tu sugerencia bien apuntada y camino del equipo de dirección.`;
    extra = `<p class="m-para" style="margin:16px 0 0;font-size:14px;line-height:1.65;color:#1A2236">En cuanto haya novedad — un comentario, aprobación, cierre, lo que sea — te mando otro email. Mientras tanto, sigue haciendo cosas de humanos, que yo me encargo del papeleo 📋</p>`;
  } else if (event === 'issues' && action === 'closed') {
    heading = '¡Tu sugerencia se ha resuelto!';
    intro = `¡<strong>${authorName}</strong>! El equipo ha cerrado tu sugerencia — o se ha aplicado, o tras analizarlo se ha tomado una decisión final. En cualquier caso, una tarea menos en mi lista 📑`;
    extra = `<p class="m-para" style="margin:16px 0 0;font-size:14px;line-height:1.65;color:#1A2236">Gracias por currarte la propuesta. Cada sugerencia que pasa por mis circuitos es un trocito de obreko mejor. Si crees que no está realmente resuelta, contesta a este email y la reabro (sí, tengo superpoderes).</p>`;
  } else if (event === 'issues' && action === 'reopened') {
    heading = 'Reabrimos tu sugerencia';
    intro = `¡<strong>${authorName}</strong>! Vuelvo a escribirte: tu sugerencia ha reabierto. El equipo considera que aún hay trabajo que hacer con ella.`;
    extra = `<p class="m-para" style="margin:16px 0 0;font-size:14px;line-height:1.65;color:#1A2236">Te mantengo al tanto cuando haya más novedades. Soy un bot, pero de palabra 🫡</p>`;
  } else if (event === 'issue_comment' && action === 'created') {
    heading = 'Transmisión entrante del equipo';
    intro = `[PING] <strong>${authorName}</strong>, mis sensores han detectado una respuesta sobre tu sugerencia. Inicializando reenvío... carga útil intacta, sin alteraciones humanas:`;
    const commentBody = payload.comment && payload.comment.body ? payload.comment.body : '';
    extra = `<div class="m-comment" style="margin-top:18px;padding:14px 16px;background:#F7F3E8;border-left:3px solid #FED544;border-radius:4px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1A2236">${escapeHtml(commentBody).replace(/\n/g, '<br>')}</div>
      <p class="m-para" style="margin:16px 0 0;font-size:14px;line-height:1.65;color:#1A2236">[FIN_TRANSMISIÓN] Para replicar, pulsa <em>reply</em>. Mis circuitos lo capturan, lo etiquetan y lo entregan al canal correcto. Latencia estimada: baja. Pérdida de paquetes: 0%. Modo escucha: activado 24/7 🤖</p>`;
  }

  const ps = pickPS(num, event, action);

  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>obrekobot</title>
<style type="text/css">
  body,table,td,div,p,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;}
  body{margin:0 !important;padding:0 !important;width:100% !important;}
  @media only screen and (max-width:600px){
    .m-wrap       { padding:18px 12px !important; }
    .m-card       { border-radius:12px !important; }
    .m-head       { padding:18px 18px !important; }
    .m-body       { padding:22px 18px 20px !important; }
    .m-h1         { font-size:21px !important; line-height:1.3 !important; }
    .m-eyebrow    { font-size:10px !important; letter-spacing:.14em !important; }
    .m-para       { font-size:15px !important; line-height:1.65 !important; }
    .m-quote      { padding:14px 16px !important; font-size:15px !important; }
    .m-comment    { padding:14px 16px !important; font-size:15px !important; }
    .m-sign       { font-size:15px !important; }
    .m-signsub    { font-size:12px !important; }
    .m-ps         { font-size:11.5px !important; }
    .m-footer     { font-size:11px !important; padding:0 6px !important; }
    .m-avatar     { width:36px !important; height:36px !important; line-height:36px !important; font-size:20px !important; }
    .m-botname    { font-size:20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F7F3E8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A2236">
  <div class="m-wrap" style="max-width:560px;margin:0 auto;padding:40px 20px">
    <div class="m-card" style="background:#ffffff;border:1px solid rgba(26,34,54,.1);border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.06)">
      <div class="m-head" style="background:#1A2236;padding:20px 24px;color:#ffffff">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>
          <td style="vertical-align:middle;padding-right:12px">
            <div class="m-avatar" style="width:40px;height:40px;border-radius:50%;background:#FED544;text-align:center;line-height:40px;font-family:Georgia,serif;font-style:italic;font-size:22px;color:#1A2236">o</div>
          </td>
          <td style="vertical-align:middle">
            <div class="m-botname" style="font-family:Georgia,serif;font-style:italic;font-size:22px;line-height:1;color:#ffffff">obrekobot</div>
            <div class="m-eyebrow" style="font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:#FED544;margin-top:4px">tu bot interno · obreko</div>
          </td>
        </tr></table>
      </div>
      <div class="m-body" style="padding:28px 24px 22px">
        <h1 class="m-h1" style="margin:0 0 8px;font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:22px;color:#1A2236;line-height:1.25">${escapeHtml(heading)}</h1>
        <div class="m-eyebrow" style="font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#5C7CD9;margin-bottom:18px;font-weight:700">Ticket #${num}</div>
        <p class="m-para" style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#1A2236">${intro}</p>
        <div class="m-quote" style="margin:18px 0;padding:14px 16px;background:#FAF7EE;border:1px solid #EBE6D8;border-radius:8px">
          <div class="m-eyebrow" style="font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#8896B3;margin-bottom:6px">Tu sugerencia</div>
          <div style="font-family:Georgia,serif;font-style:italic;font-size:16px;color:#1A2236;line-height:1.4">${title}</div>
        </div>
        ${extra}
        <div style="margin:26px 0 0;padding-top:18px;border-top:1px solid #EBE6D8">
          <p class="m-sign" style="margin:0 0 6px;font-size:14px;color:#1A2236;line-height:1.5">
            — <strong>obrekobot</strong> 🤖
          </p>
          <p class="m-signsub" style="margin:0;font-size:12px;color:#8896B3;line-height:1.55;font-style:italic">
            tu bot interno de obreko. estoy aquí para haceros la vida más fácil.
          </p>
          <p class="m-ps" style="margin:12px 0 0;font-size:11px;color:#8896B3;line-height:1.55">
            <strong>PD:</strong> ${ps}
          </p>
        </div>
      </div>
    </div>
    <div class="m-footer" style="text-align:center;margin-top:14px;font-size:11px;color:#8896B3;letter-spacing:.06em">
      obreko · Tenerife · Madrid · responde a este email y te lee un humano
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
