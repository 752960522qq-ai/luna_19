// Keep the companion's body outside the player's body, including after loading
// old saves. Route all corrections through map collision so walls remain solid.
export function separateCompanion(player, companion, move, clearance = 1.05) {
  let dx = companion.x - player.x, dz = companion.z - player.z;
  const distance = Math.hypot(dx, dz);
  if (distance >= clearance) return false;
  if (distance < 1e-6) { dx = 1; dz = 0; }
  const angle = Math.atan2(dz, dx);
  for (const offset of [0, .4, -.4, .8, -.8, 1.6, -1.6, Math.PI]) {
    const x = player.x + Math.cos(angle + offset) * clearance;
    const z = player.z + Math.sin(angle + offset) * clearance;
    const before = companion.clone();
    const stepX = x - companion.x, stepZ = z - companion.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(stepX, stepZ) / .08));
    for (let i = 0; i < steps; i++)
      move(companion, stepX / steps, stepZ / steps);
    if (Math.hypot(companion.x - player.x, companion.z - player.z) >= clearance - .001)
      return true;
    companion.copy(before);
  }
  return false;
}
