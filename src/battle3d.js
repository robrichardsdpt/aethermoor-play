/* A tiny software-3D engine for the Umbra: perspective projection,
   painter-sorted flat-shaded triangles, glowing emissive surfaces,
   particles, and procedural low-poly meshes. No libraries. */
'use strict';

const B3D = {};

/* ---------------- vectors ---------------- */

B3D.sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
B3D.add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
B3D.scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
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

/* ---------------- mesh builders (lists of {v:[p,p,p], col, em}) ----- */

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

B3D.disc = function (cy, r, segs, col) {
  const tris = [];
  const c = [0, cy, 0];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    tris.push({
      v: [c, [Math.cos(a1) * r, cy, Math.sin(a1) * r], [Math.cos(a0) * r, cy, Math.sin(a0) * r]],
      col,
    });
  }
  return tris;
};

B3D.wing = function (side, col) {
  // three sweeping feathers of light
  const s = side, tris = [];
  const root = [s * 0.35, 1.6, -0.1];
  for (let i = 0; i < 3; i++) {
    const len = 1.9 - i * 0.45, lift = 0.9 + i * 0.55;
    const tip = [s * (0.6 + len), 1.2 + lift, -0.3 - i * 0.12];
    const mid = [s * (0.5 + len * 0.5), 1.55 + lift * 0.45, -0.2];
    tris.push({ v: [root, mid, tip], col, em: true });
    tris.push({ v: [root, tip, mid], col, em: true });   // visible both sides
  }
  return tris;
};

/* ---------------- avatar & foe meshes ---------------- */

/** The Wayfarer's battle form, growing grander with each evolution tier. */
B3D.heroMesh = function (tier) {
  const tc = TIERS[tier].color;
  const robe = ['#3a3352', '#453d63', '#544a78', '#6a5f92'][tier];
  const robeDark = '#2a2440';
  let m = [];
  m = m.concat(B3D.box(0, 0.55, 0, 0.6, 1.1, 0.45, robeDark));        // robes
  m = m.concat(B3D.box(0, 1.4, 0, 0.72, 0.75, 0.5, robe));            // torso
  m = m.concat(B3D.diamond(0, 2.12, 0, 0.27, 0.72, '#e8d6b0'));       // head
  m = m.concat(B3D.box(0.52, 1.0, 0.12, 0.09, 1.9, 0.09, '#4a4036'));  // staff
  m = m.concat(B3D.diamond(0.52, 2.12, 0.12, 0.14, 0.45, tc, true));  // staff crystal
  if (tier >= 1) {
    m = m.concat(B3D.diamond(-0.5, 1.85, 0, 0.16, 0.5, tc, true));    // shoulder shard
    m = m.concat(B3D.diamond(0.5, 1.85, 0, 0.13, 0.4, tc, true));
  }
  if (tier >= 2) {
    m = m.concat(B3D.ring(2.65, 0.32, 0.1, 10, tc, true));            // halo
  }
  if (tier >= 3) {
    m = m.concat(B3D.wing(-1, tc));
    m = m.concat(B3D.wing(1, tc));
  }
  return m;
};

/** Orbiting crystal shards for Shardborn+ heroes (spun as its own entity). */
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

/** A creature of the Unlit. Archetype varies; guardians get crowns. */
B3D.foeMesh = function (archetype, color, guardian) {
  const dark = '#231d33';
  const body = B3D.mix('#2c2547', color, 0.3);
  let m = [];
  if (archetype === 0) {          // Shade: a hanging dark crystal
    m = m.concat(B3D.diamond(0, 1.5, 0, 0.85, 2.6, body));
    m = m.concat(B3D.diamond(0, 2.0, -0.55, 0.1, 0.26, color, true));   // eyes
    m = m.concat(B3D.diamond(0.32, 2.0, -0.48, 0.1, 0.26, color, true));
  } else if (archetype === 1) {   // Sentinel: an obelisk that learned to want
    m = m.concat(B3D.box(0, 1.1, 0, 0.9, 2.2, 0.7, body));
    m = m.concat(B3D.diamond(0, 2.75, 0, 0.42, 1.0, dark));
    m = m.concat(B3D.box(-0.75, 1.5, 0, 0.28, 1.3, 0.28, dark));
    m = m.concat(B3D.box(0.75, 1.5, 0, 0.28, 1.3, 0.28, dark));
    m = m.concat(B3D.diamond(-0.14, 2.8, -0.3, 0.09, 0.24, color, true));
    m = m.concat(B3D.diamond(0.14, 2.8, -0.3, 0.09, 0.24, color, true));
  } else {                        // Maw: jaws of the long dark
    m = m.concat(B3D.box(0, 0.5, 0, 1.7, 0.55, 1.2, body));
    m = m.concat(B3D.box(0, 1.25, 0.25, 1.5, 0.5, 0.8, dark));
    for (let i = -1; i <= 1; i++) {
      m = m.concat(B3D.diamond(i * 0.45, 0.95, -0.55, 0.1, 0.5, '#cfd6e0'));   // teeth
    }
    m = m.concat(B3D.diamond(-0.4, 1.45, -0.2, 0.1, 0.26, color, true));
    m = m.concat(B3D.diamond(0.4, 1.45, -0.2, 0.1, 0.26, color, true));
  }
  if (guardian) {
    m = m.concat(B3D.ring(3.2, 0.55, 0.14, 8, color, true));            // crown
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      m = m.concat(B3D.diamond(Math.cos(a) * 1.5, 0.9, Math.sin(a) * 1.5, 0.12, 0.5, color, true));
    }
  }
  return m;
};

