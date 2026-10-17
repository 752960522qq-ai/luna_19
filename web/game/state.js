import { newPrologue, sanitizePrologue } from "./prologue-state.js";
import { WEAPONS, stashWeapon } from "./weapons.js";
export const SAVE_KEY = "double-mice.save.v1";
export const CHAPTER = "第一章 · 好心的捷径";
export const OBJECTIVES = [
  "前往配电台，和科迪一起打开捷径",
  "清理被警报引来的丧尸",
  "到东侧货架取回电池",
  "带电池前往出口配电箱",
  "出口已开启，前往鼠洞离开",
];
const num = (v, d, min, max) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const vec = (v, d = [0, 0, 7]) =>
  Array.isArray(v) && v.length === 3
    ? v.map((x, i) => num(x, d[i], -50, 50))
    : d.slice();
export function freshState(seed = Date.now() >>> 0) {
  return {
    version: 2,
    chapter: 1,
    weapon: "m92",
    inventory: { m92: { ammo: 12, reserve: 72 } },
    prologue: null,
    stage: 0,
    seed,
    spawnSerial: 0,
    player: {
      position: [0, 0, 7],
      yaw: Math.PI,
      hp: 100,
      ammo: 12,
      reserve: 72,
    },
    cody: { position: [2, 0, 8], yaw: Math.PI },
    flags: { alarm: false, blackout: false, battery: false, intro: false },
    kills: 0,
    enemies: [],
    picked: [],
    savedAt: Date.now(),
  };
}
export function sanitizeSave(raw) {
  if (
    !raw ||
    ![1, 2].includes(raw.version) ||
    ![0, 1].includes(raw.chapter) ||
    !raw.player ||
    !raw.cody ||
    !Array.isArray(raw.enemies)
  )
    throw Error("存档格式不兼容");
  const s = freshState();
  s.version = 2;
  s.chapter = raw.chapter;
  s.prologue = raw.chapter === 0 ? sanitizePrologue(raw.prologue) : null;
  s.weapon = WEAPONS[raw.weapon]
    ? raw.weapon
    : raw.chapter === 0
      ? null
      : "m92";
  s.inventory = {};
  for (const id of Object.keys(WEAPONS)) {
    const w = raw.inventory?.[id];
    if (w)
      s.inventory[id] = {
        ammo: num(w.ammo, 0, 0, WEAPONS[id].magazine) | 0,
        reserve: num(w.reserve, 0, 0, 999) | 0,
      };
  }
  if (s.weapon && !s.inventory[s.weapon])
    s.inventory[s.weapon] = { ammo: 0, reserve: 0 };
  s.stage = num(raw.stage, 0, 0, 4) | 0;
  s.seed = num(raw.seed, s.seed, 0, 0xffffffff) >>> 0;
  s.spawnSerial = num(raw.spawnSerial, 0, 0, 100000) | 0;
  s.kills = num(raw.kills, 0, 0, 10000) | 0;
  s.player = {
    position: vec(raw.player.position),
    yaw: num(raw.player.yaw, Math.PI, -1000, 1000),
    hp: num(raw.player.hp, 100, 1, 100),
    ammo: num(raw.player.ammo, 12, 0, WEAPONS[s.weapon]?.magazine || 0) | 0,
    reserve: num(raw.player.reserve, 72, 0, 999) | 0,
  };
  s.cody = {
    position: vec(raw.cody.position, [2, 0, 8]),
    yaw: num(raw.cody.yaw, Math.PI, -1000, 1000),
  };
  for (const f of Object.keys(s.flags)) s.flags[f] = raw.flags?.[f] === true;
  s.enemies = raw.enemies
    .slice(0, 60)
    .filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        e.hp > 0 &&
        ["Idle_Sway", "Idle_Lurch"].includes(e.idle) &&
        ["Walk_Shuffle", "Walk_Heavy"].includes(e.move),
    )
    .map((e) => ({
      id: e.id.slice(0, 50),
      position: vec(e.position),
      yaw: num(e.yaw, 0, -1000, 1000),
      hp: num(e.hp, 100, 1, 100),
      idle: e.idle,
      move: e.move,
      model: e.model === "shirt" ? "shirt" : "flesh",
      pace: num(e.pace, 1, 0.7, 1.3),
    }));
  s.picked = Array.isArray(raw.picked)
    ? raw.picked.filter((x) => ["ammo1", "ammo2", "health1"].includes(x))
    : [];
  stashWeapon(s);
  s.savedAt = num(raw.savedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER);
  return s;
}
export class SaveStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.error = "";
  }
  read() {
    try {
      const text = this.storage.getItem(SAVE_KEY);
      return text ? sanitizeSave(JSON.parse(text)) : null;
    } catch (e) {
      this.error = "存档无法读取，可以开始新游戏";
      return null;
    }
  }
  write(state) {
    try {
      const clean = sanitizeSave({ ...state, savedAt: Date.now() });
      this.storage.setItem(SAVE_KEY, JSON.stringify(clean));
      this.error = "";
      return true;
    } catch (e) {
      this.error = "保存失败，请检查设备存储空间";
      return false;
    }
  }
}
export function random(state) {
  state.seed = (Math.imul(1664525, state.seed) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}
export function pickZombieActions(state) {
  return Object.freeze({
    idle: ["Idle_Sway", "Idle_Lurch"][Math.floor(random(state) * 2)],
    move: ["Walk_Shuffle", "Walk_Heavy"][Math.floor(random(state) * 2)],
    pace: 0.85 + random(state) * 0.25,
    model: random(state) < .5 ? "flesh" : "shirt",
  });
}

export function freshPrologue(seed) {
  const s = freshState(seed);
  s.chapter = 0;
  s.prologue = newPrologue();
  s.weapon = null;
  s.inventory = {};
  s.player = {
    position: [1, 0, -1],
    yaw: Math.PI,
    hp: 100,
    ammo: 0,
    reserve: 0,
  };
  s.cody = { position: [3, 0, 0], yaw: Math.PI };
  return s;
}
