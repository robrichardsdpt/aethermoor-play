/* AETHERMOOR — The Shattered Light
   Main loop: input, discovery, interaction, day/night, rendering,
   saving, and the title / victory flow. */
'use strict';

const DAY_CYCLE = 300;          // seconds per full day
const DISCOVER_DIST = 5.5;      // tiles
const INTERACT_DIST = 2.0;      // tiles

const game = {
  state: null,
  world: null,
  player: null,
  hero: null,                   // level, xp, atk, skills — the evolving self
  audio: new AudioEngine(),
  keys: new Set(),
  mode: 'title',                // title | playing | battle | won
  time: 0,                      // game-world seconds
  poiIndex: new Map(),          // id -> poi (everything ever generated)
  fireflies: [],
  shades: [],                   // the Unlit, roaming the overworld
  rifts: [],                    // night tears into the Umbra
  orun: null,                   // the tall stranger, when he deigns to appear
  iceTrail: [],                 // Frostpath footprints
  sparks: [],                   // Stormstep lightning
  battleGrace: 0,               // seconds of peace after a battle
  nearbyPoi: null,
  lastDiscoveryCheck: 0,
  lastSave: 0,
};

function defaultHero() {
  return {
    level: 1, xp: 0, maxHp: 70, hp: 70, atk: 9,
    skills: new Map([['strike', 1]]),
    battlesWon: 0, shield: 0, dodge: 0,
    riftlight: 0, blind: 0, burnT: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let lightCanvas = document.createElement('canvas');
let lightCtx = lightCanvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  lightCanvas.width = canvas.width;
  lightCanvas.height = canvas.height;
}
window.addEventListener('resize', resize);
resize();

function currentSeed() {
  const m = new URLSearchParams(location.search).get('seed');
  if (m) return /^\d+$/.test(m) ? (parseInt(m, 10) >>> 0) : strHash(m);
  return strHash('aethermoor-first-light');
}

function newState() {
  return {
    shards: new Set(),
    fragments: new Set(),
    discovered: new Set(),
    discoveredNames: [],
    activated: new Set(),      // waystone ids
    attuned: false,
    explored: new Set(),       // chunk keys
    restored: false,
    orunMet: 0,                // how many times the stranger has spoken
    orunGifted: false,
  };
}

function init() {
  const seed = currentSeed();
  game.world = new World(seed);
  game.state = newState();
  game.player = new Player(game.world);
  game.hero = defaultHero();
  game.time = DAY_CYCLE * 0.3;   // begin in morning light
  for (const s of game.world.sanctums) game.poiIndex.set(s.id, s);
  const had = loadGame(seed);
  UI.init(game);
  Battle.init();
  TouchUI.init();
  document.getElementById('title-meta').textContent =
    'world-seed ' + seed + (had ? ' · a journey awaits, already begun' : '') +
    '  ·  Shift+N — forge a new world';
  requestAnimationFrame(loop);
}

/* ------------------------------------------------------------------ */
/* Save / load                                                         */
/* ------------------------------------------------------------------ */

function saveKey(seed) { return 'aethermoor:' + seed; }

function saveGame() {
  const s = game.state;
  const h = game.hero;
  try {
    localStorage.setItem(saveKey(game.world.seed), JSON.stringify({
      x: game.player.x, y: game.player.y, time: game.time,
      shards: [...s.shards], fragments: [...s.fragments],
      discovered: [...s.discovered], discoveredNames: s.discoveredNames,
      activated: [...s.activated], attuned: s.attuned,
      explored: [...s.explored], restored: s.restored,
      hero: {
        level: h.level, xp: h.xp, maxHp: h.maxHp, hp: Math.ceil(h.hp),
        atk: h.atk, skills: [...h.skills], battlesWon: h.battlesWon,
        riftlight: h.riftlight,
      },
      orunMet: s.orunMet, orunGifted: s.orunGifted,
    }));
  } catch (e) { /* storage full or blocked — the journey continues unsaved */ }
}

function loadGame(seed) {
  let data;
  try { data = JSON.parse(localStorage.getItem(saveKey(seed))); }
  catch (e) { return false; }
  if (!data) return false;
  const s = game.state;
  game.player.x = data.x; game.player.y = data.y;
  game.time = data.time || game.time;
  s.shards = new Set(data.shards);
  s.fragments = new Set(data.fragments);
  s.discovered = new Set(data.discovered);
  s.discoveredNames = data.discoveredNames || [];
  s.activated = new Set(data.activated);
  s.attuned = !!data.attuned;
  s.explored = new Set(data.explored);
  s.restored = !!data.restored;
  s.orunMet = data.orunMet || 0;
  s.orunGifted = !!data.orunGifted;
  if (data.hero) {
    const h = game.hero;
    h.level = data.hero.level; h.xp = data.hero.xp;
    h.maxHp = data.hero.maxHp; h.hp = data.hero.hp;
    h.atk = data.hero.atk;
    h.skills = new Map(data.hero.skills);
    h.battlesWon = data.hero.battlesWon || 0;
    h.riftlight = data.hero.riftlight || 0;
  }
  // regenerate POIs for explored chunks so map markers resolve
  for (const key of s.explored) {
    const [cx, cy] = key.split(',').map(Number);
    for (const p of game.world.poisInChunk(cx, cy)) game.poiIndex.set(p.id, p);
  }
  return true;
}

setInterval(() => { if (game.mode !== 'title') saveGame(); }, 8000);
window.addEventListener('beforeunload', () => { if (game.mode !== 'title') saveGame(); });

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  game.keys.add(e.code);

  if (game.mode === 'title') {
    if (e.code === 'Enter') startGame();
    if (e.code === 'KeyN' && e.shiftKey) {
      location.search = '?seed=' + ((Math.random() * 4294967296) >>> 0);
    }
    return;
  }
  if (game.mode === 'won' && e.code === 'Enter') {
    document.getElementById('win-screen').classList.add('hidden');
    game.mode = 'playing';
    return;
  }
  if (game.mode === 'battle') {
    if (e.code.startsWith('Digit')) Battle.hotkey(parseInt(e.code.slice(5), 10));
    else if (e.code === 'KeyP') game.audio.toggleMute();
    return;
  }

  switch (e.code) {
    case 'KeyE': pressE(); break;
    case 'KeyM': UI.toggleMap(); break;
    case 'KeyJ': UI.toggleJournal(); break;
    case 'KeyH': document.getElementById('help').classList.toggle('hidden'); break;
    case 'KeyP': {
      const muted = game.audio.toggleMute();
      UI.banner(muted ? 'SILENCE' : 'SOUND', muted ? 'The world holds its tongue.' : 'The world breathes again.', 1400);
      break;
    }
    case 'Escape': UI.closeAll(); break;
  }
});
window.addEventListener('keyup', (e) => game.keys.delete(e.code));
window.addEventListener('blur', () => game.keys.clear());

