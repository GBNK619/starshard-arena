// Starshard Arena — render.js
// Everything the player sees: the nebula void, the arena, every entity,
// the HUD and the title / upgrade / end screens. All of it is drawn with
// canvas shapes — the game ships no image files. The nebula backdrop is
// painted once onto an offscreen canvas, so a frame costs one drawImage
// plus the live layers on top of it.

import { FINAL_WAVE, PALETTE, VIEW, WAVE_CLEAR_BONUS } from './config.js';

// Two star layers that drift at different rates, for parallax depth. A
// few "hero" stars get a cross sparkle so the field has focal points.
export function createStarfield(rng) {
  const stars = [];
  for (let i = 0; i < 170; i++) {
    stars.push({
      x: rng() * VIEW.width,
      y: rng() * VIEW.height,
      z: rng() < 0.6 ? 0.4 : 1,
      r: 0.6 + rng() * 1.5,
      tw: rng() * Math.PI * 2,
      hero: rng() < 0.07,
    });
  }
  return stars;
}

// The nebula: layered radial-gradient blotches in indigo, violet and
// teal with one warm amber breath, a diagonal galactic band, dark voids
// for depth and a dusting of fine stars — all baked in once.
export function createBackdrop(rng) {
  const c = document.createElement('canvas');
  c.width = VIEW.width;
  c.height = VIEW.height;
  const x = c.getContext('2d');

  const base = x.createRadialGradient(480, 330, 90, 480, 330, 720);
  base.addColorStop(0, '#12122e');
  base.addColorStop(0.55, PALETTE.voidEdge);
  base.addColorStop(1, PALETTE.void);
  x.fillStyle = base;
  x.fillRect(0, 0, VIEW.width, VIEW.height);

  const blotch = (cx, cy, r, color, alpha) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color.replace('A', String(alpha)));
    g.addColorStop(1, color.replace('A', '0'));
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  };

  // A galactic band sweeping diagonally behind everything.
  x.save();
  x.translate(480, 360);
  x.rotate(-0.48);
  x.scale(1, 0.34);
  const band = x.createRadialGradient(0, 0, 0, 0, 0, 640);
  band.addColorStop(0, 'rgba(104, 88, 226, 0.20)');
  band.addColorStop(0.6, 'rgba(70, 60, 180, 0.08)');
  band.addColorStop(1, 'rgba(70, 60, 180, 0)');
  x.fillStyle = band;
  x.fillRect(-640, -640, 1280, 1280);
  x.restore();

  const nebulaColors = [
    'rgba(64, 50, 190, A)', // indigo
    'rgba(124, 58, 237, A)', // violet
    'rgba(13, 130, 140, A)', // teal
    'rgba(30, 64, 175, A)', // deep blue
    'rgba(88, 40, 160, A)', // purple
  ];
  for (let i = 0; i < 16; i++) {
    const color = nebulaColors[Math.floor(rng() * nebulaColors.length)];
    blotch(rng() * VIEW.width, rng() * VIEW.height, 130 + rng() * 240, color, 0.10 + rng() * 0.13);
  }
  // One warm breath of amber, the palette's accent, kept faint.
  blotch(140 + rng() * 240, 480 + rng() * 180, 190 + rng() * 120, 'rgba(217, 119, 6, A)', 0.07);
  blotch(620 + rng() * 240, 60 + rng() * 140, 170 + rng() * 110, 'rgba(217, 119, 6, A)', 0.05);
  // Dark voids, so the bright clouds have something to push against.
  for (let i = 0; i < 4; i++) {
    blotch(rng() * VIEW.width, rng() * VIEW.height, 120 + rng() * 160, 'rgba(2, 2, 10, A)', 0.20);
  }
  // Fine star dust baked into the deep field.
  for (let i = 0; i < 520; i++) {
    x.globalAlpha = 0.04 + rng() * 0.16;
    x.fillStyle = rng() < 0.12 ? '#ffd98a' : '#cfe8ff';
    x.fillRect(rng() * VIEW.width, rng() * VIEW.height, 1.3, 1.3);
  }
  x.globalAlpha = 1;
  return c;
}

