/* Battles in the Umbra — the folded nothing the Architects once sailed.
   Turn-based with an action layer: timed strikes crit, timed parries turn
   blows aside, combos build, packs of the Unlit telegraph their intents,
   and the camera knows when you've earned a slow-motion kill. */
'use strict';

const FOE_SPOTS = {
  1: [[3.4, 0, 0]],
  2: [[3.1, 0, -1.7], [3.7, 0, 1.7]],
  3: [[2.9, 0, -2.4], [3.9, 0, 0.1], [3.1, 0, 2.4]],
};

const INTENT_GLYPHS = {
  attack: '⚔', heavy: '☄', charge: '☄', bolt: '➳',
  guard: '⛨', devour: '✚', sig: '✦',
};

const Battle = {
  active: false,
  canvas: null, ctx: null,
  scene: null,
  phase: 'idle',            // intro | player | acting | victory | defeat
  queue: [],
  tweens: [],
  foes: [],                 // entities
  foesData: [],
  shadows: [],
  hero: null,
  heroOrbit: null,
  heroShadow: null,
  targetIdx: 0,
  combo: 0,
  qte: null,
  slowmo: 0,
  punch: 0,
  cds: {},
  opts: null,
  tierBefore: 0,
  fled: false,

  /** Compatibility view: the currently targeted foe's data. */
  get foeData() {
    return this.foesData[this.targetIdx] || this.foesData[0];
  },

  /* ---------------- lifecycle ---------------- */

  init() {
    this.canvas = document.getElementById('battle-canvas');
    this.ctx = this.canvas.getContext('2d');
    window.addEventListener('resize', () => this._resize());
    this.canvas.addEventListener('pointerdown', (e) => this._onTap(e));
    this._resize();
  },

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  /** opts: { level, guardianOf, shade, rift, gauntlet, count } */
  start(opts) {
    this.opts = opts;
    this.active = true;
    this.fled = false;
    this.tweens = [];
    this.qte = null;
    this.slowmo = 0;
    this.punch = 0;
    this.combo = 0;
    this.targetIdx = 0;
    game.mode = 'battle';
    this.tierBefore = tierOf(game.hero.level);

    const lvl = Math.max(1, Math.round(opts.level));
    const rand = mulberry32((game.world.seed ^ (lvl * 2654435761) ^ ((game.hero.battlesWon + 1) * 97)) >>> 0);
    const guardian = !!opts.guardianOf;

    // how many of the Unlit answer
    let count = guardian ? 1 : (opts.count || 1);
    if (!guardian && !opts.count) {
      if (lvl >= 3 && rand() < 0.35) count = 2;
      if (lvl >= 6 && rand() < 0.28) count = 3;
    }

    const h = game.hero;
    h.shield = 0; h.dodge = 0; h.blind = 0; h.burnT = 0;
    this.cds = {};

    const theme = guardian ? B3D.THEMES.void
      : B3D.themeForBiome(game.player.biome());
    const accent = guardian ? opts.guardianOf.shard.color : theme.mote;

    this.foes = []; this.foesData = []; this.shadows = [];
    this.xpTotal = 0;
    const spots = FOE_SPOTS[count];
    for (let i = 0; i < count; i++) {
      const color = guardian ? opts.guardianOf.shard.color
        : ['#c46bd6', '#7a6bd6', '#d66b8e', '#6bd6c4'][(rand() * 4) | 0];
      const arch = guardian ? ((rand() * 3) | 0) : ((rand() * 4) | 0);
      const name = guardian
        ? 'Guardian of the ' + opts.guardianOf.shard.name
        : foeName(lvl, rand);
      const hpMult = (count > 1 ? 0.72 : 1) * (guardian ? 1.9 : 1);
      const fd = {
        name, level: lvl, color, guardian, arch,
        ranged: arch === 3,
        maxHp: Math.max(10, Math.round((26 + 13 * lvl) * hpMult)),
        atk: (4 + 2.1 * lvl) * (guardian ? 1.15 : 1),
        xp: Math.round((20 + 9 * lvl) * (guardian ? 2 : 1) * (count > 1 ? 0.8 : 1)),
        burn: 0, atkDown: 0, veiled: 0, stoneskin: 0,
        guarding: false, charged: false, sigUsed: false,
        intent: null, dead: false,
      };
      fd.hp = fd.maxHp;
      this.xpTotal += fd.xp;
      this.foesData.push(fd);
      const scale = (1 + Math.min(0.5, lvl * 0.035)) * (guardian ? 1.45 : 1) * (count > 1 ? 0.92 : 1);
      this.foes.push({
        mesh: B3D.foeMesh(arch, color, guardian),
        pos: spots[i].slice(), rot: -Math.PI / 2 - 0.4 + (rand() - 0.5) * 0.3,
        scale, alpha: 0, offset: [0, 0, 0], bob: 0,
      });
      this.shadows.push({
        mesh: B3D.shadowMesh(0.9), pos: [spots[i][0], 0, spots[i][2]],
        rot: 0, scale, alpha: 0, offset: [0, 0, 0],
      });
    }

    const tier = tierOf(h.level);
    this.hero = { mesh: B3D.heroMesh(tier), pos: [-3.4, 0, 0], rot: Math.PI / 2 + 0.4, scale: 1, alpha: 0, offset: [0, 0, 0], bob: 0 };
    this.heroOrbit = { mesh: B3D.heroOrbitMesh(tier), pos: [-3.4, 0, 0], rot: 0, scale: 1, alpha: 0, offset: [0, 0, 0], bob: 0 };
    this.heroShadow = { mesh: B3D.shadowMesh(0.6), pos: [-3.4, 0, 0], rot: 0, scale: 1, alpha: 0, offset: [0, 0, 0] };

    this.scene = {
      entities: [
        { mesh: B3D.arenaMesh(accent, hash2i(lvl, 7, game.world.seed), theme), pos: [0, 0, 0], rot: 0, scale: 1, alpha: 1, offset: [0, 0, 0] },
        this.heroShadow, ...this.shadows,
        this.hero, this.heroOrbit, ...this.foes,
      ],
      particles: [], texts: [], bolts: [], shocks: [], slashes: [], intents: [],
      stars: B3D.makeStars(game.world.seed ^ lvl, 220),
      motes: B3D.makeMotes(game.world.seed ^ (lvl * 31), 36),
      accent,
      cam: { target: [0, 1.3, 0], angle: 3.4, dist: 16, height: 6.5, fov: 0.5 },
      introT: 0, time: 0, shake: 0, flash: 1, qte: null,
    };

    this.canvas.classList.remove('hidden');
    document.getElementById('battle-ui').classList.remove('hidden');
    document.getElementById('skill-choice').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('minimap').classList.add('hidden');
    UI.prompt(null);

    document.getElementById('b-hero-name').textContent =
      TIERS[tier].name + '  ·  level ' + h.level;
    this._updateCombo();
    this._log(guardian
      ? 'The ' + this.foesData[0].name + ' rises from the dais. The shard will not be given.'
      : opts.rift
        ? 'You step through. The rift screams. ' + (count > 1 ? 'Things answer.' : this.foesData[0].name + ' answers.')
        : count > 1
          ? 'The dark congeals into ' + count + ' hungry shapes.'
          : 'The dark congeals. ' + this.foesData[0].name + ' bars your way.');

    this.phase = 'intro';
    this.queue = [
      { wait: 0.2, fn: () => { this.tween(0.7, (k) => { this.hero.alpha = k; this.heroOrbit.alpha = k; this.heroShadow.alpha = k; }); } },
      {
        wait: 0.5, fn: () => {
          this.foes.forEach((fe, i) => {
            this.tween(0.7, (k) => { fe.alpha = k; this.shadows[i].alpha = k; });
          });
          game.audio.battleStart();
        },
      },
      { wait: 1.0, fn: () => { this._beginPlayerTurn(); } },
    ];
    this._buildActions();
    game.audio.ensure();
  },

  end(victory) {
    this.active = false;
    this.canvas.classList.add('hidden');
    document.getElementById('battle-ui').classList.add('hidden');
    document.getElementById('skill-choice').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('minimap').classList.remove('hidden');
    game.mode = 'playing';
    game.battleGrace = 4;

    if (this.opts.shade) {
      const i = game.shades.indexOf(this.opts.shade);
      if (i >= 0 && (victory || this.fled)) game.shades.splice(i, 1);
    }
    if (victory && this.opts.guardianOf) {
      claimShard(this.opts.guardianOf);
    }
    if (victory && this.opts.rift) {
      const i = game.rifts.indexOf(this.opts.rift);
      if (i >= 0) game.rifts.splice(i, 1);
      const h = game.hero;
      h.riftlight++;
      h.atk = Math.round(h.atk * 1.04 * 10) / 10;
      h.maxHp = Math.round(h.maxHp * 1.04);
      UI.banner('RIFT SEALED — RIFTLIGHT ' + romanNumeral(h.riftlight),
        'The tear closes around its own scream. +4% might and vitality, forever.', 5600);
    }
    if (!victory && !this.fled) {
      const h = game.hero;
      h.hp = Math.max(1, Math.round(h.maxHp * 0.5));
      game.player.x = (game.world.spawn.x + 0.5) * TILE;
      game.player.y = (game.world.spawn.y + 0.5) * TILE;
      UI.banner('THE DARK TAKES YOU', 'You wake at the Last Hearth. The sliver refused, absolutely, to let you go out.', 5200);
    }
    const tierNow = tierOf(game.hero.level);
    if (tierNow > this.tierBefore) {
      const t = TIERS[tierNow];
      setTimeout(() => {
        game.audio.fanfare();
        UI.banner('✦ EVOLUTION — ' + t.name.toUpperCase() + ' ✦', t.line, 6000);
      }, victory && this.opts.guardianOf ? 12000 : 600);
    }
    saveGame();
  },

  /* ---------------- input ---------------- */

  hotkey(n) {
    if (!document.getElementById('skill-choice').classList.contains('hidden')) {
      const cards = document.querySelectorAll('#skill-cards .card');
      if (cards[n - 1]) cards[n - 1].click();
      return;
    }
    const btns = document.querySelectorAll('#b-actions button:not(.disabled)');
    if (btns[n - 1]) btns[n - 1].click();
  },

  cycleTarget() {
    if (this.phase !== 'player') return;
    for (let k = 1; k <= this.foesData.length; k++) {
      const i = (this.targetIdx + k) % this.foesData.length;
      if (!this.foesData[i].dead) { this.targetIdx = i; return; }
    }
  },

  _onTap(e) {
    if (this.qte) { this.qteInput(); return; }
    if (this.phase !== 'player') return;
    // tap a foe to target it
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const w = this.canvas.width, h = this.canvas.height;
    const c = B3D.camera(this.scene.cam);
    const f = (Math.min(w, h) / 2) / Math.tan(this.scene.cam.fov || 0.52);
    let best = -1, bestD = 110;
    this.foes.forEach((fe, i) => {
      if (this.foesData[i].dead) return;
      const q = B3D.project([fe.pos[0], fe.pos[1] + 1.5, fe.pos[2]], c, w, h, f);
      if (!q) return;
      const d = Math.hypot(q[0] - mx, q[1] - my);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) this.targetIdx = best;
  },

  /* ---------------- the timing ring ---------------- */

  _qteStart(kind, anchor, cb) {
    this.qte = {
      kind, anchor, t: 0, dur: 0.85, done: false, cb,
      hint: game.hero.battlesWon < 4
        ? (kind === 'crit' ? 'TAP / SPACE as the ring closes' : 'TAP / SPACE to turn the blow')
        : null,
    };
  },

  qteInput() {
    const q = this.qte;
    if (!q || q.done) return;
    q.done = true;
    const hit = Math.abs(q.t - q.dur) <= (q.kind === 'crit' ? 0.16 : 0.18);
    this._qteResolve(hit);
  },

  _qteResolve(success) {
    const q = this.qte;
    this.qte = null;
    this.scene.qte = null;
    if (q && q.cb) q.cb(success);
  },

  /* ---------------- script helpers ---------------- */

  tween(dur, fn, done) {
    this.tweens.push({ t: 0, dur, fn, done });
  },

  _log(text) {
    document.getElementById('b-log').textContent = text;
  },

  _text(pos, str, col, big) {
    this.scene.texts.push({ pos: [pos[0], pos[1] + 2.4, pos[2]], str, col, big, t: 0 });
  },

  _burst(pos, col, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI;
      const s = speed * (0.4 + Math.random());
      this.scene.particles.push({
        pos: [pos[0], pos[1] + 1.4, pos[2]],
        vel: [Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + speed * 0.5, Math.sin(a) * Math.cos(b) * s],
        life: 1, col, size: 0.06 + Math.random() * 0.1,
      });
    }
  },

  _shock(pos, col) {
    this.scene.shocks.push({ pos: [pos[0], 0.1, pos[2]], r: 0.3, col, life: 1 });
  },

  _slash(pos, col) {
    this.scene.slashes.push({
      pos: [pos[0], pos[1] + 1.4, pos[2]],
      ang: Math.random() * Math.PI * 2, t: 0, dur: 0.22, col,
    });
  },

  _lunge(ent, target, onImpact, after) {
    const from = ent.pos;
    const dx = target[0] - from[0], dz = target[2] - from[2];
    const dist = Math.hypot(dx, dz);
    const reachLen = Math.max(0, dist - 1.4);
    let impactDone = false;
    this.tween(0.62, (k) => {
      // anticipation: a small pull-back, then the spring
      const wind = k < 0.22 ? -(k / 0.22) * 0.45 : 0;
      const spring = k < 0.22 ? 0 : Math.sin(((k - 0.22) / 0.78) * Math.PI);
      const r = wind + spring;
      ent.offset = [
        (dx / dist) * reachLen * Math.max(0, r),
        Math.max(0, spring) * 0.7,
        (dz / dist) * reachLen * Math.max(0, r),
      ];
      if (wind < 0) ent.offset = [(dx / dist) * wind, 0, (dz / dist) * wind];
      if (!impactDone && k > 0.55) {
        impactDone = true;
        onImpact();
      }
    }, () => {
      ent.offset = [0, 0, 0];
      if (after) after();
    });
  },

  /* ---------------- turns ---------------- */

  _alive() {
    return this.foesData.filter((f) => !f.dead);
  },

  _retarget() {
    if (this.foesData[this.targetIdx] && !this.foesData[this.targetIdx].dead) return;
    const i = this.foesData.findIndex((f) => !f.dead);
    if (i >= 0) this.targetIdx = i;
  },

  _beginPlayerTurn() {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    const h = game.hero;
    if (h.burnT > 0) {
      h.burnT--;
      const dmg = Math.max(1, Math.round((this.foesData[0].atk || 8) * 0.2));
      h.hp = Math.max(0, h.hp - dmg);
      this._text(this.hero.pos, dmg + '', '#ff8a5c');
      this._burst(this.hero.pos, '#ff8a5c', 8, 1.8);
      if (h.hp <= 0) { this._heroDies(); return; }
    }
    // burning foes smolder
    this.foesData.forEach((f, i) => {
      if (f.dead || f.burn <= 0) return;
      f.burn--;
      const dmg = Math.max(1, Math.round(h.atk * 0.25));
      f.hp = Math.max(0, f.hp - dmg);
      this._text(this.foes[i].pos, dmg + '', '#ff8a5c');
      this._burst(this.foes[i].pos, '#ff8a5c', 10, 2);
    });
    if (this._checkDeaths(null)) return;

    for (const k of Object.keys(this.cds)) {
      if (this.cds[k] > 0) this.cds[k]--;
    }
    // the Unlit show their intents — read them, and answer
    for (const f of this._alive()) {
      if (f.charged) { f.intent = 'heavy'; continue; }
      if (f.guardian && !f.sigUsed && f.hp < f.maxHp * 0.55) { f.intent = 'sig'; continue; }
      const r = Math.random();
      if (f.ranged) f.intent = r < 0.72 ? 'bolt' : 'guard';
      else if (f.hp < f.maxHp * 0.3 && r < 0.22) f.intent = 'devour';
      else if (r < 0.62) f.intent = 'attack';
      else if (r < 0.78) f.intent = 'guard';
      else f.intent = 'charge';
    }
    this._retarget();
    this.phase = 'player';
    const charging = this._alive().some((f) => f.intent === 'heavy');
    this._log(charging
      ? 'Gathered darkness hangs ready — the next blow will be terrible.'
      : 'Your move, Wayfarer.');
    this._buildActions();
  },

  _buildActions() {
    const bar = document.getElementById('b-actions');
    bar.innerHTML = '';
    const h = game.hero;
    const keys = [...h.skills.keys()];
    keys.forEach((key, i) => {
      const def = SKILLS[key];
      const lv = h.skills.get(key);
      const cd = this.cds[key] || 0;
      const btn = document.createElement('button');
      btn.innerHTML = '<b>' + (i + 1) + '</b> ' + def.name +
        (lv > 1 ? ' <i>' + romanNumeral(lv) + '</i>' : '') +
        (cd > 0 ? ' <s>' + cd + '</s>' : '');
      btn.style.borderColor = def.color + '88';
      if (cd > 0 || this.phase !== 'player') btn.classList.add('disabled');
      else btn.onclick = () => this._useSkill(key);
      bar.appendChild(btn);
    });
    const flee = document.createElement('button');
    flee.innerHTML = '<b>' + (keys.length + 1) + '</b> Flee';
    flee.className = this.phase !== 'player' ? 'flee disabled' : 'flee';
    if (this.phase === 'player') flee.onclick = () => this._flee();
    bar.appendChild(flee);
  },

  /* ---------------- player action ---------------- */

  _useSkill(key) {
    if (this.phase !== 'player') return;
    this.phase = 'acting';
    const h = game.hero;
    const lv = h.skills.get(key);
    const def = SKILLS[key];
    if (def.cd) this.cds[key] = def.cd + 1;
    this._buildActions();
    this._retarget();

    const selfOnly = key === 'tide' || key === 'stone' || key === 'dusk';
    if (selfOnly) { this._castSelf(key, lv, def); return; }

    // offensive Arts open a timing ring: strike true for a critical
    const tEnt = this.foes[this.targetIdx];
    this._qteStart('crit',
      [tEnt.pos[0], tEnt.pos[1] + 1.5 * tEnt.scale, tEnt.pos[2]],
      (crit) => this._executeAttack(key, lv, def, crit));
  },

  _hit(idx, pct, col, big, opts) {
    opts = opts || {};
    const h = game.hero;
    const f = this.foesData[idx];
    if (!f || f.dead) return;
    const fe = this.foes[idx];
    if (f.veiled) {
      f.veiled = 0;
      this._text(fe.pos, 'missed', '#c46bd6');
      return;
    }
    let dmg = Math.max(1, Math.round(
      h.atk * pct * (0.9 + Math.random() * 0.2) *
      (opts.crit ? 1.5 : 1) *
      (1 + Math.min(10, this.combo) * 0.04)));
    if (h.blind) {
      h.blind = 0;
      dmg = Math.max(1, Math.round(dmg / 2));
      this._text(this.hero.pos, 'blinded', '#ffd27a');
    }
    if (f.guarding && !opts.ignoreGuard) dmg = Math.round(dmg / 2);
    f.hp = Math.max(0, f.hp - dmg);
    const isBig = big || opts.crit;
    this._text(fe.pos, dmg + (opts.crit ? '!' : ''), opts.crit ? '#ffd27a' : (col || '#fff'), isBig);
    this._burst(fe.pos, col || '#fff', isBig ? 26 : 14, isBig ? 4 : 2.6);
    this._slash(fe.pos, opts.crit ? '#ffd27a' : (col || '#e8e2d0'));
    if (isBig) this._shock(fe.pos, opts.crit ? '#ffd27a' : (col || '#e8e2d0'));
    this.scene.shake = isBig ? 0.5 : 0.25;
    this.punch = isBig ? 1 : 0.5;
    if (opts.crit) {
      this.combo++;
      this._updateCombo();
      game.audio.crit();
    } else {
      game.audio.hit(isBig);
    }
  },

  _executeAttack(key, lv, def, crit) {
    const h = game.hero;
    const ti = this.targetIdx;
    const tEnt = this.foes[ti];

    switch (key) {
      case 'strike':
        this._log(crit ? 'You strike true.' : 'You strike.');
        this._lunge(this.hero, tEnt.pos,
          () => this._hit(ti, 1 + (lv - 1) * 0.15, null, false, { crit }),
          () => this._afterPlayerHit());
        break;
      case 'ember':
        this._log('Emberlash — ash dreams of being flame.');
        this._burst(this.hero.pos, def.color, 10, 1.2);
        this.queue.push({
          wait: 0.45, fn: () => {
            this._hit(ti, 1.5 + (lv - 1) * 0.25, def.color, false, { crit });
            const f = this.foesData[ti];
            if (f && !f.dead) f.burn = 2;
          },
        });
        this.queue.push({ wait: 0.55, fn: () => this._afterPlayerHit() });
        break;
      case 'storm': {
        const hits = 2 + Math.min(3, lv);
        this._log('Stormcall — ' + hits + ' bolts answer, striking wherever the dark stands.');
        this._burst(this.hero.pos, def.color, 10, 1.2);
        let done = 0;
        const bolt = () => {
          const alive = this.foesData.map((f, i) => f.dead ? -1 : i).filter((i) => i >= 0);
          if (!alive.length) { this._afterPlayerHit(); return; }
          const pick = alive[(Math.random() * alive.length) | 0];
          this._hit(pick, 0.5 + (lv - 1) * 0.08, def.color, false, { crit });
          if (++done < hits) this.queue.push({ wait: 0.26, fn: bolt });
          else this.queue.push({ wait: 0.3, fn: () => this._afterPlayerHit() });
        };
        this.queue.push({ wait: 0.4, fn: bolt });
        break;
      }
      case 'frost':
        this._log('Frostbite — the cold stops being cruel for you alone.');
        this._burst(this.hero.pos, def.color, 10, 1.2);
        this.queue.push({
          wait: 0.45, fn: () => {
            this._hit(ti, 0.9 + (lv - 1) * 0.15, def.color, false, { crit });
            const f = this.foesData[ti];
            if (f && !f.dead) { f.atkDown = 2; f.atkDownF = 0.25 + (lv - 1) * 0.05; }
          },
        });
        this.queue.push({ wait: 0.55, fn: () => this._afterPlayerHit() });
        break;
      case 'dawn':
        this._log('DAWNSTRIKE — an honest sunrise, delivered by hand.');
        this.scene.flash = 0.6;
        this._lunge(this.hero, tEnt.pos,
          () => this._hit(ti, 2.4 + (lv - 1) * 0.4, def.color, true, { crit }),
          () => this._afterPlayerHit());
        break;
      case 'orun':
        this._log('ARCHITECT’S HAND — what was broken, mends.');
        this.scene.flash = 0.7;
        h.hp = h.maxHp;
        this._text(this.hero.pos, 'mended', def.color);
        this._burst(this.hero.pos, def.color, 26, 3);
        game.audio.heal();
        this._lunge(this.hero, tEnt.pos,
          () => this._hit(ti, 3.0, def.color, true, { crit, ignoreGuard: true }),
          () => this._afterPlayerHit());
        break;
    }
  },

  _castSelf(key, lv, def) {
    const h = game.hero;
    this._burst(this.hero.pos, def.color, 12, 1.4);
    this.queue.push({
      wait: 0.45, fn: () => {
        if (key === 'tide') {
          this._log('Tidebind — the sea remembers its patient music.');
          const heal = Math.round(h.maxHp * (0.30 + (lv - 1) * 0.08));
          h.hp = Math.min(h.maxHp, h.hp + heal);
          this._text(this.hero.pos, '+' + heal, def.color);
          this._burst(this.hero.pos, def.color, 18, 2);
          game.audio.heal();
        } else if (key === 'stone') {
          this._log('Stoneward — shoulders of the Architects.');
          h.shield = Math.round(h.maxHp * (0.40 + (lv - 1) * 0.15));
          this._text(this.hero.pos, '⛨ ' + h.shield, def.color);
          this._burst(this.hero.pos, def.color, 14, 1.6);
        } else {
          this._log('Duskveil — you wear the dark as a cloak.');
          h.dodge = 1.2 + (lv - 1) * 0.25;
          this._text(this.hero.pos, 'veiled', def.color);
          this._burst(this.hero.pos, def.color, 16, 1.4);
        }
      },
    });
    this.queue.push({ wait: 0.5, fn: () => this._afterPlayerHit() });
  },

  _afterPlayerHit() {
    if (this.phase !== 'acting') return;
    if (this._checkDeaths(() => {
      this.queue.push({ wait: 0.55, fn: () => this._enemyTurn() });
    })) return;
  },

  /** Animate any deaths. Returns true if the battle ended (victory queued). */
  _checkDeaths(cont) {
    let any = false;
    this.foesData.forEach((f, i) => {
      if (f.dead || f.hp > 0) return;
      f.dead = true; f.intent = null;
      any = true;
      const fe = this.foes[i];
      this._log('The ' + f.name + ' comes apart into harmless dark.');
      this._burst(fe.pos, f.color, 40, 4.5);
      this._burst(fe.pos, '#ffffff', 20, 3);
      this._shock(fe.pos, f.color);
      this.scene.shake = 0.6;
      const sh = this.shadows[i];
      this.tween(0.9, (k) => { fe.alpha = 1 - k; fe.offset = [0, k * 1.5, 0]; sh.alpha = (1 - k) * 0.8; });
    });
    if (this._alive().length === 0) {
      this.phase = 'victory';
      this.queue = [];
      this._buildActions();
      this.slowmo = 0.7;                 // savor the last blow
      game.audio.fanfare();
      this.queue.push({ wait: 1.3, fn: () => this._victory() });
      return true;
    }
    if (any) this._retarget();
    if (cont) cont();
    return false;
  },

  /* ---------------- the foes act ---------------- */

  _enemyTurn() {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this._actList = this.foesData.map((f, i) => f.dead ? -1 : i).filter((i) => i >= 0);
    this._nextAct();
  },

  _nextAct() {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    if (game.hero.hp <= 0) { this._heroDies(); return; }
    const i = this._actList.shift();
    if (i === undefined) {
      this.queue.push({ wait: 0.45, fn: () => this._beginPlayerTurn() });
      return;
    }
    if (this.foesData[i].dead) { this._nextAct(); return; }
    this._foeAct(i);
  },

  _foeAct(i) {
    const f = this.foesData[i];
    const fe = this.foes[i];
    const h = game.hero;

    if (f.stoneskin > 0) f.stoneskin--;
    else f.guarding = false;

    const intent = f.intent || 'attack';
    f.intent = null;

    if (intent === 'guard') {
      f.guarding = true;
      this._text(fe.pos, 'guarding', '#9aa');
      this._log('The ' + f.name + ' hardens like old grief.');
      this.queue.push({ wait: 0.7, fn: () => this._nextAct() });
      return;
    }
    if (intent === 'charge') {
      f.charged = true;
      this._burst(fe.pos, '#41355c', 22, 1.2);
      this._log('The ' + f.name + ' gathers darkness…');
      this.queue.push({ wait: 0.7, fn: () => this._nextAct() });
      return;
    }
    if (intent === 'devour') {
      const heal = Math.round(f.maxHp * 0.14);
      f.hp = Math.min(f.maxHp, f.hp + heal);
      this._text(fe.pos, '+' + heal, '#8fd47a');
      this._log('The ' + f.name + ' drinks the dark and knits itself together.');
      this.queue.push({ wait: 0.7, fn: () => this._nextAct() });
      return;
    }
    if (intent === 'sig') {
      f.sigUsed = true;
      this._signature(f, fe, h);
      return;
    }

    // attack / heavy / bolt — give the Wayfarer a chance to turn it
    const mult = intent === 'heavy' ? 2.1 : 1;
    if (intent === 'heavy') {
      f.charged = false;
      this._log('The gathered darkness breaks over you!');
    } else {
      this._log('The ' + f.name + (intent === 'bolt' ? ' hurls a gout of the void.' : ' strikes.'));
    }

    if (h.dodge > 0) {                  // Duskveil answers before the blow lands
      this._evadeAndCounter(i, f, fe);
      return;
    }

    this._qteStart('parry',
      [this.hero.pos[0], this.hero.pos[1] + 1.4, this.hero.pos[2]],
      (parried) => {
        const deliver = () => this._strikeHero(i, f, fe, mult, parried, intent === 'heavy');
        if (intent === 'bolt') {
          this.scene.bolts.push({
            from: [fe.pos[0], fe.pos[1] + 1.8 * fe.scale, fe.pos[2]],
            to: [this.hero.pos[0], this.hero.pos[1] + 1.2, this.hero.pos[2]],
            t: 0, dur: 0.45, col: f.color,
          });
          this.queue.push({ wait: 0.45, fn: deliver });
          this.queue.push({ wait: 0.5, fn: () => this._nextAct() });
        } else {
          this._lunge(fe, this.hero.pos, deliver, () => this._nextAct());
        }
      });
  },

  _evadeAndCounter(i, f, fe) {
    const h = game.hero;
    this._lunge(fe, this.hero.pos, () => {
      this._text(this.hero.pos, 'evaded', '#c46bd6');
      const counter = Math.max(1, Math.round(h.atk * h.dodge));
      h.dodge = 0;
      this.queue.push({
        wait: 0.35, fn: () => {
          f.hp = Math.max(0, f.hp - counter);
          this._text(fe.pos, counter + '', '#c46bd6');
          this._burst(fe.pos, '#c46bd6', 16, 3);
          this._slash(fe.pos, '#c46bd6');
          game.audio.hit(false);
        },
      });
    }, () => {
      this._checkDeaths(() => this._nextAct());
    });
  },

  _strikeHero(i, f, fe, mult, parried, big) {
    const h = game.hero;
    const atkNow = f.atk * (f.atkDown > 0 ? (1 - (f.atkDownF || 0.25)) : 1);
    if (f.atkDown > 0) f.atkDown--;

    let dmg = Math.max(1, Math.round(atkNow * mult * (0.9 + Math.random() * 0.2)));
    if (parried) {
      dmg = Math.round(dmg / 2);
      this.combo++;
      this._updateCombo();
      this._text(this.hero.pos, 'PARRY', '#7fd4ff');
      this._shock(this.hero.pos, '#7fd4ff');
      game.audio.parry();
    } else if (this.combo > 0) {
      this.combo = 0;
      this._updateCombo();
    }
    if (h.shield > 0) {
      const absorbed = Math.min(h.shield, dmg);
      h.shield -= absorbed;
      dmg -= absorbed;
      this._text(this.hero.pos, '⛨', '#cdab6e');
    }
    if (dmg > 0) {
      h.hp = Math.max(0, h.hp - dmg);
      this._text(this.hero.pos, dmg + '', big ? '#ff6a6a' : '#fff', big);
      this._burst(this.hero.pos, '#d66', big ? 24 : 12, big ? 3.5 : 2.2);
      this.scene.shake = big ? 0.55 : 0.3;
      this.punch = big ? 0.9 : 0.4;
      game.audio.hit(big);
    }
    if (h.hp <= 0) this._heroDies();
  },

  /** Each Guardian's signature move, keyed to its shard. */
  _signature(f, fe, h) {
    const key = this.opts.guardianOf.shard.key;
    const col = this.opts.guardianOf.shard.color;
    this._burst(fe.pos, col, 26, 2.2);
    switch (key) {
      case 'dawn':
        h.blind = 1;
        this._log('Blinding radiance! Your next blow will land half-seen.');
        break;
      case 'tide': {
        const heal = Math.round(f.maxHp * 0.25);
        f.hp = Math.min(f.maxHp, f.hp + heal);
        this._text(fe.pos, '+' + heal, col);
        this._log('The tide pours back into its wounds.');
        break;
      }
      case 'stone':
        f.guarding = true;
        f.stoneskin = 2;
        this._text(fe.pos, 'stoneskin', col);
        this._log('Its hide turns to mountainside — your blows will glance for a time.');
        break;
      case 'storm':
        f.charged = true;
        this._log('The Guardian splits the sky — BRACE.');
        break;
      case 'ember':
        h.burnT = 2;
        this._burst(this.hero.pos, col, 14, 2);
        this._log('Embers cling to your cloak and will not be put out.');
        break;
      case 'frost':
        for (const k of Object.keys(this.cds)) this.cds[k]++;
        for (const k of game.hero.skills.keys()) {
          if (SKILLS[k].cd && !(k in this.cds)) this.cds[k] = 1;
        }
        this._log('Cold floods your blood. The Arts come slower to your hands.');
        break;
      case 'dusk':
        f.veiled = 1;
        this._text(fe.pos, 'veiled', col);
        this._log('It steps halfway out of the world. Your next blow will find nothing.');
        break;
    }
    this.queue.push({ wait: 1.0, fn: () => this._nextAct() });
  },

  _flee() {
    if (this.phase !== 'player') return;
    this.phase = 'acting';
    this._buildActions();
    if (Math.random() < 0.6) {
      this._log('You slip between shadows and run.');
      this.queue.push({ wait: 0.7, fn: () => { this.fled = true; this.end(false); this.fled = false; } });
    } else {
      this._log('The dark closes the way out!');
      this.combo = 0;
      this._updateCombo();
      this.queue.push({ wait: 0.6, fn: () => this._enemyTurn() });
    }
  },

  /* ---------------- endings ---------------- */

  _victory() {
    const h = game.hero;
    h.battlesWon++;
    h.xp += this.xpTotal;
    this._text([0, 0.5, 0], '+' + this.xpTotal + ' light', '#e8c66a', true);

    let leveled = false;
    while (h.xp >= xpNeed(h.level)) {
      h.xp -= xpNeed(h.level);
      h.level++;
      h.maxHp += 14;
      h.atk += 2.4;
      h.hp = h.maxHp;
      leveled = true;
    }
    if (leveled) {
      this._log('LEVEL ' + h.level + ' — the road hardens you. Mended in full.');
      this._burst(this.hero.pos, '#e8c66a', 30, 3);
      game.audio.attune();
    }
    this.queue.push({
      wait: leveled ? 1.4 : 0.8,
      fn: () => {
        if (this.opts.gauntlet > 1) {
          h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * 0.3));
          this.start({
            level: this.opts.level + 1,
            gauntlet: this.opts.gauntlet - 1,
            rift: this.opts.rift,
            count: Math.min(3, 2 + (this.opts.level >= 8 ? 1 : 0)),
          });
        } else {
          this._offerSkills();
        }
      },
    });
  },

  _offerSkills() {
    const h = game.hero;
    const candidates = [];
    for (const key of Object.keys(SKILLS)) {
      if (SKILLS[key].base || SKILLS[key].secret) continue;
      if (!h.skills.has(key)) candidates.push({ kind: 'learn', key });
      else if (h.skills.get(key) < MAX_SKILL_LV) candidates.push({ kind: 'upgrade', key });
    }
    if (h.skills.has('strike') && h.skills.get('strike') < MAX_SKILL_LV) {
      candidates.push({ kind: 'upgrade', key: 'strike' });
    }
    candidates.push({ kind: 'stat', key: 'vit' });
    candidates.push({ kind: 'stat', key: 'might' });

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const picks = candidates.slice(0, 3);

    const wrap = document.getElementById('skill-cards');
    wrap.innerHTML = '';
    picks.forEach((c, i) => {
      const def = c.kind === 'stat' ? STAT_CARDS[c.key] : SKILLS[c.key];
      const lv = c.kind === 'upgrade' ? h.skills.get(c.key) + 1 : 1;
      const card = document.createElement('div');
      card.className = 'card';
      card.style.borderColor = def.color + 'aa';
      card.innerHTML =
        '<div class="card-key">' + (i + 1) + '</div>' +
        '<div class="card-name" style="color:' + def.color + '">' +
        (c.kind === 'learn' ? 'Learn — ' : c.kind === 'upgrade' ? romanNumeral(lv) + ' — ' : '') +
        def.name + '</div>' +
        '<div class="card-desc">' + def.desc(lv) + '</div>';
      card.onclick = () => {
        if (c.kind === 'stat') {
          if (c.key === 'vit') { h.maxHp = Math.round(h.maxHp * 1.12) + 4; h.hp = h.maxHp; }
          else h.atk = Math.round(h.atk * 1.12 * 10) / 10;
        } else {
          h.skills.set(c.key, lv);
        }
        game.audio.discovery();
        this.end(true);
      };
      wrap.appendChild(card);
    });
    document.getElementById('skill-choice').classList.remove('hidden');
  },

  _heroDies() {
    if (this.phase === 'defeat') return;
    this.phase = 'defeat';
    this.queue = [];
    this.qte = null;
    this.scene.qte = null;
    this._buildActions();
    this._log('The dark takes you — but the Hearth refuses to let go.');
    this.tween(1.1, (k) => { this.hero.alpha = 1 - k; this.heroOrbit.alpha = 1 - k; this.heroShadow.alpha = 1 - k; });
    this.queue.push({ wait: 1.6, fn: () => this.end(false) });
  },

  /* ---------------- per-frame ---------------- */

  update(rdt) {
    const s = this.scene;
    if (this.slowmo > 0) this.slowmo -= rdt;
    const dt = rdt * (this.slowmo > 0 ? 0.3 : 1);    // savor the moment
    s.time += dt;
    s.shake = Math.max(0, s.shake - dt * 1.8);
    s.flash = Math.max(0, s.flash - dt * 1.6);
    this.punch = Math.max(0, this.punch - dt * 2.6);

    // intro sweep, then a slow orbit with impact punch-ins
    s.introT = Math.min(1, s.introT + dt * 0.85);
    const e = 1 - Math.pow(1 - s.introT, 3);
    s.cam.dist = 16 - 6.6 * e - this.punch * 1.5;
    s.cam.height = 6.5 - 3.1 * e;
    s.cam.angle = 2.0 + (1 - e) * 1.4 + Math.sin(s.time * 0.1) * 0.32;

    // the timing ring runs on real time — reflexes don't slow
    if (this.qte && !this.qte.done) {
      this.qte.t += rdt;
      s.qte = this.qte;
      if (this.qte.t > this.qte.dur + 0.14) {
        this.qte.done = true;
        this._qteResolve(false);
      }
    } else if (!this.qte) {
      s.qte = null;
    }

    // script queue
    if (this.queue.length && !this.qte) {
      this.queue[0].wait -= dt;
      if (this.queue[0].wait <= 0) {
        const step = this.queue.shift();
        step.fn();
        if (this.phase === 'player') this._buildActions();
      }
    }
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1) {
        this.tweens.splice(i, 1);
        if (tw.done) tw.done();
      }
    }

    // idle motion + shadows
    this.hero.bob = Math.sin(s.time * 1.8) * 0.06;
    this.heroOrbit.pos = this.hero.pos;
    this.heroOrbit.rot = s.time * 1.4;
    this.heroOrbit.bob = this.hero.bob;
    this.heroOrbit.offset = this.hero.offset;
    this.heroShadow.pos = [this.hero.pos[0] + this.hero.offset[0], 0, this.hero.pos[2] + this.hero.offset[2]];
    this.foes.forEach((fe, i) => {
      const f = this.foesData[i];
      fe.bob = Math.sin(s.time * 1.5 + i * 2) * 0.12 + (f.guardian ? 0.15 : 0.4);
      const sh = this.shadows[i];
      sh.pos = [fe.pos[0] + fe.offset[0], 0, fe.pos[2] + fe.offset[2]];
      sh.scale = fe.scale * Math.max(0.5, 1 - (fe.bob + fe.offset[1]) * 0.18);
    });

    // ambient motes drift upward
    for (const m of s.motes) {
      m.y += m.sp * dt;
      if (m.y > 5) m.y = 0;
    }
    // bolts, shocks, slashes
    for (let i = s.bolts.length - 1; i >= 0; i--) {
      s.bolts[i].t += dt;
      if (s.bolts[i].t > s.bolts[i].dur) s.bolts.splice(i, 1);
    }
    for (let i = s.shocks.length - 1; i >= 0; i--) {
      const sh = s.shocks[i];
      sh.r += dt * 7;
      sh.life -= dt * 2.2;
      if (sh.life <= 0) s.shocks.splice(i, 1);
    }
    for (let i = s.slashes.length - 1; i >= 0; i--) {
      s.slashes[i].t += dt;
      if (s.slashes[i].t > s.slashes[i].dur) s.slashes.splice(i, 1);
    }
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.life -= dt * 1.1;
      p.vel[1] -= dt * 2.2;
      p.pos = B3D.add(p.pos, B3D.scale(p.vel, dt));
      if (p.life <= 0) s.particles.splice(i, 1);
    }
    for (let i = s.texts.length - 1; i >= 0; i--) {
      s.texts[i].t += dt;
      if (s.texts[i].t > 1.4) s.texts.splice(i, 1);
    }

    // intent badges + mini hp bars over each foe
    s.intents = [];
    this.foesData.forEach((f, i) => {
      if (f.dead) return;
      const fe = this.foes[i];
      s.intents.push({
        anchor: [fe.pos[0], (3.3 * fe.scale) + fe.bob, fe.pos[2]],
        hp: Math.max(0, f.hp / f.maxHp),
        color: f.color,
        glyph: this.phase === 'player' && f.intent ? INTENT_GLYPHS[f.intent] : '',
        glyphColor: f.intent === 'heavy' || f.intent === 'sig' ? '#ff8a5c' : '#d8cdb2',
        targeted: i === this.targetIdx && this.phase === 'player' && this._alive().length > 1,
        alpha: fe.alpha,
      });
    });

    this._updateBars();
  },

  _updateCombo() {
    const el = document.getElementById('b-combo');
    if (this.combo >= 2) {
      el.textContent = 'COMBO ×' + this.combo;
      el.classList.remove('hidden', 'pop');
      void el.offsetWidth;
      el.classList.add('pop');
      el.style.color = this.combo >= 6 ? '#ff8a5c' : '#e8c66a';
    } else {
      el.classList.add('hidden');
    }
  },

  _updateBars() {
    const f = this.foeData, h = game.hero;
    if (f) {
      document.getElementById('b-foe-name').textContent =
        f.name + '  ·  menace ' + f.level;
      document.getElementById('b-foe-fill').style.width =
        Math.max(0, (f.hp / f.maxHp) * 100) + '%';
      document.getElementById('b-foe-sub').textContent =
        Math.ceil(f.hp) + ' / ' + f.maxHp +
        (f.burn > 0 ? '  🔥' + f.burn : '') +
        (f.atkDown > 0 ? '  ❄' : '') +
        (this._alive().length > 1 ? '  ·  ' + this._alive().length + ' remain' : '');
    }
    document.getElementById('b-hero-fill').style.width =
      Math.max(0, (h.hp / h.maxHp) * 100) + '%';
    document.getElementById('b-hero-sub').textContent =
      Math.ceil(h.hp) + ' / ' + h.maxHp +
      (h.shield > 0 ? '  ⛨' + Math.ceil(h.shield) : '') +
      (h.dodge > 0 ? '  veiled' : '');
  },

  render() {
    B3D.render(this.ctx, this.canvas.width, this.canvas.height, this.scene);
  },
};
