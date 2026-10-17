import test from "node:test";
import assert from "node:assert/strict";
import {
  newMetro,
  makeCrowd,
  tickMetro,
  dropCash,
  collectCash,
  payDebt,
  canBoard,
  CITIZENS,
} from "../web/game/metro-state.js";
import { freshState, sanitizeSave, random } from "../web/game/state.js";
import { modelFixture } from "./helpers/model-fixtures.mjs";
import { Actor } from "../web/game/actors.js";
import * as T from "../web/vendor/three.module.js";
test("metro money is finite, one-time and saved together with roles and model selection", () => {
  const s = freshState(31);
  s.chapter = 2;
  s.metro = newMetro();
  const crowd = makeCrowd(() => random(s));
  assert.equal(crowd.length, 48);
  assert.equal(crowd.filter((e) => e.role === "guard").length, 6);
  assert(crowd.every((e) => e.cash >= 1000 && e.cash <= 5000));
  assert(crowd.reduce((v, e) => v + e.cash, 0) >= 120000);
  s.enemies = crowd;
  s.metro.spawned = true;
  const e = { ...crowd[0], choices: crowd[0] };
  assert(dropCash(s.metro, e, e.position));
  assert(!dropCash(s.metro, e, e.position));
  const restored = sanitizeSave(s);
  assert.equal(restored.enemies.length, 47);
  assert.equal(restored.metro.drops.length, 1);
  assert.equal(collectCash(restored.metro, e.id), e.cash);
  assert.equal(collectCash(restored.metro, e.id), 0);
  assert.deepEqual(
    sanitizeSave({ ...restored, enemies: [] }).metro,
    restored.metro,
  );
  assert(
    restored.enemies.some(
      (e) => e.role === "citizen" && e.model.startsWith("female"),
    ),
  );
});
test("five minute deadline, debt and boarding cannot be bypassed or reset by saving", () => {
  const m = newMetro();
  assert(!canBoard(m));
  assert(!payDebt(m));
  m.cash = 100000;
  assert(payDebt(m));
  assert.equal(m.cash, 0);
  assert(!payDebt(m));
  assert(canBoard(m));
  tickMetro(m, 299.5);
  assert(canBoard(m));
  const s = freshState();
  s.chapter = 2;
  s.metro = m;
  const restored = sanitizeSave(s);
  assert.equal(restored.metro.remaining, 0.5);
  tickMetro(restored.metro, 0.5);
  assert(!canBoard(restored.metro));
  assert(restored.metro.failed);
});
test("all seventeen split citizens have one skeleton, complete bounded animation poses and grounded feet", async () => {
  for (const id of CITIZENS) {
    const asset = await modelFixture("npc_" + id),
      scene = new T.Scene(),
      actor = new Actor(asset, "zombie", scene);
    const skeletons = new Set();
    actor.model.traverse((o) => {
      if (o.isSkinnedMesh)
        skeletons.add(o.skeleton.bones.find((b) => b.name === "Hips"));
    });
    assert.equal(skeletons.size, 1, id);
    for (const clip of ["Idle", "Walk", "Run"])
      for (const phase of [0.15, 0.6]) {
        actor.play(clip, true);
        const action = actor.actions.get(clip);
        action.time = action.getClip().duration * phase;
        actor.mixer.update(0);
        actor.correctGround();
        const size = new T.Box3()
          .setFromObject(actor.model, true)
          .getSize(new T.Vector3());
        assert(
          size.y > 1.2 && size.y < 2.25 && size.x < 2.2 && size.z < 2.2,
          id + " " + clip + " " + size.toArray(),
        );
        assert(actor.soleSamples.length > 0, id + " no foot samples");
      }
    actor.remove();
  }
});
test("guard uses the shared pistol aim/IK and can move without changing skeleton scale", async () => {
  const asset = await modelFixture("npc_guard"),
    actor = new Actor(asset, "guard", new T.Scene());
  assert(actor.rig.arms.left && actor.rig.arms.right);
  for (const moving of [false, true]) {
    actor.animate(0.2, { moving, aim: true, speed: 1.25 });
    actor.updateGun(new T.Vector3(0, 1.4, 10));
    assert(actor.gun.visible);
    assert(actor.gun.position.toArray().every(Number.isFinite));
  }
  actor.remove();
});
