# SOLMAR — Open City

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/queenxaz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/queenxaz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

SOLMAR — Open City is an original 2D top-down open-world crime game set in the fictional
sun-soaked coastal city of Solmar. You are Jax Marlowe, a driver-for-hire who owes Big
Sal $5,000, and you work the debt off job by job: steal cars, outrun the Solmar PD on a
5-star wanted system, shoot it out with the Los Lobos gang at the Harbor, race the Grand
Prix, and pull off the Big Score across eight story missions — with 26 traffic cars and
34 pedestrians on the streets, taxi fares, 12 hidden stashes, four shops, a live minimap,
and synthesised WebAudio sound. Nothing here comes from any commercial game: the city,
characters, vehicles, names, story, art and sound are all original.

## How to play

- **On foot:** WASD to move, Shift to run. Mouse to aim, click to shoot, F to punch.
- **Cars:** E next to a car to steal it (stealing brings heat). W/S drive, A/D steer,
  Space handbrake, E to get out.
- **Wanted:** stars bring police cars that ram and foot cops that bust you. Stay out of
  sight and the heat fades; the Spray Shop clears it for $250. Getting busted costs $150.
- **Money:** missions, taxi fares ($ markers) and hidden stashes ($100 each) pay. The Gun
  Barn sells ammo, Lena's Garage repairs, Solmar General heals.
- **Other keys:** P or Esc pauses, M mutes, Enter confirms menu choices.
- Progress autosaves to localStorage every 5 seconds and on mission complete / pause;
  Continue on the title screen picks it back up.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

The game is plain static files under `game/` — no build step, no library, no network
request. `?seed=N` fixes the city and traffic; `?shot=start|drive|chase|mission&seed=1`
stages a screenshot scene. `main.ts` (Node 22, stdlib only) copies `game/` and
`screenshots/` to `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json`.
