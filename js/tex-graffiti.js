import * as THREE from 'three';
import { makeCanvas, ctx2d, canvasTexture, mulberry32, randRange, choice, rgba } from './tex-utils.js';

/* ------------------------------------------------------------------ *
 *  Street art.  Drawn on transparent canvases and used as decals on
 *  the flat lower faces of the tower.  No real crews are reproduced.
 * ------------------------------------------------------------------ */

function drips(ctx, x, y, n, color, rnd, maxLen = 120) {
  for (let i = 0; i < n; i++) {
    const dx = x + (rnd() - 0.5) * 280;
    const len = 8 + rnd() * maxLen;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35 + rnd() * 0.6;
    ctx.lineWidth = 1 + rnd() * 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dx, y);
    ctx.quadraticCurveTo(dx + (rnd() - 0.5) * 8, y + len * 0.5, dx + (rnd() - 0.5) * 14, y + len);
    ctx.stroke();
    ctx.globalAlpha = 0.5 + rnd() * 0.4;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(dx + (rnd() - 0.5) * 14, y + len, 1.3 + rnd() * 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function speckle(ctx, cx, cy, rx, ry, color, n, rnd, alpha = 0.5) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.3 + rnd() * 0.7);
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, 0.4 + rnd() * 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function makeWord(word, rnd) {
  const W = 1200, H = 540;
  const c = makeCanvas(W, H), ctx = ctx2d(c);
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.035);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 250px "Arial Black", "DejaVu Sans", sans-serif';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.94;
  // soft shadow / second layer of paint
  ctx.fillStyle = 'rgba(35,32,26,0.5)';
  for (const off of [[14, 12], [-9, -7], [0, 0]]) {
    ctx.fillText(word, off[0], off[1]);
  }
  // white paint, painted in several slightly offset passes
  ctx.fillStyle = '#f0ede1';
  for (let i = 0; i < 4; i++) {
    ctx.fillText(word, (rnd() - 0.5) * 5, (rnd() - 0.5) * 5);
  }
  // drips below the letters
  for (let i = 0; i < 17; i++) {
    const x = -540 + rnd() * 1080;
    drips(ctx, x, 100 + rnd() * 32, 1, 'rgba(236,232,218,0.8)', rnd, 180);
  }
  speckle(ctx, 0, 0, 570, 240, '#f2efe6', 620, rnd, 0.38);
  speckle(ctx, 0, 0, 610, 260, '#2a2922', 330, rnd, 0.2);
  return c;
}

function makeWild(rnd) {
  const W = 1536, H = 700;
  const c = makeCanvas(W, H), ctx = ctx2d(c);
  // abstract wildstyle with a big soft pink underpainting
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#d99aa3';
  ctx.beginPath();
  ctx.moveTo(170, 440);
  ctx.bezierCurveTo(90, 240, 440, 100, 730, 180);
  ctx.bezierCurveTo(960, 70, 1360, 200, 1290, 420);
  ctx.bezierCurveTo(1420, 560, 1120, 670, 830, 590);
  ctx.bezierCurveTo(520, 700, 220, 640, 170, 440);
  ctx.fill();
  ctx.restore();

  const strokes = 16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const cols = ['#1f4a4c', '#e6d37a', '#c9526e', '#f0e7d2', '#2a2b28', '#3e7b7a'];
  for (let i = 0; i < strokes; i++) {
    const x0 = 300 + rnd() * 260 + i * 45;
    const y0 = 280 + rnd() * 150;
    const x1 = x0 + 60 + rnd() * 170;
    const y1 = y0 - 60 + rnd() * 170;
    ctx.strokeStyle = i % 3 === 0 ? '#20211e' : choice(rnd, cols);
    ctx.lineWidth = 26 + rnd() * 30;
    ctx.globalAlpha = 0.86;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0 + 30, y0 - 120, x1 - 30, y1 + 120, x1, y1);
    ctx.stroke();
  }
  // black outlines and white highlights
  for (let i = 0; i < 11; i++) {
    const x0 = 330 + i * 70, y0 = 370 + (rnd() - 0.5) * 140;
    ctx.strokeStyle = '#1e1f1b';
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + 60, y0 - 90, x0 + 140, y0 - 20);
    ctx.stroke();
  }
  // arrows and dots
  ctx.fillStyle = '#e9dfb2';
  for (let i = 0; i < 12; i++) {
    const x = 260 + rnd() * 990, y = 200 + rnd() * 360;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(x, y, 2 + rnd() * 5, 0, Math.PI * 2); ctx.fill();
  }
  drips(ctx, 760, 500, 7, 'rgba(215,130,145,0.8)', rnd, 160);
  speckle(ctx, 760, 370, 620, 280, '#20211e', 300, rnd, 0.3);
  return c;
}

