// Sunset Harbor — cars, traffic, pedestrians, police, rivals, bullets.
// All entities live on the shared state G (see main.js createGameState).
'use strict';

var Entities = {
  // ---------- spawning ----------
  spawnAll: function (seed) {
    var rng = makeRng(hashSeed('sunset-harbor-entities-' + seed));
    G.cars = [];
    G.peds = [];
    G.cops = [];
    G.rivals = [];
    G.bullets = [];
    G.particles = [];
    // Traffic cars on the road grid. The axis follows the road point: a
    // point on a vertical road drives north/south on that road's centre
    // line, a point on a horizontal road drives east/west on its line.
    for (var i = 0; i < 14; i++) {
      var p = World.randomRoadPoint(rng);
      var vertical = CFG.ROADS_V.indexOf(p.x) >= 0;
      var lane = vertical ? p.x : p.y;
      var dir = rng.chance(0.5) ? 1 : -1;
      var c = this.makeCar(p.x, p.y, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), {
        color: rng.pick(CAR_COLORS)[1],
        name: rng.pick(CAR_COLORS)[0],
        driver: 'traffic',
      });
      c.axis = vertical ? 'v' : 'h';
      c.lane = lane;
      c.dir = dir;
      c.cruise = rng.range(85, 135);
      c.turnCooldown = rng.range(0, 3);
      G.cars.push(c);
    }
    // Parked cars along roads (free to steal). Orientation follows the road
    // the car sits on: a car on a vertical road faces north/south, on a
    // horizontal road east/west — never sideways across the road.
    for (var j = 0; j < 9; j++) {
      var pp = World.randomRoadPoint(rng);
      var onV = CFG.ROADS_V.indexOf(pp.x) >= 0;
      var angle = onV ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
      var off = (rng.chance(0.5) ? 1 : -1) * (CFG.ROAD_W / 2 - 14);
      var px = onV ? pp.x + off : pp.x;
      var py = onV ? pp.y : pp.y + off;
      if (World.hitsBuilding(px, py, 22) || World.isWater(px, py)) continue;
      var parked = this.makeCar(px, py, angle, {
        color: rng.pick(CAR_COLORS)[1],
        name: rng.pick(CAR_COLORS)[0],
        driver: null,
      });
      parked.speed = 0;
      G.cars.push(parked);
    }
    // Pedestrians on sidewalks.
    for (var k = 0; k < 26; k++) {
      var sp = World.randomSidewalkPoint(rng);
      var ped = {
        x: sp.x, y: sp.y, angle: rng.range(0, Math.PI * 2),
        speed: rng.range(35, 65), hp: CFG.PED_HP, dead: false,
        state: 'walk', fleeT: 0, axis: rng.chance(0.5) ? 'v' : 'h',
        dir: rng.chance(0.5) ? 1 : -1,
        color: rng.pick(['#e8b06b', '#c98a6b', '#8a6b4a', '#d9a0a0', '#a08a6b', '#7a5a4a']),
        shirt: rng.pick(['#c04a5e', '#4a7ab0', '#5aa06b', '#e0c04a', '#7a4ab0', '#e8e8e8', '#3a3a3a']),
        turnCooldown: rng.range(0, 2),
      };
      G.peds.push(ped);
    }
  },

  makeCar: function (x, y, angle, opts) {
    return {
      x: x, y: y, angle: angle, speed: 0,
      w: 44, h: 22, radius: 20,
      hp: 100, maxHp: 100,
      color: opts.color || '#e07840',
      name: opts.name || 'Car',
      type: opts.type || 'car',
      driver: opts.driver || null,
      axis: 'v', lane: x, dir: 1, cruise: 110,
      turnCooldown: 0, smokeT: 0, wrecked: false,
      steer: 0,
    };
  },

  spawnSportscar: function (x, y) {
    var car = this.makeCar(x, y, Math.PI, {
      color: SPORTSCAR_COLOR, name: 'Sunset GT', type: 'sports', driver: null,
    });
    car.hp = 140; car.maxHp = 140;
    G.cars.push(car);
    return car;
  },

  // ---------- cars ----------
  nearestCar: function (x, y, maxDist, allowPolice) {
    var best = null, bestD = maxDist * maxDist;
    for (var i = 0; i < G.cars.length; i++) {
      var c = G.cars[i];
      if (c.type === 'police' && !allowPolice) continue;
      if (c.wrecked) continue;
      var d = dist2(x, y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  },

  // E pressed: enter the nearest car, or exit the current one.
  tryEnterExit: function () {
    var p = G.player;
    if (p.onFoot) {
      var car = this.nearestCar(p.x, p.y, 58, false);
      if (!car) { this.toast('No car nearby — walk up to one and press E'); return; }
      var hadDriver = car.driver === 'traffic';
      if (hadDriver) {
        car.driver = null;
        G.stats.carsStolen++;
        this.addWanted(1, 'car theft');
        this.toast('You stole the car! +1 wanted star');
        AudioSys.chime();
        Missions.onEvent('steal');
      }
      car.driver = 'player';
      p.onFoot = false;
      p.car = car;
      p.x = car.x; p.y = car.y;
      AudioSys.click();
      Missions.onEvent('enterCar', car);
    } else {
      var cur = p.car;
      if (!cur) { p.onFoot = true; return; }
      cur.driver = null;
      cur.speed = 0;
      p.onFoot = true;
      p.car = null;
      // Step out to the side of the car.
      var sx = cur.x + Math.cos(cur.angle + Math.PI / 2) * 30;
      var sy = cur.y + Math.sin(cur.angle + Math.PI / 2) * 30;
      if (!World.hitsBuilding(sx, sy, 14) && !World.isWater(sx, sy)) { p.x = sx; p.y = sy; }
      else { p.x = cur.x - Math.cos(cur.angle + Math.PI / 2) * 30; p.y = cur.y - Math.sin(cur.angle + Math.PI / 2) * 30; }
      AudioSys.click();
    }
  },

  updateDriving: function (dt) {
    var p = G.player;
    var car = p.car;
    if (!car) return;
    var throttle = Input.down('KeyW') || Input.down('ArrowUp') ? 1 : 0;
    var brake = Input.down('KeyS') || Input.down('ArrowDown') ? 1 : 0;
    var steerIn = (Input.down('KeyA') || Input.down('ArrowLeft') ? -1 : 0) +
                  (Input.down('KeyD') || Input.down('ArrowRight') ? 1 : 0);
    var maxSpeed = car.type === 'sports' ? 430 : 330;
    var maxReverse = 120;
    if (throttle) car.speed += 260 * dt;
    if (brake) {
      if (car.speed > 5) car.speed -= 420 * dt;
      else car.speed -= 170 * dt;
    }
    if (!throttle && !brake) car.speed -= Math.sign(car.speed) * 90 * dt;
    if (Math.abs(car.speed) < 4 && !throttle && !brake) car.speed = 0;
    car.speed = clamp(car.speed, -maxReverse, maxSpeed);
    // Steering scales with speed.
    var steerFactor = clamp(Math.abs(car.speed) / 120, 0, 1);
    car.angle += steerIn * 2.4 * steerFactor * dt * (car.speed >= 0 ? 1 : -1);
    var before = { x: car.x, y: car.y };
    var dx = Math.cos(car.angle) * car.speed * dt;
    var dy = Math.sin(car.angle) * car.speed * dt;
    World.moveCircle(car, dx, dy, car.radius);
    // Crash into a building at speed: damage + slow down (throttled so
    // pushing against a wall does not shred the car in one second).
    car.crashT = Math.max(0, (car.crashT || 0) - dt);
    var moved = dist(before.x, before.y, car.x, car.y);
    var wantedMove = Math.abs(car.speed) * dt;
    if (car.crashT <= 0 && wantedMove > 0.01 && moved < wantedMove * 0.35 && Math.abs(car.speed) > 150) {
      car.crashT = 0.8;
      var dmg = (Math.abs(car.speed) - 150) * 0.12;
      car.hp -= dmg;
      car.speed *= 0.35;
      AudioSys.crash();
      this.spawnParticles(car.x, car.y, 10, '#c9c9c9', 160);
      if (car.hp <= 0) this.wreckCar(car);
    }
    if (car.wrecked) {
      car.smokeT -= dt;
      if (car.smokeT <= 0) {
        car.smokeT = 0.12;
        this.spawnParticles(car.x, car.y - 6, 1, '#8a8a8a', 40);
      }
    }
    p.x = car.x; p.y = car.y;
    p.angle = car.angle;
  },

  wreckCar: function (car) {
    car.wrecked = true;
    car.speed = 0;
    if (car.driver === 'player') {
      G.player.onFoot = true;
      G.player.car = null;
      car.driver = null;
      this.toast('Your car is wrecked! You bail out.');
    } else if (car.driver === 'traffic') {
      car.driver = null;
      this.toast('A traffic car was wrecked.');
    } else {
      car.driver = null;
    }
    this.spawnParticles(car.x, car.y, 16, '#666666', 120);
    AudioSys.crash();
  },

  // Push overlapping cars apart (cheap circle collision). After the push,
  // a car that ended up inside water or a building is put back where it
  // was — otherwise a shove near the marina can beach a car in the sea.
  separateCars: function () {
    var cars = G.cars;
    for (var i = 0; i < cars.length; i++) {
      for (var j = i + 1; j < cars.length; j++) {
        var a = cars[i], b = cars[j];
        var d2 = dist2(a.x, a.y, b.x, b.y);
        var min = (a.radius + b.radius) * 0.9;
        if (d2 < min * min && d2 > 0.01) {
          var d = Math.sqrt(d2);
          var push = (min - d) / 2;
          var nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
          var ax0 = a.x, ay0 = a.y, bx0 = b.x, by0 = b.y;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          if (World.isWater(a.x, a.y) || World.hitsBuilding(a.x, a.y, a.radius)) { a.x = ax0; a.y = ay0; }
          if (World.isWater(b.x, b.y) || World.hitsBuilding(b.x, b.y, b.radius)) { b.x = bx0; b.y = by0; }
          // Ram damage when a police car hits the player's car fast:
          // throttled to one hit per second so a stuck police car cannot
          // shred the player's car in a single frame burst.
          var ram = (a.type === 'police' && b.driver === 'player') ? a :
                    (b.type === 'police' && a.driver === 'player') ? b : null;
          var victim = ram === a ? b : a;
          if (ram && Math.abs(ram.speed) > 120) {
            if (!ram.ramT || ram.ramT <= 0) {
              ram.ramT = 1.0;
              victim.hp -= 6;
              if (victim.hp <= 0) this.wreckCar(victim);
            }
          }
        }
      }
    }
  },

  updateTraffic: function (dt) {
    for (var i = 0; i < G.cars.length; i++) {
      var c = G.cars[i];
      if (c.driver !== 'traffic' || c.wrecked) continue;
      c.turnCooldown -= dt;
      // Slow for a car ahead on the same lane.
      var target = c.cruise;
      for (var j = 0; j < G.cars.length; j++) {
        if (i === j) continue;
        var o = G.cars[j];
        var along, side;
        if (c.axis === 'v') { along = (o.y - c.y) * c.dir; side = Math.abs(o.x - c.lane); }
        else { along = (o.x - c.x) * c.dir; side = Math.abs(o.y - c.lane); }
        if (along > 0 && along < 78 && side < 26) { target = 0; break; }
      }
      c.speed = lerp(c.speed, target, clamp(dt * 2, 0, 1));
      // At an intersection, maybe turn onto the crossing road.
      var nearCross = false, crossCoord = 0;
      if (c.axis === 'v') {
        for (var k = 0; k < CFG.ROADS_H.length; k++) {
          if (Math.abs(c.y - CFG.ROADS_H[k]) < 14) { nearCross = true; crossCoord = CFG.ROADS_H[k]; break; }
        }
      } else {
        for (var k2 = 0; k2 < CFG.ROADS_V.length; k2++) {
          if (Math.abs(c.x - CFG.ROADS_V[k2]) < 14) { nearCross = true; crossCoord = CFG.ROADS_V[k2]; break; }
        }
      }
      if (nearCross && c.turnCooldown <= 0 && Math.random() < 0.35) {
        c.turnCooldown = 4;
        if (c.axis === 'v') { c.axis = 'h'; c.lane = crossCoord; c.dir = Math.random() < 0.5 ? 1 : -1; }
        else { c.axis = 'v'; c.lane = crossCoord; c.dir = Math.random() < 0.5 ? 1 : -1; }
      }
      // Steer angle toward travel direction.
      var wantAngle = c.axis === 'v' ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
      c.angle += angleDiff(c.angle, wantAngle) * clamp(dt * 3, 0, 1);
      var dx = Math.cos(c.angle) * c.speed * dt;
      var dy = Math.sin(c.angle) * c.speed * dt;
      // Traffic stays on roads: clamp to its lane centre line.
      if (c.axis === 'v') c.x = c.lane; else c.y = c.lane;
      World.moveCircle(c, dx, dy, c.radius);
      if (c.axis === 'v') c.x = c.lane; else c.y = c.lane;
    }
  },

  // ---------- pedestrians ----------
  updatePeds: function (dt) {
    var p = G.player;
    for (var i = 0; i < G.peds.length; i++) {
      var ped = G.peds[i];
      if (ped.dead) continue;
      // Flee from gunfire or a near car.
      var threat = false;
      if (G.lastShotT !== undefined && G.time - G.lastShotT < 1.2) {
        if (dist(ped.x, ped.y, G.lastShotX, G.lastShotY) < 320) threat = true;
      }
      if (!p.onFoot && dist(ped.x, ped.y, p.x, p.y) < 90) threat = true;
      if (threat) { ped.state = 'flee'; ped.fleeT = 2.5; }
      if (ped.state === 'flee') {
        ped.fleeT -= dt;
        if (ped.fleeT <= 0) ped.state = 'walk';
        var away = angleTo(p.x, p.y, ped.x, ped.y);
        ped.angle = away;
        World.moveCircle(ped, Math.cos(away) * 150 * dt, Math.sin(away) * 150 * dt, 10);
        continue;
      }
      // Walk along the sidewalk, turn at intersections.
      ped.turnCooldown -= dt;
      var nearCross = false;
      if (ped.axis === 'v') {
        for (var k = 0; k < CFG.ROADS_H.length; k++) {
          if (Math.abs(ped.y - CFG.ROADS_H[k]) < 16) { nearCross = true; break; }
        }
      } else {
        for (var k2 = 0; k2 < CFG.ROADS_V.length; k2++) {
          if (Math.abs(ped.x - CFG.ROADS_V[k2]) < 16) { nearCross = true; break; }
        }
      }
      if (nearCross && ped.turnCooldown <= 0 && Math.random() < 0.3) {
        ped.turnCooldown = 3;
        ped.axis = ped.axis === 'v' ? 'h' : 'v';
        ped.dir = Math.random() < 0.5 ? 1 : -1;
      }
      var want = ped.axis === 'v' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
      ped.angle = want;
      // A walker that turned onto a horizontal line can reach the marina
      // water: look ahead, and turn back before ever touching the sea.
      var aheadX = ped.x + Math.cos(ped.angle) * 32;
      var aheadY = ped.y + Math.sin(ped.angle) * 32;
      if (World.isWater(aheadX, aheadY)) {
        ped.dir *= -1;
      } else {
        World.moveCircle(ped,
          Math.cos(ped.angle) * ped.speed * dt,
          Math.sin(ped.angle) * ped.speed * dt, 10);
      }
      // Peds may cross the road at intersections while turning; that is fine.
    }
  },

  // ---------- wanted / police ----------
  addWanted: function (n, reason) {
    var w = G.wanted;
    w.stars = clamp(w.stars + n, 0, 5);
    w.lastCrime = G.time;
    w.decayT = 0;
    if (n > 0) G.stats.crimes++;
  },

  updateWanted: function (dt) {
    var w = G.wanted;
    if (w.stars <= 0) return;
    // Is a cop near?
    var copNear = false;
    for (var i = 0; i < G.cars.length; i++) {
      var c = G.cars[i];
      if (c.type === 'police' && dist(c.x, c.y, G.player.x, G.player.y) < CFG.COP_NEAR_DIST) { copNear = true; break; }
    }
    if (!copNear) {
      for (var j = 0; j < G.cops.length; j++) {
        if (dist(G.cops[j].x, G.cops[j].y, G.player.x, G.player.y) < CFG.COP_NEAR_DIST) { copNear = true; break; }
      }
    }
    if (G.time - w.lastCrime > CFG.WANTED_DECAY_IDLE && !copNear) {
      w.decayT += dt;
      if (w.decayT >= CFG.WANTED_DECAY_STEP) {
        w.decayT = 0;
        w.stars--;
        this.toast('Heat is dying down… ' + w.stars + ' star' + (w.stars === 1 ? '' : 's'));
      }
    } else {
      w.decayT = 0;
    }
  },

  updatePolice: function (dt) {
    var want = Math.min(G.wanted.stars, 4);
    var have = 0;
    for (var i = 0; i < G.cars.length; i++) if (G.cars[i].type === 'police') have++;
    // Spawn police cars at road points near the player.
    while (have < want) {
      var base = World.nearestRoadPoint(G.player.x, G.player.y);
      var ang = Math.random() * Math.PI * 2;
      var sx = clamp(base.x + Math.cos(ang) * 520, 80, CFG.MARINA_X - 60);
      var sy = clamp(base.y + Math.sin(ang) * 520, 80, CFG.BEACH_Y - 60);
      var rp = World.nearestRoadPoint(sx, sy);
      var pc = this.makeCar(rp.x, rp.y, 0, { color: POLICE_COLOR, name: 'Harbor Patrol', type: 'police', driver: 'police' });
      pc.hp = 120; pc.maxHp = 120;
      G.cars.push(pc);
      have++;
    }
    // Despawn police when wanted is gone.
    if (want === 0) {
      G.cars = G.cars.filter(function (c) { return c.type !== 'police'; });
    }
    // Chase the player.
    var p = G.player;
    for (var j = 0; j < G.cars.length; j++) {
      var car = G.cars[j];
      if (car.type !== 'police' || car.wrecked) continue;
      car.ramT = Math.max(0, (car.ramT || 0) - dt);
      var targetAngle = angleTo(car.x, car.y, p.x, p.y);
      car.angle += angleDiff(car.angle, targetAngle) * clamp(dt * 2.2, 0, 1);
      var d = dist(car.x, car.y, p.x, p.y);
      var wantSpeed = d > 260 ? 290 : 230;
      car.speed = lerp(car.speed, wantSpeed, clamp(dt * 1.5, 0, 1));
      var before = { x: car.x, y: car.y };
      World.moveCircle(car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, car.radius);
      var moved = dist(before.x, before.y, car.x, car.y);
      if (Math.abs(car.speed) * dt > 0.01 && moved < Math.abs(car.speed) * dt * 0.3) {
        car.speed *= 0.4;
      }
      // Ram the player on foot.
      if (p.onFoot && d < 34) {
        this.damagePlayer(12 * dt * 10, 'rammed');
      }
      car.smokeT -= dt;
      if (car.hp < 40 && car.smokeT <= 0) {
        car.smokeT = 0.15;
        this.spawnParticles(car.x, car.y, 1, '#8a8a8a', 40);
      }
    }
    AudioSys.setSiren(have > 0 && G.wanted.stars > 0);
    AudioSys.updateSiren(dt);
  },

  updateFootCops: function (dt) {
    var p = G.player;
    var wantCops = (G.wanted.stars >= 2 && p.onFoot) ? Math.min(2, G.wanted.stars - 1) : 0;
    while (G.cops.length < wantCops) {
      var base = World.nearestRoadPoint(p.x, p.y);
      var ang = Math.random() * Math.PI * 2;
      G.cops.push({
        x: clamp(base.x + Math.cos(ang) * 300, 40, CFG.WORLD_W - 40),
        y: clamp(base.y + Math.sin(ang) * 300, 40, CFG.WORLD_H - 40),
        angle: 0, speed: 235, hp: CFG.COP_HP, bustT: 0, dead: false,
        shootT: 0,
      });
    }
    if (wantCops === 0) G.cops = [];
    for (var i = 0; i < G.cops.length; i++) {
      var cop = G.cops[i];
      if (cop.dead) continue;
      var d = dist(cop.x, cop.y, p.x, p.y);
      cop.angle = angleTo(cop.x, cop.y, p.x, p.y);
      if (d > 26) {
        World.moveCircle(cop, Math.cos(cop.angle) * cop.speed * dt, Math.sin(cop.angle) * cop.speed * dt, 11);
      }
      // Bust: within ~34px for 1.2s.
      if (d < CFG.BUST_DIST) {
        cop.bustT += dt;
        if (cop.bustT >= CFG.BUST_TIME) {
          Main.busted();
          return;
        }
      } else {
        cop.bustT = 0;
      }
      // Cops shoot if the player is far and armed.
      cop.shootT -= dt;
      if (d > 120 && d < 420 && cop.shootT <= 0 && p.onFoot) {
        cop.shootT = 1.4;
        this.fireBullet(cop.x, cop.y, cop.angle + (Math.random() - 0.5) * 0.2, 8, 'enemy');
        AudioSys.enemyShot();
      }
    }
  },

  // ---------- rivals (mission 4) ----------
  spawnRivals: function (x, y, count) {
    for (var i = 0; i < count; i++) {
      G.rivals.push({
        x: x + (Math.random() - 0.5) * 180,
        y: y + (Math.random() - 0.5) * 180,
        angle: 0, speed: 120, hp: CFG.RIVAL_HP, dead: false,
        shootT: Math.random() * 0.8, moveT: 0,
      });
    }
  },

  updateRivals: function (dt) {
    var p = G.player;
    for (var i = 0; i < G.rivals.length; i++) {
      var r = G.rivals[i];
      if (r.dead) continue;
      var d = dist(r.x, r.y, p.x, p.y);
      r.angle = angleTo(r.x, r.y, p.x, p.y);
      r.moveT -= dt;
      if (d > 260 && r.moveT <= 0) {
        r.moveT = 0.5;
        World.moveCircle(r, Math.cos(r.angle) * r.speed * dt * 8, Math.sin(r.angle) * r.speed * dt * 8, 11);
      } else if (d <= 260) {
        // Strafe sideways while shooting.
        var strafe = r.angle + Math.PI / 2;
        World.moveCircle(r, Math.cos(strafe) * 40 * dt, Math.sin(strafe) * 40 * dt, 11);
      }
      r.shootT -= dt;
      if (d < 460 && r.shootT <= 0) {
        r.shootT = 1.1 + Math.random() * 0.5;
        this.fireBullet(r.x, r.y, r.angle + (Math.random() - 0.5) * 0.25, 8, 'enemy');
        AudioSys.enemyShot();
      }
    }
  },

  // ---------- combat ----------
  fireBullet: function (x, y, angle, damage, from) {
    G.bullets.push({
      x: x + Math.cos(angle) * 22, y: y + Math.sin(angle) * 22,
      vx: Math.cos(angle) * CFG.BULLET_SPEED, vy: Math.sin(angle) * CFG.BULLET_SPEED,
      life: CFG.BULLET_RANGE / CFG.BULLET_SPEED, damage: damage, from: from,
    });
    this.spawnParticles(x + Math.cos(angle) * 26, y + Math.sin(angle) * 26, 3, '#ffd76b', 200);
  },

  playerShoot: function () {
    var p = G.player;
    if (!p.onFoot) return;
    var cam = G.camera;
    var wx = cam.x + Input.mouseX, wy = cam.y + Input.mouseY;
    var angle = angleTo(p.x, p.y, wx, wy);
    p.angle = angle;
    this.fireBullet(p.x, p.y, angle, CFG.PISTOL_DAMAGE, 'player');
    G.lastShotX = p.x; G.lastShotY = p.y; G.lastShotT = G.time;
    AudioSys.shot();
    p.shootCooldown = 0.28;
  },

  updateBullets: function (dt) {
    var p = G.player;
    for (var i = G.bullets.length - 1; i >= 0; i--) {
      var b = G.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      var dead = b.life <= 0 || World.hitsBuilding(b.x, b.y, 2) ||
        b.x < 0 || b.x > CFG.WORLD_W || b.y < 0 || b.y > CFG.WORLD_H;
      if (!dead) {
        if (b.from === 'player') {
          // Hit peds.
          for (var pi = 0; pi < G.peds.length; pi++) {
            var ped = G.peds[pi];
            if (!ped.dead && dist2(b.x, b.y, ped.x, ped.y) < 18 * 18) {
              ped.dead = true;
              this.spawnParticles(ped.x, ped.y, 12, '#b02020', 140);
              this.addWanted(1, 'ped killed');
              this.toast('A pedestrian was hit! +1 wanted star');
              dead = true;
              break;
            }
          }
          // Hit foot cops.
          if (!dead) {
            for (var ci = 0; ci < G.cops.length; ci++) {
              var cop = G.cops[ci];
              if (!cop.dead && dist2(b.x, b.y, cop.x, cop.y) < 18 * 18) {
                cop.hp -= b.damage;
                this.spawnParticles(cop.x, cop.y, 8, '#b02020', 140);
                if (cop.hp <= 0) {
                  cop.dead = true;
                  this.addWanted(2, 'cop killed');
                  this.toast('You took down a cop! +2 wanted stars');
                }
                dead = true;
                break;
              }
            }
          }
          // Hit rivals.
          if (!dead) {
            for (var ri = 0; ri < G.rivals.length; ri++) {
              var rv = G.rivals[ri];
              if (!rv.dead && dist2(b.x, b.y, rv.x, rv.y) < 18 * 18) {
                rv.hp -= b.damage;
                this.spawnParticles(rv.x, rv.y, 8, '#b02020', 140);
                if (rv.hp <= 0) {
                  rv.dead = true;
                  G.stats.kills++;
                  Missions.onEvent('rivalKilled');
                }
                dead = true;
                break;
              }
            }
          }
          // Hit police cars.
          if (!dead) {
            for (var ki = 0; ki < G.cars.length; ki++) {
              var car = G.cars[ki];
              if (car.type === 'police' && !car.wrecked && dist2(b.x, b.y, car.x, car.y) < 24 * 24) {
                car.hp -= b.damage;
                this.spawnParticles(b.x, b.y, 6, '#ffb020', 120);
                if (car.hp <= 0) this.wreckCar(car);
                dead = true;
                break;
              }
            }
          }
        } else {
          // Enemy bullet vs the player.
          if (p.onFoot && dist2(b.x, b.y, p.x, p.y) < 16 * 16) {
            this.damagePlayer(b.damage, 'shot');
            dead = true;
          } else if (!p.onFoot && p.car && dist2(b.x, b.y, p.car.x, p.car.y) < 24 * 24) {
            p.car.hp -= b.damage * 0.5;
            if (p.car.hp <= 0) this.wreckCar(p.car);
            dead = true;
          }
        }
      }
      if (dead) G.bullets.splice(i, 1);
    }
  },

  damagePlayer: function (amount, cause) {
    var p = G.player;
    if (p.health <= 0 || G.state !== 'playing') return;
    p.health -= amount;
    G.damageFlash = 0.5;
    if (p.health <= 0) {
      p.health = 0;
      Main.wasted();
    }
  },

  // ---------- particles ----------
  spawnParticles: function (x, y, n, color, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = (0.3 + Math.random() * 0.7) * (speed || 120);
      G.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.5, maxLife: 0.9,
        color: color, size: 2 + Math.random() * 3,
      });
    }
  },

  updateParticles: function (dt) {
    for (var i = G.particles.length - 1; i >= 0; i--) {
      var pt = G.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= (1 - 2 * dt);
      pt.vy *= (1 - 2 * dt);
      pt.life -= dt;
      if (pt.life <= 0) G.particles.splice(i, 1);
    }
  },

  // ---------- player on foot ----------
  updateOnFoot: function (dt) {
    var p = G.player;
    var ax = Input.axisX(), ay = Input.axisY();
    var speed = Input.sprint() ? CFG.PLAYER_SPRINT : CFG.PLAYER_WALK;
    if (ax !== 0 || ay !== 0) {
      var len = Math.sqrt(ax * ax + ay * ay);
      World.moveCircle(p, (ax / len) * speed * dt, (ay / len) * speed * dt, CFG.PLAYER_RADIUS);
    }
    // Face the mouse.
    var cam = G.camera;
    p.angle = angleTo(p.x, p.y, cam.x + Input.mouseX, cam.y + Input.mouseY);
    // Shooting.
    p.shootCooldown -= dt;
    if ((Input.mouseDown || Input.justPressed('KeyF')) && p.shootCooldown <= 0) {
      this.playerShoot();
    }
    // Enter / exit car.
    if (Input.justPressed('KeyE')) this.tryEnterExit();
  },

  toast: function (msg) {
    G.toasts.push({ text: msg, t: 4 });
    var el = document.getElementById('toast');
    if (el) el.textContent = msg;
  },
};
