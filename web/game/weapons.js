export const WEAPONS = Object.freeze({
  m92: Object.freeze({
    name: "M92 手枪",
    magazine: 15,
    body: 24,
    head: 48,
    interval: 0.3,
    reload: 1.65,
    length: 0.23,
    sound: "pistol",
  }),
  colt723: Object.freeze({
    name: "柯尔特 723",
    magazine: 30,
    body: 42,
    head: 84,
    interval: 0.105,
    reload: 2.05,
    length: 0.86,
    sound: "rifle",
  }),
});
export const CODY_ACCURACY = 0.35;
export const CODY_DAMAGE_SCALE = 0.7;
export function grantWeapon(state, id, total) {
  state.inventory ||= {};
  if (!state.inventory[id]) {
    const ammo = Math.min(total, WEAPONS[id].magazine);
    state.inventory[id] = { ammo, reserve: total - ammo };
  }
  equipWeapon(state, id);
}
export function stashWeapon(state) {
  if (state.weapon && state.inventory?.[state.weapon])
    Object.assign(state.inventory[state.weapon], {
      ammo: state.player.ammo,
      reserve: state.player.reserve,
    });
}
export function equipWeapon(state, id) {
  if (!state.inventory?.[id]) return false;
  stashWeapon(state);
  state.weapon = id;
  Object.assign(state.player, state.inventory[id]);
  return true;
}
