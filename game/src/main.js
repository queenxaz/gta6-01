// Sunset Harbor — Game controller: boot, loop, state machine, HUD wiring.
// States: title, playing, paused, busted, wasted, ending.
'use strict';

window.__errors = [];
window.addEventListener('error', function (e) {
  window.__errors.push('WINDOW.ERROR: ' + (e.message || 'unknown') + ' @ ' + (e.filename || '') + ':' + (e.lineno || 0));
});

var Main = {
  canvas: null,
  ctx: null,
  minimap: null,
  mctx: null,
  lastT: 0,
  frozen: false,

  createGameState: function (seed) {
    return {
      seed: seed,
      state: 'title',
      time: 0,
      player: {
        x: 1600, y: 1150, angle: -Math.PI / 2,
        health: CFG.PLAYER_HP, onFoot: true, car: null,
        shootCooldown: 0,
      },
      cars: [],
      peds: [],
      cops: [],
      rivals: [],
      bullets: [],
      particles: [],
      wanted: { stars: 0, lastCrime: -999, decayT: 0 },
      stats: { cash: 0, kills: 0, carsStolen: 0, crimes: 0, missionsDone: 0 },
      mission: { idx: 0, step: 0, timer: 0, holdT: 0, killsLeft: 0, sportscar: null, started: false, completed: [],
        objectiveText: function () { return Missions.objectiveText(); } },
      camera: { x: 0, y: 0 },
      toasts: [],
      damageFlash: 0,
      saveT: 0,
      lastShotX: 0, lastShotY: 0, lastShotT: -999,
      debug: {
        teleport: function (x, y) {
          var p = G.player;
          p.x = x; p.y = y;
          if (p.car) { p.car.x = x; p.car.y = y; p.car.speed = 0; }
          return { x: Math.round(p.x), y: Math.round(p.y) };
        },
      },
    };
  },

  boot: function () {
    var seed = Shots.seed();
    G = this.createGameState(seed);
    window.__game = G;
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.minimap = document.getElementById('minimap');
    this.mctx = this.minimap.getContext('2d');
    Input.init(this.canvas);

    World.build(seed);
    Entities.spawnAll(seed);
    Missions.startMission(0);
    this.updateCamera(true);

    this.wireButtons();
    this.updateHUD();

    var shot = Shots.parse();
    if (shot) {
      Shots.setup(shot);
      this.frozen = true;
      this.updateHUD();
      this.render();
      window.__ready = true;
      this.loop();
      return;
    }

    // Normal boot: show the title screen.
    var hasSave = Save.has();
    var cont = document.getElementById('btn-continue');
    if (cont) cont.classList.toggle('hidden', !hasSave);
    this.showOverlay('title');
    this.render();
    window.__ready = true;
    this.loop();
  },

  wireButtons: function () {
    var self = this;
    var bind = function (id, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function () { AudioSys.init(); AudioSys.click(); fn(); });
    };
    bind('btn-start', function () { self.newGame(); });
    bind('btn-continue', function () { self.continueGame(); });
    bind('btn-howto', function () { self.showOverlay('howto'); });
    bind('btn-howto-back', function () { self.showOverlay('title'); });
    bind('btn-resume', function () { self.setState('playing'); });
    bind('btn-quit-title', function () { self.setState('title'); self.showOverlay('title'); });
    bind('btn-busted-ok', function () { self.setState('playing'); });
    bind('btn-wasted-ok', function () { self.setState('playing'); });
    bind('btn-ending-roam', function () { self.setState('playing'); });
    bind('btn-ending-restart', function () { self.newGame(); });
  },

  newGame: function () {
    Save.clear();
    G.stats.cash = 0;
    G.stats.kills = 0;
    G.stats.carsStolen = 0;
    G.stats.crimes = 0;
    G.stats.missionsDone = 0;
    G.player.x = 1600; G.player.y = 1150;
    G.player.health = CFG.PLAYER_HP;
    G.player.onFoot = true;
    G.player.car = null;
    G.wanted.stars = 0;
    G.wanted.lastCrime = -999;
    G.mission.completed = [];
    Missions.startMission(0);
    this.setState('playing');
    Entities.toast('Welcome to Sunset Harbor, Lucia. Steal a car!');
  },

  continueGame: function () {
    var data = Save.load();
    if (!data) { this.newGame(); return; }
    Save.apply(data);
    this.setState('playing');
    Entities.toast('Welcome back, Lucia. Mission ' + (G.mission.idx + 1) + ' continues.');
  },

  setState: function (s) {
    G.state = s;
    if (s === 'playing') this.hideOverlays();
    else this.showOverlay(s);
    this.updateHUD();
  },

  showOverlay: function (name) {
    this.hideOverlays();
    var map = {
      title: 'overlay-title',
      howto: 'overlay-howto',
      paused: 'overlay-pause',
      busted: 'overlay-busted',
      wasted: 'overlay-wasted',
      ending: 'overlay-ending',
    };
    var el = document.getElementById(map[name] || 'overlay-title');
    if (el) el.classList.remove('hidden');
    var hud = document.getElementById('hud');
    if (hud) hud.classList.toggle('hidden', name === 'title' || name === 'howto');
  },

  hideOverlays: function () {
    var ids = ['overlay-title', 'overlay-howto', 'overlay-pause', 'overlay-busted', 'overlay-wasted', 'overlay-ending'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.classList.add('hidden');
    }
    var hud = document.getElementById('hud');
    if (hud) hud.classList.remove('hidden');
  },

  showEnding: function () {
    G.state = 'ending';
    var cashEl = document.getElementById('ending-cash');
    if (cashEl) cashEl.textContent = '$' + G.stats.cash.toLocaleString('en-US');
    this.showOverlay('ending');
    AudioSys.jingle();
  },

  busted: function () {
    if (G.state !== 'playing') return;
    var fine = Math.max(100, Math.round(G.stats.cash * 0.15));
    G.stats.cash = Math.max(0, G.stats.cash - fine);
    var el = document.getElementById('busted-fine');
    if (el) el.textContent = 'Fine: $' + fine + ' — the Harbor Patrol let you off with a warning.';
    G.wanted.stars = 0;
    G.wanted.lastCrime = -999;
    G.cops = [];
    this.respawn('Busted! The cops hauled you in.');
    AudioSys.bust();
    G.state = 'busted';
    this.showOverlay('busted');
    Save.save();
  },

  wasted: function () {
    if (G.state !== 'playing') return;
    var lost = Math.round(G.stats.cash * 0.10);
    G.stats.cash = Math.max(0, G.stats.cash - lost);
    var el = document.getElementById('wasted-lost');
    if (el) el.textContent = 'You lost $' + lost + ' in the hospital shuffle.';
    G.wanted.stars = 0;
    G.wanted.lastCrime = -999;
    G.cops = [];
    this.respawn('Wasted! You wake up at the Sunset Clinic.');
    G.state = 'wasted';
    this.showOverlay('wasted');
    Save.save();
  },

  respawn: function (msg) {
    var p = G.player;
    p.x = 960; p.y = 1500;
    p.health = CFG.PLAYER_HP;
    p.onFoot = true;
    p.car = null;
    G.bullets = [];
    G.damageFlash = 0;
    this.updateCamera(true);
    Entities.toast(msg);
    Missions.restartCurrent();
  },

  // ---------- frame ----------
  loop: function () {
    var self = this;
    function frame(t) {
      requestAnimationFrame(frame);
      var dt = Math.min(0.05, (t - self.lastT) / 1000 || 0.016);
      self.lastT = t;
      if (G.state === 'playing' && !self.frozen) {
        self.update(dt, false);
      }
      self.render();
      Input.endFrame();
    }
    requestAnimationFrame(frame);
  },

  update: function (dt, fromShot) {
    var p = G.player;
    G.time += dt;

    // Pause toggle (not in shot mode).
    if (!fromShot && (Input.justPressed('Escape') || Input.justPressed('KeyP'))) {
      if (G.state === 'playing') this.setState('paused');
      else if (G.state === 'paused') this.setState('playing');
      return;
    }

    if (p.onFoot) Entities.updateOnFoot(dt);
    else {
      Entities.updateDriving(dt);
      if (Input.justPressed('KeyE')) Entities.tryEnterExit();
    }

    Entities.updateTraffic(dt);
    Entities.updatePeds(dt);
    Entities.updatePolice(dt);
    Entities.updateFootCops(dt);
    Entities.updateRivals(dt);
    Entities.updateBullets(dt);
    Entities.updateParticles(dt);
    Entities.updateWanted(dt);
    Entities.separateCars();
    Missions.update(dt);

    // Engine hum follows speed.
    var speedRatio = 0;
    if (!p.onFoot && p.car) speedRatio = Math.abs(p.car.speed) / 430;
    AudioSys.setEngine(speedRatio, !p.onFoot);

    this.updateCamera(false);

    // Toasts.
    for (var i = G.toasts.length - 1; i >= 0; i--) {
      G.toasts[i].t -= dt;
      if (G.toasts[i].t <= 0) G.toasts.splice(i, 1);
    }
    var toastEl = document.getElementById('toast');
    if (toastEl) {
      toastEl.textContent = G.toasts.length ? G.toasts[G.toasts.length - 1].text : '';
    }
    if (G.damageFlash > 0) G.damageFlash -= dt * 1.5;

    // Autosave.
    G.saveT += dt;
    if (G.saveT >= CFG.AUTOSAVE_SECS) {
      G.saveT = 0;
      Save.save();
    }

    this.updateHUD();
  },

  updateCamera: function (snap) {
    var p = G.player;
    var tx = clamp(p.x - CFG.VIEW_W / 2, 0, CFG.WORLD_W - CFG.VIEW_W);
    var ty = clamp(p.y - CFG.VIEW_H / 2, 0, CFG.WORLD_H - CFG.VIEW_H);
    if (snap) { G.camera.x = tx; G.camera.y = ty; }
    else {
      G.camera.x = lerp(G.camera.x, tx, 0.12);
      G.camera.y = lerp(G.camera.y, ty, 0.12);
    }
  },

  // ---------- HUD ----------
  updateHUD: function () {
    var el = function (id) { return document.getElementById(id); };
    var stars = el('hud-stars');
    if (stars) {
      var s = '';
      for (var i = 0; i < 5; i++) s += i < G.wanted.stars ? '★' : '☆';
      stars.textContent = s;
      stars.style.color = G.wanted.stars > 0 ? '#ff5040' : '#ffd21f';
    }
    var cash = el('hud-cash');
    if (cash) cash.textContent = '$' + G.stats.cash.toLocaleString('en-US');
    var hp = el('hud-hp-fill');
    if (hp) hp.style.width = clamp(G.player.health, 0, 100) + '%';
    var obj = el('hud-objective');
    if (obj) obj.textContent = Missions.objectiveText();
    var speed = el('hud-speed');
    if (speed) {
      if (!G.player.onFoot && G.player.car) {
        speed.textContent = Math.round(Math.abs(G.player.car.speed) * 0.18) + ' km/h';
      } else {
        speed.textContent = '';
      }
    }
    var flash = el('damage-flash');
    if (flash) flash.style.opacity = clamp(G.damageFlash, 0, 0.6).toFixed(2);
  },

  // ---------- render ----------
  render: function () {
    var ctx = this.ctx;
    var cam = G.camera;
    Render.drawWorld(ctx, cam);
    Render.drawMarker(ctx, cam);
    // Draw cars, peds, cops, rivals, player, bullets, particles.
    for (var i = 0; i < G.cars.length; i++) Render.drawCar(ctx, cam, G.cars[i]);
    for (var j = 0; j < G.peds.length; j++) {
      if (!G.peds[j].dead) Render.drawPed(ctx, cam, G.peds[j]);
    }
    for (var k = 0; k < G.cops.length; k++) {
      if (!G.cops[k].dead) Render.drawCop(ctx, cam, G.cops[k]);
    }
    for (var r = 0; r < G.rivals.length; r++) {
      if (!G.rivals[r].dead) this.drawRival(ctx, cam, G.rivals[r]);
    }
    Render.drawPlayer(ctx, cam);
    Render.drawBullets(ctx, cam);
    Render.drawParticles(ctx, cam);
    // Minimap.
    if (this.mctx) Render.drawMinimap(this.mctx, 190, 142);
    // Vignette: warm sunset glow at the edges.
    var grad = ctx.createRadialGradient(
      CFG.VIEW_W / 2, CFG.VIEW_H / 2, CFG.VIEW_H * 0.45,
      CFG.VIEW_W / 2, CFG.VIEW_H / 2, CFG.VIEW_H * 0.85);
    grad.addColorStop(0, 'rgba(255,150,60,0)');
    grad.addColorStop(1, 'rgba(255,120,40,0.14)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  },

  drawRival: function (ctx, cam, r) {
    ctx.save();
    ctx.translate(r.x - cam.x, r.y - cam.y);
    ctx.rotate(r.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 2, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a1a1a';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c9a0';
    ctx.beginPath();
    ctx.arc(5, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -1.5, 10, 3);
    ctx.restore();
    // Rival health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(r.x - 20 - cam.x, r.y - 26 - cam.y, 40, 5);
    ctx.fillStyle = '#d04040';
    ctx.fillRect(r.x - 20 - cam.x, r.y - 26 - cam.y, 40 * (r.hp / CFG.RIVAL_HP), 5);
  },
};

// Boot once the DOM is ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { Main.boot(); });
} else {
  Main.boot();
}
