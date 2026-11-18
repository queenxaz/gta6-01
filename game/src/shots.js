// Sunset Harbor — scripted screenshot scenes (?shot=start|play|chase|end).
// In shot mode the world is stepped forward with fixed 1/60 steps at load,
// then frozen (keeps rendering, stops stepping). Saves are cleared and the
// Continue button is hidden so every shot is deterministic.
'use strict';

var Shots = {
  name: null,

  parse: function () {
    var q = new URLSearchParams(window.location.search);
    return q.get('shot');
  },

  seed: function () {
    var q = new URLSearchParams(window.location.search);
    var s = parseInt(q.get('seed') || '1', 10);
    return isNaN(s) ? 1 : s;
  },

  isShot: function () { return this.name !== null; },

  // Configure the state for the requested scene. Called after the world is
  // built and before the first frame.
  setup: function (name) {
    this.name = name;
    Save.clear();
    var btn = document.getElementById('btn-continue');
    if (btn) btn.classList.add('hidden');
    // Clear the boot toast on start/end scenes.
    if (name === 'start' || name === 'end') {
      var toast = document.getElementById('toast');
      if (toast) toast.textContent = '';
    }

    if (name === 'start') {
      // Title screen over the city; player on foot downtown.
      G.player.x = 1600; G.player.y = 1150;
      G.camera.x = clamp(G.player.x - CFG.VIEW_W / 2, 0, CFG.WORLD_W - CFG.VIEW_W);
      G.camera.y = clamp(G.player.y - CFG.VIEW_H / 2, 0, CFG.WORLD_H - CFG.VIEW_H);
      G.state = 'title';
      return;
    }

    if (name === 'play') {
      // Player driving a car downtown with traffic around.
      var car = Entities.makeCar(1600, 1250, -Math.PI / 2, {
        color: '#e07840', name: 'Sunset Orange', driver: 'player',
      });
      car.speed = 240;
      G.cars.push(car);
      G.player.onFoot = false;
      G.player.car = car;
      G.player.x = car.x; G.player.y = car.y;
      G.state = 'playing';
      Main.hideOverlays();
      // Mission 1, step 2: already has the car, now drive to the diner.
      G.mission.step = 1;
      // Simulate ~2.5s of driving (W held, straight up the avenue).
      this.stepWith(150, function () {
        Input.keys['KeyW'] = true;
      });
      Input.keys['KeyW'] = false;
      return;
    }

    if (name === 'chase') {
      // 3-star wanted police chase near the marina: north up the harbor road.
      var chaseCar = Entities.makeCar(2880, 1400, -Math.PI / 2, {
        color: SPORTSCAR_COLOR, name: 'Sunset GT', type: 'sports', driver: 'player',
      });
      chaseCar.speed = 300;
      G.cars.push(chaseCar);
      G.player.onFoot = false;
      G.player.car = chaseCar;
      G.player.x = chaseCar.x; G.player.y = chaseCar.y;
      G.state = 'playing';
      Main.hideOverlays();
      // Hot Pursuit mission so the HUD reads as a chase, then force 3 stars.
      Missions.startMission(2);
      G.wanted.stars = 3;
      G.wanted.lastCrime = G.time;
      // Three police cars in pursuit.
      for (var i = 0; i < 3; i++) {
        var pc = Entities.makeCar(2880 + (i - 1) * 46, 1400 + 190 + i * 95, -Math.PI / 2, {
          color: POLICE_COLOR, name: 'Harbor Patrol', type: 'police', driver: 'police',
        });
        pc.speed = 280;
        G.cars.push(pc);
      }
      // Simulate ~2s of the chase. No throttle: the sportscar coasts and
      // the patrol cars close in from behind, so they are in frame.
      this.stepWith(120, null);
      return;
    }

    if (name === 'end') {
      // Ending screen on the beach with $2,450.
      G.stats.cash = 2450;
      G.mission.idx = MISSIONS.length;
      G.mission.completed = [1, 2, 3, 4, 5, 6];
      G.player.x = 1500; G.player.y = 2220;
      G.player.onFoot = true;
      G.player.car = null;
      G.camera.x = clamp(G.player.x - CFG.VIEW_W / 2, 0, CFG.WORLD_W - CFG.VIEW_W);
      G.camera.y = clamp(G.player.y - CFG.VIEW_H / 2, 0, CFG.WORLD_H - CFG.VIEW_H);
      G.state = 'playing';
      Main.showEnding();
      return;
    }
  },

  // Step the world n times at a fixed 1/60s, running setupFn before each
  // step so the simulated input is held (e.g. W for throttle).
  stepWith: function (n, setupFn) {
    for (var i = 0; i < n; i++) {
      if (setupFn) setupFn();
      Main.update(1 / 60, true);
      Input.endFrame();
    }
  },
};
