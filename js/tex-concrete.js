import * as THREE from 'three';
import {
  QUALITY, makeCanvas, ctx2d, canvasTexture, mulberry32, randRange, choice,
  blendNoise, fbmField, normalFromField, blob, streak, rgba,
} from './tex-utils.js';

/* ------------------------------------------------------------------ *
 *  Concrete surfaces.  The big facade maps one unique image around the
 *  whole 16-sided shaft: construction joints land on the real corners.
 * ------------------------------------------------------------------ */

function baseConcrete(ctx, W, H, rnd, {
  top = '#b7b1a5', mid = '#a8a295', low = '#958e82', bottom = '#7d776c',
} = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(0.22, mid);
  g.addColorStop(0.62, low);
  g.addColorStop(0.88, '#817b70');
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Broad, cloudy tonal variation
  blendNoise(ctx, W, H, { size: 512, cells: 3, octaves: 4, seed: 11, alpha: 0.24, mode: 'overlay' });
  blendNoise(ctx, W, H, { size: 512, cells: 7, octaves: 5, seed: 21, alpha: 0.17, mode: 'soft-light' });
  blendNoise(ctx, W, H, { size: 512, cells: 22, octaves: 4, seed: 31, alpha: 0.12, mode: 'overlay' });

  // Slightly different pours per face
  const faces = 16, fw = W / faces;
  for (let i = 0; i < faces; i++) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.03 + rnd() * 0.045;
    ctx.fillStyle = choice(rnd, ['#ddd4c2', '#7d7568', '#c2b6a2', '#958e81']);
    ctx.fillRect(i * fw, 0, fw + 1, H);
    ctx.restore();
  }
}

function pourBoardLines(ctx, W, H, faces, rnd, spacingPx = 108, strength = 1) {
  const fw = W / faces;
  // Board marks are spaced in metres, not pixels: roughly one lift every
  // 2.3 m on the shaft.  A texture-space line every 15 px would collapse
  // into a featureless sheen at normal viewing distance.
  const count = Math.max(4, Math.round(H / spacingPx));
  for (let i = 0; i < count; i++) {
    const y = (i / count) * H + (rnd() - 0.5) * 1.4;
    const every = i % 9 === 0;
    ctx.strokeStyle = rgba(43, 39, 31, (every ? 0.34 : 0.13 + rnd() * 0.07) * strength);
    ctx.lineWidth = (every ? 2.6 : 1.5) * (0.8 + strength * 0.2);
    ctx.beginPath();
    for (let f = 0; f < faces; f++) {
      const x0 = f * fw, x1 = x0 + fw;
      ctx.moveTo(x0 + 1, y);
      ctx.lineTo(x1 - 1, y + (rnd() - 0.5) * 1.2);
    }
    ctx.stroke();
    // tiny highlight underneath, as if light catches the board lip
    ctx.strokeStyle = rgba(232, 223, 204, 0.09 * strength);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y + 1.3);
    ctx.lineTo(W, y + 1.3);
    ctx.stroke();
  }
}

function faceJoints(ctx, W, H, faces, rnd, jointEvery = 1) {
  const fw = W / faces;
  for (let i = 0; i < faces; i++) {
    if (i % jointEvery !== 0) continue;
    const x = i * fw;
    // recessed joint
    ctx.strokeStyle = rgba(40, 37, 30, 0.3);
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke();
    ctx.strokeStyle = rgba(226, 216, 196, 0.07);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x + 2.2, 0); ctx.lineTo(x + 2.2, H); ctx.stroke();

    // vertical damp bloom at the corner
    const grad = ctx.createLinearGradient(x, 0, x + 30, 0);
    grad.addColorStop(0, 'rgba(52,49,40,0.15)');
    grad.addColorStop(1, 'rgba(52,49,40,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 30, H);

    // occasional mid-face shutter joint
    if (rnd() > 0.6) {
      const mx = x + fw * (0.3 + rnd() * 0.4);
      ctx.strokeStyle = rgba(52, 48, 40, 0.14);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx + (rnd() - 0.5) * 5, H); ctx.stroke();
    }
  }
}

