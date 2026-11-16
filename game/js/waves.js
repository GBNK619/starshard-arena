// Starshard Arena — waves.js
// Turning a wave number into a shuffled spawn queue, and the upgrade pool
// a player chooses from between waves.

import { spawnEnemy } from './entities.js';
import { VIEW, spawnInterval, waveComposition, waveSpeedScale } from './config.js';

// Spawn points ring the arena edges, never on top of the player.
export function spawnPoint(rng, player) {
  for (let tries = 0; tries < 12; tries++) {
    const edge = Math.floor(rng() * 4);
    const m = 46;
    let x = m;
    let y = m;
    if (edge === 0) { x = m + rng() * (VIEW.width - 2 * m); y = m; }
    if (edge === 1) { x = VIEW.width - m; y = m + rng() * (VIEW.height - 2 * m); }
    if (edge === 2) { x = m + rng() * (VIEW.width - 2 * m); y = VIEW.height - m; }
    if (edge === 3) { x = m; y = m + rng() * (VIEW.height - 2 * m); }
    if (Math.hypot(x - player.x, y - player.y) > 240) return { x, y };
  }
  return { x: 46, y: 46 };
}

export class WaveDirector {
  constructor(rng) {
    this.rng = rng;
    this.queue = [];
    this.timer = 0;
    this.interval = 1;
  }

  startWave(wave) {
    const list = waveComposition(wave);
    // Fisher-Yates with the run's seeded RNG, so a seed replays exactly.
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    this.queue = list;
    this.interval = spawnInterval(wave);
    this.timer = 0.4; // a breath before the first arrival
    this.wave = wave;
  }

  // Feeds enemies into the arena a few at a time; returns true while more
  // are still coming.
  update(dt, player, enemies) {
    if (this.queue.length === 0) return false;
    this.timer -= dt;
    if (this.timer <= 0) {
      const kind = this.queue.shift();
      const pt = spawnPoint(this.rng, player);
      enemies.push(spawnEnemy(kind, pt.x, pt.y, this.rng, waveSpeedScale(this.wave)));
      this.timer = this.interval * (0.7 + this.rng() * 0.6);
    }
    return true;
  }

  get pending() {
    return this.queue.length;
  }
}

// The upgrade pool. Every entry stacks, so a choice is a direction for
// the whole run, not a one-wave treat. `apply` receives the game.
export const UPGRADE_POOL = [
  {
    id: 'rapid',
    name: 'Rapid Cycler',
    desc: '+18% fire rate. The void respects volume.',
    apply: (g) => { g.player.stats.fireRate *= 1.18; },
  },
  {
    id: 'damage',
    name: 'Shard Lances',
    desc: '+1 damage per shot. Husks break faster.',
    apply: (g) => { g.player.stats.bulletDamage += 1; },
  },
  {
    id: 'multishot',
    name: 'Split Cannon',
    desc: '+1 projectile per shot, fanned wide.',
    apply: (g) => { g.player.stats.projectiles = Math.min(6, g.player.stats.projectiles + 1); },
  },
  {
    id: 'speed',
    name: 'Ion Sails',
    desc: '+12% move speed. Outrun the dark.',
    apply: (g) => { g.player.stats.speed *= 1.12; },
  },
  {
    id: 'dash',
    name: 'Blink Drive',
    desc: 'Dash recharges 25% faster.',
    apply: (g) => { g.player.stats.dashCooldown *= 0.75; },
  },
  {
    id: 'vitality',
    name: 'Spare Hull',
    desc: '+1 max HP, and repair 2 HP now.',
    apply: (g) => {
      g.player.maxHp += 1;
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + 2);
    },
  },
  {
    id: 'shield',
    name: 'Aegis Loop',
    desc: 'A shield that blocks one hit, recharged every wave.',
    apply: (g) => {
      g.shieldPerWave = true;
      g.player.shieldUp = true;
    },
  },
  {
    id: 'magnet',
    name: 'Tractor Bloom',
    desc: 'Starshards drift to you from twice as far.',
    apply: (g) => { g.player.stats.magnet += 70; },
  },
];

// Three distinct cards, drawn with the run's RNG.
export function pickUpgrades(rng) {
  const pool = [...UPGRADE_POOL];
  const picks = [];
  while (picks.length < 3 && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks;
}
