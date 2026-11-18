// Sunset Harbor — localStorage save / load.
'use strict';

var Save = {
  save: function () {
    try {
      var p = G.player;
      var data = {
        cash: G.stats.cash,
        missionIdx: G.mission.idx,
        completed: G.mission.completed.slice(),
        x: Math.round(p.x),
        y: Math.round(p.y),
        health: Math.round(p.health),
        kills: G.stats.kills,
        carsStolen: G.stats.carsStolen,
      };
      localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable (private mode, etc.) */ }
  },

  load: function () {
    try {
      var raw = localStorage.getItem(CFG.SAVE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (typeof data.cash !== 'number' || typeof data.missionIdx !== 'number') return null;
      return data;
    } catch (e) { return null; }
  },

  has: function () { return this.load() !== null; },

  apply: function (data) {
    G.stats.cash = data.cash;
    G.stats.kills = data.kills || 0;
    G.stats.carsStolen = data.carsStolen || 0;
    G.player.x = clamp(data.x, 20, CFG.WORLD_W - 20);
    G.player.y = clamp(data.y, 20, CFG.WORLD_H - 20);
    G.player.health = clamp(data.health, 1, CFG.PLAYER_HP);
    G.player.onFoot = true;
    G.player.car = null;
    G.mission.completed = Array.isArray(data.completed) ? data.completed : [];
    Missions.startMission(clamp(data.missionIdx, 0, MISSIONS.length - 1));
  },

  clear: function () {
    try { localStorage.removeItem(CFG.SAVE_KEY); } catch (e) { /* ignore */ }
  },
};
