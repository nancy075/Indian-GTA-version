/* INDIA DRIVE 3D — Three.js renderer + boot. Logic lives in game.js (portable). */
import * as THREE from "three";
import {
  createGame, update, populate, TILE, COLS, ROWS, WORLD_W, WORLD_H,
  T_BUILDING, T_ROAD, T_SIDEWALK, T_PLAZA, CENTER_LINES, grid, gi, solidAt,
  VEH, BUILDING_COLORS, missionColor, missionLabel, titleFor, fmtTime, clamp, dist
} from "./game.js";

const $ = (id) => document.getElementById(id);

// ---------------- audio (WebAudio synth, ported from 2D) ----------------
let AC = null, master = null, sirenGain = null, engineOsc = null, engineGain = null;
let muted = false;
function beep(freq, dur, type, vol, when) {
  if (!AC) return;
  const t = AC.currentTime + (when || 0);
  const o = AC.createOscillator(), g2 = AC.createGain();
  o.type = type || "square";
  o.frequency.value = freq;
  g2.gain.setValueAtTime(vol || 0.12, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g2); g2.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
const honkSound = () => { beep(460 + Math.random() * 140, 0.16, "square", 0.11); beep(360 + Math.random() * 80, 0.28, "square", 0.11, 0.18); };
const cashSound = () => { beep(880, 0.09, "sine", 0.15); beep(1318, 0.16, "sine", 0.15, 0.09); };
const jepSound = () => beep(220, 0.2, "sawtooth", 0.1);
const levelSound = () => { beep(660, 0.12, "square", 0.14); beep(880, 0.12, "square", 0.14, 0.12); beep(1320, 0.2, "square", 0.14, 0.26); };
function crashSound() {
  if (!AC) return;
  const len = Math.floor(AC.sampleRate * 0.18);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = AC.createBufferSource(); src.buffer = buf;
  const g2 = AC.createGain(); g2.gain.value = 0.3;
  src.connect(g2); g2.connect(master); src.start();
}
function gunshotSound() {
  if (!AC) return;
  const len = Math.floor(AC.sampleRate * 0.08);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1100;
  const g2 = AC.createGain(); g2.gain.value = 0.5;
  src.connect(f); f.connect(g2); g2.connect(master); src.start();
}
function explosionSound() {
  if (!AC) return;
  const len = Math.floor(AC.sampleRate * 0.9);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 380;
  const g2 = AC.createGain(); g2.gain.value = 0.8;
  src.connect(f); f.connect(g2); g2.connect(master); src.start();
  const o = AC.createOscillator(), og = AC.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(90, AC.currentTime);
  o.frequency.exponentialRampToValueAtTime(32, AC.currentTime + 0.5);
  og.gain.setValueAtTime(0.5, AC.currentTime);
  og.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.7);
  o.connect(og); og.connect(master); o.start(); o.stop(AC.currentTime + 0.75);
}

function initAudio() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain();
  master.gain.value = 0.6;
  master.connect(AC.destination);

  const siren = AC.createOscillator();
  siren.type = "triangle";
  siren.frequency.value = 700;
  const lfo = AC.createOscillator(); lfo.frequency.value = 1.4;
  const lfoG = AC.createGain(); lfoG.gain.value = 120;
  lfo.connect(lfoG); lfoG.connect(siren.frequency);
  sirenGain = AC.createGain(); sirenGain.gain.value = 0;
  siren.connect(sirenGain); sirenGain.connect(master);
  siren.start(); lfo.start();

  engineOsc = AC.createOscillator();
  engineOsc.type = "sawtooth";
  engineOsc.frequency.value = 55;
  const filt = AC.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 320;
  engineGain = AC.createGain(); engineGain.gain.value = 0;
  engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(master);
  engineOsc.start();
}
function audioUpdate(g) {
  if (!AC) return;
  const stars = Math.floor(g.wanted);
  let vol = 0;
  if (stars >= 1 && (g.cops.length + g.copCars.length) > 0 && !muted) {
    const near = Math.min(...g.cops.concat(g.copCars).map((c) => dist(c.x, c.y, g.player.x, g.player.y)), 9999);
    vol = 0.05 + 0.12 * clamp(1 - near / 900, 0, 1);
  }
  sirenGain.gain.setTargetAtTime(clamp(vol, 0, 0.2), AC.currentTime, 0.25);
  const inCar = !g.player.onFoot;
  if (inCar && !muted) {
    const sp = Math.abs(g.player.vehicle.speed);
    engineOsc.frequency.setTargetAtTime(45 + sp * 0.5, AC.currentTime, 0.1);
    engineGain.gain.setTargetAtTime(0.05 + clamp(sp / 400, 0, 1) * 0.06, AC.currentTime, 0.15);
  } else engineGain.gain.setTargetAtTime(0, AC.currentTime, 0.1);
}
function toggleMute(g) {
  if (!master) return;
  muted = !muted;
  master.gain.value = muted ? 0 : 0.6;
  toast(g, muted ? "SOUND OFF" : "SOUND ON");
}

