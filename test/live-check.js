'use strict';
const path = require('path');
const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://robrichardsdpt.github.io/aethermoor-play/', { waitUntil: 'networkidle2' });
  await page.waitForFunction('typeof game !== "undefined" && game.world !== null', { timeout: 20000 });
  await sleep(800);
  await page.touchscreen.tap(195, 500);
  await sleep(800);
  const st = await page.evaluate(() => ({
    mode: game.mode,
    touch: document.body.classList.contains('touch'),
    sanctums: game.world.sanctums.length,
    seed: game.world.seed,
  }));
  console.log('live mobile boot:', JSON.stringify(st));
  await page.screenshot({ path: path.join(__dirname, 'shot-live-mobile.png') });
  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  if (st.mode !== 'playing' || !st.touch) { console.log('LIVE CHECK FAILED'); process.exit(1); }
  console.log('LIVE DEPLOYMENT OK');
})().catch((e) => { console.error(e); process.exit(1); });
