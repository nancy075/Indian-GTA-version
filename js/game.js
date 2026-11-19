/* INDIA DRIVE — a tiny 2D top-down GTA-style Indian city prototype.
   Vanilla JS + Canvas, no dependencies, no build step. */
(() => {
"use strict";

// ---------------- helpers ----------------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[randi(0, arr.length - 1)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function angleLerp(a, b, t) {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}
const $ = (id) => document.getElementById(id);

// ---------------- world ----------------
const TILE = 40, COLS = 60, ROWS = 60;
const WORLD_W = COLS * TILE, WORLD_H = ROWS * TILE;
const ROAD_STEP = 9;

const CENTER_LINES = [];
for (let k = 0; k * ROAD_STEP + 1 < COLS; k++) CENTER_LINES.push(k * ROAD_STEP * TILE + TILE);

const T_BUILDING = 0, T_ROAD = 1, T_SIDEWALK = 2, T_PLAZA = 3;
const grid = new Uint8Array(COLS * ROWS);
const gi = (c, r) => r * COLS + c;
function tileAt(x, y) {
  const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return T_BUILDING;
  return grid[gi(c, r)];
}
const solidAt = (x, y) => tileAt(x, y) === T_BUILDING;

for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++)
    if (c % ROAD_STEP < 2 || r % ROAD_STEP < 2) grid[gi(c, r)] = T_ROAD;
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    if (grid[gi(c, r)] === T_ROAD) continue;
    const cc = c % ROAD_STEP, rr = r % ROAD_STEP;
    if (cc === 2 || cc === 8 || rr === 2 || rr === 8) grid[gi(c, r)] = T_SIDEWALK;
  }
}
for (let i = 0; i < 12; i++) {
  const c0 = randi(4, COLS - 6), r0 = randi(4, ROWS - 6);
  const w = randi(2, 3), h = randi(2, 3);
  for (let r = r0; r < Math.min(r0 + h, ROWS); r++)
    for (let c = c0; c < Math.min(c0 + w, COLS); c++)
      if (grid[gi(c, r)] === T_BUILDING) grid[gi(c, r)] = T_PLAZA;
}

const SPOTS = [];
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++)
    if (grid[gi(c, r)] === T_SIDEWALK && (c + r) % 3 === 0)
      SPOTS.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });

const BUILDING_COLORS = ["#b96b45", "#b08050", "#9c5f3e", "#8d6e63", "#a1735a", "#b5764f", "#a26949", "#caa06a"];

const LABELS = ["RAM CHAI POINT", "SHARMA DHABA", "PAAN CORNER", "GHAR KI MITHAI",
  "MOBILE CLINIC", "CYCLE MART", "MUMBAI MASALA", "KIRANA STORE", "DOSA CORNER", "SUNLIGHT TAILORS",
  "MARINE DRIVE DHABA", "BANDRA BAKERY", "COLABA CAFE", "CHOWPATTY CORNER"];

// pre-render the whole map once
const mapCanvas = document.createElement("canvas");
mapCanvas.width = WORLD_W; mapCanvas.height = WORLD_H;
(function renderMap() {
  const mc = mapCanvas.getContext("2d");
  const labelSpots = [];
  const pool = [...LABELS].sort(() => Math.random() - 0.5);

  mc.fillStyle = "#a89a86";
  mc.fillRect(0, 0, WORLD_W, WORLD_H);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[gi(c, r)], x = c * TILE, y = r * TILE;
      if (t === T_ROAD) {
        mc.fillStyle = "#3b3b42";
        mc.fillRect(x, y, TILE, TILE);
      } else if (t === T_SIDEWALK) {
        continue;
      } else if (t === T_BUILDING) {
        const col = pick(BUILDING_COLORS);
        mc.fillStyle = col;
        mc.fillRect(x - 2, y - 2, TILE + 4, TILE + 4);
        mc.fillStyle = "rgba(0,0,0,0.18)";
        mc.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        if (Math.random() < 0.012 && labelSpots.length < pool.length) {
          labelSpots.push({ x: c, r, label: pool[labelSpots.length] });
        }
      } else if (t === T_PLAZA) {
        mc.fillStyle = "#7fae6e";
        mc.fillRect(x, y, TILE, TILE);
        mc.fillStyle = "#5e8f4f";
        if ((c + r) % 2 === 0) mc.fillRect(x + 8, y + 8, 10, 14);
      }
    }
  }

  // road lane markings along road centerlines
  mc.strokeStyle = "#d8c56b";
  mc.lineWidth = 3;
  mc.setLineDash([18, 22]);
  for (const cline of CENTER_LINES) {
    mc.beginPath(); mc.moveTo(cline, 0); mc.lineTo(cline, WORLD_H); mc.stroke();
    mc.beginPath(); mc.moveTo(0, cline); mc.lineTo(WORLD_W, cline); mc.stroke();
  }
  mc.setLineDash([]);

  // zebra crossings at intersections
  mc.fillStyle = "rgba(240,240,240,0.75)";
  for (const cx of CENTER_LINES) for (const cy of CENTER_LINES) {
    for (let i = 0; i < 4; i++) {
      mc.fillRect(cx - 30 + 2, cy - 38 + i * 9, 26, 5);
      mc.fillRect(cx + 6, cy - 38 + i * 9, 26, 5);
      mc.fillRect(cx - 38 + i * 9, cy - 30 + 2, 5, 26);
      mc.fillRect(cx - 38 + i * 9, cy + 6, 5, 26);
    }
  }

  // building name signs
  mc.font = "bold 9px sans-serif";
  mc.fillStyle = "#f5e9d0";
  for (const s of labelSpots) {
    const px = s.x * TILE, py = s.r * TILE;
    mc.fillStyle = "#241a12";
    mc.fillRect(px - 3, py + 6, TILE + 6, 13);
    mc.fillStyle = "#ffd977";
    mc.fillText(s.label, px - 2, py + 16);
  }
})();

