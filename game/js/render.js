// Starshard Arena — render.js
// Everything the player sees: the void, the arena, every entity, the HUD
// and the title / upgrade / end screens. All of it is drawn with canvas
// shapes — the game ships no image files.

import { FINAL_WAVE, PALETTE, VIEW, WAVE_CLEAR_BONUS } from './config.js';

// Two star layers that drift at different rates, for parallax depth.
export function createStarfield(rng) {
  const stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: rng() * VIEW.width,
      y: rng() * VIEW.height,
      z: rng() < 0.6 ? 0.4 : 1,
      r: 0.6 + rng() * 1.5,
      tw: rng() * Math.PI * 2,
    });
  }
  return stars;
}

function drawBackground(ctx, stars, time) {
  const grad = ctx.createRadialGradient(480, 360, 80, 480, 360, 640);
  grad.addColorStop(0, PALETTE.voidEdge);
  grad.addColorStop(1, PALETTE.void);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

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

  for (const s of stars) {
    const drift = (time * 6 * s.z) % VIEW.width;
    const x = (s.x + drift) % VIEW.width;
    const alpha = 0.35 + 0.3 * Math.sin(time * 1.7 + s.tw) * s.z;
    ctx.globalAlpha = Math.max(0.08, alpha);
    ctx.fillStyle = '#cfe8ff';
    ctx.beginPath();
    ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = PALETTE.arenaLine;
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, VIEW.width - 20, VIEW.height - 20);
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

function drawPlayer(ctx, p, time) {
  // Dash ghosts: fading triangles along the dash path.
  for (const ghost of p.ghosts ?? []) {
    ctx.save();
    ctx.translate(ghost.x, ghost.y);
    ctx.rotate(ghost.aim);
    ctx.globalAlpha = ghost.life * 0.5;
    ctx.fillStyle = PALETTE.player;
    shipPath(ctx, p.r);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

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
  // Engine flame, longer the faster the ship moves.
  const flame = 8 + p.engineGlow * 16 + Math.sin(time * 31) * 2;
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(-p.r - 2, 4);
  ctx.lineTo(-p.r - 2 - flame, 0);
  ctx.lineTo(-p.r - 2, -4);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 16;
  ctx.fillStyle = PALETTE.player;
  shipPath(ctx, p.r);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.arc(2, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.kind === 'chaser' || e.kind === 'dart' || e.kind === 'mini') {
    ctx.rotate(Math.atan2(e.vy, e.vx));
    ctx.beginPath();
    ctx.moveTo(e.r + 3, 0);
    ctx.lineTo(-e.r, e.r * 0.8);
    ctx.lineTo(-e.r * 0.5, 0);
    ctx.lineTo(-e.r, -e.r * 0.8);
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
    neon(ctx, color, e.kind === 'brute' ? 0.22 : 0.16);
  }
  // An orbiter's inner eye tracks its mood; a brute shows its thick hull.
  if (e.kind === 'orbiter') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.kind === 'brute') {
    polygon(ctx, 0, 0, e.r * 0.55, 6, -e.t * 0.4);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
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
      ctx.rotate(Math.PI / 4 + Math.sin(time * 2 + pk.t) * 0.3);
      ctx.shadowColor = PALETTE.shard;
      ctx.shadowBlur = 12;
      ctx.fillStyle = PALETTE.shard;
      ctx.fillRect(-5.5, -5.5, 11, 11);
      ctx.shadowBlur = 0;
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
    }
    ctx.restore();
  }
}