/** The single "examine" action, shared by the E key and the touch rune. */
function pressE() {
  if (game.mode !== 'playing') return;
  if (!document.getElementById('lore-modal').classList.contains('hidden')) {
    document.getElementById('lore-modal').classList.add('hidden');
    game.audio.closeBook();
  } else if (!UI.anyOpen()) {
    interact();
  }
}

// tap / click to pass the title and ending screens
document.getElementById('title-screen').addEventListener('pointerup', () => {
  if (game.mode === 'title') startGame();
});
document.getElementById('win-screen').addEventListener('pointerup', () => {
  if (game.mode === 'won') {
    document.getElementById('win-screen').classList.add('hidden');
    game.mode = 'playing';
  }
});

function startGame() {
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('minimap').classList.remove('hidden');
  game.audio.ensure(game.world.seed);
  game.mode = 'playing';
  UI.banner('THE LAST HEARTH', 'Walk out, Wayfarer. Do not look back without a reason.', 4200);
}

/* ------------------------------------------------------------------ */
/* Interaction & discovery                                             */
/* ------------------------------------------------------------------ */

function nearestRift(maxDist) {
  for (const rf of game.rifts) {
    if (Math.hypot(rf.x + 0.5 - game.player.x / TILE,
                   rf.y + 0.5 - game.player.y / TILE) < maxDist) return rf;
  }
  return null;
}

function orunAtHearth() {
  const o = game.orun;
  return o && o.hearth &&
    Math.hypot(o.x - game.player.x, o.y - game.player.y) / TILE < 2.4;
}

function interact() {
  if (orunAtHearth()) { orunFinal(); return; }
  const rift = nearestRift(2.4);
  if (rift) {
    Battle.start({
      level: menaceAt(game.player.tileX, game.player.tileY) + 1,
      gauntlet: 2, rift,
    });
    return;
  }
  const poi = game.nearbyPoi;
  if (!poi) return;
  const s = game.state;

  if (poi.type === 'monolith') {
    if (!s.fragments.has(poi.fragment)) {
      s.fragments.add(poi.fragment);
      game.audio.discovery();
    }
    UI.showLore(poi.fragment);

  } else if (poi.type === 'ruin') {
    UI.banner(poi.name.toUpperCase(), poi.line, 5200);

  } else if (poi.type === 'waystone') {
    if (!s.activated.has(poi.id)) {
      s.activated.add(poi.id);
      const first = !s.attuned;
      s.attuned = true;
      game.audio.attune();
      UI.banner(poi.name.toUpperCase(), LORE.WAYSTONE_LINE +
        (first ? ' A faint pull settles into your bones: the Resonance.' : ''), 5200);
    } else {
      UI.banner(poi.name.toUpperCase(), LORE.WAYSTONE_AGAIN, 2400);
    }

  } else if (poi.type === 'sanctum') {
    if (!s.shards.has(poi.shard.key)) {
      // the shard is defended — into the Umbra
      const idx = game.world.sanctums.indexOf(poi);
      Battle.start({ level: 2 + idx * 2, guardianOf: poi });
    }
  }
}

/** Called by Battle.end after a Guardian falls. */
function claimShard(poi) {
  const s = game.state;
  if (s.shards.has(poi.shard.key)) return;
  s.shards.add(poi.shard.key);
  game.audio.fanfare();
  canvas.classList.remove('flash');
  void canvas.offsetWidth;
  canvas.classList.add('flash');
  UI.banner('✦ ' + poi.shard.name.toUpperCase() + ' ✦', poi.shard.epitaph, 5600);
  const boon = BOONS[poi.shard.key];
  setTimeout(() => {
    UI.banner('BOON — ' + boon.name.toUpperCase(), boon.desc, 5600);
    game.audio.attune();
  }, 5900);
  setTimeout(() => spawnOrun(), 14000);   // he visits each sanctum in turn
  saveGame();
  if (s.shards.size === 7) setTimeout(winGame, 2600);
}

