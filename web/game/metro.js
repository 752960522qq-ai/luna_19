import * as T from "../vendor/three.module.js";
import {
  newMetro,
  makeCrowd,
  tickMetro,
  dropCash,
  collectCash,
  payDebt,
  canBoard,
  DEBT,
  METRO_TITLE,
} from "./metro-state.js";
import { freshState, random } from "./state.js";
const $ = (id) => document.getElementById(id);
export const METRO_LINES = [
  "航班延误啦，我们得坐地铁去火车站",
  "然后从柳州坐动车去南宁，再从南宁飞回海口",
  "不过今天地铁站人好多，我们可不想挤地铁",
  "忘了说了，上次借了你一把枪，你得还我钱",
  "我要的不多，给十万就行。这些丧尸身上应该有钱，你知道该怎么办",
  "上地铁前不还我钱，你就完了",
];
export class Metro {
  constructor(game) {
    this.g = game;
  }
  start(old) {
    const s = freshState();
    s.version = 3;
    s.chapter = 2;
    s.metro = newMetro();
    s.inventory = structuredClone(old.inventory);
    s.weapon = old.weapon || "m92";
    s.kills = old.kills;
    // Finite platform-entry ammunition, granted only when entering a new chapter.
    s.inventory.m92 ||= { ammo: 15, reserve: 0 };
    s.inventory.m92.reserve = Math.min(999, s.inventory.m92.reserve + 150);
    if (s.inventory.colt723)
      s.inventory.colt723.reserve = Math.min(
        999,
        s.inventory.colt723.reserve + 300,
      );
    s.player = {
      ...s.player,
      position: [-15, 0, 10],
      yaw: Math.PI,
      ammo: s.inventory[s.weapon].ammo,
      reserve: s.inventory[s.weapon].reserve,
    };
    s.cody.position = [-13.8, 0, 10];
    this.g.start(s);
    this.resume();
  }
  resume() {
    const g = this.g,
      m = g.state.metro;
    if (!m.spawned) {
      for (const data of makeCrowd(() => random(g.state)))
        g.spawnEnemy(data.position[0], data.position[2], data);
      m.spawned = true;
    }
    g.metroWorld.syncMoney(m.drops);
    if (m.complete) {
      this.complete();
      return;
    }
    if (m.failed) {
      this.fail();
      return;
    }
    if (!m.intro)
      g.dialogue.start(
        METRO_LINES.map((t, i) => ["cody", t, `metro_${i + 1}`]),
        () => {
          m.intro = true;
          g.save();
        },
      );
    g.save();
  }
  drop(enemy) {
    const g = this.g;
    if (dropCash(g.state.metro, enemy, enemy.actor.position.toArray()))
      g.metroWorld.syncMoney(g.state.metro.drops);
  }
  update(dt, elapsed = dt) {
    const g = this.g,
      m = g.state.metro;
    if (tickMetro(m, elapsed)) {
      this.fail();
      return;
    }
    for (const d of [...m.drops])
      if (g.may.position.distanceTo(new T.Vector3(...d.position)) < 1) {
        const n = collectCash(m, d.id);
        g.audio.play("pickup");
        g.toast(
          `拾取 ¥${n.toLocaleString()} · 现有 ¥${m.cash.toLocaleString()}`,
        );
      }
    g.metroWorld.syncMoney(m.drops);
    this.crowd(dt);
  }
  crowd(dt) {
    const g = this.g;
    for (let i = g.enemies.length - 1; i >= 0; i--) {
      const e = g.enemies[i],
        a = e.actor;
      if (e.hp <= 0) {
        e.deadTime += dt;
        a.root.rotation.x = Math.min(Math.PI / 2, e.deadTime * 2.5);
        if (e.deadTime > 1.6) {
          a.remove();
          g.enemies.splice(i, 1);
        }
        continue;
      }
      const guard = e.choices.role === "guard",
        distance = a.position.distanceTo(g.may.position);
      e.wanderLeft = (e.wanderLeft || 0) - dt;
      e.panic = Math.max(0, (e.panic || 0) - dt);
      if (e.wanderLeft <= 0 || !e.target) {
        e.wanderLeft = 2 + random(g.state) * 3;
        e.target = new T.Vector3(
          -16 + random(g.state) * 32,
          0,
          8 + random(g.state) * 2.5,
        );
      }
      if (!guard && distance < 4 && (g.input.fire || g.cooldown > 0.01))
        e.panic = 3;
      let target = e.target;
      if (guard && distance < 14 && distance > 5) target = g.may.position;
      const delta = target.clone().sub(a.position).setY(0),
        d = delta.length();
      const speed = e.panic > 0 ? 3.1 : guard ? 1.25 : 0.8;
      let moving = false;
      if (d > 0.6) {
        delta.normalize();
        moving = g.world.move(
          a.position,
          delta.x * speed * dt,
          delta.z * speed * dt,
          0.3,
        );
        if (!moving) e.wanderLeft = 0;
        else a.yaw = Math.atan2(delta.x, delta.z);
      }
      if (guard) {
        const aim = distance < 14;
        if (aim) {
          const dir = g.may.position.clone().sub(a.position);
          a.yaw = Math.atan2(dir.x, dir.z);
          e.attackTimer -= dt;
          if (e.attackTimer <= 0) {
            e.attackTimer = 1.9 + random(g.state) * 0.6;
            const from = a.position.clone().add(new T.Vector3(0, 1.3, 0)),
              end = g.may.position.clone().add(new T.Vector3(0, 1.1, 0));
            if (
              g.world.obstruction(
                new T.Ray(from, end.clone().sub(from).normalize()),
                distance,
              ) >=
              distance - 0.4
            ) {
              const hit = random(g.state) < 0.25;
              if (!hit) end.x += 1;
              g.world.tracer(a.muzzle(), end, 0xff8973);
              g.audio.play("pistol", {
                volume: 0.18,
                position: a.position,
                listener: g.may.position,
              });
              if (hit) g.damagePlayer(8);
            }
          }
        }
        a.animate(dt, { moving, aim, speed });
        a.updateGun(g.may.position.clone().add(new T.Vector3(0, 1.1, 0)));
      } else {
        a.play(e.panic > 0 ? "Run" : moving ? e.choices.move : e.choices.idle);
        a.mixer.update(dt * e.choices.pace);
        a.correctGround();
        a.updateGun();
      }
      e.mode = guard
        ? "guard"
        : e.panic > 0
          ? "panic"
          : moving
            ? "wander"
            : "idle";
    }
  }
  interact() {
    const g = this.g,
      m = g.state.metro;
    if (g.may.position.distanceTo(g.world.boarding) < 2.2) {
      if (!canBoard(m)) {
        g.toast(m.paid ? "列车已停止检票" : "先向科迪还清 ¥100,000");
        return;
      }
      m.complete = true;
      g.save();
      this.complete();
      return;
    }
    if (g.may.position.distanceTo(g.cody.position) < 2.8) {
      if (payDebt(m)) {
        g.audio.play("pickup");
        g.toast("已偿还 ¥100,000，快去绿色标记处上车！");
        g.save();
      } else
        g.toast(
          m.paid
            ? "账已还清，快去登车！"
            : `还差 ¥${Math.max(0, DEBT - m.cash).toLocaleString()}，靠近地上的钱自动拾取`,
        );
    }
  }
  fail() {
    const g = this.g;
    g.state.metro.failed = true;
    g.dialogue.clear();
    g.save();
    g.setMode("metro-failed");
  }
  complete() {
    this.g.setMode("metro-complete");
  }
  hud() {
    const g = this.g,
      m = g.state.metro,
      n = Math.ceil(m.remaining);
    $("objective-text").textContent = "任务：在倒计时结束前挤上地铁";
    $("objective-detail").textContent =
      `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")} · 现金 ¥${m.cash.toLocaleString()} · ${m.paid ? "已还款" : "欠款 ¥100,000"} · ${METRO_TITLE}`;
    const atDoor = g.may.position.distanceTo(g.world.boarding) < 2.2,
      atCody = g.may.position.distanceTo(g.cody.position) < 2.8;
    $("interact").hidden = g.dialogue.active || (!atDoor && !atCody);
    $("interact").textContent = atDoor
      ? "挤上地铁"
      : m.paid
        ? "与科迪交谈"
        : "偿还十万元";
    $("reticle").classList.toggle(
      "target",
      !g.dialogue.active && !!g.findHit(g.aimRay()),
    );
    $("reticle").classList.toggle("aiming", g.input.aim || g.input.fire);
    const target = (m.paid || atDoor ? g.world.boarding : g.cody.position)
      .clone()
      .add(new T.Vector3(0, 2, 0))
      .project(g.camera);
    $("marker").hidden =
      g.dialogue.active ||
      target.z > 1 ||
      Math.abs(target.x) > 0.95 ||
      Math.abs(target.y) > 0.85;
    $("marker").style.left = (target.x * 0.5 + 0.5) * innerWidth + "px";
    $("marker").style.top = (-target.y * 0.5 + 0.5) * innerHeight + "px";
    $("marker-distance").textContent = m.paid ? "上车" : "科迪 / 还款";
  }
}
