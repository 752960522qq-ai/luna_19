export const METRO_TITLE = "第二章 · 十万块的地铁票";
export const DEBT = 100000;
export const CITIZENS = [
  ...Array.from({ length: 11 }, (_, i) => `male${String(i).padStart(2, "0")}`),
  ...Array.from({ length: 6 }, (_, i) => `female${String(i).padStart(2, "0")}`),
];
export const NPC_MODELS = [...CITIZENS, "guard"];
export function newMetro() {
  return {
    remaining: 300,
    cash: 0,
    paid: false,
    intro: false,
    spawned: false,
    complete: false,
    failed: false,
    drops: [],
    looted: [],
  };
}
export function sanitizeMetro(raw) {
  const m = newMetro(),
    n = (v, d, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d);
  m.remaining = n(raw?.remaining, 300, 0, 300);
  m.cash = Math.floor(n(raw?.cash, 0, 0, 1000000));
  for (const k of ["paid", "intro", "spawned", "complete", "failed"])
    m[k] = raw?.[k] === true;
  m.looted = [
    ...new Set(
      (Array.isArray(raw?.looted) ? raw.looted : []).filter(
        (x) => typeof x === "string" && /^metro-\d+$/.test(x),
      ),
    ),
  ].slice(0, 80);
  const seen = new Set(m.looted);
  for (const d of (Array.isArray(raw?.drops) ? raw.drops : []).slice(0, 80)) {
    if (
      !d ||
      !/^metro-\d+$/.test(d.id) ||
      seen.has(d.id) ||
      !Array.isArray(d.position) ||
      d.position.length !== 3 ||
      !d.position.every(Number.isFinite)
    )
      continue;
    seen.add(d.id);
    m.drops.push({
      id: d.id,
      amount: Math.floor(n(d.amount, 1000, 1000, 5000)),
      position: d.position.map((v) => n(v, 0, -50, 50)),
    });
  }
  return m;
}
export function tickMetro(m, dt) {
  if (!m.complete && !m.failed) {
    m.remaining = Math.max(0, m.remaining - Math.max(0, dt));
    if (m.remaining === 0) m.failed = true;
  }
  return m.failed;
}
export function collectCash(m, id) {
  const i = m.drops.findIndex((d) => d.id === id);
  if (i < 0 || m.looted.includes(id)) return 0;
  const [d] = m.drops.splice(i, 1);
  m.looted.push(id);
  m.cash += d.amount;
  return d.amount;
}
export function payDebt(m) {
  if (m.paid || m.cash < DEBT || m.failed || m.complete) return false;
  m.cash -= DEBT;
  m.paid = true;
  return true;
}
export function canBoard(m) {
  return m.paid && m.remaining > 0 && !m.failed && !m.complete;
}
export function dropCash(m, enemy, position) {
  if (m.looted.includes(enemy.id) || m.drops.some((d) => d.id === enemy.id))
    return false;
  m.drops.push({
    id: enemy.id,
    amount: enemy.choices.cash,
    position: [...position],
  });
  return true;
}
export function makeCrowd(random) {
  const list = [];
  for (let i = 0; i < 48; i++) {
    const model =
      i % 8 === 0 ? "guard" : CITIZENS[Math.floor(random() * CITIZENS.length)];
    list.push({
      id: `metro-${i}`,
      model,
      role: model === "guard" ? "guard" : "citizen",
      idle: "Idle",
      move: "Walk",
      pace: 0.85 + random() * 0.25,
      cash: 1000 + Math.floor(random() * 4001),
      hp: 100,
      yaw: random() * Math.PI * 2,
      position: [-16 + (i % 16) * 2.1, 0, 8.1 + Math.floor(i / 16) * 0.95],
    });
  }
  // Always enough finite money to settle the debt, without respawns or farming.
  let need = 120000 - list.reduce((n, e) => n + e.cash, 0);
  for (const e of list) {
    const add = Math.min(5000 - e.cash, Math.max(0, need));
    e.cash += add;
    need -= add;
  }
  return list;
}
