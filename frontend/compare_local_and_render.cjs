const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const localBase = 'http://localhost:5173';
const renderBase = 'https://vigitra-frontend.onrender.com';

const routes = [
  { name: '01_dashboard', path: '/' },
  { name: '02_cameras', path: '/cameras' },
  { name: '03_signals', path: '/signals' },
  { name: '04_traffic_map', path: '/heatmap' },
  { name: '05_vehicle_tracking', path: '/trajectories' },
  { name: '06_anpr', path: '/anpr' },
  { name: '07_alerts', path: '/alerts' },
  { name: '08_settings', path: '/settings' }
];

const renderOutDir = path.join(__dirname, 'public', 'screenshots', 'render');
const localOutDir = path.join(__dirname, 'public', 'screenshots', 'local');
if (!fs.existsSync(renderOutDir)) fs.mkdirSync(renderOutDir, { recursive: true });
if (!fs.existsSync(localOutDir)) fs.mkdirSync(localOutDir, { recursive: true });

async function inspectHost(browser, baseUrl, outDir, hostLabel) {
  console.log(`\n==============================================`);
  console.log(`INSPECTING ${hostLabel}: ${baseUrl}`);
  console.log(`==============================================`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Authenticate
  console.log(`[${hostLabel}] Navigating to /login...`);
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1200));

  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    console.log(`[${hostLabel}] Submitting login form...`);
    await submitBtn.click();
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  }
  await new Promise(r => setTimeout(r, 1500));

  const results = {};

  for (const r of routes) {
    const fullUrl = `${baseUrl}${r.path}`;
    console.log(`[${hostLabel}] Testing ${r.name} (${fullUrl})...`);
    try {
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(res => setTimeout(res, 2000));

      const screenshotPath = path.join(outDir, `${r.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      const metrics = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const header = document.querySelector('header');
        const sidebar = document.querySelector('aside');
        const cards = document.querySelectorAll('.glass-card, [class*="rounded-lg"], [class*="rounded-xl"]');
        return {
          h1Text: h1 ? h1.innerText.trim() : 'NO H1',
          hasHeader: !!header,
          hasSidebar: !!sidebar,
          cardCount: cards.length
        };
      });

      console.log(`  -> [${hostLabel}] H1: "${metrics.h1Text}" | Cards: ${metrics.cardCount} | Screenshot: ${r.name}.png`);
      results[r.name] = metrics;
    } catch (err) {
      console.error(`  -> [${hostLabel}] Error on ${r.name}:`, err.message);
      results[r.name] = { error: err.message };
    }
  }

  await page.close();
  return results;
}

async function run() {
  console.log('Launching Chrome for side-by-side comparison...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const localResults = await inspectHost(browser, localBase, localOutDir, 'LOCALHOST');
    const renderResults = await inspectHost(browser, renderBase, renderOutDir, 'RENDER');

    console.log('\n==============================================');
    console.log('SIDE-BY-SIDE VERIFICATION SUMMARY:');
    console.log('==============================================');
    for (const r of routes) {
      const loc = localResults[r.name] || {};
      const ren = renderResults[r.name] || {};
      const matches = loc.h1Text === ren.h1Text && loc.hasSidebar === ren.hasSidebar;
      console.log(`${r.name.padEnd(22)} | Local H1: "${loc.h1Text}" | Render H1: "${ren.h1Text}" | Identical Format: ${matches ? 'YES' : 'NO'}`);
    }
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
