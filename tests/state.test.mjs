import test from "node:test";
import assert from "node:assert/strict";
import {
  SaveStore,
  freshState,
  pickZombieActions,
  sanitizeSave,
} from "../web/game/state.js";
class Memory {
  constructor() {
    this.data = new Map();
  }
  getItem(k) {
    return this.data.get(k) ?? null;
  }
  setItem(k, v) {
    this.data.set(k, v);
  }
}
test("spawned zombie action choices survive saved game round trip", () => {
  const state = freshState(12345);
  const picks = Array.from({ length: 12 }, () => pickZombieActions(state));
  assert(picks.every(Object.isFrozen));
  assert(new Set(picks.map((p) => p.idle)).size === 2);
  assert(new Set(picks.map((p) => p.move)).size === 2);
  state.stage = 1;
  state.flags.intro = true;
  state.enemies = picks.map((p, i) => ({
    id: "z" + i,
    position: [i, 0, -5],
    yaw: 0,
    hp: 73,
    ...p,
  }));
  const store = new SaveStore(new Memory());
  assert(store.write(state));
  const saved = store.read();
  assert.deepEqual(saved.enemies, state.enemies);
  assert.equal(saved.seed, state.seed);
  assert.equal(saved.stage, 1);
});
test("corrupt saves are rejected and malformed numeric fields are bounded", () => {
  const storage = new Memory();
  const store = new SaveStore(storage);
  storage.setItem("double-mice.save.v1", "broken-json");
  assert.equal(store.read(), null);
  assert(store.error);
  const state = freshState();
  state.player.hp = Infinity;
  state.player.ammo = 9999;
  state.enemies = [
    {
      id: "bad",
      hp: 100,
      idle: "Unknown",
      move: "Walk_Heavy",
      position: [0, 0, 0],
    },
  ];
  const clean = sanitizeSave(state);
  assert.equal(clean.player.hp, 100);
  assert.equal(clean.player.ammo, 12);
  assert.equal(clean.enemies.length, 0);
});
test("storage failure is reported without destroying current game state", () => {
  const store = new SaveStore({
    getItem: () => null,
    setItem: () => {
      throw Error("QuotaExceeded");
    },
  });
  const state = freshState();
  assert.equal(store.write(state), false);
  assert(store.error);
  assert.equal(state.player.ammo, 12);
});
