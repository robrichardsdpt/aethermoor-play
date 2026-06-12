/* The Wayfarer: movement, stamina, swimming, and collision against
   the world's walk factors. Positions are in pixels; tiles are TILE px. */
'use strict';

class Player {
  constructor(world) {
    this.world = world;
    this.x = (world.spawn.x + 0.5) * TILE;
    this.y = (world.spawn.y + 0.5) * TILE;
    this.stamina = 1;
    this.facing = 0;          // radians, for the cloak
    this.moving = false;
    this.sprinting = false;
    this.baseSpeed = 4.8 * TILE;
  }

  get tileX() { return Math.floor(this.x / TILE); }
  get tileY() { return Math.floor(this.y / TILE); }

  biome() { return this.world.biomeAt(this.tileX, this.tileY); }

  inWater() {
    const b = this.biome();
    return b === 'deep' || b === 'shallow';
  }

  /** Walk factor at a position, reshaped by any Shard Boons held. */
  walkAt(x, y) {
    let w = this.world.walkFactor(x, y);
    const b = this.world.biomeAt(Math.floor(x), Math.floor(y));
    if (hasBoon('stone')) {                    // Stonestride: the peaks open
      if (b === 'peak') w = Math.max(w, 0.45);
      else if (b === 'rock') w = Math.max(w, 0.85);
    }
    if (hasBoon('tide') && (b === 'deep' || b === 'shallow')) w = Math.max(w, 0.95);
    if (hasBoon('frost') && b === 'shallow') w = Math.max(w, 1.0);
    return w;
  }

  update(dt, keys) {
    let dx = 0, dy = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    if (typeof TouchUI !== 'undefined' && TouchUI.active) {
      dx += TouchUI.vec.x;
      dy += TouchUI.vec.y;
    }

    this.moving = Math.hypot(dx, dy) > 0.01;
    if (this.moving) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      this.facing = Math.atan2(dy, dx);
    }

    const wantSprint = (keys.has('ShiftLeft') || keys.has('ShiftRight') ||
      (typeof TouchUI !== 'undefined' && TouchUI.sprint)) && this.moving;
    this.sprinting = wantSprint && this.stamina > 0.02;

    const walk = this.walkAt(this.x / TILE, this.y / TILE) || 0.5;
    const sprintMult = hasBoon('storm') ? 2.25 : 1.65;     // Stormstep
    let speed = this.baseSpeed * walk * (this.sprinting ? sprintMult : 1);
    if (hasRelic('wind-band')) speed *= 1.12;              // the Restless Wind
    const swimming = this.inWater();
    if (swimming && this.stamina <= 0.02 && !hasBoon('tide')) speed *= 0.6;
    if (hasBoon('dusk') && typeof daylight === 'function' && daylight() < 0.4) {
      speed *= 1.15;                                       // Duskcloak: swift in the dark
    }

    if (this.moving) {
      const nx = this.x + dx * speed * dt;
      const ny = this.y + dy * speed * dt;
      if (this.walkAt(nx / TILE, this.y / TILE) > 0) this.x = nx;
      if (this.walkAt(this.x / TILE, ny / TILE) > 0) this.y = ny;
    }

    let drain = 0;
    if (this.sprinting) drain += hasBoon('ember') ? 0.11 : 0.22;   // Emberheart
    if (swimming && !hasBoon('tide')) drain += 0.10;               // Tidewalker
    if (drain > 0 && this.moving) {
      this.stamina = Math.max(0, this.stamina - drain * dt);
    } else {
      let regen = hasBoon('ember') ? 0.34 : 0.16;
      if (hasRelic('ember-core')) regen *= 1.35;           // the Emberheart Coal
      this.stamina = Math.min(1, this.stamina + regen * dt);
    }

    // boon trails, drawn by the overworld renderer
    if (typeof game !== 'undefined' && this.moving) {
      if (hasBoon('frost') && swimming && Math.random() < dt * 14) {
        game.iceTrail.push({ x: this.x, y: this.y, life: 3.5 });
      }
      if (hasBoon('storm') && this.sprinting && Math.random() < dt * 26) {
        game.sparks.push({
          x: this.x + (Math.random() - 0.5) * 10,
          y: this.y + 4 + (Math.random() - 0.5) * 6,
          life: 0.5 + Math.random() * 0.3,
        });
      }
    }
  }

  draw(ctx, sx, sy, time) {
    const bob = this.moving ? Math.sin(time * 11) * 1.5 : Math.sin(time * 2) * 0.6;
    const swimming = this.inWater();

    if (swimming) {
      ctx.strokeStyle = 'rgba(220,240,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 4, 11 + Math.sin(time * 5) * 2, 5, 0, 0, 7);
      ctx.stroke();
    }

    // aura: grows brighter as the Wayfarer evolves
    const tier = (typeof game !== 'undefined' && game.hero) ? tierOf(game.hero.level) : 0;
    const tc = B3D.hexRGB(TIERS[tier].color);
    const r = 26 + tier * 7;
    const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, r);
    glow.addColorStop(0, 'rgba(' + tc[0] + ',' + tc[1] + ',' + tc[2] + ',' + (0.25 + tier * 0.07) + ')');
    glow.addColorStop(1, 'rgba(' + tc[0] + ',' + tc[1] + ',' + tc[2] + ',0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    if (tier >= 2) {
      // orbiting motes for the shardborn and beyond
      for (let i = 0; i < tier; i++) {
        const a = time * 2 + (i / tier) * Math.PI * 2;
        ctx.fillStyle = 'rgba(' + tc[0] + ',' + tc[1] + ',' + tc[2] + ',0.8)';
        ctx.beginPath();
        ctx.arc(sx + Math.cos(a) * 13, sy - 4 + Math.sin(a) * 5, 1.6, 0, 7);
        ctx.fill();
      }
    }

    // cloak
    ctx.fillStyle = '#2c2438';
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy + 7 + bob * 0.3);
    ctx.quadraticCurveTo(sx, sy - 9 + bob, sx + 6, sy + 7 + bob * 0.3);
    ctx.closePath();
    ctx.fill();

    // head + hood
    ctx.fillStyle = '#453a5c';
    ctx.beginPath();
    ctx.arc(sx, sy - 6 + bob, 4.5, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#e8d6b0';
    ctx.beginPath();
    ctx.arc(sx, sy - 5 + bob, 2.2, 0, 7);
    ctx.fill();
  }
}
