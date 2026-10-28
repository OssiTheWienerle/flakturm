import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Small shared helpers for the procedural texture library.
 * ------------------------------------------------------------------ */

export const QUALITY = {
  high: true,
  shaft: 4096,
  shaftBump: 2048,
  drum: 4096,
  drumBump: 2048,
  roof: 2048,
  trim: 1024,
  sky: 2048,
};

export function configureQuality(high) {
  QUALITY.high = high;
  QUALITY.shaft = high ? 4096 : 2048;
  QUALITY.shaftBump = high ? 2048 : 1024;
  QUALITY.drum = high ? 4096 : 2048;
  QUALITY.drumBump = high ? 2048 : 1024;
  QUALITY.roof = high ? 2048 : 1024;
  QUALITY.trim = high ? 1024 : 512;
  QUALITY.sky = high ? 2048 : 1024;
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function ctx2d(c) {
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  return x;
}

export function canvasTexture(canvas, {
  srgb = true,
  wrapS = THREE.ClampToEdgeWrapping,
  wrapT = THREE.ClampToEdgeWrapping,
  repeat = null,
  anisotropy = 8,
} = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = wrapS; t.wrapT = wrapT;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

export const rgba = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

export function randRange(rnd, a, b) { return a + (b - a) * rnd(); }

export function choice(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }

/** Seamless fbm value-noise field in [0,1]. */
export function fbmField(size, { cells = 8, octaves = 5, seed = 1, gain = 0.52 } = {}) {
  const rnd = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = Math.max(2, Math.round(cells * Math.pow(2, o)));
    const g = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) g[i] = rnd();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * n, y0 = Math.floor(fy), ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const y0i = (y0 % n) * n, y1i = ((y0 + 1) % n) * n;
      const row = y * size;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * n, x0 = Math.floor(fx), tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const x0i = x0 % n, x1i = (x0 + 1) % n;
        const v0 = g[y0i + x0i] * (1 - sx) + g[y0i + x1i] * sx;
        const v1 = g[y1i + x0i] * (1 - sx) + g[y1i + x1i] * sx;
        out[row + x] += (v0 * (1 - sy) + v1 * sy) * amp;
      }
    }
    total += amp; amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

export function fieldToCanvas(field, size) {
  const c = makeCanvas(size, size);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < field.length; i++) {
    const v = Math.max(0, Math.min(255, field[i] * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Multiply-blend a seamless noise canvas over a context. */
export function blendNoise(ctx, w, h, {
  size = 512, cells = 6, octaves = 5, seed = 1,
  alpha = 0.25, mode = 'overlay', scale = 1, color = null, x = 0, y = 0,
} = {}) {
  const field = fbmField(size, { cells, octaves, seed });
  const c = fieldToCanvas(field, size);
  if (color) {
    const cc = ctx2d(c);
    cc.globalCompositeOperation = 'multiply';
    cc.fillStyle = color;
    cc.fillRect(0, 0, size, size);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = mode;
  ctx.drawImage(c, x, y, w * scale, h * scale);
  ctx.restore();
}

/** Normal map from a height field. */
export function normalFromField(field, size, strength = 2) {
  const c = makeCanvas(size, size);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(size, size);
  const at = (x, y) => field[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Soft vertical damp streak on a 2D context. */
export function streak(ctx, x, y, w, len, color, alpha, curve = 0) {
  const g = ctx.createLinearGradient(0, y, 0, y + len);
  g.addColorStop(0, rgba(color[0], color[1], color[2], alpha));
  g.addColorStop(0.25, rgba(color[0], color[1], color[2], alpha * 0.8));
  g.addColorStop(1, rgba(color[0], color[1], color[2], 0));
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.bezierCurveTo(x - w / 2 + curve, y + len * 0.3, x + curve * 1.4, y + len * 0.7, x + w * 0.06, y + len);
  ctx.lineTo(x + w / 2, y + len);
  ctx.bezierCurveTo(x + w / 2 + curve, y + len * 0.7, x + curve * 1.4, y + len * 0.3, x + w / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Irregular soft blob. */
export function blob(ctx, x, y, rx, ry, color, alpha, rough = 0.3, rnd = Math.random) {
  ctx.save();
  ctx.fillStyle = rgba(color[0], color[1], color[2], alpha);
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = 1 + (rnd() - 0.5) * rough * 2;
    const px = x + Math.cos(a) * rx * rr;
    const py = y + Math.sin(a) * ry * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draw text with spray-like layered offsets. */
export function sprayText(ctx, text, x, y, { font, fill, outline = null, rotate = 0, jitter = 2, alpha = 1, align = 'left' } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate);
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineWidth = 10;
    ctx.strokeStyle = outline;
    ctx.globalAlpha = alpha;
    ctx.strokeText(text, 0, 0);
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  for (let i = 0; i < 5; i++) {
    ctx.fillText(text, (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter);
  }
  ctx.restore();
}
