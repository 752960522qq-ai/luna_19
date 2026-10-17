import * as T from "../vendor/three.module.js";
import { solveArm } from "./rig.js";
// Procedural 2.05 second Colt reload, shared by both existing humanoid rigs.
// Only the support arm is overridden after the right hand holds the rifle.
export function poseRifleReload(actor, progress) {
  const arm = actor.rig?.arms.left;
  if (!arm || progress == null) return;
  const p = T.MathUtils.clamp(progress, 0, 1),
    f = new T.Vector3(0, 0, 1).applyQuaternion(actor.gun.quaternion),
    right = new T.Vector3(1, 0, 0).applyQuaternion(actor.gun.quaternion);
  const magazine = actor.gun.position
    .clone()
    .addScaledVector(f, 0.13)
    .add(new T.Vector3(0, -0.08, 0));
  let out = 0;
  if (p > 0.18 && p < 0.72) out = Math.sin(((p - 0.18) / 0.54) * Math.PI);
  const target = magazine.clone().addScaledVector(right, -0.16 * out);
  target.y -= 0.24 * out;
  const pole = arm.upper
    .getWorldPosition(new T.Vector3())
    .addScaledVector(right, -0.4)
    .add(new T.Vector3(0, -0.3, 0));
  solveArm(arm.upper, arm.lower, arm.hand, target, pole);
  if (!actor.reloadMagazine) {
    actor.reloadMagazine = new T.Mesh(
      new T.BoxGeometry(0.045, 0.15, 0.07),
      new T.MeshStandardMaterial({
        color: 0x3f4642,
        metalness: 0.6,
        roughness: 0.5,
      }),
    );
    actor.scene.add(actor.reloadMagazine);
  }
  actor.reloadMagazine.visible = p > 0.26 && p < 0.7;
  actor.reloadMagazine.position.copy(target);
  actor.reloadMagazine.quaternion.copy(actor.gun.quaternion);
}
