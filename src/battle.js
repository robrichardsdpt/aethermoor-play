/* Battles in the Umbra: when the Unlit catch a Wayfarer, both are pulled
   into the shadow realm. Turn-based, fully animated in 3D.
   Every victory teaches you something — that is the deal the dark never
   wanted to make. */
'use strict';

const Battle = {
  active: false,
  canvas: null, ctx: null,
  scene: null,
  phase: 'idle',          // intro | player | acting | victory | defeat
  queue: [],              // [{wait, fn}] sequential script steps
  tweens: [],
  foe: null,
  hero: null,             // entity
  heroOrbit: null,
  cds: {},
  guard: false,           // foe guarding
  charge: false,          // foe charging a heavy blow
  opts: null,
  tierBefore: 0,

  /* ---------------- lifecycle ---------------- */

  init() {
    this.canvas = document.getElementById('battle-canvas');
    this.ctx = this.canvas.getContext('2d');
    window.addEventListener('resize', () => this._resize());
    this._resize();
  },

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  /** opts: { level, guardianOf (sanctum poi), shade (overworld entity) } */
  start(opts) {
    this.opts = opts;
    this.active = true;
    this.fled = false;
    this.tweens = [];
    game.mode = 'battle';
    this.tierBefore = tierOf(game.hero.level);

    const lvl = Math.max(1, Math.round(opts.level));
    const rand = mulberry32((game.world.seed ^ (lvl * 2654435761)) >>> 0);
    const guardian = !!opts.guardianOf;
    const color = guardian ? opts.guardianOf.shard.color
      : ['#c46bd6', '#7a6bd6', '#d66b8e', '#6bd6c4'][(rand() * 4) | 0];
    const name = guardian
      ? 'Guardian of the ' + opts.guardianOf.shard.name
      : foeName(lvl, rand);

    this.foeData = {
      name, level: lvl, color, guardian,
      maxHp: Math.round((26 + 13 * lvl) * (guardian ? 1.9 : 1)),
      atk: (4 + 2.1 * lvl) * (guardian ? 1.15 : 1),
      xp: Math.round((20 + 9 * lvl) * (guardian ? 2 : 1)),
      burn: 0, atkDown: 0,
    };
    this.foeData.hp = this.foeData.maxHp;

    const h = game.hero;
    h.shield = 0; h.dodge = 0; h.blind = 0; h.burnT = 0;
    this.cds = {};
    this.guard = false;
    this.charge = false;

    // build the scene
    const tier = tierOf(h.level);
    this.hero = { mesh: B3D.heroMesh(tier), pos: [-3.4, 0, 0], rot: Math.PI / 2 + 0.4, scale: 1, alpha: 0, offset: [0, 0, 0], bob: 0 };
    this.heroOrbit = { mesh: B3D.heroOrbitMesh(tier), pos: [-3.4, 0, 0], rot: 0, scale: 1, alpha: 0, offset: [0, 0, 0], bob: 0 };
    this.foe = {
      mesh: B3D.foeMesh((rand() * 3) | 0, color, guardian),
      pos: [3.4, 0, 0], rot: -Math.PI / 2 - 0.4,
      scale: (1 + Math.min(0.5, lvl * 0.035)) * (guardian ? 1.45 : 1),
      alpha: 0, offset: [0, 0, 0], bob: 0,
    };
    this.scene = {
      entities: [
        { mesh: B3D.arenaMesh(color, hash2i(lvl, 7, game.world.seed)), pos: [0, 0, 0], rot: 0, scale: 1, alpha: 1, offset: [0, 0, 0] },
        this.hero, this.heroOrbit, this.foe,
      ],
      particles: [], texts: [],
      stars: B3D.makeStars(game.world.seed ^ lvl, 220),
      cam: { target: [0, 1.3, 0], angle: 2.0, dist: 9.2, height: 3.4, fov: 0.5 },
      time: 0, shake: 0, flash: 1,
    };

    this.canvas.classList.remove('hidden');
    document.getElementById('battle-ui').classList.remove('hidden');
    document.getElementById('skill-choice').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('minimap').classList.add('hidden');
    UI.prompt(null);

    document.getElementById('b-foe-name').textContent =
      name + '  ·  menace ' + lvl;
    document.getElementById('b-hero-name').textContent =
      TIERS[tier].name + '  ·  level ' + h.level;
    this._log(guardian
      ? 'The ' + name + ' rises from the dais. The shard will not be given.'
      : opts.rift
        ? 'You step through. The rift screams. ' + name + ' answers.'
        : 'The dark congeals. ' + name + ' bars your way.');

    this.phase = 'intro';
    this.queue = [
      { wait: 0.1, fn: () => { this.tween(0.7, (k) => { this.hero.alpha = k; this.heroOrbit.alpha = k; }); } },
      { wait: 0.5, fn: () => { this.tween(0.7, (k) => { this.foe.alpha = k; }); game.audio.battleStart(); } },
      { wait: 0.9, fn: () => { this._beginPlayerTurn(); } },
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
    game.battleGrace = 4;          // seconds of peace after any battle

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
      // the dark returns you to the Hearth
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
      }, victory && this.opts.guardianOf ? 6500 : 600);
    }
    saveGame();
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

  _lunge(ent, toward, onImpact, after) {
    const dir = ent === this.hero ? 1 : -1;
    this.tween(0.55, (k) => {
      const reach = Math.sin(Math.min(1, k * 1.25) * Math.PI);
      ent.offset = [reach * 4.6 * dir, Math.sin(k * Math.PI) * 0.7, 0];
      if (!this._impactDone && k > 0.45) {
        this._impactDone = true;
        onImpact();
      }
    }, () => {
      ent.offset = [0, 0, 0];
      this._impactDone = false;
      if (after) after();
    });
  },

  /* ---------------- turns ---------------- */

  _beginPlayerTurn() {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    const h = game.hero;
    if (h.burnT > 0) {           // a Guardian's embers still cling to you
      h.burnT--;
      const dmg = Math.max(1, Math.round(this.foeData.atk * 0.2));
      h.hp = Math.max(0, h.hp - dmg);
      this._text(this.hero.pos, dmg + '', '#ff8a5c');
      this._burst(this.hero.pos, '#ff8a5c', 8, 1.8);
      if (h.hp <= 0) { this._heroDies(); return; }
    }
    // tick foe statuses at the top of the player's turn
    const f = this.foeData;
    if (f.burn > 0) {
      const dmg = Math.max(1, Math.round(game.hero.atk * 0.25));
      f.hp = Math.max(0, f.hp - dmg);
      f.burn--;
      this._text(this.foe.pos, dmg + '', '#ff8a5c');
      this._burst(this.foe.pos, '#ff8a5c', 10, 2);
      if (f.hp <= 0) { this._foeDies(); return; }
    }
    for (const k of Object.keys(this.cds)) {
      if (this.cds[k] > 0) this.cds[k]--;
    }
    this.phase = 'player';
    this._log(this.charge
      ? 'The ' + f.name + ' gathers darkness — the next blow will be terrible.'
      : 'Your move, Wayfarer.');
    this._buildActions();
  },

  hotkey(n) {
    if (!document.getElementById('skill-choice').classList.contains('hidden')) {
      const cards = document.querySelectorAll('#skill-cards .card');
      if (cards[n - 1]) cards[n - 1].click();
      return;
    }
    const btns = document.querySelectorAll('#b-actions button:not(.disabled)');
    if (btns[n - 1]) btns[n - 1].click();
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

  _useSkill(key) {
    if (this.phase !== 'player') return;
    this.phase = 'acting';
    const h = game.hero;
    const lv = h.skills.get(key);
    const def = SKILLS[key];
    if (def.cd) this.cds[key] = def.cd + 1;
    this._buildActions();

    const foeP = this.foe.pos;
    const dmgRoll = (pct) => Math.max(1, Math.round(h.atk * pct * (0.9 + Math.random() * 0.2)));

    const hit = (pct, col, big, ignoreGuard) => {
      if (this.foeData.veiled) {
        this.foeData.veiled = 0;
        this._text(foeP, 'missed', '#c46bd6');
        return;
      }
      let dmg = dmgRoll(pct);
      if (h.blind) {
        h.blind = 0;
        dmg = Math.max(1, Math.round(dmg / 2));
        this._text(this.hero.pos, 'blinded', '#ffd27a');
      }
      if (this.guard && !ignoreGuard) dmg = Math.round(dmg / 2);
      this.foeData.hp = Math.max(0, this.foeData.hp - dmg);
      this._text(foeP, dmg + '', col || '#fff', big);
      this._burst(foeP, col || def.color, big ? 26 : 14, big ? 4 : 2.6);
      this.scene.shake = big ? 0.5 : 0.25;
      game.audio.hit(big);
    };

    switch (key) {
      case 'strike':
        this._log('You strike.');
        this._lunge(this.hero, foeP, () => hit(1 + (lv - 1) * 0.15), () => this._afterPlayerHit());
        break;
      case 'ember':
        this._log('Emberlash — ash dreams of being flame.');
        this._cast(def.color, () => {
          hit(1.5 + (lv - 1) * 0.25, def.color);
          this.foeData.burn = 2;
        });
        break;
      case 'tide': {
        this._log('Tidebind — the sea remembers its patient music.');
        const heal = Math.round(h.maxHp * (0.30 + (lv - 1) * 0.08));
        this._cast(def.color, () => {
          h.hp = Math.min(h.maxHp, h.hp + heal);
          this._text(this.hero.pos, '+' + heal, def.color);
          this._burst(this.hero.pos, def.color, 18, 2);
          game.audio.heal();
        }, true);
        break;
      }
      case 'stone': {
        this._log('Stoneward — shoulders of the Architects.');
        const shield = Math.round(h.maxHp * (0.40 + (lv - 1) * 0.15));
        this._cast(def.color, () => {
          h.shield = shield;
          this._text(this.hero.pos, '⛨ ' + shield, def.color);
          this._burst(this.hero.pos, def.color, 14, 1.6);
        }, true);
        break;
      }
      case 'storm': {
        const hits = 2 + Math.min(3, lv);
        this._log('Stormcall — ' + hits + ' bolts answer.');
        let done = 0;
        const bolt = () => {
          hit(0.5 + (lv - 1) * 0.08, def.color);
          if (this.foeData.hp <= 0) { this._afterPlayerHit(); return; }
          if (++done < hits) this.queue.push({ wait: 0.28, fn: bolt });
          else this.queue.push({ wait: 0.3, fn: () => this._afterPlayerHit() });
        };
        this._cast(def.color, bolt, false, true);
        break;
      }
      case 'frost':
        this._log('Frostbite — the cold stops being cruel for you alone.');
        this._cast(def.color, () => {
          hit(0.9 + (lv - 1) * 0.15, def.color);
          this.foeData.atkDown = 2;
          this.foeData.atkDownF = 0.25 + (lv - 1) * 0.05;
        });
        break;
      case 'dusk':
        this._log('Duskveil — you wear the dark as a cloak.');
        this._cast(def.color, () => {
          h.dodge = 1.2 + (lv - 1) * 0.25;
          this._text(this.hero.pos, 'veiled', def.color);
          this._burst(this.hero.pos, def.color, 16, 1.4);
        }, true);
        break;
      case 'dawn':
        this._log('DAWNSTRIKE — an honest sunrise, delivered by hand.');
        this.scene.flash = 0.6;
        this._lunge(this.hero, foeP, () => hit(2.4 + (lv - 1) * 0.4, def.color, true), () => this._afterPlayerHit());
        break;
      case 'orun':
        this._log('ARCHITECT’S HAND — what was broken, mends.');
        this.scene.flash = 0.7;
        h.hp = h.maxHp;
        this._text(this.hero.pos, 'mended', def.color);
        this._burst(this.hero.pos, def.color, 26, 3);
        game.audio.heal();
        this._lunge(this.hero, foeP, () => hit(3.0, def.color, true, true), () => this._afterPlayerHit());
        break;
    }
  },

  /** Generic cast: sparkle, resolve, then pass the turn — unless the
      skill (storm) schedules its own continuation. */
  _cast(col, resolve, selfOnly, manual) {
    this._burst(this.hero.pos, col, 10, 1.2);
    this.queue.push({ wait: 0.45, fn: () => { resolve(); } });
    if (!manual) {
      this.queue.push({ wait: selfOnly ? 0.5 : 0.55, fn: () => { if (this.phase === 'acting') this._afterPlayerHit(); } });
    }
  },

  _afterPlayerHit() {
    if (this.phase !== 'acting') return;
    if (this.foeData.hp <= 0) { this._foeDies(); return; }
    this.queue.push({ wait: 0.55, fn: () => this._enemyTurn() });
  },

  /* ---------------- the foe ---------------- */

  _enemyTurn() {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    const f = this.foeData;
    const h = game.hero;
    if (f.stoneskin > 0) f.stoneskin--;      // Stone Guardian holds its guard
    else this.guard = false;

    // wounded Guardians fight with their shard's nature, once
    if (f.guardian && !f.sigUsed && f.hp < f.maxHp * 0.55) {
      f.sigUsed = true;
      this._signature(f, h);
      return;
    }

    let move = 'attack';
    const roll = Math.random();
    if (this.charge) move = 'heavy';
    else if (roll < 0.14) move = 'guard';
    else if (roll < 0.27 && !f.guardian) move = 'charge';
    else if (roll < 0.27 && f.guardian) move = 'heavy';
    else if (f.hp < f.maxHp * 0.3 && roll < 0.45) move = 'devour';

    const atkNow = f.atk * (f.atkDown > 0 ? (1 - (f.atkDownF || 0.25)) : 1);
    if (f.atkDown > 0) f.atkDown--;

    const strikeHero = (mult, label) => {
      this._lunge(this.foe, this.hero.pos, () => {
        if (h.dodge > 0) {
          this._text(this.hero.pos, 'evaded', '#c46bd6');
          const counter = Math.max(1, Math.round(h.atk * h.dodge));
          h.dodge = 0;
          this.queue.push({
            wait: 0.4, fn: () => {
              f.hp = Math.max(0, f.hp - counter);
              this._text(this.foe.pos, counter + '', '#c46bd6');
              this._burst(this.foe.pos, '#c46bd6', 16, 3);
              game.audio.hit(false);
              if (f.hp <= 0) this._foeDies();
            },
          });
          return;
        }
        let dmg = Math.max(1, Math.round(atkNow * mult * (0.9 + Math.random() * 0.2)));
        if (h.shield > 0) {
          const absorbed = Math.min(h.shield, dmg);
          h.shield -= absorbed;
          dmg -= absorbed;
          this._text(this.hero.pos, '⛨', '#cdab6e');
        }
        if (dmg > 0) {
          h.hp = Math.max(0, h.hp - dmg);
          this._text(this.hero.pos, dmg + '', mult > 1.5 ? '#ff6a6a' : '#fff', mult > 1.5);
          this._burst(this.hero.pos, '#d66', mult > 1.5 ? 24 : 12, mult > 1.5 ? 3.5 : 2.2);
          this.scene.shake = mult > 1.5 ? 0.55 : 0.3;
          game.audio.hit(mult > 1.5);
        }
        if (label) this._log(label);
      }, () => {
        if (h.hp <= 0) this._heroDies();
        else this.queue.push({ wait: 0.4, fn: () => this._beginPlayerTurn() });
      });
    };

    if (move === 'attack') {
      this._log('The ' + f.name + ' strikes.');
      strikeHero(1);
    } else if (move === 'heavy') {
      this.charge = false;
      this._log('The gathered darkness breaks over you!');
      strikeHero(2.1);
    } else if (move === 'charge') {
      this.charge = true;
      this._burst(this.foe.pos, '#41355c', 22, 1.2);
      this._log('The ' + f.name + ' gathers darkness…');
      this.queue.push({ wait: 0.9, fn: () => this._beginPlayerTurn() });
    } else if (move === 'guard') {
      this.guard = true;
      this._text(this.foe.pos, 'guarding', '#9aa');
      this._log('The ' + f.name + ' hardens like old grief.');
      this.queue.push({ wait: 0.9, fn: () => this._beginPlayerTurn() });
    } else {  // devour
      const heal = Math.round(f.maxHp * 0.14);
      f.hp = Math.min(f.maxHp, f.hp + heal);
      this._text(this.foe.pos, '+' + heal, '#8fd47a');
      this._log('The ' + f.name + ' drinks the dark and knits itself together.');
      this.queue.push({ wait: 0.9, fn: () => this._beginPlayerTurn() });
    }
  },

  /** Each Guardian's signature move, keyed to its shard. */
  _signature(f, h) {
    const key = this.opts.guardianOf.shard.key;
    const col = this.opts.guardianOf.shard.color;
    this._burst(this.foe.pos, col, 26, 2.2);
    switch (key) {
      case 'dawn':
        h.blind = 1;
        this._log('Blinding radiance! Your next blow will land half-seen.');
        break;
      case 'tide': {
        const heal = Math.round(f.maxHp * 0.25);
        f.hp = Math.min(f.maxHp, f.hp + heal);
        this._text(this.foe.pos, '+' + heal, col);
        this._log('The tide pours back into its wounds.');
        break;
      }
      case 'stone':
        this.guard = true;
        f.stoneskin = 2;
        this._text(this.foe.pos, 'stoneskin', col);
        this._log('Its hide turns to mountainside — your blows will glance for a time.');
        break;
      case 'storm':
        this.charge = true;
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
        this._text(this.foe.pos, 'veiled', col);
        this._log('It steps halfway out of the world. Your next blow will find nothing.');
        break;
    }
    this.queue.push({ wait: 1.0, fn: () => this._beginPlayerTurn() });
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
      this.queue.push({ wait: 0.6, fn: () => this._enemyTurn() });
    }
  },

  /* ---------------- endings ---------------- */

  _foeDies() {
    this.phase = 'victory';
    this.queue = [];
    this._buildActions();
    const f = this.foeData;
    this._log('The ' + f.name + ' comes apart into harmless dark.');
    this._burst(this.foe.pos, f.color, 40, 4.5);
    this._burst(this.foe.pos, '#ffffff', 20, 3);
    this.scene.shake = 0.6;
    game.audio.fanfare();
    this.tween(0.9, (k) => { this.foe.alpha = 1 - k; this.foe.offset = [0, k * 1.5, 0]; });
    this.queue.push({ wait: 1.2, fn: () => this._victory() });
  },

  _victory() {
    const h = game.hero;
    const f = this.foeData;
    h.battlesWon++;
    h.xp += f.xp;
    this._text([0, 0.5, 0], '+' + f.xp + ' light', '#e8c66a', true);

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
          // the rift is not done with you
          h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * 0.3));
          this.start({
            level: this.opts.level + 1,
            gauntlet: this.opts.gauntlet - 1,
            rift: this.opts.rift,
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

    // shuffle, take 3
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
    this.phase = 'defeat';
    this.queue = [];
    this._buildActions();
    this._log('The dark takes you — but the Hearth refuses to let go.');
    this.tween(1.1, (k) => { this.hero.alpha = 1 - k; this.heroOrbit.alpha = 1 - k; });
    this.queue.push({ wait: 1.6, fn: () => this.end(false) });
  },

  /* ---------------- per-frame ---------------- */

  update(dt) {
    const s = this.scene;
    s.time += dt;
    s.shake = Math.max(0, s.shake - dt * 1.8);
    s.flash = Math.max(0, s.flash - dt * 1.6);
    s.cam.angle = 2.0 + Math.sin(s.time * 0.1) * 0.32;

    // script queue
    if (this.queue.length) {
      this.queue[0].wait -= dt;
      if (this.queue[0].wait <= 0) {
        const step = this.queue.shift();
        step.fn();
        if (this.phase === 'player') this._buildActions();
      }
    }
    // tweens
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
    // idle motion
    this.hero.bob = Math.sin(s.time * 1.8) * 0.06;
    this.foe.bob = Math.sin(s.time * 1.5 + 2) * 0.12 + (this.foeData.guardian ? 0.15 : 0.4);
    this.heroOrbit.pos = this.hero.pos;
    this.heroOrbit.rot = s.time * 1.4;
    this.heroOrbit.bob = this.hero.bob;

    // particles
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

    this._updateBars();
  },

  _updateBars() {
    const f = this.foeData, h = game.hero;
    document.getElementById('b-foe-fill').style.width =
      Math.max(0, (f.hp / f.maxHp) * 100) + '%';
    document.getElementById('b-hero-fill').style.width =
      Math.max(0, (h.hp / h.maxHp) * 100) + '%';
    document.getElementById('b-hero-sub').textContent =
      Math.ceil(h.hp) + ' / ' + h.maxHp +
      (h.shield > 0 ? '  ⛨' + Math.ceil(h.shield) : '') +
      (h.dodge > 0 ? '  veiled' : '');
    document.getElementById('b-foe-sub').textContent =
      Math.ceil(f.hp) + ' / ' + f.maxHp +
      (f.burn > 0 ? '  🔥' + f.burn : '') +
      (f.atkDown > 0 ? '  ❄' : '');
  },

  render() {
    B3D.render(this.ctx, this.canvas.width, this.canvas.height, this.scene);
  },
};
