# SOLMAR — Open City: build note

**What it is:** an original 2D top-down open-world crime game set in the fictional
sun-soaked coastal city of Solmar. You are Jax Marlowe, a driver-for-hire who owes Big Sal
$5,000 and works it off job by job. Nothing is taken from Rockstar or any commercial game:
the city, characters, vehicles, names, story, art and sound are all original, and all sound
is synthesised live with WebAudio (no audio files).

This is a fresh rebuild of the game, re-authored file by file in a sealed recording
(strict transcripts) for gta6-01. The earlier build in `../gta6-01/` was design reference
only; every text file here was written fresh in this session (the one exception is
`vendor/makefun-game.ts`, which the competition requires byte-identical to the kit copy).

## Feature checklist vs the bounty

| Requirement | Status |
|---|---|
| City explored on foot AND by car | ✅ 3600×2600 city, 8 avenues × 7 streets, beach + bay; walk/run on foot, drive any car |
| Traffic and pedestrians | ✅ 26 traffic cars following road lanes + 34 pedestrians strolling sidewalks, fleeing cars |
| Cars to steal | ✅ Parked cars + traffic cars; E to steal (driver flees), stealing raises wanted |
| Wanted level with police pursuit | ✅ 0–5 stars; police cars chase and ram, foot cops chase and bust; heat fades out of sight; Spray Shop clears it for $250 |
| Missions with a story | ✅ 8-mission story (First Wheels → The Drop → Taxi Nights → Hot Wheels → Harbor Shootout → Solmar Grand Prix → The Big Score → King of Solmar), with timers, races, shootouts and escapes |
| Combat | ✅ Pistol (mouse aim, click to shoot), punch (F), armed gang members who shoot back, car explosions |
| HUD with a minimap | ✅ Cash, health bar, ammo, wanted stars, mission objective banner, speedometer + car health, live minimap (roads, shops, player, police, mission marker) |
| Start screen and save | ✅ Title screen (Continue / New Game / How to Play), autosave to localStorage every 5 s + on mission complete/pause, best-stats line |
| Polish | ✅ Synthesised engine hum, sirens, gunshots, music loop; particles (dust, smoke, muzzle, explosions); day-lit sun-soaked palette; pause, busted, wasted and story-complete screens |
| Offline static files, no network | ✅ Plain ES modules under game/, no library, no fetch, no external references (grep-verified) |
| Screenshots are real renders | ✅ Staged by shots.js: each plays the real rules forward with an autopilot and paints the live canvas |

**Side activities:** taxi fares ($ markers), 12 hidden stashes ($100 each), shops
(Lena's Garage repairs, Gun Barn ammo, Solmar General heals, Spray Shop clears wanted).

## Files

- `game/index.html` + `game/src/`: `config.js` (tuning/palette), `random.js` (seeded RNG),
  `city.js` (city generation), `audio.js` (WebAudio synth), `input.js` (keyboard/mouse),
  `missions.js` (8-mission story engine), `world.js` (simulation), `render.js` (canvas + HUD),
  `shots.js` (screenshot staging), `main.js` (boot/loop/screens/save).
- `main.ts`: copies game/ and screenshots/ to /output and writes dossier.json via the
  vendored buildDossier (Node 22 stdlib only).
- `serve.ts`: tiny static server for game/ on localhost:8080.
- `screenshots/`: 4 JPEGs, all 1280×720 (see below).

## How the screenshots were taken

Headless Chrome for Testing (`~/.cache/ms-playwright/.../chrome-headless-shell`),
driven over CDP by `/tmp/cdp-rec.mjs` (kept outside the repo). Each `?shot=<name>&seed=1`
URL stages a scene by playing the real game forward with an autopilot, then screenshots
the live canvas at 1280×720. PNG → JPEG with system ffmpeg (`-q:v 5`).

- `1-start.jpg` (87,078 B) — title screen over the live city.
- `2-drive.jpg` (96,918 B) — driving a stolen car through traffic, HUD + minimap + mission.
- `3-chase.jpg` (113,538 B) — 3-star police pursuit, cruiser closing in behind.
- `4-mission.jpg` (96,079 B) — Harbor Shootout firefight vs Los Lobos.

## Play-test (real browser, CDP, zero console errors)

- Title → Enter → play; walk (WASD), steal (E → in car, wanted 1, cars stolen 1),
  drive to 520 px/s top speed, police spawn (3 cruisers + 2 foot cops at 3 stars),
  mission 1 completes on reaching the garage (cash $150 → $350), gang spawns (6),
  pistol fire (ammo 24 → 23), autosave writes `solmar.save.v1`.
- One bug found and fixed during testing: `updateCarVsPed` in world.js used `dt` (the
  step size) without receiving it — a ReferenceError that fired every frame once the
  player had been run over (hurtCooldown > 0), freezing the whole simulation. Fixed by
  passing `dt` into `updateCarVsPed(dt)`. The two bugs from the reference build did not
  reappear: main.js still hands E/F presses to the world via extraActions, and the
  run-over hit still applies once with a 0.8 s grace period.

## Dossier verification

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # exit 0, no errors
out/ holds game/ (11 files, 114,798 B), screenshots/ (4 files), dossier.json
dossier.json: 644,510 B (cap 1.5 MiB); dossier text 115,582 B (cap 163,840 B)
game/ total 114,798 B (cap 48 MiB); index.html 843 B (cap 1 MiB)
Two runs of main.ts produce byte-identical out/ (deterministic).
```

The kit's `grade-local` cannot run this competition's sealed gate locally (the scorer is
not published in the kit — it grades from the house competition directory), so the gate
rows were checked by hand against the rules: plain files only, all references relative
inside game/, 4 screenshots within size/dimension caps, dossier written by the vendored
`buildDossier`.
