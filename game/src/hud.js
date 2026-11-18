// hud.js — the HUD, minimap and menus of Sunset Harbor.
// All interface is drawn on the same canvas: cash, health, wanted stars,
// mission tracker, speed, clock, district label, and a circular minimap with
// roads, the player arrow, police blips and the objective marker. Menus are
// full-screen canvas screens: title, pause, busted/wasted, victory.

import { clamp, dist } from './random.js';
import { WORLD_SIZE, ROAD_PITCH, districtAt } from './city.js';
import { currentObjective, stepTimeLeft, nextMission, MISSIONS } from './missions.js';
import { roundRect } from './render.js';

/** Draw the in-game HUD. */
export function drawHud(ctx, game, vw, vh) {
  const { player, wanted, combat } = game;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Top-left: mission tracker.
  const obj = currentObjective(game.missions);
  const mission = game.missions.active ? game.missions.active.mission : nextMission(game.missions);
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  panel(ctx, 14, 12, 330, 74);
  ctx.fillStyle = '#ffd166';
  ctx.fillText(game.missions.active ? `JOB: ${mission.title.toUpperCase()}` : (mission ? `NEXT JOB: ${mission.title.toUpperCase()}` : 'FREE ROAM'), 26, 38);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const line = obj ? obj.label : (mission ? mission.briefing.split('.')[0] + '.' : 'All jobs done — the harbor is yours.');
  wrapText(ctx, line, 26, 60, 306, 19);
  const tl = stepTimeLeft(game.missions);
  if (tl !== null) {
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = tl < 10 ? '#ff5a4e' : '#7ee787';
    ctx.fillText(`${Math.ceil(tl)}s`, 26, 80);
  }

  // Top-right: cash, health, armor, ammo, clock.
  panel(ctx, vw - 254, 12, 240, 108);
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = '#7ee787';
  ctx.fillText(`$${game.money.toLocaleString('en-US')}`, vw - 28, 44);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(formatClock(game.clock), vw - 28, 66);
  ctx.fillText(districtAt(player.x, player.y), vw - 28, 86);
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(vw - 240, 96, 212, 12);
  ctx.fillStyle = player.health > 30 ? '#7ee787' : '#ff5a4e';
  ctx.fillRect(vw - 240, 96, 212 * clamp(player.health / 100, 0, 1), 12);
  if (combat.armor > 0) {
    ctx.fillStyle = '#6ab8ff';
    ctx.fillRect(vw - 240, 96, 212 * clamp(combat.armor / 100, 0, 1), 4);
  }

  // Wanted stars, top-center.
  const starY = 34;
  const starW = 30;
  const startX = vw / 2 - (5 * starW) / 2;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, startX + i * starW + 15, starY, 13, i < wanted.stars ? '#ffd166' : 'rgba(255,255,255,0.25)');
  }
  if (wanted.stars > 0) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('WANTED', vw / 2, starY + 30);
  }

  // Bottom-right: weapon + speed.
  panel(ctx, vw - 214, vh - 96, 200, 82);
  ctx.textAlign = 'right';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(combat.reloading > 0 ? 'RELOADING…' : `PISTOL  ${combat.ammo} / ${combat.reserve}`, vw - 28, vh - 64);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#cfe3ff';
  if (game.playerCar) {
    const kmh = Math.round(Math.abs(game.playerCar.speed) * 0.32);
    ctx.fillText(`${game.playerCar.def.name}  •  ${kmh} km/h`, vw - 28, vh - 40);
    ctx.fillText('E exit   SPACE handbrake', vw - 28, vh - 22);
  } else {
    ctx.fillText('F punch   CLICK shoot   E steal car', vw - 28, vh - 40);
    ctx.fillText('WASD move   SHIFT sprint', vw - 28, vh - 22);
  }

  // Mission banner.
  if (game.missions.banner) {
    const b = game.missions.banner;
    const a = clamp(b.timer, 0, 1);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 6;
    ctx.strokeText(b.title, vw / 2, vh * 0.3);
    ctx.fillText(b.title, vw / 2, vh * 0.3);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(b.sub, vw / 2, vh * 0.3 + 30);
    ctx.fillText(b.sub, vw / 2, vh * 0.3 + 30);
    ctx.globalAlpha = 1;
  }

  // Off-screen objective arrow.
  if (obj && !obj.noMarker) {
    const cx = vw / 2, cy = vh / 2;
    const sx = obj.x - game.cam.x + cx;
    const sy = obj.y - game.cam.y + cy;
    if (sx < 60 || sx > vw - 60 || sy < 60 || sy > vh - 60) {
      const ang = Math.atan2(sy - cy, sx - cx);
      const ax = cx + Math.cos(ang) * Math.min(vw / 2 - 70, dist(cx, cy, sx, sy));
      const ay = cy + Math.sin(ang) * Math.min(vh / 2 - 70, dist(cx, cy, sx, sy));
      const ex = cx + Math.cos(ang) * (Math.min(vw, vh) / 2 - 90);
      const ey = cy + Math.sin(ang) * (Math.min(vw, vh) / 2 - 90);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`${Math.round(dist(game.player.x, game.player.y, obj.x, obj.y))}m`, ex, ey + 28);
    }
  }

  drawMinimap(ctx, game, vw, vh);
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,12,24,0.62)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function formatClock(clockSeconds) {
  const h = Math.floor(clockSeconds / 3600) % 24;
  const m = Math.floor((clockSeconds % 3600) / 60);
  const hh = h < 10 ? `0${h}` : `${h}`;
  const mm = m < 10 ? `0${m}` : `${m}`;
  return `${hh}:${mm}`;
}

