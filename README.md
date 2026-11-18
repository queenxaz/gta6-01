# Sunset Harbor — an open-world crime game

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/queenxaz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/queenxaz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Sunset Harbor** is a fully original open-world crime game that plays offline
in a desktop browser from static files — no network, no build step. Open
`game/index.html` (or run `node serve.ts` and visit http://localhost:8080).

## The city

A sun-soaked coastal city of six districts — Downtown, Marina Beach, Harbor
Docks, Palm Row, North Hills and Old Town — with a road grid, traffic,
pedestrians, parks, a pier, a casino, a hospital and a police HQ. Everything
is procedurally built from a seed: the same city, every time.

## What you can do

- **On foot and by car** — walk the sidewalks or steal any car on the street
  (WASD to move/drive, E to enter and exit, Space for the handbrake).
- **Eight story missions** for fixer Mara Voss: pickups, car thefts, shootouts,
  timed deliveries and a final getaway. Each job pays cash and raises your
  reputation. Finish all eight to become King of the Harbor.
- **Wanted system** — crimes raise 0–5 stars; Harbor PD sends foot officers
  and interceptors that chase and ram you. Lay low to cool off, or pay the
  Turbo Tune garage to clear your heat.
- **Combat** — aim with the mouse, click to shoot, F to punch, R to reload.
- **Shops** — repair and clear heat at Turbo Tune, buy ammo at Ironclad Arms,
  heal up at the Harbor Clinic.
- **HUD and minimap** — cash, health, wanted stars, mission tracker, speed,
  clock, district name and a live circular minimap with police blips and the
  objective marker.
- **Save** — progress auto-saves after every job (localStorage); continue from
  the title screen.
- **Sound** — fully procedural WebAudio: engine hum, sirens, gunshots and a
  sunset groove. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| E | Enter / exit / steal car |
| Mouse + click | Aim / shoot |
| F | Punch |
| R | Reload |
| Space | Handbrake |
| Shift | Sprint |
| Q | Start next job |
| G | Use nearby shop |
| Esc / P | Pause |
| M | Mute |

## Screenshots

Deterministic scenes, reproducible with `?shot=<scene>&seed=1`:

1. `1-chase.jpg` — police chase at 3 stars with a mission live
2. `2-driving.jpg` — cruising Downtown in a muscle car
3. `3-mission.jpg` — the Harbor Cranes shootout
4. `4-title.jpg` — the title screen

## Tech

Plain ES modules on a 2D canvas, split into one file per system
(`game/src/city.js`, `vehicles.js`, `police.js`, `missions.js`,
`combat.js`, `pedestrians.js`, `render.js`, `hud.js`, `audio.js`,
`particles.js`, `save.js`, `shots.js`, `main.js`). No libraries, no assets —
all art is drawn in code and all sound is synthesized.
