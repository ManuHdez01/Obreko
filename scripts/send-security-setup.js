// One-shot: obrekobot envía instrucciones de alta y seguridad a Rafa y Matías.
const API_KEY = 're_bqrhSw4N_9oHrajSx3LMJ4b5U8mG5Ndog';
const TO = [
  'manu.hdezsantos@gmail.com',
  'rafa.rldt@gmail.com',
  'matiaslaportapascual@gmail.com',
];
const FROM = 'obrekobot <obrekobot@obreko.com>';
const SUBJECT = '🔐 obrekobot: cómo darte de alta en el CRM (seguridad ante todo)';

const MASCOT_SVG = `<svg viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg" width="140" height="126" style="display:block;margin:0 auto;max-width:100%;height:auto">
  <g transform="rotate(-9 50 45)">
    <ellipse cx="50" cy="45" rx="38" ry="32" fill="#FED544"/>
    <ellipse cx="50" cy="45" rx="19" ry="16" fill="#1A2236"/>
  </g>
  <g transform="translate(42 42)">
    <circle r="3.6" fill="#fff"/>
    <circle r="1.7" fill="#1A2236"/>
  </g>
  <g transform="translate(58 42)">
    <circle r="3.6" fill="#fff"/>
    <circle r="1.7" fill="#1A2236"/>
  </g>
  <path d="M 45 51 Q 50 55.5 55 51" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>
</svg>`;

