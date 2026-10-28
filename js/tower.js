import * as THREE from 'three';
import {
  buildShell, buildHoleyShell, buildProfileRing, Batch, beamGeometry, wallDecal,
} from './geo-utils.js';

/* ------------------------------------------------------------------ *
 *  Gefechtsturm Augarten — Bauart III
 *  16-sided shaft, 8 cantilevered light-flak balconies, 32-sided drum,
 *  four open 12.8 cm gun pits and a broken parapet.
 * ------------------------------------------------------------------ */

const D2R = Math.PI / 180;
const SIDES = 16;
const R_BASE = 21.5;
const R_TOP = 20.95;
const SHAFT_TOP = 44.2;
const RING_BOT = 41.6;
const RING_TOP = 44.15;
const DRUM_SIDES = 32;
const DRUM_R = 18.0;
const DRUM_IN = 16.55;
const ROOF_Y = 53.4;
const RIM_TOP = 55.0;
const NOTCH_SECTORS = new Set([2, 3]);
const NOTCH_HALF = 11.25 * D2R * 1.0;

const shaftRadius = (y) => R_BASE + (R_TOP - R_BASE) * THREE.MathUtils.clamp(y / SHAFT_TOP, 0, 1);
const drumRadius = (y) => DRUM_R + (17.95 - DRUM_R) * THREE.MathUtils.clamp((y - 44.2) / 10.8, 0, 1);

/** Smooth the shell shading around the vertical axis.  The faceted
 *  geometry still reads in silhouette, but the concrete surface no longer
 *  looks like a corrugated drum under grazing light. */
function smoothRadialNormals(geo) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const l = Math.hypot(x, z) || 1;
    nor.setXYZ(i, x / l, 0, z / l);
  }
  nor.needsUpdate = true;
}

function faceMatrix(angle, radius, y) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(Math.sin(angle) * radius, y, Math.cos(angle) * radius),
    q, new THREE.Vector3(1, 1, 1)
  );
}

/** Local matrix offset inside a face group. */
function localMat(x, y, z) {
  return new THREE.Matrix4().makeTranslation(x, y, z);
}

/** A box beam whose width stays tangential and depth stays in the radial plane. */
function orientedBeam(p0, p1, width, depth) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  dir.normalize();
  const tangent = new THREE.Vector3(dir.z, 0, -dir.x);
  if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
  tangent.normalize();
  const normal = new THREE.Vector3().crossVectors(tangent, dir).normalize();
  const m = new THREE.Matrix4().makeBasis(tangent, dir, normal);
  m.setPosition(new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5));
  const geo = new THREE.BoxGeometry(width, len, depth);
  geo.applyMatrix4(m);
  return geo;
}

