// render.js — drawing Sunset Harbor.
// Top-down 2D canvas: sun-soaked ground, road grid with lane markings,
// rooftops with shadows, parks and palms, the sea, cars, people, the player,
// objective markers and day-light tinting. Everything is drawn from the
// city data and entity lists — no image assets.

import { WORLD_SIZE, ROAD_PITCH, ROAD_HALF, isOnRoad } from './city.js';
import { clamp } from './random.js';

/** Draw the world inside the camera view. */
export function drawWorld(ctx, game, cam, vw, vh) {
  const { city } = game;
  const x0 = cam.x - vw / 2 - 60;
  const y0 = cam.y - vh / 2 - 60;
  const x1 = cam.x + vw / 2 + 60;
  const y1 = cam.y + vh / 2 + 60;

  // Ground base.
  ctx.fillStyle = '#7fae6e';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // District ground tints.
  drawDistrictGround(ctx, x0, y0, x1, y1);

  // Sea.
  ctx.fillStyle = '#2e7fb8';
  for (const w of city.water) {
    if (w.x + w.w < x0 || w.x > x1 || w.y + w.h < y0 || w.y > y1) continue;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#3a90cc';
    for (let i = 0; i < 8; i++) {
      const wy = w.y + ((i * 397) % Math.max(1, w.h));
      ctx.fillRect(w.x + 10, wy, w.w - 20, 3);
    }
    ctx.fillStyle = '#2e7fb8';
  }
  // Beach sand.
  ctx.fillStyle = '#e8c98a';
  ctx.fillRect(2880, Math.max(y0, 0), 80, Math.min(y1, WORLD_SIZE) - Math.max(y0, 0));

  // Parking lots and plazas.
  for (const lot of city.lots) {
    if (lot.x > x1 || lot.x + lot.w < x0 || lot.y > y1 || lot.y + lot.h < y0) continue;
    ctx.fillStyle = '#6b6f78';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let bx = lot.x + 24; bx < lot.x + lot.w - 20; bx += 34) {
      ctx.beginPath(); ctx.moveTo(bx, lot.y + 10); ctx.lineTo(bx, lot.y + 34); ctx.stroke();
    }
  }
  for (const p of city.parks) {
    if (p.x > x1 || p.x + p.w < x0 || p.y > y1 || p.y + p.h < y0) continue;
    ctx.fillStyle = p.plaza ? '#c9b896' : '#6da85e';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    if (p.plaza) {
      ctx.fillStyle = '#4a90c2';
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8e2d0';
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 27, 0, Math.PI * 2); ctx.stroke();
    }
  }

  drawRoads(ctx, x0, y0, x1, y1);

  // Buildings with drop shadows and rooftop detail.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Rooftop windows / AC units.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 8 + i * 34, b.y + 8 + j * 34, 14, 10);
      }
    }
    if (b.roof === 'garden') {
      ctx.fillStyle = '#5d9e52';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, b.h * 0.6);
    } else if (b.roof === 'pool') {
      ctx.fillStyle = '#4a90c2';
      ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.25, b.w * 0.5, b.h * 0.5);
    }
    if (b.height >= 5) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.height}F`, b.x + b.w / 2, b.y + 16);
    }
  }

  // Trees.
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f7d3a';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5da854';
    ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // Landmark labels (small, on the map itself).
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const lm of game.landmarks) {
    if (lm.x < x0 || lm.x > x1 || lm.y < y0 || lm.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = ctx.measureText(lm.name).width + 12;
    ctx.fillRect(lm.x - w / 2, lm.y - 34, w, 17);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(lm.name, lm.x, lm.y - 21);
  }
}

function drawDistrictGround(ctx, x0, y0, x1, y1) {
  const zones = [
    { x0: 0, y0: 0, x1: 1100, y1: 1100, c: '#8fb573' },
    { x0: 1100, y0: 0, x1: 2600, y1: 900, c: '#a8b08a' },
    { x0: 0, y0: 1100, x1: 1100, y1: 2600, c: '#b5a583' },
    { x0: 1100, y0: 900, x1: 2100, y1: 1900, c: '#9aa0ad' },
    { x0: 2100, y0: 900, x1: 2880, y1: 2600, c: '#93a06e' },
    { x0: 0, y0: 2600, x1: 2600, y1: 3200, c: '#8d8578' },
  ];
  for (const z of zones) {
    const ix0 = Math.max(x0, z.x0), iy0 = Math.max(y0, z.y0);
    const ix1 = Math.min(x1, z.x1), iy1 = Math.min(y1, z.y1);
    if (ix1 <= ix0 || iy1 <= iy0) continue;
    ctx.fillStyle = z.c;
    ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
  }
}

function drawRoads(ctx, x0, y0, x1, y1) {
  ctx.fillStyle = '#3a3d44';
  // Vertical roads.
  for (let k = 0; k <= 10; k++) {
    const x = k * ROAD_PITCH;
    if (x + ROAD_HALF < x0 || x - ROAD_HALF > x1) continue;
    ctx.fillRect(x - ROAD_HALF, Math.max(y0, 0), ROAD_HALF * 2, Math.min(y1, WORLD_SIZE) - Math.max(y0, 0));
  }
  // Horizontal roads.
  for (let k = 0; k <= 10; k++) {
    const y = k * ROAD_PITCH;
    if (y + ROAD_HALF < y0 || y - ROAD_HALF > y1) continue;
    ctx.fillRect(Math.max(x0, 0), y - ROAD_HALF, Math.min(x1, WORLD_SIZE) - Math.max(x0, 0), ROAD_HALF * 2);
  }
  // Lane dashes.
  ctx.fillStyle = '#f2d06b';
  for (let k = 0; k <= 10; k++) {
    const x = k * ROAD_PITCH;
    if (x < x0 - 10 || x > x1 + 10) continue;
    for (let y = Math.floor(Math.max(y0, 0) / 48) * 48; y < Math.min(y1, WORLD_SIZE); y += 48) {
      ctx.fillRect(x - 2, y, 4, 22);
    }
    const y = k * ROAD_PITCH;
    if (y < y0 - 10 || y > y1 + 10) continue;
    for (let xx = Math.floor(Math.max(x0, 0) / 48) * 48; xx < Math.min(x1, WORLD_SIZE); xx += 48) {
      ctx.fillRect(xx, y - 2, 22, 4);
    }
  }
  // Sidewalk edges.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  for (let k = 0; k <= 10; k++) {
    const x = k * ROAD_PITCH;
    ctx.beginPath(); ctx.moveTo(x - ROAD_HALF, Math.max(y0, 0)); ctx.lineTo(x - ROAD_HALF, Math.min(y1, WORLD_SIZE)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + ROAD_HALF, Math.max(y0, 0)); ctx.lineTo(x + ROAD_HALF, Math.min(y1, WORLD_SIZE)); ctx.stroke();
    const y = k * ROAD_PITCH;
    ctx.beginPath(); ctx.moveTo(Math.max(x0, 0), y - ROAD_HALF); ctx.lineTo(Math.min(x1, WORLD_SIZE), y - ROAD_HALF); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(Math.max(x0, 0), y + ROAD_HALF); ctx.lineTo(Math.min(x1, WORLD_SIZE), y + ROAD_HALF); ctx.stroke();
  }
}

/** Draw one car, top-down. */
export function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = car.def.len;
  const W = car.def.wid;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  // Police livery.
  if (car.police) {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-L / 2 + 6, -W / 2 + 2, L - 12, W - 4);
    ctx.fillStyle = '#1e2a3a';
    ctx.fillRect(-L / 2 + 6, -W / 2 + 2, 10, W - 4);
    ctx.fillStyle = '#c22';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HPD', 2, 3);
    ctx.fillStyle = '#2a6fd0';
    ctx.fillRect(-4, -W / 2 - 1, 8, 4);
    ctx.fillStyle = '#d02020';
    ctx.fillRect(-4, W / 2 - 3, 8, 4);
  }
  // Windshield + roof.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.fillRect(-L * 0.18, -W / 2 + 3, L * 0.22, W - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-L * 0.32, -W / 2 + 3, L * 0.1, W - 6);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 2, -W / 2 + 3, 3, 5);
  ctx.fillRect(L / 2 - 2, W / 2 - 8, 3, 5);
  // Damage smoke marker.
  if (car.health < 45 && !car.dead) {
    ctx.fillStyle = 'rgba(90,90,90,0.8)';
    ctx.beginPath(); ctx.arc(-L / 4, 0, 6, 0, Math.PI * 2); ctx.fill();
  }
  if (car.dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, -L / 2, -W / 2, L, W, 7);
    ctx.fill();
  }
  ctx.restore();
  if (car.missionCar) {
    ctx.save();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(car.x, car.y, 34 + Math.sin(Date.now() / 300) * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

/** Draw one pedestrian. */
export function drawPed(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  const bob = Math.sin(p.walkPhase) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 4, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(0, bob * 0.3, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.arc(0, 5 + bob * 0.3, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4 - 2, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Draw the player on foot: a distinct figure with a direction tick. */
export function drawPlayer(ctx, player, aimAngle) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 5, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Jacket.
  ctx.fillStyle = '#e85d3d';
  ctx.beginPath(); ctx.arc(0, 2, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(0, -2, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(Math.cos(aimAngle) * 3, -2 + Math.sin(aimAngle) * 3, 2.5, 0, Math.PI * 2); ctx.fill();
  // Aim line (short, subtle).
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(Math.cos(aimAngle) * 10, Math.sin(aimAngle) * 10);
  ctx.lineTo(Math.cos(aimAngle) * 22, Math.sin(aimAngle) * 22); ctx.stroke();
  ctx.restore();
  // White ring so the player pops at a glance.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(player.x, player.y, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** Draw a Harbor PD foot officer. */
export function drawPoliceOfficer(ctx, u) {
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 5, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath(); ctx.arc(0, 2, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(0, -2, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(-7, -9, 14, 4);
  // Arrest progress ring.
  if (u.arrest > 0) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 15, -Math.PI / 2, -Math.PI / 2 + (u.arrest / 1.2) * Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/** Draw an enemy gunman. */
export function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 5, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = e.color;
  ctx.beginPath(); ctx.arc(0, 2, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c9a0';
  ctx.beginPath(); ctx.arc(0, -2, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(e.angle) * 16, Math.sin(e.angle) * 16); ctx.stroke();
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(-12, -18, 24, 4);
  ctx.fillStyle = '#e03a3a';
  ctx.fillRect(-12, -18, 24 * clamp(e.health / 60, 0, 1), 4);
  ctx.restore();
}

/** Draw bullets as tracers. */
export function drawBullets(ctx, bullets) {
  ctx.save();
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 2;
  for (const b of bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Objective marker: pulsing beacon + ground ring. */
export function drawObjective(ctx, obj, time) {
  if (!obj || obj.noMarker) return;
  const pulse = 1 + Math.sin(time * 4) * 0.15;
  ctx.save();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(obj.x, obj.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,209,102,0.25)';
  ctx.beginPath(); ctx.arc(obj.x, obj.y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
  // Beam.
  const grad = ctx.createLinearGradient(obj.x, obj.y - 220, obj.x, obj.y);
  grad.addColorStop(0, 'rgba(255,209,102,0)');
  grad.addColorStop(1, 'rgba(255,209,102,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(obj.x - 10, obj.y - 220, 20, 220);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(obj.x, obj.y - 8);
  ctx.lineTo(obj.x - 9, obj.y - 26);
  ctx.lineTo(obj.x + 9, obj.y - 26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