// minimap base
const MAP_SCALE = 200 / Math.max(WORLD_W, WORLD_H);
const miniBase = document.createElement("canvas");
miniBase.width = 200; miniBase.height = 200;
(function renderMini() {
  const mc = miniBase.getContext("2d");
  mc.fillStyle = "#8d8171";
  mc.fillRect(0, 0, 200, 200);
  for (let r = 0; r < ROWS; r += 2) {
    for (let c = 0; c < COLS; c += 2) {
      const t = grid[gi(c, r)];
      mc.fillStyle = t === T_ROAD ? "#55555e" : t === T_BUILDING ? "#a08b74" : t === T_PLAZA ? "#6d9c5c" : "#94887a";
      mc.fillRect(c * TILE * MAP_SCALE, r * TILE * MAP_SCALE, 3, 3);
    }
  }
})();

// ---------------- audio ----------------
let AC = null, master = null, sirenOsc = null, sirenGain = null, sirenLfo = null;
function initAudio() {
  if (AC || !(window.AudioContext || window.webkitAudioContext)) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain();
  master.gain.value = 0.6;
  master.connect(AC.destination);

  sirenOsc = AC.createOscillator();
  sirenOsc.type = "triangle";
  sirenOsc.frequency.value = 700;
  sirenLfo = AC.createOscillator();
  sirenLfo.type = "sine";
  sirenLfo.frequency.value = 1.4;
  const lfoGain = AC.createGain();
  lfoGain.gain.value = 120;
  sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
  sirenGain = AC.createGain();
  sirenGain.gain.value = 0;
  sirenOsc.connect(sirenGain); sirenGain.connect(master);
  sirenOsc.start(); sirenLfo.start();
  initEngineAudio();
}