export function buildTower(M, G) {
  const group = new THREE.Group();
  group.name = 'Gefechtsturm';

  const trimB = new Batch(M.trim);
  const trimDarkB = new Batch(M.trimDark);
  const rubbleB = new Batch(M.rubble);
  const darkB = new Batch(M.interior, { shadow: false });
  const metalB = new Batch(M.steel);
  const cableB = new Batch(M.cable, { shadow: false });
  const rustB = new Batch(M.rust);

  /** A tensioning cable wrapped around a polygonal drum. */
  function addCableBand(y, radius, thickness, sides, batch, clampEvery = 0, clampOffset = 0) {
    const da = (Math.PI * 2) / sides;
    for (let i = 0; i < sides; i++) {
      // Continuous around the tower.  Leaving a gap at every vertex made
      // the cables read as rows of black slots at close range.
      const a0 = i * da - da / 2;
      const a1 = a0 + da;
      const p0 = new THREE.Vector3(Math.sin(a0) * radius, y, Math.cos(a0) * radius);
      const p1 = new THREE.Vector3(Math.sin(a1) * radius, y, Math.cos(a1) * radius);
      batch.add(beamGeometry(p0, p1, thickness, thickness));
    }
    if (clampEvery > 0) {
      // Clamps are staggered from band to band.  Aligning every band
      // produced an artificial dashed vertical line up the tower.
      const start = ((clampOffset % sides) + sides) % sides;
      for (let n = 0; n < sides; n += clampEvery) {
        const i = (start + n) % sides;
        const a = i * da;
        batch.addBox(0.12, 0.22, 0.07,
          Math.sin(a) * (radius + 0.035), y, Math.cos(a) * (radius + 0.035), a);
      }
    }
  }

  /* ---------------- opening layout ----------------
   * Openings are snapped to the centre of a flat face so the cut-out,
   * frame and reveal all share the same plane.
   */
  const shaftOpenings = [];
  const shaftOpening = (o) => {
    const da = (Math.PI * 2) / SIDES;
    const face = ((Math.round(o.angle / da) % SIDES) + SIDES) % SIDES;
    shaftOpenings.push({
      ...o,
      face,
      angle: face * da,
      sides: SIDES,
      radius: shaftRadius(o.y),
      lateral: o.lateral || 0,
      depth: o.depth ?? 0.35,
      frame: o.frame ?? true,
      door: o.door ?? false,
      bars: o.bars ?? false,
      open: o.open ?? true,
    });
  };
  for (const [aDeg, y, w, h, lat, bars] of [
    [22.5, 29.1, 1.15, 1.0, -1.1, true],
    [22.5, 29.1, 1.15, 1.0, 1.2, true],
    [-22.5, 35.3, 1.45, 1.0, 0, true],
    [135, 23.4, 0.85, 1.55, 0.7, false],
    [270, 14.6, 1.0, 0.85, -0.6, false],
    [112.5, 38.1, 0.7, 0.7, 0, false],
    [202.5, 9.5, 0.8, 1.0, -1.0, true],
    [337.5, 20.0, 0.8, 1.0, 1.0, false],
    [0, 39.0, 0.7, 0.7, 1.5, false],
    [-22.5, 39.0, 0.8, 0.8, -1.6, false],
    [0, 31.6, 1.0, 0.9, -1.3, true],
    [0, 27.2, 1.85, 1.35, 0, false],
    [0, 24.2, 0.9, 0.9, 1.1, false],
    [0, 12.2, 0.8, 1.0, -0.9, true],
    [45, 34.0, 0.8, 0.8, 0.9, false],
    [90, 27.0, 0.9, 0.9, -0.6, true],
  ]) {
    shaftOpening({
      angle: aDeg * D2R, y, w, h, lateral: lat,
      depth: 0.34, bars, frame: true,
    });
  }
  shaftOpening({
    angle: 180 * D2R, y: 2.1,
    w: 1.9, h: 2.3, depth: 0.45, door: true, frame: true,
  });

  const drumOpenings = [];
  const drumOpening = (o) => {
    const da = (Math.PI * 2) / DRUM_SIDES;
    const face = ((Math.round(o.angle / da) % DRUM_SIDES) + DRUM_SIDES) % DRUM_SIDES;
    const top = NOTCH_SECTORS.has(face) ? ROOF_Y : 55.0;
    if (o.y - o.h / 2 < 44.22 || o.y + o.h / 2 > top - 0.02) return;
    drumOpenings.push({
      ...o,
      face,
      angle: face * da,
      sides: DRUM_SIDES,
      radius: drumRadius(o.y),
      lateral: 0,
      depth: o.depth ?? 0.35,
      frame: o.frame ?? true,
      door: o.door ?? false,
      bars: o.bars ?? false,
      open: o.open ?? true,
    });
  };
  // access doors onto the eight balconies
  for (let k = 0; k < 8; k++) {
    drumOpening({
      angle: k * Math.PI / 4, y: 45.45, w: 2.0, h: 2.35,
      depth: 0.3, door: k % 3 !== 0, frame: true,
    });
  }
  // larger vents / windows
  for (const [aDeg, y, w, h, bars] of [
    [40, 48.8, 1.5, 0.95, true],
    [150, 49.4, 1.3, 0.9, false],
    [240, 48.2, 1.6, 1.0, true],
    [310, 50.1, 1.2, 0.8, false],
  ]) {
    drumOpening({ angle: aDeg * D2R, y, w, h, depth: 0.35, bars, frame: true });
  }
  // a handful of small, irregular vents — not regular rows
  for (const [aDeg, y, w, h] of [
    [18, 52.2, 0.46, 0.48],
    [78, 51.6, 0.36, 0.38],
    [132, 52.5, 0.42, 0.4],
    [196, 51.9, 0.34, 0.36],
    [264, 52.3, 0.44, 0.44],
    [324, 51.7, 0.36, 0.34],
  ]) {
    drumOpening({ angle: aDeg * D2R, y, w, h, depth: 0.16, frame: false });
  }

  /* ---------------- shaft ---------------- */
  const shaftGeo = buildHoleyShell({
    sides: SIDES, angleOffset: 0, y0: 0, y1: SHAFT_TOP,
    radius: shaftRadius, openings: shaftOpenings,
    uvU: [0, 1], uvV: [0, 1],
  });
  smoothRadialNormals(shaftGeo);
  const shaft = new THREE.Mesh(shaftGeo, M.facade);
  shaft.name = 'shaft';
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  // plinth and two thin construction ledges
  const plinth = new THREE.Mesh(buildProfileRing({
    sides: SIDES,
    profile: [
      { r: 21.45, y: 0 }, { r: 21.85, y: 0.15 }, { r: 21.85, y: 0.75 },
      { r: 21.55, y: 0.92 }, { r: 21.45, y: 0.92 },
    ],
    uvScale: [8, 0.6],
  }), M.trim);
  plinth.castShadow = true; plinth.receiveShadow = true;
  group.add(plinth);

  for (const y0 of [17.65, 30.55]) {
    const rr = shaftRadius(y0);
    const ledge = new THREE.Mesh(buildProfileRing({
      sides: SIDES,
      profile: [
        { r: rr - 0.05, y: y0 }, { r: rr + 0.13, y: y0 + 0.03 },
        { r: rr + 0.13, y: y0 + 0.17 }, { r: rr - 0.02, y: y0 + 0.2 },
      ],
      uvScale: [8, 0.2],
    }), M.trim);
    ledge.castShadow = true; ledge.receiveShadow = true;
    group.add(ledge);
  }

  // Four tensioning cables at mid-height, exactly as they survive on the
  // Augarten tower. The rest of the cable groups sit under the platform and
  // around the drum.
  [19.5, 20.0, 20.5, 21.0].forEach((bandY, i) => {
    addCableBand(bandY, shaftRadius(bandY) + 0.06, 0.045, SIDES, metalB, 5, i * 2);
  });

  /* ---------------- main platform ring ---------------- */
  const RING_OUTER = 22.75;
  const ring = new THREE.Mesh(buildProfileRing({
    sides: SIDES,
    profile: [
      { r: shaftRadius(RING_BOT), y: RING_BOT },
      { r: RING_OUTER - 0.35, y: RING_BOT + 0.18 },
      { r: RING_OUTER, y: RING_BOT + 0.55 },
      { r: RING_OUTER, y: RING_TOP - 0.35 },
      { r: RING_OUTER - 0.3, y: RING_TOP },
      { r: shaftRadius(RING_TOP), y: RING_TOP },
    ],
    uvScale: [7, 1.4],
  }), M.ring);
  ring.castShadow = true; ring.receiveShadow = true;
  group.add(ring);

  // Six cables immediately below the gun platform.
  [41.95, 42.2, 42.45, 42.7, 42.95, 43.2].forEach((bandY, i) => {
    addCableBand(bandY, RING_OUTER + 0.045, 0.04, SIDES, metalB, 5, i * 2);
  });

  /* ---------------- eight light-flak balconies ---------------- */
  const lobeBatch = new Batch(M.lobe);
  const strutBatch = new Batch(M.strut);
  const coveGeos = [];
  const lobeAngles = [];

  // Plan outline of one balcony: a broad, shallow D-shape. The real
  // Augarten balconies are rounded rectangular platforms, not semicircles.
  const BAL_HALF = 4.35;
  const BAL_BASE = 20.95;
  const BAL_SIDE = 24.75;
  const BAL_FRONT = 25.9;
  const BAL_CORNER = 1.15;

  function balconyOutline(inset = 0) {
    const pts = [];
    const push = (lx, ly) => pts.push({ lx, ly, theta: 0, rr: 0 });
    const sideSteps = 4;
    for (let s = 0; s <= sideSteps; s++) {
      push(-(BAL_HALF - inset), 22.7 + (BAL_SIDE - 22.7) * (s / sideSteps));
    }
    // rounded left corner
    for (let s = 1; s <= 5; s++) {
      const t = s / 5;
      const ang = Math.PI - t * Math.PI / 2;
      push(-BAL_HALF + BAL_CORNER + Math.cos(ang) * BAL_CORNER,
        BAL_FRONT - BAL_CORNER + Math.sin(ang) * BAL_CORNER - inset);
    }
    // shallow front arc
    const frontSteps = 14;
    for (let s = 1; s <= frontSteps; s++) {
      const t = s / frontSteps;
      const lx = -(BAL_HALF - BAL_CORNER) + 2 * (BAL_HALF - BAL_CORNER) * t;
      const bulge = 0.75 * Math.sin(Math.PI * t);
      push(lx * (1 - inset / 8), BAL_FRONT + bulge * 0.5 - inset);
    }
    // rounded right corner
    for (let s = 1; s <= 5; s++) {
      const t = s / 5;
      const ang = Math.PI / 2 - t * Math.PI / 2;
      push(BAL_HALF - BAL_CORNER + Math.cos(ang) * BAL_CORNER,
        BAL_FRONT - BAL_CORNER + Math.sin(ang) * BAL_CORNER - inset);
    }
    for (let s = 1; s <= sideSteps; s++) {
      push(BAL_HALF - inset, BAL_SIDE - (BAL_SIDE - 22.7) * (s / sideSteps));
    }
    return pts;
  }

  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    lobeAngles.push(a);

    const shape = new THREE.Shape();
    shape.moveTo(-BAL_HALF, BAL_BASE);
    shape.lineTo(-BAL_HALF, BAL_SIDE);
    shape.quadraticCurveTo(-BAL_HALF, BAL_FRONT, -BAL_HALF + BAL_CORNER, BAL_FRONT);
    shape.quadraticCurveTo(0, BAL_FRONT + 0.75, BAL_HALF - BAL_CORNER, BAL_FRONT);
    shape.quadraticCurveTo(BAL_HALF, BAL_FRONT, BAL_HALF, BAL_SIDE);
    shape.lineTo(BAL_HALF, BAL_BASE);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 1.42, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12,
      bevelSegments: 2, curveSegments: 4, steps: 1,
    });
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(Math.PI + a);
    geo.translate(0, 42.49, 0);
    lobeBatch.add(geo);

    // Shallow curved soffit between the balcony edge and the ring face.
    const outline = balconyOutline();
    for (const o of outline) {
      o.theta = a + Math.atan2(o.lx, o.ly);
      o.rr = Math.hypot(o.lx, o.ly);
    }
    const rows = 4;
    const positions = [], uvs = [], indices = [];
    for (let s = 0; s < outline.length; s++) {
      const o = outline[s];
      for (let r = 0; r <= rows; r++) {
        const t = r / rows;
        const rad = o.rr + (RING_OUTER - o.rr) * Math.pow(t, 0.92);
        const yy = 42.48 - 1.1 * t + 0.16 * Math.sin(Math.PI * t);
        positions.push(Math.sin(o.theta) * rad, yy, Math.cos(o.theta) * rad);
        uvs.push(s / (outline.length - 1) * 2.2, t);
      }
    }
    for (let s = 0; s < outline.length - 1; s++) {
      for (let r = 0; r < rows; r++) {
        const i0 = s * (rows + 1) + r;
        const i1 = i0 + 1;
        const i2 = i0 + rows + 1;
        const i3 = i2 + 1;
        indices.push(i0, i2, i1, i1, i2, i3);
      }
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    cg.setIndex(indices);
    cg.computeVertexNormals();
    coveGeos.push(cg);

    // The bracket fan: a horizontal chord under the balcony, a shorter
    // chord on the wall, and nine slender concrete struts between them.
    const chordY = 42.3;
    const chordR = 24.55;
    strutBatch.addBox(8.35, 0.3, 0.58,
      Math.sin(a) * chordR, chordY, Math.cos(a) * chordR, a);
    const wallChordY = 37.1;
    const wallChordR = shaftRadius(wallChordY) * Math.cos(Math.PI / SIDES) + 0.2;
    strutBatch.addBox(5.2, 0.4, 0.62,
      Math.sin(a) * wallChordR, wallChordY, Math.cos(a) * wallChordR, a);
    for (let i = 0; i < 9; i++) {
      const f = i / 8 - 0.5;
      const lat0 = f * 1.55;
      const lat1 = f * 7.55;
      const y0 = wallChordY + 0.12;
      const y1 = chordY - 0.1;
      const r0 = shaftRadius(y0) * Math.cos(Math.PI / SIDES) + 0.16;
      const r1 = chordR - 0.12;
      const p0 = new THREE.Vector3(
        Math.sin(a) * r0 + Math.cos(a) * lat0, y0,
        Math.cos(a) * r0 - Math.sin(a) * lat0
      );
      const p1 = new THREE.Vector3(
        Math.sin(a) * r1 + Math.cos(a) * lat1, y1,
        Math.cos(a) * r1 - Math.sin(a) * lat1
      );
      strutBatch.add(orientedBeam(p0, p1, 0.24, 0.55));
      // shallow pad where the bracket meets the wall
      trimB.addBox(0.46, 0.58, 0.16,
        Math.sin(a) * (r0 + 0.04), y0 - 0.2, Math.cos(a) * (r0 + 0.04),
        a);
    }

    // Continuous low curb along the outer edge, with a rounded cap.
    const curbPts = balconyOutline(0.16);
    for (let i = 0; i < curbPts.length - 1; i++) {
      const p0 = curbPts[i], p1 = curbPts[i + 1];
      const t0 = a + Math.atan2(p0.lx, p0.ly);
      const t1 = a + Math.atan2(p1.lx, p1.ly);
      const r0 = Math.hypot(p0.lx, p0.ly), r1 = Math.hypot(p1.lx, p1.ly);
      const x0 = Math.sin(t0) * r0, z0 = Math.cos(t0) * r0;
      const x1 = Math.sin(t1) * r1, z1 = Math.cos(t1) * r1;
      const dx = x1 - x0, dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      if (len < 0.02) continue;
      const yaw = Math.atan2(-dz, dx);
      const h = 0.24 + Math.sin(i * 1.7 + k) * 0.02;
      trimB.addBox(len + 0.03, h, 0.3,
        (x0 + x1) / 2, 44.14 + h / 2, (z0 + z1) / 2, yaw);
      trimB.addBox(len + 0.06, 0.07, 0.38,
        (x0 + x1) / 2, 44.14 + h + 0.035, (z0 + z1) / 2, yaw);
    }

    // concrete canopy above each balcony door
    trimB.addBox(2.7, 0.18, 0.58,
      Math.sin(a) * (DRUM_R + 0.29), 46.8, Math.cos(a) * (DRUM_R + 0.29), a);
  }
  const lobeMesh = lobeBatch.build('balconies');
  if (lobeMesh) group.add(lobeMesh);
  const strutMesh = strutBatch.build('cantilever-props');
  if (strutMesh) group.add(strutMesh);

  const coveGroup = new THREE.Group();
  coveGroup.name = 'soffits';
  for (const cg of coveGeos) {
    const mesh = new THREE.Mesh(cg, M.soffit);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    coveGroup.add(mesh);
  }
  group.add(coveGroup);

  // small corbels under the ring
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * Math.PI * 2;
    const r = shaftRadius(41.0);
    trimB.addBox(0.32, 0.55, 0.5,
      Math.sin(a) * (r + 0.22), 41.0, Math.cos(a) * (r + 0.22),
      a);
  }

  // Weep holes / vents in the band under the platform.
  for (let i = 0; i < SIDES; i++) {
    const a = i * (Math.PI * 2 / SIDES);
    const r = shaftRadius(41.35) + 0.03;
    darkB.addBox(0.34, 0.27, 0.055,
      Math.sin(a) * r, 41.35, Math.cos(a) * r, a);
  }

  /* ---------------- drum ---------------- */
  const drumGeo = buildHoleyShell({
    sides: DRUM_SIDES, angleOffset: 0, y0: 44.2, y1: 55.0,
    radius: drumRadius,
    topForSector: (i) => (NOTCH_SECTORS.has(i) ? ROOF_Y : 55.0),
    openings: drumOpenings,
    uvU: [0, 1], uvV: [0, 1],
  });
  smoothRadialNormals(drumGeo);
  const drumShell = new THREE.Mesh(drumGeo, M.drum);
  drumShell.name = 'drum';
  drumShell.castShadow = true; drumShell.receiveShadow = true;
  group.add(drumShell);

  // Twelve cables around the drum above the gun platform, the densest
  // surviving group on the Augarten tower.
  for (let i = 0; i < 12; i++) {
    const y = 45.25 + i * 0.725;
    const rr = DRUM_R + (17.95 - DRUM_R) * ((y - 44.2) / 10.8) + 0.045;
    addCableBand(y, rr, 0.04, DRUM_SIDES, metalB, 9, i * 3);
  }

  // narrow maintenance walkway around the drum base (also closes the shaft top)
  {
    const deck = new THREE.Mesh(new THREE.RingGeometry(17.86, 21.02, 48), M.trimDark);
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 44.12;
    deck.receiveShadow = true;
    group.add(deck);
    // a low edge lip
    const lip = new THREE.Mesh(buildProfileRing({
      sides: 16,
      profile: [
        { r: 20.92, y: 44.1 }, { r: 21.06, y: 44.1 },
        { r: 21.06, y: 44.35 }, { r: 20.92, y: 44.35 },
      ],
      uvScale: [6, 0.1],
    }), M.trim);
    lip.castShadow = true; lip.receiveShadow = true;
    group.add(lip);
  }

  // interior of the parapet (visible from the roof)
  const innerDrum = new THREE.Mesh(buildShell({
    sides: DRUM_SIDES, angleOffset: 0, y0: ROOF_Y, y1: 55.0,
    radius: () => DRUM_IN, rows: 2, cols: 2, inward: true,
    topForSector: (i) => (NOTCH_SECTORS.has(i) ? ROOF_Y + 0.01 : 55.0),
    uvU: [0, 1], uvV: [0, 1],
  }), M.drumInner);
  innerDrum.receiveShadow = true;
  group.add(innerDrum);

  // coping ring on the parapet
  const rim = new THREE.Mesh(buildProfileRing({
    sides: DRUM_SIDES,
    profile: [
      { r: DRUM_IN, y: ROOF_Y }, { r: 18.0, y: ROOF_Y }, { r: 18.0, y: 54.55 },
      { r: 17.82, y: RIM_TOP }, { r: DRUM_IN, y: RIM_TOP }, { r: DRUM_IN, y: ROOF_Y },
    ],
    skip: NOTCH_SECTORS,
    uvScale: [5, 0.8],
  }), M.rim);
  rim.castShadow = true; rim.receiveShadow = true;
  group.add(rim);

  // broken ledge where the parapet is missing
  const notchCenter = 28.125 * D2R;
  // Build a custom flat sector for exact world placement
  const ledgePositions = [], ledgeUvs = [], ledgeIndices = [];
  const notchStart = 16.875 * D2R, notchEnd = 39.375 * D2R;
  const nSteps = 12;
  for (let i = 0; i <= nSteps; i++) {
    const a = notchStart + (notchEnd - notchStart) * (i / nSteps);
    for (const [r, v] of [[DRUM_IN, 0], [17.99, 1]]) {
      ledgePositions.push(Math.sin(a) * r, ROOF_Y + 0.015, Math.cos(a) * r);
      ledgeUvs.push(i / nSteps, v);
    }
  }
  for (let i = 0; i < nSteps; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    // Wind upward: this ledge is seen from the roof, and a downward
    // winding made it invisible from above (a hole through the tower).
    ledgeIndices.push(a, b, c, b, d, c);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(ledgePositions, 3));
  lg.setAttribute('uv', new THREE.Float32BufferAttribute(ledgeUvs, 2));
  lg.setIndex(ledgeIndices);
  lg.computeVertexNormals();
  const ledge = new THREE.Mesh(lg, M.trimDark);
  ledge.receiveShadow = true;
  group.add(ledge);

  // Cut faces at both ends of the missing parapet.  Each face is a ragged
  // radial section: the coping and upper wall broke away at different
  // heights, so the silhouette steps down toward the gap.
  const cutProfile = [
    [-0.72, 54.52], [-0.58, 54.88], [-0.45, 54.58], [-0.28, 54.74],
    [-0.10, 54.26], [0.08, 54.62], [0.24, 54.36], [0.40, 54.68],
    [0.55, 54.44], [0.72, 54.84],
  ];
  for (const a of [notchStart, notchEnd]) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.74, ROOF_Y + 0.02);
    for (const [u, y] of cutProfile) shape.lineTo(u, y);
    shape.lineTo(0.74, ROOF_Y + 0.02);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.075, bevelEnabled: false });
    geo.translate(0, 0, -0.0375);
    // Normalised UVs so the trim texture does not stretch across the cut.
    const gp = geo.attributes.position, gu = geo.attributes.uv;
    for (let i = 0; i < gp.count; i++) {
      gu.setXY(i, (gp.getX(i) + 0.74) * 0.9, (gp.getY(i) - ROOF_Y) * 0.55);
    }
    gu.needsUpdate = true;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.sin(a) * 17.275, 0, Math.cos(a) * 17.275),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI / 2),
      new THREE.Vector3(1, 1, 1)
    );
    trimDarkB.add(geo, m);
  }

  // A few broken lumps at the foot of the cut faces, not a neat row of
  // white blocks along the whole ledge.
  {
    const rnd = mulberry(914);
    for (let i = 0; i < 5; i++) {
      const edge = i % 2 === 0 ? notchStart : notchEnd;
      const a = edge + (rnd() - 0.5) * 0.10;
      const r = 16.8 + rnd() * 0.9;
      trimDarkB.addBox(0.35 + rnd() * 0.55, 0.16 + rnd() * 0.22, 0.3 + rnd() * 0.45,
        Math.sin(a) * r, ROOF_Y + 0.08 + rnd() * 0.16, Math.cos(a) * r,
        a + (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.35, (rnd() - 0.5) * 0.45);
    }
  }

  // Low safety railing across the broken sector.  It is a post-war
  // addition, visible in the aerial photographs, and is deliberately
  // thin and dark so it does not read as a bright handrail.
  {
    const railR = 17.06;
    const railH = 1.06;
    const posts = 7;
    for (let i = 0; i < posts; i++) {
      const a = notchStart + (notchEnd - notchStart) * (i / (posts - 1));
      cableB.addBox(0.05, railH, 0.05,
        Math.sin(a) * railR, ROOF_Y + railH / 2, Math.cos(a) * railR, a);
    }
    for (const hy of [0.40, 0.72, 1.02]) {
      for (let i = 0; i < posts - 1; i++) {
        const a0 = notchStart + (notchEnd - notchStart) * (i / (posts - 1));
        const a1 = notchStart + (notchEnd - notchStart) * ((i + 1) / (posts - 1));
        const p0 = new THREE.Vector3(Math.sin(a0) * railR, ROOF_Y + hy, Math.cos(a0) * railR);
        const p1 = new THREE.Vector3(Math.sin(a1) * railR, ROOF_Y + hy, Math.cos(a1) * railR);
        cableB.add(beamGeometry(p0, p1, 0.036, 0.036));
      }
    }
  }

  // Exposed rebar, concentrated at the two broken ends.
  {
    const rnd = mulberry(72);
    for (let i = 0; i < 9; i++) {
      const edge = i % 2 === 0 ? notchStart : notchEnd;
      const a = edge + (rnd() - 0.5) * 0.13;
      const r = 16.75 + rnd() * 1.05;
      const y = ROOF_Y + 0.12 + rnd() * 0.35;
      const len = 0.3 + rnd() * 0.6;
      const p0 = new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
      const p1 = p0.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.45, len, (rnd() - 0.5) * 0.45));
      rustB.add(beamGeometry(p0, p1, 0.026, 0.026));
    }
  }

  /* ---------------- roof ---------------- */
  const roofShape = new THREE.Shape();
  const roofRadius = DRUM_IN - 0.02;
  for (let i = 0; i < DRUM_SIDES; i++) {
    const a = (i / DRUM_SIDES) * Math.PI * 2;
    const x = Math.sin(a) * roofRadius, z = Math.cos(a) * roofRadius;
    if (i === 0) roofShape.moveTo(x, -z); else roofShape.lineTo(x, -z);
  }
  roofShape.closePath();

  // Four round emplacements for the 12.8 cm twin mounts, set well out
  // toward the parapet, and one long central hoist/stair slot.
  const PIT_R = 2.72;
  const PIT_DIST = 11.4;
  const pitCenters = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const x = Math.sin(a) * PIT_DIST, z = Math.cos(a) * PIT_DIST;
    pitCenters.push({ x, z, a });
    const hole = new THREE.Path();
    hole.absarc(x, -z, PIT_R, 0, Math.PI * 2, true);
    roofShape.holes.push(hole);
  }
  const central = new THREE.Path();
  central.moveTo(-1.25, 3.75); central.lineTo(1.25, 3.75); central.lineTo(1.25, -3.75);
  central.lineTo(-1.25, -3.75); central.closePath();
  roofShape.holes.push(central);

  const roofGeo = new THREE.ShapeGeometry(roofShape, 48);
  roofGeo.rotateX(-Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, M.roof);
  roof.position.y = ROOF_Y;
  roof.receiveShadow = true;
  roof.castShadow = true;
  roof.name = 'roof';
  group.add(roof);

  // pit liners, floors and steel remains
  const waterDiscs = [];
  for (const pc of pitCenters) {
    const linerGeo = new THREE.CylinderGeometry(1, 1, 3.2, 32, 1, true);
    linerGeo.scale(PIT_R, 1, PIT_R);
    const liner = new THREE.Mesh(linerGeo, M.pit);
    liner.position.set(pc.x, ROOF_Y - 1.6, pc.z);
    liner.receiveShadow = true;
    group.add(liner);

    const floorGeo = new THREE.CircleGeometry(1, 32);
    floorGeo.scale(PIT_R, PIT_R, 1);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, M.interior);
    floor.position.set(pc.x, ROOF_Y - 3.19, pc.z);
    floor.receiveShadow = true;
    group.add(floor);

    // solid concrete curb around the pit, with a chamfered top
    const curb = new THREE.Mesh(buildProfileRing({
      sides: 48,
      profile: [
        { r: 3.16, y: 0 }, { r: 3.9, y: 0 }, { r: 3.9, y: 0.3 },
        { r: 3.66, y: 0.46 }, { r: 3.16, y: 0.46 }, { r: 3.16, y: 0 },
      ],
      uvScale: [6, 0.5],
    }), M.curb);
    curb.scale.set(PIT_R / 3.25, 1, PIT_R / 3.25);
    curb.position.set(pc.x, ROOF_Y, pc.z);
    curb.castShadow = true; curb.receiveShadow = true;
    group.add(curb);

    // straight inner revetment, split to leave the ammunition channel open
    for (const side of [-1, 1]) {
      trimB.addBox(1.55, 0.46, 0.32,
        Math.sin(pc.a) * 5.95 + Math.cos(pc.a) * side * 1.65,
        ROOF_Y + 0.23,
        Math.cos(pc.a) * 5.95 - Math.sin(pc.a) * side * 1.65,
        pc.a);
    }

    // dark steel remains inside the pit
    const steelRing = new THREE.Mesh(new THREE.TorusGeometry(PIT_R * 0.94, 0.07, 6, 32), M.steel);
    steelRing.rotation.x = Math.PI / 2;
    steelRing.position.set(pc.x, ROOF_Y - 1.15, pc.z);
    steelRing.castShadow = true;
    group.add(steelRing);
    for (let i = 0; i < 4; i++) {
      const ang = i * Math.PI / 2 + pc.a + 0.3;
      rustB.addBox(0.14, 0.1, 2.2,
        pc.x + Math.sin(ang) * PIT_R * 0.45, ROOF_Y - 1.13,
        pc.z + Math.cos(ang) * PIT_R * 0.45, ang);
    }

    const waterGeo = new THREE.CircleGeometry(1, 32);
    waterGeo.scale(PIT_R * 0.86, PIT_R * 0.86, 1);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, M.water);
    water.position.set(pc.x, ROOF_Y - 3.13, pc.z);
    water.receiveShadow = true;
    waterDiscs.push(water);
    group.add(water);
  }

  // Central hoist / stair slot: a long rectangular opening divided by a
  // concrete spine, with a raised collar, as on the real roof.
  {
    const halfW = 1.25, halfL = 3.75, depthY = 3.1;
    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, depthY, halfL * 2), M.interior);
      wall.position.set(sx * (halfW + 0.02), ROOF_Y - depthY / 2, 0);
      group.add(wall);
    }
    for (const sz of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, depthY, 0.08), M.interior);
      wall.position.set(0, ROOF_Y - depthY / 2, sz * (halfL + 0.02));
      group.add(wall);
    }
    const floor = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, 0.1, halfL * 2), M.interior);
    floor.position.set(0, ROOF_Y - depthY, 0);
    group.add(floor);
    // concrete spine between the two hoist shafts
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.24, depthY, halfL * 2 - 0.3), M.trimDark);
    spine.position.set(0, ROOF_Y - depthY / 2, 0);
    spine.castShadow = true;
    group.add(spine);
    // raised collar around the slot
    trimB.addBox(0.42, 0.62, halfL * 2 + 0.8, -halfW - 0.22, ROOF_Y + 0.31, 0);
    trimB.addBox(0.42, 0.62, halfL * 2 + 0.8, halfW + 0.22, ROOF_Y + 0.31, 0);
    trimB.addBox(halfW * 2 + 0.8, 0.62, 0.42, 0, ROOF_Y + 0.31, -halfL - 0.22);
    trimB.addBox(halfW * 2 + 0.8, 0.62, 0.42, 0, ROOF_Y + 0.31, halfL + 0.22);
  }

  // Open ammunition trenches from the central shaft toward the pits.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const midR = 6.45, trenchLen = 4.5;
    // dark floor and two low concrete cheeks
    darkB.addBox(1.26, 0.03, trenchLen, Math.sin(a) * midR, ROOF_Y + 0.025, Math.cos(a) * midR, a);
    for (const side of [-1, 1]) {
      trimB.addBox(0.2, 0.4, trenchLen + 0.05,
        Math.sin(a) * midR + Math.cos(a) * side * 0.68,
        ROOF_Y + 0.2,
        Math.cos(a) * midR - Math.sin(a) * side * 0.68,
        a);
    }
    // rusted steel grate bars across the trench
    for (let k = -1; k <= 1; k++) {
      const r = midR + k * 1.35;
      metalB.addBox(1.1, 0.035, 0.055, Math.sin(a) * r, ROOF_Y + 0.12, Math.cos(a) * r, a);
    }
  }

  // loose concrete and rusted steel on the deck
  {
    const rr = mulberry(5521);
    for (let i = 0; i < 40; i++) {
      const a = rr() * Math.PI * 2;
      const r = 5.8 + rr() * 10.0;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      let blocked = false;
      for (const pc of pitCenters) if (Math.hypot(x - pc.x, z - pc.z) < 3.8) blocked = true;
      if (blocked) continue;
      const s = 0.18 + rr() * 0.55;
      rubbleB.addBox(s, s * 0.35, s * 0.8,
        x, ROOF_Y + s * 0.18, z,
        rr() * Math.PI, rr() * 0.3, rr() * 0.3);
    }
    for (let i = 0; i < 14; i++) {
      const a = rr() * Math.PI * 2;
      const r = 6.5 + rr() * 8.5;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      let blocked = false;
      for (const pc of pitCenters) if (Math.hypot(x - pc.x, z - pc.z) < 3.8) blocked = true;
      if (blocked) continue;
      rustB.addBox(0.12 + rr() * 0.1, 0.09, 1.0 + rr() * 1.8,
        x, ROOF_Y + 0.1, z, rr() * Math.PI);
    }
  }

  /* ---------------- openings: frames and reveals ---------------- */
  function addOpening({
    angle, radius = DRUM_R, sides = DRUM_SIDES, y, w, h, lateral = 0, depth = 0.35,
    door = false, bars = false, frame = true, open = true,
  }) {
    // radius is the circumradius of the polygonal shell; openings sit on
    // the flat face, whose centre is closer to the axis by cos(pi/sides).
    const faceR = radius * Math.cos(Math.PI / sides);
    const base = faceMatrix(angle, faceR - 0.005, y);
    const mul = (m) => new THREE.Matrix4().multiplyMatrices(base, m);
    if (frame) {
      trimDarkB.add(new THREE.BoxGeometry(0.13, h + 0.28, 0.08), mul(localMat(lateral - w / 2 - 0.055, 0, 0.02)));
      trimDarkB.add(new THREE.BoxGeometry(0.13, h + 0.28, 0.08), mul(localMat(lateral + w / 2 + 0.055, 0, 0.02)));
      trimDarkB.add(new THREE.BoxGeometry(w + 0.28, 0.13, 0.08), mul(localMat(lateral, h / 2 + 0.065, 0.02)));
      trimDarkB.add(new THREE.BoxGeometry(w + 0.28, 0.13, 0.08), mul(localMat(lateral, -h / 2 - 0.065, 0.02)));
    }
    // reveals line the cut-out and give the opening real depth
    trimDarkB.add(new THREE.BoxGeometry(0.05, h, depth), mul(localMat(lateral - w / 2 + 0.02, 0, -depth / 2)));
    trimDarkB.add(new THREE.BoxGeometry(0.05, h, depth), mul(localMat(lateral + w / 2 - 0.02, 0, -depth / 2)));
    trimDarkB.add(new THREE.BoxGeometry(w, 0.05, depth), mul(localMat(lateral, h / 2 - 0.02, -depth / 2)));
    trimDarkB.add(new THREE.BoxGeometry(w, 0.05, depth), mul(localMat(lateral, -h / 2 + 0.02, -depth / 2)));
    // dark interior
    if (open) {
      darkB.add(new THREE.BoxGeometry(w - 0.02, h - 0.02, 0.06),
        mul(localMat(lateral, 0, -depth + 0.01)));
    }
    if (door) {
      rustB.add(new THREE.BoxGeometry(w - 0.08, h - 0.08, 0.09),
        mul(localMat(lateral, 0, -depth + 0.1)));
      metalB.add(new THREE.BoxGeometry(0.05, 0.32, 0.05),
        mul(localMat(lateral + w * 0.28, 0, -depth + 0.17)));
    }
    if (bars) {
      const n = Math.max(3, Math.round(w / 0.32));
      for (let i = 0; i < n; i++) {
        const x = lateral - w / 2 + 0.14 + (i / (n - 1)) * (w - 0.28);
        metalB.add(new THREE.BoxGeometry(0.025, h - 0.08, 0.025),
          mul(localMat(x, 0, -depth + 0.08)));
      }
      metalB.add(new THREE.BoxGeometry(w - 0.1, 0.03, 0.03),
        mul(localMat(lateral, 0, -depth + 0.08)));
    }
  }

  for (const spec of drumOpenings) addOpening(spec);
  for (const spec of shaftOpenings) addOpening(spec);

  /* ---------------- vertical services, ladder ---------------- */
  const pipeAngle = (deg) => deg * D2R;
  for (const [deg, r, y0, y1, rad] of [
    [70, DRUM_R, 45.3, 54.7, 0.055],
    [150, DRUM_R, 44.6, 54.7, 0.045],
    [295, DRUM_R, 44.6, 54.7, 0.05],
    [122, 21.2, 12.5, 41.2, 0.06],
    [244, 21.25, 18.0, 41.2, 0.05],
  ]) {
    const a = pipeAngle(deg);
    const geo = new THREE.CylinderGeometry(rad, rad, y1 - y0, 6);
    geo.translate(0, (y0 + y1) / 2, 0);
    metalB.add(geo, new THREE.Matrix4().makeTranslation(Math.sin(a) * (r + 0.08), 0, Math.cos(a) * (r + 0.08)));
    for (let y = y0 + 1.5; y < y1; y += 2.8) {
      const rr = deg === 122 || deg === 244 ? shaftRadius(y) : r;
      metalB.addBox(0.24, 0.05, 0.18, Math.sin(a) * (rr + 0.1), y, Math.cos(a) * (rr + 0.1), a);
    }
  }

  // maintenance ladder and landing on the south-west face
  {
    const a = -22.5 * D2R;
    const r = shaftRadius(36) + 0.25;
    const cx = Math.sin(a) * r, cz = Math.cos(a) * r;
    for (const side of [-0.28, 0.28]) {
      const tang = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(side);
      metalB.add(new THREE.BoxGeometry(0.055, 12.2, 0.055), new THREE.Matrix4().makeTranslation(
        cx + tang.x, 37.0, cz + tang.z
      ));
    }
    for (let i = 0; i < 35; i++) {
      const y = 31.0 + i * 0.335;
      const tang = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(cx, y, cz),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI / 2),
        new THREE.Vector3(1, 1, 1)
      );
      metalB.add(new THREE.BoxGeometry(0.62, 0.035, 0.035), m);
    }
    // landing
    const lm = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.sin(a) * (r + 0.5), 43.25, Math.cos(a) * (r + 0.5)),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a),
      new THREE.Vector3(1, 1, 1)
    );
    metalB.add(new THREE.BoxGeometry(1.3, 0.07, 0.8), lm);
    metalB.addBox(1.3, 0.05, 0.05, Math.sin(a) * (r + 1.25), 44.1, Math.cos(a) * (r + 1.25), a);
    for (const side of [-0.62, 0.62]) {
      metalB.addBox(0.04, 0.9, 0.04,
        Math.sin(a) * (r + 0.5) + Math.cos(a) * side, 43.7, Math.cos(a) * (r + 0.5) - Math.sin(a) * side, a);
    }
  }

  /* ---------------- entrance annex ---------------- */
  const annex = buildAnnex(M, G);
  annex.rotation.y = -Math.PI / 4;
  group.add(annex);

  const porch = buildPorch(M, G);
  group.add(porch);

  /* ---------------- base apron and debris ---------------- */
  const apron = new THREE.Mesh(new THREE.RingGeometry(21.42, 23.4, 64), M.apron);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = 0.035;
  apron.receiveShadow = true;
  group.add(apron);

  const rubbleRnd = mulberry(881);
  for (let i = 0; i < 16; i++) {
    const a = rubbleRnd() * Math.PI * 2;
    const r = 21.7 + rubbleRnd() * 1.3;
    const s = 0.1 + rubbleRnd() * 0.32;
    trimB.addBox(s, s * 0.55, s * 0.75,
      Math.sin(a) * r, s * 0.3, Math.cos(a) * r,
      rubbleRnd() * Math.PI, rubbleRnd() * 0.4, rubbleRnd() * 0.3);
  }

  /* ---------------- graffiti decals ---------------- */
  const decals = [];
  const shaftFaceR = (y) => shaftRadius(y) * Math.cos(Math.PI / SIDES);
  const decal = (tex, aDeg, radius, y, w, h, opacity = 1) => {
    const d = wallDecal(tex, aDeg * D2R, radius, y, w, h, opacity);
    // A whisper of self-illumination keeps the white paint legible where
    // the base of the tower sits in its own shadow.
    d.material.emissive = new THREE.Color(0xffffff);
    d.material.emissiveMap = tex;
    d.material.emissiveIntensity = 0.14;
    group.add(d);
    decals.push(d);
  };
  decal(G.never, -22.5, shaftFaceR(2.4) + 0.03, 2.15, 7.2, 2.9, 1);
  decal(G.again, 22.5, shaftFaceR(2.2) + 0.03, 2.15, 7.2, 2.9, 1);
  decal(G.wild, 45, shaftFaceR(2.2) + 0.03, 1.95, 7.1, 3.25, 0.92);
  decal(G.tags, 67.5, shaftFaceR(1.5) + 0.03, 1.35, 5.3, 1.95, 0.9);
  decal(G.pink, 90, shaftFaceR(1.5) + 0.03, 1.55, 2.8, 2.8, 0.9);
  decal(G.tags, 292.5, shaftFaceR(1.4) + 0.03, 1.2, 4.0, 1.5, 0.8);

  // The break exposes bare concrete and rubble, not a painted surface.
  // A dark damp patch inside the parapet is enough to read the depth.

  /* ---------------- batches ---------------- */
  const trimMesh = trimB.build('concrete-details');
  if (trimMesh) group.add(trimMesh);
  const trimDarkMesh = trimDarkB.build('concrete-dark');
  if (trimDarkMesh) group.add(trimDarkMesh);
  const rubbleMesh = rubbleB.build('roof-rubble');
  if (rubbleMesh) group.add(rubbleMesh);
  const darkMesh = darkB.build('interiors');
  if (darkMesh) group.add(darkMesh);
  const metalMesh = metalB.build('metalwork');
  if (metalMesh) group.add(metalMesh);
  const cableMesh = cableB.build('notch-cables');
  if (cableMesh) group.add(cableMesh);
  const rustMesh = rustB.build('rusted-metal');
  if (rustMesh) group.add(rustMesh);

  // rooftop weeds and moss patches
  const tufts = new THREE.Group();
  tufts.name = 'roof-weeds';
  const trnd = mulberry(1001);
  for (let i = 0; i < 28; i++) {
    const a = trnd() * Math.PI * 2;
    const r = 5.5 + trnd() * 10.2;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    let insidePit = false;
    for (const pc of pitCenters) if (Math.hypot(x - pc.x, z - pc.z) < 3.5) insidePit = true;
    if (insidePit) continue;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.65), M.weed);
    plane.position.set(x, ROOF_Y + 0.35, z);
    plane.rotation.y = trnd() * Math.PI;
    plane.castShadow = true;
    tufts.add(plane);
    const plane2 = plane.clone();
    plane2.rotation.y += Math.PI / 2;
    tufts.add(plane2);
  }
  // grass encroaching from the parapet edge, but not on the exposed ledge
  // of the broken sector where the reference shows bare concrete.
  for (let i = 0; i < 11; i++) {
    const a = trnd() * Math.PI * 2;
    if (a > notchStart - 0.06 && a < notchEnd + 0.06) continue;
    const r = 14.7 + trnd() * 1.4;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.55), M.weed);
    plane.position.set(Math.sin(a) * r, ROOF_Y + 0.3, Math.cos(a) * r);
    plane.rotation.y = trnd() * Math.PI;
    plane.castShadow = true;
    tufts.add(plane);
  }
  // vegetation colonising the pit aprons
  for (const pc of pitCenters) {
    for (let k = 0; k < 5; k++) {
      const ang = trnd() * Math.PI * 2;
      const r = 3.3 + trnd() * 0.5;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.42), M.weed);
      plane.position.set(pc.x + Math.sin(ang) * r, ROOF_Y + 0.26, pc.z + Math.cos(ang) * r);
      plane.rotation.y = trnd() * Math.PI;
      plane.castShadow = true;
      tufts.add(plane);
    }
  }
  group.add(tufts);

  /* ---------------- hotspots ---------------- */
  const hs = (aDeg, r, y) => new THREE.Vector3(Math.sin(aDeg * D2R) * r, y, Math.cos(aDeg * D2R) * r);
  const hotspots = [
    { id: 'facade', label: 'The wall', short: 'Facade', position: hs(10, 21.4, 27) },
    { id: 'props', label: 'Cantilever props', short: 'Props', position: hs(45, 24.6, 39.6) },
    { id: 'balcony', label: 'Light-flak balcony', short: 'Balcony', position: hs(90, 25.9, 44.7) },
    { id: 'roof', label: 'Gun platform', short: 'Roof', position: new THREE.Vector3(0, 55.7, 14.2) },
    { id: 'notch', label: 'The broken parapet', short: 'Damage', position: hs(28, 17.4, 54.7) },
    { id: 'entrance', label: 'Entrance', short: 'Entrance', position: new THREE.Vector3(0, 2.6, 23.3) },
  ];

  return { group, hotspots, decals };
}