const HTML = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>obrekobot · seguridad</title>
<style type="text/css">
  body,table,td,div,p,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;}
  body{margin:0 !important;padding:0 !important;width:100% !important;}
  @media only screen and (max-width:600px){
    .m-wrap      { padding:18px 12px !important; }
    .m-card      { border-radius:12px !important; }
    .m-hero      { padding:26px 18px 22px !important; }
    .m-body      { padding:24px 18px 20px !important; }
    .m-h1        { font-size:21px !important; line-height:1.3 !important; }
    .m-brand     { font-size:28px !important; }
    .m-eyebrow   { font-size:10px !important; letter-spacing:.18em !important; }
    .m-para      { font-size:15px !important; line-height:1.65 !important; }
    .m-step      { padding:14px 14px !important; }
    .m-step-num  { width:26px !important; height:26px !important; font-size:13px !important; }
    .m-step-t    { font-size:14px !important; }
    .m-step-p    { font-size:13px !important; }
    .m-warn      { padding:14px 14px !important; }
    .m-sign      { font-size:15px !important; }
    .m-signsub   { font-size:12px !important; }
    .m-footer    { font-size:11px !important; padding:0 6px !important; }
    .m-mascot    { width:112px !important; height:101px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F7F3E8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A2236">
  <div class="m-wrap" style="max-width:580px;margin:0 auto;padding:36px 20px">
    <div class="m-card" style="background:#ffffff;border:1px solid rgba(26,34,54,.1);border-radius:16px;overflow:hidden;box-shadow:0 6px 28px rgba(0,0,0,.08)">

      <!-- Hero navy con mascota -->
      <div class="m-hero" style="background:#1A2236;padding:32px 24px 28px;text-align:center;color:#ffffff">
        <div class="m-mascot" style="width:140px;height:126px;margin:0 auto">${MASCOT_SVG}</div>
        <div class="m-brand" style="font-family:Georgia,serif;font-style:italic;font-size:30px;margin-top:14px;line-height:1;color:#FED544">obrekobot</div>
        <div class="m-eyebrow" style="font-size:10px;text-transform:uppercase;letter-spacing:.22em;color:rgba(255,255,255,.55);margin-top:8px">alta en el crm · protocolo de seguridad</div>
      </div>

      <!-- Cuerpo -->
      <div class="m-body" style="padding:28px 26px 22px;color:#1A2236">
        <h1 class="m-h1" style="margin:0 0 14px;font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:23px;color:#1A2236;line-height:1.3">¡Bienvenido al CRM de obreko 👋</h1>

        <p class="m-para" style="margin:0 0 14px;font-size:14.5px;line-height:1.7">
          Soy <strong>obrekobot</strong>, el bot interno. Manu te va a invitar en breve a nuestro <strong>HubSpot</strong>, donde llevamos el seguimiento de todas las propuestas comerciales. Antes de que llegues allí, prefiero explicarte en dos minutos <strong>cómo darte de alta bien</strong> — porque aquí la seguridad no es opcional.
        </p>

        <div style="margin:18px 0;padding:14px 16px;background:rgba(254,213,68,.12);border-left:3px solid #FED544;border-radius:4px">
          <p style="margin:0;font-size:13.5px;line-height:1.6;color:#1A2236">
            <strong>Importante:</strong> manejamos datos de clientes, propuestas y presupuestos. Si entran donde no deben, nos jugamos mucho. Por eso exigimos <strong>autenticación de dos factores (2FA)</strong> obligatoria. Tendrás <strong>24h desde que aceptes la invitación</strong> para configurarla. Si pasan 24h sin hacerlo, HubSpot te bloquea el acceso hasta que la pongas.
          </p>
        </div>

        <h2 style="margin:26px 0 14px;font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:19px;color:#1A2236">Cómo darte de alta — paso a paso</h2>

        <!-- Paso 1 -->
        <div class="m-step" style="margin-bottom:12px;padding:16px 18px;background:#FAF7EE;border:1px solid #EBE6D8;border-radius:10px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="width:38px;vertical-align:top;padding-right:12px">
              <div class="m-step-num" style="width:30px;height:30px;border-radius:50%;background:#1A2236;color:#FED544;text-align:center;line-height:30px;font-family:Georgia,serif;font-style:italic;font-size:15px;font-weight:400">1</div>
            </td>
            <td style="vertical-align:top">
              <div class="m-step-t" style="font-weight:700;font-size:14.5px;color:#1A2236;margin-bottom:4px">Acepta la invitación de HubSpot</div>
              <div class="m-step-p" style="font-size:13.5px;color:#1A2236;line-height:1.6">Te llegará un email del remitente <em>HubSpot</em>. Haz clic en <strong>Accept invitation</strong>. Te pedirá crear una contraseña. Usa una <strong>contraseña fuerte y única</strong> — no reutilices la de otro servicio.</div>
            </td>
          </tr></table>
        </div>

        <!-- Paso 2 -->
        <div class="m-step" style="margin-bottom:12px;padding:16px 18px;background:#FAF7EE;border:1px solid #EBE6D8;border-radius:10px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="width:38px;vertical-align:top;padding-right:12px">
              <div class="m-step-num" style="width:30px;height:30px;border-radius:50%;background:#1A2236;color:#FED544;text-align:center;line-height:30px;font-family:Georgia,serif;font-style:italic;font-size:15px;font-weight:400">2</div>
            </td>
            <td style="vertical-align:top">
              <div class="m-step-t" style="font-weight:700;font-size:14.5px;color:#1A2236;margin-bottom:4px">Configura 2FA antes de 24 horas</div>
              <div class="m-step-p" style="font-size:13.5px;color:#1A2236;line-height:1.6">
                Arriba a la derecha, tu avatar → <strong>Profile &amp; Preferences</strong> → <strong>Security</strong> → <strong>Two-Factor Authentication</strong>.<br>
                Te recomiendo <strong>"Clave de acceso" (Passkey)</strong>: usa tu huella dactilar, Face ID o PIN de Windows. Más seguro que códigos SMS y más cómodo.
              </div>
            </td>
          </tr></table>
        </div>

        <!-- Paso 3 -->
        <div class="m-step" style="margin-bottom:12px;padding:16px 18px;background:#FAF7EE;border:1px solid #EBE6D8;border-radius:10px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="width:38px;vertical-align:top;padding-right:12px">
              <div class="m-step-num" style="width:30px;height:30px;border-radius:50%;background:#1A2236;color:#FED544;text-align:center;line-height:30px;font-family:Georgia,serif;font-style:italic;font-size:15px;font-weight:400">3</div>
            </td>
            <td style="vertical-align:top">
              <div class="m-step-t" style="font-weight:700;font-size:14.5px;color:#1A2236;margin-bottom:4px">Añade un segundo método de backup</div>
              <div class="m-step-p" style="font-size:13.5px;color:#1A2236;line-height:1.6">
                Después de la primera Passkey, añade <strong>otra en tu móvil</strong> ("Agregar otra clave de acceso" → "Usar otro dispositivo" → escaneas un QR con tu móvil). Así, si se te rompe el PC, sigues pudiendo entrar con el teléfono.<br>
                Alternativa: configura también <strong>Google Authenticator</strong> y guarda los 8-10 <strong>códigos de backup</strong> en un sitio seguro (papel o gestor de contraseñas).
              </div>
            </td>
          </tr></table>
        </div>

        <!-- Paso 4 -->
        <div class="m-step" style="margin-bottom:12px;padding:16px 18px;background:#FAF7EE;border:1px solid #EBE6D8;border-radius:10px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="width:38px;vertical-align:top;padding-right:12px">
              <div class="m-step-num" style="width:30px;height:30px;border-radius:50%;background:#1A2236;color:#FED544;text-align:center;line-height:30px;font-family:Georgia,serif;font-style:italic;font-size:15px;font-weight:400">4</div>
            </td>
            <td style="vertical-align:top">
              <div class="m-step-t" style="font-weight:700;font-size:14.5px;color:#1A2236;margin-bottom:4px">Instala la app móvil de HubSpot</div>
              <div class="m-step-p" style="font-size:13.5px;color:#1A2236;line-height:1.6">
                En <strong>App Store</strong> o <strong>Play Store</strong> busca "HubSpot". Inicia sesión con tu nueva cuenta. Recibirás notificaciones en tiempo real de los deals a los que estés suscrito.
              </div>
            </td>
          </tr></table>
        </div>

        <!-- Zona roja — qué NO hacer -->
        <div class="m-warn" style="margin:24px 0 4px;padding:16px 18px;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:10px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#C62828;font-weight:700;margin-bottom:10px">⚠️ Lo que NO debes hacer nunca</div>
          <div style="font-size:13.5px;color:#1A2236;line-height:1.7">
            <div style="margin-bottom:6px">🚫 <strong>No compartir</strong> tu contraseña con nadie — ni aunque sea Manu</div>
            <div style="margin-bottom:6px">🚫 <strong>No meter tu código 2FA</strong> en páginas que no sean exactamente <strong>app.hubspot.com</strong></div>
            <div style="margin-bottom:6px">🚫 <strong>No reutilizar</strong> la contraseña de otra cuenta (email, Amazon, etc.)</div>
            <div style="margin-bottom:6px">🚫 <strong>No quedarte con sesión iniciada</strong> en ordenadores compartidos o prestados</div>
            <div>🚫 <strong>No ignorar</strong> emails raros que pidan datos — si dudas, pregúntame o a Manu antes de hacer clic</div>
          </div>
        </div>

        <!-- Si algo falla -->
        <p class="m-para" style="margin:22px 0 14px;font-size:14.5px;line-height:1.7">
          <strong>¿Algo se complica?</strong> Respóndeme a este email (llega al equipo) o escribe a <a href="mailto:hola@obreko.com" style="color:#5C7CD9;text-decoration:none;border-bottom:1px solid rgba(92,124,217,.3)">hola@obreko.com</a>. Te echamos una mano rápido — lo importante es que lo tengas configurado bien, no rápido.
        </p>

        <p class="m-para" style="margin:0 0 10px;font-size:14.5px;line-height:1.7">
          Gracias por cuidar de obreko cuidando tu propia cuenta. Nos vemos dentro del CRM 🤝
        </p>

        <!-- Firma -->
        <div style="margin:26px 0 0;padding-top:20px;border-top:1px solid #EBE6D8">
          <p class="m-sign" style="margin:0 0 6px;font-size:15px;color:#1A2236;line-height:1.5">
            Un abrazo de silicio,<br>
            — <strong>obrekobot</strong> 🤖
          </p>
          <p class="m-signsub" style="margin:8px 0 0;font-size:12px;color:#8896B3;line-height:1.55;font-style:italic">
            tu bot interno de obreko. guardián digital de vuestra tranquilidad.
          </p>
          <p style="margin:14px 0 0;font-size:11px;color:#8896B3;line-height:1.55">
            <strong>PD:</strong> yo vivo en Cloudflare, hablo con HubSpot y GitHub, y mando estos emails desde un dominio verificado. Si alguna vez recibes un correo raro firmado como "obrekobot" desde otro dominio, <strong>es un impostor</strong>. Yo solo escribo desde <code style="background:#FAF7EE;padding:1px 5px;border-radius:3px">obrekobot@obreko.com</code>.
          </p>
        </div>
      </div>
    </div>

    <div class="m-footer" style="text-align:center;margin-top:16px;font-size:11px;color:#8896B3;letter-spacing:.06em">
      obreko · Tenerife · Madrid · <a href="https://obreko.com" style="color:#8896B3;text-decoration:none">obreko.com</a>
    </div>
  </div>
</body></html>`;

async function send(to) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: SUBJECT,
      html: HTML,
      reply_to: 'hola@obreko.com',
    }),
  });
  const json = await res.json().catch(() => ({}));
  console.log(to, '→', res.status, json.id || json.error || json.message || JSON.stringify(json));
}

(async () => {
  for (const e of TO) {
    await send(e);
  }
})();