let engineOsc = null, engineGain = null;
function initEngineAudio() {
  if (engineOsc) return;
  engineOsc = AC.createOscillator();
  engineOsc.type = "sawtooth";
  engineOsc.frequency.value = 55;
  const filt = AC.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 320;
  engineGain = AC.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(filt); filt.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();
}
let muted = false;
function toggleMute() {
  if (!master) return;
  muted = !muted;
  master.gain.value = muted ? 0 : 0.6;
  floater(player.x, player.y - 40, muted ? "SOUND OFF" : "SOUND ON", "#ffffff");
}
function beep(freq, dur, type, vol, when) {
  if (!AC) return;
  const t = AC.currentTime + (when || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || "square";
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
function honkSound() { beep(rand( 460, 560), 0.16, "square", 0.10); beep(rand(360, 440), 0.28, "square", 0.10, 0.18); }
function crashSound() {
  if (!AC) return;
  const t = AC.currentTime, len = Math.floor(AC.sampleRate * 0.18);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = AC.createBufferSource(); src.buffer = buf;
  const g = AC.createGain(); g.gain.value = 0.3;
  src.connect(g); g.connect(master); src.start(t);
}
function cashSound() { beep(880, 0.09, "sine", 0.15); beep(1318, 0.16, "sine", 0.15, 0.09); }
function jepSound() { beep(220, 0.2, "sawtooth", 0.1); }
function doHorn() {
  honkSound();
  hornT = 0.7;
  for (const p of peds)
    if (!p.dead && dist(p.x, p.y, player.x, player.y) < 150) p.flee = Math.max(p.flee, 1.0);
}

// ---------------- entities ----------------
const DIRS = [ {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 0, y: -1} ];
const VEH = {
  auto:    { w: 24, h: 36, speed: 120,                             color: "#f2c02e", name: "Auto" },
  car:     { w: 28, h: 40, speed: 180, colors: ["#3f6fd8", "#c0392b", "#2e8b57", "#7f8c8d"], name: "Car" },
  truck:   { w: 32, h: 54, speed: 100,                             color: "#6c5ce7", name: "Truck" },
  scooter: { w: 14, h: 26, speed: 140,                             color: "#e67e22", name: "Scooter" },
  bus:     { w: 32, h: 58, speed: 105,                             color: "#d84315", name: "Bus" },
  police:  { w: 28, h: 42, speed: 230,                             color: "#f4f4f4", name: "Police" }
};

const player = { x: 0, y: 0, ang: 0, onFoot: true, health: 100, money: 0, vehicle: null, kurta: pick(["#4f83e0", "#5d3fd3", "#c2185b"]) };

let vehicles = [], peds = [], cops = [], copCars = [], decals = [], floaters = [];

function laneOffsetFor(axis, sign) {
  if (axis === "x") return sign > 0 ? -10 : 10;   // east left = north side
  return sign > 0 ? 10 : -10;                     // south left = east side
}
function nextCrossValue(pos, sign) {
  if (sign > 0) { for (const c of CENTER_LINES) if (c > pos + 4) return c; return null; }
  for (let i = CENTER_LINES.length - 1; i >= 0; i--) if (CENTER_LINES[i] < pos - 4) return CENTER_LINES[i];
  return null;
}
function angFor(axis, sign) {
  if (axis === "x") return sign > 0 ? 0 : Math.PI;
  return sign > 0 ? Math.PI / 2 : -Math.PI / 2;
}

function spawnTraffic(typeName) {
  typeName = typeName || pick(["auto", "car", "car", "scooter", "truck", "bus"]);
  const spec = VEH[typeName];
  const axis = Math.random() < 0.5 ? "x" : "y";
  const sign = pick([1, -1]);
  const base = pick(CENTER_LINES.slice(1, -1));
  let along = rand(80, (axis === "x" ? WORLD_H : WORLD_W) - 80);
  for (const c of CENTER_LINES) if (Math.abs(along - c) < 70) along += 150;
  along = clamp(along, 80, (axis === "x" ? WORLD_H : WORLD_W) - 80);
  const v = {
    type: typeName, spec, axis, sign, base,
    x: 0, y: 0, ang: 0, speed: spec.speed * rand(0.85, 1.1),
    mode: "traffic", next: null, targetAng: 0
  };
  const lane = base + laneOffsetFor(axis, sign);
  if (axis === "x") { v.y = lane; v.x = along; }
  else { v.x = lane; v.y = along; }
  v.next = nextCrossValue(along, sign);
  v.ang = v.targetAng = angFor(axis, sign);
  if (v.spec.colors) v.bodyColor = pick(v.spec.colors);
  vehicles.push(v);
}

function spawnInitialTraffic() {
  for (let i = 0; i < 46; i++) spawnTraffic();
}

function spawnPed(px, py) {
  if (px === undefined) {
    for (let tries = 0; tries < 30; tries++) {
      const s = pick(SPOTS);
      if (dist(s.x, s.y, player.x, player.y) > 260 && dist(s.x, s.y, player.x, player.y) < 900) {
        px = s.x; py = s.y; break;
      }
    }
    if (px === undefined) return;
  }
  peds.push({
    x: px, y: py,
    vax: pick([0, 1, 2, 3]), speed: rand(30, 55),
    color: pick(["#e91e63", "#2196f3", "#ffd54f", "#4caf50", "#f5f5f5", "#ff8a65", "#ce93d8"]),
    flee: 0, dead: false
  });
}

function spawnCop(x, y) { cops.push({ x, y, speed: rand(150, 175) }); }

function spawnCopCar() {
  const spec = VEH.police;
  const axis = pick(["x", "y"]), sign = pick([1, -1]);
  const base = pick(CENTER_LINES.slice(1, -1));
  let pos = rand(100, WORLD_W - 100);
  for (let tries = 0; tries < 30; tries++) {
    pos = rand(100, WORLD_W - 100);
    const d = axis === "x" ? dist(pos, base, player.x, player.y) : dist(base, pos, player.x, player.y);
    if (d > 500 && d < 1100) break;
  }
  const lane = base + laneOffsetFor(axis, sign);
  const v = {
    type: "police", spec, axis, sign, base,
    x: axis === "x" ? pos : lane, y: axis === "y" ? pos : lane,
    ang: angFor(axis, sign), speed: 0, mode: "police", hitCd: 0
  };
  copCars.push(v);
}

const SPAWN = { x: CENTER_LINES[2] + 20, y: CENTER_LINES[2] };
function resetPlayer(afterBusted) {
  player.x = SPAWN.x; player.y = SPAWN.y;
  player.onFoot = true;
  if (player.vehicle) { player.vehicle.mode = "parked"; player.vehicle = null; }
  player.health = 100;
  state.wanted = 0;
  state.bustTimer = 0;
  cops = []; copCars = [];
  if (afterBusted) {
    player.money = Math.max(0, player.money - 150);
    showBig("BUSTED", "The havaldar took ₹150 as 'chai-paani'.", 2.6);
  }
}

// ---------------- game state ----------------
const state = { wanted: 0, crimeCd: 0, bustTimer: 0, mode: "intro", bigT: 0, missionsDone: 0 };
let mission = null, missionCd = 2;

function newMission() {
  const far = (s) => dist(s.x, s.y, player.x, player.y) > 550;
  const cand = SPOTS.filter(far);
  mission = { phase: "pickup", to: pick(cand), reward: 350 };
  setMissionText();
}
function setMissionText() {
  $("mission").textContent = mission
    ? (mission.phase === "pickup" ? "📦 Parcel mission: pick up the parcel (yellow marker)"
                                 : "📦 Deliver the parcel (blue marker) — ₹" + mission.reward)
    : "New parcel mission in " + Math.ceil(missionCd) + "s…";
}
function addWanted(n, msg) {
  const before = Math.floor(state.wanted);
  state.wanted = clamp(state.wanted + n, 0, 5);
  state.crimeCd = 12;
  if (msg) floater(player.x, player.y - 40, msg, "#ff5252");
  if (Math.floor(state.wanted) > before && Math.floor(state.wanted) === 1) honkSound();
}
function floater(x, y, text, color) {
  floaters.push({ x, y, text, color: color || "#fff", t: 1.6 });
}
function showBig(text, sub, dur) {
  $("bigmsg").textContent = text;
  $("submsg").textContent = sub || "";
  state.bigT = dur;
}

// ---------------- input ----------------
const keys = {};
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (e.repeat) return;
  if (k === "e" && state.mode === "play") toggleVehicle();
  if (k === "h" && state.mode === "play") doHorn();
  if (k === "m" && state.mode === "play") toggleMute();
  if (k === "p" && state.mode !== "intro") state.mode = state.mode === "play" ? "pause" : "play";
});
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

const K = {
  up: () => keys["w"] || keys["arrowup"],
  down: () => keys["s"] || keys["arrowdown"],
  left: () => keys["a"] || keys["arrowleft"],
  right: () => keys["d"] || keys["arrowright"],
  sprint: () => keys["shift"]
};

