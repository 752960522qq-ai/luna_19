import * as T from "../vendor/three.module.js";
import { World } from "./world.js";
export class MetroWorld extends World {
  make() {
    this.scene.visible = false;
    this.ambient = new T.HemisphereLight(0xe6ebde, 0x484a47, 2.1);
    this.sun = new T.DirectionalLight(0xffddac, 3.2);
    this.sun.position.set(4, 12, 8);
    this.scene.add(this.ambient, this.sun);
    this.battery = { mesh: new T.Group(), position: new T.Vector3() };
    this.exit = new T.Group();
    this.boarding = new T.Vector3(10, 0, 7.8);
    this.entities = () => [];
    this.cashMeshes = new Map();
  }
  fit(asset, money) {
    this.moneyAsset = money;
    this.station = asset.scene.clone(true);
    this.station.position.y = -0.5;
    this.scene.add(this.station);
    this.station.updateMatrixWorld(true);
    this.physics = [];
    this.wallGrid = new Map();
    this.station.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.side = T.DoubleSide;
      o.material.clippingPlanes = [new T.Plane(new T.Vector3(0, -1, 0), 3.4)];
      this.physics.push(o);
    });
    this.buildWallGrid();
    this.wallSegments = [...new Set([...this.wallGrid.values()].flat())];
    // This uploaded abandoned station has tracks but no carriage. Add a boarding
    // carriage on the existing second track; all architecture remains the upload.
    this.block(8, 6.15, 18, 2.8, 1.8, 0x446d69);
    const door = this.block(10, 7.07, 1.4, 2.25, 0.04, 0xd8cd9b, false);
    door.position.y = 1.15;
    const stripe = this.block(8, 7.09, 17, 0.14, 0.04, 0xd8cd9b, false);
    stripe.position.y = 2.45;
    for (const x of [1, 4, 7, 13, 16]) {
      const window = this.block(x, 7.1, 1.4, 0.85, 0.03, 0x203e46, false);
      window.position.y = 1.9;
    }
    const sign = this.block(10, 7.75, 1.7, 0.025, 0.65, 0x69d3b1, false);
    sign.position.y = 0.025;
  }
  buildWallGrid() {
    const points = [new T.Vector3(), new T.Vector3(), new T.Vector3()];
    const unique = new Set();
    for (const mesh of this.physics) {
      const g = mesh.geometry,
        pos = g.attributes.position,
        index = g.index;
      for (let i = 0; i < (index?.count || pos.count); i += 3) {
        for (let k = 0; k < 3; k++)
          points[k]
            .fromBufferAttribute(pos, index ? index.getX(i + k) : i + k)
            .applyMatrix4(mesh.matrixWorld);
        for (const height of [0.65, 1.4]) {
          const hits = [];
          for (let k = 0; k < 3; k++) {
            const a = points[k],
              b = points[(k + 1) % 3];
            if (
              (a.y <= height && b.y > height) ||
              (b.y <= height && a.y > height)
            )
              hits.push(a.clone().lerp(b, (height - a.y) / (b.y - a.y)));
          }
          if (hits.length !== 2) continue;
          const [a, b] = hits,
            key = [a.x, a.z, b.x, b.z].map((n) => n.toFixed(3)).join(",");
          if (unique.has(key)) continue;
          unique.add(key);
          const segment = [a.x, a.z, b.x, b.z];
          for (
            let x = Math.floor(Math.min(a.x, b.x) - 0.5);
            x <= Math.floor(Math.max(a.x, b.x) + 0.5);
            x++
          )
            for (
              let z = Math.floor(Math.min(a.z, b.z) - 0.5);
              z <= Math.floor(Math.max(a.z, b.z) + 0.5);
              z++
            ) {
              const key = x + "," + z;
              if (!this.wallGrid.has(key)) this.wallGrid.set(key, []);
              this.wallGrid.get(key).push(segment);
            }
        }
      }
    }
  }
  valid(x, z, r = 0.33, ignore = null) {
    if (x < -18 + r || x > 18 - r || z < 7.4 + r || z > 10.95 - r) return false;
    if (
      this.solids.some(
        (b) =>
          x > b.min.x - r &&
          x < b.max.x + r &&
          z > b.min.z - r &&
          z < b.max.z + r,
      )
    )
      return false;
    for (const [ax, az, bx, bz] of this.wallGrid.get(
      Math.floor(x) + "," + Math.floor(z),
    ) || []) {
      const dx = bx - ax,
        dz = bz - az,
        t = T.MathUtils.clamp(
          ((x - ax) * dx + (z - az) * dz) / Math.max(1e-8, dx * dx + dz * dz),
          0,
          1,
        );
      if (Math.hypot(x - ax - t * dx, z - az - t * dz) < r) return false;
    }
    return !this.entities().some(
      (e) =>
        e.hp > 0 &&
        e.position !== ignore &&
        Math.abs(e.position.y) < 1 &&
        Math.abs(x - e.position.x) < r + e.radius &&
        Math.abs(z - e.position.z) < r + e.radius,
    );
  }
  move(position, dx, dz, r = 0.33) {
    let moved = false;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
    for (let i = 0; i < steps; i++) {
      const x = dx / steps,
        z = dz / steps;
      if (this.valid(position.x + x, position.z + z, r, position)) {
        position.x += x;
        position.z += z;
        moved = true;
      } else {
        if (this.valid(position.x + x, position.z, r, position)) {
          position.x += x;
          moved = true;
        }
        if (this.valid(position.x, position.z + z, r, position)) {
          position.z += z;
          moved = true;
        }
      }
    }
    position.y = 0;
    return moved;
  }
  ensureInside(p) {
    if (this.valid(p.x, p.z, 0.33, p)) return;
    let best = null,
      d = Infinity;
    for (let x = -17; x < 18; x += 0.7)
      for (let z = 8; z < 10.8; z += 0.7)
        if (this.valid(x, z, 0.33, p)) {
          const n = (x - p.x) ** 2 + (z - p.z) ** 2;
          if (n < d) {
            best = [x, z];
            d = n;
          }
        }
    if (best) p.set(best[0], 0, best[1]);
  }
  obstruction(ray, max = 60) {
    let distance = super.obstruction(ray, max);
    const { origin: o, direction: d } = ray;
    for (const [ax, az, bx, bz] of this.wallSegments || []) {
      const sx = bx - ax,
        sz = bz - az,
        det = d.x * sz - d.z * sx;
      if (Math.abs(det) < 1e-8) continue;
      const rx = ax - o.x,
        rz = az - o.z,
        t = (rx * sz - rz * sx) / det,
        u = (rx * d.z - rz * d.x) / det,
        y = o.y + t * d.y;
      if (t > 0.15 && t < distance && u >= 0 && u <= 1 && y > 0 && y < 3.4)
        distance = t;
    }
    return distance;
  }
  reset(picked = []) {
    super.reset(picked);
    for (const m of this.cashMeshes.values()) this.scene.remove(m);
    this.cashMeshes.clear();
  }
  syncMoney(drops) {
    for (const [id, m] of this.cashMeshes)
      if (!drops.some((d) => d.id === id)) {
        this.scene.remove(m);
        this.cashMeshes.delete(id);
      }
    for (const d of drops)
      if (!this.cashMeshes.has(d.id)) {
        const m = this.moneyAsset.scene.clone(true),
          b = new T.Box3().setFromObject(m),
          size = b.getSize(new T.Vector3());
        m.scale.multiplyScalar(0.48 / Math.max(size.x, size.y, size.z));
        m.updateMatrixWorld(true);
        const fit = new T.Box3().setFromObject(m),
          center = fit.getCenter(new T.Vector3());
        m.position.set(
          d.position[0] - center.x,
          0.12 - fit.min.y,
          d.position[2] - center.z,
        );
        this.cashMeshes.set(d.id, m);
        this.scene.add(m);
      }
  }
}
