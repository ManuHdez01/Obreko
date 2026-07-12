// Script local: refresca la base de precios de materiales/mobiliario usada
// por la herramienta interna de presupuestos (herramienta-presupuestos/).
// NO subir a producción. Se ejecuta manualmente en tu PC cuando quieras
// actualizar precios:
//
//   node scripts/scrape-material-prices.js
//
// Genera scripts/precios-materiales.json y, si tienes `wrangler` autenticado
// (`npx wrangler login`), lo publica también en el KV namespace BUDGET_TOOL
// bajo la clave "prices:latest" con:
//
//   npx wrangler pages secret list --project-name obreko   (para comprobar acceso)
//   npx wrangler kv key put --namespace-id <ID> "prices:latest" --path scripts/precios-materiales.json
//
// Los selectores de cada proveedor pueden romperse si la web cambia su
// maquetación — si un proveedor falla, revisa su función scrapeXxx() y
// ajusta los selectores; el resto de proveedores sigue funcionando igual
// (cada uno corre aislado con try/catch).

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_PATH = path.join(__dirname, 'precios-materiales.json');
const KV_NAMESPACE_ID = process.env.BUDGET_TOOL_KV_ID || ''; // rellena o exporta la env var tras `wrangler kv namespace create BUDGET_TOOL`
const NAV_TIMEOUT_MS = 30000;

// ── Utilidades compartidas ──────────────────────────────────────────────

function parsePrice(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  // "1.234,56" → 1234.56 ; "12,50" → 12.50 ; "12.50" (ya con punto) → 12.50
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const n = parseFloat(normalized);
  return isFinite(n) ? n : null;
}

async function withPage(browser, fn) {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
  );
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  try {
    return await fn(page);
  } finally {
    await page.close();
  }
}

// ── Proveedores ──────────────────────────────────────────────────────────
// Cada scraper devuelve un array de:
//   { supplier, region, category: 'reforma'|'amueblar', name, unit, price, url }
// `region` es 'tenerife' | 'madrid' | 'nacional' (nacional = envía a ambas).

const CATEGORY_PAGES = {
  // Leroy Merlin — envía a Tenerife y Madrid (nacional). Ejemplo con dos
  // categorías de materiales de reforma; añade más URLs de categoría según
  // lo que necesites presupuestar.
  leroyMerlin: [
    { url: 'https://www.leroymerlin.es/materiales-de-construccion/cemento-cal-y-yeso.html', name: 'Cemento, cal y yeso' },
    { url: 'https://www.leroymerlin.es/pintura-y-barnices/pintura-interior.html', name: 'Pintura interior' },
  ],
  // Obramat (antes Bricomart) — profesional, solo envío a Península.
  obramat: [
    { url: 'https://www.obramat.es/c/pavimentos-y-revestimientos', name: 'Pavimentos y revestimientos' },
  ],
  // IKEA — envío nacional, cubre Tenerife y Madrid. Mobiliario (amueblar).
  ikea: [
    { url: 'https://www.ikea.com/es/es/cat/salones-fu003/', name: 'Salones' },
    { url: 'https://www.ikea.com/es/es/cat/dormitorios-bm003/', name: 'Dormitorios' },
  ],
  // Chafiras — materiales de construcción con sede y tienda online en
  // Tenerife; buena fuente para materiales que no llegan desde BigMat/Obramat.
  chafiras: [
    { url: 'https://chafiras.com/3-construccion', name: 'Construcción' },
  ],
};

async function scrapeLeroyMerlin(browser) {
  const out = [];
  for (const { url, name: catName } of CATEGORY_PAGES.leroyMerlin) {
    await withPage(browser, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="product-card"], .product-card', { timeout: 10000 }).catch(() => {});
      const items = await page.evaluate(() => {
        const cards = document.querySelectorAll('[data-testid="product-card"], .product-card');
        return Array.from(cards).map((card) => ({
          name: card.querySelector('[data-testid="product-title"], .product-card__title')?.textContent?.trim() || '',
          priceText: card.querySelector('[data-testid="price"], .price, .product-price')?.textContent?.trim() || '',
          href: card.querySelector('a')?.href || '',
        }));
      });
      for (const it of items) {
        const price = parsePrice(it.priceText);
        if (!it.name || price == null) continue;
        out.push({
          supplier: 'Leroy Merlin',
          region: 'nacional',
          category: 'reforma',
          name: it.name,
          unit: 'ud',
          price,
          url: it.href,
          categoryHint: catName,
        });
      }
    });
  }
  return out;
}

async function scrapeObramat(browser) {
  const out = [];
  for (const { url, name: catName } of CATEGORY_PAGES.obramat) {
    await withPage(browser, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.product-item, [data-qa="product-tile"]', { timeout: 10000 }).catch(() => {});
      const items = await page.evaluate(() => {
        const cards = document.querySelectorAll('.product-item, [data-qa="product-tile"]');
        return Array.from(cards).map((card) => ({
          name: card.querySelector('.product-item-name, [data-qa="product-name"]')?.textContent?.trim() || '',
          priceText: card.querySelector('.price, [data-qa="product-price"]')?.textContent?.trim() || '',
          href: card.querySelector('a')?.href || '',
        }));
      });
      for (const it of items) {
        const price = parsePrice(it.priceText);
        if (!it.name || price == null) continue;
        out.push({
          supplier: 'Obramat',
          region: 'madrid', // no envía a Canarias
          category: 'reforma',
          name: it.name,
          unit: 'ud',
          price,
          url: it.href,
          categoryHint: catName,
        });
      }
    });
  }
  return out;
}

