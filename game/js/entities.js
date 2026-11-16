// Starshard Arena — entities.js
// Factories and per-frame updates for everything that moves: the ship,
// the five enemy kinds, bullets, particles, pickups and floating texts.
// Collision decisions stay in game.js; this file only moves things.

import { ENEMY_TYPES, PALETTE, PLAYER_BASE, VIEW } from './config.js';

export function createPlayer() {
  return {
    x: VIEW.width / 2,
    y: VIEW.height / 2,
    vx: 0,
    vy: 0,
    r: PLAYER_BASE.radius,
    stats: { ...PLAYER_BASE },
    hp: PLAYER_BASE.hp,
    maxHp: PLAYER_BASE.hp,
    aim: -Math.PI / 2,
    fireCooldown: 0,
    muzzleTime: 0, // seconds since the cannon last spoke; render flashes on it
    muzzleHold: false, // screenshot staging pins the flash on
    dashCooldown: 0,
    dashTime: 0,
    dashDir: { x: 1, y: 0 },
    invulnTime: 0,
    shieldUp: false,
    engineGlow: 0,
  };
}

export function spawnEnemy(kind, x, y, rng, speedScale = 1) {
  const base = ENEMY_TYPES[kind];
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    r: base.radius,
    hp: base.hp,
    maxHp: base.hp,
    speed: base.speed * speedScale,
    shards: base.shards,
    knockResist: base.knockResist,
    flash: 0,
    t: rng() * 10, // personal clock: wobble, orbits and lunges phase off it
    spin: (rng() - 0.5) * 2,
    orbitDir: rng() < 0.5 ? -1 : 1,
    lungeTime: 0,
    lungeCooldown: 1 + rng() * 1.6,
    lungeDir: { x: 0, y: 0 },
    touchCooldown: 0,
  };
}

export function createBullet(x, y, angle, stats) {
  return {
    x,
    y,
    vx: Math.cos(angle) * stats.bulletSpeed,
    vy: Math.sin(angle) * stats.bulletSpeed,
    r: 4,
    damage: stats.bulletDamage,
    life: stats.bulletLife,
  };
}

export function burst(particles, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i++) {
    if (particles.length > 420) return;
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.9);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: life * (0.5 + Math.random() * 0.8),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
      drag: 3.2,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 7,
    });
  }
}

export function spawnPickup(pickups, kind, x, y, rng) {
  pickups.push({
    kind, // 'shard' | 'heart'
    x,
    y,
    vx: (rng() - 0.5) * 90,
    vy: (rng() - 0.5) * 90,
    r: kind === 'shard' ? 8 : 11,
    t: rng() * 6,
  });
}

export function spawnFloatText(texts, x, y, str, color = PALETTE.shard) {
  texts.push({ x, y, str, color, life: 0.9, maxLife: 0.9 });
}

function clampToArena(e, margin = 4) {
  e.x = Math.min(VIEW.width - e.r - margin, Math.max(e.r + margin, e.x));
  e.y = Math.min(VIEW.height - e.r - margin, Math.max(e.r + margin, e.y));
}

