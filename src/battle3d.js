/* A tiny software-3D engine for the Umbra: perspective projection,
   painter-sorted flat-shaded triangles, depth fog, soft shadows, glowing
   emissive surfaces, particles, projectiles, shockwaves, slash arcs,
   a shattered moon — and procedural low-poly meshes. No libraries. */
'use strict';

const B3D = {};

/* ---------------- vectors ---------------- */

B3D.sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
B3D.add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
B3D.scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
B3D.lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
B3D.dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
B3D.cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
B3D.norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/* ---------------- color ---------------- */

B3D.hexRGB = function (hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
};
B3D.mix = function (a, b, f) {
  const A = B3D.hexRGB(a), B = B3D.hexRGB(b);
  return 'rgb(' + ((A[0] + (B[0] - A[0]) * f) | 0) + ',' + ((A[1] + (B[1] - A[1]) * f) | 0) + ',' + ((A[2] + (B[2] - A[2]) * f) | 0) + ')';
};

/* ---------------- mesh builders (lists of {v:[p,p,p], col, em, flat}) -- */

B3D.box = function (cx, cy, cz, sx, sy, sz, col, em) {
  const x = sx / 2, y = sy / 2, z = sz / 2;
  const p = [
    [cx - x, cy - y, cz - z], [cx + x, cy - y, cz - z], [cx + x, cy + y, cz - z], [cx - x, cy + y, cz - z],
    [cx - x, cy - y, cz + z], [cx + x, cy - y, cz + z], [cx + x, cy + y, cz + z], [cx - x, cy + y, cz + z],
  ];
  const quads = [
    [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0],
  ];
  const tris = [];
  for (const [a, b, c, d] of quads) {
    tris.push({ v: [p[a], p[b], p[c]], col, em });
    tris.push({ v: [p[a], p[c], p[d]], col, em });
  }
  return tris;
};

B3D.diamond = function (cx, cy, cz, r, h, col, em) {
  const top = [cx, cy + h / 2, cz], bot = [cx, cy - h / 2, cz];
  const ring = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ring.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]);
  }
  const tris = [];
  for (let i = 0; i < 4; i++) {
    const a = ring[i], b = ring[(i + 1) % 4];
    tris.push({ v: [top, b, a], col, em });
    tris.push({ v: [bot, a, b], col, em });
  }
  return tris;
};

B3D.ring = function (cy, r, w, segs, col, em) {
  const tris = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    const p = (a, rr) => [Math.cos(a) * rr, cy, Math.sin(a) * rr];
    tris.push({ v: [p(a0, r), p(a1, r), p(a1, r + w)], col, em });
    tris.push({ v: [p(a0, r), p(a1, r + w), p(a0, r + w)], col, em });
  }
  return tris;
};

B3D.disc = function (cy, r, segs, col, flat) {
  const tris = [];
  const c = [0, cy, 0];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    tris.push({
      v: [c, [Math.cos(a1) * r, cy, Math.sin(a1) * r], [Math.cos(a0) * r, cy, Math.sin(a0) * r]],
      col, flat,
    });
  }
  return tris;
};

/** Soft contact shadow: a flat dark disc, depth-sorted with the scene. */
B3D.shadowMesh = function (r) {
  return B3D.disc(0.02, r, 10, 'rgba(2,2,10,0.55)', true);
};

B3D.wing = function (side, col) {
  const s = side, tris = [];
  const root = [s * 0.35, 1.6, -0.1];
  for (let i = 0; i < 3; i++) {
    const len = 1.9 - i * 0.45, lift = 0.9 + i * 0.55;
    const tip = [s * (0.6 + len), 1.2 + lift, -0.3 - i * 0.12];
    const mid = [s * (0.5 + len * 0.5), 1.55 + lift * 0.45, -0.2];
    tris.push({ v: [root, mid, tip], col, em: true });
    tris.push({ v: [root, tip, mid], col, em: true });
  }
  return tris;
};

/* ---------------- avatar & foe meshes ---------------- */

