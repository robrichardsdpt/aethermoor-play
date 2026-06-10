/* Value noise + fractal Brownian motion. Pure functions of (x, y, seed),
   so any point in the infinite world can be computed without neighbors. */
'use strict';

/** Smoothly interpolated value noise in [0, 1). */
function noise2(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal noise: layered octaves, normalized to [0, 1). */
function fbm(x, y, seed, octaves, lacunarity, gain) {
  octaves = octaves || 5;
  lacunarity = lacunarity || 2;
  gain = gain || 0.5;
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq, seed + i * 1013);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Stretch a value around 0.5 to widen fbm's narrow distribution. */
function stretch(v, k) {
  v = 0.5 + (v - 0.5) * k;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