async function scrapeIkea(browser) {
  const out = [];
  for (const { url, name: catName } of CATEGORY_PAGES.ikea) {
    await withPage(browser, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.plp-fragment-wrapper, .product-compact', { timeout: 10000 }).catch(() => {});
      const items = await page.evaluate(() => {
        const cards = document.querySelectorAll('.plp-fragment-wrapper, .product-compact');
        return Array.from(cards).map((card) => ({
          name: card.querySelector('.plp-price-module__product-name, .product-compact__name')?.textContent?.trim() || '',
          priceText: card.querySelector('.plp-price__integer, .product-compact__price-value')?.textContent?.trim() || '',
          href: card.querySelector('a')?.href || '',
        }));
      });
      for (const it of items) {
        const price = parsePrice(it.priceText);
        if (!it.name || price == null) continue;
        out.push({
          supplier: 'IKEA',
          region: 'nacional',
          category: 'amueblar',
          name: it.name,
          unit: 'ud',
          price,
          url: it.href,
          categoryHint: catName,
        });
      }
    });
  }
  return out;
}

async function scrapeChafiras(browser) {
  const out = [];
  for (const { url, name: catName } of CATEGORY_PAGES.chafiras) {
    await withPage(browser, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.product-miniature, .js-product-miniature', { timeout: 10000 }).catch(() => {});
      const items = await page.evaluate(() => {
        const cards = document.querySelectorAll('.product-miniature, .js-product-miniature');
        return Array.from(cards).map((card) => ({
          name: card.querySelector('.product-title, h3')?.textContent?.trim() || '',
          priceText: card.querySelector('.price')?.textContent?.trim() || '',
          href: card.querySelector('a')?.href || '',
        }));
      });
      for (const it of items) {
        const price = parsePrice(it.priceText);
        if (!it.name || price == null) continue;
        out.push({
          supplier: 'Chafiras',
          region: 'tenerife',
          category: 'reforma',
          name: it.name,
          unit: 'ud',
          price,
          url: it.href,
          categoryHint: catName,
        });
      }
    });
  }
  return out;
}

const SCRAPERS = [
  { key: 'leroyMerlin', label: 'Leroy Merlin', fn: scrapeLeroyMerlin },
  { key: 'obramat', label: 'Obramat (Bricomart)', fn: scrapeObramat },
  { key: 'ikea', label: 'IKEA', fn: scrapeIkea },
  { key: 'chafiras', label: 'Chafiras', fn: scrapeChafiras },
];

// ── Orquestación ─────────────────────────────────────────────────────────

async function main() {
  console.log('Lanzando navegador…');
  const browser = await puppeteer.launch({ headless: 'new' });

  const entries = [];
  const results = { ok: [], failed: [] };

  for (const { key, label, fn } of SCRAPERS) {
    process.stdout.write(`→ ${label}… `);
    try {
      const items = await fn(browser);
      entries.push(...items);
      results.ok.push({ key, label, count: items.length });
      console.log(`${items.length} artículos`);
    } catch (e) {
      results.failed.push({ key, label, error: e.message });
      console.log(`FALLÓ (${e.message})`);
    }
  }

  await browser.close();

  const payload = {
    updatedAt: new Date().toISOString(),
    entries,
    scrapeSummary: results,
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`\nGuardado ${entries.length} precios en ${OUTPUT_PATH}`);

  if (results.failed.length) {
    console.log(`\nProveedores que fallaron (revisa sus selectores): ${results.failed.map((f) => f.label).join(', ')}`);
  }

  if (!entries.length) {
    console.log('\nNo se ha extraído ningún precio — no se publica nada en KV.');
    return;
  }

  publishToKv();
}

function publishToKv() {
  if (!KV_NAMESPACE_ID) {
    console.log(
      '\nPara publicar en Cloudflare KV, exporta BUDGET_TOOL_KV_ID (el ID del namespace ' +
        'creado con `npx wrangler kv namespace create BUDGET_TOOL`) y vuelve a ejecutar este script, ' +
        'o publica manualmente con:\n' +
        `  npx wrangler kv key put --namespace-id <ID> "prices:latest" --path "${OUTPUT_PATH}"`
    );
    return;
  }
  try {
    execSync(
      `npx wrangler kv key put --namespace-id ${KV_NAMESPACE_ID} "prices:latest" --path "${OUTPUT_PATH}"`,
      { stdio: 'inherit' }
    );
    console.log('\nPublicado en KV (prices:latest).');
  } catch (e) {
    console.log('\nNo se pudo publicar en KV automáticamente. Ejecuta manualmente:');
    console.log(`  npx wrangler kv key put --namespace-id ${KV_NAMESPACE_ID} "prices:latest" --path "${OUTPUT_PATH}"`);
  }
}

main().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(1);
});
