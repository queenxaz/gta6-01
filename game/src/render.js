// Everything the player sees: the sun-soaked city from above, the cars and people in
// it, the effects, and the HUD — cash and health, the wanted stars, the mission
// objective, and the minimap. Screens (title, pause, busted, wasted, story complete) are
// drawn here too, over the live city. The camera follows the player; on the title screen
// it drifts over the city.
import { BEACH, CAR, FONT, FONT_TITLE, PALETTE, ROADS, VIEW, WORLD } from './config.js';
import { clamp, lerp } from './random.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_BUSTED = 4;
export const SCREEN_WASTED = 5;
export const SCREEN_COMPLETE = 6;

const MINIMAP = { x: VIEW.width - 220, y: 56, w: 200, h: 140 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const cam = { x: 0, y: 0 };

  function cameraFor(world, screen) {
    const s = world.state;
    let tx;
    let ty;
    if (screen === SCREEN_TITLE) {
      tx = s.attract.x - VIEW.width / 2;
      ty = s.attract.y - VIEW.height / 2;
    } else {
      // Look a little ahead of a moving player or car.
      const look = s.player.car ? 0.22 : 0.12;
      const vx = s.player.car ? Math.cos(s.player.angle) * s.player.car.speed * look : 0;
      const vy = s.player.car ? Math.sin(s.player.angle) * s.player.car.speed * look : 0;
      tx = s.player.x + vx - VIEW.width / 2;
      ty = s.player.y + vy - VIEW.height / 2;
    }
    tx = clamp(tx, 0, WORLD.width - VIEW.width);
    ty = clamp(ty, 0, WORLD.height - VIEW.height);
    cam.x = lerp(cam.x, tx, screen === SCREEN_TITLE ? 0.02 : 0.4);
    cam.y = lerp(cam.y, ty, screen === SCREEN_TITLE ? 0.02 : 0.4);
    return cam;
  }

  function drawCity(world) {
    const city = world.city;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(cam.x, cam.y, VIEW.width, VIEW.height);
    // Mow stripes for a little texture.
    ctx.fillStyle = PALETTE.grassDark;
    const stripe = 120;
    const first = Math.floor(cam.y / stripe) * stripe;
    for (let y = first; y < cam.y + VIEW.height; y += stripe * 2) {
      ctx.fillRect(cam.x, y, VIEW.width, stripe);
    }
    // Bay water and sand beach along the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(cam.x, BEACH.sandY, VIEW.width, BEACH.waterY - BEACH.sandY);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(cam.x, BEACH.waterY, VIEW.width, WORLD.height - BEACH.waterY);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < 5; i += 1) {
      const wy = BEACH.waterY + 30 + i * 34;
      ctx.fillRect(cam.x, wy, VIEW.width, 6);
    }
    // Parks.
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Parking lots.
    for (const lot of city.lots) {
      ctx.fillStyle = '#5a5a60';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 30; x < lot.x + lot.w - 20; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, lot.y + 8);
        ctx.lineTo(x, lot.y + 34);
        ctx.stroke();
      }
    }
    // Roads: sidewalks first, then asphalt.
    for (const ax of ROADS.avenues) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(ax - ROADS.width / 2 - 14, cam.y, ROADS.width + 28, VIEW.height);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(ax - ROADS.width / 2, cam.y, ROADS.width, VIEW.height);
    }
    for (const sy of ROADS.streets) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(cam.x, sy - ROADS.width / 2 - 14, VIEW.width, ROADS.width + 28);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(cam.x, sy - ROADS.width / 2, VIEW.width, ROADS.width);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const ax of ROADS.avenues) {
      for (let y = Math.floor(cam.y / 44) * 44; y < cam.y + VIEW.height; y += 44) {
        if (ROADS.streets.some((sy) => Math.abs(y - sy) < ROADS.width / 2 + 6)) continue;
        ctx.fillRect(ax - 3, y, 6, 22);
      }
    }
    for (const sy of ROADS.streets) {
      for (let x = Math.floor(cam.x / 44) * 44; x < cam.x + VIEW.width; x += 44) {
        if (ROADS.avenues.some((ax) => Math.abs(x - ax) < ROADS.width / 2 + 6)) continue;
        ctx.fillRect(x, sy - 3, 22, 6);
      }
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = PALETTE.crosswalk;
    for (const ax of ROADS.avenues) {
      for (const sy of ROADS.streets) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(ax - 34 + i * 10, sy - ROADS.width / 2 - 4, 5, 8);
          ctx.fillRect(ax - 34 + i * 10, sy + ROADS.width / 2 - 4, 5, 8);
        }
      }
    }
    // Buildings: shadow, body, roof detail, tall ones get a darker flank.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 12, b.y + 12, Math.max(8, b.w / 4), Math.max(6, b.h / 5));
      if (b.tall) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(b.x + b.w - 18, b.y, 18, b.h);
      }
      if (b.name) {
        ctx.fillStyle = 'rgba(20,20,28,0.75)';
        ctx.font = `bold 13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2 + 4);
      }
    }
    // Trees: a dark ring and a light crown.
    for (const t of city.trees) {
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath();
      ctx.arc(t.x + 2, t.y + 3, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shop fronts: a coloured awning and a label on the sidewalk.
    for (const shop of city.shops) {
      const colors = { garage: '#e8a23a', spray: '#d84ad8', guns: '#b03030', hospital: '#e8e8e8', hideout: '#46c26a' };
      ctx.fillStyle = colors[shop.kind] || '#e8e8e8';
      ctx.fillRect(shop.x - 34, shop.y - 10, 68, 20);
      ctx.fillStyle = '#14141c';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(shop.label, shop.x, shop.y + 4);
    }
    // Harbour cranes and the bank.
    ctx.fillStyle = '#8a6f9e';
    ctx.fillRect(city.harbour.x - 60, city.harbour.y - 14, 120, 28);
    ctx.fillStyle = '#14141c';
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('HARBOR', city.harbour.x, city.harbour.y + 4);
    ctx.fillStyle = '#e8d47a';
    ctx.fillRect(city.bank.x - 34, city.bank.y - 10, 68, 20);
    ctx.fillStyle = '#14141c';
    ctx.fillText('BANK', city.bank.x, city.bank.y + 4);
  }

  function drawPickups(world) {
    const now = world.state.time;
    for (const pk of world.state.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(now * 3 + pk.bob) * 3;
      const y = pk.y + bob;
      if (pk.kind === 'package') {
        ctx.fillStyle = '#ffd23e';
        ctx.beginPath();
        ctx.arc(pk.x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#14141c';
        ctx.font = 'bold 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('$', pk.x, y + 5);
      } else if (pk.kind === 'ammo') {
        ctx.fillStyle = '#4a7fd8';
        ctx.fillRect(pk.x - 10, y - 8, 20, 16);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('AMMO', pk.x, y + 4);
      } else if (pk.kind === 'health') {
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(pk.x - 11, y - 11, 22, 22);
        ctx.fillStyle = '#e5484d';
        ctx.fillRect(pk.x - 3, y - 8, 6, 16);
        ctx.fillRect(pk.x - 8, y - 3, 16, 6);
      }
    }
  }

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -CAR.length / 2 + 4, -CAR.width / 2 + 5, CAR.length, CAR.width, 8);
    ctx.fill();
    ctx.fillStyle = car.color;
    roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    ctx.fill();
    // Windshield and rear window.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.fillRect(6, -CAR.width / 2 + 4, 10, CAR.width - 8);
    ctx.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 + 4, 7, CAR.width - 8);
    // Roof.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, -8, -CAR.width / 2 + 4, 14, CAR.width - 8, 4);
    ctx.fill();
    // Headlights.
    if (Math.abs(car.speed) > 20 || car.driver === 'player') {
      ctx.fillStyle = '#fff6b0';
      ctx.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 3, 4, 5);
      ctx.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 8, 4, 5);
    }
    // Police light bar, flashing.
    if (car.kind === 'police') {
      const on = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = on ? '#ff3b30' : '#2e6fd8';
      ctx.fillRect(-4, -CAR.width / 2 + 2, 8, 6);
      ctx.fillStyle = on ? '#2e6fd8' : '#ff3b30';
      ctx.fillRect(-4, CAR.width / 2 - 8, 8, 6);
    }
    if (car.kind === 'rival') {
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('RIVAL', 0, 4);
    }
    ctx.restore();
    if (car.health < 40 && !car.dead) {
      ctx.fillStyle = 'rgba(60,60,60,0.55)';
      ctx.beginPath();
      ctx.arc(car.x + 8, car.y - 6, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPed(ped) {
    if (ped.state === 'riding') return;
    const lying = ped.state === 'down';
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (lying) ctx.rotate(Math.PI / 2);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(1, 2, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    // Head.
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
    // Gang members and cops wear a marker so the player can read them at a glance.
    if (ped.kind === 'gang' && !lying) {
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -14);
    }
    if (ped.kind === 'cop' && !lying) {
      ctx.fillStyle = '#1f4fd8';
      ctx.fillRect(-6, -16, 12, 4);
    }
    ctx.restore();
  }

  function drawPlayer(world) {
    const p = world.state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.car) {
      // The car is drawn with the other cars; draw a soft outline around it instead.
      ctx.rotate(p.angle);
      ctx.strokeStyle = 'rgba(255,210,62,0.9)';
      ctx.lineWidth = 2;
      roundRect(ctx, -CAR.length / 2 - 4, -CAR.width / 2 - 4, CAR.length + 8, CAR.width + 8, 10);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.rotate(p.angle);
    // Aim line when the pistol is out.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(46, 0);
    ctx.stroke();
    // Body: yellow jacket, dark trousers.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 2, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerShirt;
    ctx.beginPath();
    ctx.arc(4, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(7, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(world) {
    for (const pt of world.state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMarkers(world) {
    const s = world.state;
    const time = s.time;
    const missionMarker = world.missions.marker(s);
    const markers = [];
    if (missionMarker) markers.push({ x: missionMarker.x, y: missionMarker.y, color: '#ffd23e', label: '★' });
    if (s.fareMarker) markers.push({ x: s.fareMarker.x, y: s.fareMarker.y, color: '#46c26a', label: '$' });
    for (const m of markers) {
      const pulse = 1 + Math.sin(time * 5) * 0.15;
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 26 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.x, m.y, 10 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = m.color;
      ctx.font = 'bold 16px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(m.label, m.x, m.y - 34);
      // A light beacon so the marker reads from far away.
      ctx.fillStyle = m.color + '22';
      ctx.fillRect(m.x - 3, m.y - 120, 6, 120);
    }
    // Off-screen marker: an arrow at the screen edge pointing at the mission.
    if (missionMarker) {
      const sx = missionMarker.x - cam.x;
      const sy = missionMarker.y - cam.y;
      if (sx < 0 || sx > VIEW.width || sy < 0 || sy > VIEW.height) {
        const cx = clamp(sx, 60, VIEW.width - 60);
        const cy = clamp(sy, 90, VIEW.height - 60);
        const ang = Math.atan2(sy - cy, sx - cx);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.fillStyle = '#ffd23e';
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawMinimap(world) {
    const s = world.state;
    const sx = MINIMAP.w / WORLD.width;
    const sy = MINIMAP.h / WORLD.height;
    ctx.save();
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(MINIMAP.x - 6, MINIMAP.y - 6, MINIMAP.w + 12, MINIMAP.h + 12);
    ctx.strokeStyle = PALETTE.panelBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(MINIMAP.x - 6, MINIMAP.y - 6, MINIMAP.w + 12, MINIMAP.h + 12);
    ctx.beginPath();
    ctx.rect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    ctx.clip();
    // Water and sand.
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(MINIMAP.x, MINIMAP.y + BEACH.waterY * sy, MINIMAP.w, MINIMAP.h - BEACH.waterY * sy);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(MINIMAP.x, MINIMAP.y + BEACH.sandY * sy, MINIMAP.w, (BEACH.waterY - BEACH.sandY) * sy);
    // Roads.
    ctx.strokeStyle = '#d8d2c0';
    ctx.lineWidth = 2;
    for (const ax of ROADS.avenues) {
      ctx.beginPath();
      ctx.moveTo(MINIMAP.x + ax * sx, MINIMAP.y);
      ctx.lineTo(MINIMAP.x + ax * sx, MINIMAP.y + MINIMAP.h);
      ctx.stroke();
    }
    for (const st of ROADS.streets) {
      ctx.beginPath();
      ctx.moveTo(MINIMAP.x, MINIMAP.y + st * sy);
      ctx.lineTo(MINIMAP.x + MINIMAP.w, MINIMAP.y + st * sy);
      ctx.stroke();
    }
    // Shops.
    ctx.font = 'bold 8px ' + FONT;
    ctx.textAlign = 'center';
    for (const shop of world.city.shops) {
      ctx.fillStyle = '#fff';
      ctx.fillText(shop.label[0], MINIMAP.x + shop.x * sx, MINIMAP.y + shop.y * sy + 3);
    }
    // Mission and fare markers.
    const mm = world.missions.marker(s);
    if (mm) {
      const pulse = 3 + Math.sin(s.time * 5) * 1.5;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(MINIMAP.x + mm.x * sx, MINIMAP.y + mm.y * sy, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.fareMarker) {
      ctx.fillStyle = '#46c26a';
      ctx.beginPath();
      ctx.arc(MINIMAP.x + s.fareMarker.x * sx, MINIMAP.y + s.fareMarker.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police.
    ctx.fillStyle = '#4a7fff';
    for (const car of s.cars) {
      if (car.kind === 'police' && !car.dead) {
        ctx.beginPath();
        ctx.arc(MINIMAP.x + car.x * sx, MINIMAP.y + car.y * sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Player.
    ctx.fillStyle = '#ffd23e';
    ctx.strokeStyle = '#14141c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(MINIMAP.x + s.player.x * sx, MINIMAP.y + s.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Viewport rectangle.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(MINIMAP.x + cam.x * sx, MINIMAP.y + cam.y * sy, VIEW.width * sx, VIEW.height * sy);
    ctx.restore();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 11px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR CITY', MINIMAP.x - 4, MINIMAP.y - 12);
  }

  function drawHud(world, ui) {
    const s = world.state;
    const p = s.player;
    ctx.textAlign = 'left';
    // Top-left: cash, health, ammo.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 12, 12, 250, 86, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelBorder;
    ctx.lineWidth = 1;
    roundRect(ctx, 12, 12, 250, 86, 10);
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText(`$${s.cash.toLocaleString('en-US')}`, 26, 44);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`Missions ${Math.min(world.missions.index, 8)}/8   Packages ${s.stats.packages}/12`, 26, 64);
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(26, 74, 150, 10);
    ctx.fillStyle = p.health > 40 ? PALETTE.green : PALETTE.red;
    ctx.fillRect(26, 74, 150 * clamp(p.health / 100, 0, 1), 10);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText('HP', 182, 83);
    // Ammo / weapon.
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(p.car ? 'DRIVING' : `PISTOL  ${p.ammo}`, 196, 44);
    // Wanted stars, top-right above the minimap.
    const starsY = 34;
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < s.wanted ? PALETTE.gold : 'rgba(255,255,255,0.25)';
      ctx.font = '26px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('★', MINIMAP.x + 16 + i * 26, starsY);
    }
    ctx.textAlign = 'left';
    if (s.wanted > 0) {
      ctx.fillStyle = PALETTE.red;
      ctx.font = `bold 12px ${FONT}`;
      ctx.fillText('WANTED', MINIMAP.x + 150, starsY - 2);
    }
    drawMinimap(world);
    // Mission objective, top-centre.
    const mission = world.missions.current();
    if (mission && !s.storyDone) {
      const text = world.missions.objectiveText();
      ctx.font = `bold 15px ${FONT}`;
      const w = ctx.measureText(text).width;
      const bx = VIEW.width / 2 - w / 2 - 14;
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, bx, 12, w + 28, 34, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText('◆', bx + 12, 35);
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(text, bx + 32, 35);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `12px ${FONT}`;
      ctx.fillText(`${mission.title} — ${mission.giver}`, VIEW.width / 2 - ctx.measureText(`${mission.title} — ${mission.giver}`).width / 2, 62);
    } else if (s.storyDone) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `bold 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('★ KING OF SOLMAR ★', VIEW.width / 2, 34);
      ctx.textAlign = 'left';
    }
    // Speed, bottom-right, when driving.
    if (p.car) {
      const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, VIEW.width - 130, VIEW.height - 64, 116, 50, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 26px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(String(kmh), VIEW.width - 52, VIEW.height - 28);
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('km/h', VIEW.width - 24, VIEW.height - 28);
      ctx.textAlign = 'left';
      // Car health.
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(VIEW.width - 118, VIEW.height - 20, 92, 6);
      ctx.fillStyle = p.car.health > 40 ? PALETTE.green : PALETTE.red;
      ctx.fillRect(VIEW.width - 118, VIEW.height - 20, 92 * clamp(p.car.health / 100, 0, 1), 6);
    }
    // Toast message, bottom-centre.
    if (s.message) {
      ctx.font = `bold 15px ${FONT}`;
      const w = ctx.measureText(s.message).width;
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, VIEW.width / 2 - w / 2 - 12, VIEW.height - 96, w + 24, 30, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.textAlign = 'center';
      ctx.fillText(s.message, VIEW.width / 2, VIEW.height - 75);
      ctx.textAlign = 'left';
    }
    // Context hint, bottom-left.
    let hint = '';
    if (!p.car) {
      const near = world.state.cars.some((c) => !c.dead && c.kind !== 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 80);
      if (near) hint = 'E — steal car';
      else hint = 'WASD move · Shift run · Click shoot · F punch · E enter car';
    } else {
      hint = 'W/S drive · A/D steer · Space handbrake · E get out';
    }
    ctx.fillStyle = 'rgba(20,20,28,0.6)';
    ctx.font = `12px ${FONT}`;
    ctx.fillText(hint, 16, VIEW.height - 16);
    if (ui && ui.muted) {
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('MUTED (M)', 16, VIEW.height - 36);
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(16,16,24,0.88)';
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,62,0.5)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
  }

  function drawTitle(world, ui) {
    ctx.fillStyle = 'rgba(10,12,20,0.45)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    panel(290, 110, 700, 500);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 92px ${FONT_TITLE}`;
    ctx.fillText('SOLMAR', VIEW.width / 2, 230);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 30px ${FONT_TITLE}`;
    ctx.fillText('O P E N   C I T Y', VIEW.width / 2, 272);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `16px ${FONT}`;
    ctx.fillText('A sun-soaked crime story. Steal cars, outrun the law,', VIEW.width / 2, 310);
    ctx.fillText('run the jobs — and take the city for yourself.', VIEW.width / 2, 332);
    const items = [];
    if (ui && ui.hasSave) items.push('CONTINUE — pick up where you left off');
    items.push('NEW GAME — start the story');
    items.push('HOW TO PLAY');
    ctx.font = `bold 19px ${FONT}`;
    items.forEach((item, i) => {
      const y = 396 + i * 40;
      const selected = ui && ui.menuIndex === i;
      if (selected) {
        ctx.fillStyle = 'rgba(255,210,62,0.18)';
        roundRect(ctx, 390, y - 26, 500, 34, 8);
        ctx.fill();
      }
      ctx.fillStyle = selected ? PALETTE.gold : PALETTE.text;
      ctx.fillText((selected ? '▶ ' : '   ') + item, VIEW.width / 2, y);
    });
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText('WASD move · E steal / enter car · Mouse aim · Click shoot · F punch · P pause · M mute', VIEW.width / 2, 556);
    if (ui && ui.best) {
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(`Best: $${ui.best.cash} · Missions ${ui.best.missions}/8 · Cars stolen ${ui.best.carsStolen}`, VIEW.width / 2, 584);
    }
    ctx.textAlign = 'left';
  }

  function drawHowTo() {
    ctx.fillStyle = 'rgba(10,12,20,0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    panel(330, 120, 620, 480);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 30px ${FONT_TITLE}`;
    ctx.fillText('HOW TO PLAY', VIEW.width / 2, 170);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `16px ${FONT}`;
    const lines = [
      'You are Jax Marlowe, a driver-for-hire in Solmar City.',
      'You owe Big Sal $5,000. Work it off, job by job.',
      '',
      'ON FOOT — WASD to move, Shift to run.',
      'Mouse to aim, Click to shoot. F to punch.',
      'E next to a car to steal it. Stealing brings heat.',
      '',
      'DRIVING — W accelerate, S brake / reverse, A D steer,',
      'Space handbrake. E to get out.',
      '',
      'WANTED — stars bring police cars and foot cops.',
      'Stay out of sight and the heat fades. The Spray Shop',
      'clears it for $250. Getting busted costs $150.',
      '',
      'MONEY — missions, taxi fares ($ markers) and hidden',
      'stashes ($100 each) pay. The Gun Barn sells ammo.',
      '',
      'Your progress saves automatically. Press Enter to go back.',
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW.width / 2, 206 + i * 24);
    });
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10,12,20,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    panel(440, 260, 400, 200);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 40px ${FONT_TITLE}`;
    ctx.fillText('PAUSED', VIEW.width / 2, 330);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `16px ${FONT}`;
    ctx.fillText('P or Esc — keep playing', VIEW.width / 2, 372);
    ctx.fillText('Enter — save and quit to title', VIEW.width / 2, 400);
    ctx.textAlign = 'left';
  }

  function drawEnd(title, lines) {
    ctx.fillStyle = 'rgba(10,12,20,0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    panel(380, 220, 520, 280);
    ctx.textAlign = 'center';
    ctx.fillStyle = title === 'KING OF SOLMAR' ? PALETTE.gold : PALETTE.red;
    ctx.font = `bold 44px ${FONT_TITLE}`;
    ctx.fillText(title, VIEW.width / 2, 300);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW.width / 2, 344 + i * 28);
    });
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `14px ${FONT}`;
    ctx.fillText('Press Enter to continue', VIEW.width / 2, 468);
    ctx.textAlign = 'left';
  }

  function draw(world, screen, ui) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    ctx.translate(-cam.x, -cam.y);
    drawCity(world);
    drawPickups(world);
    for (const car of world.state.cars) {
      if (!car.dead) drawCar(car, world.state.time);
    }
    for (const ped of world.state.peds) {
      if (!ped.dead) drawPed(ped);
    }
    drawPlayer(world);
    drawParticles(world);
    drawMarkers(world);
    ctx.restore();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(world, ui);
    if (screen === SCREEN_TITLE) drawTitle(world, ui);
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_OVER) drawEnd('GAME OVER', ['The city got the better of you this time.']);
    if (screen === SCREEN_BUSTED) drawEnd('BUSTED', ['The Solmar PD caught up with you.', 'You lost $150 and woke up at Solmar General.']);
    if (screen === SCREEN_WASTED) drawEnd('WASTED', ['You went down in the streets of Solmar.', 'You lost $150 and woke up at Solmar General.']);
    if (screen === SCREEN_COMPLETE) {
      drawEnd('KING OF SOLMAR', [
        'Every job done. Every cop outrun. The Tower is yours.',
        'Solmar City belongs to Jax Marlowe now.',
        'Free roam continues — keep the streets yours.',
      ]);
    }
    if (ui && ui.howTo) drawHowTo();
  }

  return { draw, cameraFor, get cam() { return cam; } };
}