// ---------------- update: player ----------------
function toggleVehicle() {
  if (player.onFoot) {
    let best = null, bd = 55;
    for (const v of vehicles.concat(copCars)) {
      if (v.mode === "police") continue;
      const d = dist(v.x, v.y, player.x, player.y);
      if (d < bd) { bd = d; best = v; }
    }
    if (best) {
      if (best.mode === "traffic") {
        addWanted(1, "CAR STOLEN!");
        peds.push({
          x: best.x + Math.cos(best.ang + Math.PI / 2) * (best.spec.h / 2 + 12),
          y: best.y + Math.sin(best.ang + Math.PI / 2) * (best.spec.h / 2 + 12),
          vax: randi(0, 3), speed: rand(30, 55),
          color: pick(["#e91e63", "#2196f3", "#ffd54f", "#4caf50"]),
          flee: 2.5, dead: false
        });
      }
      best.mode = "player";
      best.speed = 0;
      player.vehicle = best; player.onFoot = false;
      jepSound();
    }
  } else {
    const v = player.vehicle;
    v.mode = "parked";
    v.speed = 0;
    player.vehicle = null;
    player.onFoot = true;
    const px = Math.cos(v.ang + Math.PI / 2) * (v.spec.h / 2 + 12);
    player.x = v.x + px; player.y = v.y + Math.sin(v.ang + Math.PI / 2) * (v.spec.h / 2 + 12);
  }
}

function playerFootUpdate(dt) {
  let vx = (K.right() ? 1 : 0) - (K.left() ? 1 : 0);
  let vy = (K.down() ? 1 : 0) - (K.up() ? 1 : 0);
  if (vx || vy) {
    const len = Math.hypot(vx, vy);
    const sp = (K.sprint() ? 215 : 125) * dt;
    vx = vx / len * sp; vy = vy / len * sp;
    if (!tryMove(player, vx, vy, 9)) { /* blocked */ }
    player.ang = Math.atan2(vy, vx);
  }
  // AI traffic bumps hurt the pedestrian (you)
  for (const v of vehicles) {
    if (v.mode !== "traffic") continue;
    if (dist(v.x, v.y, player.x, player.y) < 20 && v.speed > 40) {
      player.health -= 14 * dt;
      tryMove(player, Math.cos(v.ang) * 40 * dt, Math.sin(v.ang) * 40 * dt, 9);
    }
  }
}

function tryMove(ent, dx, dy, r) {
  let moved = false;
  if (!boxSolid(ent.x + dx, ent.y, r)) { ent.x += dx; moved = true; }
  if (!boxSolid(ent.x, ent.y + dy, r)) { ent.y += dy; moved = true; }
  ent.x = clamp(ent.x, 10, WORLD_W - 10);
  ent.y = clamp(ent.y, 10, WORLD_H - 10);
  return moved;
}
function boxSolid(x, y, r) {
  return solidAt(x - r, y - r) || solidAt(x + r, y - r) || solidAt(x - r, y + r) || solidAt(x + r, y + r);
}