/* ------------------------------------------------------------------ */
/* The Unlit: shades that roam the broken lands                        */
/* ------------------------------------------------------------------ */

function menaceAt(tileX, tileY) {
  const dist = Math.hypot(tileX - game.world.spawn.x, tileY - game.world.spawn.y);
  const night = daylight() < 0.35 ? 1 : 0;
  return Math.max(1, Math.floor((dist - 40) / 70) + 1 + night);
}

function updateShades(dt) {
  const p = game.player;
  game.battleGrace = Math.max(0, game.battleGrace - dt);

  // spawn
  const dark = 1 - daylight();
  const distFromHearth = Math.hypot(p.tileX - game.world.spawn.x, p.tileY - game.world.spawn.y);
  const rate = dark > 0.55 ? 0.22 : 0.08;
  if (game.shades.length < 3 && game.battleGrace <= 0 && distFromHearth > 50 &&
      Math.random() < rate * dt) {
    const a = Math.random() * Math.PI * 2;
    const r = (Math.max(canvas.width, canvas.height) / 2 + 80) / TILE;
    const tx = p.tileX + Math.cos(a) * r, ty = p.tileY + Math.sin(a) * r;
    if (game.world.walkFactor(tx, ty) > 0.4) {
      game.shades.push({
        x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE,
        level: menaceAt(tx, ty), wob: Math.random() * 7,
        wanderA: Math.random() * Math.PI * 2,
      });
    }
  }

  for (let i = game.shades.length - 1; i >= 0; i--) {
    const sh = game.shades[i];
    const dx = p.x - sh.x, dy = p.y - sh.y;
    const dist = Math.hypot(dx, dy) / TILE;
    if (dist > 75) { game.shades.splice(i, 1); continue; }

    let vx, vy;
    if (dist < 17 && !hasBoon('dusk')) {   // it has your scent (unless cloaked)
      vx = (dx / (dist * TILE)) * 2.5 * TILE;
      vy = (dy / (dist * TILE)) * 2.5 * TILE;
    } else {                               // it drifts, hungry
      sh.wanderA += (Math.random() - 0.5) * dt * 2;
      vx = Math.cos(sh.wanderA) * 1.1 * TILE;
      vy = Math.sin(sh.wanderA) * 1.1 * TILE;
    }
    const nx = sh.x + vx * dt, ny = sh.y + vy * dt;
    if (game.world.walkFactor(nx / TILE, ny / TILE) > 0.3) { sh.x = nx; sh.y = ny; }

    if (dist < 1.15 && game.battleGrace <= 0) {
      Battle.start({ level: sh.level, shade: sh });
      return;
    }
  }
}

function drawIceTrail(camX, camY) {
  for (const ice of game.iceTrail) {
    const sx = ice.x - camX + canvas.width / 2;
    const sy = ice.y - camY + canvas.height / 2;
    const a = Math.min(0.55, ice.life * 0.3);
    ctx.fillStyle = 'rgba(200,235,255,' + a.toFixed(2) + ')';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 9, 6, 0, 0, 7);
    ctx.fill();
  }
}

function drawSparks(camX, camY) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const sp of game.sparks) {
    const sx = sp.x - camX + canvas.width / 2;
    const sy = sp.y - camY + canvas.height / 2;
    ctx.fillStyle = 'rgba(255,240,160,' + Math.min(1, sp.life * 2).toFixed(2) + ')';
    ctx.fillRect(sx, sy, 2.5, 2.5);
  }
  ctx.restore();
}

