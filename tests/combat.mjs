import { createGame, update, populate, VEH } from "../3d/game.js";
import assert from "node:assert";

const g = createGame();
g.mode = "play";
populate(g);
const idle = { up: false, down: false, left: false, right: false, sprint: false, enter: false, horn: false, fire: false, handbrake: false };

// --- 1. player on foot shoots a ped -> wanted + gunshot event ---
g.player.vehicles = [];
g.player.onFoot = true;
const pd = g.peds.find((q) => !q.dead);
g.player.x = pd.x - 40; g.player.y = pd.y;
g.player.ang = 0; // pointing at the ped to the right
const before = g.wanted;
const input = { ...idle, fire: true };
for (let i = 0; i < 6; i++) update(g, 1 / 60, input);
input.fire = false;
const shots = g.events.filter((e) => e.type === "gunshot");
assert(shots.length > 0, "gunshot event emitted");
assert(g.wanted > before, "wanted increased after shooting ped, got " + g.wanted);
const killed = g.peds.some((q) => q.dead);
assert(g.events.some((e) => e.type === "floater" && e.text === "MURDER!"), "murder registered"); assert(g.peds.some((q) => q.dead), "ped body lingers");
console.log("SHOOTING OK  (shots:" + shots.length + " wanted:" + g.wanted.toFixed(1) + ")");

// --- 2. shooting a vehicle repeatedly -> explosion event + wreck ---
const v = g.vehicles.find((c) => c.mode === "traffic" && c.hp === VEH.car.hp);
g.player.x = v.x - 45; g.player.y = v.y; g.player.ang = 0;
const shots0 = g.events.filter((e) => e.type === "gunshot").length;
for (let i = 0; i < 400; i++) {
  if (v.mode !== "wrecked") {
    g.player.x = v.x - 45; g.player.y = v.y; g.player.ang = 0;
    update(g, 1 / 60, { ...idle, fire: true });
    if (g.player.onFoot === false) break;
  }
  update(g, 1 / 60, idle);
}
const exps = g.events.filter((e) => e.type === "explosion");
assert(exps.length > 0, "explosion event from killing a car");
assert(v.mode === "wrecked", "vehicle mode is wrecked");
console.log("EXPLOSION OK (explosions:" + exps.length + ", hp:" + Math.round(v.hp) + ")");

// --- 3. vehicle hp drops on building crash ---
const g2 = createGame();
g2.mode = "play";
populate(g2);
const v2 = g2.vehicles.find((c) => c.type === "car");
g2.player.vehicle = v2; v2.mode = "player"; g2.player.onFoot = false;
v2.speed = 220;
v2.ang = 0;
v2.x = 60; v2.y = 400;
const y0 = v2.hp;
const inc = { up: true, down: false, left: false, right: false, sprint: false, enter: false, horn: false, handbrake: false };
for (let i = 0; i < 60 && g2.player.vehicle === v2; i++) update(g2, 1 / 60, inc);
console.log("crash test — hp:", Math.round(v2.hp), "mode:", v2.mode);
assert(v2.hp < y0 || v2.mode === "wrecked", "vehicle damaged by building crash");
assert(g2.events.some((e) => e.type === "crash"), "crash events fired");
console.log("CRASH DAMAGE OK");

// --- 4. handbrake stops faster ---
const g3 = createGame();
g3.mode = "play";
populate(g3);
const v3 = g3.vehicles.find((c) => c.spec.hp >= 60);
g3.player.vehicle = v3; v3.mode = "player"; g3.player.onFoot = false;
v3.speed = 200;
for (let i = 0; i < 60; i++) update(g3, 1 / 60, { ...idle, handbrake: true });
assert(Math.abs(v3.speed) < 5, "handbrake nearly stopped the car, speed=" + v3.speed.toFixed(1));
console.log("HANDBRAKE OK (speed after 1s: " + v3.speed.toFixed(2) + ")");

// --- 5. cops shoot back at 2 stars + wasted via wasted() path ---
const g4 = createGame();
g4.mode = "play";
populate(g4);
g4.wanted = 3;
g4.cops.push({ x: g4.player.x + 60, y: g4.player.y, speed: 170 });
const gs0 = g4.events.filter((e) => e.type === "gunshot" && e.fromPolice).length;
for (let i = 0; i < 240; i++) { g4.player.health = 100; update(g4, 1 / 60, idle); }
const gs1 = g4.events.filter((e) => e.type === "gunshot" && e.fromPolice).length;
assert(gs1 > gs0, "cops returned fire at 2+ stars");
g4.player.health = -20;
update(g4, 1 / 60, idle);
assert(g4.player.health === 100 && g4.player.onFoot, "wasted() resets player at hospital");
console.log("COP GUNFIGHT + WASTED OK (police shots:" + (gs1 - gs0) + ")");
console.log("3D COMBAT TESTS OK");
