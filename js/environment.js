import * as THREE from 'three';
import {
  createGrassTextures, createGravelTextures, createBarkTexture, createLeafTexture,
  createGrassTuftTexture, createChainlinkTexture, createSignTexture, createWarningTexture,
  createFacadeBuildingTexture,
} from './tex-scene.js';
import { Batch, beamGeometry, makeMetalMaterial, TAU } from './geo-utils.js';
import { makeCanvas, ctx2d, canvasTexture, mulberry32 } from './tex-utils.js';

/* ------------------------------------------------------------------ *
 *  The Augarten setting: lawn, circular gravel walk, allées, fence,
 *  park furniture, mature trees and the distant Viennese city.
 *  North is -Z, east is +X.
 * ------------------------------------------------------------------ */

const FENCE_R = 29.6;
const PATH_IN = 33.0;
const PATH_OUT = 37.0;
const GATE_HALF = 0.095; // radians of the circular fence left open for the gate

function flatRing(inner, outer, y, segments = 128, uvScale = 0.32) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const s = Math.sin(a), c = Math.cos(a);
    for (const r of [inner, outer]) {
      const x = s * r, z = c * r;
      pos.push(x, y, z);
      uv.push(x * uvScale, z * uvScale);
    }
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function flatRect(x0, z0, x1, z1, y, uvScale = 0.32) {
  const g = new THREE.BufferGeometry();
  const pos = [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1];
  const uv = [
    x0 * uvScale, z0 * uvScale, x1 * uvScale, z0 * uvScale,
    x1 * uvScale, z1 * uvScale, x0 * uvScale, z1 * uvScale,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return g;
}

function makeLawnOverlayTexture() {
  const S = 1024;
  const c = makeCanvas(S, S), ctx = ctx2d(c);
  // soft, wide mowing stripes
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(-0.42);
  const band = S / 18;
  for (let i = -24; i < 24; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(240,238,213,0.085)' : 'rgba(20,30,15,0.07)';
    ctx.fillRect(-S, i * band, S * 2, band);
  }
  ctx.restore();
  const rnd = mulberry32(422);
  for (let i = 0; i < 80; i++) {
    const x = rnd() * S, y = rnd() * S, r = 18 + rnd() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() < 0.5;
    g.addColorStop(0, dark ? 'rgba(25,36,18,0.1)' : 'rgba(225,220,180,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return canvasTexture(c, { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
}

export function buildEnvironment() {
  const group = new THREE.Group();
  group.name = 'Augarten';

  const rnd = mulberry32(20240519);

  /* ---------------- ground ---------------- */
  const grass = createGrassTextures();
  grass.map.repeat.set(130, 130);
  grass.bumpMap.repeat.set(130, 130);
  const grassMat = new THREE.MeshStandardMaterial({
    map: grass.map, bumpMap: grass.bumpMap, bumpScale: 0.06,
    roughness: 1, metalness: 0, envMapIntensity: 0.25,
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(520, 128), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'lawn';
  group.add(ground);

  const outer = new THREE.Mesh(
    new THREE.CircleGeometry(4500, 64),
    new THREE.MeshStandardMaterial({ color: 0x55613f, roughness: 1, metalness: 0 })
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.08;
  group.add(outer);

  const lawnOverlay = new THREE.Mesh(
    new THREE.PlaneGeometry(430, 430),
    new THREE.MeshBasicMaterial({
      map: makeLawnOverlayTexture(), transparent: true, opacity: 0.46,
      depthWrite: false, toneMapped: false,
    })
  );
  lawnOverlay.rotation.x = -Math.PI / 2;
  lawnOverlay.position.y = 0.012;
  lawnOverlay.renderOrder = 1;
  group.add(lawnOverlay);

  /* ---------------- paths ---------------- */
  const gravel = createGravelTextures();
  gravel.map.repeat.set(1, 1);
  gravel.bumpMap.repeat.set(1, 1);
  const gravelMat = new THREE.MeshStandardMaterial({
    map: gravel.map, bumpMap: gravel.bumpMap, bumpScale: 0.045,
    roughness: 0.98, metalness: 0, envMapIntensity: 0.25,
    color: 0xf3eee3,
  });
  const pathMat = gravelMat;
  pathMat.side = THREE.DoubleSide;

  const ringPath = new THREE.Mesh(flatRing(PATH_IN, PATH_OUT, 0.025, 160), pathMat);
  ringPath.receiveShadow = true;
  ringPath.name = 'circular-walk';
  group.add(ringPath);

  const southWalk = new THREE.Mesh(flatRect(-5.4, 34.2, 5.4, 188, 0.022), pathMat);
  southWalk.receiveShadow = true;
  southWalk.name = 'south-allee-walk';
  group.add(southWalk);

  const eastWalk = new THREE.Mesh(flatRect(41.4, -158, 50.6, 158, 0.022), pathMat);
  eastWalk.receiveShadow = true;
  eastWalk.name = 'east-allee-walk';
  group.add(eastWalk);

  const westWalk = new THREE.Mesh(flatRect(-112, -13.2, -36.4, -7.4, 0.022), pathMat);
  westWalk.receiveShadow = true;
  westWalk.name = 'west-walk';
  group.add(westWalk);

  const eastLink = new THREE.Mesh(flatRect(36.8, 4.2, 41.6, 9.8, 0.022), pathMat);
  eastLink.receiveShadow = true;
  group.add(eastLink);

  // short approach from the gate to the circular walk
  const gateWalk = new THREE.Mesh(flatRect(-2.25, 29.2, 2.25, 33.4, 0.024), pathMat);
  gateWalk.receiveShadow = true;
  group.add(gateWalk);

  // pale stone edging on the circular walk
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xb6ae9d, roughness: 1, metalness: 0, envMapIntensity: 0.22,
  });
  for (const [a, b] of [[PATH_IN - 0.15, PATH_IN], [PATH_OUT, PATH_OUT + 0.15]]) {
    const curb = new THREE.Mesh(flatRing(a, b, 0.055, 160), stoneMat);
    curb.receiveShadow = true;
    group.add(curb);
  }
  for (const [x0, x1] of [[-5.55, -5.4], [5.4, 5.55]]) {
    const c = new THREE.Mesh(flatRect(x0, 37.0, x1, 188, 0.052), stoneMat);
    c.receiveShadow = true;
    group.add(c);
  }

  /* ---------------- chain-link enclosure and gate ---------------- */
  const chainTex = createChainlinkTexture();
  chainTex.repeat.set(3.2, 2.6);
  const chainMat = new THREE.MeshStandardMaterial({
    map: chainTex,
    alphaTest: 0.22,
    side: THREE.DoubleSide,
    roughness: 0.7,
    metalness: 0.25,
    color: 0x7c887a,
    envMapIntensity: 0.35,
  });
  const fenceB = new Batch(chainMat, { shadow: false, receive: false });
  const fenceMetal = new Batch(makeMetalMaterial(0x4a5446, 0.66), { shadow: true, receive: true });

  const panels = 48;
  for (let i = 0; i < panels; i++) {
    const a0 = (i / panels) * TAU;
    const a1 = ((i + 1) / panels) * TAU;
    const am = (a0 + a1) / 2;
    const gap = Math.abs(Math.atan2(Math.sin(am), Math.cos(am))) < GATE_HALF;
    if (gap) continue;
    const len = 2 * FENCE_R * Math.tan(Math.PI / panels);
    const geo = new THREE.PlaneGeometry(len, 2.28);
    geo.translate(0, 1.18, 0);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.sin(am) * FENCE_R, 0, Math.cos(am) * FENCE_R),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), am),
      new THREE.Vector3(1, 1, 1)
    );
    fenceB.add(geo, m);
    // rails
    for (const yy of [0.08, 2.34]) {
      const p0 = new THREE.Vector3(Math.sin(a0) * FENCE_R, yy, Math.cos(a0) * FENCE_R);
      const p1 = new THREE.Vector3(Math.sin(a1) * FENCE_R, yy, Math.cos(a1) * FENCE_R);
      fenceMetal.add(beamGeometry(p0, p1, 0.045, 0.045));
    }
  }
  for (let i = 0; i < panels; i++) {
    const a = (i / panels) * TAU;
    const gap = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < GATE_HALF;
    if (gap) continue;
    const x = Math.sin(a) * FENCE_R, z = Math.cos(a) * FENCE_R;
    const post = new THREE.CylinderGeometry(0.045, 0.052, 2.46, 6);
    post.translate(0, 1.23, 0);
    fenceMetal.add(post, new THREE.Matrix4().makeTranslation(x, 0, z));
    // concrete post shoe
    fenceMetal.addBox(0.14, 0.2, 0.14, x, 0.1, z, a);
  }
  const fenceMesh = fenceB.build('fence-chainlink');
  if (fenceMesh) group.add(fenceMesh);
  const fenceMetalMesh = fenceMetal.build('fence-metal');
  if (fenceMetalMesh) group.add(fenceMetalMesh);

  // double gate, closed, with a heavy chain
  const gate = buildGate(chainMat, makeMetalMaterial(0x4a5446, 0.62));
  group.add(gate);

  // Warning notices on the fence
  const warningTex = createWarningTexture();
  const warningMat = new THREE.MeshStandardMaterial({
    map: warningTex, roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide,
  });
  for (const [deg, r = FENCE_R] of [[-56, FENCE_R], [61, FENCE_R], [-129, FENCE_R], [128, FENCE_R]]) {
    const a = THREE.MathUtils.degToRad(deg);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.5), warningMat);
    plane.position.set(Math.sin(a) * (r + 0.045), 1.45, Math.cos(a) * (r + 0.045));
    plane.rotation.y = a;
    group.add(plane);
  }

  /* ---------------- interpretive panel ---------------- */
  const signTex = createSignTexture();
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex, roughness: 0.72, metalness: 0.12, side: THREE.DoubleSide,
  });
  const signGroup = new THREE.Group();
  {
    const a = THREE.MathUtils.degToRad(-24);
    const r = 30.9;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 1.77), signMat);
    board.position.set(0, 2.2, 0);
    signGroup.add(board);
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 1.85, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x282a25, roughness: 0.8, metalness: 0.3 })
    );
    back.position.set(0, 2.2, -0.05);
    signGroup.add(back);
    for (const sx of [-0.48, 0.48]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.05, 2.55, 6),
        new THREE.MeshStandardMaterial({ color: 0x30332c, roughness: 0.7, metalness: 0.4 })
      );
      post.position.set(sx, 1.27, 0.02);
      post.castShadow = true;
      signGroup.add(post);
    }
    signGroup.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    signGroup.rotation.y = a + 0.12;
    signGroup.name = 'interpretive-panel';
    signGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(signGroup);
  }

  /* ---------------- trees ---------------- */
  const barkTex = createBarkTexture();
  barkTex.map.repeat.set(2, 3);
  const barkMat = new THREE.MeshStandardMaterial({
    map: barkTex.map, color: 0xb6ad98, roughness: 1, metalness: 0,
    envMapIntensity: 0.15,
  });
  const barkDark = new THREE.MeshStandardMaterial({
    map: barkTex.map, color: 0x7f705c, roughness: 1, metalness: 0,
    envMapIntensity: 0.15,
  });
  const trunkB = new Batch(barkMat, { shadow: true, receive: true });
  const trunkDarkB = new Batch(barkDark, { shadow: true, receive: true });

  const leafGreen = new Batch(
    new THREE.MeshStandardMaterial({
      map: createLeafTexture('green', 1.4), alphaTest: 0.3, side: THREE.DoubleSide,
      color: 0xe9f0df, roughness: 1, metalness: 0, envMapIntensity: 0.2,
    }),
    { shadow: true, receive: true }
  );
  const leafGold = new Batch(
    new THREE.MeshStandardMaterial({
      map: createLeafTexture('gold', 1.4), alphaTest: 0.3, side: THREE.DoubleSide,
      color: 0xfff2d0, roughness: 1, metalness: 0, envMapIntensity: 0.2,
    }),
    { shadow: true, receive: true }
  );
  const leafCopper = new Batch(
    new THREE.MeshStandardMaterial({
      map: createLeafTexture('copper', 1.4), alphaTest: 0.3, side: THREE.DoubleSide,
      color: 0xffe8d4, roughness: 1, metalness: 0, envMapIntensity: 0.2,
    }),
    { shadow: true, receive: true }
  );

  const treeRnd = mulberry32(77441);
  let seed = 400;
  const leafBatches = [leafGreen, leafGold, leafCopper];

  function addTree(x, z, height, crownR, kind = 'green', density = 1) {
    const local = mulberry32(seed++);
    const trunkH = height * (0.36 + local() * 0.08);
    const baseR = 0.26 + height * 0.018;
    const topR = baseR * 0.5;
    const barkBatch = local() < 0.55 ? trunkB : trunkDarkB;
    const trunkGeo = new THREE.CylinderGeometry(topR, baseR, trunkH, 8, 1);
    trunkGeo.translate(0, trunkH / 2, 0);
    const trunkMat = new THREE.Matrix4().compose(
      new THREE.Vector3(x, 0, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), local() * TAU),
      new THREE.Vector3(1, 1, 1)
    );
    barkBatch.add(trunkGeo, trunkMat);

    // a few visible limbs, carrying the crown
    const crownC = new THREE.Vector3(x, trunkH + crownR * 0.82, z);
    for (let i = 0; i < 4; i++) {
      const a = local() * TAU + i * 1.6;
      const p0 = new THREE.Vector3(
        x + Math.cos(a) * baseR * 0.25, trunkH * (0.78 + local() * 0.12),
        z + Math.sin(a) * baseR * 0.25
      );
      const p1 = new THREE.Vector3(
        x + Math.cos(a) * crownR * (0.42 + local() * 0.26),
        crownC.y - crownR * (0.25 + local() * 0.3),
        z + Math.sin(a) * crownR * (0.42 + local() * 0.26)
      );
      barkBatch.add(beamGeometry(p0, p1, baseR * 0.35, baseR * 0.35));
    }

    // Many small, crossed leaf cards make a fuller crown with leaves at
    // a believable scale; a few huge billboards read as cut-outs.
    const batch = kind === 'gold' ? leafGold : kind === 'copper' ? leafCopper : leafGreen;
    const clusters = Math.max(18, Math.round(34 * density));
    for (let i = 0; i < clusters; i++) {
      const a = local() * TAU;
      const rr = Math.sqrt(local()) * crownR * 0.66;
      const cx = x + Math.cos(a) * rr;
      const cz = z + Math.sin(a) * rr;
      const cy = crownC.y + (local() - 0.5) * crownR * 1.0;
      const size = crownR * (0.55 + local() * 0.5);
      const yaw = local() * TAU;
      for (let k = 0; k < 2; k++) {
        const g = new THREE.PlaneGeometry(size, size * (0.82 + local() * 0.28));
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          (local() - 0.5) * 0.2,
          yaw + k * Math.PI / 2 + (local() - 0.5) * 0.32,
          (local() - 0.5) * 0.18,
          'YXZ'
        ));
        const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(1, 1, 1));
        batch.add(g, m);
      }
    }
    return { x, z, height, crownR };
  }

  // The south approach in the Augarten is open lawn, not a formal allée:
  // keep the central view of the tower clear and let the park edge frame it.
  for (const [deg, r, h, kind] of [
    [315, 46, 20.5, 'copper'], [45, 47, 21.0, 'gold'],
    [303, 62, 19.0, 'green'], [57, 63, 20.0, 'copper'],
  ]) {
    const a = THREE.MathUtils.degToRad(deg);
    addTree(Math.sin(a) * r, Math.cos(a) * r, h, h * (0.24 + treeRnd() * 0.025), kind);
  }

  // the long east allée
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 16; i++) {
      const z = -136 + i * 18 + (treeRnd() - 0.5) * 1.8;
      const x = 46 + side * 7.3 + (treeRnd() - 0.5) * 0.8;
      const h = 16 + treeRnd() * 5;
      addTree(x, z, h, h * (0.23 + treeRnd() * 0.03),
        i % 4 === 0 ? 'copper' : i % 3 === 0 ? 'gold' : 'green');
    }
  }

  // free-standing mature park trees
  const scattered = [
    [318, 64, 22.5, 'copper'], [54, 50, 21.0, 'copper'], [72, 59, 19.0, 'gold'],
    [104, 53, 23.0, 'green'], [132, 66, 21.0, 'green'], [158, 51, 19.5, 'gold'],
    [184, 62, 23.0, 'green'], [208, 58, 20.0, 'gold'], [232, 67, 22.0, 'green'],
    [260, 54, 21.5, 'green'], [286, 61, 19.5, 'copper'], [310, 55, 20.0, 'gold'],
    [344, 67, 21.0, 'green'], [38, 77, 20.0, 'green'], [90, 85, 22.0, 'green'],
    [148, 86, 21.0, 'copper'], [196, 88, 22.5, 'green'], [248, 83, 20.5, 'gold'],
    [300, 84, 22.0, 'green'],
  ];
  for (const [deg, r, h, kind] of scattered) {
    const a = THREE.MathUtils.degToRad(deg);
    addTree(Math.sin(a) * r, Math.cos(a) * r, h, h * (0.23 + treeRnd() * 0.03), kind);
  }

  // a looser ring of trees toward the park edge
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + treeRnd() * 0.15;
    const r = 104 + treeRnd() * 105;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.32) continue;
    const h = 14 + treeRnd() * 7;
    addTree(Math.sin(a) * r, Math.cos(a) * r, h, h * (0.24 + treeRnd() * 0.04),
      i % 4 === 0 ? 'gold' : i % 5 === 0 ? 'copper' : 'green', 0.7);
  }

  // Dense tree line on the park boundary.  It hides the foot of the
  // distant city and gives the lawn a believable horizon instead of a
  // row of apparently floating blocks.
  for (let i = 0; i < 220; i++) {
    const a = (i / 220) * TAU + (treeRnd() - 0.5) * 0.03;
    const r = 488 + treeRnd() * 30;
    const h = 15 + treeRnd() * 10;
    addTree(Math.sin(a) * r, Math.cos(a) * r, h, h * (0.3 + treeRnd() * 0.06),
      i % 6 === 0 ? 'gold' : i % 9 === 0 ? 'copper' : 'green', 0.56);
  }
  // A second, lower row inside the boundary closes the gaps between
  // trunks without hiding the skyline completely.
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * TAU + 0.035 + (treeRnd() - 0.5) * 0.04;
    const r = 462 + treeRnd() * 24;
    const h = 12 + treeRnd() * 8;
    addTree(Math.sin(a) * r, Math.cos(a) * r, h, h * (0.28 + treeRnd() * 0.05),
      i % 7 === 0 ? 'gold' : i % 11 === 0 ? 'copper' : 'green', 0.5);
  }

  for (const b of [trunkB, trunkDarkB, leafGreen, leafGold, leafCopper]) {
    const mesh = b.build('park-vegetation');
    if (mesh) group.add(mesh);
  }

  /* ---------------- ivy on the tower ---------------- */
  const ivyMat = new THREE.MeshStandardMaterial({
    map: createLeafTexture('copper', 1.7), alphaTest: 0.3, side: THREE.DoubleSide,
    color: 0xcbb6a2, roughness: 1, metalness: 0, envMapIntensity: 0.16,
  });
  const ivyB = new Batch(ivyMat, { shadow: false, receive: true });
  const ivyStemMat = new THREE.MeshStandardMaterial({
    color: 0x4b3b27, roughness: 0.96, metalness: 0, envMapIntensity: 0.12,
  });
  const ivyStemB = new Batch(ivyStemMat, { shadow: false, receive: true });
  const ivyRnd = mulberry32(55);
  const towerR = (y) => 21.5 + (20.95 - 21.5) * (y / 44.2);
  const towerFaceR = (y) => towerR(y) * Math.cos(Math.PI / 16);

  // A broad, irregular mat of small leaf clumps hugging the flat face,
  // with a few stems and a narrower crown reaching up the wall.
  function ivyPatch(deg, y0, y1, width, cards, density = 1) {
    const a = THREE.MathUtils.degToRad(deg);
    for (let i = 0; i < cards; i++) {
      const t = Math.pow(ivyRnd(), 0.82);
      const y = y0 + (y1 - y0) * t;
      const crown = 0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.08));
      const off = (ivyRnd() - 0.5) * width * crown;
      const rr = towerFaceR(y) + 0.035 + ivyRnd() * 0.06;
      const x = Math.sin(a) * rr + Math.cos(a) * off;
      const z = Math.cos(a) * rr - Math.sin(a) * off;
      const size = (0.34 + ivyRnd() * 0.56) * density;
      const tilt = (ivyRnd() - 0.5) * 0.5;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, tilt, 'YXZ'));
      const g = new THREE.PlaneGeometry(size, size * (1.0 + ivyRnd() * 0.55));
      ivyB.add(g, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)));
      if (ivyRnd() < 0.5) {
        const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a + Math.PI / 2, tilt * 0.5, 'YXZ'));
        const g2 = new THREE.PlaneGeometry(size * 0.9, size * (0.9 + ivyRnd() * 0.5));
        ivyB.add(g2, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q2, new THREE.Vector3(1, 1, 1)));
      }
    }
    // woody stems behind the leaves
    const stems = Math.max(4, Math.round(width * 2.2));
    for (let s = 0; s < stems; s++) {
      const off = (s / (stems - 1) - 0.5) * width * 0.8;
      let py = y0;
      let poff = off;
      for (let seg = 0; seg < 4; seg++) {
        const ny = y0 + (y1 - y0) * ((seg + 1) / 4);
        const noff = off + (ivyRnd() - 0.5) * 0.35;
        const p0 = new THREE.Vector3(
          Math.sin(a) * (towerFaceR(py) + 0.02) + Math.cos(a) * poff, py,
          Math.cos(a) * (towerFaceR(py) + 0.02) - Math.sin(a) * poff
        );
        const p1 = new THREE.Vector3(
          Math.sin(a) * (towerFaceR(ny) + 0.02) + Math.cos(a) * noff, ny,
          Math.cos(a) * (towerFaceR(ny) + 0.02) - Math.sin(a) * noff
        );
        ivyStemB.add(beamGeometry(p0, p1, 0.028, 0.028));
        py = ny; poff = noff;
      }
    }
  }
  ivyPatch(0, 1.1, 15.8, 6.3, 430);
  ivyPatch(0, 12.0, 19.6, 3.0, 96, 0.8);
  ivyPatch(-101.25, 0.6, 6.2, 2.0, 26, 0.75);

  const ivyMesh = ivyB.build('tower-ivy');
  if (ivyMesh) group.add(ivyMesh);
  const ivyStemMesh = ivyStemB.build('tower-ivy-stems');
  if (ivyStemMesh) group.add(ivyStemMesh);

  /* ---------------- grass tufts ---------------- */
  const tuftMat = new THREE.MeshStandardMaterial({
    map: createGrassTuftTexture(), alphaTest: 0.3, side: THREE.DoubleSide,
    roughness: 1, metalness: 0, envMapIntensity: 0.18,
  });
  const tuftB = new Batch(tuftMat, { shadow: false, receive: true });
  const tuftRnd = mulberry32(10022);
  for (let i = 0; i < 260; i++) {
    const a = tuftRnd() * TAU;
    const r = 22.4 + tuftRnd() * 5.4;
    // keep the annex and the gate approach clear
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.18) continue;
    const h = 0.5 + tuftRnd() * 1.15;
    const w = h * (0.8 + tuftRnd() * 0.6);
    for (let k = 0; k < 2; k++) {
      const g = new THREE.PlaneGeometry(w, h);
      g.translate(0, h / 2, 0);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        0, a + (k * Math.PI) / 2 + tuftRnd() * 0.5, 0, 'YXZ'
      ));
      tuftB.add(g, new THREE.Matrix4().compose(
        new THREE.Vector3(Math.sin(a) * r, 0.02, Math.cos(a) * r), q, new THREE.Vector3(1, 1, 1)
      ));
    }
  }
  // scattered tufts along the path edges
  for (let i = 0; i < 120; i++) {
    const a = tuftRnd() * TAU;
    const r = tuftRnd() < 0.5 ? 38.2 + tuftRnd() * 2.2 : 28.1 + tuftRnd() * 1.2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.1) continue;
    const h = 0.3 + tuftRnd() * 0.7;
    const g = new THREE.PlaneGeometry(h * 1.1, h);
    g.translate(0, h / 2, 0);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, tuftRnd() * TAU, 0, 'YXZ'));
    tuftB.add(g, new THREE.Matrix4().compose(
      new THREE.Vector3(Math.sin(a) * r, 0.02, Math.cos(a) * r), q, new THREE.Vector3(1, 1, 1)
    ));
  }
  const tuftMesh = tuftB.build('grass-tufts');
  if (tuftMesh) group.add(tuftMesh);

  /* ---------------- park furniture ---------------- */
  const woodTex = createBarkTexture();
  woodTex.map.repeat.set(1, 1);
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex.map, color: 0x9d7d55, roughness: 0.88, metalness: 0,
    envMapIntensity: 0.18,
  });
  const wood = new Batch(woodMat, { shadow: true, receive: true });
  const iron = new Batch(makeMetalMaterial(0x3a443a, 0.72), { shadow: true, receive: true });

  function addBench(deg, r) {
    const a = THREE.MathUtils.degToRad(deg);
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const yaw = a + Math.PI;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const world = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 1, 1));
    const addPart = (batch, w, h, d, px, py, pz) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(px, py, pz);
      batch.add(g, world.clone());
    };
    for (const zz of [-0.16, 0.02, 0.2]) addPart(wood, 1.9, 0.055, 0.135, 0, 0.47, zz);
    for (const [yy, zz] of [[0.7, -0.3], [0.87, -0.3]]) addPart(wood, 1.9, 0.12, 0.055, 0, yy, zz);
    for (const sx of [-0.82, 0.82]) {
      addPart(iron, 0.055, 0.46, 0.5, sx, 0.23, 0.02);
      addPart(iron, 0.055, 0.55, 0.06, sx, 0.55, -0.3);
      addPart(iron, 0.055, 0.07, 0.48, sx, 0.03, 0.02);
      addPart(iron, 0.12, 0.05, 0.12, sx, 0.46, 0.18);
    }
  }
  for (const deg of [38, 108, 172, 222, 288, 334]) addBench(deg, 38.5);

  // park lamps along the circular walk
  const lampGlass = new Batch(new THREE.MeshStandardMaterial({
    color: 0xfff1cf, emissive: 0xffd9a1, emissiveIntensity: 0.18,
    roughness: 0.32, metalness: 0, transparent: false,
  }), { shadow: false, receive: false });
  function addLamp(deg) {
    const a = THREE.MathUtils.degToRad(deg);
    const x = Math.sin(a) * 39.0, z = Math.cos(a) * 39.0;
    const post = new THREE.CylinderGeometry(0.055, 0.085, 4.15, 8);
    post.translate(0, 2.075, 0);
    iron.add(post, new THREE.Matrix4().makeTranslation(x, 0, z));
    iron.addBox(0.16, 0.16, 0.16, x, 4.17, z, a);
    lampGlass.addBox(0.24, 0.35, 0.24, x, 4.45, z, a);
    iron.addBox(0.3, 0.06, 0.3, x, 4.66, z, a);
    iron.addBox(0.12, 0.05, 0.12, x, 4.71, z, a);
    iron.addBox(0.28, 0.12, 0.28, x, 0.06, z, a);
  }
  for (const deg of [20, 80, 144, 204, 264, 318]) addLamp(deg);

  for (const b of [wood, iron, lampGlass]) {
    const mesh = b.build('park-furniture');
    if (mesh) group.add(mesh);
  }

  /* ---------------- distant city ---------------- */
  const facadeTex = createFacadeBuildingTexture();
  facadeTex.wrapS = THREE.RepeatWrapping;
  facadeTex.wrapT = THREE.RepeatWrapping;
  facadeTex.repeat.set(2.5, 1.4);
  const cityMat = new THREE.MeshStandardMaterial({
    map: facadeTex, roughness: 0.9, metalness: 0, color: 0xc4bca9,
    envMapIntensity: 0.1,
  });
  const cityGreyMat = new THREE.MeshStandardMaterial({
    map: facadeTex, roughness: 0.92, metalness: 0, color: 0xa9a69c,
    envMapIntensity: 0.1,
  });
  const cityBrickMat = new THREE.MeshStandardMaterial({
    map: facadeTex, roughness: 0.92, metalness: 0, color: 0xb09a87,
    envMapIntensity: 0.1,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x5f443b, roughness: 0.95, metalness: 0,
  });
  const roofGreyMat = new THREE.MeshStandardMaterial({
    color: 0x55534d, roughness: 0.95, metalness: 0,
  });
  const cityB = new Batch(cityMat, { shadow: false, receive: false });
  const cityGreyB = new Batch(cityGreyMat, { shadow: false, receive: false });
  const cityBrickB = new Batch(cityBrickMat, { shadow: false, receive: false });
  const roofB = new Batch(roofMat, { shadow: false, receive: false });
  const roofGreyB = new Batch(roofGreyMat, { shadow: false, receive: false });

  // A muted city ground beyond the park, so the horizon is not raw lawn.
  const cityGround = new THREE.Mesh(
    new THREE.RingGeometry(520, 4500, 128, 1),
    new THREE.MeshStandardMaterial({ color: 0x6f6c60, roughness: 1, metalness: 0 })
  );
  cityGround.rotation.x = -Math.PI / 2;
  cityGround.position.y = 0.004;
  group.add(cityGround);

  // dark ground beneath the boundary trees, hiding the lawn/city seam
  const boundaryFloor = new THREE.Mesh(
    new THREE.RingGeometry(500, 548, 128, 1),
    new THREE.MeshStandardMaterial({ color: 0x4b5739, roughness: 1, metalness: 0 })
  );
  boundaryFloor.rotation.x = -Math.PI / 2;
  boundaryFloor.position.y = 0.008;
  group.add(boundaryFloor);

  const cityRnd = mulberry32(9103);
  const addBlock = (a, dist, w, d, h, yawJitter, batch, roofBatch, pyramidChance) => {
    const x = Math.sin(a) * dist, z = Math.cos(a) * dist;
    const yaw = a + yawJitter;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, h / 2 - 0.4, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
      new THREE.Vector3(1, 1, 1)
    );
    batch.add(new THREE.BoxGeometry(w, h, d), m);
    const rm = new THREE.Matrix4().compose(
      new THREE.Vector3(x, h + 0.7, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
      new THREE.Vector3(1, 1, 1)
    );
    roofBatch.add(new THREE.BoxGeometry(w * 1.02, 1.0, d * 1.02), rm);
    if (cityRnd() < pyramidChance) {
      const roof = new THREE.ConeGeometry(Math.min(w, d) * 0.62, 2.4 + cityRnd() * 2.8, 4);
      roof.rotateY(Math.PI / 4);
      roof.scale(1, 1, d / w);
      const rc = new THREE.Matrix4().compose(
        new THREE.Vector3(x, h + 2.3, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
        new THREE.Vector3(1, 1, 1)
      );
      roofBatch.add(roof, rc);
    }
    if (cityRnd() < 0.3) {
      const n = 1 + Math.floor(cityRnd() * 3);
      for (let c = 0; c < n; c++) {
        const ox = (cityRnd() - 0.5) * w * 0.6;
        const oz = (cityRnd() - 0.5) * d * 0.6;
        const ch = 1.0 + cityRnd() * 2.2;
        roofBatch.addBox(0.8 + cityRnd() * 0.9, ch, 0.8 + cityRnd() * 0.9,
          x + ox, h + 0.7 + ch / 2, z + oz, yaw);
      }
    }
  };

  // dense ring of inner-Vienna blocks, pushed back into the haze
  for (let i = 0; i < 186; i++) {
    const a = (i / 186) * TAU + (cityRnd() - 0.5) * 0.05;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - 1.02) < 0.045) continue;
    const dist = 555 + cityRnd() * 400;
    const w = 20 + cityRnd() * 36;
    const d = 14 + cityRnd() * 24;
    const h = 15 + cityRnd() * 18;
    const pick = cityRnd();
    addBlock(a, dist, w, d, h, (cityRnd() - 0.5) * 0.12,
      pick < 0.55 ? cityB : pick < 0.82 ? cityGreyB : cityBrickB,
      cityRnd() < 0.55 ? roofB : roofGreyB, 0.4);
  }
  // lower suburban layer, outside the park boundary so no house sits on
  // the Augarten lawn
  for (let i = 0; i < 86; i++) {
    const a = (i / 86) * TAU + (cityRnd() - 0.5) * 0.08;
    const dist = 532 + cityRnd() * 190;
    const w = 15 + cityRnd() * 24;
    const d = 11 + cityRnd() * 18;
    const h = 8 + cityRnd() * 9;
    addBlock(a, dist, w, d, h, (cityRnd() - 0.5) * 0.2,
      cityRnd() < 0.6 ? cityB : cityGreyB, roofB, 0.62);
  }

  // A hazy ring of wooded hills closes the horizon beyond the city.
  // Vienna is ringed by the Wienerwald; without it the skyline reads as
  // a flat row of model buildings.
  {
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x5d7165, roughness: 1, metalness: 0, envMapIntensity: 0.05,
    });
    const hillRnd = mulberry32(4411);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU + (hillRnd() - 0.5) * 0.1;
      const dist = 2000 + hillRnd() * 700;
      const rad = 600 + hillRnd() * 400;
      const h = 45 + hillRnd() * 55;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 7), hillMat);
      hill.position.set(Math.sin(a) * dist, h / 2 - 20, Math.cos(a) * dist);
      hill.rotation.y = hillRnd() * TAU;
      hill.scale.z = 0.6 + hillRnd() * 0.5;
      hill.receiveShadow = false;
      hill.castShadow = false;
      group.add(hill);
    }
  }

  // a distant church tower to close the skyline to the west
  {
    const a = THREE.MathUtils.degToRad(244);
    const x = Math.sin(a) * 730, z = Math.cos(a) * 730;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(15, 38, 15), cityGreyMat);
    tower.position.set(x, 19, z);
    group.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(10, 28, 8), roofGreyMat);
    spire.position.set(x, 52, z);
    group.add(spire);
  }
  for (const b of [cityB, cityGreyB, cityBrickB, roofB, roofGreyB]) {
    const mesh = b.build('distant-city');
    if (mesh) group.add(mesh);
  }

  /* ---------------- the Leitturm, ~438 m to the NE ---------------- */
  const leitMat = new THREE.MeshStandardMaterial({
    color: 0x9a9688, roughness: 0.96, metalness: 0,
    envMapIntensity: 0.1,
  });
  const leit = new THREE.Group();
  leit.name = 'Leitturm-Augarten';
  const bearing = THREE.MathUtils.degToRad(58.7);
  const distance = 438;
  leit.position.set(Math.sin(bearing) * distance, 0, -Math.cos(bearing) * distance);
  leit.rotation.y = -bearing;
  const shaftL = new THREE.Mesh(new THREE.BoxGeometry(31, 45, 15), leitMat);
  shaftL.position.y = 22.5;
  leit.add(shaftL);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(32.5, 1.1, 16.3), leitMat);
  cap.position.y = 45.3;
  leit.add(cap);
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(31.5, 1.4, 15.5), leitMat);
  parapet.position.y = 46.0;
  leit.add(parapet);
  // the smaller Leitstand box on top
  const topBox = new THREE.Mesh(new THREE.BoxGeometry(13, 5.6, 8), leitMat);
  topBox.position.set(0, 49.5, 0);
  leit.add(topBox);
  const topCap = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.5, 8.7), leitMat);
  topCap.position.set(0, 52.5, 0);
  leit.add(topCap);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.26, 4, 6),
    new THREE.MeshStandardMaterial({ color: 0x494c46, roughness: 0.7, metalness: 0.5 })
  );
  mast.position.y = 54.7;
  leit.add(mast);

  // shallow balconies and their thin brackets, readable at this distance
  const leitBalcony = new THREE.BoxGeometry(13, 0.75, 3.4);
  for (const zz of [-8.6, 8.6]) {
    const b = new THREE.Mesh(leitBalcony, leitMat);
    b.position.set(0, 42.6, zz);
    leit.add(b);
    for (let i = -2; i <= 2; i++) {
      const p0 = new THREE.Vector3(i * 2.3, 38.2, Math.sign(zz) * 7.6);
      const p1 = new THREE.Vector3(i * 2.3, 42.2, Math.sign(zz) * 9.9);
      const strut = new THREE.Mesh(beamGeometry(p0, p1, 0.24, 0.5), leitMat);
      leit.add(strut);
    }
  }
  for (const xx of [-16.4, 16.4]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.75, 6.4), leitMat);
    b.position.set(xx, 42.6, 0);
    leit.add(b);
  }
  // a few high windows on the broad faces
  const winMat = new THREE.MeshBasicMaterial({ color: 0x3e403a });
  for (let i = 0; i < 4; i++) {
    for (const zz of [-7.53, 7.53]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.5), winMat);
      win.position.set(0, 47.4 + i * 1.05, zz);
      win.rotation.y = zz > 0 ? 0 : Math.PI;
      leit.add(win);
    }
  }
  leit.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  group.add(leit);

  /* ---------------- birds ---------------- */
  const birds = new THREE.Group();
  birds.name = 'birds';
  const birdMat = new THREE.LineBasicMaterial({ color: 0x3b3b37, transparent: true, opacity: 0.65 });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, -0.55, 0.15, 0, 0, 0, 0, 0.55, 0.15, 0,
    ], 3));
    const line = new THREE.LineSegments(g, birdMat);
    const a = rnd() * TAU, r = 34 + rnd() * 66;
    line.position.set(Math.sin(a) * r, 58 + rnd() * 26, Math.cos(a) * r);
    line.scale.setScalar(0.6 + rnd() * 0.7);
    birds.add(line);
  }
  group.add(birds);

  return {
    group,
    update(t) {
      birds.rotation.y = t * 0.012;
      birds.position.y = Math.sin(t * 0.19) * 0.45;
    },
  };
}