function makeTags(rnd) {
  const W = 1024, H = 384;
  const c = makeCanvas(W, H), ctx = ctx2d(c);
  ctx.lineCap = 'round';
  const drawTag = (x, y, s, color, lw) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    let px = x, py = y;
    ctx.moveTo(px, py);
    const n = 9 + Math.floor(rnd() * 6);
    for (let i = 0; i < n; i++) {
      const nx = px + s * (0.3 + rnd() * 0.5);
      const ny = y + (rnd() - 0.5) * s * 1.1;
      ctx.bezierCurveTo(px + s * 0.1, py - s * 0.5, nx - s * 0.2, ny + s * 0.4, nx, ny);
      px = nx; py = ny;
    }
    ctx.stroke();
    // underline / loop
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.7); ctx.quadraticCurveTo(x + s, y + s * 0.4, x + s * 2.4, y + s * 0.8); ctx.stroke();
  };
  drawTag(50, 190, 110, '#23231f', 8);
  drawTag(360, 230, 90, '#2c4b67', 7);
  drawTag(600, 160, 120, '#272723', 9);
  drawTag(830, 250, 80, '#5c3a33', 6);
  speckle(ctx, 500, 200, 440, 140, '#2a2a24', 140, rnd, 0.25);
  return c;
}

function makeStencil(rnd) {
  const W = 1024, H = 512;
  const c = makeCanvas(W, H), ctx = ctx2d(c);
  ctx.fillStyle = 'rgba(28,27,23,0.92)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 94px "Manrope", "DejaVu Sans", sans-serif';
  ctx.fillText('NIEMALS', W / 2, 170);
  ctx.fillText('WIEDER', W / 2, 300);
  // stencil bridges
  ctx.globalCompositeOperation = 'destination-out';
  for (const yy of [128, 172, 258, 302]) {
    ctx.fillRect(100, yy, W - 200, 8);
  }
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(130 + i * 122, 110, 5, 220);
  }
  ctx.globalCompositeOperation = 'source-over';
  // overspray
  speckle(ctx, W / 2, 230, 480, 170, '#1e1d19', 450, rnd, 0.25);
  return c;
}

function makePink(rnd) {
  const W = 512, H = 512;
  const c = makeCanvas(W, H), ctx = ctx2d(c);
  ctx.fillStyle = '#d69aa8';
  ctx.beginPath();
  ctx.moveTo(60, 330);
  ctx.bezierCurveTo(20, 150, 190, 70, 330, 120);
  ctx.bezierCurveTo(470, 170, 480, 340, 350, 400);
  ctx.bezierCurveTo(240, 470, 100, 450, 60, 330);
  ctx.fill();
  ctx.strokeStyle = '#a55b6f'; ctx.lineWidth = 5; ctx.stroke();
  drips(ctx, 300, 380, 8, 'rgba(195,125,142,0.8)', rnd, 100);
  speckle(ctx, 250, 250, 230, 200, '#e5b3bd', 180, rnd, 0.3);
  return c;
}

export function createGraffitiTextures() {
  const never = canvasTexture(makeWord('NEVER', mulberry32(12)), { anisotropy: 8 });
  const again = canvasTexture(makeWord('AGAIN!', mulberry32(17)), { anisotropy: 8 });
  const wild = canvasTexture(makeWild(mulberry32(13)), { anisotropy: 8 });
  const tags = canvasTexture(makeTags(mulberry32(14)), { anisotropy: 8 });
  const stencil = canvasTexture(makeStencil(mulberry32(15)), { anisotropy: 8 });
  const pink = canvasTexture(makePink(mulberry32(16)), { anisotropy: 8 });
  return { never, again, wild, tags, stencil, pink };
}