B3D.heroMesh = function (tier) {
  const tc = TIERS[tier].color;
  const robe = ['#3a3352', '#453d63', '#544a78', '#6a5f92'][tier];
  const robeDark = '#2a2440';
  let m = [];
  m = m.concat(B3D.box(0, 0.55, 0, 0.6, 1.1, 0.45, robeDark));
  m = m.concat(B3D.box(0, 1.4, 0, 0.72, 0.75, 0.5, robe));
  m = m.concat(B3D.diamond(0, 2.12, 0, 0.27, 0.72, '#e8d6b0'));
  m = m.concat(B3D.box(0.52, 1.0, 0.12, 0.09, 1.9, 0.09, '#4a4036'));
  m = m.concat(B3D.diamond(0.52, 2.12, 0.12, 0.14, 0.45, tc, true));
  if (tier >= 1) {
    m = m.concat(B3D.diamond(-0.5, 1.85, 0, 0.16, 0.5, tc, true));
    m = m.concat(B3D.diamond(0.5, 1.85, 0, 0.13, 0.4, tc, true));
  }
  if (tier >= 2) m = m.concat(B3D.ring(2.65, 0.32, 0.1, 10, tc, true));
  if (tier >= 3) {
    m = m.concat(B3D.wing(-1, tc));
    m = m.concat(B3D.wing(1, tc));
  }
  return m;
};

B3D.heroOrbitMesh = function (tier) {
  if (tier < 2) return [];
  const tc = TIERS[tier].color;
  let m = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    m = m.concat(B3D.diamond(Math.cos(a) * 1.1, 1.5, Math.sin(a) * 1.1, 0.1, 0.34, tc, true));
  }
  return m;
};

/** A creature of the Unlit. Four archetypes; guardians get crowns. */
B3D.foeMesh = function (archetype, color, guardian) {
  const dark = '#231d33';
  const body = B3D.mix('#2c2547', color, 0.3);
  let m = [];
  if (archetype === 0) {          // Shade: a hanging dark crystal
    m = m.concat(B3D.diamond(0, 1.5, 0, 0.85, 2.6, body));
    m = m.concat(B3D.diamond(0, 2.0, -0.55, 0.1, 0.26, color, true));
    m = m.concat(B3D.diamond(0.32, 2.0, -0.48, 0.1, 0.26, color, true));
  } else if (archetype === 1) {   // Sentinel: an obelisk that learned to want
    m = m.concat(B3D.box(0, 1.1, 0, 0.9, 2.2, 0.7, body));
    m = m.concat(B3D.diamond(0, 2.75, 0, 0.42, 1.0, dark));
    m = m.concat(B3D.box(-0.75, 1.5, 0, 0.28, 1.3, 0.28, dark));
    m = m.concat(B3D.box(0.75, 1.5, 0, 0.28, 1.3, 0.28, dark));
    m = m.concat(B3D.diamond(-0.14, 2.8, -0.3, 0.09, 0.24, color, true));
    m = m.concat(B3D.diamond(0.14, 2.8, -0.3, 0.09, 0.24, color, true));
  } else if (archetype === 2) {   // Maw: jaws of the long dark
    m = m.concat(B3D.box(0, 0.5, 0, 1.7, 0.55, 1.2, body));
    m = m.concat(B3D.box(0, 1.25, 0.25, 1.5, 0.5, 0.8, dark));
    for (let i = -1; i <= 1; i++) {
      m = m.concat(B3D.diamond(i * 0.45, 0.95, -0.55, 0.1, 0.5, '#cfd6e0'));
    }
    m = m.concat(B3D.diamond(-0.4, 1.45, -0.2, 0.1, 0.26, color, true));
    m = m.concat(B3D.diamond(0.4, 1.45, -0.2, 0.1, 0.26, color, true));
  } else {                        // Hollow Caster: it learned the Arts wrong
    m = m.concat(B3D.box(0, 0.8, 0, 0.7, 1.6, 0.5, dark));        // ragged robe
    m = m.concat(B3D.diamond(0, 1.9, 0, 0.34, 0.8, body));        // cowled head
    m = m.concat(B3D.diamond(0, 1.95, -0.28, 0.1, 0.24, color, true));
    m = m.concat(B3D.box(-0.6, 1.2, -0.2, 0.16, 1.0, 0.16, dark)); // gnarled staff
    m = m.concat(B3D.diamond(-0.6, 1.95, -0.2, 0.18, 0.5, color, true)); // orb
    m = m.concat(B3D.ring(0.25, 0.55, 0.1, 8, color, true));      // it floats on a sigil
  }
  if (guardian) {
    m = m.concat(B3D.ring(3.2, 0.55, 0.14, 8, color, true));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      m = m.concat(B3D.diamond(Math.cos(a) * 1.5, 0.9, Math.sin(a) * 1.5, 0.12, 0.5, color, true));
    }
  }
  return m;
};

