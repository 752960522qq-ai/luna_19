import * as T from "../vendor/three.module.js";
import {
  prologueLines,
  shouldOffer,
  spawnAllowance,
  TOTAL_ZOMBIES,
  PROLOGUE_TITLE,
} from "./prologue-state.js";
import { grantWeapon } from "./weapons.js";
const $ = (id) => document.getElementById(id);
export class Prologue {
  constructor(game) {
    this.g = game;
    this.cinematic = 0;
    this.doorTime = 0;
  }
  get p() {
    return this.g.state.prologue;
  }
  resume() {
    const g = this.g,
      p = this.p;
    g.world.exterior.visible = p.phase === "entrance";
    g.may.armed = g.cody.armed = [
      "combat",
      "offer",
      "ending",
      "complete",
    ].includes(p.phase);
    if (["combat", "offer", "ending", "complete"].includes(p.phase))
      g.world.breakDoor();
    if (p.phase === "entrance") {
      this.cinematic = 3.5;
      g.toast("序章 · 生日礼物");
    } else if (p.phase === "birthday") this.birthday();
    else if (p.phase === "door") this.doorTime = 3;
    else if (p.phase === "pistol") this.pistol();
    else if (p.phase === "offer") this.offer();
    else if (p.phase === "ending") this.end();
    else if (p.phase === "complete") this.complete();
  }
  birthday() {
    this.p.phase = "birthday";
    this.g.save();
    this.g.dialogue.start(prologueLines(1, 2, 3, 4, 5, 6, 7), () => {
      this.p.phase = "door";
      this.doorTime = 3;
      for (const x of [-0.6, 0.6]) {
        this.g.spawnEnemy(x, -9.1);
        this.p.spawned++;
      }
      this.g.save();
    });
  }
  pistol() {
    const g = this.g;
    this.p.phase = "pistol";
    g.world.breakDoor();
    g.audio.play("break", { volume: 0.65 });
    g.dialogue.start(prologueLines(9), () => {
      grantWeapon(g.state, "m92", 60);
      g.may.setWeapon("m92");
      g.may.armed = g.cody.armed = true;
      this.p.phase = "combat";
      g.state.flags.alarm = true;
      g.save();
      g.toast("获得 M92 · 总计 60 发。摇杆 / WASD 移动");
    });
  }
  offer() {
    const g = this.g;
    this.p.phase = "offer";
    this.p.offer = "pending";
    g.dialogue.start(prologueLines(10), () => {
      $("gift-choice").hidden = false;
      g.input.clear();
    });
    g.save();
  }
  choose(accept) {
    if (this.p.phase !== "offer" || this.p.offer !== "pending") return;
    $("gift-choice").hidden = true;
    this.p.offer = accept ? "accepted" : "rejected";
    this.p.phase = "combat";
    if (accept) {
      grantWeapon(this.g.state, "colt723", 300);
      this.g.may.setWeapon("colt723");
      this.g.reloadLeft = 0;
      this.g.audio.play("equip");
      this.g.toast("获得柯尔特 723 · 总计 300 发。按 1 / 2 切换武器");
    }
    this.g.input.clear();
    this.g.save();
  }
  end() {
    this.p.phase = "ending";
    this.g.save();
    this.g.dialogue.start(prologueLines(11, 12), () => this.complete());
  }
  complete() {
    this.p.phase = "complete";
    this.g.save();
    this.g.setMode("prologue-complete");
    $("prologue-kills").textContent =
      `木屋保住了 · 共击退 ${this.p.defeated} / 60 只丧尸`;
  }
  update(dt) {
    const g = this.g,
      p = this.p;
    if (p.phase === "entrance") {
      this.cinematic -= dt;
      const t = 1 - this.cinematic / 3.5;
      if (t < 0.35) {
        g.world.exterior.visible = true;
        g.camera.position.set(15 - t * 5, 9, -8);
        g.camera.lookAt(0, 3, -22);
      } else {
        g.world.exterior.visible = false;
        g.camera.position.set(Math.sin(t * 1.5) * 4, 1.8 + t * 0.8, 6 - t * 3);
        g.camera.lookAt(0, 1.1, 2.5);
      }
      g.may.animate(dt, { moving: t < 0.65, speed: 1.8 });
      g.cody.animate(dt, { moving: t < 0.65, speed: 1.8 });
      g.may.position.z = 3.8 - t * 1.3;
      g.cody.position.z = 4.2 - t * 1.3;
      g.may.updateGun();
      g.cody.updateGun();
      if (this.cinematic <= 0) this.birthday();
      return true;
    }
    if (p.phase === "door" && !g.dialogue.active) {
      this.doorTime -= dt;
      g.camera.position.set(3, 2.3, -11);
      g.camera.lookAt(0, 1.3, -8);
      g.may.animate(dt);
      g.cody.animate(dt);
      for (const e of g.live()) {
        e.actor.animate(dt);
        e.actor.yaw = 0;
      }
      g.world.door.rotation.z = Math.sin(this.doorTime * 29) * 0.025;
      if (Math.floor(this.doorTime * 2) !== this.lastBang) {
        this.lastBang = Math.floor(this.doorTime * 2);
        g.audio.play("door", { volume: 0.65 });
        g.audio.play("zombie0", { volume: 0.35 });
      }
      if (this.doorTime <= 0)
        g.dialogue.start(prologueLines(8), () => this.pistol());
      return true;
    }
    if (p.phase !== "combat") return p.phase === "offer";
    p.elapsed += dt;
    p.spawnLeft -= dt;
    if (p.spawnLeft <= 0 && spawnAllowance(p, g.live().length) > 0) {
      const x = ((g.state.spawnSerial % 3) - 1) * 0.75;
      g.spawnEnemy(x, -9.5 - (g.state.spawnSerial % 3) * 0.65);
      p.spawned++;
      p.spawnLeft = Object.values(p.tutorial).every(Boolean) ? 1.05 : 4;
    }
    if (shouldOffer(p, g.live().length)) {
      this.offer();
      return true;
    }
    if (
      p.spawned === TOTAL_ZOMBIES &&
      p.defeated === TOTAL_ZOMBIES &&
      g.live().length === 0
    ) {
      this.end();
      return true;
    }
    return false;
  }
  hud() {
    const g = this.g,
      p = this.p,
      t = p.tutorial;
    $("objective-text").textContent =
      p.phase === "complete"
        ? "序章结束"
        : p.phase === "combat"
          ? "坚守木屋"
          : PROLOGUE_TITLE;
    $("objective-detail").textContent =
      p.phase === "combat"
        ? !t.move
          ? "教程 1 / 3 · 摇杆 / WASD 移动"
          : !t.fire
            ? "教程 2 / 3 · 瞄准并开火"
            : !t.reload
              ? "教程 3 / 3 · 发射后点击换弹 / R"
              : `已击退 ${p.defeated} / 60 · 在场 ${g.live().length}`
        : "生日惊喜正在发生";
    $("marker").hidden = $("interact").hidden = true;
  }
}
