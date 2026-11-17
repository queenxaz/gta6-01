// SOLMAR — Open City: every tuning number, colour and world constant in one place.
// The world is a fixed 3600x2600 px city; the renderer shows a 1280x720 window of it and
// the camera follows the player. The simulation runs in fixed 1/60 s steps whatever the
// display rate is.

export const WORLD = { width: 3600, height: 2600 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

/** The city grid: avenues run north-south, streets east-west, each a 96 px wide road. */
export const ROADS = {
  width: 96,
  lane: 24,
  avenues: [320, 720, 1120, 1520, 1920, 2320, 2720, 3120],
  streets: [280, 580, 880, 1180, 1480, 1780, 2080],
};

/** South of this y the sand beach begins; past it, the Solmar Bay water. */
export const BEACH = { sandY: 2280, waterY: 2440 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 265,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.45,
};

export const PISTOL = {
  damage: 34,
  range: 420,
  cooldown: 0.28,
  spread: 0.05,
  startAmmo: 24,
  maxAmmo: 120,
  ammoPrice: 60,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 170,
  turnRate: 2.6,
  grip: 3.2,
  health: 100,
  stealWanted: 1,
};

export const TRAFFIC = { count: 26, speed: 150, speedJitter: 45 };
export const PEDS = { count: 34, speed: 55, speedJitter: 30 };

/** Wanted stars 0-5. Higher stars spawn more police and make them faster and tougher. */
export const WANTED = {
  max: 5,
  decayDelay: 9,
  decayRate: 1 / 14,
  copsPerStar: [0, 1, 2, 3, 4, 5],
  footCopsPerStar: [0, 0, 1, 2, 3, 4],
  copSpeed: [0, 470, 500, 540, 580, 620],
  bustRadius: 26,
  loseWantedRadius: 900,
};

export const ECONOMY = {
  startCash: 150,
  sprayPrice: 250,
  repairPrice: 120,
  fareBase: 45,
  farePerMetre: 0.12,
  packageReward: 100,
  missionRewards: [200, 350, 300, 400, 600, 500, 900, 1500],
};

export const SAVE_KEY = 'solmar.save.v1';
export const BEST_KEY = 'solmar.best.v1';

/** Sun-soaked Solmar palette: warm sand, teal bay, terracotta roofs, palm green. */
export const PALETTE = {
  grass: '#8fb573',
  grassDark: '#7da565',
  sand: '#e8d29a',
  water: '#2e8fa8',
  waterDeep: '#1f6f87',
  road: '#4a4a52',
  roadEdge: '#3a3a42',
  lane: '#e8d47a',
  sidewalk: '#b9b3a4',
  crosswalk: '#d8d2c0',
  building: ['#c96f4a', '#d9a05b', '#7fa3b8', '#b8b0a0', '#a87f6a', '#e0c184', '#8a6f9e', '#6f9e7a'],
  roof: ['#8a4a34', '#a87a3a', '#5a7a8a', '#7a6a58', '#6a4a3a'],
  park: '#6fae62',
  tree: '#3f7d3a',
  treeDark: '#2f6130',
  player: '#ffd23e',
  playerShirt: '#2e6fd8',
  cop: '#1f4fd8',
  copCar: '#20306e',
  gang: '#b03030',
  text: '#f5f1e6',
  muted: '#cfc8b8',
  panel: 'rgba(20, 20, 28, 0.78)',
  panelBorder: 'rgba(255, 255, 255, 0.16)',
  gold: '#ffd23e',
  red: '#e5484d',
  green: '#46c26a',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_TITLE = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
