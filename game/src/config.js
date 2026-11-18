// Sunset Harbor — configuration, palette, mission definitions.
// Original open-world crime game for make.fun gta6-01. All names, places and
// story are invented for this game; nothing is taken from any commercial game.
'use strict';

// Shared mutable game state (assigned by main.js at boot).
var G = null;

// World geometry: a 3200 x 2400 px city at golden hour.
var CFG = {
  WORLD_W: 3200,
  WORLD_H: 2400,
  ROADS_V: [320, 960, 1600, 2240, 2880],
  ROADS_H: [300, 900, 1500, 1950],
  ROAD_W: 112,
  BEACH_Y: 2200,   // sand starts here
  SEA_Y: 2330,     // sea starts here
  MARINA_X: 3020,  // marina water starts here
  VIEW_W: 1280,
  VIEW_H: 720,
  SAVE_KEY: 'sunset-harbor-save-v1',
  PLAYER_WALK: 210,
  PLAYER_SPRINT: 330,
  PLAYER_RADIUS: 12,
  BULLET_SPEED: 950,
  BULLET_RANGE: 560,
  PISTOL_DAMAGE: 34,
  PED_HP: 30,
  COP_HP: 100,
  RIVAL_HP: 100,
  PLAYER_HP: 100,
  WANTED_DECAY_IDLE: 18,   // seconds with no crime and no cop near before decay
  WANTED_DECAY_STEP: 6,    // seconds per -1 star while decaying
  COP_NEAR_DIST: 520,
  BUST_DIST: 34,
  BUST_TIME: 1.2,
  AUTOSAVE_SECS: 20,
};

// Golden-hour palette.
var PAL = {
  grass: '#7d9b4a',
  grassDark: '#6b8a3e',
  sidewalk: '#b8ab8e',
  road: '#3d3a44',
  roadEdge: '#2c2931',
  lane: '#f4d35e',
  sand: '#e8c98a',
  sea: '#2e7f9e',
  seaDeep: '#1f5f7d',
  park: '#5f8f3e',
  buildingRoof: ['#b5654a', '#8a6d4b', '#a34d5e', '#6b7a8f', '#c08a4a', '#7a5a7d', '#4a7a6b'],
  buildingWall: ['#d9a06b', '#c98a5e', '#e0b183', '#b98a6b'],
  tree: '#3f7a34',
  treeDark: '#2f5e28',
  pier: '#8a6b45',
};

// Mission definitions: story order, each step is a small objective.
// Types: steal, goto, hold, survive, laylow, eliminate, getin, timed-goto, vault.
var MISSIONS = [
  {
    id: 1, name: 'Wheels Up', reward: 150,
    intro: 'Fresh out of lockup, Lucia needs wheels. Steal a car, any car.',
    steps: [
      { type: 'steal', label: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', x: 1600, y: 900, r: 100, label: 'Drive to Sunset Diner', place: 'Sunset Diner' },
    ],
  },
  {
    id: 2, name: 'The Pickup', reward: 300,
    intro: 'A package is waiting at Sunset Docks. Grab it, bring it home.',
    steps: [
      { type: 'goto', x: 2880, y: 1500, r: 100, label: 'Drive to Sunset Docks', place: 'Sunset Docks' },
      { type: 'hold', x: 2880, y: 1500, r: 110, hold: 1.5, label: 'Hold still to grab the package' },
      { type: 'goto', x: 960, y: 1500, r: 100, label: 'Deliver to the safehouse', place: 'Safehouse' },
    ],
  },
  {
    id: 3, name: 'Hot Pursuit', reward: 250,
    intro: 'The harbor patrol is on to you. Survive the heat, then lay low.',
    startWanted: 2,
    steps: [
      { type: 'survive', secs: 25, label: 'Survive the heat for 25 seconds' },
      { type: 'laylow', label: 'Lay low until your wanted level clears' },
    ],
  },
  {
    id: 4, name: 'Payback', reward: 500,
    intro: 'The Harbor Boys jumped Lucia once. Time to return the favour.',
    steps: [
      { type: 'goto', x: 2240, y: 900, r: 110, label: 'Go to the old warehouse', place: 'Warehouse' },
      { type: 'eliminate', count: 4, label: 'Eliminate the 4 armed rivals' },
    ],
  },
  {
    id: 5, name: 'The Getaway', reward: 700,
    intro: 'A red sportscar is parked uptown. Take it and run for the beach.',
    startWanted: 3,
    steps: [
      { type: 'goto', x: 2880, y: 300, r: 110, label: 'Reach the red sportscar', place: 'Sportscar' },
      { type: 'getin', label: 'Get in the sportscar (press E)' },
      { type: 'timed-goto', x: 1600, y: 2150, r: 120, secs: 60, label: 'Reach the beach safehouse in 60s', place: 'Beach Safehouse' },
    ],
  },
  {
    id: 6, name: 'The Sunset Score', reward: 1500,
    intro: 'One last job: Marina Bank. Crack the vault, then vanish into the sunset.',
    startWanted: 0,
    steps: [
      { type: 'goto', x: 2880, y: 1200, r: 100, label: 'Reach Marina Bank', place: 'Marina Bank' },
      { type: 'vault', x: 2880, y: 1200, r: 110, hold: 4, label: 'Hold still to crack the vault (4s)' },
      { type: 'timed-goto', x: 1500, y: 2220, r: 130, secs: 90, label: 'Escape to the beach (90s)', place: 'Beach' },
    ],
  },
];

// Car paint jobs (name, body colour).
var CAR_COLORS = [
  ['Sunset Orange', '#e07840'], ['Ocean Teal', '#2e8a8a'], ['Harbor Blue', '#3a6db0'],
  ['Cherry Red', '#c03a3a'], ['Taxi Yellow', '#e8c33a'], ['Lavender', '#8a6bb0'],
  ['Mint', '#5ab08a'], ['Slate', '#5a6270'], ['Cream', '#e8dcc0'], ['Hot Pink', '#d85a9a'],
];
var POLICE_COLOR = '#2a4a8a';
var SPORTSCAR_COLOR = '#d02030';
