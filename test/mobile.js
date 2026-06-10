/* Mobile smoke test: emulates a phone (touch, 390x844), taps through the
   title, drives the virtual joystick, taps the interact rune, and checks
   the responsive battle UI. */
'use strict';

const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-first-run'],
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
  });

  const shot = (name) => page.screenshot({ path: path.join(__dirname, 'shot-' + name + '.png') });

  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction('typeof game !== "undefined" && game.world !== null');
  await sleep(600);
  await shot('m-title');

  // tap anywhere to begin
  await page.touchscreen.tap(195, 500);
  await sleep(600);
  const boot = await page.evaluate(() => ({
    mode: game.mode,
    touch: document.body.classList.contains('touch'),
    interactBtn: getComputedStyle(document.getElementById('btn-interact')).display !== 'none',
  }));
  console.log('mobile boot:', JSON.stringify(boot));

  // drive the virtual joystick: press at (110, 600), drag right
  const x0 = await page.evaluate(() => game.player.x);
  await page.evaluate(async () => {
    const zone = document.getElementById('joy-zone');
    const mk = (x, y) => new Touch({ identifier: 7, target: zone, clientX: x, clientY: y });
    const ev = (type, x, y) => new TouchEvent(type, {
      touches: type === 'touchend' ? [] : [mk(x, y)],
      changedTouches: [mk(x, y)],
      bubbles: true, cancelable: true,
    });
    zone.dispatchEvent(ev('touchstart', 110, 600));
    zone.dispatchEvent(ev('touchmove', 160, 600));
  });
  await sleep(900);
  const joyState = await page.evaluate(() => ({
    vec: TouchUI.vec, sprint: TouchUI.sprint,
    baseShown: !document.getElementById('joy-base').classList.contains('hidden'),
  }));
  await shot('m-joystick');
  await page.evaluate(() => {
    const zone = document.getElementById('joy-zone');
    const mk = (x, y) => new Touch({ identifier: 7, target: zone, clientX: x, clientY: y });
    zone.dispatchEvent(new TouchEvent('touchend', {
      touches: [], changedTouches: [mk(160, 600)], bubbles: true, cancelable: true,
    }));
  });
  const x1 = await page.evaluate(() => game.player.x);
  console.log('joystick:', JSON.stringify(joyState), 'moved px:', Math.round(x1 - x0));

  // interact rune: stand by the first sanctum and tap ✦ to challenge
  await page.evaluate(() => {
    game.hero.atk = 500; game.hero.maxHp = 500; game.hero.hp = 500;
    const s = game.world.sanctums[0];
    game.player.x = (s.x + 0.5) * 16;
    game.player.y = (s.y + 2.5) * 16;
  });
  await sleep(500);
  const btn = await page.$('#btn-interact');
  await btn.tap();
  await sleep(1800);
  const inBattle = await page.evaluate(() => ({ mode: game.mode, foe: Battle.foeData.name }));
  console.log('tap-to-challenge:', JSON.stringify(inBattle));
  await shot('m-battle');

  // fight by tapping the first action button
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => ({
      phase: Battle.phase,
      cards: !document.getElementById('skill-choice').classList.contains('hidden'),
    }));
    if (st.cards) break;
    if (st.phase === 'player') {
      const b = await page.$('#b-actions button');
      if (b) await b.tap();
    }
    await sleep(420);
  }
  await shot('m-cards');
  const card = await page.$('#skill-cards .card');
  if (card) await card.tap();
  await sleep(900);
  const after = await page.evaluate(() => ({
    mode: game.mode, shards: [...game.state.shards],
  }));
  console.log('after mobile battle:', JSON.stringify(after));
  await shot('m-world');

  await browser.close();

  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  if (!boot.touch || !boot.interactBtn) { console.log('FAIL: touch UI not active'); process.exit(1); }
  if (Math.abs(joyState.vec.x - 1) > 0.1 || x1 - x0 < 20) {
    console.log('FAIL: joystick did not move the player'); process.exit(1);
  }
  if (inBattle.mode !== 'battle') { console.log('FAIL: interact tap did not start guardian battle'); process.exit(1); }
  if (!after.shards.length) { console.log('FAIL: mobile battle flow incomplete'); process.exit(1); }
  console.log('MOBILE TEST PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