function playerCarUpdate(v, dt) {
  const spec = v.spec;
  const maxV = spec.speed * 1.35;
  if (K.up()) v.speed += 340 * dt;
  else if (K.down()) v.speed -= 400 * dt;
  else v.speed *= Math.pow(0.35, dt);
  v.speed = clamp(v.speed, -maxV * 0.5, maxV);
  const steer = (K.right() ? 1 : 0) - (K.left() ? 1 : 0);
  const dirSign = v.speed >= 0 ? 1 : -1;
  v.ang += steer * 2.7 * dt * clamp(Math.abs(v.speed) / 130, 0, 1) * dirSign;
  v.ang = ((v.ang + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

  const fx = Math.cos(v.ang), fy = Math.sin(v.ang);
  const step = v.speed * dt;
  const hit = (() => {
    const off = [
      [fx * 16, fy * 16], [-fx * 16, -fy * 16],
      [fx * 16 - fy * 9, fy * 16 + fx * 9],
      [fx * 16 + fy * 9, fy * 16 - fx * 9]
    ];
    for (const [ox, oy] of off) if (solidAt(v.x + ox, v.y + oy)) return true;
    return false;
  })();
  if (hit) {
    const impact = Math.abs(v.speed);
    if (impact > 190) {
      player.health -= (impact - 190) / 9;
      crashSound();
      floater(v.x, v.y - 30, "CRASH! -" + Math.round((impact - 190) / 9), "#ff8888");
    }
    v.speed *= -0.25;
  } else {
    v.x += fx * step; v.y += fy * step;
  }
  v.x = clamp(v.x, 20, WORLD_W - 20);
  v.y = clamp(v.y, 20, WORLD_H - 20);

  // collisions with other vehicles
  for (const o of vehicles.concat(copCars)) {
    if (o === v || o.mode === "player") continue;
    const d = dist(o.x, o.y, v.x, v.y);
    const rr = (Math.max(o.spec.w, o.spec.h) + Math.max(spec.w, spec.h)) / 2.4;
    if (d < rr) {
      const push = (rr - d);
      const nx = (o.x - v.x) / (d || 1), ny = (o.y - v.y) / (d || 1);
      o.x += nx * push; o.y += ny * push;
      tryShift(v, -nx * push * 0.5, -ny * push * 0.5);
      if (Math.abs(v.speed) > 120) {
        crashSound();
        if (o.mode === "police") { addWanted(1, "RAMMED THE POLICE!"); }
        else { addWanted(0.25); floater(o.x, o.y - 26, pick(["OYE!", "ARRE!", "AIYYO!"]), "#ffd977"); }
      }
      v.speed *= 0.7;
    }
  }

  // run over pedestrians
  if (Math.abs(v.speed) > 60) {
    for (const p of peds) {
      if (p.dead) continue;
      if (dist(p.x, p.y, v.x, v.y) < 16) {
        p.dead = true;
        decals.push({ x: p.x, y: p.y, r: rand(9, 13), color: "#7a1f1f", t: 60 });
        addWanted(1, "HIT & RUN!");
        honkSound();
      }
    }
  }
}
function tryShift(v, dx, dy) { v.x += dx; v.y += dy; }

// ---------------- update: traffic ----------------
const HONK_WORDS = ["PAW PAW!", "PO PO!", "BEEP BEEP!", "TRRRN!"];
function trafficUpdate(v, dt) {
  const along = v.axis === "x" ? v.x : v.y;
  let step = v.speed * dt;

  // brake if the player or another car sits right in front
  const dxn = v.axis === "x" ? v.sign : 0, dyn = v.axis === "y" ? v.sign : 0;
  const px = v.x + dxn * 42, py = v.y + dyn * 42;
  for (const o of vehicles.concat(copCars)) {
    if (o === v) continue;
    if (dist(o.x, o.y, px, py) < 26) {
      step *= 0.1;
      if (o.mode === "player" && Math.random() < 0.09) {
        honkSound(); floater(v.x, v.y - 30, pick(HONK_WORDS), "#ffd977");
      }
    }
  }
  if (player.onFoot && dist(player.x, player.y, px, py) < 24) {
    step *= 0.1;
    if (Math.random() < 0.09) { honkSound(); floater(v.x, v.y - 30, pick(HONK_WORDS), "#ffd977"); }
  }
  if (hornT > 0 && dist(v.x, v.y, player.x, player.y) < 130) step *= 0.2;

  let newAlong = along + v.sign * step;
  const crossed = v.next === null || (v.sign > 0 ? newAlong >= v.next : newAlong <= v.next);
  if (crossed) {
    const cx = v.axis === "x" ? (v.next ?? clamp(newAlong, 60, WORLD_W - 60)) : v.base;
    const cy = v.axis === "y" ? (v.next ?? clamp(newAlong, 60, WORLD_H - 60)) : v.base;
    v.x = cx; v.y = cy;
    turnVehicle(v, cx, cy);
  } else {
    if (v.axis === "x") v.x = newAlong; else v.y = newAlong;
  }
  v.ang = angleLerp(v.ang, v.targetAng, 10 * dt);
}

function turnVehicle(v, cx, cy) {
  const candidates = [];
  for (const axis of ["x", "y"]) {
    for (const sign of [1, -1]) {
      const pos = axis === "x" ? cx : cy;
      const next = nextCrossValue(pos, sign);
      const isStraight = axis === v.axis && sign === v.sign;
      const isReverse = axis === v.axis && sign === -v.sign;
      if (next !== null) candidates.push({ axis, sign, next, isStraight, isReverse });
    }
  }
  const usable = candidates.filter((c) => !c.isReverse);
  let choice = null;
  const straight = usable.find((c) => c.isStraight);
  if (straight && Math.random() < 0.55) choice = straight;
  else if (usable.length) choice = pick(usable);
  else if (candidates.length) choice = pick(candidates);
  if (!choice) { v.mode = "parked"; return; }
  v.axis = choice.axis; v.sign = choice.sign; v.next = choice.next;
  v.base = v.axis === "x" ? cy : cx;
  const lane = v.base + laneOffsetFor(v.axis, v.sign);
  if (v.axis === "x") v.y = lane; else v.x = lane;
  v.targetAng = angFor(v.axis, v.sign);
}

// ---------------- update: peds ----------------
function pedUpdate(p, dt) {
  if (p.dead) return;
  const d = dist(p.x, p.y, player.x, player.y);
  if (!player.onFoot && player.vehicle && Math.abs(player.vehicle.speed) > 120 && d < 110) p.flee = 1.2;
  if (p.flee > 0) {
    p.flee -= dt;
    const ang = Math.atan2(p.y - player.y, p.x - player.x) + rand(-0.5, 0.5);
    tryMove(p, Math.cos(ang) * 95 * dt, Math.sin(ang) * 95 * dt, 7);
  } else {
    const dv = DIRS[p.vax];
    const nx = p.x + dv.x * p.speed * dt, ny = p.y + dv.y * p.speed * dt;
    const t = tileAt(nx, ny);
    if (t === T_SIDEWALK || t === T_PLAZA) { p.x = nx; p.y = ny; }
    else p.vax = randi(0, 3);
    if (Math.random() < 0.008) p.vax = randi(0, 3);
  }
}

// ---------------- update: police ----------------
function policeUpdate(dt) {
  const stars = Math.floor(state.wanted);
  // spawn foot cops
  const wantCops = stars >= 1 ? 1 + stars : 0;
  if (cops.length < wantCops && Math.random() < (stars === 5 ? 0.5 : 0.2) * dt * 8) {
    const a = rand(0, Math.PI * 2), r = rand(420, 650);
    const x = clamp(player.x + Math.cos(a) * r, 40, WORLD_W - 40);
    const y = clamp(player.y + Math.sin(a) * r, 40, WORLD_H - 40);
    if (!solidAt(x, y)) spawnCop(x, y);
  }
  // spawn patrol cars at 2+ stars
  if (stars >= 2 && copCars.length < stars - 1 && Math.random() < 0.25) spawnCopCar();

  for (const c of cops) {
    const d = dist(c.x, c.y, player.x, player.y);
    const ang = Math.atan2(player.y - c.y, player.x - c.x);
    tryMove(c, Math.cos(ang) * c.speed * dt, Math.sin(ang) * c.speed * dt, 8);
    if (player.onFoot && d < 26) {
      state.bustTimer += dt;
      if (state.bustTimer > 1.1) { state.mode = "busted"; resetPlayer(true); state.mode = "play"; }
    } else if (d > 60) {
      state.bustTimer = Math.max(0, state.bustTimer - dt);
    }
  }

  for (const v of copCars) {
    if (v.hitCd > 0) v.hitCd -= dt;
    const maxV = 235 + stars * 15;
    const ang = Math.atan2(player.y - v.y, player.x - v.x);
    const diff = ((ang - v.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    v.ang += clamp(diff, -2.4 * dt, 2.4 * dt);
    const d = dist(v.x, v.y, player.x, player.y);
    v.speed = Math.abs(diff) > 1.4 ? 90 : maxV * clamp(d / 260, 0.35, 1);
    const fx = Math.cos(v.ang), fy = Math.sin(v.ang);
    const stepx = fx * v.speed * dt, stepy = fy * v.speed * dt;
    const beforeAng = v.ang;
    if (!boxSolid(v.x + stepx, v.y, 13)) v.x += stepx; else { v.ang += 1.4 * dt * (Math.random() < 0.5 ? 1 : -1); v.speed *= 0.5; }
    if (!boxSolid(v.x, v.y + stepy, 13)) v.y += stepy; else { v.ang += 1.4 * dt * (Math.random() < 0.5 ? 1 : -1); v.speed *= 0.5; }
    if (beforeAng !== v.ang) v.ang = ((v.ang + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

    if (!player.onFoot && d < 32 && v.hitCd <= 0) {
      v.hitCd = 1.2;
      player.health -= 10 + state.wanted * 2;
      crashSound();
      floater(player.x, player.y - 36, "POLICE RAM!", "#ff5252");
    }
    // cop cars can flatten you on foot
    if (player.onFoot && d < 20) { player.health -= 30 * dt; }
  }

  if (stars === 0) { cops = []; copCars = []; }

  // wanted decay
  if (state.crimeCd > 0) state.crimeCd -= dt;
  else if (state.wanted > 0) {
    const nearCop = cops.some((c) => dist(c.x, c.y, player.x, player.y) < 330) ||
      copCars.some((c) => dist(c.x, c.y, player.x, player.y) < 430);
    if (!nearCop) state.wanted = Math.max(0, state.wanted - dt / 7);
  }
}

let hornT = 0;
// ---------------- services: pay-n-spray & chai ----------------
const PNS = { x: CENTER_LINES[3], y: CENTER_LINES[3] + 46 };
const CHAI = SPOTS[5] || SPOTS[0];
function serviceUpdate() {
  if (!player.onFoot && state.wanted > 0 && player.money >= 300 && dist(player.x, player.y, PNS.x, PNS.y) < 44) {
    player.money -= 300;
    state.wanted = 0;
    state.crimeCd = 12;
    cashSound();
    showBig("REPAINTED!", "Pay-N-Spray cleared the wanted level (-\u20b9300)", 2);
  }
  if (player.onFoot && player.health < 100 && player.money >= 50 && dist(player.x, player.y, CHAI.x, CHAI.y) < 30) {
    player.money -= 50;
    player.health = Math.min(100, player.health + 40);
    cashSound();
    floater(CHAI.x, CHAI.y - 40, "CHAI +40", "#ffb74d");
  }
}

// ---------------- update: missions ----------------
function missionUpdate(dt) {
  if (!mission) {
    missionCd -= dt;
    setMissionText();
    if (missionCd <= 0) newMission();
    return;
  }
  const t = mission.to;
  if (dist(player.x, player.y, t.x, t.y) < 34) {
    if (mission.phase === "pickup") {
      const far = SPOTS.filter((s) => dist(s.x, s.y, t.x, t.y) > 550);
      mission.phase = "drop";
      mission.to = pick(far);
      cashSound();
      showBig("PARCEL PICKED UP", "Now deliver it", 1.4);
      setMissionText();
    } else {
      player.money += mission.reward;
      state.missionsDone++;
      cashSound();
      showBig("MISSION COMPLETE", "+₹" + mission.reward + " · total " + state.missionsDone + " deliveries", 2.2);
      mission = null;
      missionCd = 4;
    }
  }
}

// ---------------- camera / render ----------------
const canvas = $("game"), ctx = canvas.getContext("2d");
const mini = $("minimap"), mctx = mini.getContext("2d");
const DAY_LEN = 150;
let dayT = DAY_LEN * 0.2;
let camX = 0, camY = 0;

function resize() {
  canvas.width = innerWidth; canvas.height = innerHeight;
}
addEventListener("resize", resize);
resize();

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawVehicle(c, v) {
  const s = v.spec;
  c.save();
  c.translate(v.x, v.y);
  c.rotate(v.ang);
  const w = s.w, h = s.h;
  c.fillStyle = "rgba(0,0,0,0.25)";
  roundRect(c, -w / 2 + 2, -h / 2 + 3, w, h, 6); c.fill();
  c.fillStyle = v.bodyColor || s.color;
  roundRect(c, -w / 2, -h / 2, w, h, 6); c.fill();
  c.fillStyle = "rgba(20,25,35,0.85)";
  c.fillRect(-w / 2 + 3, h / 2 - 2 - h * 0.28, w - 6, h * 0.18);
  if (v.type === "auto") {
    c.fillStyle = "#222";
    c.fillRect(-w / 2, -h / 2 + 2, w, 8);
  }
  if (v.type === "truck" || v.type === "bus") {
    c.save();
    c.rotate(Math.PI / 2);
    c.fillStyle = "#ffd977";
    c.font = "bold 8px sans-serif";
    c.textAlign = "center";
    c.fillText("HORN OK PLEASE", 0, -w / 2 + 12);
    c.restore();
  }
  c.fillStyle = "#1c1c22";
  const wheelW = 5;
  c.fillRect(w / 2 - 2, -h * 0.32 + (v.type === "bus" || v.type === "truck" ? -6 : -0), wheelW, h * 0.18);
  c.fillRect(w / 2 - 2, h * 0.32 - (wheelW + h * 0.18) + (v.type === "bus" || v.type === "truck" ? 6 : 0), wheelW, h * 0.18);
  c.fillRect(-w / 2 - 3, -h * 0.32, wheelW, h * 0.18);
  c.fillRect(-w / 2 - 3, h * 0.32 - wheelW - h * 0.18 + 4, wheelW, h * 0.18);
  c.restore();
}

function drawMarker(c, x, y, color, label, sub) {
  const pulse = 12 + Math.sin(performance.now() / 220) * 3;
  c.save();
  c.globalAlpha = 0.3;
  c.fillStyle = color;
  c.beginPath(); c.arc(x, y, pulse + 10, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1;
  c.beginPath(); c.arc(x, y, pulse, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#241a12";
  c.font = "bold 11px sans-serif";
  c.textAlign = "center";
  c.fillText(label, x, y - 26);
  c.font = "10px sans-serif";
  c.fillText(sub, x, y - 14);
  c.restore();
}

function drawHeadlight(c, v, night) {
  const fx = Math.cos(v.ang), fy = Math.sin(v.ang);
  const px = -fy, py = fx;
  const nose = v.spec.h / 2 + 2;
  c.save();
  c.globalAlpha = 0.13 * night;
  c.fillStyle = "#ffe9a8";
  c.beginPath();
  c.moveTo(v.x + fx * nose + px * 8, v.y + fy * nose + py * 8);
  c.lineTo(v.x + fx * nose + px * 24, v.y + fy * nose + py * 24);
  c.lineTo(v.x + fx * (nose + 74) + px * 44, v.y + fy * (nose + 74) + py * 44);
  c.lineTo(v.x + fx * (nose + 74) - px * 44, v.y + fy * (nose + 74) - py * 44);
  c.lineTo(v.x + fx * nose - px * 24, v.y + fy * nose - py * 24);
  c.closePath();
  c.fill();
  c.restore();
}

function drawPed(c, p, alpha) {
  c.save();
  c.globalAlpha = alpha === undefined ? 1 : alpha;
  c.translate(p.x, p.y);
  if (p.dead) {
    c.fillStyle = "rgba(90,20,20,0.6)";
    c.beginPath(); c.ellipse(0, 0, 10, 6, 0.6, 0, Math.PI * 2); c.fill();
    c.restore();
    return;
  }
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath(); c.ellipse(2, 3, 7, 5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = p.color;
  c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#b9855c";
  c.beginPath(); c.arc(0, -2, 3.4, 0, Math.PI * 2); c.fill();
  c.restore();
}

function render() {
  const vw = canvas.width, vh = canvas.height;
  camX = clamp(player.x - vw / 2, 0, Math.max(0, WORLD_W - vw));
  camY = clamp(player.y - vh / 2, 0, Math.max(0, WORLD_H - vh));

  ctx.drawImage(mapCanvas, camX, camY, vw, vh, 0, 0, vw, vh);

  ctx.save();
  ctx.translate(-camX, -camY);

  for (const d of decals) {
    ctx.globalAlpha = clamp(d.t / 10, 0, 0.8);
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (mission) {
    const t = mission.to;
    const pulse = 10 + Math.sin(performance.now() / 200) * 3;
    ctx.fillStyle = mission.phase === "pickup" ? "#ffd400" : "#3aa0ff";
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(t.x, t.y, pulse + 10, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(t.x, t.y, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#241a12";
    ctx.font = "12px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(mission.phase === "pickup" ? "📦 PICK UP" : "🏁 DELIVER", t.x, t.y - 22);
  }

  const nightRaw = (1 - Math.cos((dayT / DAY_LEN) * Math.PI * 2)) / 2;
  const night = clamp(nightRaw, 0, 1);

  // service markers on the map
  drawMarker(ctx, PNS.x, PNS.y, "#2ecc71", "🎨 PAY-N-SPRAY", "₹300");
  drawMarker(ctx, CHAI.x, CHAI.y, "#ff9800", "☕ CHAI", "₹50");

  for (const v of vehicles) {
    if (night > 0.12) drawHeadlight(ctx, v, night);
    drawVehicle(ctx, v);
  }
  for (const v of copCars) {
    if (night > 0.12) drawHeadlight(ctx, v, night);
    drawVehicle(ctx, v);
    drawVehicle(ctx, v);
    if (Math.floor(state.wanted) >= 1) {
      ctx.save(); ctx.translate(v.x, v.y - v.spec.h / 2 - 8);
      ctx.fillStyle = Math.floor(performance.now() / 220) % 2 ? "#ff2b2b" : "#2b6bff";
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  for (const p of peds) drawPed(ctx, p);
  for (const c of cops) drawPed(ctx, { ...c, color: "#263238" });

  // player
  if (player.onFoot) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.ellipse(2, 4, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(0);
    ctx.fillStyle = player.kurta;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#b9855c";
    ctx.beginPath(); ctx.arc(0, -2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3a2a1a";
    ctx.fillRect(-5, -8, 10, 3);
    ctx.restore();
    // mission arrow
    const tgt = mission && mission.to;
    if (tgt) {
      const a = Math.atan2(tgt.y - player.y, tgt.x - player.x);
      ctx.save();
      ctx.translate(player.x + Math.cos(a) * 30, player.y + Math.sin(a) * 30);
      ctx.rotate(a);
      ctx.fillStyle = mission.phase === "pickup" ? "#ffd400" : "#3aa0ff";
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  for (const f of floaters) {
    ctx.globalAlpha = clamp(f.t, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // sunset tint
  ctx.fillStyle = "rgba(255,140,40,0.07)";
  ctx.fillRect(0, 0, vw, vh);

  // night overlay + street lamps
  if (night > 0.05) {
    ctx.fillStyle = `rgba(10, 14, 52, ${(night * 0.42).toFixed(3)})`;
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = `rgba(255, 218, 120, ${(night * 0.14).toFixed(3)})`;
    for (const cx of CENTER_LINES) for (const cy of CENTER_LINES) {
      const sx = cx - camX, sy = cy - camY;
      if (sx < -90 || sy < -90 || sx > vw + 90 || sy > vh + 90) continue;
      ctx.beginPath(); ctx.arc(sx, sy, 80, 0, Math.PI * 2); ctx.fill();
    }
  }

  // HUD
  const stars = Math.floor(state.wanted);
  let starsTxt = "";
  for (let i = 0; i < 5; i++) starsTxt += i < stars ? "★" : "<span class='dim'>☆</span>";
  if ($("stars").innerHTML !== starsTxt) $("stars").innerHTML = starsTxt;
  $("money").textContent = "₹" + player.money;
  $("health").style.width = clamp(player.health, 0, 100) + "%";
  $("health").style.background = player.health > 50 ? "#6ecc6e" : player.health > 25 ? "#e8c34a" : "#e05252";
  if (state.bustTimer > 0) $("submsg").textContent = "Getting busted… break away!";
  else if (state.bigT <= 0) $("submsg").textContent = "";

  drawMinimap();
}

function drawMinimap() {
  mctx.clearRect(0, 0, 200, 200);
  mctx.drawImage(miniBase, 0, 0);
  const s = MAP_SCALE;
  mctx.fillStyle = "#ffe08a";
  for (const v of vehicles) mctx.fillRect(v.x * s - 1, v.y * s - 1, 2, 2);
  mctx.fillStyle = "#2ecc71";
  mctx.fillRect(PNS.x * s - 2, PNS.y * s - 2, 4, 4);
  mctx.fillStyle = "#ff9800";
  mctx.fillRect(CHAI.x * s - 2, CHAI.y * s - 2, 4, 4);
  mctx.fillStyle = Math.floor(performance.now() / 250) % 2 ? "#ff4444" : "#ffaaaa";
  for (const v of copCars) mctx.fillRect(v.x * s - 2, v.y * s - 2, 4, 4);
  for (const c of cops) mctx.fillRect(c.x * s - 1, c.y * s - 1, 3, 3);
  if (mission) {
    mctx.fillStyle = mission.phase === "pickup" ? "#ffd400" : "#3aa0ff";
    const p = 2.5 + Math.sin(performance.now() / 180) * 1.2;
    mctx.beginPath(); mctx.arc(mission.to.x * s, mission.to.y * s, p, 0, Math.PI * 2); mctx.fill();
  }
  mctx.fillStyle = "#fff";
  mctx.strokeStyle = "#000";
  mctx.lineWidth = 1;
  mctx.beginPath(); mctx.arc(player.x * s, player.y * s, 3, 0, Math.PI * 2); mctx.fill(); mctx.stroke();
}


// ---------------- audio mixer (per-frame) ----------------
function audioUpdate(dt) {
  if (!AC || !sirenGain) return;
  const on = Math.floor(state.wanted) >= 1 && (cops.length + copCars.length) > 0;
  let g = 0;
  if (on && !muted) {
    const near = Math.min(...[...cops, ...copCars].map((c) => dist(c.x, c.y, player.x, player.y)), 9999);
    g = 0.05 + 0.12 * clamp(1 - near / 900, 0, 1);
  }
  sirenGain.gain.setTargetAtTime(clamp(g, 0, 0.2), AC.currentTime, 0.25);
  if (engineGain) {
    if (!muted && !player.onFoot && player.vehicle) {
      const sp = Math.abs(player.vehicle.speed);
      engineOsc.frequency.setTargetAtTime(45 + sp * 0.5, AC.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(0.05 + clamp(sp / 400, 0, 1) * 0.06, AC.currentTime, 0.15);
    } else {
      engineGain.gain.setTargetAtTime(0, AC.currentTime, 0.1);
    }
  }
  ambT -= dt;
  if (ambT <= 0 && !muted) {
    ambT = rand(3.5, 9);
    beep(rand(430, 620), 0.22, "square", rand(0.015, 0.04));
  }
}
let ambT = 5;

// ---------------- main loop ----------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (state.mode !== "play" && state.mode !== "pause") { render(); return; }
  if (state.mode === "pause") { render(); return; }

  dayT = (dayT + dt) % DAY_LEN;
  if (hornT > 0) hornT -= dt;
  if (player.onFoot) playerFootUpdate(dt);
  else playerCarUpdate(player.vehicle, dt);

  for (const v of vehicles) if (v.mode === "traffic") trafficUpdate(v, dt);
  for (const p of peds) pedUpdate(p, dt);
  policeUpdate(dt);
  serviceUpdate();
  missionUpdate(dt);
  audioUpdate(dt);

  if (!player.onFoot && Math.random() < 0.02) honkSound();

  if (state.wanted === 0 && player.health < 100) player.health = Math.min(100, player.health + 5 * dt);

  for (const f of floaters) { f.t -= dt; f.y -= 18 * dt; }
  floaters = floaters.filter((f) => f.t > 0);
  for (const d of decals) d.t -= dt;
  decals = decals.filter((d) => d.t > 0);
  peds = peds.filter((p) => !p.dead || Math.random() > 0.98);
  while (peds.length < 34) spawnPed();
  vehicles = vehicles.filter((v) => v.mode !== "traffic" || (v.x > -80 && v.x < WORLD_W + 80 && v.y > -80 && v.y < WORLD_H + 80));
  while (vehicles.length < 46) spawnTraffic();

  if (state.bigT > 0) {
    state.bigT -= dt;
    if (state.bigT <= 0) { $("bigmsg").textContent = ""; $("submsg").textContent = ""; }
  }
  render();
}

// ---------------- boot ----------------
function start() {
  $("intro").style.display = "none";
  initAudio();
  player.x = SPAWN.x; player.y = SPAWN.y;
  spawnInitialTraffic();
  for (let i = 0; i < 26; i++) spawnPed();
  newMission();
  state.mode = "play";
  showBig("WELCOME TO THE CITY", "Find the 📦 yellow marker and start earning", 2.5);
}
$("startBtn").addEventListener("click", start);

requestAnimationFrame(frame);
})();
