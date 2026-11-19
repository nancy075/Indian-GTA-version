/* INDIA DRIVE 3D — shared game logic. No DOM, no THREE: portable + testable. */

export const TILE = 40, COLS = 60, ROWS = 60;
export const WORLD_W = COLS * TILE, WORLD_H = ROWS * TILE;
export const T_BUILDING = 0, T_ROAD = 1, T_SIDEWALK = 2, T_PLAZA = 3;

export const CENTER_LINES = [];
for (let k = 0; k * 9 + 1 < COLS; k++) CENTER_LINES.push(k * 9 * TILE + TILE);

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[randi(0, arr.length - 1)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export const grid = new Uint8Array(COLS * ROWS);
const gi = (c, r) => r * COLS + c;
export function tileAt(x, y) {
  const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return T_BUILDING;
  return grid[gi(c, r)];
}
export const solidAt = (x, y) => tileAt(x, y) === T_BUILDING;
function boxSolid(x, y, r) {
  return solidAt(x - r, y - r) || solidAt(x + r, y - r) || solidAt(x - r, y + r) || solidAt(x + r, y + r);
}
function tryMove(ent, dx, dy, r) {
  if (!boxSolid(ent.x + dx, ent.y, r)) ent.x += dx;
  if (!boxSolid(ent.x, ent.y + dy, r)) ent.y += dy;
  ent.x = clamp(ent.x, 10, WORLD_W - 10);
  ent.y = clamp(ent.y, 10, WORLD_H - 10);
}

export const BUILDING_COLORS = ["#b96b45", "#b08050", "#9c5f3e", "#8d6e63", "#a1735a", "#b5764f", "#a26949", "#caa06a"];
for (let i = 0; i < 8; i++) {
  const c0 = randi(4, COLS - 6), r0 = randi(4, ROWS - 6);
  const w = randi(2, 3), h = randi(2, 3);
  for (let r = r0; r < Math.min(r0 + h, ROWS); r++)
    for (let c = c0; c < Math.min(c0 + w, COLS); c++)
      if (grid[gi(c, r)] === T_BUILDING) grid[gi(c, r)] = T_PLAZA;
}
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    if (grid[gi(c, r)] === T_ROAD) continue;
    const cc = c % 9, rr = r % 9;
    if (cc === 2 || cc === 8 || rr === 2 || rr === 8) grid[gi(c, r)] = T_SIDEWALK;
  }
}
export const SPOTS = [];
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++)
    if (grid[gi(c, r)] === T_SIDEWALK && (c + r) % 3 === 0)
      SPOTS.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
const DIRS = [ { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 } ];
export const VEH = {
  auto:    { w: 24, h: 36, speed: 120, color: "#f2c02e", name: "Auto" },
  car:     { w: 28, h: 40, speed: 180, colors: ["#3f6fd8", "#c0392b", "#2e8b57", "#7f8c8d"], name: "Car" },
  truck:   { w: 32, h: 54, speed: 100, color: "#6c5ce7", name: "Truck" },
  scooter: { w: 14, h: 26, speed: 140, color: "#e67e22", name: "Scooter" },
  bus:     { w: 32, h: 58, speed: 105, color: "#d84315", name: "Bus" },
  police:  { w: 28, h: 42, speed: 235, color: "#f4f4f4", name: "Police" }
};

export const TITLES = ["STREET NOODLE", "RICKSHAW RAJA", "AUTO WALA ACE", "GULLY GANGSTA", "AREA KA DON", "MUMBAI KA BADSHAH"];
export const titleFor = (lvl) => TITLES[Math.min(lvl - 1, TITLES.length - 1)];
export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
export function missionColor(g) {
  const m = g.mission;
  if (!m) return "#ffd400";
  if (m.type === "taxi") return m.phase === "pickup" ? "#2ecc71" : "#1abc9c";
  if (m.type === "heist") return m.phase === "escape" ? "#b07cff" : "#ff4d4d";
  return m.phase === "pickup" ? "#ffd400" : "#3aa0ff";
}
export function missionLabel(g) {
  const m = g.mission;
  if (!m) return "";
  if (m.type === "taxi") return m.phase === "pickup" ? "PICK UP PASSENGER" : "DROP PASSENGER";
  if (m.type === "heist") return m.phase === "escape" ? "RUN TO HIDEOUT" : "CITY BANK";
  return m.phase === "pickup" ? "PICK UP" : "DELIVER";
}

