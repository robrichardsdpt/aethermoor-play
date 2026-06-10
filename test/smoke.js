/* Headless smoke test: boots the game in real Chrome, explores, fights a
   3D battle, picks a skill card, claims a shard from a Guardian, seals a
   rift gauntlet, tests boons and weather, meets Orun, and earns the
   secret ending. Screenshots all the way down. */
'use strict';

const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-first-run', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
  });

  const shot = (name) => page.screenshot({ path: path.join(__dirname, 'shot-' + name + '.png') });
  const fightUntilCards = async (max) => {
    for (let i = 0; i < max; i++) {
      const st = await page.evaluate(() => ({
        phase: Battle.phase, mode: game.mode,
        cards: !document.getElementById('skill-choice').classList.contains('hidden'),
      }));
      if (st.cards) return true;
      if (st.mode !== 'battle') return false;
      if (st.phase === 'player') await page.keyboard.press('Digit1');
      await sleep(420);
    }
    return false;
  };

  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction('typeof game !== "undefined" && game.world !== null');
  await sleep(600);
  await page.keyboard.press('Enter');
  await sleep(600);
  console.log('boot:', JSON.stringify(await page.evaluate(() => ({
    mode: game.mode, sanctums: game.world.sanctums.length, level: game.hero.level,
  }))));

  /* ---------- ordinary battle at level 1 ---------- */
  await page.evaluate(() => { Battle.start({ level: 1 }); });
  await sleep(2000);
  await shot('battle');
  if (!(await fightUntilCards(40))) { console.log('FAIL: battle 1 never reached cards'); process.exit(1); }
  await shot('cards');
  await page.keyboard.press('Digit1');
  await sleep(700);
  const afterB1 = await page.evaluate(() => ({
    mode: game.mode, won: game.hero.battlesWon, skills: game.hero.skills.size,
    maxHp: game.hero.maxHp, atk: game.hero.atk,
  }));
  console.log('after battle 1:', JSON.stringify(afterB1));

  /* ---------- guardian battle: claim a shard ---------- */
  await page.evaluate(() => {
    game.hero.atk = 500; game.hero.maxHp = 600; game.hero.hp = 600;
    const s = game.world.sanctums[0];
    game.player.x = (s.x + 0.5) * 16;
    game.player.y = (s.y + 2.5) * 16;
  });
  await sleep(400);
  await page.keyboard.press('KeyE');
  await sleep(1600);
  console.log('guardian:', JSON.stringify(await page.evaluate(() => ({
    foe: Battle.foeData.name, guardian: Battle.foeData.guardian,
  }))));
  await shot('guardian');
  if (!(await fightUntilCards(40))) { console.log('FAIL: guardian fight never reached cards'); process.exit(1); }
  await page.keyboard.press('Digit2');
  await sleep(1000);
  const afterG = await page.evaluate(() => ({
    shards: [...game.state.shards], mode: game.mode,
  }));
  console.log('after guardian:', JSON.stringify(afterG));
  await shot('shard');

  /* ---------- boons: dawn shard claimed; force-test stonestride ---------- */
  const boons = await page.evaluate(() => {
    game.state.shards.add('stone');
    // find a peak tile to prove the pass opens
    let peak = null;
    outer: for (let r = 10; r < 400 && !peak; r += 6) {
      for (let a = 0; a < 6.28; a += 0.3) {
        const tx = Math.round(game.player.tileX + Math.cos(a) * r);
        const ty = Math.round(game.player.tileY + Math.sin(a) * r);
        if (game.world.biomeAt(tx, ty) === 'peak') { peak = [tx, ty]; break outer; }
      }
    }
    const worldWalk = peak ? game.world.walkFactor(peak[0], peak[1]) : -1;
    const boonWalk = peak ? game.player.walkAt(peak[0] + 0.5, peak[1] + 0.5) : -1;
    game.state.shards.delete('stone');
    return { foundPeak: !!peak, worldWalk, boonWalk };
  });
  console.log('stonestride:', JSON.stringify(boons));

  /* ---------- weather: storm with lightning ---------- */
  await page.evaluate(() => {
    WEATHER.type = 'storm'; WEATHER.intensity = 1;
    WEATHER.until = game.time + 999; WEATHER.flash = 0.5;
  });
  await sleep(500);
  await shot('storm');
  const wword = await page.evaluate(() => game.timeLabel());
  console.log('weather label:', JSON.stringify(wword));

  /* ---------- rift gauntlet (two battles, one seal) ---------- */
  await page.evaluate(() => {
    WEATHER.type = 'clear'; WEATHER.intensity = 0; WEATHER.until = game.time + 999;
    game.time = 300 * 0.92;                 // deep night, so the rift survives
    game.rifts.push({
      x: game.player.tileX + 1, y: game.player.tileY,
      expires: game.time + 500, born: game.time,
    });
  });
  await sleep(400);
  await shot('rift');
  await page.keyboard.press('KeyE');        // step into the rift
  await sleep(1600);
  console.log('rift battle 1:', JSON.stringify(await page.evaluate(() => ({
    mode: game.mode, gauntlet: Battle.opts.gauntlet,
  }))));
  if (!(await fightUntilCards(100))) { console.log('FAIL: rift gauntlet never reached cards'); process.exit(1); }
  await page.keyboard.press('Digit1');
  await sleep(1000);
  const afterRift = await page.evaluate(() => ({
    rifts: game.rifts.length, riftlight: game.hero.riftlight,
    battlesWon: game.hero.battlesWon, mode: game.mode,
  }));
  console.log('after rift:', JSON.stringify(afterRift));

  /* ---------- Orun: a roadside meeting ---------- */
  await page.evaluate(() => {
    game.time = 300 * 0.4;                  // daylight again
    game.orun = { x: game.player.x + 24, y: game.player.y, expires: game.time + 60, fade: 1, leaving: false };
  });
  await sleep(700);
  const orunMet = await page.evaluate(() => game.state.orunMet);
  console.log('orun met:', orunMet);
  await shot('orun');

  /* ---------- Orun: the secret ending at the Hearth ---------- */
  await page.evaluate(() => {
    for (const s of LORE.SHARDS) game.state.shards.add(s.key);
    game.state.restored = true;
    game.orun = null;
    game.player.x = (game.world.spawn.x + 0.5) * 16;
    game.player.y = (game.world.spawn.y + 0.5) * 16;
  });
  await sleep(800);                          // updateOrun places him at the Hearth
  const hearth = await page.evaluate(() => !!(game.orun && game.orun.hearth));
  console.log('orun at hearth:', hearth);
  await page.evaluate(() => {                // stand beside him
    game.player.x = game.orun.x - 16; game.player.y = game.orun.y;
  });
  await sleep(300);
  await page.keyboard.press('KeyE');
  await sleep(800);
  const ending = await page.evaluate(() => ({
    gifted: game.state.orunGifted,
    hasArt: game.hero.skills.has('orun'),
    overlay: !document.getElementById('win-screen').classList.contains('hidden'),
  }));
  console.log('secret ending:', JSON.stringify(ending));
  await shot('ending');
  await page.keyboard.press('Enter');
  await sleep(400);

  const saved = await page.evaluate(() => {
    saveGame();
    const d = JSON.parse(localStorage.getItem('aethermoor:' + game.world.seed));
    return { orunGifted: d.orunGifted, riftlight: d.hero.riftlight };
  });
  console.log('saved:', JSON.stringify(saved));

  await browser.close();

  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  if (!afterG.shards.length) { console.log('FAIL: no shard claimed'); process.exit(1); }
  if (!boons.foundPeak || boons.worldWalk !== 0 || boons.boonWalk <= 0) {
    console.log('FAIL: stonestride boon did not open the peaks'); process.exit(1);
  }
  if (afterRift.rifts !== 0 || afterRift.riftlight !== 1) {
    console.log('FAIL: rift not sealed properly'); process.exit(1);
  }
  if (orunMet < 1) { console.log('FAIL: Orun encounter did not trigger'); process.exit(1); }
  if (!ending.gifted || !ending.hasArt || !ending.overlay) {
    console.log('FAIL: secret ending incomplete'); process.exit(1);
  }
  console.log('SMOKE TEST PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
