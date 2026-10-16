import * as T from "../vendor/three.module.js";
import { World } from "./world.js";
export class CabinWorld extends World {
  make() {
    this.ambient = new T.HemisphereLight(0xf4e3bf, 0x424b3b, 2.1);
    this.scene.add(this.ambient);
    this.sun = new T.DirectionalLight(0xffd6a2, 3.2);
    this.sun.position.set(-4, 12, 6);
    this.scene.add(this.sun);
    this.floor = this.block(0, 0, 14, 0.12, 16, 0x745b40, false);
    this.floor.position.y = -0.06;
    // Interior is a cutaway battle space; real exterior is fitted separately.
    this.block(-7, 0, 0.35, 3.2, 16, 0x624630);
    this.block(7, 0, 0.35, 3.2, 16, 0x624630);
    this.block(0, 8, 14, 3.2, 0.35, 0x624630);
    this.block(-4.2, -8, 5.6, 3.2, 0.35, 0x624630);
    this.block(4.2, -8, 5.6, 3.2, 0.35, 0x624630);
    this.door = this.block(0, -8, 2.8, 2.7, 0.22, 0x9b7547);
    this.doorSolid = this.solids.at(-1);
    // Log seams, windows, door frame, birthday table and gift.
    for (let y = 0.3; y < 3.2; y += 0.36) {
      for (const x of [-7, 7]) {
        const log = this.block(x, 0, 0.4, 0.1, 16, 0x493a2a, false);
        log.position.y = y;
      }
      for (const x of [-4.2, 4.2]) {
        const log = this.block(x, -8, 5.6, 0.1, 0.4, 0x493a2a, false);
        log.position.y = y;
      }
    }
    for (const x of [-6.78, 6.78]) {
      const window = this.block(x, 0, 0.07, 1.1, 2, 0x87b6b7, false);
      window.position.y = 1.8;
      window.userData.surface = "glass";
    }
    this.block(-4.7, 4, 2.2, 0.9, 1.3, 0x916c44);
    this.gift = this.block(-4.7, 4, 0.55, 0.55, 0.55, 0x4d9e95, false);
    this.gift.position.y = 1.2;
    const ribbon = this.block(-4.7, 4, 0.58, 0.08, 0.58, 0xeecb73, false);
    ribbon.position.y = 1.3;
    this.block(5.4, 5, 1.2, 1.9, 2.4, 0x594939);
    this.battery = { mesh: new T.Group(), position: new T.Vector3() };
    this.exit = new T.Group();
    this.exteriorGround = this.block(0, -14, 24, 0.08, 14, 0x43553e, false);
    this.exteriorGround.position.y = -0.08;
    this.scene.visible = false;
  }
  fitExterior(asset) {
    const model = asset.scene.clone(true);
    const box = new T.Box3().setFromObject(model),
      size = box.getSize(new T.Vector3());
    model.scale.multiplyScalar(14 / size.x);
    model.updateMatrixWorld(true);
    const fitted = new T.Box3().setFromObject(model),
      center = fitted.getCenter(new T.Vector3());
    model.position.add(new T.Vector3(-center.x, -fitted.min.y, -center.z));
    // Cut away roof / near walls for third-person visibility, retain the supplied cabin facade outdoors.
    const shell = new T.Group();
    shell.add(model);
    shell.position.z = -22;
    this.scene.add(shell);
    this.exterior = shell;
  }
  move(position, dx, dz, radius = 0.33) {
    const valid = (x, z) =>
      Math.abs(x) < 6.65 - radius &&
      z < 7.65 - radius &&
      z > (this.broken ? -13 : -7.7) + radius &&
      !this.solids.some(
        (b) =>
          x > b.min.x - radius &&
          x < b.max.x + radius &&
          z > b.min.z - radius &&
          z < b.max.z + radius,
      );
    let moved = false;
    if (valid(position.x + dx, position.z + dz)) {
      position.x += dx;
      position.z += dz;
      return true;
    }
    if (valid(position.x + dx, position.z)) {
      position.x += dx;
      moved = true;
    }
    if (valid(position.x, position.z + dz)) {
      position.z += dz;
      moved = true;
    }
    return moved;
  }
  reset() {
    this.broken = false;
    this.door.visible = true;
    this.door.rotation.set(0, 0, 0);
    this.door.position.set(0, 1.35, -8);
    if (!this.solids.includes(this.doorSolid)) this.solids.push(this.doorSolid);
  }
  breakDoor() {
    this.broken = true;
    this.door.visible = false;
    this.solids = this.solids.filter((b) => b !== this.doorSolid);
    for (let i = 0; i < 9; i++)
      this.pulse(
        new T.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, -8),
        0xb78e54,
      );
  }
  setExit() {}
}