function drawBullets(ctx, bullets) {
  ctx.shadowColor = PALETTE.bullet;
  ctx.shadowBlur = 10;
  ctx.fillStyle = PALETTE.bullet;
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawParticles(ctx, particles) {
  for (const pt of particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawFloatTexts(ctx, texts) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  for (const t of texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, t.x, t.y);
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

function drawHUD(ctx, g) {
  const p = g.player;
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
  const waveLabel = g.wave > FINAL_WAVE ? `WAVE ${g.wave} · ENDLESS` : `WAVE ${g.wave} / ${FINAL_WAVE}`;
  ctx.fillText(waveLabel, VIEW.width / 2, 38);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '12px system-ui, sans-serif';
  const hostiles = g.enemies.length + g.director.pending;
  ctx.fillText(hostiles > 0 ? `${hostiles} hostiles remain` : 'sector clear', VIEW.width / 2, 56);

  // Score, top-right, with a shard glyph.
  ctx.save();
  ctx.translate(VIEW.width - 118, 30);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = PALETTE.shard;
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(String(g.score), VIEW.width - 100, 39);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`best ${Math.max(g.best, g.score)}`, VIEW.width - 100, 57);

  // Dash charge, bottom-left.
  const dashReady = p.dashCooldown <= 0;
  const frac = dashReady ? 1 : 1 - p.dashCooldown / p.stats.dashCooldown;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(24, VIEW.height - 34, 130, 9);
  ctx.fillStyle = dashReady ? PALETTE.player : 'rgba(55, 244, 255, 0.45)';
  ctx.fillRect(24, VIEW.height - 34, 130 * frac, 9);
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

function drawTitle(ctx, g) {
  ctx.fillStyle = 'rgba(4, 4, 16, 0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // A slow diamond of shards orbits the title.
  for (let i = 0; i < 8; i++) {
    const a = g.time * 0.5 + (i / 8) * Math.PI * 2;
    const x = VIEW.width / 2 + Math.cos(a) * 250;
    const y = 218 + Math.sin(a) * 42;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4 + g.time);
    ctx.fillStyle = PALETTE.shard;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  centerText(ctx, 'STARSHARD', 208, 'bold 74px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, 'ARENA', 272, 'bold 40px system-ui, sans-serif', PALETTE.shard);
  centerText(ctx, 'The void shattered into starshards. Reclaim them. Survive ten waves.', 330, '17px system-ui, sans-serif', PALETTE.dim);
  centerText(ctx, 'WASD / arrows — move        mouse — aim        hold click / Space — shoot', 420, '16px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, 'Shift / right-click — dash        P — pause        M — mute', 448, '16px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, 'Collect gold starshards for score. Choose an upgrade after every wave.', 476, '16px system-ui, sans-serif', PALETTE.text);
  const pulse = 0.65 + 0.35 * Math.sin(g.time * 3.4);
  ctx.globalAlpha = pulse;
  centerText(ctx, 'CLICK OR PRESS ENTER TO LAUNCH', 548, 'bold 20px system-ui, sans-serif', PALETTE.player);
  ctx.globalAlpha = 1;
  if (g.best > 0) centerText(ctx, `best score ${g.best}`, 592, '15px system-ui, sans-serif', PALETTE.dim);
}

function drawUpgrade(ctx, g) {
  ctx.fillStyle = 'rgba(4, 4, 16, 0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centerText(ctx, `WAVE ${g.wave} CLEARED`, 168, 'bold 34px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, `+${WAVE_CLEAR_BONUS} salvage bonus banked — choose an upgrade`, 202, '16px system-ui, sans-serif', PALETTE.dim);
  g.cardRects = [];
  const w = 252;
  const h = 210;
  const gap = 26;
  const totalW = w * 3 + gap * 2;
  const x0 = (VIEW.width - totalW) / 2;
  const y = 268;
  g.choices.forEach((up, i) => {
    const x = x0 + i * (w + gap);
    const hover = g.input.mouse.x >= x && g.input.mouse.x <= x + w && g.input.mouse.y >= y && g.input.mouse.y <= y + h;
    g.cardRects.push({ x, y, w, h, index: i });
    ctx.fillStyle = hover ? 'rgba(38, 48, 96, 0.95)' : 'rgba(18, 22, 52, 0.95)';
    ctx.strokeStyle = hover ? PALETTE.shard : 'rgba(120, 200, 255, 0.4)';
    ctx.lineWidth = hover ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.shard;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, x + w / 2, y + 36);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 21px system-ui, sans-serif';
    wrapText(ctx, up.name, x + w / 2, y + 76, w - 32, 24);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, up.desc, x + w / 2, y + 122, w - 36, 20);
  });
  centerText(ctx, 'click a card or press 1 · 2 · 3', y + h + 42, '14px system-ui, sans-serif', PALETTE.dim);
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

function drawEndScreen(ctx, g, victory) {
  ctx.fillStyle = victory ? 'rgba(6, 20, 10, 0.6)' : 'rgba(20, 4, 8, 0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  if (victory) {
    centerText(ctx, 'VOID CLEARED', 240, 'bold 56px system-ui, sans-serif', '#7dff9a');
    centerText(ctx, 'All ten waves broken. The starshards sing your name.', 288, '17px system-ui, sans-serif', PALETTE.text);
  } else {
    centerText(ctx, 'SHIP DOWN', 240, 'bold 56px system-ui, sans-serif', PALETTE.danger);
    centerText(ctx, `Your run ended on wave ${g.wave}. The void keeps the rest — this time.`, 288, '17px system-ui, sans-serif', PALETTE.text);
  }
  centerText(ctx, `SCORE ${g.score}`, 356, 'bold 34px system-ui, sans-serif', PALETTE.shard);
  centerText(ctx, `starshards ${g.shardsCollected} · wave reached ${g.wave} · best ${g.best}`, 392, '16px system-ui, sans-serif', PALETTE.dim);
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
  centerText(ctx, g.bannerText, 150, 'bold 44px system-ui, sans-serif', PALETTE.text);
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
  drawBackground(ctx, g.stars, g.time);
  if (g.state !== 'title') {
    drawPickups(ctx, g.pickups, g.time);
    drawBullets(ctx, g.bullets);
    for (const e of g.enemies) drawEnemy(ctx, e, g.time);
    if (g.state !== 'gameover') drawPlayer(ctx, g.player, g.time);
    drawParticles(ctx, g.particles);
    drawFloatTexts(ctx, g.texts);
    drawHUD(ctx, g);
  }
  ctx.restore();

  if (g.state === 'title') drawTitle(ctx, g);
  if (g.state === 'upgrade') drawUpgrade(ctx, g);
  if (g.state === 'gameover') drawEndScreen(ctx, g, false);
  if (g.state === 'victory') drawEndScreen(ctx, g, true);
  if (g.paused) drawPause(ctx);
  drawBanner(ctx, g);
  drawVignette(ctx, g);
}
