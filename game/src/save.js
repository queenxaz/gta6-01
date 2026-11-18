// save.js — saving Sunset Harbor to localStorage.
// Saves cash, health, mission progress, player position and the clock.
// Loading restores a free-roam session at the last mission checkpoint.

const SAVE_KEY = 'sunset-harbor-save-v1';

/** Serialize the game state into a save object. */
export function buildSave(game) {
  return {
    version: 1,
    savedAt: Date.now(),
    money: game.money,
    health: Math.max(20, game.player.health),
    ammo: game.combat.ammo,
    reserve: game.combat.reserve,
    armor: game.combat.armor,
    missionIndex: game.missions.index,
    completed: game.missions.completed.slice(),
    playerX: game.player.x,
    playerY: game.player.y,
    clock: game.clock,
    reputation: game.reputation,
  };
}

/** Write the save. Returns true on success. */
export function saveGame(game) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(buildSave(game)));
    return true;
  } catch (err) {
    return false;
  }
}

/** Read the save, or null when there is none / it is corrupt. */
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

/** True when a save exists. */
export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (err) {
    return false;
  }
}

/** Delete the save (new game). */
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* storage unavailable */ }
}