function tieHoles(ctx, W, H, faces, rnd) {
  const fw = W / faces;
  const cols = 3, rows = 12;
  for (let f = 0; f < faces; f++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rnd() < 0.18) continue;
        const x = f * fw + (c + 0.3 + rnd() * 0.4) * (fw / cols);
        const y = (r + 0.25 + rnd() * 0.45) * (H / rows);
        const rad = 1.7 + rnd() * 1.9;
        ctx.fillStyle = rgba(42, 38, 31, 0.38);
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba(225, 214, 192, 0.12);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, rad + 1.4, 0, Math.PI * 2); ctx.stroke();
        if (rnd() < 0.24) {
          const len = 25 + rnd() * 130;
          streak(ctx, x, y + rad, 1.2 + rnd() * 2.2, len, [110, 66, 36], 0.1 + rnd() * 0.15, (rnd() - 0.5) * 8);
        }
      }
    }
  }
}

function cracks(ctx, W, H, rnd, count, maxLen, scale = 1) {
  for (let i = 0; i < count; i++) {
    let x = randRange(rnd, 0, W), y = randRange(rnd, 0, H);
    const len = randRange(rnd, maxLen * 0.2, maxLen);
    const steps = Math.max(4, Math.round(len / 16));
    ctx.strokeStyle = rgba(30, 27, 22, 0.3);
    ctx.lineWidth = (0.8 + rnd() * 1.1) * scale;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < steps; s++) {
      x += (rnd() - 0.5) * 9 * scale;
      y += (rnd() * 0.7 + 0.15) * (len / steps);
      ctx.lineTo(x, y);
      if (rnd() < 0.09) {
        const bx = x, by = y, bl = 6 + rnd() * 34;
        ctx.moveTo(bx, by);
        for (let b = 0; b < 3; b++) {
          ctx.lineTo(bx + (rnd() - 0.5) * bl, by + rnd() * bl);
        }
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = rgba(225, 215, 195, 0.05);
    ctx.lineWidth = 0.8 * scale;
    ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y); ctx.stroke();
  }
}

function spalls(ctx, W, H, rnd, count) {
  for (let i = 0; i < count; i++) {
    const x = randRange(rnd, W * 0.05, W * 0.95);
    const y = rnd() < 0.55 ? randRange(rnd, H * 0.62, H * 0.96) : randRange(rnd, 0, H * 0.55);
    const rx = randRange(rnd, 10, 38), ry = randRange(rnd, 8, 30);
    ctx.fillStyle = rgba(74, 66, 55, 0.85);
    ctx.beginPath();
    const n = 12;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = 1 + (rnd() - 0.5) * 0.55;
      const px = x + Math.cos(a) * rx * rr, py = y + Math.sin(a) * ry * rr;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba(205, 195, 175, 0.22); ctx.lineWidth = 1.5; ctx.stroke();
    for (let k = 0; k < 90; k++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd());
      ctx.fillStyle = choice(rnd, ['#938b7c', '#6c6354', '#a59b88', '#514a3e']);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * rx * rr, y + Math.sin(a) * ry * rr, 0.8 + rnd() * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    if (rnd() < 0.5) {
      ctx.strokeStyle = rgba(92, 58, 36, 0.5); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x - rx * 0.4, y); ctx.lineTo(x + rx * 0.5, y + 2); ctx.stroke();
    }
  }
}

