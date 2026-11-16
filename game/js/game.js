// Starshard Arena — game.js
// The state machine and the main loop: title, playing, the between-wave
// upgrade choice, victory and game over. It owns collisions and scoring;
// entities.js moves things, waves.js feeds the arena, render.js draws.

import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import {
  FINAL_WAVE,
  HEART_CHANCE,
  PALETTE,
  SHARD_SCORE,
  VIEW,
  WAVE_CLEAR_BONUS,
  createRng,
} from './config.js';
import {
  burst,
  createBullet,
  createPlayer,
  spawnEnemy,
  spawnFloatText,
  spawnPickup,
  updateBullets,
  updateEnemy,
  updateFloatTexts,
  updateParticles,
  updatePickups,
  updatePlayer,
} from './entities.js';
import { WaveDirector, pickUpgrades } from './waves.js';
import { UPGRADE_POOL } from './waves.js';
import { createStarfield, drawScene } from './render.js';

const BEST_KEY = 'starshard-arena-best';

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.audio = new AudioEngine();

    const params = new URLSearchParams(window.location.search);
    const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
    this.rng = createRng(Number.isFinite(seedParam) ? seedParam : (Math.random() * 1e9) | 0);
    this.shot = params.get('shot');
    this.timeScale = 1;

    this.stars = createStarfield(this.rng);
    this.state = 'title';
    this.paused = false;
    this.time = 0;
    this.best = this.loadBest();

    this.player = createPlayer();
    this.player.ghosts = [];
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.texts = [];
    this.director = new WaveDirector(this.rng);
    this.wave = 0;
    this.score = 0;
    this.shardsCollected = 0;
    this.shieldPerWave = false;
    this.endless = false;
    this.choices = [];
    this.cardRects = [];
    this.shake = 0;
    this.vignette = 0;
    this.bannerText = '';
    this.bannerTime = 0;

    if (this.shot) this.stageShot(this.shot);

    this.lastTs = performance.now();
    const loop = (ts) => {
      const rawDt = Math.min(0.033, (ts - this.lastTs) / 1000 || 0.016);
      this.lastTs = ts;
      this.update(rawDt * this.timeScale, rawDt);
      drawScene(this.ctx, this);
      this.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  loadBest() {
    try {
      return Number.parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        // Private modes refuse storage; the best score just won't persist.
      }
    }
  }

  // --- run setup -------------------------------------------------------

  startRun() {
    this.player = createPlayer();
    this.player.ghosts = [];
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.texts = [];
    this.wave = 0;
    this.score = 0;
    this.shardsCollected = 0;
    this.shieldPerWave = false;
    this.endless = false;
    this.paused = false;
    this.shake = 0;
    this.vignette = 0;
    this.startNextWave();
  }

  startNextWave() {
    this.wave += 1;
    this.director.startWave(this.wave);
    if (this.shieldPerWave) this.player.shieldUp = true;
    this.bannerText = this.wave > FINAL_WAVE ? `WAVE ${this.wave} — ENDLESS` : `WAVE ${this.wave}`;
    this.bannerTime = 1.6;
    this.state = 'playing';
    this.audio.waveStart();
  }

  // --- staging for the maker's screenshots -----------------------------
  // The kit's own tooling loads the game with ?shot=<scene>&seed=<n> to
  // photograph each screen; normal play reaches all of them on its own.

  stageShot(shot) {
    if (shot === 'title') {
      this.best = Math.max(this.best, 1250);
      return;
    }
    this.startRun();
    if (shot === 'play') {
      this.timeScale = 0.35; // hold the composition a moment for the camera
      this.wave = 3;
      this.director.queue = [];
      this.enemies = [];
      this.score = 240;
      this.shardsCollected = 24;
      this.player.hp = 4;
      this.player.x = 430;
      this.player.y = 400;
      this.player.dashCooldown = 0.9;
      this.input.mouse.x = 770;
      this.input.mouse.y = 235;
      this.player.aim = Math.atan2(
        this.input.mouse.y - this.player.y,
        this.input.mouse.x - this.player.x,
      );
      this.bannerTime = 0;
      const place = (kind, x, y) => this.enemies.push(spawnEnemy(kind, x, y, this.rng, 1.06));
      place('chaser', 705, 225);
      place('chaser', 765, 430);
      place('dart', 645, 565);
      place('orbiter', 295, 215);
      place('splitter', 825, 305);
      place('mini', 660, 320);
      for (let i = 0; i < 3; i++) {
        const d = 44 + i * 52;
        const b = createBullet(
          this.player.x + Math.cos(this.player.aim) * d,
          this.player.y + Math.sin(this.player.aim) * d,
          this.player.aim,
          this.player.stats,
        );
        this.bullets.push(b);
      }
      spawnPickup(this.pickups, 'shard', 520, 300, this.rng);
      spawnPickup(this.pickups, 'shard', 565, 520, this.rng);
      spawnPickup(this.pickups, 'shard', 755, 620, this.rng);
      spawnPickup(this.pickups, 'heart', 205, 560, this.rng);
      burst(this.particles, 700, 228, PALETTE.chaser, 14, 190, 0.6, 4);
    } else if (shot === 'upgrade') {
      this.wave = 3;
      this.director.queue = [];
      this.enemies = [];
      this.score = 320;
      this.shardsCollected = 27;
      this.player.hp = 4;
      const byId = (id) => UPGRADE_POOL.find((u) => u.id === id);
      this.choices = [byId('multishot'), byId('damage'), byId('vitality')];
      this.bannerTime = 0;
      this.state = 'upgrade';
    } else if (shot === 'end') {
      this.wave = 7;
      this.director.queue = [];
      this.enemies = [];
      this.player.hp = 0; // the hull pips behind the end screen should read empty
      this.score = 580;
      this.shardsCollected = 53;
      this.best = Math.max(this.best, 580);
      this.bannerTime = 0;
      this.state = 'gameover';
    }
  }

  // --- per-frame update --------------------------------------------------

  update(dt, rawDt) {
    this.time += rawDt;
    this.shake = Math.max(0, this.shake - rawDt * 26);
    this.vignette = Math.max(0, this.vignette - rawDt * 1.7);
    this.bannerTime = Math.max(0, this.bannerTime - rawDt);
    updateParticles(this.particles, dt);
    updateFloatTexts(this.texts, dt);

    if (this.input.pressed('KeyM')) this.audio.setMuted(!this.audio.muted);

    if (this.state === 'title') {
      if (this.input.clicked || this.input.pressed('Enter') || this.input.pressed('Space')) {
        this.audio.unlock();
        this.startRun();
      }
      return;
    }

    if (this.state === 'upgrade') {
      this.updateUpgradeChoice();
      return;
    }

    if (this.state === 'gameover') {
      if (this.input.pressed('KeyR') || this.input.clicked) {
        this.audio.unlock();
        this.startRun();
      }
      return;
    }

    if (this.state === 'victory') {
      if (this.input.pressed('Enter') || this.input.clicked) {
        this.endless = true;
        this.choices = pickUpgrades(this.rng);
        this.state = 'upgrade';
      } else if (this.input.pressed('KeyR')) {
        this.startRun();
      }
      return;
    }

    // state === 'playing'
    if (this.input.pressed('KeyP')) this.paused = !this.paused;
    if (this.paused) return;

    this.director.update(dt, this.player, this.enemies);
    updatePlayer(this.player, this.input, dt);
    this.updateGhosts(dt);
    this.updateShooting(dt);
    updateBullets(this.bullets, dt);
    for (const e of this.enemies) updateEnemy(e, this.player, dt);
    this.separateEnemies();
    updatePickups(this.pickups, this.player, dt);
    this.collide();
    if (this.state !== 'playing') return; // a collision may have ended the run

    if (this.director.pending === 0 && this.enemies.length === 0) {
      this.waveCleared();
    }
  }

  updateGhosts(dt) {
    const p = this.player;
    if (p.dashTime > 0) {
      if (p.ghosts.length === 0) this.audio.dash(); // once per dash, not per frame
      p.ghosts.push({ x: p.x, y: p.y, aim: p.aim, life: 0.28 });
    }
    for (let i = p.ghosts.length - 1; i >= 0; i--) {
      p.ghosts[i].life -= dt;
      if (p.ghosts[i].life <= 0) p.ghosts.splice(i, 1);
    }
  }

  updateShooting(dt) {
    const p = this.player;
    const firing = this.input.mouse.down || this.input.isDown('Space');
    if (!firing || p.fireCooldown > 0) return;
    p.fireCooldown = 1 / p.stats.fireRate;
    const n = p.stats.projectiles;
    const spreadStep = 0.085;
    for (let i = 0; i < n; i++) {
      const angle = p.aim + (i - (n - 1) / 2) * spreadStep;
      const b = createBullet(p.x + Math.cos(p.aim) * (p.r + 6), p.y + Math.sin(p.aim) * (p.r + 6), angle, p.stats);
      this.bullets.push(b);
    }
    burst(this.particles, p.x + Math.cos(p.aim) * (p.r + 10), p.y + Math.sin(p.aim) * (p.r + 10), PALETTE.bullet, 2, 90, 0.16, 3);
    this.audio.shoot();
  }

  // Gentle push-apart so stacked spawns don't overlap into one blob.
  separateEnemies() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const min = a.r + b.r + 2;
        if (dist > 0 && dist < min) {
          const push = ((min - dist) / dist) * 0.5;
          a.x -= dx * push * 0.5;
          a.y -= dy * push * 0.5;
          b.x += dx * push * 0.5;
          b.y += dy * push * 0.5;
        }
      }
    }
  }

  collide() {
    const p = this.player;

    // Bullets into enemies.
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let spent = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
          spent = true;
          e.hp -= b.damage;
          e.flash = 1;
          const kb = (1 - e.knockResist) * 130;
          e.vx += (b.vx / p.stats.bulletSpeed) * kb;
          e.vy += (b.vy / p.stats.bulletSpeed) * kb;
          burst(this.particles, b.x, b.y, PALETTE[e.kind], 4, 150, 0.3, 3);
          if (e.hp <= 0) this.killEnemy(j);
          else this.audio.hit();
          break;
        }
      }
      if (spent) this.bullets.splice(i, 1);
    }

    // Enemies into the ship.
    for (let j = this.enemies.length - 1; j >= 0; j--) {
      const e = this.enemies[j];
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r - 2) {
        const crashed = e.kind !== 'brute';
        if (crashed) {
          burst(this.particles, e.x, e.y, PALETTE[e.kind], 12, 200, 0.4, 4);
          this.enemies.splice(j, 1);
        } else {
          e.vx -= (e.x - p.x) * 6;
          e.vy -= (e.y - p.y) * 6;
        }
        this.hurtPlayer(e.x, e.y);
        if (this.state !== 'playing') return;
      }
    }

    // The ship into pickups.
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < pk.r + p.r + 4) {
        this.pickups.splice(i, 1);
        if (pk.kind === 'shard') {
          this.score += SHARD_SCORE;
          this.shardsCollected += 1;
          spawnFloatText(this.texts, pk.x, pk.y - 8, `+${SHARD_SCORE}`);
          burst(this.particles, pk.x, pk.y, PALETTE.shard, 5, 110, 0.3, 3);
          this.audio.pickup();
        } else if (p.hp < p.maxHp) {
          p.hp += 1;
          spawnFloatText(this.texts, pk.x, pk.y - 8, '+1 HULL', PALETTE.heart);
          this.audio.heart();
        } else {
          this.score += 25;
          spawnFloatText(this.texts, pk.x, pk.y - 8, '+25');
          this.audio.pickup();
        }
      }
    }
  }

  killEnemy(index) {
    const e = this.enemies[index];
    this.enemies.splice(index, 1);
    const big = e.kind === 'brute' || e.kind === 'splitter';
    burst(this.particles, e.x, e.y, PALETTE[e.kind], big ? 30 : 16, big ? 280 : 210, 0.55, 4.5);
    burst(this.particles, e.x, e.y, '#ffffff', 5, 160, 0.3, 3);
    if (big) this.shake = Math.max(this.shake, e.kind === 'brute' ? 11 : 6);
    this.audio.explosion(e.kind === 'brute');
    for (let i = 0; i < e.shards; i++) spawnPickup(this.pickups, 'shard', e.x, e.y, this.rng);
    if (this.rng() < HEART_CHANCE && !this.pickups.some((pk) => pk.kind === 'heart')) {
      spawnPickup(this.pickups, 'heart', e.x, e.y, this.rng);
    }
    if (e.kind === 'splitter') {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + this.rng();
        const mini = spawnEnemy('mini', e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16, this.rng, 1);
        mini.vx = Math.cos(a) * 190;
        mini.vy = Math.sin(a) * 190;
        this.enemies.push(mini);
      }
    }
  }

  hurtPlayer(fromX, fromY) {
    const p = this.player;
    if (p.invulnTime > 0 || p.dashTime > 0) return;
    if (p.shieldUp) {
      p.shieldUp = false;
      p.invulnTime = 1.0;
      burst(this.particles, p.x, p.y, PALETTE.shield, 16, 220, 0.4, 3.5);
      this.audio.shieldBreak();
      return;
    }
    p.hp -= 1;
    p.invulnTime = 1.25;
    this.vignette = 1;
    this.shake = Math.max(this.shake, 9);
    const a = Math.atan2(p.y - fromY, p.x - fromX);
    p.vx += Math.cos(a) * 320;
    p.vy += Math.sin(a) * 320;
    burst(this.particles, p.x, p.y, PALETTE.danger, 14, 230, 0.4, 4);
    this.audio.hurt();
    if (p.hp <= 0) {
      burst(this.particles, p.x, p.y, PALETTE.player, 46, 320, 0.9, 5);
      burst(this.particles, p.x, p.y, PALETTE.shard, 20, 240, 0.8, 4);
      this.shake = 16;
      this.audio.explosion(true);
      this.audio.lose();
      this.saveBest();
      this.state = 'gameover';
    }
  }

  waveCleared() {
    this.score += WAVE_CLEAR_BONUS;
    if (this.wave >= FINAL_WAVE && !this.endless) {
      this.saveBest();
      this.audio.win();
      this.state = 'victory';
      return;
    }
    this.choices = pickUpgrades(this.rng);
    this.state = 'upgrade';
  }

  updateUpgradeChoice() {
    let pick = -1;
    if (this.input.pressed('Digit1')) pick = 0;
    if (this.input.pressed('Digit2')) pick = 1;
    if (this.input.pressed('Digit3')) pick = 2;
    if (this.input.clicked) {
      for (const rect of this.cardRects) {
        const m = this.input.mouse;
        if (m.x >= rect.x && m.x <= rect.x + rect.w && m.y >= rect.y && m.y <= rect.y + rect.h) {
          pick = rect.index;
        }
      }
    }
    if (pick >= 0 && this.choices[pick]) {
      this.audio.unlock();
      this.choices[pick].apply(this);
      this.audio.upgrade();
      this.startNextWave();
    }
  }
}

const canvas = document.getElementById('game');
if (canvas) {
  window.__starshard = new Game(canvas);
}