// ---------------- desi radio (procedural music) ----------------
let _noiseBuf = null;
function noiseBuf() {
  if (_noiseBuf) return _noiseBuf;
  const len = Math.floor(AC.sampleRate * 0.2);
  _noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
  const d = _noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return _noiseBuf;
}
const RADIO_STATIONS = [
  { name: "\u092e\u0941\u0902\u092c\u0908 MASALA FM", bpm: 148, root: 587.33, scale: [0, 2, 3, 7, 9],  bass: [0, 0, 3, 5] },
  { name: "MIRCHI DHAMAKA", bpm: 126, root: 523.25, scale: [0, 3, 5, 7, 10], bass: [0, 5, 3, 7] },
  { name: "GULLY ROCK 101", bpm: 164, root: 493.88, scale: [0, 2, 4, 7, 9],  bass: [0, 0, 7, 5] }
];
let radioOn = false, stationIdx = 0, radioStep = 0, radioNext = 0, radioTimer = null;
function kickAt(t) {
  const o = AC.createOscillator(), g2 = AC.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g2.gain.setValueAtTime(0.5, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g2); g2.connect(master);
  o.start(t); o.stop(t + 0.2);
}
function hatAt(t) {
  const src = AC.createBufferSource(); src.buffer = noiseBuf();
  const f = AC.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 6500;
  const g2 = AC.createGain();
  g2.gain.setValueAtTime(0.07, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  src.connect(f); f.connect(g2); g2.connect(master);
  src.start(t); src.stop(t + 0.05);
}
function tablaAt(t, hi) {
  const o = AC.createOscillator(), g2 = AC.createGain();
  o.type = "triangle";
  o.frequency.value = hi ? 466 : 233;
  g2.gain.setValueAtTime(hi ? 0.16 : 0.2, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + (hi ? 0.09 : 0.16));
  o.connect(g2); g2.connect(master);
  o.start(t); o.stop(t + 0.2);
}
function bassAt(t, semi) {
  const o = AC.createOscillator(), g2 = AC.createGain();
  o.type = "sawtooth";
  o.frequency.value = 110 * Math.pow(2, semi / 12);
  const f = AC.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 340;
  g2.gain.setValueAtTime(0.13, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o.connect(f); f.connect(g2); g2.connect(master);
  o.start(t); o.stop(t + 0.26);
}
function pluckAt(t, freq, vol) {
  const o = AC.createOscillator(), g2 = AC.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g2.gain.setValueAtTime(vol, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  o.connect(g2); g2.connect(master);
  o.start(t); o.stop(t + 0.14);
}
function scheduleRadio() {
  if (!AC || !radioOn || muted) return;
  const st = RADIO_STATIONS[stationIdx];
  const stepDur = 60 / st.bpm / 2;
  while (radioNext < AC.currentTime + 0.3) {
    const s = radioStep % 16;
    const t = radioNext;
    if (s % 8 === 0 || s === 10) kickAt(t);
    if (s % 4 === 0 && s !== 8) kickAt(t + stepDur * 0.5);
    if (s % 2 === 1) hatAt(t);
    if (s === 4 || s === 12) tablaAt(t, false);
    if (s === 6 || s === 14) tablaAt(t, true);
    if (s % 8 === 0 || s % 8 === 5) bassAt(t, st.bass[Math.floor(s / 4) % 4]);
    if (Math.random() < 0.55) {
      const deg = st.scale[Math.floor(Math.random() * st.scale.length)];
      pluckAt(t, st.root * Math.pow(2, deg / 12), 0.09);
      if (Math.random() < 0.3) pluckAt(t + stepDur * 0.5, st.root * 2 * Math.pow(2, deg / 12), 0.06);
    }
    radioNext += stepDur;
    radioStep++;
  }
}
function toggleRadio(g, silent) {
  radioOn = !radioOn;
  if (radioOn) {
    if (!AC) initAudio();
    radioNext = AC.currentTime + 0.1; radioStep = 0;
    if (!radioTimer) radioTimer = setInterval(scheduleRadio, 120);
    if (!silent) toast(g, "RADIO ON \u2014 " + RADIO_STATIONS[stationIdx].name);
  } else if (!silent) toast(g, "RADIO OFF");
}
function cycleStation(g) {
  if (!radioOn) { toggleRadio(g); return; }
  stationIdx = (stationIdx + 1) % RADIO_STATIONS.length;
  radioStep = 0; radioNext = AC.currentTime + 0.1;
  toast(g, "RADIO \u2014 " + RADIO_STATIONS[stationIdx].name);
}

// ---------------- three.js setup ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.classList.add("webgl");
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8ec9ef, 220, 950);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1400);

const hemi = new THREE.HemisphereLight(0xbde4ff, 0x8d7b5f, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -280; sun.shadow.camera.right = 280;
sun.shadow.camera.top = 280; sun.shadow.camera.bottom = -280;
sun.shadow.camera.far = 700;
sun.shadow.bias = -0.0006;
scene.add(sun); scene.add(sun.target);

const headlight = new THREE.SpotLight(0xffe9b0, 0, 90, 0.55, 0.5, 1.2);
scene.add(headlight); scene.add(headlight.target);

// ---------------- world meshes ----------------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(WORLD_W + 200, WORLD_H + 200),
  new THREE.MeshLambertMaterial({ color: 0xb5a48c })
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(WORLD_W / 2, -0.05, WORLD_H / 2);
ground.receiveShadow = true;
scene.add(ground);

// tiles (road / plaza) + lane dashes as vertex-colored quads
(function buildTiles() {
  const pos = [], col = [];
  const quad = (x0, y0, x1, y1, r, g2, b, y = 0.02) => {
    pos.push(x0, y, y0, x1, y, y0, x1, y, y1, x0, y, y0, x1, y, y1, x0, y, y1);
    for (let i = 0; i < 6; i++) col.push(r, g2, b);
  };
  for (let cr = 0; cr < ROWS; cr++) {
    for (let cc = 0; cc < COLS; cc++) {
      const t = grid[gi(cc, cr)];
      const x0 = cc * TILE, y0 = cr * TILE;
      if (t === T_ROAD) quad(x0, y0, x0 + TILE, y0 + TILE, 0.235, 0.235, 0.26);
      else if (t === T_PLAZA) quad(x0 + 2, y0 + 2, x0 + TILE - 2, y0 + TILE - 2, 0.5, 0.68, 0.43, 0.03);
    }
  }
  const dm = 1.6;   // dash half-width
  for (const cline of CENTER_LINES) {
    for (let p = 40; p < WORLD_W - 40; p += 52) {
      quad(cline - dm, p, cline + dm, p + 26, 0.86, 0.78, 0.42, 0.04);
      quad(p, cline - dm, p + 26, cline + dm, 0.86, 0.78, 0.42, 0.04);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  scene.add(mesh);
})();

// window-grid texture shared by all buildings
function buildingTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const g2 = c.getContext("2d");
  g2.fillStyle = "#f2ede4";
  g2.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 128; y += 14) {
    for (let x = 6; x < 64; x += 16) {
      g2.fillStyle = Math.random() < 0.22 ? "#cfe3f7" : "#26273a";
      g2.fillRect(x, y, 9, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 5);
  return tex;
}

// buildings (instanced boxes, warm palette)
let buildingsInst;
(function buildBuildings() {
  const list = [];
  for (let cr = 0; cr < ROWS; cr++) {
    for (let cc = 0; cc < COLS; cc++) {
      if (grid[gi(cc, cr)] !== T_BUILDING) continue;
      list.push({ x: cc * TILE + TILE / 2, y: cr * TILE + TILE / 2,
        h: 10 + Math.random() * 26, c: new THREE.Color(BUILDING_COLORS[(cc * 7 + cr * 13) % BUILDING_COLORS.length]) });
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const tex = buildingTexture();
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  const inst = new THREE.InstancedMesh(geo, mat, list.length);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  list.forEach((b, i) => {
    m4.makeScale(TILE * 0.94, b.h, TILE * 0.94);
    m4.setPosition(b.x, b.h / 2, b.y);
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, b.c);
  });
  scene.add(inst);
  buildingsInst = inst;
})();

// street lamps
const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0x2c2c24, emissive: 0xffd977, emissiveIntensity: 0 });
(function buildLamps() {
  const spots = [];
  for (const cx of CENTER_LINES) for (const cy of CENTER_LINES) {
    spots.push([cx - 46, cy - 46], [cx + 46, cy + 46]);
  }
  const poleG = new THREE.CylinderGeometry(0.4, 0.55, 17, 6);
  const headG = new THREE.SphereGeometry(1.5, 8, 6);
  const poleM = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const poles = new THREE.InstancedMesh(poleG, poleM, spots.length);
  const heads = new THREE.InstancedMesh(headG, lampHeadMat, spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach(([x, y], i) => {
    m4.identity(); m4.setPosition(x, 8.5, y);
    poles.setMatrixAt(i, m4);
    m4.setPosition(x, 17.5, y);
    heads.setMatrixAt(i, m4);
  });
  scene.add(poles); scene.add(heads);
})();

// trees on plazas
(function buildTrees() {
  const spots = [];
  for (let cr = 0; cr < ROWS; cr++) for (let cc = 0; cc < COLS; cc++) {
    if (grid[gi(cc, cr)] === T_PLAZA && (cc + cr) % 2 === 0)
      spots.push({ x: cc * TILE + 10 + Math.random() * 20, y: cr * TILE + 10 + Math.random() * 20, h: 6 + Math.random() * 4 });
  }
  const trunkG = new THREE.CylinderGeometry(0.7, 0.9, 5, 5);
  const trunkM = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafG = new THREE.ConeGeometry(4.5, 9, 7);
  const leafM = new THREE.MeshLambertMaterial({ color: 0x2f7d3a });
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, spots.length);
  const leaves = new THREE.InstancedMesh(leafG, leafM, spots.length);
  leaves.castShadow = true;
  const m4 = new THREE.Matrix4();
  spots.forEach((s, i) => {
    m4.identity(); m4.setPosition(s.x, 2.5, s.y);
    trunks.setMatrixAt(i, m4);
    m4.setPosition(s.x, 5 + s.h / 2, s.y);
    leaves.setMatrixAt(i, m4);
  });
  scene.add(trunks); scene.add(leaves);
})();

// landmarks: gold bank + temple spires at some plazas
const bankMesh = new THREE.Mesh(
  new THREE.BoxGeometry(46, 34, 30),
  new THREE.MeshLambertMaterial({ color: 0xd4af37 })
);
bankMesh.position.set(CENTER_LINES[1] + 60, 17, CENTER_LINES[5] + 60);
bankMesh.castShadow = true;
scene.add(bankMesh);

// generic low-poly car factory
function makeCar(type, bodyColor) {
  const spec = VEH[type];
  const grp = new THREE.Group();
  const L = spec.h, W = spec.w, H = type === "scooter" ? 4 : 8;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), new THREE.MeshLambertMaterial({ color: bodyColor }));
  body.position.y = H / 2 + 2;
  body.castShadow = true;
  grp.add(body);
  if (type !== "scooter") {
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.82, H * 0.8, L * (type === "auto" ? 0.4 : 0.45)),
      new THREE.MeshLambertMaterial({ color: 0x1c2430 })
    );
    cabin.position.set(0, H + H * 0.4, type === "auto" ? L * 0.16 : -L * 0.05);
    cabin.castShadow = true;
    grp.add(cabin);
  }
  const wg = new THREE.BoxGeometry(4, 6, 6);
  const wm = new THREE.MeshLambertMaterial({ color: 0x14161c });
  [[-W / 2 - 1, L * 0.28], [W / 2 + 1, L * 0.28], [-W / 2 - 1, -L * 0.28], [W / 2 + 1, -L * 0.28]]
    .forEach(([x, z]) => {
      const w = new THREE.Mesh(wg, wm);
      w.position.set(x, 3, z);
      grp.add(w);
    });
  grp.userData.bodyLength = L;
  return grp;
}