function weatherLayer(ctx, W, H, faces, rnd) {
  const sw = 1200, sh = 640;
  const sc = makeCanvas(sw, sh), sx = ctx2d(sc);
  sx.filter = 'blur(2px)';
  for (let i = 0; i < 42; i++) {
    const x = randRange(rnd, 0, sw);
    const w = randRange(rnd, 1.5, 24) * (0.5 + rnd());
    const len = randRange(rnd, sh * 0.18, sh * 1.05);
    const start = randRange(rnd, -40, sh * 0.18);
    const a = randRange(rnd, 0.06, 0.28);
    const col = choice(rnd, [[52, 49, 39], [66, 63, 50], [82, 78, 59], [44, 43, 35]]);
    streak(sx, x, start, w, len, col, a, (rnd() - 0.5) * 18);
  }
  for (let i = 0; i < 10; i++) {
    const x = randRange(rnd, 0, sw);
    streak(sx, x, -20, randRange(rnd, 14, 48), randRange(rnd, sh * 0.4, sh), [98, 89, 64], 0.08 + rnd() * 0.07);
  }
  sx.filter = 'none';
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.72;
  ctx.drawImage(sc, 0, 0, W, H);
  ctx.restore();

  // Broad damp washes running down whole faces, as on the south side.
  for (let i = 0; i < 4; i++) {
    const x = randRange(rnd, 0, W);
    const w = randRange(rnd, W * 0.03, W * 0.1);
    const gr = ctx.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(52,49,41,0)');
    gr.addColorStop(0.5, `rgba(52,49,41,${0.1 + rnd() * 0.1})`);
    gr.addColorStop(1, 'rgba(52,49,41,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - w, H * 0.06, w * 2, H * 0.9);
  }

  // green algae / moss on the lower wall and at the corners
  const mw = 1200, mh = 420;
  const mc = makeCanvas(mw, mh), mx = ctx2d(mc);
  mx.filter = 'blur(7px)';
  for (let i = 0; i < 90; i++) {
    const x = randRange(rnd, 0, mw);
    const y = mh - Math.pow(rnd(), 1.8) * mh * 0.62;
    blob(mx, x, y, randRange(rnd, 8, 70), randRange(rnd, 5, 26),
      choice(rnd, [[70, 76, 44], [85, 88, 55], [55, 63, 38], [100, 95, 62]]), 0.16 + rnd() * 0.3, 0.5, rnd);
  }
  for (let i = 0; i < 18; i++) {
    const x = randRange(rnd, 0, mw);
    streak(mx, x, randRange(rnd, 0, mh * 0.15), randRange(rnd, 2, 10), randRange(rnd, 30, 190), [62, 70, 42], 0.12);
  }
  mx.filter = 'none';
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.42;
  ctx.drawImage(mc, 0, 0, W, mh * (H / mh));
  ctx.restore();

  // pale lichen dots and chalky efflorescence
  ctx.save();
  for (let i = 0; i < 420; i++) {
    const x = randRange(rnd, 0, W), y = randRange(rnd, H * 0.15, H);
    ctx.fillStyle = rgba(190, 192, 167, 0.05 + rnd() * 0.1);
    ctx.beginPath(); ctx.arc(x, y, 0.6 + rnd() * 2.6, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 16; i++) {
    const x = randRange(rnd, 0, W);
    streak(ctx, x, randRange(rnd, 0, H * 0.12), randRange(rnd, 2, 9), randRange(rnd, 60, 280), [230, 224, 205], 0.05 + rnd() * 0.04);
  }
  ctx.restore();

  // top shadow under the platform, bottom damp band
  let g = ctx.createLinearGradient(0, 0, 0, H * 0.09);
  g.addColorStop(0, 'rgba(35,33,28,0.3)');
  g.addColorStop(1, 'rgba(35,33,28,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.09);
  g = ctx.createLinearGradient(0, H * 0.82, 0, H);
  g.addColorStop(0, 'rgba(42,40,34,0)');
  g.addColorStop(1, 'rgba(42,40,34,0.34)');
  ctx.fillStyle = g; ctx.fillRect(0, H * 0.82, W, H * 0.18);
}

/* Large, irregular damp fields.  Reference photographs show whole areas
 * of the shaft several shades darker, with soft edges — not a uniform
 * veil of dirt. */
function broadGrime(ctx, W, H, faces, rnd) {
  const sw = 1024, sh = 512;
  const sc = makeCanvas(sw, sh), sx = ctx2d(sc);
  const fw = sw / faces;
  sx.filter = 'blur(20px)';
  const patches = [
    [4, 0.58, 0.36, 0.32, 0.42, 0.42],
    [4, 0.1, 0.22, 0.28, 0.22, 0.3],
    [0, 0.62, 0.36, 0.3, 0.28, 0.3],
    [1, 0.25, 0.26, 0.2, 0.2, 0.24],
    [12, 0.55, 0.24, 0.28, 0.3, 0.22],
    [8, 0.3, 0.22, 0.2, 0.26, 0.18],
  ];
  for (const [face, at, wf, yf, hf, a] of patches) {
    sx.fillStyle = `rgba(45,42,34,${a})`;
    sx.beginPath();
    sx.ellipse((face + at) * fw, yf * sh, wf * fw, hf * sh, (rnd() - 0.5) * 0.4, 0, Math.PI * 2);
    sx.fill();
  }
  sx.filter = 'none';
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.78;
  ctx.drawImage(sc, 0, 0, W, H);
  ctx.restore();
}

/* Water running off the eight balconies.  These dark tails are one of the
 * strongest features of the real south and east elevations. */
function balconyRunoff(ctx, W, H, faces, rnd) {
  const fw = W / faces;
  for (let k = 0; k < 8; k++) {
    const cx = k * 2 * fw; // balcony sits over a face boundary
    const bw = fw * (0.16 + rnd() * 0.1);
    const len = H * (0.2 + rnd() * 0.14);
    const gr = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
    gr.addColorStop(0, 'rgba(38,35,28,0)');
    gr.addColorStop(0.5, `rgba(38,35,28,${0.16 + rnd() * 0.12})`);
    gr.addColorStop(1, 'rgba(38,35,28,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(cx - bw, 0, bw * 2, len);
    for (let i = 0; i < 9; i++) {
      const x = cx + (rnd() - 0.5) * fw * 0.8;
      streak(ctx, x, 0, 1.4 + rnd() * 5, H * (0.1 + rnd() * 0.28),
        [38, 35, 28], 0.06 + rnd() * 0.1, (rnd() - 0.5) * 10);
    }
  }
}

/* Broad, face-specific staining.  The real tower is not uniformly dirty:
 * the south and east faces carry the heaviest runoff, while the north and
 * west faces stay comparatively clean. */
function localizedStains(ctx, W, H, faces, rnd) {
  const fw = W / faces;
  const band = (face, at, width, alpha, y0 = 0.02, y1 = 0.92) => {
    const x = (face + at) * fw;
    const w = width * fw;
    const gr = ctx.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(52,48,40,0)');
    gr.addColorStop(0.35, `rgba(52,48,40,${alpha * 0.55})`);
    gr.addColorStop(0.55, `rgba(52,48,40,${alpha})`);
    gr.addColorStop(1, 'rgba(52,48,40,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - w, H * y0, w * 2, H * (y1 - y0));
  };
  // south face (0°), between the graffiti and the balcony
  band(0, 0.32, 0.2, 0.46, 0.02, 0.9);
  band(0, 0.8, 0.09, 0.34, 0.06, 0.96);
  // south-east face (22.5°)
  band(1, 0.18, 0.11, 0.32, 0.04, 0.85);
  // east face (90°), heavily weathered in the reference photographs
  band(4, 0.55, 0.3, 0.52, 0.01, 0.98);
  band(4, 0.12, 0.1, 0.34, 0.12, 0.9);
  // west face (270°)
  band(12, 0.48, 0.16, 0.28, 0.08, 0.92);
  // north face (180°), mostly sheltered
  band(8, 0.35, 0.08, 0.18, 0.18, 0.82);

  // Exposed brickwork where the concrete has spalled, right of centre on
  // the south face.  The real tower has several of these reddish patches.
  const brick = (face, at, wf, yf, hf, alpha) => {
    const bx = (face + at) * fw, by = H * yf;
    const bw = fw * wf, bh = H * hf;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = 'blur(1.4px)';
    ctx.fillStyle = 'rgba(122,66,48,0.92)';
    ctx.beginPath();
    ctx.moveTo(bx, by + bh * 0.12);
    ctx.lineTo(bx + bw * 0.32, by);
    ctx.lineTo(bx + bw, by + bh * 0.08);
    ctx.lineTo(bx + bw * 0.92, by + bh * 0.9);
    ctx.lineTo(bx + bw * 0.12, by + bh);
    ctx.closePath();
    ctx.fill();
    // mortar joints and a few lighter bricks
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = 'rgba(196,178,150,0.9)';
    ctx.lineWidth = 1.1;
    for (let r = 1; r < 6; r++) {
      const yy = by + (r / 6) * bh;
      ctx.beginPath(); ctx.moveTo(bx + 2, yy); ctx.lineTo(bx + bw - 2, yy); ctx.stroke();
    }
    for (let c = 1; c < 4; c++) {
      const xx = bx + (c / 4) * bw;
      ctx.beginPath(); ctx.moveTo(xx, by + 2); ctx.lineTo(xx, by + bh - 2); ctx.stroke();
    }
    ctx.filter = 'none';
    ctx.restore();
  };
  brick(0, 0.74, 0.075, 0.43, 0.045, 0.34);
  brick(1, 0.66, 0.045, 0.62, 0.026, 0.28);

  // fine dark drips over the stained faces
  for (let i = 0; i < 18; i++) {
    const face = choice(rnd, [0, 0, 1, 4, 4, 12]);
    const x = (face + rnd()) * fw;
    streak(ctx, x, H * (0.03 + rnd() * 0.25), 1 + rnd() * 5, H * (0.15 + rnd() * 0.6),
      [48, 44, 36], 0.06 + rnd() * 0.1, (rnd() - 0.5) * 8);
  }
}

export function createFacadeTextures() {
  const W = QUALITY.shaft, H = Math.round(W * 0.5);
  const faces = 16;
  const rnd = mulberry32(7311);

  const c = makeCanvas(W, H), ctx = ctx2d(c);
  baseConcrete(ctx, W, H, rnd);
  pourBoardLines(ctx, W, H, faces, rnd);
  faceJoints(ctx, W, H, faces, rnd);
  tieHoles(ctx, W, H, faces, rnd);
  cracks(ctx, W, H, rnd, 28, H * 0.4, 1.4);
  spalls(ctx, W, H, rnd, 7);
  weatherLayer(ctx, W, H, faces, rnd);
  broadGrime(ctx, W, H, faces, rnd);
  balconyRunoff(ctx, W, H, faces, rnd);
  localizedStains(ctx, W, H, faces, rnd);

  // a few long, very dark runoff channels, full resolution
  for (let i = 0; i < 16; i++) {
    const x = randRange(rnd, 0, W);
    streak(ctx, x, randRange(rnd, 0, H * 0.1), randRange(rnd, 2, 10), randRange(rnd, H * 0.2, H * 0.9),
      [40, 37, 30], 0.08 + rnd() * 0.1, (rnd() - 0.5) * 16);
  }

  // ---------------- bump ----------------
  const BW = QUALITY.shaftBump, BH = Math.round(BW * 0.5);
  const bc = makeCanvas(BW, BH), b = ctx2d(bc);
  b.fillStyle = '#808080'; b.fillRect(0, 0, BW, BH);
  blendNoise(b, BW, BH, { size: 512, cells: 10, octaves: 5, seed: 44, alpha: 0.12, mode: 'overlay' });
  const bfw = BW / faces;
  const bcount = Math.max(4, Math.round(BH / 108));
  for (let i = 0; i < bcount; i++) {
    const y = (i / bcount) * BH;
    b.strokeStyle = i % 9 === 0 ? 'rgba(50,50,50,0.6)' : 'rgba(70,70,70,0.28)';
    b.lineWidth = 1.2;
    b.beginPath(); b.moveTo(0, y); b.lineTo(BW, y); b.stroke();
    b.strokeStyle = 'rgba(160,160,160,0.2)';
    b.beginPath(); b.moveTo(0, y + 1.3); b.lineTo(BW, y + 1.3); b.stroke();
  }
  for (let f = 0; f < faces; f++) {
    const x = f * bfw;
    b.strokeStyle = 'rgba(40,40,40,0.8)'; b.lineWidth = 2.2;
    b.beginPath(); b.moveTo(x, 0); b.lineTo(x, BH); b.stroke();
  }
  cracks(b, BW, BH, mulberry32(77), 24, BH * 0.4, 0.8);
  const hrnd = mulberry32(99);
  for (let f = 0; f < faces; f++) {
    for (let r = 0; r < 12; r++) {
      for (let col = 0; col < 3; col++) {
        if (hrnd() < 0.2) continue;
        const x = f * bfw + (col + 0.3 + hrnd() * 0.4) * (bfw / 3);
        const y = (r + 0.25 + hrnd() * 0.45) * (BH / 12);
        b.fillStyle = 'rgba(25,25,25,0.75)';
        b.beginPath(); b.arc(x, y, 1.4 + hrnd(), 0, Math.PI * 2); b.fill();
      }
    }
  }

  // ---------------- roughness ----------------
  const RW = 1024, RH = 512;
  const rc = makeCanvas(RW, RH), rr = ctx2d(rc);
  rr.fillStyle = '#dedede'; rr.fillRect(0, 0, RW, RH);
  blendNoise(rr, RW, RH, { size: 256, cells: 16, octaves: 4, seed: 55, alpha: 0.25, mode: 'overlay' });
  for (let i = 0; i < 34; i++) {
    streak(rr, randRange(rnd, 0, RW), randRange(rnd, 0, RH * 0.15), randRange(rnd, 2, 16), randRange(rnd, RH * 0.2, RH), [135, 135, 135], 0.25 + rnd() * 0.3);
  }
  rr.fillStyle = 'rgba(250,250,250,0.35)';
  rr.fillRect(0, RH * 0.9, RW, RH * 0.1);

  const field = fbmField(512, { cells: 20, octaves: 4, seed: 123 });
  const normalCanvas = normalFromField(field, 512, 1.4);

  // Final grade: hold the board marks and runoff at viewing distance
  // without pushing the concrete towards a warm brown.
  const gc = makeCanvas(W, H), gx = ctx2d(gc);
  gx.filter = 'contrast(1.18) saturate(0.82) brightness(0.98)';
  gx.drawImage(c, 0, 0);
  gx.filter = 'none';

  return {
    map: canvasTexture(gc, { anisotropy: 16 }),
    bumpMap: canvasTexture(bc, { srgb: false }),
    roughnessMap: canvasTexture(rc, { srgb: false }),
    normalMap: canvasTexture(normalCanvas, {
      srgb: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, repeat: [14, 6],
    }),
  };
}

/* ------------------------------------------------------------------ *
 *  Upper drum: lighter concrete, dense shutter boards, runoff from rim.
 * ------------------------------------------------------------------ */
export function createDrumTextures() {
  const W = QUALITY.drum, H = Math.round(W * 0.25);
  const faces = 32;
  const rnd = mulberry32(9137);
  const c = makeCanvas(W, H), ctx = ctx2d(c);
  baseConcrete(ctx, W, H, rnd, {
    top: '#b8b3a9', mid: '#aba69b', low: '#9a9489', bottom: '#877f74',
  });
  pourBoardLines(ctx, W, H, faces, rnd, 34, 0.44);
  faceJoints(ctx, W, H, faces, rnd, 4);
  tieHoles(ctx, W, H, faces, rnd);
  cracks(ctx, W, H, rnd, 12, H * 0.28, 1.2);
  spalls(ctx, W, H, rnd, 4);

  // Broad vertical runoff.  The real drum is grey concrete streaked by
  // water running from the coping, not a row of evenly darkened boards.
  for (let i = 0; i < 15; i++) {
    const x = randRange(rnd, 0, W);
    const w = randRange(rnd, 18, 100);
    const gr = ctx.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(48,45,38,0)');
    gr.addColorStop(0.45, `rgba(48,45,38,${0.10 + rnd() * 0.14})`);
    gr.addColorStop(1, 'rgba(48,45,38,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - w, 0, w * 2, H * (0.45 + rnd() * 0.55));
  }
  // fine vertical drips, denser on the south and east faces
  for (let i = 0; i < 58; i++) {
    const x = randRange(rnd, 0, W);
    streak(ctx, x, H * (0.01 + rnd() * 0.16), randRange(rnd, 1.2, 6), randRange(rnd, H * 0.25, H * 0.95),
      [48, 45, 38], 0.06 + rnd() * 0.11, (rnd() - 0.5) * 7);
  }
  // rust bleed from the rim
  for (let i = 0; i < 12; i++) {
    streak(ctx, randRange(rnd, 0, W), rnd() * H * 0.05, randRange(rnd, 1, 5), randRange(rnd, 20, H * 0.4),
      [132, 78, 42], 0.05 + rnd() * 0.08);
  }

  // dark coping band at the top, kept shallow so it reads as a shadow
  // under the coping rather than a black cap
  let g = ctx.createLinearGradient(0, 0, 0, H * 0.04);
  g.addColorStop(0, 'rgba(40,37,31,0.28)');
  g.addColorStop(1, 'rgba(40,37,31,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.04);
  // base shadow
  g = ctx.createLinearGradient(0, H * 0.9, 0, H);
  g.addColorStop(0, 'rgba(30,28,23,0)');
  g.addColorStop(1, 'rgba(30,28,23,0.4)');
  ctx.fillStyle = g; ctx.fillRect(0, H * 0.9, W, H * 0.1);

  const bw = QUALITY.drumBump, bh = Math.round(bw * 0.25);
  const bc = makeCanvas(bw, bh), b = ctx2d(bc);
  b.fillStyle = '#808080'; b.fillRect(0, 0, bw, bh);
  blendNoise(b, bw, bh, { size: 256, cells: 12, octaves: 4, seed: 12, alpha: 0.12, mode: 'overlay' });
  const bfw = bw / faces;
  const rows = 22;
  for (let i = 0; i < rows; i++) {
    const y = (i / rows) * bh;
    b.strokeStyle = i % 9 === 0 ? 'rgba(60,60,60,0.32)' : 'rgba(80,80,80,0.11)';
    b.beginPath(); b.moveTo(0, y); b.lineTo(bw, y); b.stroke();
    b.strokeStyle = 'rgba(160,160,160,0.08)';
    b.beginPath(); b.moveTo(0, y + 1.2); b.lineTo(bw, y + 1.2); b.stroke();
  }
  for (let f = 0; f < faces; f++) {
    b.strokeStyle = 'rgba(40,40,40,0.75)';
    b.beginPath(); b.moveTo(f * bfw, 0); b.lineTo(f * bfw, bh); b.stroke();
  }

  const rc = makeCanvas(1024, 256), rr = ctx2d(rc);
  rr.fillStyle = '#d9d9d9'; rr.fillRect(0, 0, 1024, 256);
  blendNoise(rr, 1024, 256, { size: 256, cells: 12, octaves: 4, seed: 31, alpha: 0.22, mode: 'overlay' });
  for (let i = 0; i < 24; i++) {
    streak(rr, randRange(rnd, 0, 1024), randRange(rnd, 0, 30), randRange(rnd, 2, 12), randRange(rnd, 60, 240), [140, 140, 140], 0.2 + rnd() * 0.3);
  }

  // Keep the drum a light, slightly warmer grey than the weathered shaft.
  // The real upper cylinder is not darker than the wall below it; it is
  // simply cleaner and less heavily stained.
  const gc = makeCanvas(W, H), gx = ctx2d(gc);
  gx.filter = 'contrast(1.1) saturate(0.66) brightness(0.91)';
  gx.drawImage(c, 0, 0);
  gx.filter = 'none';

  return {
    map: canvasTexture(gc, { anisotropy: 16 }),
    bumpMap: canvasTexture(bc, { srgb: false }),
    roughnessMap: canvasTexture(rc, { srgb: false }),
    normalMap: null,
  };
}

/* ------------------------------------------------------------------ *
 *  Flat concrete used on trims, ring, struts and the distant tower.
 * ------------------------------------------------------------------ */
export function createTrimTextures() {
  const S = QUALITY.trim;
  const rnd = mulberry32(4711);
  const c = makeCanvas(S, S), ctx = ctx2d(c);
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#c6bfb0');
  g.addColorStop(0.55, '#b2ab9d');
  g.addColorStop(1, '#978f81');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  blendNoise(ctx, S, S, { size: 512, cells: 5, octaves: 5, seed: 81, alpha: 0.18, mode: 'overlay' });
  blendNoise(ctx, S, S, { size: 512, cells: 30, octaves: 4, seed: 82, alpha: 0.1, mode: 'soft-light' });

  const rows = 34;
  for (let i = 0; i < rows; i++) {
    const y = (i / rows) * S;
    ctx.strokeStyle = i % 8 === 0 ? 'rgba(48,45,38,0.22)' : 'rgba(48,45,38,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    ctx.strokeStyle = 'rgba(225,216,198,0.04)';
    ctx.beginPath(); ctx.moveTo(0, y + 1); ctx.lineTo(S, y + 1); ctx.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const x = randRange(rnd, 0, S);
    streak(ctx, x, randRange(rnd, 0, S * 0.2), randRange(rnd, 0.8, 7), randRange(rnd, S * 0.2, S * 0.9),
      [55, 52, 44], 0.04 + rnd() * 0.1, (rnd() - 0.5) * 8);
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = rgba(190, 191, 167, 0.06 + rnd() * 0.08);
    ctx.beginPath(); ctx.arc(randRange(rnd, 0, S), randRange(rnd, 0, S), 0.5 + rnd() * 2.4, 0, Math.PI * 2); ctx.fill();
  }
  cracks(ctx, S, S, rnd, 8, S * 0.35, 0.6);

  // seamless-ish bump
  const bc = makeCanvas(S, S), b = ctx2d(bc);
  b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
  blendNoise(b, S, S, { size: 256, cells: 20, octaves: 4, seed: 71, alpha: 0.2, mode: 'overlay' });
  for (let i = 0; i < rows; i++) {
    const y = (i / rows) * S;
    b.strokeStyle = 'rgba(60,60,60,0.35)'; b.lineWidth = 1;
    b.beginPath(); b.moveTo(0, y); b.lineTo(S, y); b.stroke();
  }

  return {
    map: canvasTexture(c, {
      wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, repeat: [2, 2], anisotropy: 8,
    }),
    bumpMap: canvasTexture(bc, {
      srgb: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, repeat: [2, 2],
    }),
    roughnessMap: null,
  };
}
