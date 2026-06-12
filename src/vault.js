/* The Vaults: chambers of the Vessel, folded down under the world and
   still humming. A separate game mode — finite procedurally generated
   interiors with patrolling Custodians, void snares, braziers, sealed
   chests, and a guarded Core at the heart. */
'use strict';

const VSIZE = 46;          // vault grid is VSIZE x VSIZE tiles

const Vault = {
  active: false,
  grid: null,              // Uint8Array: 0 wall, 1 floor
  explored: null,
  rooms: [],
  braziers: [],
  chests: [],
  snares: [],
  wardens: [],
  core: null,
  name: '',
  doorPoi: null,
  entrance: null,          // {x, y} tile
  menace: 1,
  cleared: false,
  returnPos: null,         // overworld px to restore on exit
  canvas: null,
  hurt: 0,
  grace: 0,

  /* ---------------- world adapter (the player walks our grid) ------- */

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= VSIZE || ty >= VSIZE) return 0;
    return this.grid[ty * VSIZE + tx];
  },

  adapter: {
    walkFactor(x, y) { return Vault.tileAt(Math.floor(x), Math.floor(y)) ? 1 : 0; },
    biomeAt(tx, ty) { return Vault.tileAt(tx, ty) ? 'vfloor' : 'vwall'; },
  },

  /* ---------------- generation ---------------- */

  enter(doorPoi) {
    const seed = hash2i(doorPoi.x, doorPoi.y, game.world.seed ^ 0x7A17);
    const rand = mulberry32(seed);
    this.doorPoi = doorPoi;
    this.name = doorPoi.name;
    this.menace = menaceAt(doorPoi.x, doorPoi.y) + 1;
    this.cleared = false;
    this.hurt = 0;
    this.grace = 1.5;
    this.grid = new Uint8Array(VSIZE * VSIZE);
    this.explored = new Uint8Array(VSIZE * VSIZE);

    // carve rooms
    this.rooms = [];
    for (let tries = 0; tries < 60 && this.rooms.length < 8; tries++) {
      const w = 5 + ((rand() * 5) | 0), h = 5 + ((rand() * 5) | 0);
      const x = 2 + ((rand() * (VSIZE - w - 4)) | 0);
      const y = 2 + ((rand() * (VSIZE - h - 4)) | 0);
      let clash = false;
      for (const r of this.rooms) {
        if (x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) {
          clash = true; break;
        }
      }
      if (clash) continue;
      this.rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), lit: false });
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) this.grid[yy * VSIZE + xx] = 1;
    }
    // corridors join each room to the next
    for (let i = 0; i + 1 < this.rooms.length; i++) {
      const a = this.rooms[i], b = this.rooms[i + 1];
      const x0 = Math.min(a.cx, b.cx), x1 = Math.max(a.cx, b.cx);
      const y0 = Math.min(a.cy, b.cy), y1 = Math.max(a.cy, b.cy);
      for (let x = x0; x <= x1; x++) this.grid[a.cy * VSIZE + x] = 1;
      for (let y = y0; y <= y1; y++) this.grid[y * VSIZE + b.cx] = 1;
    }

    // entrance room and the heart (farthest room)
    const ent = this.rooms[0];
    this.entrance = { x: ent.cx, y: ent.cy };
    let heart = this.rooms[1] || ent;
    let bestD = 0;
    for (const r of this.rooms.slice(1)) {
      const d = Math.hypot(r.cx - ent.cx, r.cy - ent.cy);
      if (d > bestD) { bestD = d; heart = r; }
    }
    this.heart = heart;
    this.core = { x: heart.cx, y: heart.cy, claimed: false, primeDown: false };

    // furniture
    this.braziers = [];
    this.chests = [];
    this.snares = [];
    this.wardens = [];
    for (const r of this.rooms) {
      if (r !== ent && rand() < 0.8) {
        this.braziers.push({
          x: r.x + 1 + ((rand() * (r.w - 2)) | 0),
          y: r.y + 1 + ((rand() * (r.h - 2)) | 0), lit: false, room: r,
        });
      }
    }
    const lootRooms = this.rooms.filter((r) => r !== ent && r !== heart);
    for (let i = 0; i < Math.min(2, lootRooms.length); i++) {
      const r = lootRooms[(rand() * lootRooms.length) | 0];
      this.chests.push({
        x: r.x + 1 + ((rand() * (r.w - 2)) | 0),
        y: r.y + 1 + ((rand() * (r.h - 2)) | 0), opened: false,
      });
    }
    for (let placed = 0, tries = 0; placed < 7 && tries < 120; tries++) {
      const x = (rand() * VSIZE) | 0, y = (rand() * VSIZE) | 0;
      if (!this.tileAt(x, y)) continue;
      if (Math.hypot(x - ent.cx, y - ent.cy) < 6) continue;
      if (Math.hypot(x - heart.cx, y - heart.cy) < 3) continue;
      this.snares.push({ x, y, cd: 0 });
      placed++;
    }
    const patrolRooms = this.rooms.filter((r) => r !== ent);
    for (let i = 0; i < Math.min(3, patrolRooms.length); i++) {
      const a = patrolRooms[(rand() * patrolRooms.length) | 0];
      const b = patrolRooms[(rand() * patrolRooms.length) | 0];
      this.wardens.push({
        x: (a.cx + 0.5) * TILE, y: (a.cy + 0.5) * TILE,
        ax: a.cx, ay: a.cy, bx: b.cx, by: b.cy,
        toB: true, wob: rand() * 7,
      });
    }

    this._renderBase(seed);

    // step through
    this.returnPos = { x: game.player.x, y: game.player.y };
    game.player.world = this.adapter;
    game.player.x = (ent.cx + 0.5) * TILE;
    game.player.y = (ent.cy + 0.5) * TILE;
    this.active = true;
    game.mode = 'vault';
    game.audio.ensure();
    game.audio.battleStart();
    UI.banner(this.name.toUpperCase(),
      LORE.VAULT_ENTER[hash2i(doorPoi.x, doorPoi.y, 99) % LORE.VAULT_ENTER.length], 5600);
    UI.prompt(null);
  },

  /** Leave through the door (or get thrown out by defeat). */
  leave() {
    this.active = false;
    game.player.world = game.world;
    game.player.x = this.returnPos.x;
    game.player.y = this.returnPos.y;
    game.mode = 'playing';
    game.battleGrace = 3;
    saveGame();
  },

  abandon() {           // defeat inside: the dark drags you all the way home
    this.active = false;
    game.player.world = game.world;
  },

  /* ---------------- pre-rendered floor ---------------- */

  _renderBase(seed) {
    const c = document.createElement('canvas');
    c.width = c.height = VSIZE * TILE;
    const g = c.getContext('2d');
    g.fillStyle = '#05070d';
    g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < VSIZE; y++) {
      for (let x = 0; x < VSIZE; x++) {
        const px = x * TILE, py = y * TILE;
        const h = hash2(x, y, seed ^ 0x33);
        if (this.tileAt(x, y)) {
          const v = 1 + (h - 0.5) * 0.18;
          g.fillStyle = 'rgb(' + ((24 * v) | 0) + ',' + ((32 * v) | 0) + ',' + ((46 * v) | 0) + ')';
          g.fillRect(px, py, TILE, TILE);
          if (h < 0.07) {                       // circuitry of the Vessel
            g.strokeStyle = 'rgba(107,214,196,0.25)';
            g.beginPath();
            g.moveTo(px + 2, py + TILE / 2);
            g.lineTo(px + TILE - 2, py + TILE / 2);
            g.stroke();
            g.fillStyle = 'rgba(107,214,196,0.5)';
            g.fillRect(px + TILE - 4, py + TILE / 2 - 1, 2, 2);
          }
          g.strokeStyle = 'rgba(0,0,0,0.18)';
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        } else {
          g.fillStyle = '#0a0e18';
          g.fillRect(px, py, TILE, TILE);
          if (this.tileAt(x, y + 1)) {          // wall face above floor
            g.fillStyle = '#1c2638';
            g.fillRect(px, py + TILE - 5, TILE, 5);
            if (h < 0.18) {
              g.fillStyle = 'rgba(107,214,196,0.6)';
              g.fillRect(px + 6, py + TILE - 4, 2, 2);
            }
          }
        }
      }
    }
    this.canvas = c;
  },

  /* ---------------- per-frame ---------------- */

  update(dt) {
    this.grace = Math.max(0, this.grace - dt);
    this.hurt = Math.max(0, this.hurt - dt * 1.6);
    if (!UI.anyOpen()) game.player.update(dt, game.keys);
    game.hero.hp = Math.min(game.hero.maxHp, game.hero.hp + 1.2 * dt);

    const p = game.player;
    // reveal what the lantern shows
    const px = p.tileX, py = p.tileY;
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const x = px + dx, y = py + dy;
        if (x >= 0 && y >= 0 && x < VSIZE && y < VSIZE && dx * dx + dy * dy <= 38) {
          this.explored[y * VSIZE + x] = 1;
        }
      }
    }

    // custodians walk their rounds — and yours, if they see you
    if (!this.cleared && !UI.anyOpen()) {
      for (const w of this.wardens) {
        const dxp = p.x - w.x, dyp = p.y - w.y;
        const distP = Math.hypot(dxp, dyp) / TILE;
        let tx, ty, speed;
        if (distP < 7) { tx = p.x; ty = p.y; speed = 2.6; }
        else {
          tx = ((w.toB ? w.bx : w.ax) + 0.5) * TILE;
          ty = ((w.toB ? w.by : w.ay) + 0.5) * TILE;
          speed = 1.4;
          if (Math.hypot(tx - w.x, ty - w.y) < TILE) w.toB = !w.toB;
        }
        const d = Math.hypot(tx - w.x, ty - w.y) || 1;
        const nx = w.x + (tx - w.x) / d * speed * TILE * dt;
        const ny = w.y + (ty - w.y) / d * speed * TILE * dt;
        if (this.adapter.walkFactor(nx / TILE, w.y / TILE) > 0) w.x = nx;
        if (this.adapter.walkFactor(w.x / TILE, ny / TILE) > 0) w.y = ny;

        if (distP < 1.2 && this.grace <= 0 && game.battleGrace <= 0) {
          Battle.start({
            level: this.menace, count: 1 + (Math.random() < 0.35 ? 1 : 0),
            vault: true, warden: w,
          });
          return;
        }
      }
    }

    // void snares
    for (const s of this.snares) {
      s.cd = Math.max(0, s.cd - dt);
      if (s.cd <= 0 && p.tileX === s.x && p.tileY === s.y) {
        s.cd = 3;
        const dmg = Math.max(5, Math.round(game.hero.maxHp * 0.08));
        game.hero.hp = Math.max(1, game.hero.hp - dmg);
        p.stamina = 0;
        this.hurt = 0.6;
        addFloat('-' + dmg + '  the void snares you', '#c46bd6');
        game.audio.hit(false);
      }
    }

    for (let i = game.floats.length - 1; i >= 0; i--) {
      if ((game.floats[i].t += dt) > 1.6) game.floats.splice(i, 1);
    }
    for (let i = game.sparks.length - 1; i >= 0; i--) {
      if ((game.sparks[i].life -= dt) <= 0) game.sparks.splice(i, 1);
    }

    this._prompt();
  },

  _near(o, d) {
    return Math.hypot(o.x + 0.5 - game.player.x / TILE, o.y + 0.5 - game.player.y / TILE) < d;
  },

  _prompt() {
    if (UI.anyOpen()) { UI.prompt(null); return; }
    if (this._near(this.entrance, 1.6)) { UI.prompt('▲ E — climb back to the sky'); return; }
    if (!this.core.claimed && this._near(this.core, 2.2)) {
      UI.prompt(this.core.primeDown ? '✦ E — take the Vault Core'
        : '⚔ E — challenge the Custodian Prime');
      return;
    }
    for (const b of this.braziers) {
      if (!b.lit && this._near(b, 1.6)) { UI.prompt('E — kindle the brazier'); return; }
    }
    for (const ch of this.chests) {
      if (!ch.opened && this._near(ch, 1.6)) { UI.prompt('✶ E — break the seal'); return; }
    }
    UI.prompt(null);
  },

  interact() {
    if (this._near(this.entrance, 1.6)) { this.leave(); return; }
    if (!this.core.claimed && this._near(this.core, 2.2)) {
      if (!this.core.primeDown) {
        Battle.start({ level: this.menace + 2, elite: true, vault: true, vaultPrime: true });
      } else {
        this._claimCore();
      }
      return;
    }
    for (const b of this.braziers) {
      if (!b.lit && this._near(b, 1.6)) {
        b.lit = true;
        b.room.lit = true;
        grantLight(8 + this.menace);
        game.audio.sparkle();
        // the whole room steps out of the dark
        for (let y = b.room.y; y < b.room.y + b.room.h; y++)
          for (let x = b.room.x; x < b.room.x + b.room.w; x++)
            this.explored[y * VSIZE + x] = 1;
        return;
      }
    }
    for (const ch of this.chests) {
      if (!ch.opened && this._near(ch, 1.6)) {
        ch.opened = true;
        game.audio.discovery();
        const pool = unownedRelics();
        if (pool.length && Math.random() < 0.5) {
          grantRelic(pool[(Math.random() * pool.length) | 0]);
        } else {
          grantLight(28 + this.menace * 5);
          UI.banner('THE SEAL BREAKS', 'Provisions for a journey the Architects never took.', 4000);
        }
        return;
      }
    }
  },

  primeDefeated() {
    this.core.primeDown = true;
    UI.banner('THE CUSTODIAN PRIME FALLS', 'The pedestal unlocks with a courteous click. It was only doing its job.', 5000);
  },

  _claimCore() {
    this.core.claimed = true;
    this.cleared = true;
    this.wardens = [];
    game.state.cores++;
    game.state.clearedVaults.add(this.doorPoi.id);
    game.state.tallies.vaults = (game.state.tallies.vaults || 0) + 1;
    const h = game.hero;
    h.atk = Math.round(h.atk * 1.03 * 10) / 10;
    h.maxHp = Math.round(h.maxHp * 1.03);
    grantLight(70 + this.menace * 6);
    game.audio.fanfare();
    UI.banner('✦ VAULT CORE ' + romanNumeral(game.state.cores) + ' ✦',
      LORE.VAULT_CORE + ' Might and vitality +3%, forever.', 7000);
    const pool = unownedRelics();
    if (pool.length && Math.random() < 0.6) {
      setTimeout(() => grantRelic(pool[(Math.random() * pool.length) | 0]), 7200);
    }
    saveGame();
  },

  removeWarden(w) {
    const i = this.wardens.indexOf(w);
    if (i >= 0) this.wardens.splice(i, 1);
    this.grace = 2;
  },

  /* ---------------- rendering ---------------- */

  render(t) {
    const camX = game.player.x, camY = game.player.y;
    const ox = Math.floor(canvas.width / 2 - camX);
    const oy = Math.floor(canvas.height / 2 - camY);
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.canvas, ox, oy);

    const S = (x, y) => [(x + 0.5) * TILE + ox, (y + 0.5) * TILE + oy];

    // exit pad
    {
      const [sx, sy] = S(this.entrance.x, this.entrance.y);
      ctx.strokeStyle = 'rgba(232,198,106,' + (0.4 + Math.sin(t * 2) * 0.2).toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 10, sy - 10, 20, 20);
      ctx.fillStyle = 'rgba(232,198,106,0.7)';
      ctx.font = '10px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText('▲', sx, sy + 3);
    }
    // snares
    for (const s of this.snares) {
      const [sx, sy] = S(s.x, s.y);
      const pulse = 0.35 + Math.sin(t * 3 + s.x) * 0.2;
      ctx.strokeStyle = 'rgba(196,107,214,' + pulse.toFixed(2) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 6, sy);
      ctx.closePath(); ctx.stroke();
    }
    // braziers
    for (const b of this.braziers) {
      const [sx, sy] = S(b.x, b.y);
      ctx.fillStyle = '#3a3428';
      ctx.fillRect(sx - 4, sy - 3, 8, 7);
      if (b.lit) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(sx, sy - 7, 1, sx, sy - 7, 16);
        g.addColorStop(0, 'rgba(255,200,110,0.9)');
        g.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - 16, sy - 23, 32, 32);
        ctx.restore();
        ctx.fillStyle = '#ffd27a';
        ctx.beginPath();
        ctx.arc(sx, sy - 6 + Math.sin(t * 9) * 1, 2.6, 0, 7);
        ctx.fill();
      }
    }
    // chests
    for (const ch of this.chests) {
      const [sx, sy] = S(ch.x, ch.y);
      ctx.fillStyle = ch.opened ? '#3a3630' : '#4a4438';
      ctx.fillRect(sx - 7, sy - 5, 14, 10);
      if (!ch.opened) {
        ctx.fillStyle = 'rgba(107,214,196,' + (0.5 + Math.sin(t * 2.4) * 0.3).toFixed(2) + ')';
        ctx.fillRect(sx - 6, sy - 1, 12, 1.5);
      }
    }
    // the Core and its Custodian Prime
    if (!this.core.claimed) {
      const [sx, sy] = S(this.core.x, this.core.y);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(sx, sy - 8, 2, sx, sy - 8, 30);
      g.addColorStop(0, 'rgba(140,240,225,0.55)');
      g.addColorStop(1, 'rgba(107,214,196,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 30, sy - 38, 60, 60);
      ctx.restore();
      ctx.fillStyle = '#6bd6c4';
      const bob = Math.sin(t * 1.8) * 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 16 + bob); ctx.lineTo(sx + 5, sy - 8 + bob);
      ctx.lineTo(sx, sy + bob); ctx.lineTo(sx - 5, sy - 8 + bob);
      ctx.closePath(); ctx.fill();
      if (!this.core.primeDown) {
        // the Prime stands its eternal watch
        const wx = sx + 16, wy = sy + 6;
        ctx.fillStyle = '#141a2a';
        ctx.fillRect(wx - 7, wy - 22, 14, 26);
        ctx.fillStyle = '#0e1322';
        ctx.fillRect(wx - 10, wy - 16, 4, 16);
        ctx.fillRect(wx + 6, wy - 16, 4, 16);
        ctx.fillStyle = '#6bd6c4';
        ctx.fillRect(wx - 4, wy - 17, 3, 3);
        ctx.fillRect(wx + 1, wy - 17, 3, 3);
      }
    }
    // wardens
    for (const w of this.wardens) {
      const sx = w.x + ox, sy = w.y + oy;
      const wob = Math.sin(t * 3 + w.wob) * 1.5;
      ctx.fillStyle = '#11182a';
      ctx.fillRect(sx - 7, sy - 12 + wob, 14, 18);
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(sx - 10, sy - 6 + wob, 3, 10);
      ctx.fillRect(sx + 7, sy - 6 + wob, 3, 10);
      ctx.fillStyle = '#6bd6c4';
      ctx.fillRect(sx - 4, sy - 8 + wob, 2.5, 2.5);
      ctx.fillRect(sx + 1.5, sy - 8 + wob, 2.5, 2.5);
    }

    game.player.draw(ctx, canvas.width / 2, canvas.height / 2, t);
    drawSparks(camX, camY);
    drawFloats(camX, camY);

    /* darkness, pierced by lanterns and fire */
    lightCtx.clearRect(0, 0, canvas.width, canvas.height);
    lightCtx.fillStyle = 'rgba(4,6,16,' + (this.cleared ? 0.55 : 0.82) + ')';
    lightCtx.fillRect(0, 0, canvas.width, canvas.height);
    lightCtx.globalCompositeOperation = 'destination-out';
    const punch = (sx, sy, r, a) => {
      const g = lightCtx.createRadialGradient(sx, sy, 4, sx, sy, r);
      g.addColorStop(0, 'rgba(0,0,0,' + a + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lightCtx.fillStyle = g;
      lightCtx.fillRect(sx - r, sy - r, r * 2, r * 2);
    };
    let lr = hasBoon('dawn') ? 230 : 140;
    if (hasRelic('lantern-heart')) lr *= 1.6;
    punch(canvas.width / 2, canvas.height / 2, lr, 0.92);
    for (const b of this.braziers) {
      if (!b.lit) continue;
      const [sx, sy] = S(b.x, b.y);
      punch(sx, sy, 150, 0.85);
    }
    {
      const [sx, sy] = S(this.core.x, this.core.y);
      if (!this.core.claimed) punch(sx, sy, 110, 0.8);
    }
    {
      const [sx, sy] = S(this.entrance.x, this.entrance.y);
      punch(sx, sy, 70, 0.6);
    }
    lightCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lightCanvas, 0, 0);

    if (this.hurt > 0.02) {
      ctx.fillStyle = 'rgba(150,40,90,' + (this.hurt * 0.4).toFixed(2) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  },

  drawMinimap(mctx, W, H) {
    mctx.fillStyle = '#05070d';
    mctx.fillRect(0, 0, W, H);
    mctx.save();
    mctx.beginPath();
    mctx.arc(W / 2, H / 2, W / 2 - 2, 0, 7);
    mctx.clip();
    const s = (W - 16) / VSIZE;
    const o = 8;
    for (let y = 0; y < VSIZE; y++) {
      for (let x = 0; x < VSIZE; x++) {
        if (!this.explored[y * VSIZE + x]) continue;
        mctx.fillStyle = this.tileAt(x, y) ? '#2a3a50' : '#10141f';
        mctx.fillRect(o + x * s, o + y * s, s + 0.5, s + 0.5);
      }
    }
    if (!this.core.claimed && this.explored[this.core.y * VSIZE + this.core.x]) {
      mctx.fillStyle = '#6bd6c4';
      mctx.fillRect(o + this.core.x * s - 1.5, o + this.core.y * s - 1.5, 4, 4);
    }
    mctx.fillStyle = '#e8c66a';
    mctx.fillRect(o + this.entrance.x * s - 1.5, o + this.entrance.y * s - 1.5, 4, 4);
    mctx.fillStyle = '#fff';
    mctx.beginPath();
    mctx.arc(o + (game.player.x / TILE) * s, o + (game.player.y / TILE) * s, 2.5, 0, 7);
    mctx.fill();
    mctx.restore();
  },
};
