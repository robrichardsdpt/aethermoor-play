/* Deterministic hashing & PRNG — everything in Aethermoor flows from one seed. */
'use strict';

/** 32-bit integer hash of a 2D coordinate + seed. Returns uint32. */
function hash2i(x, y, seed) {
  let h = (seed | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

/** Same hash, mapped to [0, 1). */
function hash2(x, y, seed) {
  return hash2i(x, y, seed) / 4294967296;
}

/** Fast seeded PRNG. Returns a function yielding floats in [0, 1). */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash an arbitrary string to a uint32 (for seeds typed into the URL). */
function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