function drawShades(camX, camY, t) {
  for (const sh of game.shades) {
    const sx = sh.x - camX + canvas.width / 2;
    const sy = sh.y - camY + canvas.height / 2;
    if (sx < -40 || sy < -40 || sx > canvas.width + 40 || sy > canvas.height + 40) continue;
    const wob = Math.sin(t * 3 + sh.wob) * 1.5;
    const g = ctx.createRadialGradient(sx, sy, 1, sx, sy, 13 + wob);
    g.addColorStop(0, 'rgba(28,16,44,0.95)');
    g.addColorStop(0.7, 'rgba(20,10,36,0.7)');
    g.addColorStop(1, 'rgba(20,10,36,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - 16, sy - 16, 32, 32);
    const eye = sh.level >= 8 ? '#ff5a5a' : sh.level >= 4 ? '#c46bd6' : '#7a6bd6';
    ctx.fillStyle = eye;
    ctx.fillRect(sx - 4, sy - 3 + wob * 0.4, 2.5, 2.5);
    ctx.fillRect(sx + 1.5, sy - 3 + wob * 0.4, 2.5, 2.5);
  }
}

function winGame() {
  game.state.restored = true;
  game.mode = 'won';
  document.getElementById('win-text').textContent = LORE.WIN_TEXT;
  document.getElementById('win-screen').classList.remove('hidden');
  game.audio.fanfare();
  saveGame();
}

function checkDiscoveries() {
  const p = game.player;
  const s = game.state;
  for (const poi of game.world.poisNear(p.tileX, p.tileY, 1)) {
    game.poiIndex.set(poi.id, poi);
    if (s.discovered.has(poi.id)) continue;
    const d = Math.hypot(poi.x - p.tileX, poi.y - p.tileY);
    const reach = poi.type === 'sanctum' ? DISCOVER_DIST + 3 : DISCOVER_DIST;
    if (d <= reach) {
      s.discovered.add(poi.id);
      s.discoveredNames.push(poi.name);
      game.audio.discovery();
      UI.banner('DISCOVERED', poi.name, 3000);
    }
  }
}

function updateNearbyPoi() {
  const p = game.player;
  let best = null, bestD = INTERACT_DIST;
  for (const poi of game.world.poisNear(p.tileX, p.tileY, 1)) {
    const d = Math.hypot(poi.x + 0.5 - p.x / TILE, poi.y + 0.5 - p.y / TILE);
    const reach = poi.type === 'sanctum' ? INTERACT_DIST + 1.5 : INTERACT_DIST;
    if (d <= reach && (best === null || d < bestD)) { best = poi; bestD = d; }
  }
  game.nearbyPoi = best;
  if (UI.anyOpen()) { UI.prompt(null); return; }
  if (orunAtHearth()) { UI.prompt('E — be kind'); return; }
  if (nearestRift(2.4)) { UI.prompt('⚔ E — step into the rift'); return; }
  if (!best) { UI.prompt(null); return; }
  const s = game.state;
  let text = null;
  if (best.type === 'monolith') text = 'E — read the Monolith';
  else if (best.type === 'ruin') text = 'E — search the ruins';
  else if (best.type === 'waystone') text = s.activated.has(best.id) ? 'E — touch the Waystone' : 'E — attune to the Waystone';
  else if (best.type === 'sanctum' && !s.shards.has(best.shard.key)) text = '⚔ E — challenge the Guardian of the ' + best.shard.name;
  UI.prompt(text);
}

function markExplored() {
  const halfW = canvas.width / 2, halfH = canvas.height / 2;
  const x0 = Math.floor((game.player.x - halfW) / CHUNK_PX);
  const x1 = Math.floor((game.player.x + halfW) / CHUNK_PX);
  const y0 = Math.floor((game.player.y - halfH) / CHUNK_PX);
  const y1 = Math.floor((game.player.y + halfH) / CHUNK_PX);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++)
      game.state.explored.add(cx + ',' + cy);
}

