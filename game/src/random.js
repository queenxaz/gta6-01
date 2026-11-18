// random.js — seeded deterministic randomness for Sunset Harbor.
// Every run with the same seed builds the same city, traffic and missions,
// so screenshot scenes (?shot=...&seed=1) are reproducible.

/** Mulberry32: a small fast seeded PRNG. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tiny RNG helper bundle around one seeded stream. */
export function createRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    /** Float in [min, max). */
    range(min, max) { return min + next() * (max - min); },
    /** Integer in [min, max] inclusive. */
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    /** Pick one element of an array. */
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    /** True with probability p. */
    chance(p) { return next() < p; },
    /** Shuffle a copy of an array. */
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
      }
      return out;
    },
  };
}

/** Clamp a number into [min, max]. */
export function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

/** Linear interpolation. */
export function lerp(a, b, t) { return a + (b - a) * t; }

/** Distance between two points. */
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

/** Angle from (ax,ay) to (bx,by). */
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

/** Shortest signed angular difference, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Hash a short string into a 32-bit seed. */
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
