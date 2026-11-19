import { createGame, update, populate, toggleVehicle } from "../3d/game.js";
import assert from "node:assert";

const g = createGame();
assert.strictEqual(g.mode, "intro");
g.mode = "play";
populate(g);
assert(g.vehicles.length >= 40, "traffic spawned");
assert(g.peds.length >= 30, "peds spawned");
assert(g.mission, "mission created");

const idle = { up: false, down: false, left: false, right: false, sprint: false, enter: false, horn: false };
const input = { up: true, down: false, left: false, right: false, sprint: false, enter: false, horn: false };

for (let i = 0; i < 120; i++) update(g, 1 / 60, input);
input.up = false;

let jacked = false;
for (let i = 0; i < 400 && !jacked; i++) {
  const near = g.vehicles.some((v) => Math.hypot(v.x - g.player.x, v.y - g.player.y) < 50);
  if (near) { toggleVehicle(g); if (!g.player.onFoot) jacked = true; }
  input.left = i % 40 < 20; input.right = !input.left; input.up = true;
  update(g, 1 / 60, input);
}
console.log("carjacked:", jacked, "| mode:", g.player.onFoot ? "foot" : "vehicle", "| wanted:", g.wanted.toFixed(1));

input.up = true; input.enter = false;
for (let i = 0; i < 1800; i++) {
  if (g.player.onFoot) {
    const v = g.vehicles[0];
    if (v) { g.player.x = v.x + 8; g.player.y = v.y; toggleVehicle(g); }
  }
  input.left = (i / 60) % 2 < 1;
  update(g, 1 / 60, input);
}
console.log("after drive — money:", g.player.money, "| level:", g.level, "| wanted:", g.wanted.toFixed(1));

for (let n = 0; n < 16 && g.missionsDone < 6; n++) {
  for (let i = 0; i < 320 && !g.mission; i++) update(g, 1 / 60, idle);
  if (!g.mission) break;
  if (g.mission.type === "taxi" && g.mission.phase === "pickup" && g.player.onFoot) {
    const v = g.vehicles.find((v) => v.mode !== "player" && v.mode !== "police");
    if (v) { g.player.x = v.x + 8; g.player.y = v.y; toggleVehicle(g); }
  }
  g.player.x = g.mission.to.x; g.player.y = g.mission.to.y;
  update(g, 1 / 60, idle);
}
console.log("after missions — jobs:", g.missionsDone, "| level:", g.level, "| money:", g.player.money, "| title:", g.level);
assert(g.level > 1, "level increased");
console.log("3D LOGIC SMOKE OK");
