import * as T from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { clone } from "../vendor/SkeletonUtils.js";
const loader = new GLTFLoader();
export const STORY_ASSETS = {
  may: "assets/character2_story.glb",
  cody: "assets/cody_story.glb",
  zombie: "assets/zombie_pool.glb",
  m92: "assets/m92.glb",
  colt723: "assets/colt723.glb",
  cabin: "assets/cabin.glb",
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
        onProgress?.((done + event.loaded / event.total) / 6, name);
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
      ["may", "cody", "zombie"].includes(name) &&
      (!materials || textured !== materials)
    )
      throw Error(name + " 的颜色贴图未能读取，请重试");
    done++;
    onProgress?.(done / 6, name);
  }
  return result;
}
export class Actor {
  constructor(asset, kind, scene, equipment = null) {
    this.equipment = equipment;
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
    this.model.traverse((o) => {
      if (
        o.isBone &&
        (kind === "cody"
          ? o.name === "RightHand"
          : kind === "may"
            ? o.name === "arm_right_wrist"
            : false)
      )
        this.hand = o;
    });
    this.play(kind === "zombie" ? "Idle_Lurch" : "Idle", true);
    this.mixer.update(0);
    this.model.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(this.model, true);
    const scale =
      (kind === "zombie" ? 1.85 : 1.8) /
      Math.max(0.1, bounds.max.y - bounds.min.y);
    this.model.scale.multiplyScalar(scale);
    this.model.position.y -= bounds.min.y * scale;
    this.feet = [];
    this.hip = null;
    this.head = null;
    this.model.traverse((o) => {
      if (o.isBone && /(?:Head(?:_\d+)?|head_neck_upper)$/.test(o.name))
        this.head = o;
      if (o.isBone && /(?:Hips(?:_\d+)?|root_hips)$/.test(o.name)) this.hip = o;
      if (
        o.isBone &&
        !/ik/i.test(o.name) &&
        (/(?:Left|Right)(?:Foot|ToeBase)(?:_\d+)?$/.test(o.name) ||
          /leg_(?:left|right)_(?:ankle|toes)$/.test(o.name))
      )
        this.feet.push(o);
    });
    this.correctGround();
    if (kind !== "zombie") {
      const run = asset.animations.find((c) => c.name === "Run"),
        aim = asset.animations.find((c) => c.name === "Aim");
      const upper = (n) =>
        /spine|neck|head|shoulder|arm|hand|finger|thumb|index|middle|ring|pinky/i.test(
          n,
        );
      if (run && aim) {
        const lower = run.tracks.filter((t) => !upper(t.name));
        const top = aim.tracks.filter((t) => upper(t.name));
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
              pistol.tracks.filter((t) => upper(t.name)),
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
    model.rotation.y = -Math.PI / 2;
    model.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(model),
      size = box.getSize(new T.Vector3());
    model.scale.multiplyScalar(
      (id === "m92" ? 0.23 : 0.86) / Math.max(size.x, size.y, size.z),
    );
    model.updateMatrixWorld(true);
    const fit = new T.Box3().setFromObject(model),
      center = fit.getCenter(new T.Vector3());
    model.position.set(
      -center.x,
      -fit.min.y - (id === "m92" ? 0.1 : 0.16),
      -center.z + (id === "m92" ? 0.07 : 0.19),
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
  play(name, instant = false) {
    if (this.current === name) return;
    const next = this.actions.get(name);
    if (!next) throw Error("Missing animation: " + this.kind + " / " + name);
    for (const a of this.actions.values()) a.stop();
    next.reset().play();
    this.current = name;
  }
  animate(dt, { moving = false, aim = false, talk = false, speed = 1 } = {}) {
    if (this.kind === "zombie") {
      this.mixer.update(dt);
      this.correctGround();
      return;
    }
    if (talk) this.play("Talk");
    else if (aim && moving) {
      if (this.current !== "AimWalk") {
        for (const a of this.actions.values()) a.stop();
        this.actions.get("RunLower").reset().play();
        this.actions
          .get(this.weapon === "m92" ? "PistolUpper" : "AimUpper")
          .reset()
          .play();
        this.current = "AimWalk";
      }
      this.actions.get("RunLower").timeScale = Math.max(0.3, speed / 3.1);
    } else {
      this.play(
        aim
          ? this.weapon === "m92"
            ? "PistolAim"
            : "Aim"
          : moving
            ? "Run"
            : this.armed && this.weapon === "m92"
              ? "PistolReady"
              : "Idle",
      );
      if (moving && !aim)
        this.actions.get("Run").timeScale = Math.max(0.4, speed / 3.1);
    }
    this.mixer.update(dt);
    this.correctGround();
    if (this.gun) this.gun.visible = this.armed && !talk;
  }
  correctGround() {
    if (!this.feet?.length) return;
    this.root.updateMatrixWorld(true);
    if (this.kind === "zombie" && this.hip) {
      const hipPoint = new T.Vector3();
      this.hip.getWorldPosition(hipPoint);
      this.root.worldToLocal(hipPoint);
      if (!this.motionOrigin)
        this.motionOrigin = new T.Vector2(hipPoint.x, hipPoint.z);
      else {
        this.model.position.x += this.motionOrigin.x - hipPoint.x;
        this.model.position.z += this.motionOrigin.y - hipPoint.z;
        this.root.updateMatrixWorld(true);
      }
    }
    const p = new T.Vector3();
    let foot = Infinity;
    for (const b of this.feet) {
      b.getWorldPosition(p);
      foot = Math.min(foot, p.y);
    }
    if (Number.isFinite(foot)) {
      this.model.position.y += this.root.position.y + 0.035 - foot;
      this.model.updateMatrixWorld(true);
    }
  }
  updateGun(target) {
    this.shadow.position.set(this.position.x, 0.025, this.position.z);
    if (!this.gun) return;
    this.root.updateMatrixWorld(true);
    if (this.hand) this.hand.getWorldPosition(this.gun.position);
    else this.gun.position.copy(this.position).add(new T.Vector3(0, 1, 0));
    const forward = new T.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.gun.lookAt(
      target || this.gun.position.clone().add(forward.multiplyScalar(15)),
    );
  }
  muzzle() {
    const p = new T.Vector3(0, 0.015, this.weapon === "m92" ? 0.19 : 0.62);
    return this.gun
      ? this.gun.localToWorld(p)
      : this.position.clone().add(new T.Vector3(0, 1.2, 0));
  }
  remove() {
    this.scene.remove(this.root, this.shadow);
    if (this.gun) this.scene.remove(this.gun);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.shadow.geometry.dispose();
    this.shadow.material.map.dispose();
    this.shadow.material.dispose();
  }
}
