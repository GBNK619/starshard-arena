// Starshard Arena — config.js
// Every balance number, the palette and the wave recipe live here, so the
// rest of the game reads them instead of hard-coding its own.

export const VIEW = { width: 960, height: 720 };

export const PALETTE = {
  void: '#070714',
  voidEdge: '#0d0d24',
  grid: 'rgba(96, 110, 255, 0.08)',
  arenaLine: 'rgba(120, 200, 255, 0.35)',
  player: '#37f4ff',
  playerCore: '#e8feff',
  bullet: '#aef7ff',
  chaser: '#ff3d8a',
  dart: '#ff9f2e',
  orbiter: '#b26bff',
  splitter: '#3dff7a',
  mini: '#8affa1',
  brute: '#ff4545',
  shard: '#ffd94a',
  heart: '#ff5d7a',
  shield: '#6be8ff',
  text: '#e8f6ff',
  dim: '#8fa3c7',
  danger: '#ff4d5e',
};

// The ship as it leaves the dock. Upgrades rewrite a copy of these numbers.
export const PLAYER_BASE = {
  radius: 12,
  speed: 238,
  hp: 5,
  fireRate: 6, // shots per second
  bulletDamage: 1,
  bulletSpeed: 545,
  bulletLife: 0.95,
  dashCooldown: 2.2,
  dashTime: 0.16,
  dashSpeed: 1180,
  projectiles: 1,
  magnet: 74, // starshard attraction radius, px
};

// Per-kind enemy bodies. `shards` is how many starshards a kill spills.
export const ENEMY_TYPES = {
  chaser: { radius: 14, hp: 3, speed: 94, shards: 2, knockResist: 0 },
  dart: { radius: 10, hp: 1, speed: 158, shards: 1, knockResist: 0 },
  orbiter: { radius: 13, hp: 4, speed: 118, shards: 2, knockResist: 0.1 },
  splitter: { radius: 18, hp: 6, speed: 56, shards: 2, knockResist: 0.25 },
  mini: { radius: 8, hp: 1, speed: 152, shards: 1, knockResist: 0 },
  brute: { radius: 26, hp: 18, speed: 43, shards: 6, knockResist: 0.85 },
};

export const FINAL_WAVE = 10;
export const SHARD_SCORE = 10;
export const WAVE_CLEAR_BONUS = 50;
export const HEART_CHANCE = 0.06;

// mulberry32: a tiny seeded RNG, so a ?seed= run (and every screenshot
// staging) plays out the same way every time.
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The wave recipe: which kinds show up, and how many, as waves climb.
// Kinds unlock in a fixed order — darts at 2, orbiters and splitters at 3,
// brutes at 4 — and past the final wave the counts keep growing gently.
export function waveComposition(wave) {
  const list = [];
  const add = (kind, count) => {
    for (let i = 0; i < count; i++) list.push(kind);
  };
  add('chaser', 4 + wave);
  if (wave >= 2) add('dart', Math.min(wave, 10));
  if (wave >= 3) add('orbiter', Math.min(wave - 1, 6));
  if (wave >= 3) add('splitter', Math.min(wave - 1, 6));
  if (wave >= 4) add('brute', Math.min(wave - 3, 4));
  return list;
}

// Enemies also get a little quicker every wave, so late waves threaten
// even an upgraded ship.
export function waveSpeedScale(wave) {
  return 1 + 0.03 * (wave - 1);
}

export function spawnInterval(wave) {
  return Math.max(0.35, 1.05 - wave * 0.06);
}