function drawBackground(ctx, g) {
  if (g.backdrop) ctx.drawImage(g.backdrop, 0, 0);
  else {
    const grad = ctx.createRadialGradient(480, 360, 80, 480, 360, 640);
    grad.addColorStop(0, PALETTE.voidEdge);
    grad.addColorStop(1, PALETTE.void);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 60; x < VIEW.width; x += 60) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIEW.height);
  }
  for (let y = 60; y < VIEW.height; y += 60) {
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW.width, y);
  }
  ctx.stroke();

  for (const s of g.stars) {
    const drift = (g.time * 6 * s.z) % VIEW.width;
    const x = (s.x + drift) % VIEW.width;
    const twinkle = 0.35 + 0.3 * Math.sin(g.time * 1.7 + s.tw) * s.z;
    ctx.globalAlpha = Math.max(0.08, twinkle);
    ctx.fillStyle = '#cfe8ff';
    ctx.beginPath();
    ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    if (s.hero) {
      const len = 5 + 3 * Math.sin(g.time * 2.3 + s.tw);
      ctx.globalAlpha = Math.max(0.1, twinkle) * 0.8;
      ctx.strokeStyle = '#dff2ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - len, s.y);
      ctx.lineTo(x + len, s.y);
      ctx.moveTo(x, s.y - len);
      ctx.lineTo(x, s.y + len);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  drawArenaBorder(ctx, g.time);
}

// A double-ruled arena wall with a breathing glow, amber corner
// brackets and tick marks — the ring reads as a place, not a frame.
function drawArenaBorder(ctx, time) {
  const pulse = 0.7 + 0.3 * Math.sin(time * 1.6);
  ctx.save();
  ctx.strokeStyle = PALETTE.arenaLine;
  ctx.shadowColor = '#78c8ff';
  ctx.shadowBlur = 9 * pulse;
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, VIEW.width - 20, VIEW.height - 20);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.strokeRect(19, 19, VIEW.width - 38, VIEW.height - 38);
  ctx.globalAlpha = 1;

  // Tick marks along the top and bottom rails.
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.30)';
  ctx.beginPath();
  for (let x = 70; x < VIEW.width - 40; x += 60) {
    ctx.moveTo(x, 10);
    ctx.lineTo(x, 17);
    ctx.moveTo(x, VIEW.height - 17);
    ctx.lineTo(x, VIEW.height - 10);
  }
  ctx.stroke();

  // Amber corner brackets with pylon diamonds.
  ctx.strokeStyle = '#ffb52e';
  ctx.fillStyle = '#ffb52e';
  ctx.shadowColor = '#ffb52e';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3;
  const L = 30;
  const corners = [
    [10, 10, 1, 1],
    [VIEW.width - 10, 10, -1, 1],
    [10, VIEW.height - 10, 1, -1],
    [VIEW.width - 10, VIEW.height - 10, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + L * sx, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + L * sy);
    ctx.stroke();
    ctx.save();
    ctx.translate(cx + 13 * sx, cy + 13 * sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
    ctx.restore();
  }
  ctx.restore();
}

