import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const faceAngle = (sides) => TAU / sides;

/** Position on a polygonal ring. */
export function polyPoint(r, angle, y = 0) {
  return new THREE.Vector3(Math.sin(angle) * r, y, Math.cos(angle) * r);
}

/** Flat-faced polygon shell. Each sector can have its own top edge. */
export function buildShell({
  sides = 16,
  angleOffset = 0,
  y0 = 0,
  y1 = 1,
  radius = () => 1,
  topForSector = null,
  rows = 10,
  cols = 4,
  uvU = [0, 1],
  uvV = [0, 1],
  inward = false,
}) {
  const positions = [], normals = [], uvs = [], indices = [];
  const da = TAU / sides;
  let vIndex = 0;
  for (let i = 0; i < sides; i++) {
    const a0 = angleOffset + i * da - da / 2;
    const a1 = a0 + da;
    const top = topForSector ? topForSector(i) : y1;
    const localRows = Math.max(1, Math.round(rows * (top - y0) / (y1 - y0)));
    const base = vIndex;
    for (let r = 0; r <= localRows; r++) {
      const t = r / localRows;
      const y = y0 + (top - y0) * t;
      const rr0 = radius(y, i, a0);
      const rr1 = radius(y, i, a1);
      const p0 = new THREE.Vector3(Math.sin(a0) * rr0, y, Math.cos(a0) * rr0);
      const p1 = new THREE.Vector3(Math.sin(a1) * rr1, y, Math.cos(a1) * rr1);
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const x = p0.x + (p1.x - p0.x) * u;
        const z = p0.z + (p1.z - p0.z) * u;
        positions.push(x, y, z);
        const uu = uvU[0] + (uvU[1] - uvU[0]) * ((i + u) / sides);
        const vv = uvV[0] + (uvV[1] - uvV[0]) * ((y - y0) / (y1 - y0));
        uvs.push(uu, vv);
      }
    }
    for (let r = 0; r < localRows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = base + r * (cols + 1) + c;
        const b = a + 1;
        const cc = a + (cols + 1);
        const d = cc + 1;
        if (inward) {
          indices.push(a, cc, b, b, cc, d);
        } else {
          indices.push(a, b, cc, b, d, cc);
        }
      }
    }
    vIndex += (localRows + 1) * (cols + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Flat-faced polygonal shell with true rectangular openings cut into each face. */
export function buildHoleyShell({
  sides = 16,
  angleOffset = 0,
  y0 = 0,
  y1 = 1,
  radius = () => 1,
  topForSector = null,
  openings = [],
  uvU = [0, 1],
  uvV = [0, 1],
}) {
  const da = TAU / sides;
  const cosHalf = Math.cos(Math.PI / sides);
  const sinHalf = Math.sin(Math.PI / sides);
  const positions = [], uvs = [], indices = [];
  let base = 0;

  for (let i = 0; i < sides; i++) {
    const top = topForSector ? topForSector(i) : y1;
    const a = angleOffset + i * da;
    const halfW = (y) => radius(y) * sinHalf;

    const shape = new THREE.Shape();
    shape.moveTo(-halfW(y0), y0);
    shape.lineTo(halfW(y0), y0);
    shape.lineTo(halfW(top), top);
    shape.lineTo(-halfW(top), top);
    shape.closePath();

    for (const o of openings) {
      if (o.face !== i) continue;
      if (o.y - o.h / 2 < y0 + 0.02 || o.y + o.h / 2 > top - 0.02) continue;
      const hx0 = o.lateral - o.w / 2;
      const hx1 = o.lateral + o.w / 2;
      const hy0 = o.y - o.h / 2;
      const hy1 = o.y + o.h / 2;
      const hole = new THREE.Path();
      hole.moveTo(hx0, hy0);
      hole.lineTo(hx1, hy0);
      hole.lineTo(hx1, hy1);
      hole.lineTo(hx0, hy1);
      hole.closePath();
      shape.holes.push(hole);
    }

    const faceGeo = new THREE.ShapeGeometry(shape, 1);
    const pos = faceGeo.attributes.position;
    const index = faceGeo.index;
    for (let v = 0; v < pos.count; v++) {
      const lat = pos.getX(v);
      const y = pos.getY(v);
      const inr = radius(y) * cosHalf;
      const hw = halfW(y);
      const u = hw > 1e-6 ? (lat / hw + 1) / 2 : 0.5;
      positions.push(
        Math.sin(a) * inr + Math.cos(a) * lat,
        y,
        Math.cos(a) * inr - Math.sin(a) * lat
      );
      uvs.push(
        uvU[0] + (uvU[1] - uvU[0]) * ((i + u) / sides),
        uvV[0] + (uvV[1] - uvV[0]) * ((y - y0) / (y1 - y0))
      );
    }
    if (index) {
      for (let j = 0; j < index.count; j++) indices.push(base + index.getX(j));
    } else {
      for (let j = 0; j < pos.count; j++) indices.push(base + j);
    }
    base += pos.count;
    faceGeo.dispose();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Ring with an arbitrary cross-section, following a polygon. */
export function buildProfileRing({
  sides = 16, angleOffset = 0, profile = [], skip = null, uvScale = [1, 1],
}) {
  const positions = [], uvs = [], indices = [];
  const da = TAU / sides;
  let vi = 0;
  let plen = 0;
  const lengths = [0];
  for (let i = 1; i < profile.length; i++) {
    plen += Math.hypot(profile[i].r - profile[i - 1].r, profile[i].y - profile[i - 1].y);
    lengths.push(plen);
  }
  for (let i = 0; i < sides; i++) {
    if (skip && skip.has(i)) continue;
    const a0 = angleOffset + i * da - da / 2;
    const a1 = a0 + da;
    const base = vi;
    for (let p = 0; p < profile.length; p++) {
      const { r, y } = profile[p];
      positions.push(Math.sin(a0) * r, y, Math.cos(a0) * r);
      positions.push(Math.sin(a1) * r, y, Math.cos(a1) * r);
      uvs.push((i / sides) * uvScale[0], (lengths[p] / plen) * uvScale[1]);
      uvs.push(((i + 1) / sides) * uvScale[0], (lengths[p] / plen) * uvScale[1]);
    }
    for (let p = 0; p < profile.length - 1; p++) {
      const a = base + p * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
    vi += profile.length * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Box geometry stretched between two points. */
export function beamGeometry(p0, p1, width, depth) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  const geo = new THREE.BoxGeometry(width, len, depth);
  const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
  geo.applyMatrix4(m);
  return geo;
}

/** Accumulate transformed geometries and merge into one mesh. */
export class Batch {
  constructor(material, { shadow = true, receive = true } = {}) {
    this.material = material;
    this.items = [];
    this.shadow = shadow;
    this.receive = receive;
  }
  add(geo, matrix = null) {
    if (matrix) geo.applyMatrix4(matrix);
    this.items.push(geo);
    return this;
  }
  addBox(w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m);
    this.items.push(geo);
    return this;
  }
  build(name = 'batch') {
    if (!this.items.length) return null;
    // mergeGeometries requires either all indexed or all non-indexed
    // geometry.  Extrude/Shape geometries are non-indexed, boxes are
    // indexed, so normalise a mixed batch before merging.
    const indexed = this.items.filter((g) => g.index).length;
    if (indexed > 0 && indexed < this.items.length) {
      this.items = this.items.map((g) => {
        if (!g.index) return g;
        const ng = g.toNonIndexed();
        g.dispose();
        return ng;
      });
    }
    const merged = mergeGeometries(this.items, false);
    this.items.forEach((g) => g.dispose());
    this.items = [];
    if (!merged) return null;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, this.material);
    mesh.name = name;
    mesh.castShadow = this.shadow;
    mesh.receiveShadow = this.receive;
    return mesh;
  }
}

/** A small plane decal placed against a polygonal wall. */
export function wallDecal(texture, angle, radius, y, width, height, opacity = 1) {
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    opacity,
    alphaTest: 0.02,
    depthWrite: false,
    roughness: 0.82,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
  mesh.rotation.y = angle;
  mesh.receiveShadow = true;
  mesh.renderOrder = 3;
  return mesh;
}

/** Pitted, dark steel material for hinges, bars, ladders. */
export function makeMetalMaterial(color = 0x3c3b35, roughness = 0.62) {
  return new THREE.MeshStandardMaterial({
    color, metalness: 0.72, roughness, envMapIntensity: 0.4,
  });
}
