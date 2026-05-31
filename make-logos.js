const puppeteer = require('puppeteer');

const logos = [
  { name: 'logo-navy',          bg: '#1a2236', textColor: '#ffffff', lineColor: '#FED544', oColor: null },
  { name: 'logo-white',         bg: '#ffffff', textColor: '#1a2236', lineColor: '#FED544', oColor: null },
  { name: 'logo-yellow',        bg: '#FED544', textColor: '#1a2236', lineColor: '#1a2236', oColor: null },
  { name: 'logo-navy-o-yellow', bg: '#1a2236', textColor: '#ffffff', lineColor: '#FED544', oColor: '#FED544' },
];

function makeHtml(l) {
  const oSpan = l.oColor
    ? `<span style="color:${l.oColor}">o</span>breko`
    : `obreko`;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @font-face{font-family:'PD';font-style:italic;font-weight:400;src:local('Playfair Display Italic')}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:800px;height:800px;overflow:hidden;background:${l.bg}}
  .wrap{width:800px;height:800px;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .logo{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:400;font-size:116px;letter-spacing:-2px;color:${l.textColor};line-height:1;white-space:nowrap}
  .line{width:450px;height:5px;background:${l.lineColor};border-radius:2px;margin-top:12px}
</style>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400&display=swap" rel="stylesheet">
</head><body>
<div class="wrap">
  <div class="logo">${oSpan}</div>
  <div class="line"></div>
</div>
</body></html>`;
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({width:800, height:800, deviceScaleFactor:2});

  // Cargar fuente una vez
  await page.setContent(makeHtml(logos[0]), {waitUntil:'networkidle0', timeout:60000});
  await new Promise(r => setTimeout(r, 2000));

  for (const l of logos) {
    await page.setContent(makeHtml(l), {waitUntil:'domcontentloaded', timeout:60000});
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({path: l.name + '.png', type: 'png'});
    console.log('✅ ' + l.name + '.png');
  }

  await browser.close();
})();
