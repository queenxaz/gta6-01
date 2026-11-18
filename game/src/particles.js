// particles.js — sparks, smoke, muzzle flashes, floating text and skid marks.
// All effects are transient render-only data; nothing here is saved.

import { clamp } from './random.js';

/** Create the effects store. */
export function createEffects() {
  return {
    particles: [],
    texts: [],
    skids: [],
    flashes: [],
  };
}

/** Spawn a burst of particles. */
export function burst(fx, x, y, opts = {}) {
  const n = opts.count || 14;
  const color = opts.color || '#ffcf5a';
  const speed = opts.speed || 220;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.5,
      maxLife: 0.9,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

/** Smoke puff (damaged / burning car). */
export function smoke(fx, x, y) {
  fx.particles.push({
    x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10,
    vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30,
    life: 0.9 + Math.random() * 0.5, maxLife: 1.4,
    size: 6 + Math.random() * 8, color: '#5a5a5a', smoke: true,
  });
}

/** Floating score / message text. */
export function floatText(fx, x, y, text, color) {
  fx.texts.push({ x, y, text, color: color || '#ffffff', life: 1.6 });
}

/** A skid mark segment from a sliding car. */
export function addSkid(fx, x1, y1, x2, y2) {
  fx.skids.push({ x1, y1, x2, y2, life: 5 });
  if (fx.skids.length > 220) fx.skids.shift();
}

/** Muzzle flash at a point, facing an angle. */
export function muzzle(fx, x, y, angle) {
  fx.flashes.push({ x, y, angle, life: 0.07 });
}

/** Advance all effects. */
export function updateEffects(fx, dt) {
  for (const p of fx.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98; p.vy *= 0.98;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const t of fx.texts) {
    t.life -= dt;
    t.y -= 26 * dt;
  }
  fx.texts = fx.texts.filter((t) => t.life > 0);
  for (const s of fx.skids) s.life -= dt;
  fx.skids = fx.skids.filter((s) => s.life > 0);
  for (const f of fx.flashes) f.life -= dt;
  fx.flashes = fx.flashes.filter((f) => f.life > 0);
}

/** Draw particles, skids, flashes and floating text. */
export function drawEffects(ctx, fx, cam) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of fx.skids) {
    ctx.strokeStyle = `rgba(20,20,24,${clamp(s.life / 5, 0, 1) * 0.5})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  for (const p of fx.particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = p.smoke ? a * 0.45 : a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.smoke ? (1.6 - a * 0.6) : 1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const f of fx.flashes) {
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.arc(f.x + Math.cos(f.angle) * 20, f.y + Math.sin(f.angle) * 20, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const t of fx.texts) {
    ctx.globalAlpha = clamp(t.life, 0, 1);
    ctx.fillStyle = t.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}
