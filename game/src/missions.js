// Sunset Harbor — the 6-mission story: steps, markers, rewards, events.
'use strict';

var Missions = {
  // Current mission runtime state lives on G.mission:
  // { idx, step, timer, holdT, killsLeft, sportscar, started, done }
  current: function () {
    if (G.mission.idx >= MISSIONS.length) return null;
    return MISSIONS[G.mission.idx];
  },

  currentStep: function () {
    var m = this.current();
    if (!m) return null;
    return m.steps[G.mission.step] || null;
  },

  objectiveText: function () {
    var m = this.current();
    if (!m) return 'Free roam — Kingpin of Sunset Harbor';
    var s = this.currentStep();
    if (!s) return m.name;
    var label = s.label;
    if (s.type === 'survive') label += ' (' + Math.ceil(Math.max(0, s.secs - G.mission.timer)) + 's)';
    if (s.type === 'timed-goto') label += ' (' + Math.ceil(Math.max(0, G.mission.timer)) + 's left)';
    if (s.type === 'hold' || s.type === 'vault') {
      label += ' (' + Math.max(0, s.hold - G.mission.holdT).toFixed(1) + 's)';
    }
    if (s.type === 'eliminate') label += ' (' + G.mission.killsLeft + ' left)';
    return 'Mission ' + m.id + ' — ' + m.name + ': ' + label;
  },

  // Marker target for the current step (or null).
  markerTarget: function () {
    var s = this.currentStep();
    if (!s) return null;
    if (s.x !== undefined && s.y !== undefined) return { x: s.x, y: s.y, r: s.r || 90 };
    if (s.type === 'eliminate') return { x: 2240, y: 900, r: 110 };
    if (s.type === 'getin' && G.mission.sportscar) {
      return { x: G.mission.sportscar.x, y: G.mission.sportscar.y, r: 90 };
    }
    return null;
  },

  startMission: function (idx) {
    var m = MISSIONS[idx];
    if (!m) return;
    G.mission.idx = idx;
    G.mission.step = 0;
    G.mission.timer = 0;
    G.mission.holdT = 0;
    G.mission.killsLeft = 0;
    G.mission.sportscar = null;
    G.mission.started = true;
    if (m.startWanted) Entities.addWanted(m.startWanted, 'mission heat');
    Entities.toast('Mission ' + m.id + ': ' + m.name + ' — ' + m.intro);
    AudioSys.jingle();
    if (idx === 4) {
      // The red sportscar waits uptown.
      G.mission.sportscar = Entities.spawnSportscar(2880, 300);
    }
    if (idx === 5) {
      Entities.toast('Marina Bank is at the east end of the harbor road.');
    }
  },

  // Events fired by entities / the game loop.
  onEvent: function (type, data) {
    var m = this.current();
    if (!m) return;
    var s = this.currentStep();
    if (!s) return;
    if (type === 'steal' && s.type === 'steal') this.advance();
    if (type === 'enterCar' && s.type === 'getin') {
      if (G.mission.sportscar && data === G.mission.sportscar) {
        Entities.addWanted(3, 'getaway');
        this.advance();
      } else if (!G.mission.sportscar) {
        this.advance();
      }
    }
    if (type === 'rivalKilled' && s.type === 'eliminate') {
      G.mission.killsLeft--;
      if (G.mission.killsLeft <= 0) this.advance();
    }
  },

  advance: function () {
    var m = this.current();
    G.mission.step++;
    G.mission.timer = 0;
    G.mission.holdT = 0;
    var s = this.currentStep();
    if (!s) {
      this.completeMission(m);
      return;
    }
    if (s.type === 'eliminate') {
      G.mission.killsLeft = s.count;
      Entities.spawnRivals(2240, 900, s.count);
      Entities.toast('Armed rivals at the warehouse — take them all down!');
    }
    if (s.type === 'survive') {
      Entities.toast('Stay alive and stay out of cuffs for 25 seconds!');
    }
    if (s.type === 'timed-goto') {
      G.mission.timer = s.secs;
    }
    AudioSys.chime();
  },

  completeMission: function (m) {
    G.stats.cash += m.reward;
    G.stats.missionsDone++;
    G.mission.completed.push(m.id);
    Entities.toast('Mission complete: ' + m.name + ' — $' + m.reward + ' earned!');
    AudioSys.jingle();
    Save.save();
    if (G.mission.idx + 1 >= MISSIONS.length) {
      G.mission.idx = MISSIONS.length;
      G.mission.step = 0;
      Main.showEnding();
      return;
    }
    this.startMission(G.mission.idx + 1);
  },

  // Called every frame while playing.
  update: function (dt) {
    var m = this.current();
    if (!m) return;
    var s = this.currentStep();
    if (!s) return;
    var p = G.player;
    if (s.type === 'goto' || s.type === 'timed-goto') {
      if (dist(p.x, p.y, s.x, s.y) < s.r) {
        if (s.type === 'goto') this.advance();
        else { this.advance(); }
        return;
      }
      if (s.type === 'timed-goto') {
        G.mission.timer -= dt;
        if (G.mission.timer <= 0) {
          Entities.toast('Too slow! The moment passed — try again from the start of this leg.');
          // Reset to the start of the timed leg.
          G.mission.timer = s.secs;
          if (m.id === 5) {
            p.x = 2880; p.y = 300;
            if (p.car) { p.car.x = 2880; p.car.y = 300; p.car.speed = 0; }
          } else if (m.id === 6) {
            p.x = 2880; p.y = 1200;
            if (p.car) { p.car.x = 2880; p.car.y = 1200; p.car.speed = 0; }
          }
        }
      }
    } else if (s.type === 'hold' || s.type === 'vault') {
      if (dist(p.x, p.y, s.x, s.y) < s.r) {
        // Must be (nearly) still.
        var speed = p.onFoot ? 0 : Math.abs(p.car ? p.car.speed : 0);
        if (speed < 25) {
          G.mission.holdT += dt;
          if (G.mission.holdT >= s.hold) {
            if (s.type === 'vault') {
              Entities.addWanted(4, 'bank vault');
              Entities.toast('Vault cracked! $1,500 inside — now RUN for the beach!');
            } else {
              Entities.toast('Package secured.');
            }
            this.advance();
          }
        } else {
          G.mission.holdT = Math.max(0, G.mission.holdT - dt * 2);
        }
      } else {
        G.mission.holdT = 0;
      }
    } else if (s.type === 'survive') {
      G.mission.timer += dt;
      if (G.mission.timer >= s.secs) this.advance();
    } else if (s.type === 'laylow') {
      if (G.wanted.stars === 0) this.advance();
    }
  },

  // Restart the current mission (after busted / wasted).
  restartCurrent: function () {
    var idx = G.mission.idx;
    if (idx >= MISSIONS.length) idx = MISSIONS.length - 1;
    // Remove any mission-spawned sportscar from a previous attempt.
    if (G.mission.sportscar) {
      var sc = G.mission.sportscar;
      var ci = G.cars.indexOf(sc);
      if (ci >= 0) G.cars.splice(ci, 1);
    }
    G.rivals = [];
    this.startMission(idx);
  },
};
