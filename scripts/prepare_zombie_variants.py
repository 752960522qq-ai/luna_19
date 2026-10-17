"""Bind the supplied shirt zombie and retarget supplied FBX motions to both rigs.
Blender 4.0.2. Static source is already posed: its fitted rest skeleton follows
that pose, not a T-pose. No new character is fabricated or recoloured.
"""
import bpy,os,sys,json,math
from mathutils import Vector,Matrix,Quaternion
sys.path.insert(0,os.path.dirname(__file__))
import prepare_story_animations as s
# Efficient exact floor evaluation for the existing high-resolution zombie.
import numpy as np

def minz(meshes):
 d=bpy.context.evaluated_depsgraph_get();z=10000.
 for o in meshes:
  e=o.evaluated_get(d);m=e.to_mesh()
  if len(m.vertices):
   v=np.empty(len(m.vertices)*3,dtype=np.float32);m.vertices.foreach_get('co',v);row=np.array(e.matrix_world)[2]
   z=min(z,float((v.reshape(-1,3)@row[:3]+row[3]).min()))
  e.to_mesh_clear()
 return z
s.minz=minz;s.SOURCE_NAMES['Running(2).fbx']='running.fbx'

def bind_shirt():
 bpy.ops.import_scene.gltf(filepath=s.PROJECT+'/models/base/zombie_shirt_source.glb')
 meshes=[o for o in bpy.data.objects if o.type=='MESH']
 # Anatomical landmarks in the uploaded mesh's original metre / Z-up coordinates.
 points={'Hips':(.11,-.12,.86),'Spine':(.11,-.15,1.01),'Spine1':(.11,-.19,1.15),'Spine2':(.11,-.23,1.32),'Neck':(.13,-.24,1.40),'Head':(.13,-.26,1.46),'HeadTop_End':(.13,-.26,1.61),
 'LeftShoulder':(.20,-.23,1.34),'LeftArm':(.31,-.27,1.34),'LeftForeArm':(.30,-.49,1.34),'LeftHand':(.24,-.68,1.35),'LeftHandEnd':(.21,-.81,1.34),
 'RightShoulder':(.02,-.23,1.33),'RightArm':(-.08,-.28,1.32),'RightForeArm':(-.04,-.42,1.31),'RightHand':(.035,-.55,1.26),'RightHandEnd':(.055,-.68,1.24),
 'LeftUpLeg':(.22,-.13,.86),'LeftLeg':(.32,-.44,.54),'LeftFoot':(.36,-.45,.14),'LeftToeBase':(.38,-.65,.06),'LeftToeEnd':(.38,-.69,.05),
 'RightUpLeg':(.00,-.11,.86),'RightLeg':(-.07,-.04,.52),'RightFoot':(-.11,.18,.13),'RightToeBase':(-.11,-.02,.06),'RightToeEnd':(-.11,-.07,.05)}
 parents={'Spine':'Hips','Spine1':'Spine','Spine2':'Spine1','Neck':'Spine2','Head':'Neck','HeadTop_End':'Head'}
 for side in ['Left','Right']:
  for child,parent in [('Shoulder','Spine2'),('Arm',side+'Shoulder'),('ForeArm',side+'Arm'),('Hand',side+'ForeArm'),('HandEnd',side+'Hand'),('UpLeg','Hips'),('Leg',side+'UpLeg'),('Foot',side+'Leg'),('ToeBase',side+'Foot'),('ToeEnd',side+'ToeBase')]:parents[side+child]=parent
 arm=bpy.data.armatures.new('ShirtZombie');rig=bpy.data.objects.new('ShirtZombie',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 for name,p in points.items():
  b=arm.edit_bones.new('mixamorig:'+name);b.head=p
  child=next((n for n,par in parents.items() if par==name),None);b.tail=points[child] if child else Vector(p)+Vector((0,0,.06))
 for child,parent in parents.items():arm.edit_bones['mixamorig:'+child].parent=arm.edit_bones['mixamorig:'+parent]
 bpy.ops.object.mode_set(mode='OBJECT')
 deform=[b for b in rig.data.bones if not b.name.endswith(('End','Shoulder'))]
 def dist(p,a,b):
  d=b-a;t=max(0,min(1,(p-a).dot(d)/max(d.length_squared,1e-8)));return (p-a-d*t).length
 for mesh in meshes:
  world=mesh.matrix_world.copy();mesh.parent=None;mesh.matrix_world=world
  # Bake object transforms once, preserving world geometry and UVs.
  mesh.data.transform(world);mesh.matrix_world=Matrix.Identity(4)
  groups={b.name:mesh.vertex_groups.new(name=b.name) for b in deform}
  for v in mesh.data.vertices:
   p=v.co;name=mesh.name.lower()
   if 'head' in name:weights=[('mixamorig:Head',1)]
   elif 'hands' in name:weights=[('mixamorig:'+('LeftHand' if p.x>.13 else 'RightHand'),1)]
   elif 'boots' in name:weights=[('mixamorig:'+('LeftFoot' if p.x>.1 else 'RightFoot'),1)]
   else:
    eligible=[b for b in deform if ('UpLeg' in b.name or any(x in b.name for x in ['Leg','Foot','Hips']))] if 'pants' in name else [b for b in deform if not any(x in b.name for x in ['Leg','Foot','Toe','Hand','HeadTop'])]
    nearest=sorted([(dist(p,b.head_local,b.tail_local),b.name) for b in eligible])[:2]
    values=[(n,1/max(d,.025)**6) for d,n in nearest];total=sum(w for _,w in values);weights=[(n,w/total) for n,w in values]
   for n,w in weights:groups[n].add([v.index],w,'REPLACE')
  modifier=mesh.modifiers.new('Armature','ARMATURE');modifier.object=rig;mesh.parent=rig
 return rig,meshes

def locomotion(rig,run,idle,name,amplitude,duration_scale):
 a=run.copy();a.name=name;reference={ (fc.data_path,fc.array_index):fc.evaluate(1) for fc in idle.fcurves }
 quaternion_paths={fc.data_path for fc in a.fcurves if fc.data_path.endswith('rotation_quaternion')}
 for path in quaternion_paths:
  curves=sorted([fc for fc in a.fcurves if fc.data_path==path],key=lambda fc:fc.array_index)
  lower=any(n in path for n in ['UpLeg','Leg_','Leg"','Foot','Toe'])
  base=Quaternion([reference[(path,i)] for i in range(4)]).normalized()
  for index in range(len(curves[0].keyframe_points)):
   value=Quaternion([fc.keyframe_points[index].co.y for fc in curves]).normalized()
   value=base.slerp(value,amplitude) if lower else base
   for i,fc in enumerate(curves):fc.keyframe_points[index].co.y=value[i]
 for fc in a.fcurves:
  ref=reference.get((fc.data_path,fc.array_index))
  lower=any(n in fc.data_path for n in ['UpLeg','Leg_','Leg"','Foot','Toe'])
  for k in fc.keyframe_points:
   if ref is not None and not fc.data_path.endswith('rotation_quaternion'):
    k.co.y=ref+(k.co.y-ref)*amplitude if lower else ref
   k.co.x=1+(k.co.x-1)*duration_scale
 a.use_fake_user=True;return a

for kind in ['flesh','shirt']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 if kind=='flesh':
  bpy.ops.import_scene.gltf(filepath=s.PROJECT+'/models/base/zombie_source.glb');rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');meshes=[o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
 else:rig,meshes=bind_shirt()
 for o in bpy.data.objects:
  if o.animation_data:o.animation_data_clear()
 for a in list(bpy.data.actions):bpy.data.actions.remove(a)
 rig.animation_data_create();mapping=s.bones_map(rig,'zombie')
 end=next((b.name for b in rig.data.bones if 'HeadTop_End' in b.name),None)
 if end:mapping['HeadTop_End']=end
 # Anatomical face frame: the flesh rig's bind head axis is not its facial up
 # axis. Eyes and lower teeth establish orientation without guessing a 90° fix.
 for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion.identity();p.location=Vector();p.scale=Vector((1,1,1))
 bpy.context.view_layer.update()
 head_world=rig.matrix_world@rig.pose.bones[mapping['Head']].matrix
 head_reference=head_world.to_quaternion()
 if kind=='flesh':
  def center(mesh):
   d=bpy.context.evaluated_depsgraph_get();e=mesh.evaluated_get(d);m=e.to_mesh();result=sum((e.matrix_world@v.co for v in m.vertices),Vector())/len(m.vertices);e.to_mesh_clear();return result
  eyes=[o for o in meshes if 'eye_' in o.data.name.lower() or o.name in ['Object_9','Object_11']]
  teeth=next(o for o in meshes if 'teeth_bot' in o.data.name.lower() or o.name=='Object_13')
  eye=sum((center(o) for o in eyes),Vector())/len(eyes);tooth=center(teeth)
  # The eye-to-teeth line fixes up; the head pivot to eye line fixes forward.
  inv=head_world.inverted();up=((inv@eye)-(inv@tooth)).normalized()
  forward=(inv@eye)
  forward=forward-up*forward.dot(up);forward.normalize()
  right=up.cross(forward).normalized();forward=right.cross(up).normalized()
  local=Matrix((right,up,forward)).transposed().to_quaternion()
  world=Matrix(((1,0,0),(0,0,1),(0,-1,0))).transposed().to_quaternion()
  head_reference=world@local.inverted()
 idle=s.retarget(rig,meshes,mapping,'Zombie Idle(1).fbx','Idle_Sway',align_body=True,head_reference=head_reference);idle.use_fake_user=True
 lurch=s.retarget(rig,meshes,mapping,'Zombie Idle (1)(1).fbx','Idle_Lurch',align_body=True,head_reference=head_reference);lurch.use_fake_user=True
 run=s.retarget(rig,meshes,mapping,'Running(2).fbx','SourceRun',loop_blend=2,align_body=True,head_reference=head_reference)
 # Locomotion shares the lurch pelvis reference. Mixing a different pelvis
 # baseline into the same leg cycle can rotate the stride through the torso.
 run.use_fake_user=True
 bpy.ops.wm.save_as_mainfile(filepath='/tmp/zombie-'+kind+'-motions.blend')
 locomotion(rig,run,lurch,'Walk_Shuffle',.55,1.7)
 rig.animation_data.action=lurch;bpy.data.actions.remove(run)
 # Sketchfab's source armature inherits a scaled, rotated wrapper. Removing
 # that parent without preserving world matrices invalidates every bind pivot.
 worlds={o:o.matrix_world.copy() for o in [rig]+meshes}
 for o,w in worlds.items():o.parent=None;o.matrix_world=w
 for o in meshes:
  w=o.matrix_world.copy();o.parent=rig;o.matrix_world=w
 for o in list(bpy.data.objects):
  if o!=rig and o not in meshes:bpy.data.objects.remove(o,do_unlink=True)
 path=s.OUT+('/zombie_pool.glb' if kind=='flesh' else '/zombie_shirt.glb');s.export(rig,path)
 # Explicit schema marker disables the obsolete runtime quarter-turn correction.
 import struct
 b=open(path,'rb').read();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);j['scenes'][j.get('scene',0)].setdefault('extras',{})['zombieRigVersion']=2
 for m in j.get('materials',[]):m.pop('alphaMode',None)
 encoded=json.dumps(j,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);tail=b[20+n:];open(path,'wb').write(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
 from gltf_animation_variants import update
 update(path)
 for r in s.report[-3:]:r['character']=kind
 s.report.append({'character':kind,'name':'Walk_Heavy','source':'baked Walk_Shuffle from Running(2).fbx','durationScale':1.22,'poseResampling':False})
open(s.PROJECT+'/zombie-variant-report.json','w').write(json.dumps(s.report,indent=2))