/** The arena: a rune-ringed dais adrift in the Umbra. */
B3D.arenaMesh = function (accent, seed) {
  const rand = mulberry32(seed);
  let m = [];
  m = m.concat(B3D.disc(0, 6.4, 26, '#11142a'));
  m = m.concat(B3D.disc(-0.02, 7.4, 26, '#0a0c1c'));
  m = m.concat(B3D.ring(0.02, 5.3, 0.16, 22, accent, true));
  m = m.concat(B3D.ring(0.01, 3.4, 0.06, 18, '#3c3a5a', true));
  for (let i = 0; i < 9; i++) {                                    // broken pillars
    const a = (i / 9) * Math.PI * 2 + rand() * 0.4;
    const r = 8.2 + rand() * 2.5, h = 1.2 + rand() * 3.4;
    m = m.concat(B3D.box(Math.cos(a) * r, h / 2 - 0.4, Math.sin(a) * r,
      0.8, h, 0.8, '#191d33'));
  }
  return m;
};

/* ---------------- stars ---------------- */

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

/* ---------------- rendering ---------------- */

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

/**
 * scene: { entities, particles, texts, cam, time, flash }
 * entity: { mesh, pos, rot, scale, alpha, offset, bob }
 */
B3D.render = function (ctx, w, h, scene) {
  // the Umbra: void gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#05040c');
  bg.addColorStop(0.55, '#0c0a1e');
  bg.addColorStop(1, '#191230');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cam = { ...scene.cam };
  if (scene.shake > 0.01) {
    cam.target = B3D.add(cam.target, [
      (Math.random() - 0.5) * scene.shake,
      (Math.random() - 0.5) * scene.shake,
      (Math.random() - 0.5) * scene.shake,
    ]);
  }
  const c = B3D.camera(cam);
  // focal length from the smaller dimension, so portrait phones see the arena
  const f = (Math.min(w, h) / 2) / Math.tan((cam.fov || 0.52));

  // stars
  for (const st of scene.stars) {
    const q = B3D.project(B3D.add(st.p, scene.cam.target), c, w, h, f);
    if (!q) continue;
    const a = 0.35 + 0.3 * Math.sin(scene.time * 1.7 + st.tw);
    ctx.fillStyle = 'rgba(200,210,255,' + a.toFixed(2) + ')';
    ctx.fillRect(q[0], q[1], st.s, st.s);
  }

  // gather world-space triangles
  const light = B3D.norm([-0.5, 0.85, -0.35]);
  const out = [];
  for (const e of scene.entities) {
    if (e.alpha <= 0.01) continue;
    const cosR = Math.cos(e.rot || 0), sinR = Math.sin(e.rot || 0);
    const sc = e.scale || 1;
    const off = e.offset || [0, 0, 0];
    const base = [e.pos[0] + off[0], e.pos[1] + off[1] + (e.bob || 0), e.pos[2] + off[2]];
    for (const t of e.mesh) {
      const wv = t.v.map((p) => [
        base[0] + (p[0] * cosR - p[2] * sinR) * sc,
        base[1] + p[1] * sc,
        base[2] + (p[0] * sinR + p[2] * cosR) * sc,
      ]);
      const n = B3D.norm(B3D.cross(B3D.sub(wv[1], wv[0]), B3D.sub(wv[2], wv[0])));
      // backface cull (emissive tris stay double-sided)
      if (!t.em && B3D.dot(n, B3D.sub(c.pos, wv[0])) <= 0) continue;
      const pv = [];
      let z = 0, ok = true;
      for (const p of wv) {
        const q = B3D.project(p, c, w, h, f);
        if (!q) { ok = false; break; }
        pv.push(q); z += q[2];
      }
      if (!ok) continue;
      let col;
      if (t.em) {
        col = t.col;
      } else {
        const shade = 0.62 + 0.55 * Math.max(0, B3D.dot(n, light));
        const rgb = B3D.hexRGB(t.col);
        col = 'rgb(' + Math.min(255, (rgb[0] * shade) | 0) + ',' +
          Math.min(255, (rgb[1] * shade) | 0) + ',' +
          Math.min(255, (rgb[2] * shade) | 0) + ')';
      }
      out.push({ pv, z: z / 3, col, em: t.em, alpha: e.alpha });
    }
  }
  out.sort((a, b) => b.z - a.z);

  for (const t of out) {
    ctx.globalAlpha = t.alpha;
    if (t.em) {
      ctx.shadowColor = t.col;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = t.col;
    ctx.beginPath();
    ctx.moveTo(t.pv[0][0], t.pv[0][1]);
    ctx.lineTo(t.pv[1][0], t.pv[1][1]);
    ctx.lineTo(t.pv[2][0], t.pv[2][1]);
    ctx.closePath();
    ctx.fill();
    if (t.em) ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // particles (additive)
  ctx.globalCompositeOperation = 'lighter';
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
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // floating damage / heal text
  ctx.textAlign = 'center';
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

  if (scene.flash > 0.01) {
    ctx.fillStyle = 'rgba(255,245,220,' + Math.min(1, scene.flash).toFixed(2) + ')';
    ctx.fillRect(0, 0, w, h);
  }
};
