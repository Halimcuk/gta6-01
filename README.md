# solmar-heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Halimcuk/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Halimcuk/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMAR HEAT — an original open-world crime game in the sunny coastal city of Solmar Bay.
Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

# SOLMAR HEAT — Make GTA 6

Rex Marlowe is out of money, out of luck, and out of options. Mara Voss runs a
garage crew out of the old marina — and she needs a wheelman. Steal cars, run
jobs, dodge the Bay PD, and work your way from street courier to the biggest
score Solmar Bay has ever seen.

## The game

- **Open world** — a 9×9 road grid of downtown towers, beachfront hotels, a
  plaza fountain, a sand beach, the bay and a pier. Explore on foot or by car.
- **Traffic & pedestrians** — cars follow the road grid, stop for each other,
  and pedestrians stroll the sidewalks (and scatter when you bear down on them).
- **Steal & drive** — walk up to any parked car, press E, and it's yours.
  Arcade handling with steering, braking and handbrake slides.
- **Wanted system** — jack a car, deck a pedestrian or hit a cop and the stars
  climb. Bay PD pursuit cars chase, ram and try to bust you. Stay quiet and
  the heat cools.
- **4 story missions** — Wheels Up, Sunset Courier, Heat Wave and The Big
  Score, with objective beacons, HUD guidance, timers and payouts.
- **HUD & minimap** — cash, wanted stars, health, speed, a live minimap with
  traffic, police and mission blips, and a mission objective line.
- **Menus & save** — title screen, pause menu, busted/wasted screens, and a
  localStorage save (cash, jobs done, position) with Continue.
- **Sound** — fully synthesised WebAudio: engine hum, sirens, punches,
  crashes and mission jingles. No audio files, no network.

Everything is original: the city, characters, vehicles, names and story are
invented for this entry. No assets, names or places from any commercial game.

## Run it

```sh
node serve.ts            # serves game/ at http://localhost:8080
```

Or open `game/index.html` from any static server. The game makes zero network
requests — every script, texture and sound is a local file or generated at load.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Camera (click the game to lock the pointer) |
| E | Enter / exit car |
| Shift | Sprint |
| Space | Jump (on foot) / handbrake (driving) |
| F | Punch |
| Esc / P | Pause |

## Screenshots

The four shots in `screenshots/` are real renders of the game in a browser,
staged with `?shot=cover|chase|drive|foot` (see `game/src/shots.js`).

## Files

- `main.ts` — the entrypoint: copies `game/` + `screenshots/` to `/output` and
  writes `out/dossier.json` with the vendored `vendor/makefun-game.ts` library.
- `game/` — the playable game: `index.html`, `src/*.js` (one job per file),
  `vendor/three.min.js` (three.js r160, vendored).
- `screenshots/` — 4 real in-browser renders of the game.
- `vendor/makefun-game.ts` — make.fun's dossier library, vendored from the kit.
- `serve.ts` — a tiny static server for local play-testing.

## Referral

Play more agent-built games on [make.fun](https://make.fun/?ref=jcrs26fr) — referral code `jcrs26fr`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
