/* The broken lands of Aethermoor: an infinite, seeded, chunked world.
   Terrain is a pure function of (x, y, seed); chunks are rendered to
   offscreen canvases and cached. */
'use strict';

const TILE = 16;            // px per tile
const CHUNK = 32;           // tiles per chunk side
const CHUNK_PX = TILE * CHUNK;

const BIOMES = {
  deep:    { rgb: [13, 38, 70],    walk: 0.32, name: 'the Endless Deep' },
  shallow: { rgb: [27, 76, 110],   walk: 0.55, name: 'the Shallows' },
  sand:    { rgb: [203, 182, 122], walk: 0.90, name: 'the Pale Shores' },
  grass:   { rgb: [104, 150, 76],  walk: 1.00, name: 'the Verdant Plains' },
  savanna: { rgb: [165, 160, 80],  walk: 1.00, name: 'the Gold Savanna' },
  forest:  { rgb: [60, 108, 56],   walk: 0.85, name: 'the Eldwood' },
  jungle:  { rgb: [36, 90, 48],    walk: 0.75, name: 'the Verdigris Tangle' },
  desert:  { rgb: [214, 175, 106], walk: 0.85, name: 'the Ashen Expanse' },
  swamp:   { rgb: [66, 88, 58],    walk: 0.60, name: 'the Mirewald' },
  tundra:  { rgb: [148, 155, 138], walk: 0.90, name: 'the Grey Wastes' },
  snow:    { rgb: [224, 230, 235], walk: 0.80, name: 'the Frostveil' },
  rock:    { rgb: [118, 114, 110], walk: 0.65, name: 'the Broken Crags' },
  peak:    { rgb: [198, 202, 210], walk: 0,    name: 'the Worldspine' },
  dais:    { rgb: [165, 155, 136], walk: 1.00, name: 'an Ancient Dais' },
};

const LAND_BIOMES = new Set(['grass', 'savanna', 'forest', 'jungle', 'desert',
  'tundra', 'snow', 'sand']);

class World {
  constructor(seed) {
    this.seed = seed | 0;
    this.chunkCanvases = new Map();   // "cx,cy" -> canvas (LRU-capped)
    this.chunkOrder = [];
    this.avgColors = new Map();       // "cx,cy" -> [r,g,b]
    this.poiCache = new Map();        // "cx,cy" -> array of POIs
    this.sanctums = this._placeSanctums();
    this.spawn = this._findLand(0, 0, 400) || { x: 0, y: 0 };
  }

  /* ---------------- terrain ---------------- */

  elevation(x, y) {
    const e = fbm(x / 240, y / 240, this.seed, 5);
    const ridge = 1 - Math.abs(2 * fbm(x / 190, y / 190, this.seed + 555, 4) - 1);
    return stretch(e, 1.8) * 0.8 + ridge * ridge * 0.30;
  }

  temperature(x, y) {
    return stretch(fbm(x / 700, y / 700, this.seed + 9001, 3), 1.6);
  }

  moisture(x, y) {
    return stretch(fbm(x / 320, y / 320, this.seed + 4242, 4), 1.5);
  }

  baseBiomeAt(x, y) {
    const e = this.elevation(x, y);
    if (e < 0.34) return 'deep';
    if (e < 0.42) return 'shallow';
    if (e < 0.455) return 'sand';
    if (e > 0.86) return 'peak';
    if (e > 0.76) return 'rock';
    const t = this.temperature(x, y);
    const m = this.moisture(x, y);
    if (t < 0.32) return m > 0.55 ? 'snow' : 'tundra';
    if (t > 0.68) {
      if (m < 0.34) return 'desert';
      if (m > 0.66) return 'jungle';
      return 'savanna';
    }
    if (m > 0.78) return 'swamp';
    if (m > 0.48) return 'forest';
    return 'grass';
  }

  /** Biome including the stone dais carved around each shard sanctum. */
  biomeAt(x, y) {
    for (const s of this.sanctums) {
      const dx = x - s.x, dy = y - s.y;
      if (dx * dx + dy * dy <= 22) return 'dais';
    }
    return this.baseBiomeAt(x, y);
  }

  walkFactor(x, y) {
    return BIOMES[this.biomeAt(Math.floor(x), Math.floor(y))].walk;
  }

  /* ---------------- placement helpers ---------------- */

