import * as T from "../vendor/three.module.js";
const UP = new T.Vector3(0, 1, 0),
  V = () => new T.Vector3();
export function setWorldRotation(bone, q) {
  const parent = bone.parent.getWorldQuaternion(new T.Quaternion()).invert();
  bone.quaternion.copy(parent.multiply(q)).normalize();
  bone.updateMatrixWorld(true);
}
function rotateWorld(bone, delta) {
  setWorldRotation(
    bone,
    delta.multiply(bone.getWorldQuaternion(new T.Quaternion())),
  );
}
export function solveArm(upper, lower, hand, target, pole) {
  if (!upper || !lower || !hand) return;
  upper.updateWorldMatrix(true, true);
  const a = upper.getWorldPosition(V()),
    b = lower.getWorldPosition(V()),
    c = hand.getWorldPosition(V());
  const l1 = a.distanceTo(b),
    l2 = b.distanceTo(c);
  if (l1 < 1e-5 || l2 < 1e-5) return;
  const direction = target.clone().sub(a),
    distance = T.MathUtils.clamp(
      direction.length(),
      Math.abs(l1 - l2) + 0.005,
      l1 + l2 - 0.005,
    );
  direction.normalize();
  const bend = pole
    .clone()
    .sub(a)
    .addScaledVector(direction, -pole.clone().sub(a).dot(direction));
  if (bend.lengthSq() < 1e-7) bend.copy(UP).cross(direction);
  bend.normalize();
  const along = (l1 * l1 + distance * distance - l2 * l2) / (2 * distance),
    height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const elbow = a
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(bend, height);
  rotateWorld(
    upper,
    new T.Quaternion().setFromUnitVectors(
      b.sub(a).normalize(),
      elbow.sub(a).normalize(),
    ),
  );
  const joint = lower.getWorldPosition(V()),
    end = hand.getWorldPosition(V()),
    reachable = a.clone().addScaledVector(direction, distance);
  rotateWorld(
    lower,
    new T.Quaternion().setFromUnitVectors(
      end.sub(joint).normalize(),
      reachable.sub(joint).normalize(),
    ),
  );
}
function boneBy(model, pattern) {
  let found = null;
  model.traverse((o) => {
    if (o.isBone && pattern.test(o.name)) found = o;
  });
  return found;
}
export class CharacterRig {
  constructor(actor) {
    this.actor = actor;
    this.arms = {};
    this.fingerRest = new Map();
    for (const side of ["left", "right"]) {
      const cap = side === "right" ? "Right" : "Left",
        model = actor.model;
      const upper = boneBy(
          model,
          new RegExp(`^(?:${cap}Arm|arm_${side}_shoulder_2)$`),
        ),
        lower = boneBy(
          model,
          new RegExp(`^(?:${cap}ForeArm|arm_${side}_elbow)$`),
        ),
        hand = boneBy(model, new RegExp(`^(?:${cap}Hand|arm_${side}_wrist)$`));
      const fingers = [];
      model.traverse((o) => {
        if (
          o.isBone &&
          (new RegExp(
            `^${cap}Hand(?:Thumb|Index|Middle|Ring|Pinky)[123]$`,
          ).test(o.name) ||
            new RegExp(`^arm_${side}_finger_[1234][abc]$`).test(o.name))
        ) {
          fingers.push(o);
          this.fingerRest.set(o, o.quaternion.clone());
        }
      });
      if (!hand) continue;
      const index = fingers.find(
          (o) =>
            o.name === cap + "HandIndex1" || o.name === `arm_${side}_finger_2a`,
        ),
        pinky = fingers.find(
          (o) =>
            o.name === cap + "HandPinky1" || o.name === `arm_${side}_finger_4a`,
        );
      const middle = fingers.find(
        (o) =>
          o.name === cap + "HandMiddle1" || o.name === `arm_${side}_finger_3a`,
      );
      if (!index || !pinky || !middle) continue;
      const forward = middle.position.clone().normalize(),
        across = index.position.clone().sub(pinky.position).normalize(),
        normal = forward.clone().cross(across).normalize(),
        right = normal.clone().cross(forward).normalize();
      const localFrame = new T.Quaternion().setFromRotationMatrix(
        new T.Matrix4().makeBasis(right, normal, forward),
      );
      this.arms[side] = {
        side,
        upper,
        lower,
        hand,
        fingers,
        localFrame,
        palmLocal: middle.position.length() * 0.65,
      };
    }
  }
  hold(grip, forward, rifle, aiming) {
    const actor = this.actor;
    const right = forward.clone().cross(UP).normalize();
    for (const side of ["right", "left"]) {
      const arm = this.arms[side];
      if (!arm) continue;
      const palm = arm.palmLocal * arm.hand.getWorldScale(V()).x;
      const normal =
        side === "right"
          ? right.clone()
          : rifle
            ? UP.clone().negate()
            : right.clone().negate();
      const point = grip.clone();
      if (side === "left" && rifle)
        point
          .addScaledVector(forward, actor.kind === "cody" ? 0.2 : 0.16)
          .addScaledVector(UP, -0.015);
      else
        point
          .addScaledVector(right, side === "right" ? 0.025 : -0.025)
          .addScaledVector(UP, side === "left" ? -0.025 : 0);
      const wrist = point.addScaledVector(forward, -palm);
      const pole = actor.position
        .clone()
        .addScaledVector(right, side === "right" ? 0.7 : -0.7)
        .add(new T.Vector3(0, 0.65, 0.05));
      solveArm(arm.upper, arm.lower, arm.hand, wrist, pole);
      const basisRight = normal.clone().cross(forward).normalize(),
        basisUp = forward.clone().cross(basisRight).normalize();
      const q = new T.Quaternion()
        .setFromRotationMatrix(
          new T.Matrix4().makeBasis(basisRight, basisUp, forward),
        )
        .multiply(arm.localFrame.clone().invert());
      setWorldRotation(arm.hand, q);
      this.curl(arm, basisRight, grip);
    }
  }
  curl(arm, basisRight, grip) {
    for (const finger of arm.fingers)
      finger.quaternion.copy(this.fingerRest.get(finger));
    arm.hand.updateMatrixWorld(true);
    // Finger axes differ between the two rigs. Curl in the shared world-space palm frame.
    for (const finger of arm.fingers) {
      const thumb = /Thumb|finger_1/.test(finger.name);
      let bend;
      if (thumb) {
        if (/Thumb1$|finger_1a$/.test(finger.name)) {
          const child = finger.children.find((o) => o.isBone);
          if (child) {
            const a = finger.getWorldPosition(V()),
              d = child.getWorldPosition(V()).sub(a).normalize(),
              goal = grip.clone().addScaledVector(UP, 0.025).sub(a).normalize();
            const delta = new T.Quaternion().setFromUnitVectors(d, goal);
            delta.slerp(new T.Quaternion(), 0.3);
            rotateWorld(finger, delta);
          }
        }
        continue;
      }
      const joint = Number(
        finger.name.match(/([123])$/)?.[1] ||
          { a: 1, b: 2, c: 3 }[finger.name.at(-1)],
      );
      const trigger =
        /Index|finger_2/.test(finger.name) && arm.side === "right";
      bend = (trigger ? [0.35, 0.55, 0.45] : [0.65, 1.05, 0.7])[joint - 1];
      rotateWorld(
        finger,
        new T.Quaternion().setFromAxisAngle(basisRight, bend),
      );
    }
  }
}
export function stabilizeZombie(actor) {
  const { hip, head, upperLegs } = actor;
  if (!hip || !head || !upperLegs?.length) return;
  actor.root.updateMatrixWorld(true);
  const origin = hip.getWorldPosition(V()),
    axis = head.getWorldPosition(V()).sub(origin).normalize();
  const forward = new T.Vector3(Math.sin(actor.yaw), 0, Math.cos(actor.yaw));
  const lean =
    actor.current === "Idle_Sway"
      ? 0.25
      : actor.current === "Idle_Lurch"
        ? 0.18
        : 0.14;
  const desired = UP.clone().addScaledVector(forward, lean).normalize();
  const delta = new T.Quaternion().setFromUnitVectors(axis, desired);
  const preserved = [
    ...upperLegs,
    ...(["Idle_Sway", "Idle_Lurch"].includes(actor.current)
      ? actor.zombieArms || []
      : []),
  ].map((b) => [b, b.getWorldQuaternion(new T.Quaternion())]);
  rotateWorld(hip, delta);
  // Keep the leg poses in world space while correcting the incorrectly baked pelvis basis.
  for (const [b, q] of preserved) setWorldRotation(b, q);
  for (const [bone, reference] of actor.zombieReferences || []) {
    if (
      actor.feet.includes(bone) &&
      !["Idle_Sway", "Idle_Lurch"].includes(actor.current)
    )
      continue;
    setWorldRotation(
      bone,
      actor.root.getWorldQuaternion(new T.Quaternion()).multiply(reference),
    );
  }
  actor.root.updateMatrixWorld(true);
}