/* ---------------- arena themes ---------------- */

B3D.THEMES = {
  // floor inner, floor outer, pillar, mote/ambient
  void:   { f1: '#11142a', f2: '#0a0c1c', pillar: '#191d33', mote: '#8a7fd4', ice: false },
  sea:    { f1: '#0d1d33', f2: '#081320', pillar: '#152c41', mote: '#5ec8e8', ice: false },
  wood:   { f1: '#13231a', f2: '#0a1410', pillar: '#1d3326', mote: '#9fe87a', ice: false },
  sand:   { f1: '#2b2316', f2: '#19140c', pillar: '#3d3220', mote: '#e8b25c', ice: false },
  frost:  { f1: '#1a2433', f2: '#101722', pillar: '#2a3a4d', mote: '#bfeaff', ice: true },
  crag:   { f1: '#1d1c22', f2: '#111014', pillar: '#2b2a33', mote: '#b0a8c0', ice: false },
};

B3D.themeForBiome = function (b) {
  if (b === 'deep' || b === 'shallow' || b === 'sand') return B3D.THEMES.sea;
  if (b === 'forest' || b === 'jungle' || b === 'swamp' || b === 'grass') return B3D.THEMES.wood;
  if (b === 'desert' || b === 'savanna') return B3D.THEMES.sand;
  if (b === 'snow' || b === 'tundra') return B3D.THEMES.frost;
  if (b === 'rock' || b === 'peak') return B3D.THEMES.crag;
  return B3D.THEMES.void;
};

/** The arena: a rune-ringed dais adrift in the Umbra, themed by where
    in the broken world the dark caught you. */
B3D.arenaMesh = function (accent, seed, theme) {
  const t = theme || B3D.THEMES.void;
  const rand = mulberry32(seed);
  let m = [];
  m = m.concat(B3D.disc(0, 6.4, 26, t.f1));
  m = m.concat(B3D.disc(-0.02, 7.4, 26, t.f2));
  m = m.concat(B3D.ring(0.02, 5.3, 0.16, 22, accent, true));
  m = m.concat(B3D.ring(0.01, 3.4, 0.06, 18, '#3c3a5a', true));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.4;
    const r = 8.2 + rand() * 2.5, h = 1.2 + rand() * 3.4;
    if (t.ice) {            // shards of old ice instead of pillars
      m = m.concat(B3D.diamond(Math.cos(a) * r, h / 2 - 0.4, Math.sin(a) * r,
        0.55, h * 1.6, t.pillar));
    } else {
      m = m.concat(B3D.box(Math.cos(a) * r, h / 2 - 0.4, Math.sin(a) * r,
        0.8, h, 0.8, t.pillar));
    }
  }
  return m;
};

/* ---------------- stars & motes ---------------- */

B3D.makeStars = function (seed, n) {
  const rand = mulberry32(seed);
  const stars = [];
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, b = (rand() - 0.35) * Math.PI;
    stars.push({
      p: [Math.cos(a) * Math.cos(b) * 300, Math.sin(b) * 300 + 40, Math.sin(a) * Math.cos(b) * 300],
      s: 0.6 + rand() * 1.6, tw: rand() * 7,
    });
  }
  return stars;
};

B3D.makeMotes = function (seed, n) {
  const rand = mulberry32(seed);
  const motes = [];
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, r = 1 + rand() * 7.5;
    motes.push({
      x: Math.cos(a) * r, y: rand() * 4.5, z: Math.sin(a) * r,
      sp: 0.12 + rand() * 0.3, ph: rand() * 7,
    });
  }
  return motes;
};

/* ---------------- camera & projection ---------------- */

B3D.camera = function (cam) {
  const pos = [
    cam.target[0] + Math.cos(cam.angle) * cam.dist,
    cam.target[1] + cam.height,
    cam.target[2] + Math.sin(cam.angle) * cam.dist,
  ];
  const fwd = B3D.norm(B3D.sub(cam.target, pos));
  const right = B3D.norm(B3D.cross(fwd, [0, 1, 0]));
  const up = B3D.cross(right, fwd);
  return { pos, fwd, right, up };
};

