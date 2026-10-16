import * as T from "../vendor/three.module.js";
const v = new T.Vector3();
export class World {
  constructor(scene) {
    this.host = scene;
    this.scene = new T.Group();
    scene.add(this.scene);
    this.solids = [];
    this.effects = [];
    this.pickups = [];
    this.make();
  }
  block(x, z, w, h, d, color = 0x677876, solid = true) {
    const m = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color, roughness: 0.82 }),
    );
    m.position.set(x, h / 2, z);
    this.scene.add(m);
    if (solid) {
      const box = new T.Box3(
        new T.Vector3(x - w / 2, 0, z - d / 2),
        new T.Vector3(x + w / 2, h, z + d / 2),
      );
      box.surface = [0x8b8063, 0x624630, 0x916c44, 0x594939, 0x9b7547].includes(
        color,
      )
        ? "wood"
        : "metal";
      this.solids.push(box);
    }
    return m;
  }
  make() {
    const s = this.scene;
    this.host.background = new T.Color(0x223338);
    this.host.fog = new T.Fog(0x223338, 30, 85);
    this.ambient = new T.HemisphereLight(0xd6ebe0, 0x435244, 2.1);
    s.add(this.ambient);
    this.sun = new T.DirectionalLight(0xffd9a0, 3.2);
    this.sun.position.set(-8, 16, 4);
    s.add(this.sun);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const c = canvas.getContext("2d");
    c.fillStyle = "#5a6961";
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = "#626f67";
    c.fillRect(0, 0, 64, 64);
    c.fillRect(64, 64, 64, 64);
    c.strokeStyle = "#a0a68e20";
    c.strokeRect(1, 1, 126, 126);
    const texture = new T.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(16, 18);
    texture.colorSpace = T.SRGBColorSpace;
    const floor = new T.Mesh(
      new T.PlaneGeometry(44, 52),
      new T.MeshStandardMaterial({ map: texture, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -8;
    s.add(floor);
    this.block(0, -34, 44, 7, 1, 0x38474a);
    this.block(-22, -8, 1, 7, 52, 0x39474b);
    this.block(22, -8, 1, 7, 52, 0x39474b);
    this.block(0, 18, 44, 7, 1, 0x39474b);
    // Oversized shelves and food tins establish the miniature warehouse setting.
    for (const x of [-19, 19]) {
      for (let i = 0; i < 3; i++) {
        const z = -3 - i * 10;
        this.block(x, z, 4, 3, 6, 0x303f43);
        for (let y = 1; y <= 3; y++)
          this.block(x, z, 4.5, 0.12, 6.5, 0x99a286, false).position.y = y;
        for (let j = 0; j < 3; j++) {
          const tin = new T.Mesh(
            new T.CylinderGeometry(0.8, 0.8, 1.5, 10),
            new T.MeshStandardMaterial({
              color: [0xd9b358, 0x648c89, 0x9c6658][j],
              roughness: 0.75,
            }),
          );
          tin.position.set(x + (j - 1) * 1.05, 3.9, z);
          s.add(tin);
        }
      }
    }
    for (const a of [
      [-8, 1, 3, 1.2, 2],
      [8, 2, 3, 1.2, 2],
      [-11, -10, 3, 2, 3],
      [11, -11, 3, 2, 3],
      [-7, -20, 3, 1.5, 2],
      [7, -22, 2, 2, 2],
    ])
      this.block(...a, 0x8b8063);
    // Yellow floor guides and a striped exit frame.
    for (let i = 0; i < 13; i++) {
      const strip = this.block(
        0,
        6 - i * 2.7,
        0.12,
        0.012,
        1.2,
        0xcbd988,
        false,
      );
      strip.position.y = 0.013;
    }
    this.console = this.block(0, -5, 1.4, 1.2, 0.8, 0x49746b);
    this.consoleTop = this.block(0, -5, 1.5, 0.08, 0.9, 0xc9dc99, false);
    this.consoleTop.position.y = 1.23;
    this.exitPanel = this.block(2.3, -27, 1.1, 1.3, 0.7, 0x49746b);
    this.exit = this.block(0, -30, 4, 3, 0.4, 0x1d2c2e, false);
    this.exit.material.emissive = new T.Color(0x101b17);
    this.exitFrame = this.block(0, -30.3, 4.8, 3.5, 0.3, 0xd6d599, false);
    this.exitFrame.position.z = -30.4;
    const hole = new T.Mesh(
      new T.CircleGeometry(1.8, 36),
      new T.MeshBasicMaterial({ color: 0x080f13 }),
    );
    hole.position.set(0, 1.1, -30.65);
    s.add(hole);
    this.exit.position.z = -30;
    this.battery = this.makePickup("battery", 10, -17, "电池", 0xd7eb82);
    this.battery.mesh.visible = false;
    this.pickups.push(
      this.makePickup("ammo1", -5, 5, "弹药", 0x9acfd1),
      this.makePickup("ammo2", 9, -21, "弹药", 0x9acfd1),
      this.makePickup("health1", -9, -16, "医疗", 0xea9581),
    );
    for (let i = 0; i < 4; i++) {
      const x = i % 2 ? 13 : -13,
        z = -3 - Math.floor(i / 2) * 19;
      const lamp = new T.Mesh(
        new T.CylinderGeometry(0.5, 0.7, 0.2, 12),
        new T.MeshBasicMaterial({ color: 0xe7edbb }),
      );
      lamp.position.set(x, 5, z);
      s.add(lamp);
      const pole = this.block(x, z, 0.14, 5, 0.14, 0x475553, false);
    }
    const light = new T.PointLight(0xa8ddb8, 7, 12, 1);
    light.position.set(0, 3, -29);
    s.add(light);
    const ring = new T.Mesh(
      new T.RingGeometry(1.5, 1.55, 64),
      new T.MeshBasicMaterial({ color: 0xc8d18c, side: T.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.016, 7);
    s.add(ring);
  }
  makePickup(id, x, z, label, color) {
    const g = new T.Group();
    g.position.set(x, 0.55, z);
    const box = new T.Mesh(
      new T.BoxGeometry(0.5, 0.6, 0.3),
      new T.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.15,
        metalness: 0.2,
        roughness: 0.45,
      }),
    );
    g.add(box);
    const ring = new T.Mesh(
      new T.TorusGeometry(0.65, 0.025, 5, 32),
      new T.MeshBasicMaterial({ color }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.5;
    g.add(ring);
    this.scene.add(g);
    return { id, position: new T.Vector3(x, 0, z), mesh: g, label };
  }
  move(position, dx, dz, radius = 0.33) {
    const valid = (x, z) =>
      Math.abs(x) < 20.7 &&
      z > -32.5 &&
      z < 16.7 &&
      !this.solids.some(
        (b) =>
          x > b.min.x - radius &&
          x < b.max.x + radius &&
          z > b.min.z - radius &&
          z < b.max.z + radius,
      );
    const nx = position.x + dx,
      nz = position.z + dz;
    if (valid(nx, nz)) {
      position.x = nx;
      position.z = nz;
      return true;
    }
    let moved = false;
    if (valid(nx, position.z)) {
      position.x = nx;
      moved = true;
    }
    if (valid(position.x, nz)) {
      position.z = nz;
      moved = true;
    }
    return moved;
  }
  obstruction(ray, max = 60) {
    let nearest = max;
    for (const b of this.solids) {
      const hit = ray.intersectBox(b, v);
      if (hit) {
        const d = hit.distanceTo(ray.origin);
        if (d > 0.2) nearest = Math.min(nearest, d);
      }
    }
    return nearest;
  }
  impactSound(ray, max = 35) {
    let key = "wood",
      nearest = max;
    for (const b of this.solids) {
      const hit = ray.intersectBox(b, new T.Vector3());
      if (hit) {
        const d = hit.distanceTo(ray.origin);
        if (d < nearest) {
          nearest = d;
          key = b.surface || "wood";
        }
      }
    }
    return key;
  }
  reset(picked = []) {
    for (const p of this.pickups) p.mesh.visible = !picked.includes(p.id);
    this.battery.mesh.visible = false;
    this.exit.visible = true;
    this.ambient.intensity = 2.1;
    this.sun.intensity = 3.2;
  }
  setExit(open) {
    this.exit.visible = !open;
  }
  tracer(start, end, color = 0xf4ebaf) {
    const geo = new T.BufferGeometry().setFromPoints([start, end]);
    const line = new T.Line(
      geo,
      new T.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    this.scene.add(line);
    this.effects.push({ mesh: line, time: 0.09, duration: 0.09 });
  }
  pulse(position, color = 0xecce84) {
    const m = new T.Mesh(
      new T.SphereGeometry(0.12, 7, 5),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    m.position.copy(position);
    this.scene.add(m);
    this.effects.push({ mesh: m, time: 0.18, duration: 0.18 });
  }
  update(dt, time, blackout = 0) {
    this.ambient.intensity = T.MathUtils.damp(
      this.ambient.intensity,
      blackout > 0 ? 0.45 : 2.1,
      6,
      dt,
    );
    this.sun.intensity = T.MathUtils.damp(
      this.sun.intensity,
      blackout > 0 ? 0.65 : 3.2,
      6,
      dt,
    );
    for (const p of [...this.pickups, this.battery]) {
      p.mesh.rotation.y += dt * 0.65;
      p.mesh.position.y = 0.55 + Math.sin(time * 2 + p.position.x) * 0.08;
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.time -= dt;
      e.mesh.material.opacity = Math.max(0, e.time / e.duration);
      if (e.time <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
  }
}