// beacons
function makeBeacon(color) {
  const grp = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 46, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  );
  pillar.position.y = 23;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(7.5, 0.7, 8, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.3;
  grp.add(pillar); grp.add(ring);
  grp.userData.ring = ring;
  return grp;
}
const missionBeacon = makeBeacon(0xffd400);
missionBeacon.visible = false;
scene.add(missionBeacon);
const bankBeacon = makeBeacon(0xff4d4d);
bankBeacon.position.set(CENTER_LINES[1] + 60, 0, CENTER_LINES[5] + 60);
scene.add(bankBeacon);
const pnsBeacon = makeBeacon(0x2ecc71); pnsBeacon.scale.setScalar(0.5); scene.add(pnsBeacon);
const chaiBeacon = makeBeacon(0xff9800); chaiBeacon.scale.setScalar(0.5); scene.add(chaiBeacon);

// ---------------- tracers & explosions ----------------
const tracers = [];
for (let i = 0; i < 14; i++) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
  line.visible = false;
  scene.add(line);
  tracers.push({ line, life: 0 });
}
function spawnTracer(x, y, ax, ay) {
  const t = tracers.find((t) => !t.line.visible) || tracers[0];
  const pos = t.line.geometry.attributes.position;
  pos.setXYZ(0, x, 1.4, y); pos.setXYZ(1, ax, 1.4, ay);
  pos.needsUpdate = true;
  t.line.visible = true;
  t.line.material.opacity = 0.9;
  t.life = 0.09;
}
const explosions = [];
for (let i = 0; i < 6; i++) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(5, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xff7b1c, transparent: true, opacity: 0.95 }));
  s.visible = false;
  scene.add(s);
  explosions.push({ mesh: s, life: 0 });
}
function spawnExplosion(x, y) {
  const e = explosions.find((e) => !e.mesh.visible) || explosions[0];
  e.mesh.position.set(x, 3, y);
  e.mesh.scale.setScalar(0.3);
  e.mesh.material.opacity = 0.95;
  e.mesh.visible = true;
  e.life = 0.5;
}
function fxUpdate(dt) {
  for (const t of tracers) if (t.line.visible) {
    t.life -= dt;
    if (t.life <= 0) t.line.visible = false;
  }
  for (const e of explosions) if (e.mesh.visible) {
    e.life -= dt;
    if (e.life <= 0) { e.mesh.visible = false; continue; }
    e.mesh.scale.setScalar(0.3 + (1 - e.life / 0.5) * 2.6);
    e.mesh.material.opacity = 0.95 * (1 - e.life / 0.5);
  }
}

