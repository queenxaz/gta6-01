# Sunset Harbor

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/queenxaz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/queenxaz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Sunset Harbor** is an original open-world crime game for the make.fun
gta6-01 bounty ("Make GTA 6"). It plays offline in a desktop browser from
static files — no network requests, no external assets, all sound synthesised
with WebAudio.

## The game

Lucia Vega is fresh out of lockup in Sunset Harbor, a sun-soaked coastal city
at golden hour. Steal cars, dodge the Harbor Patrol, and run six story
missions — from a first car theft at Sunset Diner to cracking the vault of
Marina Bank in *The Sunset Score* — then free-roam as Kingpin of Sunset Harbor.

- **A living city** — 3200×2400 px of roads, blocks, a central park, a beach,
  a marina with wooden piers, seeded generation (`?seed=1` is deterministic).
- **On foot and by car** — walk, sprint, aim and shoot with the mouse; drive
  with real throttle/brake/steering, building collisions, car–car push-apart
  and crash damage.
- **Traffic & pedestrians** — 14 traffic cars that follow the road grid and
  turn at intersections, 9 parked cars to steal, 26 sidewalk walkers who flee
  gunfire.
- **Wanted system & police** — 0–5 stars for theft, assault and cop-killing;
  police cars chase and ram, foot cops chase and bust you (fine: 15% of cash,
  min $100). Lay low and the heat dies down.
- **6 story missions** — Wheels Up, The Pickup, Hot Pursuit, Payback, The
  Getaway, The Sunset Score — with markers, a pulsing ring, an off-screen
  edge arrow, hold-to-complete objectives and timed escapes.
- **Combat** — pistol with muzzle flash and blood/smoke particles, armed
  rivals who shoot back.
- **HUD** — wanted stars, cash, health bar, objective banner, live minimap,
  speedometer, toasts and a red damage flash.
- **Save** — localStorage autosave (mission complete, every 20 s, busted/wasted)
  with Continue on the title screen.

## Play

```sh
node serve.ts --port 8080
# open http://127.0.0.1:8080/ in a desktop browser
```

Controls: WASD/arrows to walk (Shift to sprint), mouse to aim, click or F to
shoot, E to steal/enter/exit a car, W/S/A/D to drive, Esc/P to pause.

## Screenshot scenes

`?shot=start|play|chase|end&seed=1` freezes a scripted scene for screenshots:
title screen, driving downtown, a 3-star police chase at the marina, and the
ending on the beach.

## Layout

- `main.ts` — the make.fun entrypoint (copies `game/` + `screenshots/` to
  `/output`, writes `dossier.json` via `vendor/makefun-game.ts`).
- `game/index.html` — the game shell: canvas, HUD, title/pause/busted/wasted/
  ending overlays.
- `game/src/` — one job per file: `config.js` (world + missions),
  `random.js` (seeded RNG), `input.js` (keyboard/mouse), `audio.js`
  (synthesised sound), `world.js` (city generation + collision),
  `entities.js` (cars, traffic, peds, police, combat), `missions.js`
  (story state machine), `render.js` (world + minimap), `shots.js`
  (screenshot scenes), `save.js` (localStorage), `main.js` (game controller).

Everything in the game — city, characters, vehicles, names, story, art and
sound — is original. Nothing is taken from Rockstar Games or any commercial game.

## License

MIT — see `LICENSE`.
