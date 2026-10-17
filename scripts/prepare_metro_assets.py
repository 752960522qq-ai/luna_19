"""Blender 4: split uploaded citizen packs by armature, bind supplied FBX clips.
Usage: blender -b --python scripts/prepare_metro_assets.py -- /path/to/upload
Each export contains ONE rig and only its own skinned clothing/body meshes.
"""
import bpy,sys,os,re,json,hashlib
from mathutils import Vector
sys.path.insert(0,os.path.dirname(__file__))
import prepare_story_animations as s
from compact_glb import compact
import numpy as np
up=sys.argv[sys.argv.index('--')+1]
s.SOURCE_NAMES.update({'Standing Idle.fbx':'metro_idle.fbx','Dwarf Walk.fbx':'metro_walk.fbx','Running(2).fbx':'running.fbx','Pistol Idle.fbx':'pistol_idle.fbx'})
def floor(meshes):
 d=bpy.context.evaluated_depsgraph_get();z=10000.
 for o in meshes:
  e=o.evaluated_get(d);m=e.to_mesh();v=np.empty(len(m.vertices)*3,dtype=np.float32);m.vertices.foreach_get('co',v);row=np.array(e.matrix_world)[2]
  if len(v):z=min(z,float((v.reshape(-1,3)@row[:3]+row[3]).min()))
  e.to_mesh_clear()
 return z
s.minz=floor
valve={'Hips':'Pelvis','Spine':'Spine','Spine1':'Spine1','Spine2':'Spine4','Neck':'Neck1','Head':'Head1'}
for side,letter in [('Left','L'),('Right','R')]:
 for a,b in [('Shoulder','Clavicle'),('Arm','UpperArm'),('ForeArm','Forearm'),('Hand','Hand'),('UpLeg','Thigh'),('Leg','Calf'),('Foot','Foot'),('ToeBase','Toe0')]:valve[side+a]=letter+'_'+b
report=[]
for family,filename in [('male','male_citizen_dafuq.glb'),('female','female_citizen_dafuq.glb'),('guard','security_guard__rigged_3d_model.glb')]:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=up+'/'+filename)
 rigs=sorted([o for o in bpy.data.objects if o.type=='ARMATURE'],key=lambda o:o.name)
 names=[o.name for o in rigs];bpy.ops.wm.save_as_mainfile(filepath='/tmp/metro-'+family+'.blend')
 for index,rig_name in enumerate(names):
  bpy.ops.wm.open_mainfile(filepath='/tmp/metro-'+family+'.blend');rig=bpy.data.objects[rig_name]
  meshes=[o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
  for o in [rig]+meshes:
   w=o.matrix_world.copy();o.parent=None;o.matrix_world=w
  for o in meshes:w=o.matrix_world.copy();o.parent=rig;o.matrix_world=w
  for o in list(bpy.data.objects):
   if o!=rig and o not in meshes:bpy.data.objects.remove(o,do_unlink=True)
  for o in bpy.data.objects:
   if o.animation_data:o.animation_data_clear()
  for a in list(bpy.data.actions):bpy.data.actions.remove(a)
  # Renaming bones automatically updates the associated vertex groups.
  mapping={}
  for logical in s.body:
   pattern=r'^mixamorig:'+logical+r'(?:_\d+)?$' if family=='guard' else r'^ValveBiped\.Bip01_'+valve[logical]+r'(?:_\d+)?$'
   bone=next((b for b in rig.data.bones if re.match(pattern,b.name)),None)
   if bone:bone.name=logical;mapping[logical]=bone.name
  if family=='guard':
   for bone in rig.data.bones:
    if bone.name.startswith('mixamorig:'):bone.name=re.sub(r'_\d+$','',bone.name.split(':',1)[1])
  assert len(mapping)==22,(family,len(mapping))
  # Recentre the original world-space bind matrices together, never drop wrappers first.
  hip=rig.matrix_world@rig.data.bones['Hips'].head_local
  rig.location.x-=hip.x;rig.location.y-=hip.y
  rig.animation_data_create()
  clips=[('Standing Idle.fbx','Idle'),('Dwarf Walk.fbx','Walk'),('Running(2).fbx','Run')]
  if family=='guard':clips += [('Pistol Idle.fbx','PistolAim'),('Rifle Aiming Idle.fbx','Aim')]
  for src,name in clips:
   a=s.retarget(rig,meshes,mapping,src,name,loop_blend=3 if name!='Idle' else 8,align_body=True);a.use_fake_user=True
  rig.animation_data.action=bpy.data.actions['Idle']
  key=family if family=='guard' else f'{family}{index:02d}'
  path=s.OUT+'/npc_'+key+'.glb';s.export(rig,path);compact(path,path,512)
  report.append({'id':key,'file':'npc_'+key+'.glb','source':filename,'sourceSha256':hashlib.sha256(open(up+'/'+filename,'rb').read()).hexdigest(),'maxTextureSize':512,'sourceRig':rig_name,'meshes':len(meshes),'bones':len(rig.data.bones),'clips':[n for _,n in clips]})
  print('EXPORTED',key,flush=True)
open(s.PROJECT+'/metro-assets-report.json','w').write(json.dumps(report,indent=2))