// ---------------- entity sync maps ----------------
const carMeshes = new Map();   // vehicle obj -> mesh
const pedMeshes = new Map();
const copMeshes = new Map();
const footPlayer = new THREE.Group();
(function buildFootPlayer() {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 9, 8), new THREE.MeshLambertMaterial({ color: 0x4f83e0 }));
  body.position.y = 4.5; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 8), new THREE.MeshLambertMaterial({ color: 0xb9855c }));
  head.position.y = 11;
  footPlayer.add(body); footPlayer.add(head);
})();
footPlayer.visible = false;
scene.add(footPlayer);

const arrowGrp = new THREE.Group();
const arrowCone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 7, 4), new THREE.MeshBasicMaterial({ color: 0xffd400 }));
arrowCone.rotation.z = -Math.PI / 2;
arrowGrp.add(arrowCone);
scene.add(arrowGrp);

function syncCopMeshes(g) {
  if (g.wanted === 0) {
    for (const [, m] of copMeshes) scene.remove(m);
    copMeshes.clear();
    return;
  }
  const seen = new Set();
  for (const c of g.cops) {
    seen.add(c);
    let m = copMeshes.get(c);
    if (!m) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 6.5, 7),
        new THREE.MeshLambertMaterial({ color: 0x5a6b4a }));
      body.position.y = 3.2;
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.9, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xb9855c }));
      head.position.y = 7.8;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.8, 8),
        new THREE.MeshLambertMaterial({ color: 0x3d4d33 }));
      cap.position.y = 9;
      grp.add(body); grp.add(head); grp.add(cap);
      scene.add(grp);
      copMeshes.set(c, grp);
      m = grp;
    }
    const ang = Math.atan2(g.player.y - c.y, g.player.x - c.x);
    m.position.set(c.x, 0, c.y);
    m.rotation.y = Math.PI / 2 - ang;
  }
  for (const [c, m] of copMeshes) if (!seen.has(c)) { scene.remove(m); copMeshes.delete(c); }
}

