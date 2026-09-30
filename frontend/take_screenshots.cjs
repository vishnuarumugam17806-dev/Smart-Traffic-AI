const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'public', 'screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const routes = [
  { name: '01_dashboard', url: 'http://localhost:5173/' },
  { name: '02_cameras', url: 'http://localhost:5173/cameras' },
  { name: '03_signals', url: 'http://localhost:5173/signals' },
  { name: '04_traffic_map', url: 'http://localhost:5173/heatmap' },
  { name: '05_vehicle_tracking', url: 'http://localhost:5173/trajectories' },
  { name: '06_anpr', url: 'http://localhost:5173/anpr' },
  { name: '07_alerts', url: 'http://localhost:5173/alerts' },
  { name: '08_settings', url: 'http://localhost:5173/settings' },
  { name: '09_document_verification', url: 'http://localhost:5173/compliance' }
];

async function run() {
  console.log('Launching Chrome via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  // Step 1: Login
  console.log('Navigating to login page...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await new Promise(res => setTimeout(res, 800));

  console.log('Submitting login form...');
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
  }
  await new Promise(res => setTimeout(res, 1200));

  for (const r of routes) {
    console.log(`Navigating to ${r.name}: ${r.url}`);
    try {
      await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(res => setTimeout(res, 2000));

      const screenshotPath = path.join(outDir, `${r.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  -> Saved screenshot: ${screenshotPath}`);

      const h1Text = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return h1 ? h1.innerText.trim() : 'NO H1 FOUND';
      });
      console.log(`  -> Primary H1: "${h1Text}"`);
    } catch (e) {
      console.error(`  -> Error navigating to ${r.url}:`, e.message);
    }
  }

  await browser.close();
  console.log('FINISHED_ALL_SCREENSHOTS');
}

run().catch(console.error);