/* ------------------------------------------------------------------ *
 *  The low entrance annex at about -45°, to the left of NEVER.
 * ------------------------------------------------------------------ */
function buildAnnex(M, G) {
  const g = new THREE.Group();
  g.name = 'entrance-annex';
  const batch = new Batch(M.annex);
  const dark = new Batch(M.interior, { shadow: false });
  const metal = new Batch(M.rust);

  const z0 = 20.3, z1 = 25.3, halfW = 3.3, wallH = 3.6, t = 0.35;
  // front wall, with a narrow recessed vent near the top
  batch.addBox(halfW * 2, wallH, t, 0, wallH / 2, z1 - t / 2);
  // sides
  batch.addBox(t, wallH, z1 - z0, -halfW + t / 2, wallH / 2, (z0 + z1) / 2);
  batch.addBox(t, wallH, z1 - z0, halfW - t / 2, wallH / 2, (z0 + z1) / 2);
  // flat roof with a small overhang
  batch.addBox(halfW * 2 + 0.34, 0.3, z1 - z0 + 0.3, 0, wallH + 0.15, (z0 + z1) / 2 + 0.05);
  // threshold
  batch.addBox(2.0, 0.18, 0.6, 1.25, 0.09, z1 + 0.25);

  // recessed vent on the south face
  dark.addBox(0.5, 1.05, 0.06, 0.9, 2.5, z1 + 0.015);
  batch.addBox(0.68, 1.23, 0.12, 0.9, 2.5, z1 - 0.04);

  // steel door on the east side, facing the main porch
  dark.addBox(0.06, 2.3, 1.1, halfW + 0.015, 1.15, 23.15);
  metal.addBox(0.06, 2.24, 1.02, halfW + 0.035, 1.12, 23.15);
  batch.addBox(0.16, 2.5, 0.18, halfW + 0.02, 1.25, 23.15 - 0.62);
  batch.addBox(0.16, 2.5, 0.18, halfW + 0.02, 1.25, 23.15 + 0.62);
  batch.addBox(0.16, 0.2, 1.42, halfW + 0.02, 2.55, 23.15);
  metal.addBox(0.05, 0.3, 0.05, halfW + 0.07, 1.3, 23.5);

  // conduit and a small junction box
  metal.addBox(0.035, 2.8, 0.035, 2.55, 1.5, z1 + 0.02);
  batch.addBox(0.42, 0.55, 0.24, -2.4, 0.6, z1 + 0.08);

  const mesh = batch.build('annex-concrete');
  if (mesh) { mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); }
  const dmesh = dark.build('annex-dark');
  if (dmesh) g.add(dmesh);
  const mmesh = metal.build('annex-metal');
  if (mmesh) g.add(mmesh);

  // graffiti on the front and the east side
  const tags = wallDecal(G.tags, 0, z1 + 0.02, 1.25, 2.8, 1.0, 0.85);
  tags.position.set(-1.45, 1.25, z1 + 0.02);
  tags.rotation.set(0, 0, 0);
  g.add(tags);
  const stencil = wallDecal(G.stencil, 0, z1 + 0.015, 1.55, 1.9, 0.9, 0.8);
  stencil.position.set(1.75, 1.55, z1 + 0.015);
  stencil.rotation.set(0, 0, 0);
  g.add(stencil);
  const pink = wallDecal(G.pink, 0, halfW + 0.01, 1.2, 1.4, 1.4, 0.65);
  pink.position.set(halfW + 0.01, 1.2, 21.4);
  pink.rotation.set(0, Math.PI / 2, 0);
  g.add(pink);

  return g;
}

