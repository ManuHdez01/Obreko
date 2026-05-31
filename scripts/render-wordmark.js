// Render "obreko" wordmark PNG using the exact site font (Playfair Display italic)
// loaded from ./fonts/playfair-italic.woff2, using Puppeteer for pixel-perfect output.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const FONT_PATH = path.join(__dirname, '..', 'fonts', 'playfair-italic.woff2');
const OUT_DIR   = path.join(__dirname, '..', 'assets', 'email');

async function render({ color, outName, scale = 4, fontSize = 80 }) {
  const fontB64 = fs.readFileSync(FONT_PATH).toString('base64');

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{
      font-family:'Playfair Display';
      font-style:italic;
      font-weight:400;
      src:url(data:font/woff2;base64,${fontB64}) format('woff2');
    }
    html,body{margin:0;padding:0;background:transparent;}
    .w{
      font-family:'Playfair Display', serif;
      font-style:italic;
      font-weight:400;
      font-size:${fontSize * scale}px;
      line-height:1;
      color:${color};
      padding:${0.15 * fontSize * scale}px ${0.05 * fontSize * scale}px;
      display:inline-block;
      letter-spacing:0.02em;
    }
  </style></head><body><span class="w">obreko</span></body></html>`;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-web-security']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 2000, height: 500, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  // Wait for font to load
  await page.evaluateHandle('document.fonts.ready');

  const el = await page.$('.w');
  const box = await el.boundingBox();

  const out = path.join(OUT_DIR, outName);
  await el.screenshot({
    path: out,
    omitBackground: true,
    clip: { x: box.x, y: box.y, width: box.width, height: box.height }
  });
  await browser.close();

  const stat = fs.statSync(out);
  console.log(`[ok] ${outName}  ${box.width|0}x${box.height|0}  ${stat.size} bytes`);
}

(async () => {
  // Retina @4x of a 26px header (width on email is ~600, header span is 26px)
  // → render at 26*4 = 104 font px. Also generate white + navy variants.
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  await render({ color: '#ffffff',            outName: 'obreko-white@4x.png',        fontSize: 26, scale: 4 });
  await render({ color: '#1a2236',            outName: 'obreko-navy@4x.png',         fontSize: 26, scale: 4 });
  await render({ color: 'rgba(255,255,255,.35)', outName: 'obreko-white35@4x.png',   fontSize: 15, scale: 4 });
  await render({ color: '#1a2236',            outName: 'obreko-navy-small@4x.png',   fontSize: 14, scale: 4 });
})().catch(e => { console.error(e); process.exit(1); });
