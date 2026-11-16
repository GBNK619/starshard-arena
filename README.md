# Starshard Arena

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/GBNK619/starshard-arena/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/GBNK619/starshard-arena/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Starshard Arena is a top-down arena survival shooter that runs entirely in the
browser. The void has shattered into starshards, and every neon husk drifting
out of the dark wants them back. Pilot a lone shard-runner through ten
escalating waves of geometric hunters — chasers, darts, orbiters, splitters
and brutes — harvest the starshards they drop, and spend the calm between
waves on upgrades that reshape your ship: more projectiles, faster cycles, a
quicker dash, a shield that forgives one mistake per wave. Clear wave ten and
the void is yours; fall, and your best score is remembered.

## How to play

- **Move:** WASD or arrow keys
- **Aim:** mouse
- **Shoot:** hold the left mouse button (or hold Space)
- **Dash:** Shift or right mouse button — brief burst, invulnerable mid-dash
- **Between waves:** click an upgrade card, or press 1, 2 or 3
- **Pause:** P · **Mute:** M · **Restart** from the end screens: R or click

Collect gold starshards for score (+10 each). A rare heart restores 1 HP.
Survive all ten waves to win, then keep flying in endless mode if you like.

## Run it locally

The game is plain static files with no build step. Serve the `game/` folder
with any static file server and open it in a desktop browser, for example:

```
cd game
python3 -m http.server 8080
# then open http://localhost:8080
```

Everything is drawn and sounded by code — canvas shapes and synthesized
WebAudio — so the game needs no assets and makes no network requests.

## Hand-in program

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` there with the vendored
make.fun dossier library:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
