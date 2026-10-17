import * as T from "../vendor/three.module.js";
import { World } from "./world.js";
const UP = new T.Vector3(0, 1, 0);
// The supplied model's ground-floor front door is fitted to the prologue's
// existing doorway. Both establishing shot and gameplay use this one building.
export class CabinWorld extends World {
  make() {
    this.ambient = new T.HemisphereLight(0xf4e3bf, 0x424b3b, 2.1);
    this.sun = new T.DirectionalLight(0xffd6a2, 3.2);
    this.sun.position.set(-4, 12, 6);
    this.scene.add(this.ambient, this.sun);
    this.block(4.2, .3, 1.7, .8, .9, 0x916c44);
    this.gift = this.block(4.2, .3, .5, .5, .5, 0x4d9e95, false);
    this.gift.position.y = 1.05;
    const ribbon = this.block(4.2, .3, .53, .07, .53, 0xeecb73, false);
    ribbon.position.y = 1.18;
    this.battery = { mesh: new T.Group(), position: new T.Vector3() };
    this.exit = new T.Group();
    this.scene.visible = false;
    this.physics = [];
    this.wallGrid = new Map();
    this.floorHeights = new Map();
    this.raycaster = new T.Raycaster();
  }
  fitExterior(asset) {
    const model = asset.scene.clone(true);
    const bounds = new T.Box3().setFromObject(model, true);
    model.scale.multiplyScalar(18 / bounds.getSize(new T.Vector3()).x);
    model.rotation.y = Math.PI;
    model.updateMatrixWorld(true);
    const fit = new T.Box3().setFromObject(model, true);
    const center = fit.getCenter(new T.Vector3());
    model.position.add(new T.Vector3(-center.x - 1.63, -fit.min.y - .87, -center.z - 3.40));
    this.scene.add(model);
    model.updateMatrixWorld(true);
    this.exterior = model;
    this.door = new T.Group();
    this.scene.add(this.door);
    const doorBox = new T.Box3(new T.Vector3(-.95, -.12, -8.45), new T.Vector3(.95, 2.75, -7.7));
    const cut = new T.Plane(new T.Vector3(0, -1, 0), 3.1);
    const surfaces = [];
    model.traverse(o => { if (o.isMesh) surfaces.push(o); });
    for (const mesh of surfaces) {
      mesh.material = mesh.material.clone();
      mesh.material.side = T.DoubleSide;
      mesh.material.clippingPlanes = [cut];
      mesh.userData.surface = /glass|windows/.test(mesh.material.name) ? "glass" : "wood";
      // Material groups contain several doors. Extract only this ground-floor
      // entrance, retaining its original triangles, texture UVs and metalwork.
      if (/door_wood|door_metal/.test(mesh.material.name)) {
        const geometry = mesh.geometry, indices = geometry.index;
        const inside = [], outside = [], p = new T.Vector3(), centroid = new T.Vector3();
        for (let i = 0; i < (indices?.count || geometry.attributes.position.count); i += 3) {
          const tri = [0,1,2].map(k => indices ? indices.getX(i+k) : i+k);
          centroid.set(0,0,0);
          for (const v of tri) centroid.add(p.fromBufferAttribute(geometry.attributes.position, v).applyMatrix4(mesh.matrixWorld));
          (doorBox.containsPoint(centroid.multiplyScalar(1/3)) ? inside : outside).push(...tri);
        }
        if (inside.length) {
          const piece = new T.Mesh(geometry.clone(), mesh.material);
          piece.geometry.setIndex(inside);
          piece.matrixAutoUpdate = false;
          piece.matrix.copy(mesh.matrixWorld);
          piece.userData.surface = "wood";
          this.door.add(piece);
          mesh.geometry = geometry.clone();
          mesh.geometry.setIndex(outside);
        }
      }
      this.physics.push(mesh);
    }
    this.doorSolid = new T.Box3(new T.Vector3(-.9, 0, -8.35), new T.Vector3(.9, 2.65, -7.75));
    this.doorSolid.surface = "wood";
    this.buildWallGrid();
    this.setCutaway(true);
    this.reset();
  }
  setCutaway(enabled) {
    if(this.cutaway === enabled)return;
    this.cutaway = enabled;
    for (const mesh of this.physics || []) mesh.material.clippingPlanes = enabled ? [new T.Plane(new T.Vector3(0,-1,0),3.1)] : [];
    this.door?.traverse(o => { if (o.isMesh) o.material.clippingPlanes = enabled ? [new T.Plane(new T.Vector3(0,-1,0),3.1)] : []; });
  }
  buildWallGrid() {
    const points = [new T.Vector3(),new T.Vector3(),new T.Vector3()];
    const unique = new Set();
    for (const mesh of this.physics) {
      const g = mesh.geometry, pos = g.attributes.position, index = g.index;
      for (let i=0;i<(index?.count||pos.count);i+=3) {
        for (let k=0;k<3;k++) points[k].fromBufferAttribute(pos,index?index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld);
        for (const height of [.65,1.4]) {
          const hits=[];
          for(let k=0;k<3;k++) {
            const a=points[k],b=points[(k+1)%3];
            if ((a.y<=height&&b.y>height)||(b.y<=height&&a.y>height)) hits.push(a.clone().lerp(b,(height-a.y)/(b.y-a.y)));
          }
          if(hits.length!==2)continue;
          const [a,b]=hits, key=[a.x,a.z,b.x,b.z].map(n=>n.toFixed(3)).join(',');
          if(unique.has(key))continue;unique.add(key);
          const segment=[a.x,a.z,b.x,b.z];
          for(let x=Math.floor(Math.min(a.x,b.x)-.5);x<=Math.floor(Math.max(a.x,b.x)+.5);x++)
            for(let z=Math.floor(Math.min(a.z,b.z)-.5);z<=Math.floor(Math.max(a.z,b.z)+.5);z++) {
              const key=x+','+z;
              if(!this.wallGrid.has(key))this.wallGrid.set(key,[]);
              this.wallGrid.get(key).push(segment);
            }
        }
      }
    }
  }
  valid(x,z,radius=.33) {
    if(x < -9.5+radius || x > 6.05-radius || z > 2.2-radius || z < (this.broken?-12.5:-7.7)+radius)return false;
    if(this.solids.some(b=>x>b.min.x-radius&&x<b.max.x+radius&&z>b.min.z-radius&&z<b.max.z+radius))return false;
    for(const [ax,az,bx,bz] of this.wallGrid.get(Math.floor(x)+','+Math.floor(z))||[]) {
      const dx=bx-ax,dz=bz-az,t=T.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/Math.max(1e-8,dx*dx+dz*dz),0,1);
      if(Math.hypot(x-ax-t*dx,z-az-t*dz)<radius)return false;
    }
    return true;
  }
  move(position,dx,dz,radius=.33) {
    let moved=false;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
    for(let i=0;i<steps;i++) {
      const x=dx/steps,z=dz/steps;
      if(this.valid(position.x+x,position.z+z,radius)){position.x+=x;position.z+=z;moved=true;}
      else {
        if(this.valid(position.x+x,position.z,radius)){position.x+=x;moved=true;}
        if(this.valid(position.x,position.z+z,radius)){position.z+=z;moved=true;}
      }
    }
    if(moved)position.y=this.heightAt(position.x,position.z);
    return moved;
  }
  heightAt(x,z) {
    const key = Math.floor(x/.15)+","+Math.floor(z/.15);
    if(this.floorHeights.has(key))return this.floorHeights.get(key);
    this.raycaster.set(new T.Vector3(x,.25,z),UP.clone().negate());
    this.raycaster.far=1.6;
    const hit=this.raycaster.intersectObjects(this.physics,false).find(h=>
      h.face && Math.abs(h.face.normal.clone().transformDirection(h.object.matrixWorld).y)>.5);
    const height = hit ? hit.point.y : 0;
    this.floorHeights.set(key,height);
    return height;
  }
  ensureInside(position) {
    if(this.valid(position.x,position.z)){position.y=this.heightAt(position.x,position.z);return;}
    // Legacy saves used a larger, unrelated box room. Move invalid positions
    // to the nearest free cell in this actual ground floor.
    let best=null,distance=Infinity;
    for(let x=-8.8;x<5.6;x+=.3)for(let z=-7.2;z<1.7;z+=.3)if(this.valid(x,z)) {
      const d=(x-position.x)**2+(z-position.z)**2;
      if(d<distance){distance=d;best=[x,z];}
    }
    if(best)position.set(best[0],this.heightAt(...best),best[1]);
  }
  chaseTarget(from,target) {
    // Funnel the horde through the model's 1.5 m doorway before chasing the
    // player. A direct diagonal chase otherwise walks into the door jamb.
    if(from.z < -7.0 && target.z > -7.0) {
      return new T.Vector3(0,from.y,Math.abs(from.x)>.25 && from.z < -8.35 ? -8.65 : -6.8);
    }
    return target;
  }
  obstruction(ray,maxDistance) {
    const boxed=super.obstruction(ray,maxDistance);
    this.raycaster.ray.copy(ray);this.raycaster.far=maxDistance;
    const meshes=this.broken?this.physics:[...this.physics,...this.door.children];
    const hit=this.raycaster.intersectObjects(meshes,false)[0];
    return Math.min(boxed,hit?.distance??maxDistance);
  }
  impactSound(ray,maxDistance=35) {
    this.raycaster.ray.copy(ray);this.raycaster.far=maxDistance;
    const hit=this.raycaster.intersectObjects(this.broken?this.physics:[...this.physics,...this.door.children],false)[0];
    return hit && hit.distance < super.obstruction(ray,maxDistance)
      ? hit.object.userData.surface || "wood" : super.impactSound(ray,maxDistance);
  }
  reset() {
    this.broken=false;
    if(this.door)this.door.visible=true;
    if(this.doorSolid&&!this.solids.includes(this.doorSolid))this.solids.push(this.doorSolid);
    this.setCutaway(true);
  }
  breakDoor() {
    if(this.broken)return;
    this.broken=true;
    if(this.door)this.door.visible=false;
    this.solids=this.solids.filter(b=>b!==this.doorSolid);
    for(let i=0;i<9;i++)this.pulse(new T.Vector3((Math.random()-.5)*1.5,Math.random()*2,-8),0xb78e54);
  }
  setExit() {}
}