function syncCarMeshes(g) {
  const all = g.vehicles.concat(g.copCars);
  const seen = new Set();
  for (const v of all) {
    if (seen.has(v)) continue;
    seen.add(v);
    let m = carMeshes.get(v);
    if (!m) {
      m = makeCar(v.type, v.mode === "police" ? "#f4f4f4" : v.bodyColor);
      if (v.mode === "police") {
        const light = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xff2222 }));
        light.position.y = 12;
        light.visible = false;
        m.add(light);
        m.userData.siren = light;
      }
      scene.add(m);
      carMeshes.set(v, m);
    }
    m.position.set(v.x, 0, v.y);
    m.rotation.y = Math.PI / 2 - v.ang;
    if (v.mode === "wrecked" && !m.userData.wrecked) {
      m.userData.wrecked = true;
      m.traverse((c) => { if (c.isMesh && c.material && c.material.color) c.material.color.multiplyScalar(0.3); });
      m.rotation.z = 0.08;
      if (m.userData.siren) m.userData.siren.visible = false;
    }
    if (m.userData.siren) {
      m.userData.siren.visible = Math.floor(g.wanted) >= 1;
      m.userData.siren.material.color.set(Math.floor(performance.now() / 220) % 2 ? 0xff2222 : 0x2b6bff);
    }
  }
  for (const [v, m] of carMeshes) {
    if (!seen.has(v)) { scene.remove(m); carMeshes.delete(v); }
  }
}
function syncPedMeshes(g) {
  const seen = new Set();
  for (const p of g.peds) {
    seen.add(p);
    let m = pedMeshes.get(p);
    if (!m) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 6.5, 7),
        new THREE.MeshLambertMaterial({ color: p.color }));
      body.position.y = 3.2;
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.9, 8, 6), new THREE.MeshLambertMaterial({ color: 0xb9855c }));
      head.position.y = 7.8;
      grp.add(body); grp.add(head);
      scene.add(grp);
      pedMeshes.set(p, grp);
      m = grp;
    }
    if (p.dead) {
      m.position.set(p.x, 0.6, p.y);
      m.rotation.z = Math.PI / 2;
    } else {
      m.rotation.z = 0;
      m.position.set(p.x, 0, p.y);
      m.rotation.y = Math.PI / 2 - p.vax * (Math.PI / 2);
    }
  }
  const dead = [...pedMeshes.keys()].filter((p) => !seen.has(p));
  for (const p of dead) { scene.remove(pedMeshes.get(p)); pedMeshes.delete(p); }
}

