import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../web/vendor/three.module.js";
import { Actor } from "../web/game/actors.js";
import { characterFixtures } from "./helpers/model-fixtures.mjs";
const assets = await characterFixtures();
const vector = () => new T.Vector3();
function soleHeight(actor) {
  let min = Infinity;
  for (const { mesh, index } of actor.soleSamples) {
    const p = mesh
      .getVertexPosition(index, vector())
      .applyMatrix4(mesh.matrixWorld);
    min = Math.min(min, p.y);
  }
  return min;
}
test("all zombie clips retain a visible head, stable scale and soles on the floor", () => {
  const a = new Actor(assets.zombie, "zombie", new T.Scene());
  assert(a.soleSamples.length > 0);
  const skull = [];
  a.model.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const joint = mesh.skeleton.bones.indexOf(a.head),
      indices = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < indices.count; i += 31)
      for (let k = 0; k < 4; k++)
        if (
          indices.getComponent(i, k) === joint &&
          weights.getComponent(i, k) > 0.7
        ) {
          skull.push({ mesh, index: i });
          break;
        }
  });
  assert(skull.length > 20);

  for (const name of [
    "Idle_Lurch",
    "Idle_Sway",
    "Walk_Shuffle",
    "Walk_Heavy",
  ]) {
    a.play(name, true);
    const action = a.actions.get(name),
      duration = action.getClip().duration;
    for (const phase of [0, 0.25, 0.5, 0.75, 0.99]) {
      action.time = duration * phase;
      a.mixer.update(0);
      a.correctGround();
      const box = new T.Box3().setFromObject(a.model, true),
        height = box.max.y - box.min.y;
      assert(
        height > 1.35 && height < 2.05,
        `${name} phase ${phase}: height ${height}`,
      );
      assert(box.min.y > -0.02, `${name}: penetrating floor ${box.min.y}`);
      assert(Math.abs(soleHeight(a) - 0.012) < 0.004);
      const skullY =
        skull.reduce(
          (sum, { mesh, index }) =>
            sum +
            mesh
              .getVertexPosition(index, vector())
              .applyMatrix4(mesh.matrixWorld).y,
          0,
        ) / skull.length;
      assert(
        skullY > a.neck.getWorldPosition(vector()).y + 0.03,
        `${name}: head mesh collapsed into torso`,
      );
      assert(
        a.head.getWorldPosition(vector()).y -
          a.hip.getWorldPosition(vector()).y >
          0.35,
        `${name}: folded spine`,
      );
    }
  }
  a.remove();
});
test("May and Cody aim without folding the pelvis and hold correctly oriented weapons", () => {
  for (const kind of ["may", "cody"]) {
    const a = new Actor(assets[kind], kind, new T.Scene(), assets);
    for (const weapon of ["m92", "colt723"]) {
      a.setWeapon(weapon);
      a.armed = true;
      for (const moving of [false, true]) {
        for (let i = 0; i < 30; i++) {
          a.animate(1 / 30, { moving, aim: true, speed: 1.5 });
          a.updateGun(new T.Vector3(0, 1.3, 8));
        }
        const head = a.head.getWorldPosition(vector()),
          hip = a.hip.getWorldPosition(vector());
        assert(
          head.y - hip.y > (kind === "may" ? 0.25 : 0.5),
          kind + ": folded aim stance",
        );
        assert(Math.abs(soleHeight(a) - 0.012) < 0.004);
        const gripDistance = a.hand
          .getWorldPosition(vector())
          .distanceTo(a.gun.position);
        assert(
          gripDistance > 0.025 && gripDistance < 0.2,
          kind + ": detached grip " + gripDistance,
        );
        const muzzle = a.muzzle(),
          direction = a.gun.getWorldDirection(vector());
        assert(
          direction.dot(new T.Vector3(0, 1.3, 8).sub(muzzle).normalize()) >
            0.98,
        );
        assert(a.muzzleLocal.z > 0.15, "muzzle must be in front of grip");
        const before = a.gun.position.clone();
        for (let j = 0; j < 10; j++) a.updateGun(new T.Vector3(0, 1.3, 8));
        assert(before.distanceTo(a.gun.position) < 1e-4, "IK drift");
      }
    }
    a.remove();
  }
});
test("animation transitions retire faded actions and remain finite under repeated switching", () => {
  for (const kind of ["may", "cody"]) {
    const a = new Actor(assets[kind], kind, new T.Scene(), assets);
    for (const state of [
      {},
      { moving: true, speed: 3 },
      { aim: true, moving: true, speed: 1.5 },
      { talk: true },
      {},
    ]) {
      for (let i = 0; i < 20; i++) {
        a.animate(0.016, state);
        a.updateGun(new T.Vector3(0, 1.3, 8));
      }
      assert(a.activeActions.size <= 2);
      assert(a.retiring.size === 0);
      a.model.traverse((o) => {
        if (o.isBone)
          assert(o.quaternion.toArray().every(Number.isFinite), o.name);
      });
    }
    a.remove();
  }
});
