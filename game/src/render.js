// Sunset Harbor — canvas rendering: world, entities, marker, minimap.
'use strict';

var Render = {
  // Draw the world from the camera's top-left corner.
  drawWorld: function (ctx, cam) {
    var W = CFG.WORLD_W, H = CFG.WORLD_H;
    var vw = CFG.VIEW_W, vh = CFG.VIEW_H;
    // Golden-hour sky tint behind everything (visible off the map edges).
    ctx.fillStyle = '#e8a56b';
    ctx.fillRect(0, 0, vw, vh);

    // Ground: grass.
    ctx.fillStyle = PAL.grass;
    ctx.fillRect(-cam.x, -cam.y, W, H);

    // Park block.
    ctx.fillStyle = PAL.park;
    ctx.fillRect(960 - cam.x, 900 - cam.y, 640, 600);

    // Beach sand + sea.
    ctx.fillStyle = PAL.sand;
    ctx.fillRect(-cam.x, CFG.BEACH_Y - cam.y, W, CFG.SEA_Y - CFG.BEACH_Y);
    ctx.fillStyle = PAL.sea;
    ctx.fillRect(-cam.x, CFG.SEA_Y - cam.y, W, H - CFG.SEA_Y);
    // Marina water (east strip).
    ctx.fillStyle = PAL.seaDeep;
    ctx.fillRect(CFG.MARINA_X - cam.x, -cam.y, W - CFG.MARINA_X, CFG.BEACH_Y);
    // Sea shimmer lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (var wy = CFG.SEA_Y + 18; wy < H; wy += 34) {
      var off = ((G.time * 12 + wy) % 60) - 30;
      ctx.beginPath();
      ctx.moveTo(-cam.x + off, wy - cam.y);
      ctx.lineTo(-cam.x + off + 90, wy - cam.y);
      ctx.stroke();
    }

    // Sidewalks (lighter strips beside roads).
    ctx.fillStyle = PAL.sidewalk;
    var hw = CFG.ROAD_W / 2, sw = 26;
    for (var i = 0; i < CFG.ROADS_V.length; i++) {
      var x = CFG.ROADS_V[i];
      ctx.fillRect(x - hw - sw - cam.x, -cam.y, sw, CFG.BEACH_Y);
      ctx.fillRect(x + hw - cam.x, -cam.y, sw, CFG.BEACH_Y);
    }
    for (var j = 0; j < CFG.ROADS_H.length; j++) {
      var y = CFG.ROADS_H[j];
      ctx.fillRect(-cam.x, y - hw - sw - cam.y, CFG.MARINA_X, sw);
      ctx.fillRect(-cam.x, y + hw - cam.y, CFG.MARINA_X, sw);
    }

    // Roads.
    ctx.fillStyle = PAL.road;
    for (var vi = 0; vi < CFG.ROADS_V.length; vi++) {
      ctx.fillRect(CFG.ROADS_V[vi] - hw - cam.x, -cam.y, CFG.ROAD_W, CFG.BEACH_Y);
    }
    for (var hj = 0; hj < CFG.ROADS_H.length; hj++) {
      ctx.fillRect(-cam.x, CFG.ROADS_H[hj] - hw - cam.y, CFG.MARINA_X, CFG.ROAD_W);
    }
    // Lane markings (dashed centre lines).
    ctx.fillStyle = PAL.lane;
    ctx.save();
    ctx.globalAlpha = 0.8;
    for (var vi2 = 0; vi2 < CFG.ROADS_V.length; vi2++) {
      var x2 = CFG.ROADS_V[vi2];
      for (var y2 = 0; y2 < CFG.BEACH_Y; y2 += 46) {
        ctx.fillRect(x2 - 2 - cam.x, y2 - cam.y, 4, 24);
      }
    }
    for (var hj2 = 0; hj2 < CFG.ROADS_H.length; hj2++) {
      var y3 = CFG.ROADS_H[hj2];
      for (var x3 = 0; x3 < CFG.MARINA_X; x3 += 46) {
        ctx.fillRect(x3 - cam.x, y3 - 2 - cam.y, 24, 4);
      }
    }
    ctx.restore();

    // Piers.
    for (var pi = 0; pi < World.piers.length; pi++) {
      var pier = World.piers[pi];
      ctx.fillStyle = PAL.pier;
      ctx.fillRect(pier.x - cam.x, pier.y - cam.y, pier.w, pier.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      for (var px = pier.x + 14; px < pier.x + pier.w; px += 18) {
        ctx.beginPath();
        ctx.moveTo(px - cam.x, pier.y - cam.y);
        ctx.lineTo(px - cam.x, pier.y + pier.h - cam.y);
        ctx.stroke();
      }
    }

    // Buildings with long east shadows (golden hour sun from the west).
    for (var bi = 0; bi < World.buildings.length; bi++) {
      var b = World.buildings[bi];
      // Shadow: stretched to the east (+x), semi-transparent.
      ctx.fillStyle = 'rgba(60,30,20,0.28)';
      ctx.fillRect(b.x + 14 - cam.x, b.y + 10 - cam.y, b.w + 34, b.h + 8);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5 - cam.x, b.y + 5 - cam.y, b.w - 10, b.h - 10);
      // Windows.
      ctx.fillStyle = 'rgba(255,240,200,0.55)';
      var cols = Math.max(1, Math.floor(b.w / 26));
      var rows = Math.max(1, Math.floor(b.h / 26));
      for (var cx = 0; cx < cols; cx++) {
        for (var cy = 0; cy < rows; cy++) {
          ctx.fillRect(b.x + 10 + cx * 26 - cam.x, b.y + 10 + cy * 26 - cam.y, 12, 10);
        }
      }
    }

    // Trees.
    for (var ti = 0; ti < World.trees.length; ti++) {
      var t = World.trees[ti];
      ctx.fillStyle = 'rgba(60,30,20,0.25)';
      ctx.beginPath();
      ctx.ellipse(t.x + 10 - cam.x, t.y + 8 - cam.y, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.tree;
      ctx.beginPath();
      ctx.arc(t.x - cam.x, t.y - cam.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.treeDark;
      ctx.beginPath();
      ctx.arc(t.x - 4 - cam.x, t.y - 4 - cam.y, t.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // Street lamps.
    ctx.fillStyle = '#2c2c34';
    for (var li = 0; li < World.lamps.length; li++) {
      var l = World.lamps[li];
      ctx.fillRect(l.x - cam.x, l.y - cam.y, 3, 3);
    }

    // Place labels (drawn on the world so screenshots read as a city).
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    this._label(ctx, cam, 'SUNSET DINER', 1600, 900);
    this._label(ctx, cam, 'SUNSET DOCKS', 2880, 1500);
    this._label(ctx, cam, 'MARINA BANK', 2880, 1200);
    this._label(ctx, cam, 'WAREHOUSE', 2240, 900);
    this._label(ctx, cam, 'SAFEHOUSE', 960, 1500);
    this._label(ctx, cam, 'CENTRAL PARK', 1280, 1200);
    this._label(ctx, cam, 'SUNSET BEACH', 1500, 2140);
    ctx.textAlign = 'left';
  },

  _label: function (ctx, cam, text, x, y) {
    ctx.fillStyle = 'rgba(40,20,10,0.45)';
    var w = ctx.measureText(text).width;
    ctx.fillRect(x - w / 2 - 6 - cam.x, y - 13 - cam.y, w + 12, 20);
    ctx.fillStyle = '#fff2d0';
    ctx.fillText(text, x - cam.x, y + 2 - cam.y);
  },

  drawMarker: function (ctx, cam) {
    var target = Missions.markerTarget();
    if (!target) return;
    var pulse = 1 + 0.18 * Math.sin(G.time * 5);
    // Pulsing ring at the target.
    ctx.save();
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(target.x - cam.x, target.y - cam.y, target.r * 0.55 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,31,0.12)';
    ctx.fill();
    ctx.restore();
    // Edge arrow when the target is off-screen.
    var sx = target.x - cam.x, sy = target.y - cam.y;
    var vw = CFG.VIEW_W, vh = CFG.VIEW_H;
    if (sx < 0 || sx > vw || sy < 0 || sy > vh) {
      var cx = clamp(sx, 40, vw - 40), cy = clamp(sy, 60, vh - 90);
      var ang = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      var d = Math.round(dist(G.player.x, G.player.y, target.x, target.y));
      ctx.fillStyle = '#ffd21f';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d + 'm', cx, cy + 28);
      ctx.textAlign = 'left';
    }
  },

  drawCar: function (ctx, cam, car) {
    ctx.save();
    ctx.translate(car.x - cam.x, car.y - cam.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-car.w / 2 + 4, -car.h / 2 + 4, car.w, car.h);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 7);
    ctx.fill();
    // Cabin / windshield.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.beginPath();
    ctx.roundRect(-6, -car.h / 2 + 3, 14, car.h - 6, 4);
    ctx.fill();
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(car.w / 2 - 3, -car.h / 2 + 2, 3, 5);
    ctx.fillRect(car.w / 2 - 3, car.h / 2 - 7, 3, 5);
    // Police livery.
    if (car.type === 'police') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-car.w / 2 + 4, -car.h / 2 + 2, car.w - 8, 4);
      ctx.fillStyle = '#d02030';
      ctx.fillRect(-2, -car.h / 2 - 2, 5, 5);
      ctx.fillStyle = '#2a6bd0';
      ctx.fillRect(4, -car.h / 2 - 2, 5, 5);
    }
    // Wreck smoke is spawned as particles; show damage as a dark patch.
    if (car.hp < 40) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(-car.w / 4, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Health bar for damaged police / player car.
    if ((car.type === 'police' || car.driver === 'player') && car.hp < car.maxHp) {
      var bw = 40;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(car.x - bw / 2 - cam.x, car.y - 30 - cam.y, bw, 5);
      ctx.fillStyle = car.hp > 50 ? '#5ac06b' : '#d04040';
      ctx.fillRect(car.x - bw / 2 - cam.x, car.y - 30 - cam.y, bw * (car.hp / car.maxHp), 5);
    }
  },

  drawPed: function (ctx, cam, ped) {
    ctx.save();
    ctx.translate(ped.x - cam.x, ped.y - cam.y);
    ctx.rotate(ped.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 2, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawCop: function (ctx, cam, cop) {
    ctx.save();
    ctx.translate(cop.x - cam.x, cop.y - cam.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 2, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a4a8a';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd21f';
    ctx.fillRect(2, -3, 6, 6);
    ctx.fillStyle = '#e8c9a0';
    ctx.beginPath();
    ctx.arc(5, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Bust progress ring.
    if (cop.bustT > 0) {
      ctx.strokeStyle = '#ff4040';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cop.x - cam.x, cop.y - cam.y, 16, -Math.PI / 2, -Math.PI / 2 + (cop.bustT / CFG.BUST_TIME) * Math.PI * 2);
      ctx.stroke();
    }
  },

  drawPlayer: function (ctx, cam) {
    var p = G.player;
    if (!p.onFoot) return;
    ctx.save();
    ctx.translate(p.x - cam.x, p.y - cam.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 2, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lucia Vega: teal jacket, dark hair.
    ctx.fillStyle = '#0f8a7a';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1a12';
    ctx.beginPath();
    ctx.arc(5, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // Pistol.
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -1.5, 9, 3);
    ctx.restore();
  },

  drawBullets: function (ctx, cam) {
    ctx.fillStyle = '#ffe9a8';
    for (var i = 0; i < G.bullets.length; i++) {
      var b = G.bullets[i];
      ctx.beginPath();
      ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawParticles: function (ctx, cam) {
    for (var i = 0; i < G.particles.length; i++) {
      var pt = G.particles[i];
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  // Minimap: roads, water, park, player (green), marker (yellow), police (blue).
  drawMinimap: function (mctx, w, h) {
    var sx = w / CFG.WORLD_W, sy = h / CFG.WORLD_H;
    mctx.fillStyle = '#2a3a2a';
    mctx.fillRect(0, 0, w, h);
    // Park.
    mctx.fillStyle = '#4a7a34';
    mctx.fillRect(960 * sx, 900 * sy, 640 * sx, 600 * sy);
    // Water.
    mctx.fillStyle = '#2e7f9e';
    mctx.fillRect(0, CFG.SEA_Y * sy, w, (CFG.WORLD_H - CFG.SEA_Y) * sy);
    mctx.fillRect(CFG.MARINA_X * sx, 0, (CFG.WORLD_W - CFG.MARINA_X) * sx, CFG.BEACH_Y * sy);
    // Roads.
    mctx.fillStyle = '#8a8a8a';
    for (var i = 0; i < CFG.ROADS_V.length; i++) {
      mctx.fillRect(CFG.ROADS_V[i] * sx - 2, 0, 4, CFG.BEACH_Y * sy);
    }
    for (var j = 0; j < CFG.ROADS_H.length; j++) {
      mctx.fillRect(0, CFG.ROADS_H[j] * sy - 2, CFG.MARINA_X * sx, 4);
    }
    // Mission marker.
    var target = Missions.markerTarget();
    if (target) {
      mctx.fillStyle = '#ffd21f';
      mctx.beginPath();
      mctx.arc(target.x * sx, target.y * sy, 4, 0, Math.PI * 2);
      mctx.fill();
    }
    // Police dots.
    mctx.fillStyle = '#3a7ad0';
    for (var k = 0; k < G.cars.length; k++) {
      var c = G.cars[k];
      if (c.type === 'police') {
        mctx.beginPath();
        mctx.arc(c.x * sx, c.y * sy, 2.5, 0, Math.PI * 2);
        mctx.fill();
      }
    }
    // Player.
    mctx.fillStyle = '#2aff5a';
    mctx.beginPath();
    mctx.arc(G.player.x * sx, G.player.y * sy, 3.5, 0, Math.PI * 2);
    mctx.fill();
    mctx.strokeStyle = 'rgba(255,255,255,0.8)';
    mctx.lineWidth = 1;
    mctx.stroke();
  },
};
