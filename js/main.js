import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { configureQuality } from './tex-utils.js';
import { createFacadeTextures, createDrumTextures, createTrimTextures } from './tex-concrete.js';
import { createRoofTextures, createGrassTuftTexture } from './tex-scene.js';
import { createGraffitiTextures } from './tex-graffiti.js';
import { SKY_PRESETS, createSkyTexture } from './tex-sky.js';
import { makeMetalMaterial } from './geo-utils.js';
import { buildTower } from './tower.js';
import { buildEnvironment } from './environment.js';

/* ------------------------------------------------------------------ *
 *  Flakturm Augarten — application
 * ------------------------------------------------------------------ */

const stage = document.getElementById('stage');
const loader = document.getElementById('loader');
const loaderPhase = document.getElementById('loader-phase');
const loaderPercent = document.getElementById('loader-percent');
const loaderFill = document.getElementById('loader-fill');
const drawer = document.getElementById('drawer');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const drawerContent = document.getElementById('drawer-content');
const drawerKicker = document.getElementById('drawer-kicker');
const drawerFoot = document.getElementById('drawer-foot');
const drawerPrev = document.getElementById('drawer-prev');
const drawerNext = document.getElementById('drawer-next');
const hotspotsRoot = document.getElementById('hotspots');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = window.matchMedia('(max-width: 760px)').matches;
const deviceMemory = navigator.deviceMemory || 8;
const highQuality = !isSmallScreen && deviceMemory >= 4;

configureQuality(highQuality);

const nextFrame = () => new Promise((resolve) => {
  requestAnimationFrame(() => setTimeout(resolve, 0));
});

function setProgress(percent, phase) {
  loaderFill.style.width = `${percent}%`;
  loaderPercent.textContent = String(Math.round(percent)).padStart(2, '0');
  if (phase) loaderPhase.textContent = phase;
}

async function stageStep(percent, phase, fn) {
  setProgress(percent, phase);
  await nextFrame();
  const result = fn();
  await nextFrame();
  return result;
}

/* ------------------------------------------------------------------ *
 *  Renderer, scene, camera
 * ------------------------------------------------------------------ */

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, highQuality ? 2 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = SKY_PRESETS.afternoon.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(
  SKY_PRESETS.afternoon.fog,
  SKY_PRESETS.afternoon.fogDensity
);