function polygon(ctx, x, y, r, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function neon(ctx, color, fillAlpha = 0.16) {
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.globalAlpha = fillAlpha;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// A soft disc of light under a sprite, so bodies read against the void.
function underGlow(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function drawPlayer(ctx, p, time) {
  // Dash ghosts: additive afterimages along the dash path.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const ghost of p.ghosts ?? []) {
    ctx.save();
    ctx.translate(ghost.x, ghost.y);
    ctx.rotate(ghost.aim);
    ctx.globalAlpha = ghost.life * 0.55;
    ctx.fillStyle = PALETTE.player;
    shipPath(ctx, p.r);
    ctx.fill();
    ctx.globalAlpha = ghost.life * 0.9;
    ctx.strokeStyle = '#bffbff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  underGlow(ctx, p.x, p.y, 40, 'rgba(55, 244, 255, 0.55)', 0.20 + 0.05 * Math.sin(time * 3));

  // A shield ring while the Aegis Loop holds.
  if (p.shieldUp) {
    ctx.strokeStyle = PALETTE.shield;
    ctx.globalAlpha = 0.55 + 0.2 * Math.sin(time * 4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Blink while invulnerable after a hit.
  if (p.invulnTime > 0 && Math.floor(time * 14) % 2 === 0) return;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aim);
  // Layered engine flame, longer the faster the ship moves.
  const flame = 8 + p.engineGlow * 17 + Math.sin(time * 31) * 2;
  ctx.fillStyle = 'rgba(255, 120, 40, 0.85)';
  ctx.beginPath();
  ctx.moveTo(-p.r - 1, 5.5);
  ctx.lineTo(-p.r - 3 - flame * 1.25, 0);
  ctx.lineTo(-p.r - 1, -5.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.moveTo(-p.r - 1, 3.4);
  ctx.lineTo(-p.r - 2 - flame, 0);
  ctx.lineTo(-p.r - 1, -3.4);
  ctx.closePath();
  ctx.fill();
  // Hull with a bright spine and wing accents.
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 16;
  ctx.fillStyle = PALETTE.player;
  shipPath(ctx, p.r);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#bffbff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(p.r + 2, 0);
  ctx.lineTo(-p.r * 0.4, 0);
  ctx.stroke();
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.arc(2, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.player;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Muzzle flash: a four-point star at the nose while the cannon speaks.
  if (p.muzzleTime > 0 || p.muzzleHold) {
    const fx = p.r + 11;
    const big = 11 + Math.sin(time * 47) * 2.5;
    const small = 4.2;
    ctx.save();
    ctx.translate(fx, 0);
    ctx.rotate(time * 9);
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.moveTo(big, 0);
    ctx.lineTo(small, small);
    ctx.lineTo(0, big * 0.62);
    ctx.lineTo(-small, small);
    ctx.lineTo(-big, 0);
    ctx.lineTo(-small, -small);
    ctx.lineTo(0, -big * 0.62);
    ctx.lineTo(small, -small);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function shipPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(r + 4, 0);
  ctx.lineTo(-r, r * 0.85);
  ctx.lineTo(-r * 0.55, 0);
  ctx.lineTo(-r, -r * 0.85);
  ctx.closePath();
}

function drawEnemy(ctx, e, time) {
  const color = PALETTE[e.kind];
  const flash = e.flash > 0.4;
  underGlow(ctx, e.x, e.y, e.r * 2.1, color, e.kind === 'brute' ? 0.20 : 0.13);
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.kind === 'chaser' || e.kind === 'dart' || e.kind === 'mini') {
    ctx.rotate(Math.atan2(e.vy, e.vx));
    if (e.kind === 'dart' && e.lungeTime > 0) {
      // Speed streaks trail a lunging dart.
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = 0.5 - k * 0.14;
        const yy = (k - 1) * 5;
        ctx.beginPath();
        ctx.moveTo(-e.r - 5 - k * 6, yy);
        ctx.lineTo(-e.r - 17 - k * 8, yy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    if (e.kind === 'dart') {
      // A needle: long nose, swept fins.
      ctx.moveTo(e.r + 8, 0);
      ctx.lineTo(-e.r * 0.4, e.r * 0.42);
      ctx.lineTo(-e.r - 3, e.r * 0.95);
      ctx.lineTo(-e.r * 0.75, 0);
      ctx.lineTo(-e.r - 3, -e.r * 0.95);
      ctx.lineTo(-e.r * 0.4, -e.r * 0.42);
    } else {
      ctx.moveTo(e.r + 3, 0);
      ctx.lineTo(-e.r, e.r * 0.8);
      ctx.lineTo(-e.r * 0.5, 0);
      ctx.lineTo(-e.r, -e.r * 0.8);
    }
    ctx.closePath();
  } else if (e.kind === 'orbiter') {
    ctx.rotate(e.t * 2.2 * e.orbitDir);
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.moveTo(e.r + 5, 0);
    ctx.arc(0, 0, e.r + 5, 0, Math.PI * 2);
  } else if (e.kind === 'splitter') {
    polygon(ctx, 0, 0, e.r, 5, e.t * 0.7);
  } else if (e.kind === 'brute') {
    polygon(ctx, 0, 0, e.r, 6, e.t * 0.4);
  }
  if (flash) {
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  } else {
    neon(ctx, color, e.kind === 'brute' ? 0.24 : 0.17);
  }
  // Per-kind innards, so each silhouette reads at a glance.
  if (e.kind === 'chaser' || e.kind === 'mini') {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(e.r * 0.15, 0, e.kind === 'mini' ? 1.8 : 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (e.kind === 'dart') {
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(e.r + 5, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.kind === 'orbiter') {
    // Three satellite nodes ride the outer ring.
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (e.r + 5), Math.sin(a) * (e.r + 5), 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    const pulse = 3.4 + Math.sin(time * 5 + e.t) * 0.9;
    ctx.fillStyle = '#f3e8ff';
    ctx.beginPath();
    ctx.arc(0, 0, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.kind === 'splitter') {
    polygon(ctx, 0, 0, e.r * 0.58, 5, -e.t * 0.7);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Cracks run from the core to three vertices: it wants to split.
    ctx.strokeStyle = 'rgba(4, 10, 4, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = e.t * 0.7 + (i / 5) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * e.r * 0.92, Math.sin(a) * e.r * 0.92);
    }
    ctx.stroke();
    ctx.fillStyle = '#eafff0';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.kind === 'brute') {
    polygon(ctx, 0, 0, e.r * 0.58, 6, -e.t * 0.4);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Corner studs on the hull vertices.
    ctx.fillStyle = color;
    for (let i = 0; i < 6; i++) {
      const a = e.t * 0.4 + (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * e.r, Math.sin(a) * e.r, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // A slow-burning core eye.
    const core = 4.6 + Math.sin(time * 2.6 + e.t) * 1.1;
    ctx.fillStyle = '#ffe3e3';
    ctx.beginPath();
    ctx.arc(0, 0, core, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // A thin health arc over anything tougher than one hit.
  if (e.maxHp > 3 && e.hp < e.maxHp) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 6, -Math.PI / 2, -Math.PI / 2 + (e.hp / e.maxHp) * Math.PI * 2);
    ctx.stroke();
  }
}

function drawPickups(ctx, pickups, time) {
  for (const pk of pickups) {
    const bob = Math.sin(time * 3 + pk.t * 4) * 2.5;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'shard') {
      // A pulsing halo ring marks treasure before the eye lands on it.
      const ring = 13 + Math.sin(time * 4 + pk.t * 3) * 3;
      ctx.strokeStyle = 'rgba(255, 217, 74, 0.4)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, ring, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(Math.PI / 4 + Math.sin(time * 2 + pk.t) * 0.3);
      ctx.shadowColor = PALETTE.shard;
      ctx.shadowBlur = 14;
      ctx.fillStyle = PALETTE.shard;
      ctx.fillRect(-5.5, -5.5, 11, 11);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(146, 96, 0, 0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-5.5, 0);
      ctx.lineTo(5.5, 0);
      ctx.moveTo(0, -5.5);
      ctx.lineTo(0, 5.5);
      ctx.stroke();
      ctx.fillStyle = '#fff6cf';
      ctx.fillRect(-2.5, -2.5, 5, 5);
    } else {
      ctx.shadowColor = PALETTE.heart;
      ctx.shadowBlur = 12;
      ctx.fillStyle = PALETTE.heart;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(-11, -2, -6, -10, 0, -4);
      ctx.bezierCurveTo(6, -10, 11, -2, 0, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(-3.4, -3.4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// Bullets are capsules with a hot core, drawn additively so a stream of
// fire reads as light, not dots.
function drawBullets(ctx, bullets) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of bullets) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / sp;
    const uy = b.vy / sp;
    ctx.shadowColor = PALETTE.bullet;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = PALETTE.bullet;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(b.x - ux * 13, b.y - uy * 13);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(b.x - ux * 10, b.y - uy * 10);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(ctx, particles) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const pt of particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.rot ?? 0);
    ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size);
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawFloatTexts(ctx, texts) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px system-ui, sans-serif';
  for (const t of texts) {
    const age = t.maxLife - t.life;
    const pop = age < 0.15 ? 0.6 + (age / 0.15) * 0.4 : 1;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(pop, pop);
    ctx.globalAlpha = Math.max(0, Math.min(1, t.life / (t.maxLife * 0.6)));
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 9;
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function heartPip(ctx, x, y, filled, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-9, -2, -5, -8, 0, -3);
  ctx.bezierCurveTo(5, -8, 9, -2, 0, 6);
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function hudPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 10, 28, 0.52)';
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9);
  ctx.fill();
  ctx.stroke();
}

function drawHUD(ctx, g) {
  const p = g.player;
  hudPanel(ctx, 14, 12, p.maxHp * 24 + 40, 56);
  hudPanel(ctx, VIEW.width / 2 - 132, 12, 264, 56);
  hudPanel(ctx, VIEW.width - 146, 12, 132, 56);
  // Hull, top-left: one pip per max HP.
  for (let i = 0; i < p.maxHp; i++) {
    heartPip(ctx, 34 + i * 24, 34, i < p.hp, PALETTE.heart);
  }
  if (p.shieldUp) {
    ctx.strokeStyle = PALETTE.shield;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(34 + p.maxHp * 24 + 6, 34, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('HULL', 24, 58);

  // Wave, top-center (with the endless flag once past the final wave).
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(120, 200, 255, 0.8)';
  ctx.shadowBlur = 10;
  const waveLabel = g.wave > FINAL_WAVE ? `WAVE ${g.wave} · ENDLESS` : `WAVE ${g.wave} / ${FINAL_WAVE}`;
  ctx.fillText(waveLabel, VIEW.width / 2, 38);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '12px system-ui, sans-serif';
  const hostiles = g.enemies.length + g.director.pending;
  ctx.fillText(hostiles > 0 ? `${hostiles} hostiles remain` : 'sector clear', VIEW.width / 2, 56);

  // Score, top-right, with a shard glyph.
  ctx.save();
  ctx.translate(VIEW.width - 118, 30);
  ctx.rotate(Math.PI / 4);
  ctx.shadowColor = PALETTE.shard;
  ctx.shadowBlur = 10;
  ctx.fillStyle = PALETTE.shard;
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(255, 217, 74, 0.7)';
  ctx.shadowBlur = 9;
  ctx.fillText(String(g.score), VIEW.width - 100, 39);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`best ${Math.max(g.best, g.score)}`, VIEW.width - 100, 57);

  // Dash charge, bottom-left.
  const dashReady = p.dashCooldown <= 0;
  const frac = dashReady ? 1 : 1 - p.dashCooldown / p.stats.dashCooldown;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.roundRect(24, VIEW.height - 34, 130, 9, 4);
  ctx.fill();
  if (dashReady) {
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 8;
  }
  ctx.fillStyle = dashReady ? PALETTE.player : 'rgba(55, 244, 255, 0.45)';
  ctx.beginPath();
  ctx.roundRect(24, VIEW.height - 34, Math.max(9, 130 * frac), 9, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(dashReady ? 'DASH READY' : 'DASH', 24, VIEW.height - 42);

  // Controls reminder, bottom-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(143, 163, 199, 0.75)';
  ctx.fillText('WASD move · mouse aim · Shift dash · P pause · M mute', VIEW.width - 24, VIEW.height - 20);
}

function centerText(ctx, str, y, font, color) {
  ctx.textAlign = 'center';
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(str, VIEW.width / 2, y);
}

// The shard emblem: two counter-rotating diamonds and a hot core, the
// game's mark, drawn over the title and the victory screen.
function drawEmblem(ctx, x, y, r, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = PALETTE.shard;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = PALETTE.shard;
  ctx.lineWidth = 2.4;
  ctx.save();
  ctx.rotate(time * 0.35);
  ctx.strokeRect(-r, -r, r * 2, r * 2);
  ctx.restore();
  ctx.save();
  ctx.rotate(Math.PI / 4 - time * 0.55);
  ctx.fillStyle = PALETTE.shard;
  ctx.globalAlpha = 0.92;
  const ir = r * 0.58;
  ctx.fillRect(-ir, -ir, ir * 2, ir * 2);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff6cf';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTitle(ctx, g) {
  // A spotlight behind the logo, darkening toward the edges, so the
  // staged battlefield glows through instead of sitting under a slab.
  const spot = ctx.createRadialGradient(480, 250, 60, 480, 250, 560);
  spot.addColorStop(0, 'rgba(8, 8, 26, 0.20)');
  spot.addColorStop(0.7, 'rgba(5, 5, 18, 0.48)');
  spot.addColorStop(1, 'rgba(3, 3, 12, 0.72)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // A slow diamond of shards orbits the title.
  for (let i = 0; i < 8; i++) {
    const a = g.time * 0.5 + (i / 8) * Math.PI * 2;
    const x = VIEW.width / 2 + Math.cos(a) * 305;
    const y = 238 + Math.sin(a) * 108;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4 + g.time);
    ctx.fillStyle = PALETTE.shard;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  drawEmblem(ctx, VIEW.width / 2, 108, 27, g.time);

  // The logotype: a dark underlay for depth, then a gradient face with
  // a cyan bloom.
  ctx.textAlign = 'center';
  ctx.font = 'bold 86px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(2, 6, 20, 0.75)';
  ctx.fillText('STARSHARD', VIEW.width / 2, 224 + 4);
  const face = ctx.createLinearGradient(0, 150, 0, 228);
  face.addColorStop(0, '#ffffff');
  face.addColorStop(0.55, '#c9f4ff');
  face.addColorStop(1, '#5fd7f2');
  ctx.fillStyle = face;
  ctx.shadowColor = '#37f4ff';
  ctx.shadowBlur = 26;
  ctx.fillText('STARSHARD', VIEW.width / 2, 224);
  ctx.shadowBlur = 0;

  ctx.font = 'bold 44px system-ui, sans-serif';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '16px';
  const amber = ctx.createLinearGradient(0, 246, 0, 292);
  amber.addColorStop(0, '#ffe9a8');
  amber.addColorStop(1, '#ff9d2e');
  ctx.fillStyle = amber;
  ctx.shadowColor = '#ffb52e';
  ctx.shadowBlur = 18;
  ctx.fillText('ARENA', VIEW.width / 2 + 8, 290);
  ctx.shadowBlur = 0;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  // A ruled line with a diamond heart under the name.
  ctx.strokeStyle = 'rgba(255, 217, 74, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(238, 322);
  ctx.lineTo(448, 322);
  ctx.moveTo(512, 322);
  ctx.lineTo(722, 322);
  ctx.stroke();
  ctx.save();
  ctx.translate(480, 322);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = PALETTE.shard;
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();

  centerText(ctx, 'The void shattered into starshards. Reclaim them. Survive ten waves.', 362, '17px system-ui, sans-serif', '#b8cbe8');

  // The controls live on a glass panel, like a real game's front end.
  ctx.fillStyle = 'rgba(8, 10, 28, 0.58)';
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.20)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(VIEW.width / 2 - 332, 392, 664, 98, 12);
  ctx.fill();
  ctx.stroke();
  centerText(ctx, 'WASD / arrows — move        mouse — aim        hold click / Space — shoot', 424, '16px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, 'Shift / right-click — dash        P — pause        M — mute', 452, '16px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, 'Collect gold starshards for score. Choose an upgrade after every wave.', 480, '15px system-ui, sans-serif', PALETTE.dim);

  const pulse = 0.65 + 0.35 * Math.sin(g.time * 3.4);
  ctx.globalAlpha = pulse;
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 12;
  centerText(ctx, 'CLICK OR PRESS ENTER TO LAUNCH', 556, 'bold 20px system-ui, sans-serif', PALETTE.player);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  if (g.best > 0) centerText(ctx, `best score ${g.best}`, 596, '15px system-ui, sans-serif', PALETTE.dim);
}

// A small canvas glyph per upgrade, drawn in a glowing medallion at the
// top of each card — the choice reads before a word of it does.
function drawUpgradeIcon(ctx, id, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
  halo.addColorStop(0, 'rgba(255, 217, 74, 0.20)');
  halo.addColorStop(1, 'rgba(255, 217, 74, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(-34, -34, 68, 68);
  ctx.strokeStyle = 'rgba(255, 217, 74, 0.65)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.shard;
  ctx.fillStyle = PALETTE.shard;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = PALETTE.shard;
  ctx.shadowBlur = 7;
  if (id === 'rapid') {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-15, i * 8);
      ctx.lineTo(3, i * 8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(12, 0, 4.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'damage') {
    ctx.beginPath();
    ctx.moveTo(13, -13);
    ctx.lineTo(1, 7);
    ctx.lineTo(-5, 1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-11, 5);
    ctx.lineTo(3, -3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-13, 13);
    ctx.lineTo(-7, 7);
    ctx.stroke();
  } else if (id === 'multishot') {
    for (const a of [-0.5, 0, 0.5]) {
      const dx = Math.sin(a) * 13;
      const dy = -Math.cos(a) * 13;
      ctx.beginPath();
      ctx.moveTo(dx * 0.3, 13);
      ctx.lineTo(dx, dy + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(dx, dy, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'speed') {
    ctx.beginPath();
    ctx.moveTo(2, -15);
    ctx.lineTo(2, 9);
    ctx.lineTo(14, 9);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, -15);
    ctx.lineTo(2, 13);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-14, 15);
    ctx.quadraticCurveTo(-7, 11, 0, 15);
    ctx.quadraticCurveTo(7, 19, 14, 15);
    ctx.stroke();
  } else if (id === 'dash') {
    for (const off of [-9, 3]) {
      ctx.beginPath();
      ctx.moveTo(off - 5, -11);
      ctx.lineTo(off + 7, 0);
      ctx.lineTo(off - 5, 11);
      ctx.stroke();
    }
  } else if (id === 'vitality') {
    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.bezierCurveTo(-19, -3, -10, -16, 0, -6);
    ctx.bezierCurveTo(10, -16, 19, -3, 0, 13);
    ctx.fill();
  } else if (id === 'shield') {
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(12, -10);
    ctx.lineTo(12, 2);
    ctx.quadraticCurveTo(12, 11, 0, 16);
    ctx.quadraticCurveTo(-12, 11, -12, 2);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 1, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'magnet') {
    ctx.beginPath();
    ctx.arc(0, -2, 10, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, -2);
    ctx.lineTo(-10, 8);
    ctx.moveTo(10, -2);
    ctx.lineTo(10, 8);
    ctx.stroke();
    ctx.fillRect(-13.5, 8, 7, 6);
    ctx.fillRect(6.5, 8, 7, 6);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 16, -12);
      ctx.lineTo(sx * 11, -7);
      ctx.moveTo(sx * 19, -6);
      ctx.lineTo(sx * 13, -3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// The before → after line at a card's foot: what this pick does to the
// ship's numbers, read straight off the live stats.
function upgradeStatLine(g, up) {
  const s = g.player.stats;
  const f1 = (n) => String(Math.round(n * 10) / 10);
  switch (up.id) {
    case 'rapid': return `FIRE RATE ${f1(s.fireRate)}/s → ${f1(s.fireRate * 1.18)}/s`;
    case 'damage': return `DAMAGE ${s.bulletDamage} → ${s.bulletDamage + 1} PER SHOT`;
    case 'multishot': return `PROJECTILES ${s.projectiles} → ${Math.min(6, s.projectiles + 1)} PER SHOT`;
    case 'speed': return `MOVE SPEED ${Math.round(s.speed)} → ${Math.round(s.speed * 1.12)}`;
    case 'dash': return `DASH RECHARGE ${f1(s.dashCooldown)}s → ${f1(s.dashCooldown * 0.75)}s`;
    case 'vitality': return `MAX HULL ${g.player.maxHp} → ${g.player.maxHp + 1} · REPAIR +2`;
    case 'shield': return 'BLOCKS 1 HIT · RECHARGES EVERY WAVE';
    case 'magnet': return `MAGNET RANGE ${Math.round(s.magnet)} → ${Math.round(s.magnet + 70)}`;
    default: return '';
  }
}

function drawUpgrade(ctx, g) {
  ctx.fillStyle = 'rgba(4, 4, 16, 0.60)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.save();
  ctx.shadowColor = 'rgba(120, 200, 255, 0.8)';
  ctx.shadowBlur = 14;
  centerText(ctx, `WAVE ${g.wave} CLEARED`, 148, 'bold 36px system-ui, sans-serif', PALETTE.text);
  ctx.restore();
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(VIEW.width / 2 + sx * 252, 138);
    ctx.rotate(Math.PI / 4 + g.time * 0.8);
    ctx.fillStyle = PALETTE.shard;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  centerText(ctx, `+${WAVE_CLEAR_BONUS} salvage bonus banked — choose an upgrade`, 182, '16px system-ui, sans-serif', '#b8cbe8');
  g.cardRects = [];
  const w = 252;
  const h = 258;
  const gap = 26;
  const totalW = w * 3 + gap * 2;
  const x0 = (VIEW.width - totalW) / 2;
  const y = 232;
  g.choices.forEach((up, i) => {
    const x = x0 + i * (w + gap);
    const hover = g.input.mouse.x >= x && g.input.mouse.x <= x + w && g.input.mouse.y >= y && g.input.mouse.y <= y + h;
    g.cardRects.push({ x, y, w, h, index: i });
    ctx.save();
    if (hover) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(1.025, 1.025);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, hover ? 'rgba(44, 56, 112, 0.97)' : 'rgba(26, 32, 74, 0.97)');
    grad.addColorStop(1, 'rgba(13, 15, 38, 0.97)');
    ctx.fillStyle = grad;
    ctx.strokeStyle = hover ? PALETTE.shard : 'rgba(120, 200, 255, 0.4)';
    ctx.lineWidth = hover ? 3 : 2;
    if (hover) {
      ctx.shadowColor = PALETTE.shard;
      ctx.shadowBlur = 18;
    }
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // An amber cap along the card's top edge.
    ctx.fillStyle = hover ? PALETTE.shard : 'rgba(255, 181, 46, 0.55)';
    ctx.beginPath();
    ctx.roundRect(x + 14, y, w - 28, 5, 2.5);
    ctx.fill();
    // The key chip, top-left.
    ctx.fillStyle = 'rgba(255, 217, 74, 0.14)';
    ctx.strokeStyle = 'rgba(255, 217, 74, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 14, y + 16, 34, 24, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.shard;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x + 31, y + 33);
    drawUpgradeIcon(ctx, up.id, x + w / 2, y + 62);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 21px system-ui, sans-serif';
    wrapText(ctx, up.name, x + w / 2, y + 122, w - 32, 24);
    ctx.fillStyle = '#a9bcdc';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, up.desc, x + w / 2, y + 156, w - 36, 20);
    // The stat line, ruled off at the foot.
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + h - 44);
    ctx.lineTo(x + w - 20, y + h - 44);
    ctx.stroke();
    ctx.fillStyle = '#ffcf5e';
    ctx.font = 'bold 13.5px system-ui, sans-serif';
    ctx.fillText(upgradeStatLine(g, up), x + w / 2, y + h - 19);
    ctx.restore();
  });
  centerText(ctx, 'click a card or press 1 · 2 · 3', y + h + 40, '14px system-ui, sans-serif', PALETTE.dim);
}

function wrapText(ctx, str, x, y, maxWidth, lineHeight) {
  const words = str.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

// Slow debris motes that drift through the end screens: gold shards
// rising on victory, grey-blue wreckage sinking on defeat.
function drawDebrisField(ctx, g, victory) {
  for (let i = 0; i < 16; i++) {
    const speed = 7 + (i % 5) * 3.5;
    const baseX = (i * 173 + 60) % VIEW.width;
    const baseY = (i * 97 + 40) % VIEW.height;
    const drift = (g.time * speed) % (VIEW.height + 60);
    const y = victory
      ? VIEW.height + 30 - ((baseY + drift) % (VIEW.height + 60))
      : (baseY + drift) % (VIEW.height + 60) - 30;
    const x = baseX + Math.sin(g.time * 0.6 + i * 1.7) * 14;
    const size = 3 + (i % 4) * 1.6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(g.time * (0.3 + (i % 3) * 0.22) + i);
    if (victory) {
      ctx.globalAlpha = 0.75;
      ctx.shadowColor = PALETTE.shard;
      ctx.shadowBlur = 8;
      ctx.fillStyle = PALETTE.shard;
    } else {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = i % 3 === 0 ? '#7a4a56' : '#5d6d8c';
    }
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// The player's wreck: a darkened, cracked hull with a broken wing,
// embers still burning and smoke curling off it.
function drawWreck(ctx, x, y, rot, time) {
  ctx.save();
  ctx.translate(x, y);
  // Smoke first, behind the hull.
  for (let i = 0; i < 3; i++) {
    const prog = ((time * 11 + i * 22) % 66) / 66;
    ctx.globalAlpha = 0.085 * (1 - prog);
    ctx.fillStyle = '#aab6cc';
    ctx.beginPath();
    ctx.arc(-8 - i * 9 - prog * 16, -16 - prog * 58, 6 + i * 3 + prog * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.rotate(rot);
  ctx.fillStyle = '#39415a';
  ctx.strokeStyle = '#6b7a99';
  ctx.lineWidth = 1.6;
  shipPath(ctx, 20);
  ctx.fill();
  ctx.stroke();
  // The torn-off wing, resting apart from the hull.
  ctx.save();
  ctx.translate(30, 16);
  ctx.rotate(0.9);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-8, 8);
  ctx.lineTo(-4, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // Cracks across the hull.
  ctx.strokeStyle = 'rgba(2, 4, 10, 0.6)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(12, -3);
  ctx.lineTo(2, 1);
  ctx.lineTo(-5, -4);
  ctx.moveTo(2, 1);
  ctx.lineTo(-3, 7);
  ctx.stroke();
  // Dying embers in the cockpit.
  for (let i = 0; i < 3; i++) {
    const flicker = 0.35 + 0.65 * Math.abs(Math.sin(time * 3.1 + i * 1.9));
    ctx.globalAlpha = flicker;
    ctx.fillStyle = '#ff9d4d';
    ctx.beginPath();
    ctx.arc(3 - i * 5, (i % 2) * 4 - 2, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawEndScreen(ctx, g, victory) {
  ctx.fillStyle = victory ? 'rgba(6, 20, 10, 0.55)' : 'rgba(20, 4, 8, 0.58)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  drawDebrisField(ctx, g, victory);
  if (victory) {
    drawEmblem(ctx, VIEW.width / 2, 128, 24, g.time);
    ctx.save();
    ctx.shadowColor = '#7dff9a';
    ctx.shadowBlur = 24;
    centerText(ctx, 'VOID CLEARED', 240, 'bold 56px system-ui, sans-serif', '#7dff9a');
    ctx.restore();
    centerText(ctx, 'All ten waves broken. The starshards sing your name.', 288, '17px system-ui, sans-serif', PALETTE.text);
  } else {
    ctx.save();
    ctx.shadowColor = PALETTE.danger;
    ctx.shadowBlur = 24;
    centerText(ctx, 'SHIP DOWN', 240, 'bold 56px system-ui, sans-serif', PALETTE.danger);
    ctx.restore();
    centerText(ctx, `Your run ended on wave ${g.wave}. The void keeps the rest — this time.`, 288, '17px system-ui, sans-serif', PALETTE.text);
    drawWreck(ctx, VIEW.width / 2, 602, -0.55, g.time);
  }
  if (g.score > 0 && g.score >= g.best) {
    ctx.fillStyle = 'rgba(255, 181, 46, 0.16)';
    ctx.strokeStyle = 'rgba(255, 181, 46, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(VIEW.width / 2 - 52, 308, 104, 24, 12);
    ctx.fill();
    ctx.stroke();
    centerText(ctx, 'NEW BEST', 325, 'bold 13px system-ui, sans-serif', '#ffcf5e');
  }
  ctx.save();
  ctx.shadowColor = PALETTE.shard;
  ctx.shadowBlur = 16;
  centerText(ctx, `SCORE ${g.score}`, 372, 'bold 36px system-ui, sans-serif', PALETTE.shard);
  ctx.restore();
  centerText(ctx, `starshards ${g.shardsCollected} · wave reached ${g.wave} · best ${g.best}`, 406, '16px system-ui, sans-serif', PALETTE.dim);
  if (victory) {
    centerText(ctx, 'ENTER — keep flying (endless waves)', 470, 'bold 18px system-ui, sans-serif', PALETTE.player);
    centerText(ctx, 'R — start a new run', 502, '16px system-ui, sans-serif', PALETTE.text);
  } else {
    centerText(ctx, 'Press R or click to fly again', 470, 'bold 18px system-ui, sans-serif', PALETTE.player);
  }
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(4, 4, 16, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centerText(ctx, 'PAUSED', 330, 'bold 40px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, 'P to resume', 372, '16px system-ui, sans-serif', PALETTE.dim);
}

function drawBanner(ctx, g) {
  if (g.bannerTime <= 0) return;
  const alpha = Math.min(1, g.bannerTime / 0.5);
  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.shadowColor = 'rgba(120, 200, 255, 0.9)';
  ctx.shadowBlur = 18;
  centerText(ctx, g.bannerText, 150, 'bold 44px system-ui, sans-serif', PALETTE.text);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawVignette(ctx, g) {
  if (g.vignette <= 0) return;
  const grad = ctx.createRadialGradient(480, 360, 260, 480, 360, 620);
  grad.addColorStop(0, 'rgba(255, 40, 60, 0)');
  grad.addColorStop(1, `rgba(255, 40, 60, ${0.38 * g.vignette})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

// The one entry point game.js calls each frame. `g` is the whole game
// state; shake is applied here so every layer moves together.
export function drawScene(ctx, g) {
  ctx.save();
  if (g.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }
  drawBackground(ctx, g);
  if (g.state !== 'title') {
    drawPickups(ctx, g.pickups, g.time);
    drawBullets(ctx, g.bullets);
    for (const e of g.enemies) drawEnemy(ctx, e, g.time);
    if (g.state !== 'gameover') drawPlayer(ctx, g.player, g.time);
    drawParticles(ctx, g.particles);
    drawFloatTexts(ctx, g.texts);
    drawHUD(ctx, g);
  } else if (g.ambient) {
    // The title's staged battlefield: the same layers, no HUD.
    drawPickups(ctx, g.pickups, g.time);
    drawBullets(ctx, g.bullets);
    for (const e of g.enemies) drawEnemy(ctx, e, g.time);
    drawPlayer(ctx, g.player, g.time);
    drawParticles(ctx, g.particles);
    drawFloatTexts(ctx, g.texts);
  }
  ctx.restore();

  if (g.state === 'title') drawTitle(ctx, g);
  if (g.state === 'upgrade') drawUpgrade(ctx, g);
  if (g.state === 'gameover') drawEndScreen(ctx, g, false);
  if (g.state === 'victory') drawEndScreen(ctx, g, true);
  if (g.paused) drawPause(ctx);
  // The wave banner belongs to live play; on the end screens it would
  // sit on top of the outcome (and the victory emblem).
  if (g.state === 'playing') drawBanner(ctx, g);
  drawVignette(ctx, g);
}
