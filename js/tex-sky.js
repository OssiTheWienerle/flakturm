import * as THREE from 'three';
import { QUALITY, makeCanvas, ctx2d, canvasTexture, mulberry32, blob, rgba } from './tex-utils.js';

/* ------------------------------------------------------------------ *
 *  Equirectangular skies and the matching lighting presets.
 * ------------------------------------------------------------------ */

export const SKY_PRESETS = {
  afternoon: {
    label: 'Late afternoon',
    short: 'Afternoon',
    sunAz: -36, sunEl: 30,
    sunColor: 0xfff1dc, sunIntensity: 4.8,
    hemiSky: 0xbdd6ee, hemiGround: 0x5c5747, hemiIntensity: 0.72,
    ambient: 0x94a6b8, ambientIntensity: 0.12,
    fog: 0xafc7d9, fogDensity: 0.0008,
    exposure: 1.06,
    sky: {
      zenith: '#1f528d', upper: '#467fb4', horizon: '#7fb0d4', haze: '#aecde4',
      ground: '#535a48', sun: '#fff2d6', cloud: '#f4f0e4', cloudShadow: '#b0b4b0',
      coverage: 0.32, warm: 0.15,
    },
  },
  golden: {
    label: 'Golden hour',
    short: 'Golden',
    sunAz: -55, sunEl: 12,
    sunColor: 0xffc287, sunIntensity: 3.5,
    hemiSky: 0xc7b8a6, hemiGround: 0x4b4435, hemiIntensity: 0.62,
    ambient: 0xa5886b, ambientIntensity: 0.12,
    fog: 0xcdb9a2, fogDensity: 0.0011,
    exposure: 1.02,
    sky: {
      zenith: '#31527e', upper: '#7a7f91', horizon: '#f1c99a', haze: '#f7d9ab',
      ground: '#514e3e', sun: '#ffcc85', cloud: '#f6d7b0', cloudShadow: '#a48d80',
      coverage: 0.3, warm: 0.7,
    },
  },
  overcast: {
    label: 'Overcast',
    short: 'Overcast',
    sunAz: -40, sunEl: 48,
    sunColor: 0xdde7ee, sunIntensity: 1.0,
    hemiSky: 0xc0cdd5, hemiGround: 0x55554c, hemiIntensity: 1.16,
    ambient: 0x94a3ad, ambientIntensity: 0.18,
    fog: 0xb8c0c2, fogDensity: 0.0013,
    exposure: 1.02,
    sky: {
      zenith: '#8a99a4', upper: '#a9b4ba', horizon: '#d3d7d4', haze: '#d7dbd8',
      ground: '#5d5f53', sun: '#eef2f4', cloud: '#cdd0d0', cloudShadow: '#969d9f',
      coverage: 0.95, warm: 0.06,
    },
  },
};

function sunDirection(preset) {
  const az = THREE.MathUtils.degToRad(preset.sunAz);
  const el = THREE.MathUtils.degToRad(preset.sunEl);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

export function createSkyTexture(preset) {
  const W = QUALITY.sky, H = W / 2;
  const s = preset.sky;
  const rnd = mulberry32(9090);
  const c = makeCanvas(W, H), ctx = ctx2d(c);

  // sky gradient down to the horizon
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.51);
  g.addColorStop(0, s.zenith);
  g.addColorStop(0.42, s.upper);
  g.addColorStop(0.82, s.horizon);
  g.addColorStop(1, s.haze);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.51);

  // below the horizon: muted park haze / ground bounce
  const g2 = ctx.createLinearGradient(0, H * 0.5, 0, H);
  g2.addColorStop(0, s.haze);
  g2.addColorStop(0.18, s.horizon);
  g2.addColorStop(0.5, s.ground);
  g2.addColorStop(1, '#3c3d33');
  ctx.fillStyle = g2;
  ctx.fillRect(0, H * 0.5, W, H * 0.5);

  // clouds on a separate soft layer
  const cw = 1024, ch = 512;
  const cl = makeCanvas(cw, ch), cx = ctx2d(cl);
  cx.filter = 'blur(14px)';
  const count = Math.round(12 + s.coverage * 58);
  for (let i = 0; i < count; i++) {
    const y = ch * (0.13 + Math.pow(rnd(), 1.4) * 0.34);
    const x = rnd() * cw;
    const rx = 34 + rnd() * 170, ry = 8 + rnd() * 34;
    const warm = s.warm * (0.4 + rnd() * 0.6);
    const col = warm > 0.35 && rnd() < 0.5 ? s.cloud : s.cloud;
    cx.fillStyle = rgba(
      parseInt(col.slice(1, 3), 16) * (1 - warm * 0.1) + 30 * warm,
      parseInt(col.slice(3, 5), 16) * (1 - warm * 0.18),
      parseInt(col.slice(5, 7), 16) * (1 - warm * 0.3),
      0.12 + rnd() * 0.28
    );
    cx.beginPath();
    cx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    cx.fill();
    if (rnd() < 0.4) {
      cx.fillStyle = rgba(175, 177, 172, 0.11);
      cx.beginPath();
      cx.ellipse(x - rx * 0.2, y + ry * 0.5, rx * 0.9, ry * 0.5, 0, 0, Math.PI * 2);
      cx.fill();
    }
  }
  // brighter cloud tops
  for (let i = 0; i < count * 0.9; i++) {
    const x = rnd() * cw, y = ch * (0.12 + rnd() * 0.3);
    cx.fillStyle = rgba(255, 250, 240, 0.06 + rnd() * 0.1);
    cx.beginPath();
    cx.ellipse(x, y, 34 + rnd() * 120, 6 + rnd() * 18, 0, 0, Math.PI * 2);
    cx.fill();
  }
  cx.filter = 'none';
  ctx.globalAlpha = 0.92;
  ctx.drawImage(cl, 0, 0, W, H * 0.68);
  ctx.globalAlpha = 1;

  // sun glow
  if (s.coverage < 0.8) {
    const dir = sunDirection(preset);
    const u = Math.atan2(dir.z, dir.x) / (Math.PI * 2) + 0.5;
    const v = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) / Math.PI + 0.5;
    const sx = u * W, sy = (1 - v) * H;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.16);
    glow.addColorStop(0, rgba(255, 248, 226, 0.95));
    glow.addColorStop(0.04, rgba(255, 243, 213, 0.75));
    glow.addColorStop(0.25, rgba(255, 232, 190, 0.22 * (1 - s.coverage)));
    glow.addColorStop(1, 'rgba(255,230,190,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H * 0.75);
    ctx.fillStyle = 'rgba(255,252,242,0.9)';
    ctx.beginPath(); ctx.arc(sx, sy, W * 0.008, 0, Math.PI * 2); ctx.fill();
  }

  // horizon haze band
  const hz = ctx.createLinearGradient(0, H * 0.46, 0, H * 0.525);
  hz.addColorStop(0, 'rgba(225,236,240,0)');
  hz.addColorStop(0.58, rgba(226, 236, 240, 0.09));
  hz.addColorStop(1, 'rgba(226,236,240,0)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, H * 0.46, W, H * 0.065);

  const tex = canvasTexture(c, { anisotropy: 4 });
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return { texture: tex, sunDirection: sunDirection(preset) };
}
