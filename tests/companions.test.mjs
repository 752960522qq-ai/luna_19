import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../web/vendor/three.module.js';
import {separateCompanion} from '../web/game/companions.js';
const free=(p,x,z)=>{p.x+=x;p.z+=z;return true;};
test('companion separates overlapping and identical spawn positions',()=>{
 for(const x of [0,.15,.9]){
  const p=new Vector3(), c=new Vector3(x,0,0);
  assert(separateCompanion(p,c,free));assert(c.distanceTo(p)>=1.049);
 }
 const c=new Vector3(2,0,1);assert(!separateCompanion(new Vector3(),c,free));
 assert.deepEqual(c.toArray(),[2,0,1]);
});
test('companion finds alternate free side without passing through walls',()=>{
 const p=new Vector3(),c=new Vector3(.1,0,0);
 const move=(v,x,z)=>{if(v.x+x>.5)return false;return free(v,x,z);};
 assert(separateCompanion(p,c,move));assert(c.x<=.5);assert(c.length()>=1.049);
 const blocked=new Vector3(.1,0,0);
 assert(!separateCompanion(p,blocked,()=>false));assert.equal(blocked.x,.1);
});
test('separation samples the path instead of jumping through a thin wall',()=>{
 const p=new Vector3(),c=new Vector3(.1,0,0);
 const wall=(v,x,z)=>{
  const next=v.x+x;
  if(next>.3&&next<.5)return false;
  return free(v,x,z);
 };
 assert(separateCompanion(p,c,wall));assert(c.x<=.3);assert(c.length()>=1.049);
});