function drawStar(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Circular minimap, bottom-left: roads, player, police, objective, shops. */
export function drawMinimap(ctx, game, vw, vh) {
  const R = 96;
  const cx = R + 22;
  const cy = vh - R - 22;
  const scale = (R * 2) / WORLD_SIZE;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#16202e';
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  // Roads.
  ctx.strokeStyle = '#5a6472';
  ctx.lineWidth = 3;
  for (let k = 0; k <= 10; k++) {
    const p = k * ROAD_PITCH * scale;
    ctx.beginPath(); ctx.moveTo(cx - R + p, cy - R); ctx.lineTo(cx - R + p, cy + R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R, cy - R + p); ctx.lineTo(cx + R, cy - R + p); ctx.stroke();
  }
  // Water.
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(cx - R + 2960 * scale, cy - R, 240 * scale, R * 2);
  const px = (x) => cx - R + x * scale;
  const py = (y) => cy - R + y * scale;
  // Shops.
  for (const lm of game.landmarks) {
    ctx.fillStyle = '#7ee787';
    ctx.fillRect(px(lm.x) - 2, py(lm.y) - 2, 4, 4);
  }
  // Objective.
  const obj = currentObjective(game.missions);
  if (obj && !obj.noMarker) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(px(obj.x), py(obj.y), 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px(obj.x), py(obj.y), 9, 0, Math.PI * 2); ctx.stroke();
  }
  // Police blips.
  for (const u of game.police) {
    if (u.dead) continue;
    const ux = u.kind === 'car' ? u.car.x : u.x;
    const uy = u.kind === 'car' ? u.car.y : u.y;
    ctx.fillStyle = '#4a90ff';
    ctx.beginPath(); ctx.arc(px(ux), py(uy), 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Enemies.
  for (const e of game.enemies) {
    if (e.dead) continue;
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath(); ctx.arc(px(e.x), py(e.y), 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  ctx.fillStyle = '#ffffff';
  ctx.save();
  ctx.translate(px(game.player.x), py(game.player.y));
  ctx.rotate(game.playerCar ? game.playerCar.angle : game.player.aimAngle);
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // Rim + north label.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('N', cx, cy - R + 14);
}

/** Title screen. */
export function drawTitle(ctx, game, vw, vh) {
  drawBackdrop(ctx, vw, vh, '#ff9a3d', '#1a1030');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 10;
  ctx.strokeText('SUNSET HARBOR', vw / 2, vh * 0.3);
  ctx.fillText('SUNSET HARBOR', vw / 2, vh * 0.3);
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 5;
  ctx.strokeText('An open-world crime story — steal cars, run jobs, outrun Harbor PD', vw / 2, vh * 0.3 + 42);
  ctx.fillText('An open-world crime story — steal cars, run jobs, outrun Harbor PD', vw / 2, vh * 0.3 + 42);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.strokeText('Mara Voss is hiring. Eight jobs. One harbor. Yours, if you can take it.', vw / 2, vh * 0.3 + 72);
  ctx.fillText('Mara Voss is hiring. Eight jobs. One harbor. Yours, if you can take it.', vw / 2, vh * 0.3 + 72);

  const items = [
    game.hasSave ? 'CONTINUE  —  resume your saved game' : null,
    'NEW GAME  —  start the story from the first job',
    'HOW TO PLAY  —  WASD move / drive · E enter & steal cars · CLICK shoot · F punch',
    '          SPACE handbrake · SHIFT sprint · R reload · ESC pause · M mute',
  ].filter(Boolean);
  ctx.font = 'bold 20px system-ui, sans-serif';
  items.forEach((item, i) => {
    const y = vh * 0.52 + i * 40;
    const selected = game.menuIndex === i;
    if (selected) {
      ctx.fillStyle = 'rgba(255,209,102,0.25)';
      const w = ctx.measureText(item).width + 36;
      roundRect(ctx, vw / 2 - w / 2, y - 26, w, 34, 8);
      ctx.fill();
    }
    ctx.fillStyle = selected ? '#ffd166' : '#ffffff';
    ctx.fillText((selected ? '▶ ' : '   ') + item, vw / 2, y);
  });
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('Use ↑ ↓ + ENTER, or click a line. A fully original game — no real city, no real gang, no borrowed art.', vw / 2, vh - 28);
  ctx.restore();
}

/** Pause menu. */
export function drawPause(ctx, game, vw, vh) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,8,18,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('PAUSED', vw / 2, vh * 0.3);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Cash $${game.money.toLocaleString('en-US')}   •   Jobs done ${game.missions.completed.length} / ${MISSIONS.length}   •   ${districtAt(game.player.x, game.player.y)}`, vw / 2, vh * 0.3 + 40);
  const items = ['RESUME', game.audio.muted ? 'SOUND: OFF' : 'SOUND: ON', 'SAVE GAME', 'QUIT TO TITLE'];
  ctx.font = 'bold 22px system-ui, sans-serif';
  items.forEach((item, i) => {
    const y = vh * 0.5 + i * 44;
    const selected = game.menuIndex === i;
    if (selected) {
      ctx.fillStyle = 'rgba(255,209,102,0.25)';
      const w = ctx.measureText(item).width + 36;
      roundRect(ctx, vw / 2 - w / 2, y - 28, w, 36, 8);
      ctx.fill();
    }
    ctx.fillStyle = selected ? '#ffd166' : '#ffffff';
    ctx.fillText((selected ? '▶ ' : '   ') + item, vw / 2, y);
  });
  ctx.restore();
}

/** Wasted / busted screen. */
export function drawGameOver(ctx, game, vw, vh, kind) {
  ctx.save();
  ctx.fillStyle = kind === 'busted' ? 'rgba(20,40,90,0.78)' : 'rgba(60,10,10,0.78)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#6ab8ff' : '#ff5a4e';
  ctx.font = 'bold 88px system-ui, sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 10;
  const word = kind === 'busted' ? 'BUSTED' : 'WASTED';
  ctx.strokeText(word, vw / 2, vh * 0.42);
  ctx.fillText(word, vw / 2, vh * 0.42);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(kind === 'busted'
    ? 'Harbor PD hauled you in. You lost your heat — and a little cash.'
    : 'The harbor nearly kept you. You wake up at St. Anselm, patched up and poorer.', vw / 2, vh * 0.42 + 44);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('Press ENTER to get back out there', vw / 2, vh * 0.42 + 92);
  ctx.restore();
}

/** Victory screen. */
export function drawVictory(ctx, game, vw, vh) {
  drawBackdrop(ctx, vw, vh, '#ffd166', '#2a1040');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 10;
  ctx.strokeText('KING OF THE HARBOR', vw / 2, vh * 0.34);
  ctx.fillText('KING OF THE HARBOR', vw / 2, vh * 0.34);
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('All eight jobs done. Mara Voss shakes your hand. Sunset Harbor is yours.', vw / 2, vh * 0.34 + 46);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#7ee787';
  ctx.fillText(`Final take: $${game.money.toLocaleString('en-US')}   •   Press ENTER to keep playing free roam`, vw / 2, vh * 0.34 + 88);
  ctx.restore();
}

function drawBackdrop(ctx, vw, vh, c1, c2) {
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, c1);
  g.addColorStop(0.55, '#c95f7a');
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
  // Sun.
  ctx.fillStyle = '#fff3c9';
  ctx.beginPath(); ctx.arc(vw * 0.72, vh * 0.3, 90, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,243,201,0.35)';
  ctx.beginPath(); ctx.arc(vw * 0.72, vh * 0.3, 150, 0, Math.PI * 2); ctx.fill();
  // Skyline silhouette.
  ctx.fillStyle = 'rgba(20,10,40,0.85)';
  let x = 0;
  let i = 0;
  while (x < vw) {
    const w = 60 + ((i * 53) % 90);
    const h = 90 + ((i * 97) % 180);
    ctx.fillRect(x, vh - h - 60, w, h + 60);
    x += w + 8;
    i++;
  }
  // Sea band.
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(0, vh - 60, vw, 60);
}