// ---------------- minimap ----------------
const mini = $("minimap"), mctx = mini.getContext("2d");
const miniBase = document.createElement("canvas");
miniBase.width = 200; miniBase.height = 200;
(function renderMini() {
  const mc = miniBase.getContext("2d");
  mc.fillStyle = "#94887a";
  mc.fillRect(0, 0, 200, 200);
  const s = 200 / Math.max(WORLD_W, WORLD_H);
  for (let cr = 0; cr < ROWS; cr += 2) {
    for (let cc = 0; cc < COLS; cc += 2) {
      const t = grid[gi(cc, cr)];
      mc.fillStyle = t === T_ROAD ? "#55555e" : t === T_BUILDING ? "#a08b74" : t === T_PLAZA ? "#6d9c5c" : "#94887a";
      mc.fillRect(cc * TILE * s, cr * TILE * s, 3, 3);
    }
  }
})();
function drawMinimap(g) {
  const s = 200 / Math.max(WORLD_W, WORLD_H);
  mctx.clearRect(0, 0, 200, 200);
  mctx.drawImage(miniBase, 0, 0);
  mctx.fillStyle = "#ffe08a";
  for (const v of g.vehicles) mctx.fillRect(v.x * s - 1, v.y * s - 1, 2, 2);
  mctx.fillStyle = "#2ecc71"; mctx.fillRect(g.pns.x * s - 2, g.pns.y * s - 2, 4, 4);
  mctx.fillStyle = "#ff9800"; mctx.fillRect(g.chai.x * s - 2, g.chai.y * s - 2, 4, 4);
  mctx.fillStyle = "#ff4d4d"; mctx.fillRect(g.bank.x * s - 2, g.bank.y * s - 2, 4, 4);
  if (g.wanted >= 1) {
    mctx.fillStyle = Math.floor(performance.now() / 250) % 2 ? "#ff4444" : "#ffaaaa";
    for (const v of g.copCars) mctx.fillRect(v.x * s - 2, v.y * s - 2, 4, 4);
    for (const c of g.cops) mctx.fillRect(c.x * s - 1, c.y * s - 1, 3, 3);
  }
  const mc = g.mission;
  if (mc) {
    mctx.fillStyle = missionColor(g);
    mctx.beginPath(); mctx.arc(mc.to.x * s, mc.to.y * s, 3 + Math.sin(performance.now() / 180) * 1.2, 0, Math.PI * 2); mctx.fill();
  }
  mctx.fillStyle = "#fff";
  mctx.strokeStyle = "#000";
  mctx.lineWidth = 1;
  mctx.beginPath(); mctx.arc(g.player.x * s, g.player.y * s, 3, 0, Math.PI * 2); mctx.fill(); mctx.stroke();
}