B3D.project = function (p, c, w, h, f) {
  const rel = B3D.sub(p, c.pos);
  const z = B3D.dot(rel, c.fwd);
  if (z < 0.15) return null;
  return [
    w / 2 + (B3D.dot(rel, c.right) * f) / z,
    h / 2 - (B3D.dot(rel, c.up) * f) / z,
    z,
  ];
};

/* ---------------- rendering ---------------- */

const FOG = [16, 12, 36];

B3D.render = function (ctx, w, h, scene) {
  // the Umbra: void gradient + slow nebulae
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#05040c');
  bg.addColorStop(0.55, '#0c0a1e');
  bg.addColorStop(1, '#191230');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const t = scene.time;
  const acc = B3D.hexRGB(scene.accent || '#8a7fd4');
  for (let i = 0; i < 2; i++) {
    const nx = w * (0.3 + 0.4 * i) + Math.sin(t * 0.05 + i * 3) * w * 0.12;
    const ny = h * 0.3 + Math.cos(t * 0.04 + i * 2) * h * 0.1;
    const nr = Math.min(w, h) * (0.5 + i * 0.25);
    const g = ctx.createRadialGradient(nx, ny, 1, nx, ny, nr);
    g.addColorStop(0, 'rgba(' + (i ? acc.join(',') : '90,60,140') + ',0.07)');
    g.addColorStop(1, 'rgba(40,20,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  const cam = { ...scene.cam };
  if (scene.shake > 0.01) {
    cam.target = B3D.add(cam.target, [
      (Math.random() - 0.5) * scene.shake,
      (Math.random() - 0.5) * scene.shake,
      (Math.random() - 0.5) * scene.shake,
    ]);
  }
  const c = B3D.camera(cam);
  const f = (Math.min(w, h) / 2) / Math.tan((cam.fov || 0.52));

  // stars
  for (const st of scene.stars) {
    const q = B3D.project(B3D.add(st.p, scene.cam.target), c, w, h, f);
    if (!q) continue;
    const a = 0.35 + 0.3 * Math.sin(t * 1.7 + st.tw);
    ctx.fillStyle = 'rgba(200,210,255,' + a.toFixed(2) + ')';
    ctx.fillRect(q[0], q[1], st.s, st.s);
  }

  // the shattered moon — what is left of the Spire's lamp
  B3D._moon(ctx, c, w, h, f, t);

  // gather world-space triangles
  const light = B3D.norm([-0.5, 0.85, -0.35]);
  const out = [];
  for (const e of scene.entities) {
    if (e.alpha <= 0.01) continue;
    const cosR = Math.cos(e.rot || 0), sinR = Math.sin(e.rot || 0);
    const sc = e.scale || 1;
    const off = e.offset || [0, 0, 0];
    const base = [e.pos[0] + off[0], e.pos[1] + off[1] + (e.bob || 0), e.pos[2] + off[2]];
    for (const tr of e.mesh) {
      const wv = tr.v.map((p) => [
        base[0] + (p[0] * cosR - p[2] * sinR) * sc,
        base[1] + p[1] * sc,
        base[2] + (p[0] * sinR + p[2] * cosR) * sc,
      ]);
      const n = B3D.norm(B3D.cross(B3D.sub(wv[1], wv[0]), B3D.sub(wv[2], wv[0])));
      if (!tr.em && !tr.flat && B3D.dot(n, B3D.sub(c.pos, wv[0])) <= 0) continue;
      const pv = [];
      let z = 0, ok = true;
      for (const p of wv) {
        const q = B3D.project(p, c, w, h, f);
        if (!q) { ok = false; break; }
        pv.push(q); z += q[2];
      }
      if (!ok) continue;
      z /= 3;
      let col;
      if (tr.em || tr.flat) {
        col = tr.col;
      } else {
        const shade = 0.62 + 0.55 * Math.max(0, B3D.dot(n, light));
        const fog = Math.max(0, Math.min(0.65, (z - 9) / 28));   // depth cue
        const rgb = B3D.hexRGB(tr.col);
        col = 'rgb(' +
          Math.min(255, (rgb[0] * shade + (FOG[0] - rgb[0] * shade) * fog) | 0) + ',' +
          Math.min(255, (rgb[1] * shade + (FOG[1] - rgb[1] * shade) * fog) | 0) + ',' +
          Math.min(255, (rgb[2] * shade + (FOG[2] - rgb[2] * shade) * fog) | 0) + ')';
      }
      out.push({ pv, z, col, em: tr.em, alpha: e.alpha });
    }
  }
  out.sort((a, b) => b.z - a.z);

  for (const tr of out) {
    ctx.globalAlpha = tr.alpha;
    if (tr.em) {
      ctx.shadowColor = tr.col;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = tr.col;
    ctx.beginPath();
    ctx.moveTo(tr.pv[0][0], tr.pv[0][1]);
    ctx.lineTo(tr.pv[1][0], tr.pv[1][1]);
    ctx.lineTo(tr.pv[2][0], tr.pv[2][1]);
    ctx.closePath();
    ctx.fill();
    if (tr.em) ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  /* ---- additive layer: motes, bolts, particles, shockwaves ---- */
  ctx.globalCompositeOperation = 'lighter';

  for (const m of (scene.motes || [])) {
    const q = B3D.project([m.x, m.y, m.z], c, w, h, f);
    if (!q) continue;
    const a = 0.18 + 0.16 * Math.sin(t * 1.3 + m.ph);
    ctx.fillStyle = 'rgba(' + acc.join(',') + ',' + a.toFixed(2) + ')';
    const s = Math.max(0.6, 2.4 * f / (q[2] * 90));
    ctx.fillRect(q[0], q[1], s + 1, s + 1);
  }

  for (const b of (scene.bolts || [])) {
    const k = Math.min(1, b.t / b.dur);
    const pos = B3D.lerp(b.from, b.to, k);
    pos[1] += Math.sin(k * Math.PI) * 1.6;          // arcing flight
    for (let i = 0; i < 5; i++) {                    // comet trail
      const kk = Math.max(0, k - i * 0.05);
      const pp = B3D.lerp(b.from, b.to, kk);
      pp[1] += Math.sin(kk * Math.PI) * 1.6;
      const q = B3D.project(pp, c, w, h, f);
      if (!q) continue;
      ctx.fillStyle = b.col;
      ctx.globalAlpha = (1 - i / 5) * 0.8;
      ctx.beginPath();
      ctx.arc(q[0], q[1], Math.max(1, (0.14 - i * 0.02) * f / q[2]), 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  for (const p of scene.particles) {
    const q = B3D.project(p.pos, c, w, h, f);
    if (!q) continue;
    const a = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.col;
    ctx.globalAlpha = a * 0.85;
    const s = (p.size * f) / q[2];
    ctx.beginPath();
    ctx.arc(q[0], q[1], Math.max(0.5, s), 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const s of (scene.shocks || [])) {
    const q = B3D.project(s.pos, c, w, h, f);
    if (!q) continue;
    const rx = s.r * f / q[2];
    ctx.strokeStyle = s.col;
    ctx.globalAlpha = Math.max(0, s.life) * 0.9;
    ctx.lineWidth = Math.max(1, 4 * s.life);
    ctx.beginPath();
    ctx.ellipse(q[0], q[1], rx, rx * 0.32, 0, 0, 7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // slash arcs (screen-space crescents at the impact point)
  for (const s of (scene.slashes || [])) {
    const q = B3D.project(s.pos, c, w, h, f);
    if (!q) continue;
    const k = s.t / s.dur;
    ctx.strokeStyle = s.col;
    ctx.globalAlpha = (1 - k) * 0.95;
    ctx.lineWidth = Math.max(1, 6 * (1 - k));
    ctx.shadowColor = s.col;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    const r = 0.95 * f / q[2];
    ctx.arc(q[0], q[1], r, s.ang - 1.1 + k * 2.6, s.ang - 0.1 + k * 2.6);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  /* ---- intents, hp bars, target marker ---- */
  ctx.textAlign = 'center';
  for (const it of (scene.intents || [])) {
    const q = B3D.project(it.anchor, c, w, h, f);
    if (!q) continue;
    const sc = f / q[2];
    ctx.globalAlpha = it.alpha;
    // mini hp bar
    const bw = 1.6 * sc;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(q[0] - bw / 2, q[1], bw, 4);
    ctx.fillStyle = it.color;
    ctx.fillRect(q[0] - bw / 2, q[1], bw * it.hp, 4);
    // intent glyph
    if (it.glyph) {
      ctx.font = '600 ' + Math.round(0.42 * sc) + 'px serif';
      ctx.fillStyle = it.glyphColor || '#d8cdb2';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 5;
      ctx.fillText(it.glyph, q[0], q[1] - 0.12 * sc);
      ctx.shadowBlur = 0;
    }
    if (it.targeted) {
      ctx.fillStyle = '#e8c66a';
      ctx.font = '700 ' + Math.round(0.5 * sc) + 'px serif';
      ctx.shadowColor = '#e8c66a';
      ctx.shadowBlur = 10;
      ctx.fillText('▼', q[0], q[1] - (0.5 + Math.abs(Math.sin(t * 3)) * 0.18) * sc);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  /* ---- floating damage text ---- */
  for (const tx of scene.texts) {
    const q = B3D.project([tx.pos[0], tx.pos[1] + tx.t * 1.6, tx.pos[2]], c, w, h, f);
    if (!q) continue;
    const a = Math.max(0, 1 - tx.t / 1.4);
    ctx.font = '700 ' + Math.round((tx.big ? 0.5 : 0.34) * f / q[2]) + 'px Cinzel, serif';
    ctx.fillStyle = tx.col;
    ctx.globalAlpha = a;
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6;
    ctx.fillText(tx.str, q[0], q[1]);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  /* ---- QTE ring: strike true / turn the blow ---- */
  const qte = scene.qte;
  if (qte) {
    const q = B3D.project(qte.anchor, c, w, h, f);
    if (q) {
      const col = qte.kind === 'crit' ? '#ffd27a' : '#7fd4ff';
      const k = Math.min(1, qte.t / qte.dur);
      const rOuter = (70 * (1 - k) + 24);
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(q[0], q[1], 24, 0, 7); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(q[0], q[1], rOuter, 0, 7); ctx.stroke();
      ctx.shadowBlur = 0;
      if (qte.hint) {
        ctx.font = '600 13px Cinzel, serif';
        ctx.fillStyle = col;
        ctx.fillText(qte.hint, q[0], q[1] + 96);
      }
      ctx.globalAlpha = 1;
    }
  }

  if (scene.flash > 0.01) {
    ctx.fillStyle = 'rgba(255,245,220,' + Math.min(1, scene.flash).toFixed(2) + ')';
    ctx.fillRect(0, 0, w, h);
  }
};

/** A pale broken disc hanging over the arena, leaking light from its cracks. */
B3D._moon = function (ctx, c, w, h, f, t) {
  const q = B3D.project([34, 14, -48], c, w, h, f);
  if (!q) return;
  const r = 6.5 * f / q[2];
  const g = ctx.createRadialGradient(q[0], q[1], r * 0.2, q[0], q[1], r * 1.8);
  g.addColorStop(0, 'rgba(210,215,240,0.30)');
  g.addColorStop(1, 'rgba(210,215,240,0)');
  ctx.fillStyle = g;
  ctx.fillRect(q[0] - r * 2, q[1] - r * 2, r * 4, r * 4);
  ctx.fillStyle = 'rgba(205,210,235,0.85)';
  ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7); ctx.fill();
  // cracks
  ctx.strokeStyle = 'rgba(20,18,40,0.8)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(q[0] - r * 0.7, q[1] - r * 0.3);
  ctx.lineTo(q[0] - r * 0.1, q[1] + r * 0.1);
  ctx.lineTo(q[0] + r * 0.5, q[1] - r * 0.45);
  ctx.moveTo(q[0] - r * 0.1, q[1] + r * 0.1);
  ctx.lineTo(q[0] + r * 0.2, q[1] + r * 0.8);
  ctx.stroke();
  // drifting fragments
  for (let i = 0; i < 3; i++) {
    const a = t * 0.1 + i * 2.1;
    const fx = q[0] + Math.cos(a) * r * (1.5 + i * 0.3);
    const fy = q[1] + Math.sin(a) * r * 0.5 - r * 0.2;
    ctx.fillStyle = 'rgba(205,210,235,0.7)';
    ctx.beginPath(); ctx.arc(fx, fy, r * (0.1 + i * 0.04), 0, 7); ctx.fill();
  }
};