game.nearestUnclaimedSanctum = function () {
  let best = null, bestD = Infinity;
  for (const s of game.world.sanctums) {
    if (game.state.shards.has(s.shard.key)) continue;
    const d = Math.hypot(s.x - game.player.tileX, s.y - game.player.tileY);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
};

/* ------------------------------------------------------------------ */
/* Weather: the moods of a broken sky                                  */
/* ------------------------------------------------------------------ */

const WEATHER = {
  type: 'clear', intensity: 0, until: 0, wind: 0.2,
  flash: 0, nextBolt: 0,
  drops: [], fogs: [],
};

function weatherWord() {
  if (WEATHER.intensity < 0.3) return '';
  const cold = game.world.temperature(game.player.tileX, game.player.tileY) < 0.32;
  switch (WEATHER.type) {
    case 'rain': return cold ? 'snowfall' : 'rain';
    case 'storm': return 'storm-wracked';
    case 'fog': return 'fog';
    case 'breeze': return 'a restless wind';
    default: return '';
  }
}

function updateWeather(dt) {
  if (game.time > WEATHER.until) {
    const roll = Math.random();
    WEATHER.type = roll < 0.38 ? 'clear' : roll < 0.55 ? 'breeze'
      : roll < 0.75 ? 'rain' : roll < 0.88 ? 'fog' : 'storm';
    WEATHER.until = game.time + 50 + Math.random() * 110;
    WEATHER.wind = (Math.random() - 0.5) * 1.4;
    WEATHER.intensity = 0;
    if (WEATHER.type === 'storm') WEATHER.nextBolt = game.time + 2;
  }
  const target = WEATHER.type === 'clear' ? 0 : 1;
  WEATHER.intensity += (target - WEATHER.intensity) * Math.min(1, dt * 0.5);
  WEATHER.flash = Math.max(0, WEATHER.flash - dt * 2.2);
  if (WEATHER.type === 'storm' && WEATHER.intensity > 0.5 && game.time > WEATHER.nextBolt) {
    WEATHER.nextBolt = game.time + 4 + Math.random() * 9;
    WEATHER.flash = 0.75;
    game.audio.thunder();
  }
}

function drawWeather(t) {
  const w = canvas.width, h = canvas.height;
  const k = WEATHER.intensity;
  if (k < 0.03) return;
  const cold = game.world.temperature(game.player.tileX, game.player.tileY) < 0.32;

  if (WEATHER.type === 'rain' || WEATHER.type === 'storm') {
    const want = WEATHER.type === 'storm' ? 230 : 140;
    while (WEATHER.drops.length < want) {
      WEATHER.drops.push({ x: Math.random() * w, y: Math.random() * h, sp: 0.5 + Math.random() });
    }
    WEATHER.drops.length = want;
    if (cold) {
      ctx.fillStyle = 'rgba(235,240,250,' + (0.55 * k).toFixed(2) + ')';
      for (const d of WEATHER.drops) {
        d.y += (40 + d.sp * 50) * 0.016; d.x += WEATHER.wind * 60 * 0.016 + Math.sin(t * 2 + d.sp * 9) * 0.4;
        if (d.y > h) { d.y = -4; d.x = Math.random() * w; }
        ctx.fillRect(d.x, d.y, 2, 2);
      }
    } else {
      ctx.strokeStyle = 'rgba(185,205,235,' + (0.55 * k).toFixed(2) + ')';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const fall = WEATHER.type === 'storm' ? 16 : 11;
      for (const d of WEATHER.drops) {
        d.y += (480 + d.sp * 380) * 0.016; d.x += WEATHER.wind * 260 * 0.016;
        if (d.y > h) { d.y = -14; d.x = Math.random() * w; }
        if (d.x > w) d.x -= w; if (d.x < 0) d.x += w;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + WEATHER.wind * 5, d.y + fall);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(40,55,90,' + (0.1 * k).toFixed(2) + ')';
      ctx.fillRect(0, 0, w, h);
    }
  } else if (WEATHER.type === 'fog') {
    while (WEATHER.fogs.length < 9) {
      WEATHER.fogs.push({
        x: Math.random() * w, y: Math.random() * h,
        r: 180 + Math.random() * 260, vx: 6 + Math.random() * 14,
      });
    }
    for (const f of WEATHER.fogs) {
      f.x += f.vx * 0.016;
      if (f.x - f.r > w) f.x = -f.r;
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.r);
      g.addColorStop(0, 'rgba(190,200,215,' + (0.13 * k).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(190,200,215,0)');
      ctx.fillStyle = g;
      ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
  } else if (WEATHER.type === 'breeze') {
    ctx.fillStyle = 'rgba(220,230,200,' + (0.35 * k).toFixed(2) + ')';
    for (let i = 0; i < 26; i++) {
      const px = ((i * 211.7 + t * (60 + (i % 5) * 22)) % (w + 40)) - 20;
      const py = ((i * 137.3) % h) + Math.sin(t * 2 + i) * 22;
      ctx.fillRect(px, py, 2, 1.4);
    }
  }
}

/** Aurora over cold lands on clear nights — the sky remembers the Light. */
function drawAurora(t, darkness) {
  if (darkness < 0.42 || WEATHER.intensity > 0.4) return;
  if (game.world.temperature(game.player.tileX, game.player.tileY) > 0.42) return;
  const w = canvas.width;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let band = 0; band < 3; band++) {
    const baseY = 50 + band * 46;
    const hue = band === 0 ? '120,255,170' : band === 1 ? '110,200,255' : '190,130,255';
    ctx.beginPath();
    ctx.moveTo(-10, baseY);
    for (let x = 0; x <= w + 20; x += 24) {
      ctx.lineTo(x, baseY + Math.sin(x * 0.006 + t * 0.5 + band * 2.1) * 26
        + Math.sin(x * 0.017 - t * 0.3) * 9);
    }
    for (let x = w + 20; x >= -10; x -= 24) {
      ctx.lineTo(x, baseY + 60 + Math.sin(x * 0.006 + t * 0.5 + band * 2.1) * 26);
    }
    ctx.closePath();
    const a = (0.05 + 0.025 * Math.sin(t * 0.7 + band)) * darkness;
    ctx.fillStyle = 'rgba(' + hue + ',' + a.toFixed(3) + ')';
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Umbra Rifts: the dark bleeds through at night                       */
/* ------------------------------------------------------------------ */

function updateRifts(dt) {
  const dark = 1 - daylight();
  for (let i = game.rifts.length - 1; i >= 0; i--) {
    if (dark < 0.32 || game.time > game.rifts[i].expires) {
      game.rifts.splice(i, 1);
      UI.banner('THE RIFT CLOSES', 'Dawn — or distance — seals what you did not.', 3200);
    }
  }
  if (dark > 0.5 && game.rifts.length === 0 && game.mode === 'playing' &&
      game.battleGrace <= 0 && Math.random() < 0.02 * dt * 60) {
    const a = Math.random() * Math.PI * 2;
    const r = 26 + Math.random() * 14;
    const tx = Math.round(game.player.tileX + Math.cos(a) * r);
    const ty = Math.round(game.player.tileY + Math.sin(a) * r);
    if (game.world.walkFactor(tx, ty) > 0.4) {
      game.rifts.push({ x: tx, y: ty, expires: game.time + 120, born: game.time });
      UI.banner('A RIFT TEARS OPEN', 'Somewhere near, the dark bleeds through. Seal it before dawn takes it.', 4600);
      game.audio.battleStart();
    }
  }
}

function drawRifts(camX, camY, t) {
  for (const rf of game.rifts) {
    const sx = (rf.x + 0.5) * TILE - camX + canvas.width / 2;
    const sy = (rf.y + 0.5) * TILE - camY + canvas.height / 2;
    if (sx < -80 || sy < -80 || sx > canvas.width + 80 || sy > canvas.height + 80) continue;
    ctx.save();
    ctx.translate(sx, sy);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 46);
    g.addColorStop(0, 'rgba(196,107,214,0.5)');
    g.addColorStop(1, 'rgba(80,20,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-46, -46, 92, 92);
    for (let i = 0; i < 2; i++) {
      ctx.rotate(t * (i ? -0.9 : 1.3));
      ctx.strokeStyle = i ? 'rgba(220,160,255,0.8)' : 'rgba(140,60,190,0.9)';
      ctx.lineWidth = 2.5 - i;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16 + i * 6 + Math.sin(t * 3) * 2, 6 + i * 2, 0, 0, 7);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Orun-of-the-Steady-Hands                                            */
/* ------------------------------------------------------------------ */

function spawnOrun() {
  if (game.orun || game.state.restored) return;
  const a = Math.random() * Math.PI * 2;
  const tx = game.player.tileX + Math.cos(a) * 13;
  const ty = game.player.tileY + Math.sin(a) * 13;
  if (game.world.walkFactor(tx, ty) <= 0.4) return;
  game.orun = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, expires: game.time + 24, fade: 0, leaving: false };
}

function updateOrun(dt) {
  // after the Light is restored, he waits at the Last Hearth
  if (game.state.restored && !game.orun) {
    const sp = game.world.spawn;
    if (Math.hypot(game.player.tileX - sp.x, game.player.tileY - sp.y) < 28) {
      game.orun = { x: (sp.x + 3.5) * TILE, y: (sp.y - 1.5) * TILE, expires: Infinity, fade: 0, leaving: false, hearth: true };
    }
    return;
  }
  const o = game.orun;
  if (!o) {
    // he visits, rarely, those who walk far
    if (Math.random() < 0.0022 * dt * 60 &&
        Math.hypot(game.player.tileX - game.world.spawn.x, game.player.tileY - game.world.spawn.y) > 90) {
      spawnOrun();
    }
    return;
  }
  o.fade = Math.min(1, o.fade + dt * 1.5);
  if (o.hearth) return;

  if (o.leaving) {
    o.fade -= dt * 2.5;        // fade counts down once he goes
    if (o.fade <= 0) game.orun = null;
    return;
  }
  // he keeps his distance, walking slowly away
  const dx = o.x - game.player.x, dy = o.y - game.player.y;
  const dist = Math.hypot(dx, dy) / TILE;
  if (dist < 8) {
    o.x += (dx / (dist * TILE)) * 1.2 * TILE * dt;
    o.y += (dy / (dist * TILE)) * 1.2 * TILE * dt;
  }
  if (dist < 2.6) {
    const line = LORE.ORUN_LINES[Math.min(game.state.orunMet, LORE.ORUN_LINES.length - 1)];
    game.state.orunMet++;
    UI.banner('A TALL STRANGER', line, 7000);
    game.audio.attune();
    o.leaving = true;
    saveGame();
  } else if (game.time > o.expires) {
    o.leaving = true;
  }
}

function orunFinal() {
  if (game.state.orunGifted) {
    UI.banner('ORUN-OF-THE-STEADY-HANDS', '“Go on, Wayfarer. There is a world of it.”', 4200);
    return;
  }
  game.state.orunGifted = true;
  game.hero.skills.set('orun', 1);
  game.audio.fanfare();
  document.getElementById('win-text').textContent = LORE.ORUN_FINAL;
  document.querySelector('#win-inner h1').textContent = 'THE STEADY HANDS';
  document.getElementById('win-screen').classList.remove('hidden');
  game.mode = 'won';
  saveGame();
}

function drawOrun(camX, camY, t) {
  const o = game.orun;
  if (!o) return;
  const sx = o.x - camX + canvas.width / 2;
  const sy = o.y - camY + canvas.height / 2;
  if (sx < -60 || sy < -60 || sx > canvas.width + 60 || sy > canvas.height + 60) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, o.fade);
  const warm = game.state.restored;
  const g = ctx.createRadialGradient(sx, sy - 8, 2, sx, sy - 8, 34);
  g.addColorStop(0, warm ? 'rgba(255,235,180,0.3)' : 'rgba(160,140,210,0.18)');
  g.addColorStop(1, 'rgba(160,140,210,0)');
  ctx.fillStyle = g;
  ctx.fillRect(sx - 34, sy - 42, 68, 68);
  const bob = Math.sin(t * 1.1) * 0.8;
  ctx.fillStyle = warm ? '#3d3526' : '#221d33';        // long robes, hands in sleeves
  ctx.beginPath();
  ctx.moveTo(sx - 8, sy + 12);
  ctx.quadraticCurveTo(sx, sy - 26 + bob, sx + 8, sy + 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = warm ? '#56492f' : '#332b4a';        // deep hood
  ctx.beginPath();
  ctx.arc(sx, sy - 20 + bob, 5.5, 0, 7);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Day / night                                                         */
/* ------------------------------------------------------------------ */

// phase 0 = midnight; returns 0 (black night) .. 1 (full day)
function daylight() {
  const phase = (game.time / DAY_CYCLE) % 1;
  return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
}

game.timeLabel = function () {
  const phase = (game.time / DAY_CYCLE) % 1;
  const label =
    phase < 0.18 ? 'deep night' : phase < 0.3 ? 'dawn' : phase < 0.45 ? 'morning' :
    phase < 0.6 ? 'high day' : phase < 0.72 ? 'evening' : phase < 0.82 ? 'dusk' : 'night';
  const w = weatherWord();
  return w ? label + ' · ' + w : label;
};

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function drawWorld(camX, camY) {
  const x0 = Math.floor((camX - canvas.width / 2) / CHUNK_PX);
  const x1 = Math.floor((camX + canvas.width / 2) / CHUNK_PX);
  const y0 = Math.floor((camY - canvas.height / 2) / CHUNK_PX);
  const y1 = Math.floor((camY + canvas.height / 2) / CHUNK_PX);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      ctx.drawImage(game.world.chunkCanvas(cx, cy),
        Math.floor(cx * CHUNK_PX - camX + canvas.width / 2),
        Math.floor(cy * CHUNK_PX - camY + canvas.height / 2));
    }
  }
}

function drawPOI(poi, sx, sy, t) {
  const s = game.state;
  ctx.save();
  if (poi.type === 'monolith') {
    const collected = s.fragments.has(poi.fragment);
    ctx.fillStyle = '#1c1b26';
    ctx.fillRect(sx - 5, sy - 26, 10, 30);
    ctx.fillStyle = '#2e2c3e';
    ctx.fillRect(sx - 5, sy - 26, 3, 30);
    const pulse = collected ? 0.25 : 0.55 + Math.sin(t * 2.2) * 0.3;
    ctx.fillStyle = 'rgba(120,220,255,' + pulse.toFixed(2) + ')';
    ctx.fillRect(sx - 1.5, sy - 21, 3, 14);
  } else if (poi.type === 'ruin') {
    ctx.fillStyle = '#5d5a52';
    ctx.fillRect(sx - 10, sy - 12, 5, 14);
    ctx.fillRect(sx + 5, sy - 8, 5, 10);
    ctx.fillStyle = '#4a4840';
    ctx.fillRect(sx - 3, sy - 2, 7, 4);
  } else if (poi.type === 'waystone') {
    const active = s.activated.has(poi.id);
    if (active) {
      const g = ctx.createRadialGradient(sx, sy - 10, 2, sx, sy - 10, 30);
      g.addColorStop(0, 'rgba(127,212,255,0.35)');
      g.addColorStop(1, 'rgba(127,212,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 30, sy - 40, 60, 60);
    }
    ctx.fillStyle = '#3a4754';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 24); ctx.lineTo(sx + 7, sy - 8); ctx.lineTo(sx + 5, sy + 2);
    ctx.lineTo(sx - 5, sy + 2); ctx.lineTo(sx - 7, sy - 8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = active ? 'rgba(150,225,255,' + (0.6 + Math.sin(t * 3) * 0.3) + ')' : 'rgba(150,225,255,0.15)';
    ctx.beginPath(); ctx.arc(sx, sy - 11, 2.6, 0, 7); ctx.fill();
  } else if (poi.type === 'sanctum') {
    const claimed = s.shards.has(poi.shard.key);
    ctx.strokeStyle = 'rgba(60,52,40,0.8)';
    ctx.lineWidth = 2;
    for (const r of [30, 20]) {
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.stroke();
    }
    if (claimed) {
      const g = ctx.createLinearGradient(sx, sy - 200, sx, sy);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, poi.shard.color + '55');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 8, sy - 200, 16, 200);
    } else {
      const bob = Math.sin(t * 1.6) * 3;
      const g = ctx.createRadialGradient(sx, sy - 14 + bob, 2, sx, sy - 14 + bob, 36);
      g.addColorStop(0, poi.shard.color + 'aa');
      g.addColorStop(1, poi.shard.color + '00');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 36, sy - 50 + bob, 72, 72);
      ctx.fillStyle = poi.shard.color;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 26 + bob); ctx.lineTo(sx + 6, sy - 14 + bob);
      ctx.lineTo(sx, sy - 2 + bob); ctx.lineTo(sx - 6, sy - 14 + bob);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 24 + bob); ctx.lineTo(sx + 2.5, sy - 14 + bob); ctx.lineTo(sx, sy - 12 + bob);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

function drawNight(camX, camY) {
  const restored = game.state.restored;
  // every shard claimed makes the nights a little gentler
  const base = restored ? 0.34 : 0.6 - game.state.shards.size * 0.025;
  const darkness = (1 - daylight()) * base;
  if (darkness < 0.03) return;
  const w = canvas.width, h = canvas.height;
  lightCtx.clearRect(0, 0, w, h);
  lightCtx.fillStyle = 'rgba(7,9,28,' + darkness.toFixed(3) + ')';
  lightCtx.fillRect(0, 0, w, h);

  lightCtx.globalCompositeOperation = 'destination-out';
  const punch = (sx, sy, r, a) => {
    const g = lightCtx.createRadialGradient(sx, sy, 4, sx, sy, r);
    g.addColorStop(0, 'rgba(0,0,0,' + a + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lightCtx.fillStyle = g;
    lightCtx.fillRect(sx - r, sy - r, r * 2, r * 2);
  };
  // the Wayfarer's lantern (Dawnlight boon: it burns far wider)
  punch(w / 2, h / 2, hasBoon('dawn') ? 260 : 150, hasBoon('dawn') ? 0.95 : 0.85);
  for (const rf of game.rifts) {
    punch((rf.x + 0.5) * TILE - camX + w / 2,
          (rf.y + 0.5) * TILE - camY + h / 2, 100, 0.7);
  }
  for (const poi of game.world.poisNear(game.player.tileX, game.player.tileY, 2)) {
    const lit = (poi.type === 'waystone' && game.state.activated.has(poi.id)) ||
                poi.type === 'sanctum';
    if (!lit) continue;
    punch(poi.x * TILE + TILE / 2 - camX + w / 2,
          poi.y * TILE + TILE / 2 - camY + h / 2, 110, 0.7);
  }
  lightCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(lightCanvas, 0, 0);

  // dusk / dawn warmth
  const phase = (game.time / DAY_CYCLE) % 1;
  const nearEdge = Math.min(Math.abs(phase - 0.25), Math.abs(phase - 0.78));
  if (nearEdge < 0.06) {
    ctx.fillStyle = 'rgba(255,120,40,' + ((0.06 - nearEdge) * 1.6).toFixed(3) + ')';
    ctx.fillRect(0, 0, w, h);
  }
}

function updateFireflies(dt) {
  const darkness = 1 - daylight();
  const b = game.player.biome();
  const wantThem = darkness > 0.45 && (b === 'forest' || b === 'swamp' || b === 'jungle' || b === 'grass');
  if (wantThem && game.fireflies.length < 60 && Math.random() < 0.4) {
    game.fireflies.push({
      x: game.player.x + (Math.random() - 0.5) * canvas.width * 0.8,
      y: game.player.y + (Math.random() - 0.5) * canvas.height * 0.8,
      phase: Math.random() * 7,
      life: 5 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
    });
  }
  for (let i = game.fireflies.length - 1; i >= 0; i--) {
    const f = game.fireflies[i];
    f.life -= dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    f.phase += dt * 2.5;
    if (f.life <= 0 || darkness < 0.3) game.fireflies.splice(i, 1);
  }
}

function drawFireflies(camX, camY) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const f of game.fireflies) {
    const a = Math.max(0, Math.sin(f.phase)) * Math.min(1, f.life) * 0.8;
    if (a <= 0.02) continue;
    ctx.fillStyle = 'rgba(190,255,120,' + a.toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(f.x - camX + canvas.width / 2, f.y - camY + canvas.height / 2, 1.6, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Main loop                                                           */
/* ------------------------------------------------------------------ */

let lastT = performance.now();

function loop(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  const t = now / 1000;

  if (game.mode === 'battle') {
    // the Umbra is outside time: the overworld waits
    game.audio.mood = 'battle';
    Battle.update(dt);
    Battle.render();
    requestAnimationFrame(loop);
    return;
  }

  if (game.mode !== 'title') {
    game.time += dt;
    if (!UI.anyOpen()) {
      game.player.update(dt, game.keys);
      updateShades(dt);
      updateRifts(dt);
      updateOrun(dt);
    }
    game.hero.hp = Math.min(game.hero.maxHp, game.hero.hp + 1.2 * dt);
    updateWeather(dt);
    game.audio.mood = daylight() < 0.4 ? 'night' : 'day';
    for (let i = game.iceTrail.length - 1; i >= 0; i--) {
      if ((game.iceTrail[i].life -= dt) <= 0) game.iceTrail.splice(i, 1);
    }
    for (let i = game.sparks.length - 1; i >= 0; i--) {
      if ((game.sparks[i].life -= dt) <= 0) game.sparks.splice(i, 1);
    }
    updateFireflies(dt);
    if (game.time - game.lastDiscoveryCheck > 0.25) {
      game.lastDiscoveryCheck = game.time;
      checkDiscoveries();
      markExplored();
    }
    updateNearbyPoi();
  }

  const camX = game.player ? game.player.x : 0;
  const camY = game.player ? game.player.y : 0;

  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (game.world) {
    drawWorld(camX, camY);
    drawIceTrail(camX, camY);
    for (const poi of game.world.poisNear(
      Math.floor(camX / TILE), Math.floor(camY / TILE), 2)) {
      drawPOI(poi,
        poi.x * TILE + TILE / 2 - camX + canvas.width / 2,
        poi.y * TILE + TILE / 2 - camY + canvas.height / 2, t);
    }
    drawRifts(camX, camY, t);
    if (game.mode !== 'title') {
      drawShades(camX, camY, t);
      drawOrun(camX, camY, t);
      game.player.draw(ctx, canvas.width / 2, canvas.height / 2, t);
      drawSparks(camX, camY);
    }
    drawFireflies(camX, camY);
    if (game.mode !== 'title') drawWeather(t);
    drawNight(camX, camY);
    if (game.mode !== 'title') {
      drawAurora(t, (1 - daylight()));
      if (WEATHER.flash > 0.01) {
        ctx.fillStyle = 'rgba(235,240,255,' + (WEATHER.flash * 0.55).toFixed(2) + ')';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  if (game.mode !== 'title') {
    UI.updateHUD();
    UI.drawMinimap();
  }

  requestAnimationFrame(loop);
}

init();
