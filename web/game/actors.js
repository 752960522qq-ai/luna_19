import { poseRifleReload } from "./rifle-reload.js";
import { NPC_MODELS } from "./metro-state.js";
import { CharacterRig, stabilizeZombie } from "./rig.js";
import * as T from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { clone } from "../vendor/SkeletonUtils.js";
const loader = new GLTFLoader();
export const STORY_ASSETS = {
  may: "assets/character2_story.glb",
  cody: "assets/cody_story.glb",
  zombie: "assets/zombie_pool.glb",
  zombieShirt: "assets/zombie_shirt.glb",
  m92: "assets/m92.glb",
  colt723: "assets/colt723.glb",
  cabin: "assets/cabin.glb",
  metroStation: "assets/metro_station.glb",
  money: "assets/money.glb",
  ...Object.fromEntries(
    NPC_MODELS.map((id) => [id, "assets/npc_" + id + ".glb"]),
  ),
};
function shadow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d"),
    g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, "rgba(0,0,0,.38)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const m = new T.Mesh(
    new T.PlaneGeometry(1.5, 1.5),
    new T.MeshBasicMaterial({
      map: new T.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.025;
  return m;
}
function gun() {
  const group = new T.Group();
  function part(w, h, d, x, y, z, color) {
    const m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.35 }),
    );
    m.position.set(x, y, z);
    group.add(m);
  }
  part(0.12, 0.14, 0.38, 0, 0, 0.09, 0x3c6261);
  part(0.075, 0.075, 0.23, 0, 0.015, 0.39, 0x303b3c);
  part(0.13, 0.13, 0.045, 0, 0.015, 0.52, 0xf2ca73);
  part(0.075, 0.17, 0.07, 0, -0.12, 0.03, 0x444b49);
  part(0.1, 0.04, 0.1, 0, 0.1, 0.05, 0xe3e4c5);
  return group;
}
export async function loadActors(onProgress) {
  const result = {};
  let done = 0;
  for (const [name, url] of Object.entries(STORY_ASSETS)) {
    result[name] = await loader.loadAsync(url, (event) => {
      if (event.total)
        onProgress?.(
          (done + event.loaded / event.total) /
            Object.keys(STORY_ASSETS).length,
          name,
        );
    });
    let materials = 0,
      textured = 0;
    result[name].scene.traverse((o) => {
      if (o.isMesh)
        for (const material of Array.isArray(o.material)
          ? o.material
          : [o.material]) {
          materials++;
          if (material.map?.image?.width > 0) textured++;
        }
    });
    if (
      ["may", "cody", "zombie", "zombieShirt"].includes(name) &&
      (!materials || textured !== materials)
    )
      throw Error(name + " 的颜色贴图未能读取，请重试");
    done++;
    onProgress?.(done / Object.keys(STORY_ASSETS).length, name);
  }
  return result;
}
export class Actor {
  constructor(asset, kind, scene, equipment = null) {
    this.equipment = equipment;
    this.authoredZombie =
      kind === "zombie" &&
      (asset.scene.userData.zombieRigVersion >= 2 ||
        asset.animations.some((c) => c.name === "Walk"));
    this.weapon = "m92";
    this.armed = true;
    this.kind = kind;
    this.scene = scene;
    this.root = new T.Group();
    this.model = clone(asset.scene);
    this.root.add(this.model);
    scene.add(this.root);
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
      }
    });
    this.mixer = new T.AnimationMixer(this.model);
    this.actions = new Map();
    this.activeActions = new Set();
    this.retiring = new Map();
    for (const clip of asset.animations)
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.animations = asset.animations;
    this.current = "";
    this.shadow = shadow();
    scene.add(this.shadow);
    this.gun = kind === "zombie" ? null : new T.Group();
    if (this.gun) this.setWeapon("m92");
    if (this.gun) scene.add(this.gun);
    this.hand = null;
    this.feet = [];
    this.hip = null;
    this.head = null;
    this.neck = null;
    this.upperLegs = [];
    this.zombieArms = [];
    this.model.traverse((o) => {
      if (!o.isBone) return;
      if (
        ((kind === "cody" || kind === "guard") && o.name === "RightHand") ||
        (kind === "may" && o.name === "arm_right_wrist")
      )
        this.hand = o;
      if (/(?:Head(?:_\d+)?|head_neck_upper)$/.test(o.name)) this.head = o;
      if (/Neck(?:_\d+)?$/.test(o.name)) this.neck = o;
      if (/(?:Hips(?:_\d+)?|root_hips)$/.test(o.name)) this.hip = o;
      if (
        !/ik/i.test(o.name) &&
        (/(?:Left|Right)(?:Foot|ToeBase)(?:_\d+)?$/.test(o.name) ||
          /leg_(?:left|right)_(?:ankle|toes)$/.test(o.name))
      )
        this.feet.push(o);
      if (/(?:Left|Right)Arm(?:_\d+)?$/.test(o.name)) this.zombieArms.push(o);
      if (/(?:Left|Right)UpLeg(?:_\d+)?$/.test(o.name)) this.upperLegs.push(o);
    });
    if (kind === "zombie" && !this.authoredZombie) {
      this.play("Walk_Shuffle", true);
      this.actions.get("Walk_Shuffle").time =
        asset.animations.find((c) => c.name === "Walk_Shuffle").duration * 0.25;
      this.mixer.update(0);
      this.root.updateMatrixWorld(true);
      this.zombieHeadRef = this.head?.getWorldQuaternion(new T.Quaternion());
      this.zombieReferences = [this.neck, this.head, ...this.feet]
        .filter(Boolean)
        .map((b) => {
          const q = b.getWorldQuaternion(new T.Quaternion()); // The exported zombie neck/head retain a quarter-turn source basis.
          if (b === this.neck || b === this.head)
            q.premultiply(
              new T.Quaternion().setFromAxisAngle(
                new T.Vector3(1, 0, 0),
                -Math.PI / 2,
              ),
            );
          return [b, q];
        });
    }
    this.play(
      kind === "zombie" && this.actions.has("Idle_Lurch")
        ? "Idle_Lurch"
        : "Idle",
      true,
    );
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    if (kind === "zombie" && !this.authoredZombie) stabilizeZombie(this);
    const bounds = new T.Box3().setFromObject(this.model, true),
      scale =
        (kind === "zombie" ? 1.85 : 1.8) /
        Math.max(0.1, bounds.max.y - bounds.min.y);
    this.model.scale.multiplyScalar(scale);
    this.model.position.y -= bounds.min.y * scale;
    this.root.updateMatrixWorld(true);
    this.soleSamples = this.findSoles();
    this.correctGround();
    if (kind !== "zombie") this.rig = new CharacterRig(this);
    if (kind !== "zombie") {
      const run = asset.animations.find((c) => c.name === "Run"),
        aim = asset.animations.find((c) => c.name === "Aim");
      const upper = (n) =>
        /spine|neck|head|shoulder|arm|hand|finger|thumb|index|middle|ring|pinky/i.test(
          n,
        );
      if (run && aim) {
        const legTrack = (n) =>
          /(?:Left|Right)(?:UpLeg|Leg|Foot|ToeBase)(?:_\d+)?\.|leg_(?:left|right)_/.test(
            n,
          );
        const hipPosition = (n) => /(?:Hips|root_hips)\.position$/.test(n);
        const hipRotation = (n) =>
          /(?:Hips|root_hips)\.(?:quaternion|scale)$/.test(n);
        const lower = run.tracks
          .filter((t) => legTrack(t.name) || hipPosition(t.name))
          .map((track) => {
            const t = track.clone(),
              reference = aim.tracks.find((a) => a.name === t.name);
            if (!reference) return t;
            const rest = reference
              .createInterpolant()
              .evaluate(aim.duration * 0.25);
            if (t.ValueTypeName === "quaternion") {
              const base = new T.Quaternion().fromArray(rest),
                value = new T.Quaternion();
              for (let i = 0; i < t.values.length; i += 4) {
                value.fromArray(t.values, i);
                value
                  .copy(base)
                  .slerp(new T.Quaternion().fromArray(t.values, i), 0.48);
                value.toArray(t.values, i);
              }
            } else if (hipPosition(t.name)) {
              const origin = Array.from(t.values.slice(0, 3));
              for (let i = 0; i < t.values.length; i++)
                t.values[i] =
                  rest[i % 3] + (t.values[i] - origin[i % 3]) * 0.25;
            }
            return t;
          });
        const top = aim.tracks.filter(
          (t) => upper(t.name) || hipRotation(t.name),
        );
        this.actions.set(
          "RunLower",
          this.mixer.clipAction(
            new T.AnimationClip("RunLower", run.duration, lower),
          ),
        );
        this.actions.set(
          "AimUpper",
          this.mixer.clipAction(
            new T.AnimationClip("AimUpper", aim.duration, top),
          ),
        );
      }
      // The uploaded Pistol Idle is a low-ready stance, not an eye-level aim.
      // Keep it as PistolReady; use the already retargeted raised-arm Aim for firing.
      this.actions.set("PistolReady", this.actions.get("PistolAim"));
      this.actions.set(
        "PistolAim",
        this.mixer.clipAction(
          new T.AnimationClip("PistolAimRaised", aim.duration, aim.tracks),
        ),
      );
      const pistol = aim;
      if (pistol)
        this.actions.set(
          "PistolUpper",
          this.mixer.clipAction(
            new T.AnimationClip(
              "PistolUpper",
              pistol.duration,
              pistol.tracks.filter(
                (t) =>
                  upper(t.name) ||
                  /(?:Hips|root_hips)\.(?:quaternion|scale)$/.test(t.name),
              ),
            ),
          ),
        );
    }
  }
  setWeapon(id) {
    this.weapon = id;
    this.current = "";
    if (!this.gun) return;
    this.gun.clear();
    const asset = this.equipment?.[id];
    if (!asset) {
      this.gun.add(gun());
      return;
    }
    const model = clone(asset.scene);
    model.rotation.y = Math.PI / 2;
    model.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(model),
      size = box.getSize(new T.Vector3());
    const length =
      id === "m92"
        ? this.kind === "cody"
          ? 0.36
          : 0.27
        : this.kind === "cody"
          ? 0.96
          : 0.78;
    model.scale.multiplyScalar(length / Math.max(size.x, size.y, size.z));
    model.updateMatrixWorld(true);
    const fit = new T.Box3().setFromObject(model),
      height = fit.max.y - fit.min.y;
    const gripY = fit.min.y + height * (id === "m92" ? 0.35 : 0.25),
      gripZ = fit.min.z + length * (id === "m92" ? 0.2 : 0.32);
    model.position.set(-(fit.min.x + fit.max.x) / 2, -gripY, -gripZ);
    this.muzzleLocal = new T.Vector3(
      0,
      fit.min.y + height * (id === "m92" ? 0.85 : 0.67) - gripY,
      fit.max.z - gripZ,
    );
    this.gun.add(model);
  }

  get position() {
    return this.root.position;
  }
  get yaw() {
    return this.root.rotation.y;
  }
  set yaw(v) {
    this.root.rotation.y = v;
  }
  activate(name, names, instant = false) {
    if (this.current === name) return;
    const wanted = new Set(
      names.map((n) => {
        const action = this.actions.get(n);
        if (!action) throw Error("Missing animation: " + this.kind + " / " + n);
        return action;
      }),
    );
    for (const action of this.activeActions)
      if (!wanted.has(action)) {
        if (instant) {
          action.stop();
          this.activeActions.delete(action);
        } else {
          action.fadeOut(0.14);
          this.retiring.set(action, this.mixer.time + 0.14);
        }
      }
    for (const action of wanted) {
      if (!this.activeActions.has(action) || this.retiring.has(action)) {
        action.reset().setEffectiveWeight(1).play();
        if (!instant) action.fadeIn(0.14);
      }
      this.retiring.delete(action);
      this.activeActions.add(action);
    }
    this.current = name;
  }
  play(name, instant = false) {
    this.activate(name, [name], instant);
  }
  animate(dt, { moving = false, aim = false, talk = false, speed = 1 } = {}) {
    this.aiming = aim;
    this.moving = moving;
    this.talking = talk;
    if (this.kind === "zombie") {
      this.mixer.update(dt);
      this.correctGround();
      return;
    }
    if (talk) this.play("Talk");
    else if (aim && moving) {
      this.activate("AimWalk", [
        "RunLower",
        this.weapon === "m92" ? "PistolUpper" : "AimUpper",
      ]);
      this.actions.get("RunLower").timeScale = Math.max(0.3, speed / 3.1);
    } else {
      this.play(
        aim
          ? this.weapon === "m92"
            ? "PistolAim"
            : "Aim"
          : moving
            ? this.armed && this.weapon === "colt723"
              ? "RifleRun"
              : "Run"
            : this.armed
              ? this.weapon === "m92"
                ? "PistolReady"
                : "RifleIdle"
              : "Idle",
      );
      if (moving && !aim)
        this.actions.get(this.current).timeScale = Math.max(0.4, speed / 3.1);
    }
    this.mixer.update(dt);
    this.correctGround();
    if (this.gun) this.gun.visible = this.armed && !talk;
  }
  findSoles() {
    const samples = [],
      temp = new T.Vector3();
    for (const foot of this.feet) {
      const candidates = [];
      this.model.traverse((mesh) => {
        if (!mesh.isSkinnedMesh) return;
        const indices = mesh.geometry.attributes.skinIndex,
          weights = mesh.geometry.attributes.skinWeight,
          footIndex = mesh.skeleton.bones.indexOf(foot);
        if (footIndex < 0) return;
        for (let i = 0; i < indices.count; i++) {
          let weight = 0;
          for (let j = 0; j < 4; j++)
            if (indices.getComponent(i, j) === footIndex)
              weight += weights.getComponent(i, j);
          if (weight < 0.45) continue;
          mesh.getVertexPosition(i, temp);
          temp.applyMatrix4(mesh.matrixWorld);
          candidates.push({ mesh, index: i, p: temp.clone() });
        }
      });
      if (!candidates.length) continue;
      const box = new T.Box3().setFromPoints(candidates.map((c) => c.p)),
        size = box.getSize(new T.Vector3()),
        bins = new Map();
      for (const c of candidates) {
        const x = Math.min(
            4,
            Math.floor(((c.p.x - box.min.x) / Math.max(0.001, size.x)) * 5),
          ),
          z = Math.min(
            4,
            Math.floor(((c.p.z - box.min.z) / Math.max(0.001, size.z)) * 5),
          ),
          key = x + "," + z;
        if (!bins.has(key) || bins.get(key).p.y > c.p.y) bins.set(key, c);
      }
      samples.push(
        ...[...bins.values()].map(({ mesh, index }) => ({ mesh, index })),
      );
    }
    return samples;
  }
  correctGround() {
    for (const [action, stopAt] of this.retiring) {
      if (this.mixer.time >= stopAt) {
        action.stop();
        this.retiring.delete(action);
        this.activeActions.delete(action);
      }
    }
    if (!this.feet?.length) return;
    if (this.kind === "zombie" && !this.authoredZombie) stabilizeZombie(this);
    this.root.updateMatrixWorld(true);
    if (this.hip) {
      const p = this.hip.getWorldPosition(new T.Vector3());
      this.root.worldToLocal(p);
      if (!this.motionOrigin) this.motionOrigin = new T.Vector2(p.x, p.z);
      else {
        this.model.position.x += this.motionOrigin.x - p.x;
        this.model.position.z += this.motionOrigin.y - p.z;
        this.root.updateMatrixWorld(true);
      }
    }
    let bottom = Infinity;
    const p = new T.Vector3();
    for (const { mesh, index } of this.soleSamples || []) {
      mesh.getVertexPosition(index, p);
      p.applyMatrix4(mesh.matrixWorld);
      bottom = Math.min(bottom, p.y);
    }
    if (!Number.isFinite(bottom))
      for (const foot of this.feet) {
        foot.getWorldPosition(p);
        bottom = Math.min(bottom, p.y - 0.035);
      }
    if (Number.isFinite(bottom)) {
      this.model.position.y += this.position.y + 0.012 - bottom;
      this.root.updateMatrixWorld(true);
    }
  }
  updateGun(target) {
    this.shadow.position.set(
      this.position.x,
      this.position.y + 0.025,
      this.position.z,
    );
    if (this.reloadMagazine) this.reloadMagazine.visible = false;
    if (!this.gun) return;
    this.gun.visible = this.armed && !this.talking;
    if (!this.gun.visible) return;
    this.root.updateMatrixWorld(true);
    const forward = new T.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const arm = this.rig?.arms.right;
    if (arm && (!this.moving || this.aiming || this.weapon === "colt723")) {
      const shoulder = arm.upper.getWorldPosition(new T.Vector3());
      const left =
        this.rig.arms.left?.upper.getWorldPosition(new T.Vector3()) || shoulder;
      const center = shoulder.clone().add(left).multiplyScalar(0.5);
      const reach =
        shoulder.distanceTo(arm.lower.getWorldPosition(new T.Vector3())) +
        arm.lower
          .getWorldPosition(new T.Vector3())
          .distanceTo(arm.hand.getWorldPosition(new T.Vector3()));
      const palm = arm.palmLocal * arm.hand.getWorldScale(new T.Vector3()).x;
      const grip = center.addScaledVector(
        forward,
        reach * (this.aiming ? (this.weapon === "m92" ? 0.72 : 0.46) : 0.35) +
          palm * 0.6,
      );
      grip.y =
        this.aiming && this.head
          ? this.head.getWorldPosition(new T.Vector3()).y +
            0.065 -
            (this.muzzleLocal?.y || 0.08)
          : shoulder.y - 0.15;
      // Muzzle pitch follows the target, while shoulder placement remains inside arm reach.
      const direction =
        this.aiming && target
          ? target.clone().sub(grip).normalize()
          : forward
              .clone()
              .add(new T.Vector3(0, -0.3, 0))
              .normalize();
      direction.y = T.MathUtils.clamp(direction.y, -0.55, 0.5);
      direction.normalize();
      this.rig.hold(grip, direction, this.weapon === "colt723", this.aiming);
      const wrist = arm.hand.getWorldPosition(new T.Vector3()),
        palmLength = arm.palmLocal * arm.hand.getWorldScale(new T.Vector3()).x;
      this.gun.position
        .copy(wrist)
        .addScaledVector(direction, palmLength)
        .addScaledVector(
          direction
            .clone()
            .cross(new T.Vector3(0, 1, 0))
            .normalize(),
          -0.025,
        );
      this.gun.lookAt(this.gun.position.clone().add(direction));
    } else if (this.hand) {
      this.hand.getWorldPosition(this.gun.position);
      if (arm) {
        const q = this.hand
          .getWorldQuaternion(new T.Quaternion())
          .multiply(arm.localFrame);
        this.gun.quaternion.copy(q);
        this.gun.position.addScaledVector(
          new T.Vector3(0, 0, 1).applyQuaternion(q),
          arm.palmLocal * arm.hand.getWorldScale(new T.Vector3()).x,
        );
        this.rig.curl(
          arm,
          new T.Vector3(1, 0, 0).applyQuaternion(q),
          this.gun.position,
        );
      } else
        this.gun.quaternion.copy(
          this.hand.getWorldQuaternion(new T.Quaternion()),
        );
    }
  }
  applyReload(progress) {
    this.reloadProgress = progress;
    if (this.reloadMagazine) this.reloadMagazine.visible = false;
    if (this.weapon === "colt723" && progress != null && this.gun?.visible)
      poseRifleReload(this, progress);
  }
  muzzle() {
    return this.gun
      ? this.gun.localToWorld(
          (this.muzzleLocal || new T.Vector3(0, 0.05, 0.2)).clone(),
        )
      : this.position.clone().add(new T.Vector3(0, 1.2, 0));
  }

  remove() {
    this.scene.remove(this.root, this.shadow);
    if (this.gun) this.scene.remove(this.gun);
    if (this.reloadMagazine) {
      this.scene.remove(this.reloadMagazine);
      this.reloadMagazine.geometry.dispose();
      this.reloadMagazine.material.dispose();
    }
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.shadow.geometry.dispose();
    this.shadow.material.map.dispose();
    this.shadow.material.dispose();
  }
}