// Movement, dash and timers for the ship. Firing lives in game.js because
// it needs the bullet list and the audio engine together.
export function updatePlayer(p, input, dt) {
  const axis = input.moveAxis();
  const len = Math.hypot(axis.x, axis.y) || 1;
  const wantX = (axis.x / len) * (axis.x || axis.y ? 1 : 0);
  const wantY = (axis.y / len) * (axis.x || axis.y ? 1 : 0);

  const dashWanted =
    input.pressed('ShiftLeft') || input.pressed('ShiftRight') || input.rightClicked;
  if (dashWanted && p.dashCooldown <= 0 && p.dashTime <= 0) {
    const dir = axis.x || axis.y ? { x: wantX, y: wantY } : { x: Math.cos(p.aim), y: Math.sin(p.aim) };
    p.dashDir = dir;
    p.dashTime = p.stats.dashTime;
    p.dashCooldown = p.stats.dashCooldown;
  }

  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.vx = p.dashDir.x * p.stats.dashSpeed;
    p.vy = p.dashDir.y * p.stats.dashSpeed;
  } else {
    const accel = 2600;
    p.vx += (wantX * p.stats.speed - p.vx) * Math.min(1, (accel / p.stats.speed) * dt * 3.2);
    p.vy += (wantY * p.stats.speed - p.vy) * Math.min(1, (accel / p.stats.speed) * dt * 3.2);
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  clampToArena(p);

  p.aim = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.muzzleTime = Math.max(0, p.muzzleTime - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.invulnTime = Math.max(0, p.invulnTime - dt);
  p.engineGlow = Math.hypot(p.vx, p.vy) / p.stats.dashSpeed;
}

// One enemy's steering. Each kind reads differently on purpose:
// chasers lean in, darts telegraph and lunge, orbiters circle and dive,
// splitters and brutes just keep coming.
export function updateEnemy(e, player, dt) {
  e.t += dt;
  e.flash = Math.max(0, e.flash - dt * 6);
  e.touchCooldown = Math.max(0, e.touchCooldown - dt);
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  let tx = 0;
  let ty = 0;

  if (e.kind === 'chaser' || e.kind === 'mini') {
    const wobble = Math.sin(e.t * 3.1) * 0.35;
    tx = (ux * Math.cos(wobble) - uy * Math.sin(wobble)) * e.speed;
    ty = (ux * Math.sin(wobble) + uy * Math.cos(wobble)) * e.speed;
  } else if (e.kind === 'dart') {
    e.lungeCooldown -= dt;
    if (e.lungeTime > 0) {
      e.lungeTime -= dt;
      tx = e.lungeDir.x * e.speed * 3.1;
      ty = e.lungeDir.y * e.speed * 3.1;
    } else if (e.lungeCooldown <= 0 && dist < 300) {
      e.lungeDir = { x: ux, y: uy };
      e.lungeTime = 0.32;
      e.lungeCooldown = 1.5 + Math.random() * 1.2;
    } else {
      tx = ux * e.speed;
      ty = uy * e.speed;
    }
  } else if (e.kind === 'orbiter') {
    e.lungeCooldown -= dt;
    if (e.lungeTime > 0) {
      e.lungeTime -= dt;
      tx = e.lungeDir.x * e.speed * 3.4;
      ty = e.lungeDir.y * e.speed * 3.4;
    } else if (e.lungeCooldown <= 0 && dist < 210) {
      e.lungeDir = { x: ux, y: uy };
      e.lungeTime = 0.3;
      e.lungeCooldown = 2.6 + Math.random() * 1.4;
    } else {
      // Tangent around the player, drifting inward until it is close.
      const tangent = e.orbitDir;
      const inward = dist > 150 ? 0.45 : 0.05;
      tx = (ux * inward - uy * tangent) * e.speed;
      ty = (uy * inward + ux * tangent) * e.speed;
    }
  } else {
    // splitter, brute: a straight, patient advance.
    tx = ux * e.speed;
    ty = uy * e.speed;
  }

  const steer = e.kind === 'brute' ? 1.6 : 3.4;
  e.vx += (tx - e.vx) * Math.min(1, steer * dt);
  e.vy += (ty - e.vy) * Math.min(1, steer * dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  clampToArena(e);
}

export function updateBullets(bullets, dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > VIEW.width + 20 || b.y < -20 || b.y > VIEW.height + 20) {
      bullets.splice(i, 1);
    }
  }
}

export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    const drag = Math.max(0, 1 - pt.drag * dt);
    pt.vx *= drag;
    pt.vy *= drag;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.rot += pt.vr * dt;
  }
}

// Pickups drift, settle, and slide toward the ship inside its magnet
// radius — close enough to feel generous, not so close it plays itself.
export function updatePickups(pickups, player, dt) {
  for (const pk of pickups) {
    pk.t += dt;
    pk.vx *= Math.max(0, 1 - 4 * dt);
    pk.vy *= Math.max(0, 1 - 4 * dt);
    const dx = player.x - pk.x;
    const dy = player.y - pk.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < player.stats.magnet) {
      const pull = 340 * (1 - dist / player.stats.magnet) + 120;
      pk.vx += (dx / dist) * pull * dt * 4;
      pk.vy += (dy / dist) * pull * dt * 4;
    }
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
  }
}

export function updateFloatTexts(texts, dt) {
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) texts.splice(i, 1);
  }
}