// ---------------- game factory ----------------
export function createGame() {
  const g = {
    player: {
      x: CENTER_LINES[2] + 20, y: CENTER_LINES[2] - 60,
      ang: -Math.PI / 2, onFoot: true, health: 100, money: 0,
      vehicle: null, color: "#4f83e0"
    },
    vehicles: [], peds: [], cops: [], copCars: [],
    wanted: 0, crimeCd: 0, bustTimer: 0,
    mode: "intro", bigT: 0,
    missionsDone: 0, level: 1, toNext: 2,
    mission: null, missionCd: 2, missionHud: "New job in 2s…",
    bank: { x: CENTER_LINES[1], y: CENTER_LINES[5] + 46 },
    hideout: SPOTS[12] || SPOTS[0],
    pns: { x: CENTER_LINES[3], y: CENTER_LINES[3] + 46 },
    chai: SPOTS[5] || SPOTS[0],
    hornT: 0, ambT: 5, dayT: 30, DAY_LEN: 150, night: 0,
    events: [], time: 0
  };
  return g;
}

function ev(g, type, extra) { g.events.push(Object.assign({ type }, extra || {})); }
function floaterAt(g, x, y, text, color) { ev(g, "floater", { x, y, text, color: color || "#fff" }); }
export function showBig(g, text, sub, dur) { ev(g, "big", { text, sub: sub || "", dur }); }

