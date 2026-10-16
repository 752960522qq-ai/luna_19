export const PROLOGUE_TITLE = "序章 · 生日礼物";
export const TOTAL_ZOMBIES = 60;
export const CODY_LINES = [
  "嘿，小梅，今天怎么样",
  "今天是什么日子来着",
  "对哦，今天是你的生日",
  "我给你准备了礼物",
  "祝你生日快乐，祝你生日快乐",
  "你失望了吗，对了，生日礼物我给你放到海口了",
  "别不信，我们现在就回海口",
  "敌人来了！",
  "拿好手枪",
  "快顶不住了，这样吧，我给你送个礼物，但你得给我回礼",
  "小梅怎么可以这么厉害啊",
  "趁你的生日还没过，我们赶紧回海口吧",
];
export const prologueLines = (...numbers) =>
  numbers.map((n) => [
    "cody",
    CODY_LINES[n - 1],
    `cody-${String(n).padStart(2, "0")}`,
  ]);
export function newPrologue() {
  return {
    phase: "entrance",
    spawned: 0,
    defeated: 0,
    offer: "unseen",
    elapsed: 0,
    spawnLeft: 0,
    tutorial: { move: false, fire: false, reload: false },
  };
}
export function sanitizePrologue(raw = {}) {
  const p = newPrologue();
  if (
    [
      "entrance",
      "birthday",
      "door",
      "pistol",
      "combat",
      "offer",
      "ending",
      "complete",
    ].includes(raw.phase)
  )
    p.phase = raw.phase;
  for (const key of ["spawned", "defeated"])
    p[key] = Math.min(60, Math.max(0, Math.floor(Number(raw[key]) || 0)));
  p.defeated = Math.min(p.spawned, p.defeated);
  if (["unseen", "pending", "accepted", "rejected"].includes(raw.offer))
    p.offer = raw.offer;
  p.elapsed = Math.max(0, Math.min(100000, Number(raw.elapsed) || 0));
  p.spawnLeft = Math.max(0, Math.min(4, Number(raw.spawnLeft) || 0));
  for (const k of Object.keys(p.tutorial))
    p.tutorial[k] = raw.tutorial?.[k] === true;
  return p;
}
export function shouldOffer(p, live) {
  return p.phase === "combat" && p.offer === "unseen" && live >= 10;
}
export function spawnAllowance(p, live) {
  if (p.phase !== "combat" || p.spawned >= 60) return 0;
  const tutorial = Object.values(p.tutorial).every(Boolean);
  const cap = tutorial ? Math.min(16, 4 + Math.floor(p.elapsed / 5)) : 2;
  return Math.max(0, Math.min(cap - live, 60 - p.spawned));
}