// ---------------- HUD ----------------
let lastStars = -1, lastMissionHud = "", lastLevel = -1;
function hudUpdate(g) {
  const stars = Math.floor(g.wanted);
  if (stars !== lastStars) {
    lastStars = stars;
    let html = "";
    for (let i = 0; i < 5; i++) html += i < stars ? "★" : "<span class='dim'>☆</span>";
    $("stars").innerHTML = html;
  }
  $("money").textContent = "₹" + g.player.money;
  if (g.level !== lastLevel) {
    lastLevel = g.level;
    $("level").textContent = "Lv " + g.level + " · " + titleFor(g.level);
  }
  if (g.missionHud !== lastMissionHud) {
    lastMissionHud = g.missionHud;
    $("mission").textContent = g.missionHud;
  }
  $("health").style.width = clamp(g.player.health, 0, 100) + "%";
  $("health").style.background = g.player.health > 50 ? "linear-gradient(90deg,#6ecc6e,#a3e29f)"
    : g.player.health > 25 ? "linear-gradient(90deg,#e8c34a,#f3da82)" : "linear-gradient(90deg,#e05252,#ff8a80)";
  const car = !g.player.onFoot && g.player.vehicle;
  if (car && car.spec) {
    const hpMax = car.spec.hp || 100;
    const frac = clamp((car.hp ?? hpMax) / hpMax, 0, 1);
    $("vehwrap").style.display = "block";
    $("vehbar").style.width = frac * 100 + "%";
    $("vehbar").style.background = frac > 0.4 ? "linear-gradient(90deg,#4aa3ff,#8ec9ff)"
      : "linear-gradient(90deg,#e05252,#ff8a80)";
  } else $("vehwrap").style.display = "none";
}
function toast(g, text) {
  const div = document.createElement("div");
  div.textContent = text;
  $("toasts").appendChild(div);
  setTimeout(() => div.remove(), 1700);
}
// ---------------- input ----------------
const keys = {};
let camMode = "chase";   // "chase" | "top"
const ray = new THREE.Raycaster();
const input = { up: false, down: false, left: false, right: false, sprint: false, enter: false, horn: false, fire: false, handbrake: false };
function readInput() {
  input.up = !!(keys["w"] || keys["arrowup"]);
  input.down = !!(keys["s"] || keys["arrowdown"]);
  input.left = !!(keys["a"] || keys["arrowleft"]);
  input.right = !!(keys["d"] || keys["arrowright"]);
  input.sprint = !!keys["shift"];
  input.fire = !!keys[" "];
  input.handbrake = !g.player.onFoot && !!keys[" "];
}
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (e.repeat) return;
  if (k === "e" && g.mode === "play") input.enter = true;
  if (k === "h" && g.mode === "play") input.horn = true;
  if (k === "m") toggleMute(g);
  if (k === "r" && g.mode === "play") { if (radioOn) cycleStation(g); else toggleRadio(g); }
  if (k === "v") { camMode = camMode === "chase" ? "top" : "chase"; toast(g, camMode === "top" ? "CITY VIEW" : "CHASE CAM"); }
  if (k === "p" && g.mode !== "intro") { g.mode = g.mode === "play" ? "pause" : "play"; toast(g, g.mode === "pause" ? "PAUSED" : "RESUMED"); }
});
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------- main loop ----------------
const g = createGame();
populate(g);
const clock = new THREE.Clock();
const bgCol = new THREE.Color(0x8ec9ef);
const camPos = new THREE.Vector3(g.player.x, 30, g.player.y + 40);