// ---------------- traffic ----------------
function laneOffsetFor(axis, sign) {
  if (axis === "x") return sign > 0 ? -10 : 10;
  return sign > 0 ? 10 : -10;
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
export function spawnTraffic(g, typeName) {
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
    mode: "traffic", next: null, targetAng: 0,
    bodyColor: spec.colors ? pick(spec.colors) : spec.color
  };
  const lane = base + laneOffsetFor(axis, sign);
  if (axis === "x") { v.y = lane; v.x = along; } else { v.x = lane; v.y = along; }
  v.next = nextCrossValue(along, sign);
  v.ang = v.targetAng = angFor(axis, sign);
  g.vehicles.push(v);
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
const HONK_WORDS = ["PAW PAW!", "PO PO!", "BEEP BEEP!", "TRRRN!"];
function trafficUpdate(g, v, dt) {
  const along = v.axis === "x" ? v.x : v.y;
  let step = v.speed * dt;
  const dxn = v.axis === "x" ? v.sign : 0, dyn = v.axis === "y" ? v.sign : 0;
  const px = v.x + dxn * 42, py = v.y + dyn * 42;
  for (const o of g.vehicles.concat(g.copCars)) {
    if (o === v) continue;
    if (dist(o.x, o.y, px, py) < 26) {
      step *= 0.1;
      if (o === g.player.vehicle && Math.random() < 0.09) {
        ev(g, "honk");
        floaterAt(g, v.x, v.y - 30, pick(HONK_WORDS), "#ffd977");
      }
    }
  }
  if (g.player.onFoot && dist(g.player.x, g.player.y, px, py) < 24) {
    step *= 0.1;
    if (Math.random() < 0.09) { ev(g, "honk"); floaterAt(g, v.x, v.y - 30, pick(HONK_WORDS), "#ffd977"); }
  }
  if (g.hornT > 0 && dist(v.x, v.y, g.player.x, g.player.y) < 130) step *= 0.2;

  const newAlong = along + v.sign * step;
  const crossed = v.next === null || (v.sign > 0 ? newAlong >= v.next : newAlong <= v.next);
  if (crossed) {
    const cx = v.axis === "x" ? (v.next ?? clamp(newAlong, 60, WORLD_W - 60)) : v.base;
    const cy = v.axis === "y" ? (v.next ?? clamp(newAlong, 60, WORLD_H - 60)) : v.base;
    v.x = cx; v.y = cy;
    turnVehicle(v, cx, cy);
  } else {
    if (v.axis === "x") v.x = newAlong; else v.y = newAlong;
  }
  v.ang += ((((v.targetAng - v.ang) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, 10 * dt);
}

// ---------------- peds ----------------
export function spawnPed(g, px, py) {
  if (px === undefined) {
    for (let tries = 0; tries < 30; tries++) {
      const s = pick(SPOTS);
      const d = dist(s.x, s.y, g.player.x, g.player.y);
      if (d > 260 && d < 900) { px = s.x; py = s.y; break; }
    }
    if (px === undefined) return;
  }
  g.peds.push({
    x: px, y: py, vax: randi(0, 3), speed: rand(30, 55),
    color: pick(["#e91e63", "#2196f3", "#ffd54f", "#4caf50", "#f5f5f5", "#ff8a65", "#ce93d8"]),
    flee: 0, dead: false
  });
}
function pedUpdate(g, p, dt) {
  if (p.dead) return;
  const d = dist(p.x, p.y, g.player.x, g.player.y);
  if (!g.player.onFoot && Math.abs(g.player.vehicle.speed) > 120 && d < 110) p.flee = 1.2;
  if (p.flee > 0) {
    p.flee -= dt;
    const ang = Math.atan2(p.y - g.player.y, p.x - g.player.x) + rand(-0.5, 0.5);
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

// ---------------- police ----------------
function addWanted(g, n, msg) {
  const before = Math.floor(g.wanted);
  g.wanted = clamp(g.wanted + n, 0, 5);
  g.crimeCd = 12;
  if (msg) floaterAt(g, g.player.x, g.player.y - 40, msg, "#ff5252");
  if (Math.floor(g.wanted) > before && Math.floor(g.wanted) === 1) ev(g, "honk");
}
function spawnCop(g, x, y) { g.cops.push({ x, y, speed: rand(150, 175) }); }
function spawnCopCar(g) {
  const spec = VEH.police;
  const axis = pick(["x", "y"]), sign = pick([1, -1]);
  const base = pick(CENTER_LINES.slice(1, -1));
  let pos = rand(100, WORLD_W - 100);
  for (let tries = 0; tries < 30; tries++) {
    pos = rand(100, WORLD_W - 100);
    const d = axis === "x" ? dist(pos, base, g.player.x, g.player.y) : dist(base, pos, g.player.x, g.player.y);
    if (d > 500 && d < 1100) break;
  }
  const lane = base + laneOffsetFor(axis, sign);
  g.copCars.push({
    type: "police", spec, x: axis === "x" ? pos : lane, y: axis === "y" ? pos : lane,
    ang: angFor(axis, sign), speed: 0, hitCd: 0
  });
}
function resetPlayer(g, afterBusted) {
  const p = g.player;
  p.x = g.pns.x + 90; p.y = g.pns.y;
  p.onFoot = true;
  if (p.vehicle) { p.vehicle.mode = "parked"; p.vehicle = null; }
  p.health = 100;
  g.wanted = 0; g.bustTimer = 0;
  if (g.mission) { g.mission = null; g.missionCd = 5; }
  g.cops = []; g.copCars = [];
  if (afterBusted) {
    p.money = Math.max(0, p.money - 150);
    showBig(g, "BUSTED", "The havaldar took ₹150 as 'chai-paani'.", 2.6);
  }
}
function policeUpdate(g, dt) {
  const stars = Math.floor(g.wanted);
  const wantCops = stars >= 1 ? 1 + stars * 2 : 0;
  if (g.cops.length < wantCops && Math.random() < 2 * dt) {
    const a = rand(0, Math.PI * 2), r = rand(420, 650);
    const x = clamp(g.player.x + Math.cos(a) * r, 40, WORLD_W - 40);
    const y = clamp(g.player.y + Math.sin(a) * r, 40, WORLD_H - 40);
    if (!solidAt(x, y)) spawnCop(g, x, y);
  }
  if (stars >= 2 && g.copCars.length < stars - 1 && Math.random() < 0.25) spawnCopCar(g);

  for (const c of g.cops) {
    const d = dist(c.x, c.y, g.player.x, g.player.y);
    const ang = Math.atan2(g.player.y - c.y, g.player.x - c.x);
    tryMove(c, Math.cos(ang) * c.speed * dt, Math.sin(ang) * c.speed * dt, 8);
    if (g.player.onFoot && d < 26) {
      g.bustTimer += dt;
      if (g.bustTimer > 1.1) resetPlayer(g, true);
    } else if (d > 60) g.bustTimer = Math.max(0, g.bustTimer - dt);
  }

  for (const v of g.copCars) {
    if (v.hitCd > 0) v.hitCd -= dt;
    const maxV = 235 + stars * 15;
    const ang = Math.atan2(g.player.y - v.y, g.player.x - v.x);
    const diff = ((ang - v.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    v.ang += clamp(diff, -2.4 * dt, 2.4 * dt);
    const d = dist(v.x, v.y, g.player.x, g.player.y);
    v.speed = Math.abs(diff) > 1.4 ? 90 : maxV * clamp(d / 260, 0.35, 1);
    const stepx = Math.cos(v.ang) * v.speed * dt, stepy = Math.sin(v.ang) * v.speed * dt;
    if (!boxSolid(v.x + stepx, v.y, 13)) v.x += stepx; else { v.ang += 1.4 * dt * (Math.random() < 0.5 ? 1 : -1); v.speed *= 0.5; }
    if (!boxSolid(v.x, v.y + stepy, 13)) v.y += stepy; else { v.ang += 1.4 * dt * (Math.random() < 0.5 ? 1 : -1); v.speed *= 0.5; }
    if (!g.player.onFoot && d < 32 && v.hitCd <= 0) {
      v.hitCd = 1.2;
      g.player.health -= 10 + g.wanted * 2;
      ev(g, "crash");
      floaterAt(g, g.player.x, g.player.y - 36, "POLICE RAM!", "#ff5252");
    }
    if (g.player.onFoot && d < 20) g.player.health -= 30 * dt;
  }
  if (stars === 0) { g.cops = []; g.copCars = []; }
  if (g.crimeCd > 0) g.crimeCd -= dt;
  else if (g.wanted > 0) {
    const nearCop = g.cops.some((c) => dist(c.x, c.y, g.player.x, g.player.y) < 330) ||
      g.copCars.some((c) => dist(c.x, c.y, g.player.x, g.player.y) < 430);
    if (!nearCop) g.wanted = Math.max(0, g.wanted - dt / 7);
  }
}

// ---------------- player ----------------
export function toggleVehicle(g) {
  const p = g.player;
  if (p.onFoot) {
    let best = null, bd = 55;
    for (const v of g.vehicles.concat(g.copCars)) {
      if (v.mode === "police") continue;
      const d = dist(v.x, v.y, p.x, p.y);
      if (d < bd) { bd = d; best = v; }
    }
    if (best) {
      if (best.mode === "traffic") {
        addWanted(g, 1, "CAR STOLEN!");
        g.peds.push({
          x: best.x + Math.cos(best.ang + Math.PI / 2) * (best.spec.h / 2 + 12),
          y: best.y + Math.sin(best.ang + Math.PI / 2) * (best.spec.h / 2 + 12),
          vax: randi(0, 3), speed: rand(30, 55),
          color: pick(["#e91e63", "#2196f3", "#ffd54f", "#4caf50"]),
          flee: 2.5, dead: false
        });
      }
      best.mode = "player";
      best.speed = 0;
      p.vehicle = best; p.onFoot = false;
      ev(g, "jep");
    }
  } else {
    const v = p.vehicle;
    v.mode = "parked";
    v.speed = 0;
    p.vehicle = null;
    p.onFoot = true;
    p.x = v.x + Math.cos(v.ang + Math.PI / 2) * (v.spec.h / 2 + 12);
    p.y = v.y + Math.sin(v.ang + Math.PI / 2) * (v.spec.h / 2 + 12);
  }
}
function playerFootUpdate(g, dt, input) {
  const p = g.player;
  let vx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let vy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (vx || vy) {
    const len = Math.hypot(vx, vy);
    const sp = (input.sprint ? 215 : 125) * dt;
    tryMove(p, vx / len * sp, vy / len * sp, 9);
    p.ang = Math.atan2(vy, vx);
  }
  for (const v of g.vehicles) {
    if (v.mode !== "traffic") continue;
    if (dist(v.x, v.y, p.x, p.y) < 20 && v.speed > 40) {
      p.health -= 14 * dt;
      tryMove(p, Math.cos(v.ang) * 40 * dt, Math.sin(v.ang) * 40 * dt, 9);
    }
  }
}
function playerCarUpdate(g, dt, input) {
  const v = g.player.vehicle, spec = v.spec;
  const maxV = spec.speed * 1.35;
  if (input.up) v.speed += 340 * dt;
  else if (input.down) v.speed -= 400 * dt;
  else v.speed *= Math.pow(0.35, dt);
  v.speed = clamp(v.speed, -maxV * 0.5, maxV);
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  v.ang += steer * 2.7 * dt * clamp(Math.abs(v.speed) / 130, 0, 1) * (v.speed >= 0 ? 1 : -1);
  v.ang = ((v.ang + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

  const fx = Math.cos(v.ang), fy = Math.sin(v.ang);
  const step = v.speed * dt;
  const corner = (ox, oy) => solidAt(v.x + ox, v.y + oy);
  const hit = corner(fx * 16, fy * 16) || corner(-fx * 16, -fy * 16) ||
    corner(fx * 16 - fy * 9, fy * 16 + fx * 9) || corner(fx * 16 + fy * 9, fy * 16 - fx * 9);
  if (hit) {
    const impact = Math.abs(v.speed);
    if (impact > 190) {
      g.player.health -= (impact - 190) / 9;
      ev(g, "crash");
      floaterAt(g, v.x, v.y - 30, "CRASH! -" + Math.round((impact - 190) / 9), "#ff8888");
    }
    v.speed *= -0.25;
  } else {
    v.x += fx * step; v.y += fy * step;
  }
  v.x = clamp(v.x, 20, WORLD_W - 20);
  v.y = clamp(v.y, 20, WORLD_H - 20);

  for (const o of g.vehicles.concat(g.copCars)) {
    if (o === v || o.mode === "player") continue;
    const d = dist(o.x, o.y, v.x, v.y);
    const rr = (Math.max(o.spec.w, o.spec.h) + Math.max(spec.w, spec.h)) / 2.4;
    if (d < rr) {
      const push = rr - d;
      const nx = (o.x - v.x) / (d || 1), ny = (o.y - v.y) / (d || 1);
      o.x += nx * push; o.y += ny * push;
      v.x -= nx * push * 0.5; v.y -= ny * push * 0.5;
      if (Math.abs(v.speed) > 120) {
        ev(g, "crash");
        if (o.mode === "police") addWanted(g, 1, "RAMMED THE POLICE!");
        else { addWanted(g, 0.25); floaterAt(g, o.x, o.y - 26, pick(HONK_WORDS), "#ffd977"); }
      }
      v.speed *= 0.7;
    }
  }
  if (Math.abs(v.speed) > 60) {
    for (const p of g.peds) {
      if (p.dead) continue;
      if (dist(p.x, p.y, v.x, v.y) < 16) {
        p.dead = true;
        addWanted(g, 1, "HIT & RUN!");
        ev(g, "honk");
      }
    }
  }
}

// ---------------- services ----------------
function serviceUpdate(g) {
  const p = g.player;
  if (!p.onFoot && g.wanted > 0 && p.money >= 300 && dist(p.x, p.y, g.pns.x, g.pns.y) < 44) {
    p.money -= 300;
    g.wanted = 0; g.crimeCd = 12;
    ev(g, "cash");
    showBig(g, "REPAINTED!", "Pay-N-Spray cleared the wanted level (-₹300)", 2);
  }
  if (p.onFoot && p.health < 100 && p.money >= 50 && dist(p.x, p.y, g.chai.x, g.chai.y) < 30) {
    p.money -= 50;
    p.health = Math.min(100, p.health + 40);
    ev(g, "cash");
    floaterAt(g, g.chai.x, g.chai.y - 40, "CHAI +40", "#ffb74d");
  }
}

// ---------------- missions ----------------
function newMission(g) {
  const lvl = g.level;
  const minD = 400 + lvl * 80;
  const cand = SPOTS.filter((s) => dist(s.x, s.y, g.player.x, g.player.y) > minD);
  const to = cand.length ? pick(cand) : pick(SPOTS);
  const types = ["parcel", "parcel"];
  if (lvl >= 3) types.push("taxi");
  if (lvl >= 4) types.push("heist", "heist");
  const type = pick(types);
  const m = { type, phase: "pickup", to, reward: 0, timeLeft: 0, totalTime: 0 };
  if (type === "parcel") {
    m.reward = 350 + lvl * 100;
    if (lvl >= 2) m.timeLeft = m.totalTime = 55 + lvl * 5;
  } else if (type === "taxi") {
    m.reward = 450 + lvl * 100;
    m.timeLeft = m.totalTime = 75 + lvl * 5;
  } else {
    m.phase = "gotoBank";
    m.to = g.bank;
    m.reward = 900 + lvl * 200;
  }
  g.mission = m;
  updateMissionHud(g);
}
function updateMissionHud(g) {
  const m = g.mission;
  const t = (x) => m.timeLeft > 0 ? "  ⏱" + fmtTime(x) : "";
  let txt;
  if (!m) txt = "New job in " + Math.ceil(g.missionCd) + "s…  (Lv " + g.level + ")";
  else if (m.type === "parcel") {
    txt = m.phase === "pickup"
      ? "Parcel: pick up (yellow)" + t(m.timeLeft)
      : "Deliver (blue) — ₹" + m.reward + t(m.timeLeft);
  } else if (m.type === "taxi") {
    txt = m.phase === "pickup"
      ? "Taxi: pick up the passenger (green) — you need a vehicle"
      : "Drop the passenger (teal) — ₹" + m.reward + t(m.timeLeft);
  } else {
    txt = m.phase === "escape"
      ? "ESCAPE to the hideout (purple) — ₹" + m.reward + "  ⏱" + fmtTime(m.timeLeft)
      : "HEIST: reach the City Bank (red)";
  }
  g.missionHud = txt;
}
function completeMission(g) {
  const m = g.mission;
  let sub = "+₹" + m.reward + " · " + g.missionsDone + " jobs done";
  if (m.totalTime > 0 && m.timeLeft > m.totalTime * 0.45) {
    g.player.money += 250;
    sub += "  (+₹250 time bonus!)";
  }
  g.player.money += m.reward;
  g.missionsDone++;
  ev(g, "cash");
  showBig(g, "JOB DONE!", sub, 2.2);
  g.toNext--;
  if (g.toNext <= 0) {
    g.level++;
    g.toNext = 2 + g.level;
    showBig(g, "LEVEL UP!", "You are now: " + titleFor(g.level), 2.8);
    ev(g, "levelup");
  }
  g.mission = null;
  g.missionCd = 4;
}
function failMission(g) {
  showBig(g, "JOB FAILED", "Too slow, the client went elsewhere", 2.2);
  g.mission = null;
  g.missionCd = 4;
}
function missionUpdate(g, dt) {
  if (!g.mission) {
    g.missionCd -= dt;
    updateMissionHud(g);
    if (g.missionCd <= 0) newMission(g);
    return;
  }
  if (g.mission.timeLeft > 0) {
    g.mission.timeLeft -= dt;
    if (g.mission.timeLeft <= 0) { failMission(g); return; }
  }
  const m = g.mission, t = m.to;
  const needVehicle = m.type === "taxi" && m.phase === "pickup";
  const reach = m.type === "parcel" && m.phase === "pickup" ? 34 : 44;
  if (dist(g.player.x, g.player.y, t.x, t.y) > (needVehicle ? 44 : reach)) return;
  if (needVehicle && g.player.onFoot) {
    if (Math.random() < 0.2) floaterAt(g, t.x, t.y - 30, "GET A CAR FIRST!", "#ffffff");
    return;
  }
  if (m.phase === "pickup" || m.phase === "gotoBank") {
    if (m.type === "heist") {
      addWanted(g, 2.2, "BANK ROBBERY!");
      m.phase = "escape";
      m.to = g.hideout;
      m.timeLeft = m.totalTime = 45;
      ev(g, "crash");
      showBig(g, "THE LOOT IS YOURS", "Now ESCAPE to the hideout", 2);
    } else {
      const far = SPOTS.filter((s) => dist(s.x, s.y, t.x, t.y) > 550);
      m.phase = "drop";
      m.to = far.length ? pick(far) : pick(SPOTS);
      ev(g, "cash");
      showBig(g, m.type === "taxi" ? "PASSENGER ABOARD" : "PARCEL PICKED UP",
        m.type === "taxi" ? "Drive them to the destination" : "Now deliver it", 1.6);
    }
  } else {
    completeMission(g);
    return;
  }
  updateMissionHud(g);
}

// ---------------- main update ----------------
export function populate(g) {
  for (let i = 0; i < 44; i++) spawnTraffic(g);
  for (let i = 0; i < 30; i++) spawnPed(g);
  newMission(g);
}

export function update(g, dt, input) {
  if (g.mode !== "play") return;
  dt = Math.min(dt, 0.05);
  g.time += dt;
  g.dayT = (g.dayT + dt) % g.DAY_LEN;
  g.night = clamp((1 - Math.cos((g.dayT / g.DAY_LEN) * Math.PI * 2)) / 2, 0, 1);
  if (g.hornT > 0) g.hornT -= dt;

  const p = g.player;
  if (input.enter) { input.enter = false; toggleVehicle(g); }
  if (input.horn) { input.horn = false; g.hornT = 0.7; ev(g, "honk"); for (const q of g.peds) if (!q.dead && dist(q.x, q.y, p.x, p.y) < 150) q.flee = Math.max(q.flee, 1.0); }

  if (p.onFoot) playerFootUpdate(g, dt, input);
  else playerCarUpdate(g, dt, input);

  for (const v of g.vehicles) if (v.mode === "traffic") trafficUpdate(g, v, dt);
  for (const pd of g.peds) pedUpdate(g, pd, dt);
  policeUpdate(g, dt);
  serviceUpdate(g);
  missionUpdate(g, dt);

  if (Math.random() < 0.02) ev(g, "honk");
  if (g.wanted === 0 && p.health < 100) p.health = Math.min(100, p.health + 5 * dt);
  if (p.health <= 0) {
    showBig(g, "WASTED", "You woke up at the hospital. -₹150", 2.6);
    p.money = Math.max(0, p.money - 150);
    resetPlayer(g, false);
  }
  if (g.bigT > 0) g.bigT -= dt;

  g.vehicles = g.vehicles.filter((v) => v.mode !== "traffic" || (v.x > -80 && v.x < WORLD_W + 80 && v.y > -80 && v.y < WORLD_H + 80));
  while (g.vehicles.length < 40 + g.level * 4) spawnTraffic(g);
  g.peds = g.peds.filter((pd) => !pd.dead || Math.random() > 0.98);
  while (g.peds.length < 30 + g.level * 2) spawnPed(g);
}
