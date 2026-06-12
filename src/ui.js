/* HUD, banners, journal, lore modal, minimap, and the world map
   (with waystone fast travel). DOM-driven, fed by main.js. */
'use strict';

const UI = {
  game: null,
  bannerTimer: null,
  mapZoom: 1.0,

  el(id) { return document.getElementById(id); },

  init(game) {
    this.game = game;
    const mapCanvas = this.el('map-canvas');
    mapCanvas.addEventListener('click', (e) => this.onMapClick(e));
    mapCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.mapZoom = Math.max(0.35, Math.min(3, this.mapZoom * (e.deltaY > 0 ? 0.85 : 1.18)));
      this.drawMap();
    }, { passive: false });
    this.el('journal-body').addEventListener('click', (e) => {
      const t = e.target.closest('.j-frag');
      if (t) this.showLore(parseInt(t.dataset.frag, 10));
    });
    // tap the parchment (or any overlay backdrop) to close it
    this.el('lore-modal').addEventListener('click', () => {
      this.el('lore-modal').classList.add('hidden');
      game.audio.closeBook();
    });
    for (const id of ['journal', 'help', 'map-overlay']) {
      const el = this.el(id);
      el.addEventListener('click', (e) => {
        if (e.target === el) el.classList.add('hidden');
      });
    }
  },

  /* ---------------- banners & prompts ---------------- */

  banner(title, sub, ms) {
    const b = this.el('banner');
    b.classList.remove('hidden', 'fading');
    void b.offsetWidth; // restart CSS animation
    this.el('banner-title').textContent = title;
    this.el('banner-sub').textContent = sub || '';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => {
      b.classList.add('fading');
      this.bannerTimer = setTimeout(() => b.classList.add('hidden'), 800);
    }, ms || 3200);
  },

  prompt(text) {
    const p = this.el('prompt');
    if (!text) { p.classList.add('hidden'); return; }
    p.textContent = text;
    p.classList.remove('hidden');
  },

  /* ---------------- lore modal ---------------- */

  showLore(index) {
    const f = LORE.FRAGMENTS[index];
    this.el('lore-title').textContent =
      'Fragment ' + romanNumeral(index + 1) + ' — ' + f.title;
    this.el('lore-text').textContent = f.text;
    this.el('lore-modal').classList.remove('hidden');
  },

  /* ---------------- journal ---------------- */

  toggleJournal() {
    const j = this.el('journal');
    if (!j.classList.contains('hidden')) { j.classList.add('hidden'); return; }
    this.renderJournal();
    j.classList.remove('hidden');
  },

  renderJournal() {
    const g = this.game;
    const h = g.hero;
    const tier = TIERS[tierOf(h.level)];
    let html = '<div class="j-section">THE WAYFARER</div>';
    html += '<div class="j-shard"><span class="dot" style="background:' + tier.color + '"></span>' +
      tier.name + ' · level ' + h.level + ' · ' + h.battlesWon +
      (h.battlesWon === 1 ? ' battle won' : ' battles won') + '</div>';
    html += '<div class="j-muted">vitality ' + h.maxHp + ' · might ' + (Math.round(h.atk * 10) / 10) +
      (h.riftlight > 0 ? ' · riftlight ' + romanNumeral(h.riftlight) : '') +
      (g.state.orunMet > 0 ? ' · the stranger has spoken ' + g.state.orunMet +
        (g.state.orunMet === 1 ? ' time' : ' times') : '') + '</div>';

    const t9 = g.state.tallies;
    html += '<div class="j-muted">' + t9.caches + ' caches opened · ' + t9.wisps +
      ' wisps caught · ' + t9.stars + ' stars salvaged · ' + t9.elites + ' elites unmade</div>';

    html += '<div class="j-section">RELICS (' + h.relics.size + ' / ' + Object.keys(RELICS).length + ')</div>';
    if (h.relics.size === 0) {
      html += '<div class="j-muted">The Architects dropped things on the way down. Caches sparkle. Stars fall. Elites carry what they stole.</div>';
    } else {
      for (const key of h.relics) {
        const r = RELICS[key];
        html += '<div class="j-shard"><span class="dot" style="background:' + r.color + '"></span>' +
          r.name + ' <span class="j-muted">— ' + r.desc + '</span></div>';
      }
    }

    html += '<div class="j-section">ARTS LEARNED</div>';
    for (const [key, lv] of h.skills) {
      const def = SKILLS[key];
      html += '<div class="j-shard"><span class="dot" style="background:' + def.color + '"></span>' +
        def.name + (lv > 1 ? ' ' + romanNumeral(lv) : '') +
        ' <span class="j-muted">— ' + def.desc(lv) + '</span></div>';
    }

    html += '<div class="j-section">THE SEVEN SHARDS &amp; THEIR BOONS</div>';
    for (const s of LORE.SHARDS) {
      const have = g.state.shards.has(s.key);
      const boon = BOONS[s.key];
      html += '<div class="j-shard"><span class="dot" style="background:' +
        (have ? s.color : '#333') + '"></span>' +
        (have
          ? s.name + ' <span class="j-muted">— ' + boon.name + ': ' + boon.desc + '</span>'
          : '<span class="j-muted">an unfound shard</span>') + '</div>';
    }

    html += '<div class="j-section">FRAGMENTS OF THE OLD HISTORIES (' +
      g.state.fragments.size + ' / ' + LORE.FRAGMENTS.length + ')</div>';
    if (g.state.fragments.size === 0) {
      html += '<div class="j-muted">Seek the monoliths of the Architects. They still whisper.</div>';
    } else {
      const got = [...g.state.fragments].sort((a, b) => a - b);
      for (const i of got) {
        html += '<div class="j-frag" data-frag="' + i + '">❖ Fragment ' +
          romanNumeral(i + 1) + ' — ' + LORE.FRAGMENTS[i].title + '</div>';
      }
    }

    html += '<div class="j-section">PLACES DISCOVERED (' + g.state.discoveredNames.length + ')</div>';
    if (g.state.discoveredNames.length === 0) {
      html += '<div class="j-muted">The lands are wide, and you have only begun.</div>';
    } else {
      const recent = g.state.discoveredNames.slice(-14).reverse();
      for (const n of recent) html += '<div class="j-disc">· ' + n + '</div>';
    }
    this.el('journal-body').innerHTML = html;
  },

  /* ---------------- HUD ---------------- */

  updateHUD() {
    const g = this.game, p = g.player;
    this.el('loc').textContent = BIOMES[p.biome()].name.toUpperCase();
    this.el('timeofday').textContent = g.timeLabel();
    const h = g.hero;
    const tier = TIERS[tierOf(h.level)];
    this.el('hero-line').textContent =
      tier.name.toUpperCase() + ' · LV ' + h.level +
      ' · ' + h.xp + '/' + xpNeed(h.level) + ' light';
    this.el('hero-line').style.color = tier.color;
    this.el('hp-fill').style.width = ((h.hp / h.maxHp) * 100).toFixed(1) + '%';
    this.el('shards').textContent = '✦ ' + g.state.shards.size + ' / 7 Shards';
    this.el('frags').textContent = '❖ ' + g.state.fragments.size + ' Fragments';
    this.el('stamina-fill').style.width = (p.stamina * 100).toFixed(1) + '%';

    // pings: fallen stars and waystone rumors pull you off the road
    let pings = '';
    const mkPing = (tx, ty, label, col, glyph) => {
      const dx = tx - p.tileX, dy = ty - p.tileY;
      const ang = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(0);
      return '<div style="color:' + col + '"><span class="ping-arrow" style="transform:rotate(' +
        ang + 'deg)">' + glyph + '</span>' + label + ' · ' + (Math.hypot(dx, dy) | 0) + '</div>';
    };
    if (typeof STARS !== 'undefined' && STARS.site) {
      pings += mkPing(STARS.site.x, STARS.site.y, 'fallen star', '#ffd27a', '➤');
    }
    if (g.rumor) {
      pings += mkPing(g.rumor.x, g.rumor.y, 'rumor', '#7fd4ff', '➤');
    }
    this.el('pings').innerHTML = pings;

    const compass = this.el('compass');
    if (g.state.attuned && g.state.shards.size < 7) {
      const target = g.nearestUnclaimedSanctum();
      if (target) {
        compass.classList.remove('hidden');
        const dx = target.x - p.tileX, dy = target.y - p.tileY;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        this.el('compass-arrow').style.transform = 'rotate(' + angle.toFixed(0) + 'deg)';
        const dist = Math.hypot(dx, dy) | 0;
        this.el('compass-label').textContent =
          'the Resonance · ' + dist + ' strides';
      }
    } else {
      compass.classList.add('hidden');
    }
  },

  /* ---------------- minimap ---------------- */

  drawMinimap() {
    const g = this.game;
    const c = this.el('minimap');
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, W, H);

    // circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, 7);
    ctx.clip();

    const px = g.player.tileX, py = g.player.tileY;
    const ppc = 7;  // pixels per chunk
    const ccx = Math.floor(px / CHUNK), ccy = Math.floor(py / CHUNK);
    const range = Math.ceil(W / ppc / 2) + 1;
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const cx = ccx + dx, cy = ccy + dy;
        if (!g.state.explored.has(cx + ',' + cy)) continue;
        const col = g.world.chunkAverage(cx, cy);
        ctx.fillStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
        ctx.fillRect(
          W / 2 + (cx * CHUNK - px) / CHUNK * ppc,
          H / 2 + (cy * CHUNK - py) / CHUNK * ppc, ppc + 0.5, ppc + 0.5);
      }
    }

    // discovered POIs nearby
    for (const id of g.state.discovered) {
      const poi = g.poiIndex.get(id);
      if (!poi) continue;
      const mx = W / 2 + (poi.x - px) / CHUNK * ppc;
      const my = H / 2 + (poi.y - py) / CHUNK * ppc;
      if (mx < 0 || my < 0 || mx > W || my > H) continue;
      ctx.fillStyle = poi.type === 'sanctum' ? (poi.shard ? poi.shard.color : '#fff')
        : poi.type === 'waystone' ? '#7fd4ff' : '#c9b27a';
      ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }

    // the Eye of the Folded Dark shows unopened caches
    if (hasRelic('rift-eye')) {
      for (const poi of g.world.poisNear(px, py, 3)) {
        if (poi.type !== 'cache' || g.state.opened.has(poi.id)) continue;
        const mx = W / 2 + (poi.x - px) / CHUNK * ppc;
        const my = H / 2 + (poi.y - py) / CHUNK * ppc;
        if (mx < 0 || my < 0 || mx > W || my > H) continue;
        ctx.fillStyle = '#ffd27a';
        ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      }
    }
    // a fallen star burns gold
    if (typeof STARS !== 'undefined' && STARS.site) {
      const mx = W / 2 + (STARS.site.x - px) / CHUNK * ppc;
      const my = H / 2 + (STARS.site.y - py) / CHUNK * ppc;
      if (mx > 0 && my > 0 && mx < W && my < H) {
        ctx.fillStyle = 'rgba(255,215,130,' + (0.6 + Math.sin(performance.now() / 200) * 0.4).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(mx, my, 4, 0, 7); ctx.fill();
      }
    }

    // open rifts pulse violet
    const tt = performance.now() / 300;
    for (const rf of g.rifts) {
      const mx = W / 2 + (rf.x - px) / CHUNK * ppc;
      const my = H / 2 + (rf.y - py) / CHUNK * ppc;
      if (mx < 0 || my < 0 || mx > W || my > H) continue;
      ctx.fillStyle = 'rgba(196,107,214,' + (0.6 + Math.sin(tt) * 0.4).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, 7); ctx.fill();
    }

    // player
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, 7); ctx.fill();
    ctx.restore();
  },

  /* ---------------- world map ---------------- */

  toggleMap() {
    const m = this.el('map-overlay');
    if (!m.classList.contains('hidden')) { m.classList.add('hidden'); return; }
    m.classList.remove('hidden');
    const c = this.el('map-canvas');
    c.width = Math.min(window.innerWidth * 0.82, 1100);
    c.height = Math.min(window.innerHeight * 0.74, 760);
    this.drawMap();
  },

  drawMap() {
    const g = this.game;
    const c = this.el('map-canvas');
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, W, H);

    const ppt = 0.55 * this.mapZoom;        // pixels per tile
    const ppc = ppt * CHUNK;
    const px = g.player.tileX, py = g.player.tileY;
    const toScreen = (tx, ty) => [W / 2 + (tx - px) * ppt, H / 2 + (ty - py) * ppt];

    for (const key of g.state.explored) {
      const [cx, cy] = key.split(',').map(Number);
      const [sx, sy] = toScreen(cx * CHUNK, cy * CHUNK);
      if (sx < -ppc || sy < -ppc || sx > W || sy > H) continue;
      const col = g.world.chunkAverage(cx, cy);
      ctx.fillStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
      ctx.fillRect(sx, sy, ppc + 0.5, ppc + 0.5);
    }

    ctx.textAlign = 'center';
    ctx.font = '11px Cinzel, serif';

    // spawn: the Last Hearth
    {
      const [sx, sy] = toScreen(g.world.spawn.x, g.world.spawn.y);
      ctx.fillStyle = '#ffd27a';
      ctx.fillText('⌂', sx, sy + 4);
      ctx.fillStyle = 'rgba(255,210,122,0.75)';
      ctx.fillText('The Last Hearth', sx, sy + 16);
    }

    for (const id of g.state.discovered) {
      const poi = g.poiIndex.get(id);
      if (!poi) continue;
      const [sx, sy] = toScreen(poi.x, poi.y);
      if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
      if (poi.type === 'sanctum') {
        ctx.fillStyle = poi.shard.color;
        ctx.font = '15px serif';
        ctx.fillText(g.state.shards.has(poi.shard.key) ? '✦' : '✧', sx, sy + 5);
        ctx.font = '11px Cinzel, serif';
        ctx.fillText(poi.shard.name, sx, sy + 18);
      } else if (poi.type === 'waystone') {
        const active = g.state.activated.has(poi.id);
        ctx.fillStyle = active ? '#7fd4ff' : 'rgba(127,212,255,0.35)';
        ctx.fillText('◆', sx, sy + 4);
      } else {
        ctx.fillStyle = poi.type === 'monolith' ? '#9fd0e8' : '#c9b27a';
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }
    }

    // player
    const t = performance.now() / 400;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 4 + Math.sin(t) * 1, 0, 7); ctx.fill();

    ctx.fillStyle = 'rgba(216,205,178,0.5)';
    ctx.font = '12px Cinzel, serif';
    ctx.fillText('AETHERMOOR — THE KNOWN WORLD', W / 2, 20);
  },

  onMapClick(e) {
    const g = this.game;
    const c = this.el('map-canvas');
    const rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const ppt = 0.55 * this.mapZoom;
    const tx = g.player.tileX + (mx - c.width / 2) / ppt;
    const ty = g.player.tileY + (my - c.height / 2) / ppt;

    let best = null, bestD = 14 / ppt;  // ~14 px tolerance
    for (const id of g.state.activated) {
      const poi = g.poiIndex.get(id);
      if (!poi) continue;
      const d = Math.hypot(poi.x - tx, poi.y - ty);
      if (d < bestD) { best = poi; bestD = d; }
    }
    if (best) {
      g.player.x = (best.x + 0.5) * TILE;
      g.player.y = (best.y + 1.8) * TILE;
      this.el('map-overlay').classList.add('hidden');
      g.audio.attune();
      this.banner(best.name, 'The stones pass you between them like a whispered message.');
    }
  },

  closeAll() {
    let closed = false;
    for (const id of ['lore-modal', 'journal', 'map-overlay', 'help']) {
      const el = this.el(id);
      if (!el.classList.contains('hidden')) { el.classList.add('hidden'); closed = true; }
    }
    return closed;
  },

  anyOpen() {
    return ['lore-modal', 'journal', 'map-overlay', 'help'].some(
      (id) => !this.el(id).classList.contains('hidden'));
  },
};