function frame() {
  requestAnimationFrame(frame);
  const dt = clock.getDelta();
  fxUpdate(dt);
  if (g.mode === "play") {
    readInput();
    update(g, dt, input);
    processEvents(g);
  }
  const p = g.player;
  const inCar = !p.onFoot && p.vehicle;
  const px = inCar ? p.vehicle.x : p.x;
  const py = inCar ? p.vehicle.y : p.y;
  const ang = inCar ? p.vehicle.ang : p.ang;

  // day/night
  const night = g.night;
  bgCol.setRGB(0.56 * (1 - night) + 0.03, 0.79 * (1 - night) + 0.045, 0.94 * (1 - night) + 0.14);
  scene.background = bgCol;
  scene.fog.color.copy(bgCol);
  lampHeadMat.emissiveIntensity = night * 2.2;
  hemi.intensity = 0.95 * (1 - night) + 0.18;
  sun.intensity = 1.3 * (1 - night) + 0.05;
  sun.position.set(px + 120 * (1 - night) + 20, 190, py + 80);
  sun.target.position.set(px, 0, py);

  // foot player / car arrow
  footPlayer.visible = !inCar && g.mode !== "intro";
  footPlayer.position.set(p.x, 0, p.y);
  footPlayer.rotation.y = Math.PI / 2 - p.ang;
  const tgt = g.mission && g.mission.to;
  arrowGrp.visible = !!tgt;
  if (tgt) {
    const a = Math.atan2(tgt.y - py, tgt.x - px);
    arrowGrp.position.set(px + Math.cos(a) * 13, inCar ? 9 : 7, py + Math.sin(a) * 13);
    arrowGrp.rotation.y = -a + Math.PI / 2;
  }

  // player vehicle highlight: beacon above player car handled by arrow; camera:
  if (g.mode !== "play") {
    const a = performance.now() * 0.00006;
    camera.position.set(WORLD_W / 2 + Math.cos(a) * 620, 380, WORLD_H / 2 + Math.sin(a) * 620);
    camera.lookAt(WORLD_W / 2, 0, WORLD_H / 2);
  } else if (camMode === "top") {
    camPos.lerp(new THREE.Vector3(px, 640, py + 40), 1 - Math.pow(0.001, dt));
    camera.position.copy(camPos);
    camera.lookAt(px, 0, py);
  } else {
    const back = inCar ? 27 : 13, up = inCar ? 11.5 : 6.5;
    const target = new THREE.Vector3(px, 2, py);
    const desired = new THREE.Vector3(px - Math.cos(ang) * back, up, py - Math.sin(ang) * back);
    ray.set(target, desired.clone().sub(target).normalize());
    ray.far = back + 2;
    const hits = ray.intersectObject(buildingsInst, false);
    let d = back;
    if (hits.length && hits[0].distance < back) d = Math.max(4, hits[0].distance * 0.8);
    camPos.lerp(new THREE.Vector3(px - Math.cos(ang) * d, up + (back - d) * 0.25, py - Math.sin(ang) * d), 1 - Math.pow(0.005, dt));
    camera.position.copy(camPos);
    camera.lookAt(px + Math.cos(ang) * 10, 2.2, py + Math.sin(ang) * 10);
  }

  // beacons
  if (tgt) {
    missionBeacon.visible = true;
    missionBeacon.position.set(tgt.x, 0, tgt.y);
    const c = new THREE.Color(missionColor(g));
    missionBeacon.userData.ring.material.color = c;
    missionBeacon.children[0].material.color = c;
  } else missionBeacon.visible = false;
  pnsBeacon.position.set(g.pns.x, 0, g.pns.y);
  chaiBeacon.position.set(g.chai.x, 0, g.chai.y);

  // headlights on player vehicle
  if (inCar && night > 0.15) {
    headlight.intensity = 400;
    headlight.position.set(px + Math.cos(ang) * 14, 5, py + Math.sin(ang) * 14);
    headlight.target.position.set(px + Math.cos(ang) * 70, 0, py + Math.sin(ang) * 70);
  } else headlight.intensity = 0;

  syncCarMeshes(g);
  syncPedMeshes(g);
  syncCopMeshes(g);
  audioUpdate(g);
  hudUpdate(g);
  drawMinimap(g);
  renderer.render(scene, camera);
}

function processEvents(g) {
  let big = null;
  for (const e of g.events) {
    if (e.type === "honk") honkSound();
    else if (e.type === "crash") crashSound();
    else if (e.type === "cash") cashSound();
    else if (e.type === "jep") { jepSound(); if (!radioOn) toggleRadio(g, true); }
    else if (e.type === "gunshot") { gunshotSound(); spawnTracer(e.x, e.y, e.ax, e.ay); }
    else if (e.type === "explosion") { explosionSound(); spawnExplosion(e.x, e.y); }
    else if (e.type === "levelup") levelSound();
    else if (e.type === "floater") toast(g, e.text);
    else if (e.type === "big") big = e;
  }
  g.events.length = 0;
  if (big) {
    $("bigmsg").textContent = big.text;
    $("submsg").textContent = big.sub;
    g.bigT = big.dur;
  }
  clearInterval(bigTimer);
  if (g.bigT > 0) {
    bigTimer = setInterval(() => {
      g.bigT -= 0.1;
      if (g.bigT <= 0) { $("bigmsg").textContent = ""; $("submsg").textContent = ""; clearInterval(bigTimer); }
    }, 100);
  }
}
let bigTimer = null;

// ---------------- boot ----------------
$("startBtn").addEventListener("click", () => {
  $("intro").style.display = "none";
  initAudio();
  g.mode = "play";
  evImmediate(g, "big", { text: "WELCOME TO MUMBAI", sub: "Follow the golden beacon — first parcel job", dur: 2.6 });
});
function evImmediate(g, type, extra) { g.events.push(Object.assign({ type }, extra || {})); }
frame();
