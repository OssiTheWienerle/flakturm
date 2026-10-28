import * as THREE from 'three';
import {
  QUALITY, makeCanvas, ctx2d, canvasTexture, mulberry32, randRange, choice,
  blendNoise, blob, streak, rgba, sprayText,
} from './tex-utils.js';

/* ------------------------------------------------------------------ *
 *  Roof slab: pale weathered concrete, cracks, moss, rust around pits.
 * ------------------------------------------------------------------ */
export function createRoofTextures() {
  const S = QUALITY.roof;
  const rnd = mulberry32(30301);
  const c = makeCanvas(S, S), ctx = ctx2d(c);
  let g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#97968f');
  g.addColorStop(0.45, '#85857e');
  g.addColorStop(1, '#6f706a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  blendNoise(ctx, S, S, { size: 512, cells: 4, octaves: 5, seed: 4, alpha: 0.3, mode: 'overlay' });
  blendNoise(ctx, S, S, { size: 512, cells: 26, octaves: 4, seed: 5, alpha: 0.18, mode: 'soft-light' });

  // expansion joints: 16 rays + rings
  ctx.save();
  ctx.strokeStyle = 'rgba(58,54,45,0.35)';
  ctx.lineWidth = Math.max(1, S / 1400);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(S / 2 + Math.cos(a) * S * 0.02, S / 2 + Math.sin(a) * S * 0.02);
    ctx.lineTo(S / 2 + Math.cos(a) * S * 0.48, S / 2 + Math.sin(a) * S * 0.48);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(70,65,55,0.2)';
  for (const rr of [0.18, 0.32, 0.43]) {
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S * rr, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  // pit stains (world x,z -> texture position)
  const mapPt = (x, z) => [((x / 44) + 0.5) * S, ((z / 44) + 0.5) * S];
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 4) + i * Math.PI / 2;
    const [px, py] = mapPt(Math.sin(a) * 11.4, Math.cos(a) * 11.4);
    const r = (3.3 / 44) * S;
    const gr = ctx.createRadialGradient(px, py, r * 0.9, px, py, r * 1.7);
    gr.addColorStop(0, 'rgba(50,46,37,0.35)');
    gr.addColorStop(1, 'rgba(50,46,37,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(px, py, r * 1.7, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 16; k++) {
      const ang = rnd() * Math.PI * 2;
      streak(ctx, px + Math.cos(ang) * r, py + Math.sin(ang) * r, 1.5 + rnd() * 5, 20 + rnd() * 150,
        [96, 53, 27], 0.12 + rnd() * 0.16, (rnd() - 0.5) * 10);
    }
  }

  // Large, irregular repair patches: the real slab is a patchwork of
  // different pours rather than one uniform surface.
  for (let i = 0; i < 9; i++) {
    const x = randRange(rnd, 0, S), y = randRange(rnd, 0, S);
    const w = 90 + rnd() * 260, h = 70 + rnd() * 210;
    ctx.save();
    ctx.globalAlpha = 0.07 + rnd() * 0.10;
    ctx.fillStyle = choice(rnd, ['#b3ada1', '#6c6a62', '#8b877c', '#a29c90']);
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // cracks
  ctx.strokeStyle = 'rgba(43,39,32,0.4)';
  for (let i = 0; i < 22; i++) {
    let x = randRange(rnd, 0, S), y = randRange(rnd, 0, S);
    ctx.lineWidth = 1 + rnd() * 1.4;
    ctx.beginPath(); ctx.moveTo(x, y);
    const steps = 8 + Math.floor(rnd() * 20);
    for (let s = 0; s < steps; s++) {
      x += (rnd() - 0.5) * 26; y += (rnd() - 0.4) * 24;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // moss and damp patches, denser near edges
  const mc = makeCanvas(1024, 1024), mx = ctx2d(mc);
  mx.filter = 'blur(6px)';
  for (let i = 0; i < 210; i++) {
    const ang = rnd() * Math.PI * 2, rad = S * (0.2 + Math.pow(rnd(), 0.5) * 0.3) / S;
    const x = 512 + Math.cos(ang) * rad * 512 * 2;
    const y = 512 + Math.sin(ang) * rad * 512 * 2;
    blob(mx, x, y, 6 + rnd() * 42, 4 + rnd() * 24,
      choice(rnd, [[77, 82, 47], [96, 99, 56], [63, 70, 40], [112, 108, 69]]), 0.22 + rnd() * 0.34, 0.6, rnd);
  }
  mx.filter = 'none';
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.76;
  ctx.drawImage(mc, 0, 0, S, S);
  ctx.restore();

  // Broad damp/dirt fields, as on the real slab.
  for (let i = 0; i < 16; i++) {
    const x = randRange(rnd, 0, S), y = randRange(rnd, 0, S);
    const rad = 30 + rnd() * 110;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(55,51,43,${0.10 + rnd() * 0.16})`);
    gr.addColorStop(1, 'rgba(55,51,43,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // dark damp zones near the notch (south-east edge)
  const [nx, ny] = mapPt(5.6, 15.5);
  const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, S * 0.11);
  ng.addColorStop(0, 'rgba(45,42,35,0.4)');
  ng.addColorStop(1, 'rgba(45,42,35,0)');
  ctx.fillStyle = ng; ctx.fillRect(0, 0, S, S);

  const bc = makeCanvas(1024, 1024), b = ctx2d(bc);
  b.fillStyle = '#808080'; b.fillRect(0, 0, 1024, 1024);
  blendNoise(b, 1024, 1024, { size: 512, cells: 14, octaves: 5, seed: 9, alpha: 0.16, mode: 'overlay' });
  b.strokeStyle = 'rgba(55,55,55,0.4)';
  for (let i = 0; i < 12; i++) {
    let x = randRange(rnd, 0, 1024), y = randRange(rnd, 0, 1024);
    b.lineWidth = 1.5;
    b.beginPath(); b.moveTo(x, y);
    for (let s = 0; s < 18; s++) { x += (rnd() - 0.5) * 18; y += (rnd() - 0.4) * 18; b.lineTo(x, y); }
    b.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.strokeStyle = 'rgba(60,60,60,0.4)'; b.lineWidth = 2;
    b.beginPath(); b.moveTo(512, 512); b.lineTo(512 + Math.cos(a) * 500, 512 + Math.sin(a) * 500); b.stroke();
  }

  const rc = makeCanvas(512, 512), rr = ctx2d(rc);
  rr.fillStyle = '#dedede'; rr.fillRect(0, 0, 512, 512);
  blendNoise(rr, 512, 512, { size: 256, cells: 12, octaves: 4, seed: 3, alpha: 0.25, mode: 'overlay' });
  const [nx2, ny2] = mapPt(5.6, 15.5);
  const rg = rr.createRadialGradient(nx2 / 4, ny2 / 4, 0, nx2 / 4, ny2 / 4, 50);
  rg.addColorStop(0, 'rgba(90,90,90,0.9)'); rg.addColorStop(1, 'rgba(90,90,90,0)');
  rr.fillStyle = rg; rr.fillRect(0, 0, 512, 512);

  const map = canvasTexture(c, { anisotropy: 8 });
  map.repeat.set(1 / 44, 1 / 44);
  map.offset.set(0.5, 0.5);
  const bump = canvasTexture(bc, { srgb: false });
  bump.repeat.copy(map.repeat); bump.offset.copy(map.offset);
  const rough = canvasTexture(rc, { srgb: false });
  rough.repeat.copy(map.repeat); rough.offset.copy(map.offset);
  return { map, bumpMap: bump, roughnessMap: rough };
}

/* ------------------------------------------------------------------ *
 *  Grass, gravel, bark
 * ------------------------------------------------------------------ */
export function createGrassTextures() {
  const S = 1024;
  const rnd = mulberry32(881);
  const c = makeCanvas(S, S), ctx = ctx2d(c);
  ctx.fillStyle = '#687a47'; ctx.fillRect(0, 0, S, S);
  blendNoise(ctx, S, S, { size: 512, cells: 4, octaves: 5, seed: 61, alpha: 0.4, mode: 'overlay' });
  blendNoise(ctx, S, S, { size: 512, cells: 18, octaves: 4, seed: 62, alpha: 0.2, mode: 'soft-light' });
  const greens = ['#53663a', '#6c8049', '#7d8d52', '#5f7240', '#8b9a5e', '#76884e', '#4d6032', '#97a066'];
  const dry = ['#7c7848', '#938e5a', '#6b673d'];
  const wrapDraw = (fn) => {
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) fn(dx, dy);
    }
  };
  ctx.lineCap = 'round';
  for (let i = 0; i < 24000; i++) {
    const x = rnd() * S, y = rnd() * S;
    const len = 2 + rnd() * 7, ang = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
    const col = rnd() < 0.08 ? choice(rnd, dry) : choice(rnd, greens);
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.35 + rnd() * 0.55;
    ctx.lineWidth = 0.6 + rnd() * 1.2;
    const step = Math.max(1, Math.round(rnd() * 2));
    if (x > 8 && x < S - 8 && y > 8 && y < S - 8 || rnd() < 0.2) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
    } else {
      const bx = x, by = y;
      wrapDraw((dx, dy) => {
        ctx.beginPath(); ctx.moveTo(bx + dx, by + dy);
        ctx.lineTo(bx + dx + Math.cos(ang) * len, by + dy + Math.sin(ang) * len); ctx.stroke();
      });
    }
  }
  ctx.globalAlpha = 1;
  // flowers and clover
  for (let i = 0; i < 220; i++) {
    const x = rnd() * S, y = rnd() * S;
    const kind = rnd();
    if (kind < 0.55) {
      ctx.fillStyle = 'rgba(235,232,205,0.85)';
      ctx.beginPath(); ctx.arc(x, y, 0.9 + rnd() * 1.3, 0, Math.PI * 2); ctx.fill();
    } else if (kind < 0.8) {
      ctx.fillStyle = 'rgba(226,192,76,0.9)';
      ctx.beginPath(); ctx.arc(x, y, 1 + rnd() * 1.4, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(88,112,55,0.8)';
      for (let k = 0; k < 3; k++) {
        const a = k * Math.PI * 2 / 3;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // sparse dry patches
  for (let i = 0; i < 10; i++) {
    blob(ctx, rnd() * S, rnd() * S, 30 + rnd() * 90, 20 + rnd() * 60, [122, 112, 74], 0.06, 0.5, rnd);
  }

  const bc = makeCanvas(512, 512), b = ctx2d(bc);
  b.fillStyle = '#808080'; b.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * 512, y = rnd() * 512;
    b.strokeStyle = rnd() < 0.5 ? 'rgba(110,110,110,0.5)' : 'rgba(150,150,150,0.5)';
    b.lineWidth = 1;
    b.beginPath(); b.moveTo(x, y); b.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 5); b.stroke();
  }

  return {
    map: canvasTexture(c, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, repeat: [42, 42], anisotropy: 8 }),
    bumpMap: canvasTexture(bc, {
      srgb: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, repeat: [42, 42],
    }),
  };
}

export function createGravelTextures() {
  const S = 1024;
  const rnd = mulberry32(5591);
  const c = makeCanvas(S, S), ctx = ctx2d(c);
  ctx.fillStyle = '#9c907a'; ctx.fillRect(0, 0, S, S);
  blendNoise(ctx, S, S, { size: 512, cells: 8, octaves: 4, seed: 15, alpha: 0.3, mode: 'overlay' });
  const cols = ['#b3a992', '#8e8470', '#c0b6a2', '#a29a86', '#7b7261', '#c8bfae', '#6d6555'];
  for (let i = 0; i < 6500; i++) {
    const x = rnd() * S, y = rnd() * S, r = 0.8 + rnd() * 3.6;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rnd() * Math.PI);
    ctx.fillStyle = choice(rnd, cols);
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * (0.55 + rnd() * 0.5), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,250,235,0.2)';
    ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.25, r * 0.55, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(35,30,24,0.18)';
    ctx.beginPath(); ctx.ellipse(r * 0.2, r * 0.3, r * 0.6, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // compressed wheel tracks / subtle damp patches
  for (let i = 0; i < 5; i++) {
    const x = rnd() * S;
    const g = ctx.createLinearGradient(x, 0, x + 50, 0);
    g.addColorStop(0, 'rgba(60,54,44,0)');
    g.addColorStop(0.5, 'rgba(60,54,44,0.08)');
    g.addColorStop(1, 'rgba(60,54,44,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  }
  const bc = makeCanvas(512, 512), b = ctx2d(bc);
  b.fillStyle = '#808080'; b.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2200; i++) {
    b.fillStyle = rnd() < 0.5 ? 'rgba(40,40,40,0.6)' : 'rgba(210,210,210,0.6)';
    const x = rnd() * 512, y = rnd() * 512, r = 1 + rnd() * 2;
    b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
  }
  return {
    map: canvasTexture(c, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, repeat: [14, 14] }),
    bumpMap: canvasTexture(bc, {
      srgb: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, repeat: [14, 14],
    }),
  };
}

export function createBarkTexture() {
  const S = 512;
  const rnd = mulberry32(661);
  const c = makeCanvas(S, S), ctx = ctx2d(c);
  ctx.fillStyle = '#4a4034'; ctx.fillRect(0, 0, S, S);
  blendNoise(ctx, S, S, { size: 256, cells: 5, octaves: 4, seed: 18, alpha: 0.35, mode: 'overlay' });
  for (let i = 0; i < 180; i++) {
    const x = rnd() * S, w = 1 + rnd() * 7;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(25,20,15,0.3)');
    g.addColorStop(0.5, `rgba(${80 + rnd() * 40},${68 + rnd() * 30},${52 + rnd() * 25},0.25)`);
    g.addColorStop(1, 'rgba(25,20,15,0.25)');
    ctx.fillStyle = g;
    let y = -20;
    ctx.beginPath(); ctx.moveTo(x, y);
    while (y < S + 20) { y += 10 + rnd() * 30; ctx.lineTo(x + Math.sin(y * 0.03) * 3, y); }
    ctx.lineTo(x + w, S); ctx.lineTo(x + w, 0); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = 'rgba(150,138,110,0.16)';
    ctx.beginPath(); ctx.arc(rnd() * S, rnd() * S, 0.6 + rnd() * 2.4, 0, Math.PI * 2); ctx.fill();
  }
  return {
    map: canvasTexture(c, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, repeat: [2, 3] }),
  };
}

/* ------------------------------------------------------------------ *
 *  Foliage cards, grass tufts, chain-link
 * ------------------------------------------------------------------ */
export function createLeafTexture(kind = 'green', density = 1) {
  const S = 512;
  const rnd = mulberry32(kind === 'green' ? 312 : kind === 'gold' ? 313 : 314);
  const c = makeCanvas(S, S), ctx = ctx2d(c);
  const palettes = {
    green: ['#42552f', '#4e6336', '#5a6f3c', '#687b46', '#384a29', '#74854d'],
    gold: ['#8a6d2e', '#9c7b34', '#ad8a3c', '#bb984b', '#7a602a', '#c7a75b'],
    copper: ['#986234', '#ae723d', '#c08348', '#d09456', '#85552e', '#dba76a'],
    ivy: ['#4d6a34', '#5c7a3d', '#6b8847', '#7a5a32', '#8a5a37', '#465a2d', '#6d4a33'],
    hedge: ['#33481f', '#405727', '#4d652f', '#586f37', '#2b3d1c'],
  };
  const pal = palettes[kind] || palettes.green;
  const center = S / 2;

  // fine twigs
  ctx.strokeStyle = 'rgba(55,45,30,0.45)';
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2, len = 60 + rnd() * 170;
    ctx.lineWidth = 1 + rnd() * 1.5;
    ctx.beginPath(); ctx.moveTo(center, center);
    ctx.quadraticCurveTo(center + Math.cos(a) * len * 0.5, center + Math.sin(a) * len * 0.5,
      center + Math.cos(a) * len, center + Math.sin(a) * len);
    ctx.stroke();
  }

  const leaves = Math.round(240 * density);
  for (let i = 0; i < leaves; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.pow(rnd(), 0.62) * S * 0.46;
    const x = center + Math.cos(a) * r, y = center + Math.sin(a) * r * 0.92;
    const size = (7 + rnd() * 15) * (1 - r * 0.0005);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI * 2);
    ctx.fillStyle = choice(rnd, pal);
    ctx.globalAlpha = 0.72 + rnd() * 0.28;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.bezierCurveTo(size * 0.75, -size * 0.5, size * 0.55, size * 0.55, 0, size);
    ctx.bezierCurveTo(-size * 0.55, size * 0.55, -size * 0.75, -size * 0.5, 0, -size);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,36,18,0.18)';
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(0, -size * 0.8); ctx.lineTo(0, size * 0.8); ctx.stroke();
    ctx.restore();
  }
  // sparse outer leaves for a broken silhouette
  for (let i = 0; i < Math.round(35 * density); i++) {
    const a = rnd() * Math.PI * 2, r = S * (0.4 + rnd() * 0.08);
    ctx.save();
    ctx.translate(center + Math.cos(a) * r, center + Math.sin(a) * r);
    ctx.rotate(rnd() * Math.PI * 2);
    ctx.fillStyle = choice(rnd, pal);
    ctx.globalAlpha = 0.8;
    const size = 5 + rnd() * 8;
    ctx.beginPath(); ctx.ellipse(0, 0, size * 0.55, size, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  return canvasTexture(c, { anisotropy: 4 });
}

export function createGrassTuftTexture() {
  const S = 256;
  const rnd = mulberry32(721);
  const c = makeCanvas(S, S), ctx = ctx2d(c);
  ctx.lineCap = 'round';
  const cols = ['#6d7c45', '#7d8b50', '#5b6939', '#8a915c', '#a09b66'];
  for (let i = 0; i < 110; i++) {
    const x = S / 2 + (rnd() - 0.5) * S * 0.7;
    const h = S * (0.25 + rnd() * 0.68);
    const bend = (rnd() - 0.5) * S * 0.35;
    ctx.strokeStyle = choice(rnd, cols);
    ctx.globalAlpha = 0.55 + rnd() * 0.45;
    ctx.lineWidth = 1 + rnd() * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, S);
    ctx.quadraticCurveTo(x + bend * 0.3, S - h * 0.6, x + bend, S - h);
    ctx.stroke();
  }
  return canvasTexture(c, { anisotropy: 4 });
}

export function createChainlinkTexture() {
  const S = 256;
  const c = makeCanvas(S, S), ctx = ctx2d(c);
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(88,96,86,0.9)';
  ctx.lineWidth = 2.2;
  const step = 32;
  for (let i = -S; i < S * 2; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + S, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, S); ctx.lineTo(i + S, 0); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200,205,195,0.35)';
  ctx.lineWidth = 0.8;
  for (let i = -S; i < S * 2; i += step) {
    ctx.beginPath(); ctx.moveTo(i + 1, 0); ctx.lineTo(i + S + 1, S); ctx.stroke();
  }
  return canvasTexture(c, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, anisotropy: 4 });
}

/* ------------------------------------------------------------------ *
 *  Small printed things: memorial stele, site notice, distant facades
 * ------------------------------------------------------------------ */
export function createSignTexture() {
  const W = 512, H = 768;
  const c = makeCanvas(W, H), ctx = ctx2d(c);
  ctx.fillStyle = '#2f302b'; ctx.fillRect(0, 0, W, H);
  blendNoise(ctx, W, H, { size: 256, cells: 12, octaves: 3, seed: 7, alpha: 0.2, mode: 'overlay' });
  ctx.strokeStyle = 'rgba(240,235,220,0.4)'; ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.fillStyle = '#f0ebde';
  ctx.font = '500 20px "IBM Plex Mono", monospace';
  ctx.fillText('WIEN II · LEOPOLDSTADT', 52, 86);
  ctx.font = '600 54px "Manrope", sans-serif';
  ctx.fillText('GEFECHTS-', 52, 158);
  ctx.fillText('TURM', 52, 214);
  ctx.fillText('AUGARTEN', 52, 270);
  ctx.fillStyle = '#c2b79e';
  ctx.font = '400 22px "Manrope", sans-serif';
  ctx.fillText('Bauart III · 1944–1945', 52, 320);
  ctx.strokeStyle = 'rgba(240,235,220,0.25)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(52, 348); ctx.lineTo(W - 52, 348); ctx.stroke();
  ctx.fillStyle = '#ded7c8';
  ctx.font = '400 20px "Manrope", sans-serif';
  const lines = [
    '55 m hoch · 43 m Durchmesser', '13 Geschosse · 149.100 t',
    'Wände 2,5 m · Decke 3,5 m', '', 'Ein Mahnmal gegen Krieg', 'und Nationalsozialismus.',
    '', 'Kein öffentlicher Zugang.', 'Bitte den Ort respektieren.',
  ];
  let y = 392;
  for (const line of lines) { ctx.fillText(line, 52, y); y += 30; }
  ctx.fillStyle = 'rgba(240,235,220,0.45)';
  ctx.font = '400 15px "IBM Plex Mono", monospace';
  ctx.fillText('BURGHAUPTMANNSCHAFT · MAHNMAAL', 52, H - 66);
  return canvasTexture(c, { anisotropy: 4 });
}

export function createWarningTexture() {
  const W = 512, H = 384;
  const c = makeCanvas(W, H), ctx = ctx2d(c);
  ctx.fillStyle = '#ece6d8'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#9e3c2d'; ctx.lineWidth = 16; ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.fillStyle = '#3a2f26';
  ctx.font = '600 30px "Manrope", sans-serif';
  ctx.fillText('BETRETEN VERBOTEN', 40, 90);
  ctx.font = '400 22px "Manrope", sans-serif';
  ctx.fillText('BAUWERK · LEBENSGEFAHR', 40, 132);
  ctx.fillStyle = '#9e3c2d';
  ctx.font = '500 20px "IBM Plex Mono", monospace';
  ctx.fillText('MAHNMAAL / MEMORIAL', 40, 200);
  ctx.fillStyle = '#6d6353';
  ctx.font = '400 17px "Manrope", sans-serif';
  ctx.fillText('Kein Zutritt. Bitte nicht klettern', 40, 245);
  ctx.fillText('oder den Turm beschädigen.', 40, 270);
  ctx.font = '400 15px "IBM Plex Mono", monospace';
  ctx.fillText('BUNDESDENKMALAMT', 40, 330);
  return canvasTexture(c, { anisotropy: 4 });
}

export function createFacadeBuildingTexture() {
  const W = 512, H = 512;
  const c = makeCanvas(W, H), ctx = ctx2d(c);
  ctx.fillStyle = '#d7c9ad'; ctx.fillRect(0, 0, W, H);
  blendNoise(ctx, W, H, { size: 256, cells: 8, octaves: 3, seed: 33, alpha: 0.15, mode: 'multiply' });
  const rows = 4, cols = 5;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = 30 + col * 92, y = 32 + r * 118;
      ctx.fillStyle = '#6e6a5f';
      ctx.fillRect(x, y, 46, 72);
      ctx.fillStyle = 'rgba(190,205,210,0.25)';
      ctx.fillRect(x + 3, y + 3, 18, 30);
      ctx.fillStyle = 'rgba(215,205,185,0.7)';
      ctx.fillRect(x - 5, y - 6, 56, 6);
      ctx.fillRect(x - 4, y + 72, 54, 5);
    }
  }
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = 'rgba(80,70,55,0.12)';
    ctx.fillRect(0, i * 90, W, 2);
  }
  return canvasTexture(c, { anisotropy: 4 });
}
