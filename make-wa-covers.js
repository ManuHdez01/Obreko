const puppeteer = require('puppeteer');

const covers = [

  // A — Navy con tagline
  {
    name: 'wa-cover-navy',
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400&family=DM+Sans:wght@300;400&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{width:1080px;height:608px;overflow:hidden}
      .bg{width:1080px;height:608px;background:linear-gradient(135deg,#1a2236 0%,#0d1525 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}
      .glow{position:absolute;top:-10%;right:-5%;width:600px;height:600px;background:radial-gradient(circle,rgba(58,92,191,0.2) 0%,transparent 70%)}
      .accent{position:absolute;top:52px;left:72px;width:48px;height:3px;background:#FED544;border-radius:2px}
      .logo{font-family:'Playfair Display',serif;font-style:italic;font-weight:400;font-size:108px;color:#fff;letter-spacing:-2px;line-height:1}
      .line{width:420px;height:4px;background:#FED544;border-radius:2px;margin-top:10px}
      .tagline{margin-top:20px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:300;letter-spacing:7px;color:rgba(255,255,255,0.5)}
      .location{position:absolute;bottom:40px;right:72px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:300;letter-spacing:4px;color:rgba(255,255,255,0.25)}
    </style></head>
    <body><div class="bg">
      <div class="glow"></div>
      <div class="accent"></div>
      <div class="logo">obreko</div>
      <div class="line"></div>
      <div class="tagline">REFORMAS · OBRAS · MANTENIMIENTO · HOGAR CONECTADO</div>
      <div class="location">TENERIFE · MADRID</div>
    </div></body></html>`
  },

  // B — Fondo oscuro texturizado con acento lateral
  {
    name: 'wa-cover-dark-accent',
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400&family=DM+Sans:wght@300;400&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{width:1080px;height:608px;overflow:hidden}
      .bg{width:1080px;height:608px;background:#0d1525;display:flex;flex-direction:row;align-items:stretch;position:relative}
      .sidebar{width:6px;background:#FED544;flex-shrink:0}
      .content{flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 80px;position:relative}
      .glow{position:absolute;bottom:-20%;right:-10%;width:500px;height:500px;background:radial-gradient(circle,rgba(254,213,68,0.07) 0%,transparent 70%)}
      .big-o{position:absolute;right:-40px;top:-80px;font-family:'Playfair Display',serif;font-style:italic;font-size:580px;color:rgba(255,255,255,0.025);line-height:1;pointer-events:none}
      .logo{font-family:'Playfair Display',serif;font-style:italic;font-weight:400;font-size:108px;color:#fff;letter-spacing:-2px;line-height:1}
      .line{width:380px;height:4px;background:#FED544;border-radius:2px;margin-top:10px}
      .tagline{margin-top:18px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:300;letter-spacing:6px;color:rgba(255,255,255,0.45)}
      .location{margin-top:32px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:300;letter-spacing:4px;color:rgba(255,255,255,0.2)}
    </style></head>
    <body><div class="bg">
      <div class="sidebar"></div>
      <div class="content">
        <div class="big-o">o</div>
        <div class="glow"></div>
        <div class="logo">obreko</div>
        <div class="line"></div>
        <div class="tagline">REFORMAS · OBRAS · MANTENIMIENTO · HOGAR CONECTADO</div>
        <div class="location">TENERIFE · MADRID</div>
      </div>
    </div></body></html>`
  },

  // C — Amarillo
  {
    name: 'wa-cover-yellow',
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400&family=DM+Sans:wght@300;400&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{width:1080px;height:608px;overflow:hidden}
      .bg{width:1080px;height:608px;background:#FED544;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}
      .accent{position:absolute;top:52px;left:72px;width:48px;height:3px;background:#1a2236;border-radius:2px;opacity:0.4}
      .logo{font-family:'Playfair Display',serif;font-style:italic;font-weight:400;font-size:108px;color:#1a2236;letter-spacing:-2px;line-height:1}
      .line{width:420px;height:4px;background:#1a2236;border-radius:2px;margin-top:10px;opacity:0.2}
      .tagline{margin-top:20px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:400;letter-spacing:7px;color:rgba(26,34,54,0.5)}
      .location{position:absolute;bottom:40px;right:72px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:300;letter-spacing:4px;color:rgba(26,34,54,0.3)}
    </style></head>
    <body><div class="bg">
      <div class="accent"></div>
      <div class="logo">obreko</div>
      <div class="line"></div>
      <div class="tagline">REFORMAS · OBRAS · MANTENIMIENTO · HOGAR CONECTADO</div>
      <div class="location">TENERIFE · MADRID</div>
    </div></body></html>`
  },

];

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({width:1080, height:608, deviceScaleFactor:2});

  // Precarga fuentes
  await page.setContent(covers[0].html, {waitUntil:'networkidle0', timeout:60000});
  await new Promise(r => setTimeout(r, 2000));

  for (const c of covers) {
    await page.setContent(c.html, {waitUntil:'domcontentloaded', timeout:60000});
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({path: c.name + '.png', type: 'png'});
    console.log('✅ ' + c.name + '.png');
  }

  await browser.close();
})();