const camera = new THREE.PerspectiveCamera(
  32,
  window.innerWidth / window.innerHeight,
  0.5,
  5000
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 34;
controls.maxDistance = 285;
controls.minPolarAngle = 0.1;
controls.maxPolarAngle = 1.86;
controls.rotateSpeed = 0.48;
controls.zoomSpeed = 0.7;
controls.enabled = false;

/* ------------------------------------------------------------------ *
 *  Camera views
 * ------------------------------------------------------------------ */

const VIEWS = {
  overview: {
    position: new THREE.Vector3(86, 50, 122),
    target: new THREE.Vector3(-12, 24, 0),
    fov: 33,
  },
  facade: {
    position: new THREE.Vector3(8, 13, 140),
    target: new THREE.Vector3(0, 26.5, 0),
    fov: 38,
  },
  rooftop: {
    position: new THREE.Vector3(31, 76, 48),
    target: new THREE.Vector3(0, 51.2, 0),
    fov: 42,
  },
  aerial: {
    position: new THREE.Vector3(56, 108, 80),
    target: new THREE.Vector3(0, 28, 0),
    fov: 37,
  },
};

// On a phone the wide desktop composition crops the tower and puts the
// hotspots on top of the headline. Pull back, centre the tower and keep the
// lower third clear for the editorial copy.
const MOBILE_OVERVIEW = {
  position: new THREE.Vector3(100, 55, 150),
  target: new THREE.Vector3(0, 22, 0),
  fov: 33,
};

function viewFor(name) {
  if (name === 'overview' && window.matchMedia('(max-width: 760px)').matches) {
    return MOBILE_OVERVIEW;
  }
  return VIEWS[name];
}

const HOTSPOT_VIEWS = {
  facade: {
    position: new THREE.Vector3(44, 27, 62),
    target: new THREE.Vector3(2, 27, 6),
    fov: 38,
  },
  props: {
    position: new THREE.Vector3(54, 39, 64),
    target: new THREE.Vector3(17.5, 39.5, 17.5),
    fov: 40,
  },
  balcony: {
    position: new THREE.Vector3(58, 47, 40),
    target: new THREE.Vector3(25.9, 44.5, 0),
    fov: 40,
  },
  roof: {
    position: new THREE.Vector3(24, 72, 38),
    target: new THREE.Vector3(0, 51.2, 0),
    fov: 42,
  },
  notch: {
    position: new THREE.Vector3(35, 65, 38),
    target: new THREE.Vector3(8.2, 53.8, 15.4),
    fov: 42,
  },
  entrance: {
    position: new THREE.Vector3(10, 6.5, 46),
    target: new THREE.Vector3(0, 2.8, 22.8),
    fov: 40,
  },
};

let fly = null;
let currentView = 'overview';

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function flyTo(view, { duration = reducedMotion ? 0 : 1.5, intro = false } = {}) {
  const fromPosition = camera.position.clone();
  const fromTarget = controls.target.clone();
  const fromFov = camera.fov;
  const toPosition = view.position.clone();
  const toTarget = view.target.clone();
  const toFov = view.fov;

  if (reducedMotion || duration <= 0) {
    camera.position.copy(toPosition);
    camera.fov = toFov;
    camera.updateProjectionMatrix();
    controls.target.copy(toTarget);
    controls.update();
    controls.enabled = true;
    return;
  }

  controls.enabled = false;
  fly = {
    t: 0,
    duration,
    fromPosition,
    fromTarget,
    fromFov,
    toPosition,
    toTarget,
    toFov,
    intro,
  };
}

function updateFly(dt) {
  if (!fly) return;
  fly.t = Math.min(1, fly.t + dt / fly.duration);
  const e = easeInOutCubic(fly.t);
  camera.position.lerpVectors(fly.fromPosition, fly.toPosition, e);
  controls.target.lerpVectors(fly.fromTarget, fly.toTarget, e);
  camera.fov = THREE.MathUtils.lerp(fly.fromFov, fly.toFov, e);
  camera.updateProjectionMatrix();
  camera.lookAt(controls.target);
  if (fly.t >= 1) {
    fly = null;
    controls.enabled = true;
    controls.update();
  }
}

function setActiveView(name) {
  currentView = name;
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

/* ------------------------------------------------------------------ *
 *  Lighting and skies
 * ------------------------------------------------------------------ */

const sun = new THREE.DirectionalLight(0xffffff, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(highQuality ? 2048 : 1024, highQuality ? 2048 : 1024);
sun.shadow.camera.left = -86;
sun.shadow.camera.right = 86;
sun.shadow.camera.top = 86;
sun.shadow.camera.bottom = -86;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 430;
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.45;
scene.add(sun);
scene.add(sun.target);

const hemi = new THREE.HemisphereLight(0xbcd3e8, 0x5e5a45, 0.62);
scene.add(hemi);

const ambient = new THREE.AmbientLight(0x8fa3b8, 0.12);
scene.add(ambient);

const fill = new THREE.DirectionalLight(0xbcd3e8, 0.22);
scene.add(fill);
scene.add(fill.target);

let pmrem = null;
const skyCache = new Map();

function getSky(key) {
  if (skyCache.has(key)) return skyCache.get(key);
  const preset = SKY_PRESETS[key];
  const { texture, sunDirection } = createSkyTexture(preset);
  const envTarget = pmrem.fromEquirectangular(texture);
  const entry = {
    texture,
    env: envTarget.texture,
    envTarget,
    sunDirection,
    preset,
  };
  skyCache.set(key, entry);
  return entry;
}

function applyLightPreset(key, { fade = false } = {}) {
  const entry = getSky(key);
  const preset = entry.preset;
  scene.background = entry.texture;
  scene.environment = entry.env;
  scene.environmentIntensity = 0.42;

  sun.color.setHex(preset.sunColor);
  sun.intensity = preset.sunIntensity;
  sun.target.position.set(0, 20, 0);
  sun.position.copy(entry.sunDirection).multiplyScalar(215).add(sun.target.position);

  hemi.color.setHex(preset.hemiSky);
  hemi.groundColor.setHex(preset.hemiGround);
  hemi.intensity = preset.hemiIntensity;

  ambient.color.setHex(preset.ambient);
  ambient.intensity = preset.ambientIntensity;

  fill.color.setHex(preset.hemiSky);
  fill.intensity = Math.max(0.14, preset.hemiIntensity * 0.34);
  fill.target.position.set(0, 26, 0);
  fill.position.set(110, 96, 120).add(fill.target.position);

  scene.fog.color.setHex(preset.fog);
  scene.fog.density = preset.fogDensity;
  renderer.toneMappingExposure = preset.exposure;

  document.body.dataset.light = key;
  document.querySelectorAll('[data-light]').forEach((button) => {
    const active = button.dataset.light === key;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  if (fade) {
    const cover = document.getElementById('light-fade');
    if (cover) {
      cover.classList.add('is-on');
      window.setTimeout(() => cover.classList.remove('is-on'), 170);
    }
  }
}

/* ------------------------------------------------------------------ *
 *  Materials
 * ------------------------------------------------------------------ */

function createMaterials(facadeTex, drumTex, trimTex, roofTex, graffitiTex) {
  const facade = new THREE.MeshStandardMaterial({
    map: facadeTex.map,
    bumpMap: facadeTex.bumpMap,
    bumpScale: 0.12,
    normalMap: facadeTex.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: facadeTex.roughnessMap,
    roughness: 1,
    metalness: 0,
    color: 0xded9ce,
    envMapIntensity: 0.22,
  });

  const drum = new THREE.MeshStandardMaterial({
    map: drumTex.map,
    bumpMap: drumTex.bumpMap,
    bumpScale: 0.062,
    roughnessMap: drumTex.roughnessMap,
    roughness: 1,
    metalness: 0,
    color: 0xc2c0b9,
    envMapIntensity: 0.1,
  });

  const drumInner = new THREE.MeshStandardMaterial({
    map: drumTex.map,
    bumpMap: drumTex.bumpMap,
    bumpScale: 0.1,
    roughness: 1,
    metalness: 0,
    color: 0x938c7f,
    envMapIntensity: 0.22,
  });

  const trim = new THREE.MeshStandardMaterial({
    map: trimTex.map,
    bumpMap: trimTex.bumpMap,
    bumpScale: 0.045,
    roughness: 1,
    metalness: 0,
    color: 0xc2bcb1,
    envMapIntensity: 0.22,
  });

  const trimDark = new THREE.MeshStandardMaterial({
    map: trimTex.map,
    bumpMap: trimTex.bumpMap,
    bumpScale: 0.04,
    roughness: 1,
    metalness: 0,
    color: 0x999287,
    envMapIntensity: 0.18,
  });

  const lobe = trim.clone();
  lobe.bumpMap = trimTex.bumpMap;
  lobe.bumpScale = 0.035;
  lobe.color.setHex(0xc9c3b8);
  lobe.envMapIntensity = 0.22;

  const strut = trim.clone();
  strut.bumpMap = trimTex.bumpMap;
  strut.bumpScale = 0.03;
  strut.color.setHex(0x8f887d);
  strut.envMapIntensity = 0.18;

  const soffit = trim.clone();
  soffit.map = null;
  soffit.bumpMap = trimTex.bumpMap;
  soffit.bumpScale = 0.03;
  soffit.color.setHex(0x827b70);
  soffit.envMapIntensity = 0.16;
  soffit.side = THREE.DoubleSide;

  const ring = trim.clone();
  ring.color.setHex(0xc3bdb2);

  const rim = trim.clone();
  rim.color.setHex(0xc7c1b6);

  const curb = trim.clone();
  curb.color.setHex(0xa8a297);
  curb.envMapIntensity = 0.14;

  const rubble = trim.clone();
  rubble.color.setHex(0x847f75);
  rubble.envMapIntensity = 0.1;

  const annex = trim.clone();
  annex.color.setHex(0xbdb7ac);

  const apron = trim.clone();
  apron.color.setHex(0x878176);

  const roof = new THREE.MeshStandardMaterial({
    map: roofTex.map,
    bumpMap: roofTex.bumpMap,
    bumpScale: 0.17,
    roughnessMap: roofTex.roughnessMap,
    roughness: 0.98,
    metalness: 0,
    color: 0x8f918c,
    envMapIntensity: 0.1,
  });

  const interior = new THREE.MeshStandardMaterial({
    color: 0x0b0b09,
    roughness: 1,
    metalness: 0,
  });

  const pit = new THREE.MeshStandardMaterial({
    map: trimTex.map,
    bumpMap: trimTex.bumpMap,
    bumpScale: 0.04,
    color: 0x3b3832,
    side: THREE.BackSide,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.12,
  });

  const steel = makeMetalMaterial(0x3e3d37, 0.64);
  const grate = makeMetalMaterial(0x42413a, 0.7);

  // Old, oxidised tension wire.  Matte and dark, so it never reads as a
  // bright handrail against the sky.
  const cable = new THREE.MeshStandardMaterial({
    color: 0x2b2a25,
    roughness: 0.86,
    metalness: 0.22,
    envMapIntensity: 0.12,
  });

  const rust = new THREE.MeshStandardMaterial({
    color: 0x5d3d29,
    roughness: 0.88,
    metalness: 0.35,
    envMapIntensity: 0.24,
  });

  const water = new THREE.MeshStandardMaterial({
    color: 0x1d2421,
    roughness: 0.16,
    metalness: 0.38,
    transparent: true,
    opacity: 0.94,
    envMapIntensity: 1.1,
  });

  const weed = new THREE.MeshStandardMaterial({
    map: createGrassTuftTexture(),
    color: 0x7c7f5d,
    alphaTest: 0.28,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.18,
  });

  return {
    facade, drum, drumInner, trim, trimDark, lobe, strut, soffit, ring, rim,
    annex, apron, roof, interior, pit, steel, cable, rust, water, grate, weed, curb, rubble,
    graffiti: graffitiTex,
  };
}

/* ------------------------------------------------------------------ *
 *  Drawer content
 * ------------------------------------------------------------------ */

const SOURCES = `
  <p class="source-note">
    Sources: <a href="https://de.wikipedia.org/wiki/Wiener_Flakt%C3%BCrme" target="_blank" rel="noopener">Wiener Flaktürme</a>,
    German Wikipedia (accessed 2026); <a href="https://en.wikipedia.org/wiki/Flak_tower" target="_blank" rel="noopener">Flak tower</a>,
    English Wikipedia; Bundesdenkmalamt listed-monument record. Figures are rounded and follow the pair-specific table.
    This is an interpretation, not a measured survey.
  </p>
`;

const ENTRIES = {
  history: {
    kicker: 'Object VII · Augarten',
    title: 'A tower built<br><em>to outlast defeat</em>',
    html: `
      <span class="drawer__watermark" aria-hidden="true">VII</span>
      <h2>A tower built<br><em>to outlast defeat</em></h2>
      <p class="lead">
        The Gefechtsturm in the Augarten is the tallest of Vienna’s six flak towers:
        55 metres of reinforced concrete, finished in January 1945, when the war
        was already lost.
      </p>
      <dl class="data-plate">
        <div><dt>Pair</dt><dd>VII <small>“Peter”</small></dd></div>
        <div><dt>Built</dt><dd>1944–45</dd></div>
        <div><dt>Height</dt><dd>55 <small>m</small></dd></div>
        <div><dt>Diameter</dt><dd>43 <small>m</small></dd></div>
        <div><dt>Storeys</dt><dd>13</dd></div>
        <div><dt>Mass</dt><dd>149,100 <small>t</small></dd></div>
        <div><dt>Outer wall</dt><dd>2.5 <small>m</small></dd></div>
        <div><dt>Roof slab</dt><dd>3.5 <small>m</small></dd></div>
      </dl>

      <h3>Why it was built</h3>
      <p>
        Vienna lay beyond the range of British heavy bombers until the Allies took
        Italy in 1944. On 9 September 1942 Hitler ordered a triangle of flak towers
        around the city centre. The Augarten pair was the last to be built, from
        July 1944 to January 1945, in the simplified <strong>Bauart III</strong>.
      </p>
      <p>
        A Gefechtsturm could shelter up to 3,000 people. Four 12.8 cm Flakzwilling 40
        twin mounts on the roof had a nominal range of 20 km. The towers were also
        hospitals, radio stations and workplaces: in the Augarten tower the Wiener
        Radiowerke (WIRAG) made electron tubes in three storeys that had not been
        part of the original plan.
      </p>

      <h3>The last design</h3>
      <p>
        Bauart III saved steel and concrete. The shaft is 16-sided; above the
        platform it becomes 32-sided. Eight cantilevered balconies were intended
        for 2 cm light flak, but they were never armed in Vienna: low-flying raids
        had ceased. The main armament remained on the roof. The external concrete
        <em>Kragträger</em> were for maintaining the platforms, not for mounting guns.
      </p>
      <p>
        The architect was Friedrich Tamms, represented in Vienna by Anton
        Ruschitzka. The post-victory plan was to clad the towers in marble and
        dedicate them to fallen German soldiers. The war ended before that could
        happen.
      </p>

      <h3>Construction</h3>
      <p>
        Philipp Holzmann and Gottlieb Tesch built the pair. As local labour was
        conscripted, the site increasingly relied on prisoners of war, foreign
        workers and forced labourers. A railway siding was laid through the
        Augarten to bring materials; it was removed after the war. The outer wall
        is 2.5 m thick, the ceiling over the top floor 3.5 m of spiral-reinforced
        concrete.
      </p>

      <h3>After 1945</h3>
      <p>
        Vienna’s towers survived almost unchanged, unlike those in Berlin and
        Hamburg. Demolition so close to housing was judged too dangerous. All six
        are listed; the Augarten pair received its designation in 2000. In spring
        2006 the tower was sealed off for months after rubble shifted inside
        following an explosion and pushed an outer wall outward, raising the risk
        of a platform collapse.
      </p>
      <p>
        It remains empty, owned by the Republic of Austria and managed by the
        Burghauptmannschaft. There is no public access.
      </p>

      <h3>What it means now</h3>
      <p>
        The tower is not a shrine. It stands in a public park, fenced and
        inaccessible, with <strong>NEVER AGAIN</strong> painted at its base. It is a
        warning about the regime that built it and the war it served.
      </p>

      <h3>Timeline</h3>
      <ul class="timeline">
        <li><span class="year">9 September 1942</span><span class="event">Hitler orders the construction of flak towers for Vienna.</span></li>
        <li><span class="year">30 May 1944</span><span class="event">A Führer decree assigns the three additional storeys of the Augarten tower to WIRAG for electron tube production.</span></li>
        <li><span class="year">July 1944</span><span class="event">Construction of the Augarten pair begins in Bauart III.</span></li>
        <li><span class="year">January 1945</span><span class="event">The tower is completed — the last flak tower of the Third Reich.</span></li>
        <li><span class="year">1945</span><span class="event">The war ends. The tower survives, largely unaltered.</span></li>
        <li><span class="year">5 April 2000</span><span class="event">The Augarten towers are placed under monument protection.</span></li>
        <li><span class="year">2002</span><span class="event">A plan to convert the tower into an IT data centre fails.</span></li>
        <li><span class="year">Spring 2006</span><span class="event">Rubble shifts inside after an explosion; an outer wall is pushed outward. The tower is closed for months.</span></li>
        <li><span class="year">Today</span><span class="event">Empty, state-owned, managed by the Burghauptmannschaft, without public access.</span></li>
      </ul>
      ${SOURCES}
    `,
  },

  facade: {
    kicker: '01 · The wall',
    title: '2.5 metres<br><em>of concrete</em>',
    html: `
      <span class="drawer__watermark" aria-hidden="true">01</span>
      <h2>2.5 metres<br><em>of concrete</em></h2>
      <p class="lead">
        The shaft is a 16-sided prism, 43 m across at the base and 55 m to the
        parapet. Its surface is board-formed concrete: pour lines, tie holes,
        cracks, spalls and decades of runoff.
      </p>
      <p>
        The outer wall is 2.5 m thick. The lower shaft has almost no windows; the
        openings that do exist are vents, service doors and cable entries. The dark
        streaks are water tracking through joints, not paint.
      </p>
      <p>
        The tower was designed to be practically immune to the bombs of its day.
        That is why it is still here.
      </p>
      <p class="source-note">
        The concrete in this model is generated procedurally, not photographed:
        every pour line, tie hole, crack and stain is drawn at runtime.
      </p>
    `,
  },

  props: {
    kicker: '02 · Structure',
    title: 'Cantilever<br><em>props</em>',
    html: `
      <span class="drawer__watermark" aria-hidden="true">02</span>
      <h2>Cantilever<br><em>props</em></h2>
      <p class="lead">
        Eight fans of reinforced-concrete <em>Kragträger</em> project from the
        shaft beneath the platform. They are structural, not decorative.
      </p>
      <p>
        The props support the cantilevered maintenance platform and the eight
        light-flak balconies above. Their triangular profile distributes the load
        back into the 2.5 m wall. They are often mistaken for gun mounts; the guns
        were on the roof.
      </p>
      <p>
        The deep curved soffit between the props and the balcony edge is one of the
        tower’s most recognisable details. Each bracket is a separate concrete
        beam, cast in place against the shaft.
      </p>
      <p class="source-note">
        Source: Wiener Flaktürme (de), section “Paar VII: Augarten”.
      </p>
    `,
  },

  balcony: {
    kicker: '03 · Light flak',
    title: 'Platforms<br><em>without guns</em>',
    html: `
      <span class="drawer__watermark" aria-hidden="true">03</span>
      <h2>Platforms<br><em>without guns</em></h2>
      <p class="lead">
        The eight lobes around the tower were built for 2 cm light anti-aircraft
        guns. In Vienna they were never armed.
      </p>
      <p>
        By the time the Augarten pair was finished in January 1945, low-flying
        Allied aircraft had largely disappeared from Viennese skies. The small
        platforms remained empty. The main armament — four 12.8 cm Flakzwilling 40
        twin mounts — stood in the open pits on the roof.
      </p>
      <p>
        Each balcony is a thin concrete plate with a deep curved underside, reached
        by a steel door from the upper storey. The low lip at the edge is a remnant
        of a light parapet, not a full protective wall.
      </p>
      <p class="source-note">
        Source: Wiener Flaktürme (de), introduction and “Paar VII: Augarten”.
      </p>
    `,
  },

  roof: {
    kicker: '04 · Gun platform',
    title: 'Four pits<br><em>in the sky</em>',
    html: `
      <span class="drawer__watermark" aria-hidden="true">04</span>
      <h2>Four pits<br><em>in the sky</em></h2>
      <p class="lead">
        At 53.4 m the roof carries four circular gun pits around a central
        ammunition shaft. The parapet brings the tower to 55 m.
      </p>
      <p>
        The 12.8 cm twin mounts were removed after the war. What remains is a
        weathered concrete deck, open pits, rusted steel, standing water and weeds.
        The 3.5 m ceiling below is spiral-reinforced and was designed to resist
        direct hits.
      </p>
      <p>
        The roof is the highest point of any flak tower in Vienna. The whole city
        is visible from the parapet — which is precisely why the site was chosen.
      </p>
      <p class="source-note">
        The four pits and the central hoist shaft are reconstructed from aerial
        photographs of the roof; the guns themselves are not modelled.
      </p>
    `,
  },

  notch: {
    kicker: '05 · Damage',
    title: 'The broken<br><em>parapet</em>',
    html: `
      <span class="drawer__watermark" aria-hidden="true">05</span>
      <h2>The broken<br><em>parapet</em></h2>
      <p class="lead">
        A sector of the upper parapet is missing, exposing the roof edge and the
        layers of the drum.
      </p>
      <p>
        The damage is not wartime bomb damage. In spring 2006, rubble shifted inside
        the tower as a late consequence of an explosion. An outer wall was pushed
        outward and a platform was at risk of collapse. The tower was sealed off for
        months.
      </p>
      <p>
        Steel cables now encircle the structure. The tower remains closed to the
        public; the fence is not only there to protect the monument from visitors,
        but visitors from the monument.
      </p>
      <p class="source-note">
        Source: Wiener Flaktürme (de), section “Paar VII: Augarten”; cable
        reinforcement described in Flak tower (en).
      </p>
    `,
  },

  entrance: {
    kicker: '06 · Entrance',
    title: 'A door<br><em>in the plinth</em>',
    html: `
      <span class="drawer__watermark" aria-hidden="true">06</span>
      <h2>A door<br><em>in the plinth</em></h2>
      <p class="lead">
        The main entrance is a low concrete porch at the foot of the south face,
        reached by a short flight of steps.
      </p>
      <p>
        The steel doors, vents and cable conduits are later additions or repairs.
        The tower was never intended to be welcoming: the entrance leads into a
        system of staircases and lifts set within an inner ring wall 1–1.4 m thick.
      </p>
      <p>
        Above the door, the concrete is stained by decades of water running down
        the shaft. The graffiti at this level is recent.
      </p>
      <p class="source-note">
        Source: Wiener Flaktürme (de), section “Paar VII: Augarten”.
      </p>
    `,
  },
};

const ENTRY_ORDER = ['history', 'facade', 'props', 'balcony', 'roof', 'notch', 'entrance'];

/* ------------------------------------------------------------------ *
 *  Drawer
 * ------------------------------------------------------------------ */

let currentEntry = null;
let lastFocus = null;
let backdropTimer = 0;

function renderDrawer(id) {
  const entry = ENTRIES[id];
  if (!entry) return;
  currentEntry = id;
  drawerKicker.textContent = entry.kicker;
  drawerContent.innerHTML = entry.html;
  drawerContent.scrollTop = 0;

  // The dialog is labelled by the heading of the current entry. The markup is
  // swapped on every navigation, so the id has to be re-applied each time.
  const heading = drawerContent.querySelector('h2');
  if (heading) {
    heading.id = 'drawer-title';
    const plainTitle = heading.innerHTML
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    heading.setAttribute('aria-label', plainTitle);
  }

  const index = ENTRY_ORDER.indexOf(id);
  const prev = ENTRY_ORDER[index - 1];
  const next = ENTRY_ORDER[index + 1];

  drawerPrev.disabled = !prev;
  drawerNext.disabled = !next;
  drawerPrev.querySelector('.drawer__nav-title').textContent = prev ? shortTitle(prev) : '—';
  drawerNext.querySelector('.drawer__nav-title').textContent = next ? shortTitle(next) : '—';
  drawerPrev.setAttribute('aria-label', prev ? `Previous: ${shortTitle(prev)}` : 'Previous');
  drawerNext.setAttribute('aria-label', next ? `Next: ${shortTitle(next)}` : 'Next');
  drawerFoot.hidden = false;

  document.querySelectorAll('.hotspot').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.id === id);
  });
}

function shortTitle(id) {
  return {
    history: 'The history',
    facade: 'The wall',
    props: 'Cantilever props',
    balcony: 'Light-flak balcony',
    roof: 'Gun platform',
    notch: 'Broken parapet',
    entrance: 'Entrance',
  }[id] || id;
}

function openDrawer(id) {
  if (!ENTRIES[id]) return;
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  renderDrawer(id);
  document.body.classList.add('drawer-open', 'is-exploring');
  drawerBackdrop.hidden = false;
  window.clearTimeout(backdropTimer);
  requestAnimationFrame(() => drawerBackdrop.classList.add('is-open'));
  drawer.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => {
    const close = document.getElementById('drawer-close');
    if (close) close.focus({ preventScroll: true });
  }, 80);
}

function closeDrawer({ restoreFocus = true } = {}) {
  if (!document.body.classList.contains('drawer-open')) return;
  document.body.classList.remove('drawer-open');
  drawer.setAttribute('aria-hidden', 'true');
  drawerBackdrop.classList.remove('is-open');
  document.querySelectorAll('.hotspot.is-active').forEach((button) => button.classList.remove('is-active'));
  backdropTimer = window.setTimeout(() => {
    drawerBackdrop.hidden = true;
  }, 600);
  if (restoreFocus && lastFocus && document.contains(lastFocus)) {
    lastFocus.focus({ preventScroll: true });
  }
  currentEntry = null;
}

function navigateDrawer(direction) {
  if (!currentEntry) return;
  const index = ENTRY_ORDER.indexOf(currentEntry);
  const next = ENTRY_ORDER[index + direction];
  if (!next) return;
  renderDrawer(next);
  const view = next === 'history' ? null : HOTSPOT_VIEWS[next];
  if (view) flyTo(view);
}

/* ------------------------------------------------------------------ *
 *  Hotspots
 * ------------------------------------------------------------------ */

let tower = null;
let environment = null;
let occluders = [];
let hotspots = [];
let lastOcclusionCheck = 0;

function buildHotspotButtons(list) {
  const labels = {
    facade: 'The wall',
    props: 'Cantilever props',
    balcony: 'Light-flak balcony',
    roof: 'Gun platform',
    notch: 'Broken parapet',
    entrance: 'Entrance',
  };

  list.forEach((spot, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hotspot';
    button.dataset.id = spot.id;
    button.setAttribute('aria-label', `Open: ${labels[spot.id] || spot.label}`);
    button.innerHTML = `
      <span class="hotspot__dot">${String(index + 1).padStart(2, '0')}</span>
      <span class="hotspot__label">${labels[spot.id] || spot.short || spot.label}</span>
    `;
    button.addEventListener('click', () => {
      document.body.classList.add('is-exploring');
      const view = HOTSPOT_VIEWS[spot.id];
      if (view) flyTo(view);
      openDrawer(spot.id);
    });
    hotspotsRoot.appendChild(button);

    const normal = spot.id === 'roof'
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(spot.position.x, 0, spot.position.z).normalize();

    hotspots.push({
      ...spot,
      element: button,
      normal,
      screenX: 0,
      screenY: 0,
      visible: true,
      occluded: false,
    });
  });
}

const projection = new THREE.Vector3();
const cameraToSpot = new THREE.Vector3();
const raycaster = new THREE.Raycaster();

function updateHotspots(now) {
  if (!hotspots.length) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const checkOcclusion = now - lastOcclusionCheck > 150;
  if (checkOcclusion) lastOcclusionCheck = now;

  for (const spot of hotspots) {
    projection.copy(spot.position).project(camera);
    const behind = projection.z > 1;
    const x = (projection.x * 0.5 + 0.5) * width;
    const y = (-projection.y * 0.5 + 0.5) * height;
    spot.screenX = x;
    spot.screenY = y;

    cameraToSpot.copy(camera.position).sub(spot.position);
    const facing = spot.normal.dot(cameraToSpot) > 0.2;

    if (checkOcclusion) {
      spot.occluded = false;
      if (facing && !behind && x > -60 && x < width + 60 && y > -60 && y < height + 60) {
        const distance = camera.position.distanceTo(spot.position);
        const direction = cameraToSpot.copy(spot.position).sub(camera.position).normalize();
        raycaster.set(camera.position, direction);
        raycaster.near = 0.2;
        raycaster.far = distance;
        const hits = raycaster.intersectObjects(occluders, false);
        if (hits.length && hits[0].distance < distance - 0.45) spot.occluded = true;
      }
    }

    const visible = !behind && !spot.occluded && facing
      && x > 10 && x < width - 10 && y > 10 && y < height - 10;
    spot.visible = visible;
    spot.element.classList.toggle('is-hidden', !visible);
    if (visible) {
      spot.element.style.left = `${x}px`;
      spot.element.style.top = `${y}px`;
    }
  }
}

/* ------------------------------------------------------------------ *
 *  UI
 * ------------------------------------------------------------------ */

function bindUI() {
  document.getElementById('start-tour')?.addEventListener('click', () => {
    document.body.classList.add('is-exploring');
    setActiveView('facade');
    flyTo(viewFor('facade'));
  });

  document.getElementById('open-history')?.addEventListener('click', () => openDrawer('history'));
  document.getElementById('info-toggle')?.addEventListener('click', () => openDrawer('history'));
  document.getElementById('wordmark')?.addEventListener('click', () => {
    closeDrawer({ restoreFocus: false });
    document.body.classList.remove('is-exploring');
    setActiveView('overview');
    flyTo(viewFor('overview'));
  });

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.view;
      if (!VIEWS[name]) return;
      document.body.classList.add('is-exploring');
      setActiveView(name);
      flyTo(viewFor(name));
    });
  });

  document.querySelectorAll('[data-light]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.light;
      if (!SKY_PRESETS[name] || name === document.body.dataset.light) return;
      applyLightPreset(name, { fade: true });
    });
  });

  document.getElementById('drawer-close')?.addEventListener('click', () => closeDrawer());
  drawerBackdrop.addEventListener('click', () => closeDrawer());
  drawerPrev.addEventListener('click', () => navigateDrawer(-1));
  drawerNext.addEventListener('click', () => navigateDrawer(1));

  controls.addEventListener('start', () => {
    document.body.classList.add('is-exploring');
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('drawer-open')) {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== 'Tab' || !document.body.classList.contains('drawer-open')) return;
    const focusable = drawer.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('resize', onResize);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, highQuality ? 2 : 1.5));
  renderer.setSize(width, height);
}