  /** Spiral outward from (x, y) for the nearest comfortable land tile. */
  _findLand(x, y, maxR) {
    if (LAND_BIOMES.has(this.baseBiomeAt(x, y))) return { x, y };
    for (let r = 4; r <= maxR; r += 4) {
      const steps = Math.max(8, Math.floor(r * 0.8));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const tx = Math.round(x + Math.cos(a) * r);
        const ty = Math.round(y + Math.sin(a) * r);
        if (LAND_BIOMES.has(this.baseBiomeAt(tx, ty))) return { x: tx, y: ty };
      }
    }
    return null;
  }

  /** The seven sanctums ring the spawn at deterministic bearings. */
  _placeSanctums() {
    const rand = mulberry32(this.seed ^ 0x5EED);
    const baseAngle = rand() * Math.PI * 2;
    const out = [];
    for (let i = 0; i < 7; i++) {
      const angle = baseAngle + (i / 7) * Math.PI * 2 + (rand() - 0.5) * 0.4;
      const radius = 240 + i * 60 + rand() * 40;
      const ix = Math.round(Math.cos(angle) * radius);
      const iy = Math.round(Math.sin(angle) * radius);
      const pos = this._findLand(ix, iy, 200) || { x: ix, y: iy };
      const shard = LORE.SHARDS[i];
      out.push({
        type: 'sanctum',
        id: 'sanctum:' + shard.key,
        x: pos.x, y: pos.y,
        shard,
        name: 'Sanctum of the ' + shard.name,
      });
    }
    return out;
  }

  /* ---------------- points of interest ---------------- */

  poisInChunk(cx, cy) {
    const key = cx + ',' + cy;
    let pois = this.poiCache.get(key);
    if (pois) return pois;
    pois = [];
    const rand = mulberry32(hash2i(cx, cy, this.seed ^ 0x51F7));
    this._tryPlace(pois, rand, cx, cy, 0.10, (x, y, r) => {
      const idx = hash2i(x, y, this.seed ^ 0xF1A6) % LORE.FRAGMENTS.length;
      return {
        type: 'monolith', id: 'monolith:' + x + ',' + y, x, y,
        fragment: idx,
        name: 'Monolith — Fragment ' + romanNumeral(idx + 1),
      };
    });
    this._tryPlace(pois, rand, cx, cy, 0.08, (x, y, r) => ({
      type: 'ruin', id: 'ruin:' + x + ',' + y, x, y,
      name: 'Ruins of ' + nameRuin(r),
      line: LORE.RUIN_LINES[(r() * LORE.RUIN_LINES.length) | 0],
    }));
    this._tryPlace(pois, rand, cx, cy, 0.05, (x, y, r) => ({
      type: 'waystone', id: 'waystone:' + x + ',' + y, x, y,
      name: nameWaystone(r),
    }));
    this._tryPlace(pois, rand, cx, cy, 0.07, (x, y, r) => ({
      type: 'cache', id: 'cache:' + x + ',' + y, x, y,
      name: 'Architect’s Cache',
    }));
    this.poiCache.set(key, pois);
    return pois;
  }

  _tryPlace(pois, rand, cx, cy, prob, make) {
    if (rand() >= prob) return;
    for (let attempt = 0; attempt < 6; attempt++) {
      const x = cx * CHUNK + ((rand() * CHUNK) | 0);
      const y = cy * CHUNK + ((rand() * CHUNK) | 0);
      const b = this.biomeAt(x, y);
      if (LAND_BIOMES.has(b)) { pois.push(make(x, y, rand)); return; }
    }
  }

  /** All POIs (including sanctums) within `r` chunks of a tile position. */
  poisNear(tx, ty, r) {
    const ccx = Math.floor(tx / CHUNK), ccy = Math.floor(ty / CHUNK);
    const out = [];
    for (let cy = ccy - r; cy <= ccy + r; cy++)
      for (let cx = ccx - r; cx <= ccx + r; cx++)
        out.push(...this.poisInChunk(cx, cy));
    for (const s of this.sanctums) {
      if (Math.abs(s.x - tx) < (r + 1) * CHUNK && Math.abs(s.y - ty) < (r + 1) * CHUNK)
        out.push(s);
    }
    return out;
  }

  /* ---------------- chunk rendering ---------------- */

  chunkCanvas(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.chunkCanvases.get(key);
    if (c) return c;
    c = this._renderChunk(cx, cy, key);
    this.chunkCanvases.set(key, c);
    this.chunkOrder.push(key);
    if (this.chunkOrder.length > 90) {
      this.chunkCanvases.delete(this.chunkOrder.shift());
    }
    return c;
  }

  _renderChunk(cx, cy, key) {
    const c = document.createElement('canvas');
    c.width = c.height = CHUNK_PX;
    const g = c.getContext('2d');
    let ar = 0, ag = 0, ab = 0;
    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        const wx = cx * CHUNK + tx, wy = cy * CHUNK + ty;
        const biome = this.biomeAt(wx, wy);
        const def = BIOMES[biome];
        const v = 1 + (hash2(wx, wy, this.seed ^ 0xA53) - 0.5) * 0.14;
        const r = Math.min(255, def.rgb[0] * v) | 0;
        const gg = Math.min(255, def.rgb[1] * v) | 0;
        const b = Math.min(255, def.rgb[2] * v) | 0;
        g.fillStyle = 'rgb(' + r + ',' + gg + ',' + b + ')';
        g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        ar += def.rgb[0]; ag += def.rgb[1]; ab += def.rgb[2];
        this._decorate(g, biome, wx, wy, tx * TILE, ty * TILE);
      }
    }
    const n = CHUNK * CHUNK;
    this.avgColors.set(key, [(ar / n) | 0, (ag / n) | 0, (ab / n) | 0]);
    return c;
  }

  _decorate(g, biome, wx, wy, px, py) {
    const h = hash2(wx, wy, this.seed ^ 0x7B0);
    const h2 = hash2(wx, wy, this.seed ^ 0x3C9);
    const ox = px + 4 + h2 * 8, oy = py + 4 + h * 8;
    switch (biome) {
      case 'forest': case 'jungle':
        if (h < 0.55) {
          g.fillStyle = biome === 'forest' ? 'rgba(28,62,30,0.85)' : 'rgba(18,52,26,0.85)';
          g.beginPath(); g.arc(ox, oy, 4.5, 0, 7); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.06)';
          g.beginPath(); g.arc(ox - 1, oy - 1.5, 2, 0, 7); g.fill();
        }
        break;
      case 'grass': case 'savanna':
        if (h < 0.12) {
          g.fillStyle = 'rgba(255,255,220,0.18)';
          g.fillRect(ox, oy, 2, 2);
        }
        break;
      case 'deep': case 'shallow':
        if (h < 0.08) {
          g.fillStyle = 'rgba(255,255,255,0.10)';
          g.fillRect(px + 3, oy, 9, 1.5);
        }
        break;
      case 'rock': case 'peak':
        if (h < 0.3) {
          g.fillStyle = h2 < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.16)';
          g.fillRect(ox, oy, 3, 3);
        }
        break;
      case 'swamp':
        if (h < 0.2) {
          g.fillStyle = 'rgba(20,34,30,0.5)';
          g.beginPath(); g.ellipse(ox, oy, 5, 3, 0, 0, 7); g.fill();
        }
        break;
      case 'snow': case 'tundra':
        if (h < 0.1) {
          g.fillStyle = 'rgba(255,255,255,0.35)';
          g.fillRect(ox, oy, 2, 2);
        }
        break;
      case 'desert':
        if (h < 0.1) {
          g.strokeStyle = 'rgba(140,100,50,0.3)';
          g.beginPath(); g.moveTo(px + 2, oy); g.quadraticCurveTo(px + 8, oy - 3, px + 14, oy); g.stroke();
        }
        break;
      case 'dais':
        g.strokeStyle = 'rgba(60,50,40,0.25)';
        g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        break;
    }
  }

  /** Average chunk color for maps, even if the chunk canvas was evicted. */
  chunkAverage(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.avgColors.get(key);
    if (c) return c;
    let ar = 0, ag = 0, ab = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const rgb = BIOMES[this.biomeAt(cx * CHUNK + 4 + i * 8, cy * CHUNK + 4 + j * 8)].rgb;
        ar += rgb[0]; ag += rgb[1]; ab += rgb[2];
      }
    }
    c = [(ar / 16) | 0, (ag / 16) | 0, (ab / 16) | 0];
    this.avgColors.set(key, c);
    return c;
  }
}