/* ------------------------------------------------------------------ *
 *  Small entrance porch on the +Z face, between NEVER and AGAIN.
 * ------------------------------------------------------------------ */
function buildPorch(M, G) {
  const g = new THREE.Group();
  g.name = 'entrance-porch';
  const batch = new Batch(M.annex);
  const dark = new Batch(M.interior, { shadow: false });
  const metal = new Batch(M.rust);

  const z0 = 20.7, z1 = 22.5, halfW = 2.15, wallH = 3.0, t = 0.32;
  // side cheeks
  batch.addBox(t, wallH, z1 - z0, -halfW + t / 2, wallH / 2, (z0 + z1) / 2);
  batch.addBox(t, wallH, z1 - z0, halfW - t / 2, wallH / 2, (z0 + z1) / 2);
  // flat canopy
  batch.addBox(halfW * 2 + 0.3, 0.28, z1 - z0 + 0.28, 0, wallH + 0.14, (z0 + z1) / 2 + 0.04);
  // lintel above the door
  batch.addBox(halfW * 2 - 0.2, 0.5, t, 0, wallH - 0.25, z1 - t / 2);
  // steps
  batch.addBox(2.5, 0.16, 0.65, 0, 0.08, z1 + 0.33);
  batch.addBox(2.25, 0.14, 0.5, 0, 0.22, z1 + 0.02);

  // recessed double door
  dark.addBox(1.9, 2.4, 0.06, 0, 1.2, z1 - 0.26);
  metal.addBox(0.92, 2.32, 0.07, -0.48, 1.16, z1 - 0.2);
  metal.addBox(0.92, 2.32, 0.07, 0.48, 1.16, z1 - 0.2);
  batch.addBox(0.15, 2.6, 0.2, -1.03, 1.3, z1 - 0.16);
  batch.addBox(0.15, 2.6, 0.2, 1.03, 1.3, z1 - 0.16);
  batch.addBox(2.2, 0.16, 0.2, 0, 2.52, z1 - 0.16);
  metal.addBox(0.05, 0.3, 0.05, -0.12, 1.3, z1 - 0.1);
  metal.addBox(0.05, 0.3, 0.05, 0.12, 1.3, z1 - 0.1);
  // lamp above the door
  metal.addBox(0.34, 0.12, 0.18, 0, 2.72, z1 + 0.02);

  const mesh = batch.build('porch-concrete');
  if (mesh) { mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); }
  const dmesh = dark.build('porch-dark');
  if (dmesh) g.add(dmesh);
  const mmesh = metal.build('porch-metal');
  if (mmesh) g.add(mmesh);

  const tags = wallDecal(G.tags, -Math.PI / 2, halfW + 0.02, 1.3, 1.7, 0.7, 0.75);
  tags.position.set(-halfW - 0.02, 1.3, 21.6);
  tags.rotation.set(0, -Math.PI / 2, 0);
  g.add(tags);

  return g;
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