/* ------------------------------------------------------------------ *
 *  Gate with two leaves, chain and lock.
 * ------------------------------------------------------------------ */
function buildGate(chainMat, metalMat) {
  const gate = new THREE.Group();
  gate.name = 'site-gate';
  const width = 2 * FENCE_R * Math.sin(GATE_HALF);
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    const leafW = width / 2 - 0.12;
    // frame
    const frameMat = metalMat;
    for (const [w, h, d, x, y, z] of [
      [0.06, 2.35, 0.06, 0, 1.17, 0],
      [0.06, 2.35, 0.06, leafW, 1.17, 0],
      [leafW, 0.06, 0.06, leafW / 2, 0.05, 0],
      [leafW, 0.06, 0.06, leafW / 2, 2.32, 0],
      [leafW, 0.045, 0.045, leafW / 2, 1.55, 0],
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      leaf.add(m);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(leafW, 2.27), chainMat);
    mesh.position.set(leafW / 2, 1.18, 0);
    leaf.add(mesh);
    // diagonal brace
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.05, Math.hypot(leafW, 2.2), 0.05), frameMat);
    brace.position.set(leafW / 2, 1.17, 0.01);
    brace.rotation.z = Math.atan2(2.2, leafW);
    leaf.add(brace);
    leaf.position.set(-FENCE_R * Math.sin(GATE_HALF) * (side > 0 ? -1 : 1), 0, FENCE_R * Math.cos(GATE_HALF));
    leaf.position.x = side < 0 ? -width / 2 : width / 2;
    leaf.position.z = FENCE_R * Math.cos(GATE_HALF);
    leaf.rotation.y = side < 0 ? 0 : Math.PI;
    // Slight opening so the entrance reads as a gate, not a fence.
    leaf.rotation.y += side * 0.18;
    gate.add(leaf);
    // hinge post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.7, 8), frameMat);
    post.position.set(side * width / 2, 1.35, FENCE_R * Math.cos(GATE_HALF));
    post.castShadow = true;
    gate.add(post);
  }
  // chain and padlock in the middle
  const chainMat2 = new THREE.MeshStandardMaterial({ color: 0x3e4239, roughness: 0.55, metalness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 4, 8), chainMat2);
    link.position.set((i - 1.5) * 0.075, 1.15 + Math.abs(i - 1.5) * 0.09, FENCE_R * Math.cos(GATE_HALF) + 0.08);
    link.rotation.y = Math.PI / 2;
    link.rotation.z = i * 0.5;
    gate.add(link);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.08), chainMat2);
  lock.position.set(0, 1.03, FENCE_R * Math.cos(GATE_HALF) + 0.09);
  gate.add(lock);
  gate.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return gate;
}
