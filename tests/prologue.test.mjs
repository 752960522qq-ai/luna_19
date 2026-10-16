import test from "node:test";
import assert from "node:assert/strict";
import { freshPrologue, sanitizeSave, freshState } from "../web/game/state.js";
import {
  grantWeapon,
  equipWeapon,
  stashWeapon,
  WEAPONS,
  CODY_DAMAGE_SCALE,
  CODY_ACCURACY,
} from "../web/game/weapons.js";
import {
  spawnAllowance,
  shouldOffer,
  newPrologue,
} from "../web/game/prologue-state.js";
test("weapon grants are total rounds, switching and grants cannot duplicate ammunition", () => {
  const s = freshPrologue(42);
  grantWeapon(s, "m92", 60);
  assert.equal(s.player.ammo, 15);
  assert.equal(s.player.reserve, 45);
  s.player.ammo -= 3;
  grantWeapon(s, "colt723", 300);
  assert.equal(s.player.ammo, 30);
  assert.equal(s.player.reserve, 270);
  s.player.ammo -= 7;
  equipWeapon(s, "m92");
  assert.equal(s.player.ammo, 12);
  grantWeapon(s, "colt723", 300);
  assert.equal(s.player.ammo, 23);
  stashWeapon(s);
  const loaded = sanitizeSave(s);
  assert.deepEqual(loaded.inventory, s.inventory);
  assert.equal(loaded.weapon, "colt723");
  assert(Math.abs(WEAPONS.m92.body * CODY_DAMAGE_SCALE - 16.8) < 1e-10);
  assert(CODY_ACCURACY < 0.5);
});
test("horde reaches threshold once and never spawns beyond sixty", () => {
  const p = newPrologue();
  p.phase = "combat";
  p.elapsed = 90;
  p.tutorial = { move: true, fire: true, reload: true };
  assert(shouldOffer(p, 10));
  p.offer = "rejected";
  assert(!shouldOffer(p, 10));
  for (let i = 0; i < 100; i++) {
    if (spawnAllowance(p, 0)) p.spawned++;
  }
  assert.equal(p.spawned, 60);
  assert.equal(spawnAllowance(p, 0), 0);
  p.offer = "accepted";
  assert(!shouldOffer(p, 16));
});
test("prologue save preserves declined branch, tutorial, enemy choices and counters; legacy chapter loads", () => {
  const s = freshPrologue(2);
  s.prologue = {
    ...s.prologue,
    phase: "combat",
    spawned: 25,
    defeated: 11,
    offer: "rejected",
    tutorial: { move: true, fire: true, reload: false },
  };
  grantWeapon(s, "m92", 60);
  const copy = sanitizeSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(copy.prologue, s.prologue);
  assert(!copy.inventory.colt723);
  const old = freshState();
  old.version = 1;
  delete old.inventory;
  delete old.weapon;
  const migrated = sanitizeSave(old);
  assert.equal(migrated.chapter, 1);
  assert.equal(migrated.weapon, "m92");
  assert.equal(migrated.player.ammo, 12);
});
