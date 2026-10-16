import { AudioSystem } from "./audio.js";
import { CabinWorld } from "./cabin.js";
import { Prologue } from "./prologue.js";
import {
  WEAPONS,
  CODY_ACCURACY,
  CODY_DAMAGE_SCALE,
  equipWeapon,
  stashWeapon,
} from "./weapons.js";
import { PROLOGUE_TITLE } from "./prologue-state.js";
import * as T from "../vendor/three.module.js";
import { Actor, loadActors } from "./actors.js";
import { World } from "./world.js";
import { Input } from "./input.js";
import { Dialogue, DIALOGUES } from "./dialogue.js";
import {
  SaveStore,
  freshState,
  freshPrologue,
  random,
  pickZombieActions,
  OBJECTIVES,
  CHAPTER,
} from "./state.js";
const $ = (id) => document.getElementById(id);
const UP = new T.Vector3(0, 1, 0);
export class Game {
  constructor() {
    this.renderer = new T.WebGLRenderer({
      canvas: $("view"),
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(52, 1, 0.08, 100);
    this.warehouse = new World(this.scene);
    this.world = this.warehouse;
    this.cabin = new CabinWorld(this.scene);
    this.prologue = new Prologue(this);
    this.audio = new AudioSystem();
    this.input = new Input();
    this.store = new SaveStore();
    this.dialogue = new Dialogue(() => {
      this.input.clear();
    }, this.audio);
    this.mode = "loading";
    this.ready = false;
    this.enemies = [];
    this.state = freshState();
    this.yaw = 0;
    this.pitch = 0.22;
    this.speed = 0;
    this.time = 0;
    this.cooldown = 0;
    this.reloadLeft = 0;
    this.codyCooldown = 0;
    this.blackoutLeft = 0;
    this.autosave = 0;
    this.toastLeft = 0;
    this.hitLeft = 0;
    this.damageFlash = 0;
    this.fpsTime = 0;
    this.fpsCount = 0;
    this.clock = new T.Clock();
    this.bind();
    this.resize();
    addEventListener("resize", () => this.resize());
    requestAnimationFrame(() => this.frame());
    this.init();
  }
  bind() {
    document.addEventListener("click", (e) => {
      if (e.target.closest("button")) this.audio.play("ui", { volume: 0.12 });
    });
    $("accept-gift").onclick = () => this.prologue.choose(true);
    $("reject-gift").onclick = () => this.prologue.choose(false);
    $("prologue-save").onclick = () => this.save(true);
    $("next-chapter").onclick = () => this.nextChapter();
    $("prologue-menu").onclick = () => this.showMenu();
    $("weapon-m92").onclick = () => this.switchWeapon("m92");
    $("weapon-colt723").onclick = () => this.switchWeapon("colt723");
    $("new-game").onclick = () => {
      if (this.store.read() && !this.confirmNew) {
        this.confirmNew = true;
        $("new-confirm").hidden = false;
        return;
      }
      this.confirmNew = false;
      $("new-confirm").hidden = true;
      this.startNew();
    };
    $("cancel-new").onclick = () => {
      this.confirmNew = false;
      $("new-confirm").hidden = true;
    };
    $("confirm-new").onclick = () => {
      this.confirmNew = false;
      $("new-confirm").hidden = true;
      this.startNew();
    };
    $("load-game").onclick = () => this.loadGame();
    $("pause").onclick = () => this.pause();
    $("resume").onclick = () => this.resume();
    $("save").onclick = () => this.save(true);
    $("return-menu").onclick = () => {
      this.save();
      this.showMenu();
    };
    $("reload").onclick = () => this.reload();
    $("interact").onclick = () => this.interact();
    $("death-load").onclick = () => this.loadGame();
    $("death-new").onclick = () => this.startNew();
    $("ending-menu").onclick = () => this.showMenu();
    $("retry-load").onclick = () => this.init();
    addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "Escape") {
        if (this.mode === "playing") this.pause();
        else if (this.mode === "paused") this.resume();
      }
      if (this.mode === "playing" && !this.dialogue.active) {
        if (e.code === "Digit1") this.switchWeapon("m92");
        if (e.code === "Digit2") this.switchWeapon("colt723");
        if (e.code === "KeyR") this.reload();
        if (e.code === "KeyE") this.interact();
      }
      if (this.dialogue.active && e.code === "Enter") this.dialogue.next();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.mode === "playing") {
        this.save();
        this.pause();
      }
    });
  }
  async init() {
    if (this.ready) return;
    $("loading").hidden = false;
    $("retry-load").hidden = true;
    try {
      this.assets = await loadActors((p, name) => {
        $("load-progress").style.width = Math.round(p * 100) + "%";
        $("load-text").textContent =
          "正在准备" +
          {
            may: "小梅",
            cody: "科迪",
            zombie: "丧尸",
            m92: "M92",
            colt723: "柯尔特 723",
            cabin: "木屋",
          }[name] +
          "…";
      });
      for (const [kind, names] of [
        ["may", ["Idle", "Run", "Aim", "PistolAim", "Talk"]],
        ["cody", ["Idle", "Run", "Aim", "PistolAim", "Talk"]],
        ["zombie", ["Idle_Sway", "Idle_Lurch", "Walk_Shuffle", "Walk_Heavy"]],
      ]) {
        for (const n of names)
          if (!this.assets[kind].animations.some((a) => a.name === n))
            throw Error(kind + " 缺少动作 " + n);
      }
      this.may = new Actor(this.assets.may, "may", this.scene, this.assets);
      this.cody = new Actor(this.assets.cody, "cody", this.scene, this.assets);
      this.cabin.fitExterior(this.assets.cabin);
      this.ready = true;
      $("loading").hidden = true;
      this.showMenu();
    } catch (e) {
      console.error(e);
      $("load-text").textContent = "载入失败：" + e.message;
      $("retry-load").hidden = false;
    }
  }
  setMode(mode) {
    this.mode = mode;
    $("prologue-ending").hidden = mode !== "prologue-complete";
    if (mode !== "playing") {
      this.audio?.stop();
      $("gift-choice").hidden = true;
    }
    document.body.dataset.mode = mode;
    $("menu").hidden = mode !== "menu";
    $("pause-panel").hidden = mode !== "paused";
    $("death-panel").hidden = mode !== "dead";
    $("ending-panel").hidden = mode !== "complete";
    this.input.clear();
  }
  showMenu() {
    this.dialogue.clear();
    this.selectWorld(1);
    this.may.armed = this.cody.armed = false;
    this.setMode("menu");
    const save = this.store.read();
    $("load-game").disabled = !save;
    $("save-summary").textContent = save
      ? `${save.chapter === 0 ? PROLOGUE_TITLE : CHAPTER} · ${new Date(save.savedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`
      : this.store.error || "暂无存档，开始一段不太可靠的合作";
    this.may.position.set(1, 0, 7.8);
    this.cody.position.set(3.3, 0, 8.2);
    this.may.yaw = 0.55;
    this.cody.yaw = -0.35;
    this.world.reset();
    for (const e of this.enemies)
      e.actor.root.visible = e.actor.shadow.visible = false;
  }
  startNew() {
    if (!this.ready) return;
    this.audio.unlock().catch(console.warn);
    this.start(freshPrologue());
    this.save();
    this.prologue.resume();
  }
  selectWorld(chapter) {
    this.warehouse.scene.visible = chapter !== 0;
    this.cabin.scene.visible = chapter === 0;
    this.world = chapter === 0 ? this.cabin : this.warehouse;
    this.scene.background = new T.Color(chapter === 0 ? 0x73867d : 0x223338);
    this.scene.fog = new T.Fog(chapter === 0 ? 0x73867d : 0x223338, 30, 85);
  }
  nextChapter() {
    if (this.state.chapter !== 0 || this.state.prologue.phase !== "complete")
      return;
    stashWeapon(this.state);
    const old = this.state,
      s = freshState();
    s.inventory = structuredClone(old.inventory);
    s.weapon = old.weapon;
    s.kills = old.kills;
    s.player.ammo = old.player.ammo;
    s.player.reserve = old.player.reserve;
    this.start(s);
    this.spawnEnemy(-5, -8);
    this.spawnEnemy(6, -10);
    this.dialogue.start(DIALOGUES.intro, () => {
      this.state.flags.intro = true;
      this.save();
    });
    this.save();
  }
  switchWeapon(id) {
    if (
      this.mode !== "playing" ||
      this.dialogue.active ||
      this.state.prologue?.phase === "offer" ||
      this.reloadLeft > 0
    )
      return;
    if (equipWeapon(this.state, id)) {
      this.may.setWeapon(id);
      this.audio.play("equip");
      this.cooldown = 0.25;
    }
  }

  loadGame() {
    const saved = this.store.read();
    if (!saved) {
      this.toast(this.store.error || "没有可读取的存档");
      return;
    }
    this.audio.unlock().catch(console.warn);
    this.start(saved);
    if (saved.chapter === 0) this.prologue.resume();
    else if (!saved.flags.intro)
      this.dialogue.start(DIALOGUES.intro, () => {
        this.state.flags.intro = true;
        this.save();
      });
    this.toast("已读取存档");
  }
  start(state) {
    for (const e of this.enemies) e.actor.remove();
    this.enemies = [];
    this.state = state;
    this.selectWorld(state.chapter);
    this.may.setWeapon(state.weapon || "m92");
    this.cody.setWeapon("m92");
    this.may.armed = this.cody.armed = !!state.weapon;
    this.may.position.fromArray(state.player.position);
    this.may.yaw = state.player.yaw;
    this.cody.position.fromArray(state.cody.position);
    this.cody.yaw = state.cody.yaw;
    for (const data of state.enemies)
      this.spawnEnemy(data.position[0], data.position[2], data);
    this.yaw = state.player.yaw - Math.PI;
    this.pitch = 0.16;
    this.speed =
      this.cooldown =
      this.reloadLeft =
      this.blackoutLeft =
      this.autosave =
        0;
    this.input.aim = false;
    this.input.sprint = false;
    $("aim").classList.remove("selected");
    $("sprint").classList.remove("selected");
    this.world.reset(state.picked);
    this.world.battery.mesh.visible = state.stage === 2;
    this.world.setExit(state.stage >= 4);
    this.dialogue.clear();
    this.setMode("playing");
    this.updateCamera(1);
    this.hud();
  }
  snapshot() {
    stashWeapon(this.state);
    return {
      ...this.state,
      player: {
        ...this.state.player,
        position: this.may.position.toArray(),
        yaw: this.may.yaw,
      },
      cody: { position: this.cody.position.toArray(), yaw: this.cody.yaw },
      enemies: this.enemies
        .filter((e) => e.hp > 0)
        .map((e) => ({
          id: e.id,
          position: e.actor.position.toArray(),
          yaw: e.actor.yaw,
          hp: e.hp,
          ...e.choices,
        })),
      savedAt: Date.now(),
    };
  }
  save(notify = false) {
    if (!this.ready || this.state.player.hp <= 0) return false;
    const result = this.store.write(this.snapshot());
    if (result && notify) this.audio.play("save");
    if (notify) this.toast(result ? "存档已保存" : this.store.error);
    this.autosave = 0;
    return result;
  }
  pause() {
    if (this.mode !== "playing") return;
    this.setMode("paused");
  }
  resume() {
    if (this.mode === "paused") {
      this.setMode("playing");
      if (this.dialogue.active) this.dialogue.draw();
      else if (this.state.prologue?.phase === "offer")
        $("gift-choice").hidden = false;
    }
  }
  spawnEnemy(x, z, saved = null) {
    const choices = saved
      ? Object.freeze({ idle: saved.idle, move: saved.move, pace: saved.pace })
      : pickZombieActions(this.state);
    const actor = new Actor(this.assets.zombie, "zombie", this.scene);
    actor.position.set(x, 0, z);
    actor.yaw = saved?.yaw ?? random(this.state) * Math.PI * 2;
    const enemy = {
      id: saved?.id || "z" + ++this.state.spawnSerial,
      actor,
      hp: saved?.hp ?? 100,
      choices,
      attackTimer: 0.7,
      deadTime: 0,
      mode: "idle",
    };
    actor.play(choices.idle, true);
    this.enemies.push(enemy);
    return enemy;
  }
  live() {
    return this.enemies.filter((e) => e.hp > 0);
  }
  spawnWave(points) {
    for (const [x, z] of points) this.spawnEnemy(x, z);
  }
  toast(text) {
    $("toast").textContent = text;
    $("toast").hidden = false;
    this.toastLeft = 4;
  }
  objectiveTarget() {
    if (this.state.chapter === 0) return null;
    return this.state.stage === 0
      ? new T.Vector3(0, 0, -3.7)
      : this.state.stage === 2
        ? this.world.battery.position
        : this.state.stage === 3
          ? new T.Vector3(2.3, 0, -25.7)
          : this.state.stage === 4
            ? new T.Vector3(0, 0, -29)
            : null;
  }
  interact() {
    if (this.mode !== "playing" || this.dialogue.active) return;
    const target = this.objectiveTarget();
    if (!target || this.may.position.distanceTo(target) > 2.5) return;
    if (this.state.stage === 0) {
      this.audio.play("console");
      this.state.flags.alarm = true;
      this.state.stage = 1;
      this.spawnWave([
        [-5, -13],
        [5, -14],
        [0, -18],
      ]);
      this.save();
      this.dialogue.start(DIALOGUES.alarm);
      this.toast("科迪“打开捷径”时触发了警报");
    } else if (this.state.stage === 2) {
      this.audio.play("pickup");
      this.state.flags.battery = true;
      this.state.flags.blackout = true;
      this.state.stage = 3;
      this.world.battery.mesh.visible = false;
      this.spawnWave([
        [-5, -20],
        [6, -24],
      ]);
      this.save();
      this.dialogue.start(DIALOGUES.blackout, () => {
        this.blackoutLeft = 7;
      });
    } else if (this.state.stage === 3) {
      if (this.live().length) {
        this.toast("先清理附近的丧尸，再连接电源");
        return;
      }
      this.state.flags.battery = false;
      this.state.stage = 4;
      this.audio.play("metal");
      this.world.setExit(true);
      this.save();
      this.dialogue.start(DIALOGUES.exit);
    } else if (this.state.stage === 4) this.finish();
  }
  finish() {
    if (this.mode !== "playing" || this.dialogue.active) return;
    this.dialogue.start(DIALOGUES.ending, () => {
      this.save();
      this.setMode("complete");
      $("ending-kills").textContent =
        `小梅击退了 ${this.state.kills} 个不速之客。科迪坚持说，这一切都在计划之中。`;
    });
  }
  reload() {
    const p = this.state.player;
    if (
      this.mode !== "playing" ||
      this.dialogue.active ||
      this.reloadLeft > 0 ||
      !this.state.weapon ||
      p.ammo >= WEAPONS[this.state.weapon].magazine ||
      this.state.prologue?.phase === "offer"
    )
      return;
    if (p.reserve <= 0) {
      this.toast("备用弹药用完了，找找蓝色补给盒");
      return;
    }
    this.reloadLeft = WEAPONS[this.state.weapon].reload;
    this.audio.play(
      this.state.weapon === "m92" ? "reloadpistol" : "reloadrifle",
      { volume: 0.5 },
    );
  }
  aimRay() {
    const ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2(0, 0), this.camera);
    return ray.ray;
  }
  findHit(ray, maxDistance = 45) {
    let best = null,
      nearest = Math.min(maxDistance, this.world.obstruction(ray, maxDistance));
    const rp = new T.Vector3(),
      sp = new T.Vector3();
    for (const enemy of this.live()) {
      const pos = enemy.actor.position;
      const head = enemy.actor.head
        ? enemy.actor.head
            .getWorldPosition(new T.Vector3())
            .add(new T.Vector3(0, 0.12, 0))
        : pos.clone().add(new T.Vector3(0, 1.58, 0));
      const headPoint = ray.intersectSphere(
        new T.Sphere(head, 0.23),
        new T.Vector3(),
      );
      let point = null,
        headshot = false;
      if (headPoint) {
        point = headPoint;
        headshot = true;
      } else {
        const a = pos.clone().add(new T.Vector3(0, 0.4, 0)),
          b = pos.clone().add(new T.Vector3(0, 1.4, 0));
        if (ray.distanceSqToSegment(a, b, rp, sp) < 0.32 * 0.32)
          point = rp.clone();
      }
      if (point) {
        const distance = point.distanceTo(ray.origin);
        if (distance < nearest) {
          nearest = distance;
          best = { enemy, point, headshot, distance };
        }
      }
    }
    return best;
  }
  fire() {
    const p = this.state.player;
    if (
      this.mode !== "playing" ||
      this.dialogue.active ||
      this.cooldown > 0 ||
      this.reloadLeft > 0 ||
      !this.state.weapon ||
      this.state.prologue?.phase === "offer"
    )
      return;
    if (p.ammo <= 0) {
      this.audio.play("empty", { volume: 0.25 });
      this.cooldown = 0.3;
      this.reload();
      return;
    }
    p.ammo--;
    const weapon = WEAPONS[this.state.weapon];
    this.cooldown = weapon.interval;
    if (this.state.prologue) this.state.prologue.tutorial.fire = true;
    this.audio.play(weapon.sound, { volume: 0.5 });
    this.audio.play("metal", { volume: 0.06 });
    const ray = this.aimRay(),
      hit = this.findHit(ray);
    const endpoint =
      hit?.point || ray.at(this.world.obstruction(ray, 35), new T.Vector3());
    this.world.tracer(this.may.muzzle(), endpoint);
    this.world.pulse(this.may.muzzle(), 0xffda8c);
    if (hit) {
      this.damageEnemy(
        hit.enemy,
        hit.headshot ? weapon.head : weapon.body,
        true,
      );
      this.hitLeft = 0.18;
      $("reticle").classList.add("hit");
      this.world.pulse(hit.point, 0xb5dca3);
    }
    if (!hit)
      this.audio.play(this.world.impactSound(ray, 35), {
        volume: 0.12,
        position: endpoint,
        listener: this.may.position,
      });
    this.cameraKick = 0.018;
    if (p.ammo === 0 && p.reserve > 0) this.reload();
  }
  damageEnemy(enemy, amount, byPlayer = false) {
    if (enemy.hp <= 0) return;
    enemy.hp = Math.max(0, enemy.hp - amount);
    this.audio.play("zombie4", {
      volume: 0.2,
      position: enemy.actor.position,
      listener: this.may.position,
    });
    if (enemy.hp === 0) {
      enemy.deadTime = 0;
      if (this.state.chapter === 0) this.state.prologue.defeated++;
      this.audio.play("zombie6", {
        volume: 0.3,
        position: enemy.actor.position,
        listener: this.may.position,
      });
      enemy.actor.mixer.stopAllAction();
      if (byPlayer) this.state.kills++;
    }
  }
  damagePlayer(amount) {
    if (
      this.mode !== "playing" ||
      this.dialogue.active ||
      this.damageCooldown > 0 ||
      (this.state.chapter === 0 &&
        !Object.values(this.state.prologue.tutorial).every(Boolean))
    )
      return;
    this.state.player.hp = Math.max(0, this.state.player.hp - amount);
    this.damageCooldown = 0.65;
    this.damageFlash = 0.45;
    this.audio.play("hurt", { volume: 0.45 });
    if (this.state.player.hp <= 0) {
      this.dialogue.clear();
      this.setMode("dead");
    }
  }
  updatePlayer(dt) {
    const input = this.input.movement();
    this.yaw -= this.input.lookX * 0.0048;
    this.pitch = T.MathUtils.clamp(
      this.pitch + this.input.lookY * 0.0035,
      -0.16,
      0.6,
    );
    this.input.lookX = this.input.lookY = 0;
    const aiming = this.input.aim || this.input.fire;
    const amount = Math.hypot(input.x, input.y),
      targetSpeed = (aiming ? 1.5 : input.sprint ? 4.5 : 2.7) * amount;
    this.speed = T.MathUtils.damp(this.speed, targetSpeed, 13, dt);
    const forward = new T.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)),
      right = new T.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const direction = forward
      .multiplyScalar(input.y)
      .addScaledVector(right, input.x);
    let moving = false;
    if (direction.lengthSq() > 0.005) {
      direction.normalize();
      moving = this.world.move(
        this.may.position,
        direction.x * this.speed * dt,
        direction.z * this.speed * dt,
      );
      const targetYaw = aiming
        ? this.yaw + Math.PI
        : Math.atan2(direction.x, direction.z);
      this.may.yaw +=
        angleDelta(this.may.yaw, targetYaw) * Math.min(1, dt * 14);
    } else if (aiming) this.may.yaw = this.yaw + Math.PI;
    if (moving) {
      if (this.state.prologue) this.state.prologue.tutorial.move = true;
      this.stepLeft = (this.stepLeft || 0) - dt;
      if (this.stepLeft <= 0) {
        this.audio.play(
          (this.state.chapter === 0 ? "stepwood" : "stepstone") +
            ((this.stepIndex = (this.stepIndex || 0) + 1) % 3),
          { volume: 0.2 },
        );
        this.stepLeft = 0.42 / (this.speed / 2.7 || 1);
      }
    }
    this.may.animate(dt, {
      moving,
      aim: aiming && !!this.state.weapon,
      speed: this.speed,
    });
    this.updateCamera(dt, aiming);
    this.may.updateGun(this.aimRay().at(25, new T.Vector3()));
    if (this.input.fire) this.fire();
    for (const pickup of this.world.pickups) {
      if (
        pickup.mesh.visible &&
        this.may.position.distanceTo(pickup.position) < 1
      ) {
        if (pickup.id.startsWith("ammo"))
          this.state.player.reserve = Math.min(
            240,
            this.state.player.reserve + 36,
          );
        else if (this.state.player.hp < 100)
          this.state.player.hp = Math.min(100, this.state.player.hp + 40);
        else continue;
        pickup.mesh.visible = false;
        this.state.picked.push(pickup.id);
        this.audio.play("pickup");
        this.toast(
          pickup.id.startsWith("ammo") ? "拾取弹药 +36" : "恢复生命 +40",
        );
      }
    }
    if (
      this.state.chapter === 1 &&
      this.state.stage === 4 &&
      this.may.position.distanceTo(new T.Vector3(0, 0, -29)) < 1.8
    )
      this.finish();
  }
  updateCamera(dt, aiming = false) {
    const p = this.may.position;
    const forward = new T.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)),
      right = new T.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const distance = aiming ? 2.4 : 4.2;
    const target = p
      .clone()
      .add(
        new T.Vector3(
          Math.sin(this.yaw) * distance * Math.cos(this.pitch),
          aiming
            ? 1.52 + Math.sin(this.pitch) * 2
            : 2.35 + Math.sin(this.pitch) * 3,
          Math.cos(this.yaw) * distance * Math.cos(this.pitch),
        ),
      );
    if (aiming) target.addScaledVector(right, 0.42);
    const eye = p.clone().add(new T.Vector3(0, 1.45, 0)),
      offset = target.clone().sub(eye),
      len = offset.length();
    const collision = this.world.obstruction(
      new T.Ray(eye, offset.clone().normalize()),
      len,
    );
    if (collision < len)
      target
        .copy(eye)
        .addScaledVector(offset.normalize(), Math.max(0.45, collision - 0.18));
    this.camera.position.lerp(target, 1 - Math.exp(-12 * dt));
    const look = p.clone().add(new T.Vector3(0, 1.15, 0));
    if (aiming) {
      look.addScaledVector(forward, 14);
      look.y += -Math.sin(this.pitch) * 9;
    }
    this.camera.lookAt(look);
    this.camera.fov = T.MathUtils.damp(
      this.camera.fov,
      aiming ? 44 : 52,
      9,
      dt,
    );
    this.camera.updateProjectionMatrix();
  }
  updateCody(dt) {
    let nearest = null,
      distance = Infinity;
    for (const e of this.live()) {
      const d = e.actor.position.distanceTo(this.cody.position);
      if (d < distance) {
        distance = d;
        nearest = e;
      }
    }
    const delta = this.may.position
      .clone()
      .add(new T.Vector3(1.6, 0, 1.5))
      .sub(this.cody.position);
    const d = delta.length();
    let moving = false;
    if (d > 1.25) {
      delta.normalize();
      moving = this.world.move(
        this.cody.position,
        delta.x * Math.min(3.3, d) * dt,
        delta.z * Math.min(3.3, d) * dt,
      );
      if (!moving)
        moving = this.world.move(
          this.cody.position,
          -delta.z * 2 * dt,
          delta.x * 2 * dt,
        );
      this.cody.yaw +=
        angleDelta(this.cody.yaw, Math.atan2(delta.x, delta.z)) *
        Math.min(1, dt * 8);
    }
    const aiming =
      this.cody.armed &&
      nearest &&
      distance < 13 &&
      (this.state.chapter !== 0 ||
        Object.values(this.state.prologue.tutorial).every(Boolean));
    if (aiming) {
      const direction = nearest.actor.position.clone().sub(this.cody.position);
      this.cody.yaw = Math.atan2(direction.x, direction.z);
      this.codyCooldown -= dt;
      if (this.codyCooldown <= 0) {
        this.codyCooldown = 0.85;
        const target = nearest.actor.position
          .clone()
          .add(new T.Vector3(0, 1, 0));
        const ray = new T.Ray(
          this.cody.position.clone().add(new T.Vector3(0, 1, 0)),
          target
            .clone()
            .sub(this.cody.position.clone().add(new T.Vector3(0, 1, 0)))
            .normalize(),
        );
        if (this.world.obstruction(ray, distance + 0.1) >= distance - 0.3) {
          const hit = random(this.state) < CODY_ACCURACY;
          if (!hit) target.x += (random(this.state) < 0.5 ? -1 : 1) * 1.4;
          this.world.tracer(this.cody.muzzle(), target, 0xb2d2c2);
          this.audio.play("pistol", {
            volume: 0.25,
            position: this.cody.position,
            listener: this.may.position,
          });
          if (hit)
            this.damageEnemy(
              nearest,
              WEAPONS[this.cody.weapon].body * CODY_DAMAGE_SCALE,
            );
        }
      }
    }
    this.cody.animate(dt, { moving, aim: !!aiming, speed: 2.5 });
    this.cody.updateGun(
      aiming
        ? nearest.actor.position.clone().add(new T.Vector3(0, 1.1, 0))
        : null,
    );
  }
  updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        e.deadTime += dt;
        e.actor.root.rotation.x = Math.min(Math.PI / 2, e.deadTime * 2.5);
        e.actor.position.y = -Math.max(0, e.deadTime - 0.6) * 0.6;
        if (e.deadTime > 1.6) {
          e.actor.remove();
          this.enemies.splice(i, 1);
        }
        continue;
      }
      const delta = this.may.position.clone().sub(e.actor.position);
      delta.y = 0;
      const d = delta.length();
      const alert = d < (this.state.flags.alarm ? 24 : 9);
      if (alert && d > 1.25) {
        delta.normalize();
        let dx = delta.x,
          dz = delta.z;
        for (const other of this.enemies) {
          if (other === e || other.hp <= 0) continue;
          const diff = e.actor.position.clone().sub(other.actor.position),
            n = diff.length();
          if (n > 0 && n < 0.85) {
            dx += (diff.x / n) * 0.8;
            dz += (diff.z / n) * 0.8;
          }
        }
        const n = Math.hypot(dx, dz) || 1;
        dx /= n;
        dz /= n;
        const moved = this.world.move(
          e.actor.position,
          dx * 1.05 * e.choices.pace * dt,
          dz * 1.05 * e.choices.pace * dt,
          0.35,
        );
        if (!moved) {
          const side = e.id.charCodeAt(e.id.length - 1) % 2 ? 1 : -1;
          this.world.move(
            e.actor.position,
            -dz * 0.85 * dt * side,
            dx * 0.85 * dt * side,
            0.35,
          );
        }
        e.actor.yaw +=
          angleDelta(e.actor.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 5);
        e.actor.play(e.choices.move);
        e.mode = "move";
      } else {
        e.actor.play(e.choices.idle);
        e.mode = "idle";
        if (alert) {
          e.attackTimer -= dt;
          if (e.attackTimer <= 0) {
            e.attackTimer = 1.5;
            this.damagePlayer(13);
            this.audio.play("zombie3", {
              volume: 0.23,
              position: e.actor.position,
              listener: this.may.position,
            });
          }
        }
      }
      e.soundLeft = (e.soundLeft ?? 2 + random(this.state) * 4) - dt;
      if (e.soundLeft <= 0) {
        this.audio.play("zombie" + (i % 3), {
          volume: 0.15,
          position: e.actor.position,
          listener: this.may.position,
        });
        e.soundLeft = 4 + random(this.state) * 5;
      }
      e.actor.mixer.update(dt * e.choices.pace);
      e.actor.correctGround();
      e.actor.updateGun();
    }
    if (
      this.state.chapter === 1 &&
      this.state.stage === 1 &&
      this.live().length === 0
    ) {
      this.state.stage = 2;
      this.world.battery.mesh.visible = true;
      this.save();
      this.dialogue.start(DIALOGUES.cleared);
    }
  }
  update(dt) {
    if (
      this.state.chapter === 0 &&
      !this.dialogue.active &&
      this.prologue.update(dt)
    ) {
      this.hud();
      return;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.damageCooldown = Math.max(0, (this.damageCooldown || 0) - dt);
    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        const n = Math.min(
          WEAPONS[this.state.weapon].magazine - this.state.player.ammo,
          this.state.player.reserve,
        );
        this.state.player.ammo += n;
        this.state.player.reserve -= n;
        if (this.state.prologue) this.state.prologue.tutorial.reload = true;
      }
    }
    if (this.dialogue.active) {
      this.may.animate(dt, { talk: this.dialogue.speaker === "may" });
      this.cody.animate(dt, { talk: this.dialogue.speaker === "cody" });
      this.may.updateGun();
      this.cody.updateGun();
      for (const e of this.live()) {
        e.actor.play(e.choices.idle);
        e.actor.mixer.update(dt * 0.5);
        e.actor.correctGround();
        e.actor.updateGun();
      }
      this.input.clear();
    } else {
      this.updatePlayer(dt);
      this.updateCody(dt);
      this.updateEnemies(dt);
      this.blackoutLeft = Math.max(0, this.blackoutLeft - dt);
      this.autosave += dt;
      if (this.autosave > 15) this.save();
    }
    this.hud();
  }
  hud() {
    const p = this.state.player;
    $("weapon-name").textContent =
      WEAPONS[this.state.weapon]?.name || "尚未装备";
    for (const id of Object.keys(WEAPONS)) {
      const b = $("weapon-" + id);
      b.hidden = !this.state.inventory[id];
      b.classList.toggle("selected", this.state.weapon === id);
    }
    $("health-fill").style.width = p.hp + "%";
    $("health-value").textContent = Math.ceil(p.hp);
    $("ammo-count").textContent = p.ammo;
    $("reserve-count").textContent = "/ " + p.reserve;
    $("reload").textContent = this.reloadLeft > 0 ? "装填中…" : "换弹";
    $("reload").disabled = this.reloadLeft > 0;
    if (this.state.chapter === 0) {
      this.prologue.hud();
      return;
    }
    $("objective-text").textContent = OBJECTIVES[this.state.stage];
    $("objective-detail").textContent =
      this.state.stage === 1 || (this.state.stage === 3 && this.live().length)
        ? `剩余丧尸 ${this.live().length}`
        : this.state.flags.battery
          ? "已携带出口电池"
          : "科迪与你同行";
    const target = this.objectiveTarget();
    const near = target && this.may.position.distanceTo(target) < 2.5;
    $("interact").hidden = !near || this.dialogue.active;
    $("interact").textContent =
      ["启动配电台", "", "拾取电池", "连接出口电源", "离开仓库"][
        this.state.stage
      ] || "互动";
    $("reticle").classList.toggle(
      "target",
      !this.dialogue.active && !!this.findHit(this.aimRay()),
    );
    $("reticle").classList.toggle("aiming", this.input.aim || this.input.fire);
    if (target) {
      const point = target.clone().add(new T.Vector3(0, 1.8, 0));
      point.project(this.camera);
      const visible =
        point.z < 1 && Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.85;
      $("marker").hidden = !visible || this.dialogue.active;
      if (visible) {
        $("marker").style.left = (point.x * 0.5 + 0.5) * innerWidth + "px";
        $("marker").style.top = (-point.y * 0.5 + 0.5) * innerHeight + "px";
        $("marker-distance").textContent =
          Math.round(this.may.position.distanceTo(target)) + " m";
      }
    } else $("marker").hidden = true;
  }
  frame() {
    requestAnimationFrame(() => this.frame());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    document.body.dataset.cinematic = String(
      this.mode === "playing" &&
        this.state.chapter === 0 &&
        ["entrance", "door"].includes(this.state.prologue.phase),
    );
    document.body.dataset.dialogue = String(this.dialogue.active);
    if (this.ready) {
      if (this.mode === "playing") this.update(dt);
      else if (this.mode === "menu") {
        this.may.animate(dt, { talk: false });
        this.cody.animate(dt, { talk: true });
        this.may.updateGun();
        this.cody.updateGun();
        this.may.gun.visible = this.cody.gun.visible = false;
        this.camera.position.set(7, 3.4, 12);
        this.camera.lookAt(0.6, 1.1, 7);
        this.camera.fov = 46;
        this.camera.updateProjectionMatrix();
      }
      this.world.update(dt, this.time, this.blackoutLeft);
    }
    this.toastLeft -= dt;
    if (this.toastLeft <= 0) $("toast").hidden = true;
    this.hitLeft -= dt;
    if (this.hitLeft <= 0) $("reticle").classList.remove("hit");
    this.damageFlash = Math.max(0, this.damageFlash - dt);
    $("damage-overlay").style.opacity = String(this.damageFlash * 1.4);
    this.fpsTime += dt;
    this.fpsCount++;
    if (this.fpsTime > 0.75) {
      $("fps").textContent = Math.round(this.fpsCount / this.fpsTime) + " FPS";
      this.fpsCount = 0;
      this.fpsTime = 0;
    }
    this.renderer.render(this.scene, this.camera);
  }
  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
  get debugState() {
    return {
      ready: this.ready,
      mode: this.mode,
      chapter: this.state.chapter,
      prologue: this.state.prologue,
      weapon: this.state.weapon,
      stage: this.state.stage,
      player: { ...this.state.player, position: this.may?.position.toArray() },
      live: this.live().length,
      enemies: this.enemies.map((e) => ({
        id: e.id,
        hp: e.hp,
        choices: e.choices,
        animation: e.actor.current,
        position: e.actor.position.toArray(),
      })),
      dialogue: this.dialogue.active,
      speaker: this.dialogue.speaker,
      reloading: this.reloadLeft > 0,
    };
  }
}
function angleDelta(a, b) {
  return T.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
}
