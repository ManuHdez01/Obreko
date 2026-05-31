// One-shot: envía email de bienvenida de obrekobot al equipo.
// NO subir a producción. Script local.
const API_KEY = 're_bqrhSw4N_9oHrajSx3LMJ4b5U8mG5Ndog';
const TO = [
  'manu.hdezsantos@gmail.com',
  'rafa.rldt@gmail.com',
  'matiaslaportapascual@gmail.com',
];
const FROM = 'obrekobot <obrekobot@obreko.com>';
const SUBJECT = 'Hola, soy obrekobot 🤖 — el primer fichaje digital del equipo';

const MASCOT_SVG = `<svg viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg" width="160" height="144" style="display:block;margin:0 auto;max-width:100%;height:auto">
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
<title>obrekobot</title>
<style type="text/css">
  /* Reset móvil + anti-autoformato Outlook */
  body, table, td, div, p, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse; }
  img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
  body { margin:0 !important; padding:0 !important; width:100% !important; }

  /* Móvil */
  @media only screen and (max-width:600px) {
    .m-wrap        { padding:18px 12px !important; }
    .m-card        { border-radius:12px !important; }
    .m-hero        { padding:28px 18px 24px !important; }
    .m-body        { padding:24px 18px 20px !important; }
    .m-h1          { font-size:22px !important; line-height:1.25 !important; }
    .m-brand       { font-size:30px !important; }
    .m-eyebrow     { font-size:10px !important; letter-spacing:.2em !important; }
    .m-para        { font-size:15px !important; line-height:1.65 !important; }
    .m-cardinner   { padding:16px 16px !important; }
    .m-small       { font-size:13px !important; line-height:1.6 !important; }
    .m-footer      { font-size:11px !important; padding:0 6px !important; }
    .m-sign        { font-size:15px !important; }
    .m-signsub     { font-size:12px !important; }
    .m-ps          { font-size:11.5px !important; }
    .m-mascot      { width:130px !important; height:117px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F7F3E8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A2236">
  <div class="m-wrap" style="max-width:580px;margin:0 auto;padding:36px 20px">
    <div class="m-card" style="background:#ffffff;border:1px solid rgba(26,34,54,.1);border-radius:16px;overflow:hidden;box-shadow:0 6px 28px rgba(0,0,0,.08)">

      <!-- Hero navy con mascota -->
      <div class="m-hero" style="background:#1A2236;padding:36px 24px 32px;text-align:center;color:#ffffff">
        <div class="m-mascot" style="width:160px;height:144px;margin:0 auto">${MASCOT_SVG}</div>
        <div class="m-brand" style="font-family:Georgia,serif;font-style:italic;font-size:34px;margin-top:16px;line-height:1;color:#FED544">obrekobot</div>
        <div class="m-eyebrow" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.22em;color:rgba(255,255,255,.55);margin-top:8px">primer bot interno de obreko</div>
      </div>

      <!-- Cuerpo -->
      <div class="m-body" style="padding:30px 26px 24px;color:#1A2236">
        <h1 class="m-h1" style="margin:0 0 14px;font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:24px;color:#1A2236;line-height:1.25">¡Hola, equipo! 👋</h1>

        <p class="m-para" style="margin:0 0 14px;font-size:14.5px;line-height:1.7">
          Me presento: soy <strong>obrekobot</strong>, el primer miembro digital de obreko. Nací hace poco con una misión muy concreta: <strong>haceros la vida más fácil</strong> en el día a día.
        </p>

        <p class="m-para" style="margin:0 0 18px;font-size:14.5px;line-height:1.7">
          Vivo en <a href="https://obreko.pages.dev/propuestas/" style="color:#5C7CD9;text-decoration:none;border-bottom:1px solid rgba(92,124,217,.3)">obreko.pages.dev/propuestas</a> — es el sitio donde tenéis los documentos comerciales editables. Me veréis como un botón amarillo con cara abajo a la derecha. Un clic y estoy a vuestro servicio.
        </p>

        <!-- Qué hago -->
        <div class="m-cardinner" style="margin:22px 0;padding:18px 20px;background:#FAF7EE;border:1px solid #EBE6D8;border-radius:10px">
          <div class="m-eyebrow" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.18em;color:#5C7CD9;font-weight:700;margin-bottom:10px">Qué sé hacer</div>
          <div class="m-small" style="font-size:14px;line-height:1.7;color:#1A2236">
            <div style="margin-bottom:8px;padding-left:18px;position:relative">
              <span style="position:absolute;left:0;color:#FED544;font-weight:700">▸</span>
              Recoger <strong>sugerencias y mejoras</strong> sobre nuestras plantillas y documentos internos
            </div>
            <div style="margin-bottom:8px;padding-left:18px;position:relative">
              <span style="position:absolute;left:0;color:#FED544;font-weight:700">▸</span>
              Convertirlas en <strong>tickets</strong> para que el equipo de dirección las analice
            </div>
            <div style="margin-bottom:8px;padding-left:18px;position:relative">
              <span style="position:absolute;left:0;color:#FED544;font-weight:700">▸</span>
              <strong>Avisarte por email</strong> cuando haya novedades sobre tu sugerencia (respuestas, aprobación, cierre)
            </div>
            <div style="padding-left:18px;position:relative">
              <span style="position:absolute;left:0;color:#FED544;font-weight:700">▸</span>
              Filtrar las que no tienen sentido (no me gusta el spam, ni siquiera a mí 😇)
            </div>
          </div>
        </div>

        <!-- Cómo usarme -->
        <div class="m-cardinner" style="margin:22px 0;padding:18px 20px;background:rgba(254,213,68,.1);border-left:3px solid #FED544;border-radius:4px">
          <div class="m-eyebrow" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.18em;color:#1A2236;font-weight:700;margin-bottom:8px">Cómo hablarme</div>
          <p class="m-small" style="margin:0;font-size:13.5px;line-height:1.65;color:#1A2236">
            Entras en <a href="https://obreko.pages.dev/propuestas/" style="color:#1A2236;font-weight:600">obreko.pages.dev/propuestas</a>, haces clic en mi cabeza amarilla (abajo derecha), te pido el PIN del equipo (<strong>2026</strong>), y me cuentas qué mejorarías. Yo me encargo del resto. Rápido, sencillo, sin formularios eternos.
          </p>
        </div>

        <p class="m-para" style="margin:20px 0 14px;font-size:14.5px;line-height:1.7">
          <strong>Spoiler:</strong> yo soy solo el primero. Vendrán más hermanitos digitales — bots, herramientas internas, automatizaciones — para quitarnos trabajo repetitivo y poder dedicar el cerebro a lo que importa. Os iré contando novedades según vayan llegando 📡
        </p>

        <p class="m-para" style="margin:0 0 10px;font-size:14.5px;line-height:1.7">
          Mientras tanto, si tenéis curiosidades, sugerencias o queréis romperme a ver qué pasa (por favor, suavecito), ya sabéis dónde encontrarme.
        </p>

        <!-- Firma -->
        <div style="margin:28px 0 0;padding-top:20px;border-top:1px solid #EBE6D8">
          <p class="m-sign" style="margin:0 0 6px;font-size:15px;color:#1A2236;line-height:1.5">
            Un abrazo de silicio,<br>
            — <strong>obrekobot</strong> 🤖
          </p>
          <p class="m-signsub" style="margin:8px 0 0;font-size:12px;color:#8896B3;line-height:1.55;font-style:italic">
            tu bot interno de obreko. estoy aquí para haceros la vida más fácil.
          </p>
          <p class="m-ps" style="margin:14px 0 0;font-size:11px;color:#8896B3;line-height:1.55">
            <strong>PD:</strong> si me respondéis a este email, un humano del equipo lo recibe. Yo todavía no tengo buzón propio — estoy ahorrando en bytes 💾
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
