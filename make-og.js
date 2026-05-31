const puppeteer = require('puppeteer');

const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400&family=DM+Sans:wght@300;400&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;overflow:hidden}
  .bg{width:1200px;height:630px;background:linear-gradient(135deg,#1a2236 0%,#0d1525 100%);position:relative}
  .glow{position:absolute;top:-10%;right:-5%;width:700px;height:700px;background:radial-gradient(circle,rgba(58,92,191,0.25) 0%,transparent 70%)}
  .accent{position:absolute;top:80px;left:80px;width:60px;height:3px;background:#FED544;border-radius:2px}
  .logo{position:absolute;left:80px;top:140px;font-family:'Playfair Display',serif;font-style:italic;font-weight:400;font-size:148px;color:#fff;letter-spacing:-4px;line-height:1}
  .underline{position:absolute;left:80px;top:308px;width:500px;height:5px;background:#FED544;border-radius:2px}
  .tagline{position:absolute;left:80px;top:370px;font-family:'DM Sans',sans-serif;font-size:17px;font-weight:300;letter-spacing:3.5px;color:rgba(255,255,255,0.6)}
  .location{position:absolute;left:80px;top:415px;font-family:'DM Sans',sans-serif;font-size:17px;font-weight:300;letter-spacing:4px;color:rgba(255,255,255,0.35)}
  .domain{position:absolute;left:80px;top:548px;font-family:'DM Sans',sans-serif;font-size:16px;font-weight:300;letter-spacing:2px;color:rgba(255,255,255,0.3)}
  .big-o{position:absolute;right:-40px;top:-80px;font-family:'Playfair Display',serif;font-style:italic;font-size:520px;color:rgba(255,255,255,0.025);line-height:1}
</style></head>
<body><div class="bg">
  <div class="glow"></div>
  <div class="big-o">o</div>
  <div class="accent"></div>
  <div class="logo">obreko</div>
  <div class="underline"></div>
  <div class="tagline">REFORMAS &middot; OBRAS &middot; MANITAS &middot; MANTENIMIENTO &middot; HOGAR CONECTADO</div>
  <div class="location">TENERIFE &middot; MADRID</div>
  <div class="domain">obreko.com</div>
</div></body></html>`;

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({width:1200, height:630, deviceScaleFactor:2});
  await page.setContent(html, {waitUntil:'networkidle0', timeout:60000});
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({path:'og-obreko.jpg', type:'jpeg', quality:95});
  console.log('og-obreko.jpg creada');
  await browser.close();
})();