/* ------------------------------------------------------------------ *
 *  Loading
 * ------------------------------------------------------------------ */

function fail(error) {
  console.error(error);
  loaderPhase.textContent = 'The 3D view could not be started';
  loaderPercent.textContent = '—';
  loaderFill.style.width = '100%';
  loaderFill.style.background = '#b34b33';
}

async function init() {
  setProgress(3, 'Preparing the site');
  await nextFrame();

  pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const facadeTex = await stageStep(10, 'Mixing the concrete', () => createFacadeTextures());
  const drumTex = await stageStep(24, 'Forming the upper drum', () => createDrumTextures());
  const trimTex = await stageStep(36, 'Casting the details', () => createTrimTextures());
  const roofTex = await stageStep(46, 'Weathering the roof', () => createRoofTextures());
  const graffitiTex = await stageStep(54, 'Painting the base', () => createGraffitiTextures());

  const materials = await stageStep(58, 'Assembling materials', () =>
    createMaterials(facadeTex, drumTex, trimTex, roofTex, graffitiTex)
  );

  const sky = await stageStep(64, 'Lighting the sky', () => getSky('afternoon'));

  environment = await stageStep(68, 'Planting the Augarten', () => buildEnvironment());
  scene.add(environment.group);

  tower = await stageStep(82, 'Raising the tower', () => buildTower(materials, graffitiTex));
  scene.add(tower.group);

  tower.group.traverse((object) => {
    if (!object.isMesh) return;
    if (object.name === 'roof-weeds') return;
    if (object.material && object.material.transparent) return;
    occluders.push(object);
  });

  buildHotspotButtons(tower.hotspots);

  setProgress(90, 'Placing the light');
  await nextFrame();
  applyLightPreset('afternoon');
  scene.environment = sky.env;
  scene.background = sky.texture;
  sun.target.position.set(0, 20, 0);
  sun.position.copy(sky.sunDirection).multiplyScalar(215).add(sun.target.position);

  const initialView = viewFor('overview');
  camera.position.copy(initialView.position);
  controls.target.copy(initialView.target);
  camera.fov = initialView.fov;
  camera.updateProjectionMatrix();
  controls.update();

  bindUI();

  setProgress(95, 'Compiling the scene');
  await nextFrame();
  await renderer.compileAsync(scene, camera);
  await nextFrame();

  renderer.render(scene, camera);

  setProgress(100, 'Ready');
  await nextFrame();

  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
  loader.classList.add('is-hidden');
  loader.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => {
    loader.style.display = 'none';
  }, 1000);

  const intro = viewFor('overview');
  camera.position.set(126, 88, 176);
  controls.target.set(0, 18, 0);
  controls.update();
  flyTo(intro, { duration: reducedMotion ? 0 : 3.1, intro: true });

  animate();

  console.info(
    `[Flakturm] ${renderer.info.render.triangles.toLocaleString()} triangles · ` +
    `${renderer.info.render.calls} draw calls · quality ${highQuality ? 'high' : 'adaptive'}`
  );
}

/* ------------------------------------------------------------------ *
 *  Render loop
 * ------------------------------------------------------------------ */

let previous = performance.now();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  elapsed += dt;

  updateFly(dt);
  if (!fly) {
    controls.update();
    if (camera.position.y < 2.2) camera.position.y = 2.2;
  }
  if (environment && environment.update) environment.update(elapsed);
  updateHotspots(now);

  renderer.render(scene, camera);
}

init().catch(fail);
