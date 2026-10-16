"""Add authored-source Aim/Talk and zombie motion pools; preserve existing Run/Idle."""
import bpy,math,os,json,re
from mathutils import Vector,Quaternion
PROJECT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=PROJECT+'/web/assets'
SOURCE_NAMES={'Rifle Aiming Idle.fbx':'rifle_aim.fbx','Talking(1).fbx':'talking.fbx','Zombie Idle(1).fbx':'zombie_idle_sway.fbx','Zombie Idle (1)(1).fbx':'zombie_idle_lurch.fbx'}
body=['Hips','Spine','Spine1','Spine2','Neck','Head']+[s+b for s in ['Left','Right'] for b in ['Shoulder','Arm','ForeArm','Hand','UpLeg','Leg','Foot','ToeBase']]
yd={'Hips':'root_hips','Spine':'spine_lower','Spine1':'spine_middle','Spine2':'spine_upper','Neck':'head_neck_lower','Head':'head_neck_upper'}
for side,s in [('Left','left'),('Right','right')]:
 for src,dst in [('Shoulder','shoulder_1'),('Arm','shoulder_2'),('ForeArm','elbow'),('Hand','wrist')]:yd[side+src]='arm_'+s+'_'+dst
 for src,dst in [('UpLeg','thigh'),('Leg','knee'),('Foot','ankle'),('ToeBase','toes')]:yd[side+src]='leg_'+s+'_'+dst
report=[]
def bones_map(rig,kind):
 if kind=='cody':return {n:n for n in body}
 if kind=='may':return yd.copy()
 result={}
 for n in body:
  target=next((b.name for b in rig.data.bones if re.match(r'^mixamorig:'+n+r'(?:_\d+)?$',b.name)),None)
  if target:result[n]=target
 return result

def minz(meshes):
 d=bpy.context.evaluated_depsgraph_get();z=10000.
 for o in meshes:
  e=o.evaluated_get(d);m=e.to_mesh()
  if m.vertices:z=min(z,min((e.matrix_world@v.co).z for v in m.vertices))
  e.to_mesh_clear()
 return z

def retarget(target,meshes,mapping,fbx,name):
 # The source clips are Mixamo rigs. Align limb rest directions, preserving target roll.
 keep=set(bpy.data.objects);saved=set(bpy.data.actions)
 target.animation_data.action=None
 for p in target.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion=Quaternion();p.location=Vector();p.scale=Vector((1,1,1))
 rest={b.name:(target.matrix_world@b.matrix_local).to_quaternion() for b in target.data.bones}
 tpos={b.name:target.matrix_world@b.head_local for b in target.data.bones}
 bpy.ops.import_scene.fbx(filepath=PROJECT+'/models/animations/'+SOURCE_NAMES[fbx])
 source=next(o for o in bpy.data.objects if o not in keep and o.type=='ARMATURE')
 srcaction=source.animation_data.action;start,end=map(int,srcaction.frame_range)
 print('CLIP',name,start,end,flush=True)
 srest={b.name:(source.matrix_world@b.matrix_local).to_quaternion() for b in source.data.bones}
 spos={b.name:source.matrix_world@b.head_local for b in source.data.bones}
 corrections={}
 for src,tgt in mapping.items():
  sb='mixamorig:'+src
  if sb not in source.pose.bones:continue
  align=Quaternion()
  if src.endswith(('Arm','ForeArm','UpLeg','Leg')):
   nxt=src.replace('ForeArm','Hand') if src.endswith('ForeArm') else src.replace('UpLeg','Leg') if src.endswith('UpLeg') else src.replace('Arm','ForeArm') if src.endswith('Arm') else src.replace('Leg','Foot')
   if nxt in mapping:align=(tpos[mapping[nxt]]-tpos[tgt]).rotation_difference(spos['mixamorig:'+nxt]-spos[sb])
  corrections[tgt]=srest[sb].inverted()@align@rest[tgt]
 action=bpy.data.actions.new(name);target.animation_data.action=action;reverse={v:k for k,v in mapping.items() if v in corrections}
 # Sample at 30 fps; cap long source clips to 8 seconds for mobile size.
 count=min(end-start+1,240);hip=target.pose.bones[mapping['Hips']]
 for i in range(count):
  f=start+i;bpy.context.scene.frame_set(f);desired={}
  for b in target.data.bones:
   parent=b.parent;pq=desired[parent.name] if parent else Quaternion();pr=rest[parent.name] if parent else Quaternion();pb=target.pose.bones[b.name]
   if b.name in reverse:
    sb='mixamorig:'+reverse[b.name];q=(source.matrix_world@source.pose.bones[sb].matrix).to_quaternion()@corrections[b.name]
   else:q=pq@pr.inverted()@rest[b.name]
   desired[b.name]=q
   if b.name in reverse:
    pb.rotation_quaternion=rest[b.name].inverted()@pr@pq.inverted()@q;pb.keyframe_insert('rotation_quaternion',frame=i+1,group=b.name)
  hip.location=Vector();bpy.context.view_layer.update();z=minz(meshes)
  hip.location=(target.matrix_world.to_3x3()@target.data.bones[hip.name].matrix_local.to_3x3()).inverted()@Vector((0,0,.018-z));hip.keyframe_insert('location',frame=i+1,group=hip.name)
 for fc in action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 # Blend clip endpoints over 10 samples so the authored gestures loop without a jump.
 for fc in action.fcurves:
  ks=fc.keyframe_points
  if len(ks)>12:
   first=ks[0].co.y
   for i in range(1,9):
    k=ks[-i];a=(9-i)/8;k.co.y=k.co.y*(1-a)+first*a
 for o in list(bpy.data.objects):
  if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
 for a in list(bpy.data.actions):
  if a not in saved and a!=action:bpy.data.actions.remove(a)
 report.append({'name':name,'source':fbx,'frames':count,'mappedBones':len(reverse)})
 return action

def export(rig,path):
 bpy.context.scene.render.fps=30;bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=max(int(a.frame_range.y) for a in bpy.data.actions)
 bpy.context.scene.frame_set(1);bpy.ops.object.select_all(action='SELECT')
 bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_optimize_animation_size=True)

def main():
 for kind,name in [('cody','cody'),('may','character2')]:
  bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=PROJECT+'/models/base/'+name+'_run.glb')
  for a in bpy.data.actions:
   a.name='Idle' if 'Idle' in a.name else 'Run' if 'Run' in a.name else a.name;a.use_fake_user=True
  for o in list(bpy.data.objects):
   if o.type=='MESH' and not any(m.type=='ARMATURE' for m in o.modifiers):bpy.data.objects.remove(o,do_unlink=True)
  rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');meshes=[o for o in bpy.data.objects if o.type=='MESH'];mapping=bones_map(rig,kind)
  aim=retarget(rig,meshes,mapping,'Rifle Aiming Idle.fbx','Aim')
  talk=retarget(rig,meshes,mapping,'Talking(1).fbx','Talk')
  rig.animation_data.action=next(a for a in bpy.data.actions if a.name=='Idle')
  export(rig,OUT+'/'+name+'_story.glb')

 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=PROJECT+'/models/base/zombie_source.glb')
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');meshes=[o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
 for o in list(bpy.data.objects):
  if o.type=='MESH' and o not in meshes:bpy.data.objects.remove(o,do_unlink=True)
 # Keep the provided bound skeleton and original moving clip; no auto-weighting of duplicate static files.
 walk=rig.animation_data.action;walk.name='Walk_Shuffle'
 print('ZOMBIE_ORIGINAL',walk.frame_range[:],flush=True)
 # Remove horizontal root motion. Character AI controls movement in the game.
 mapping=bones_map(rig,'zombie');hip_name=mapping['Hips']
 for fc in walk.fcurves:
  if fc.data_path==f'pose.bones["{hip_name}"].location' and fc.array_index in (0,2):
   # Imported rigs may not be Z-up locally; a full grounding pass below is authoritative.
   pass
 heavy=walk.copy();heavy.name='Walk_Heavy'
 for fc in heavy.fcurves:
  for k in fc.keyframe_points:k.co.x=1+(k.co.x-1)*1.22
 report.append({'name':'Walk_Heavy','source':'derived from supplied zombie GLB movement','timingScale':1.22})
 retarget(rig,meshes,mapping,'Zombie Idle(1).fbx','Idle_Sway')
 retarget(rig,meshes,mapping,'Zombie Idle (1)(1).fbx','Idle_Lurch')
 # Bake existing movement to rotation + in-place hip motion with floor correction.
 for action in [walk,heavy]:
  rig.animation_data.action=action
  start,end=map(int,action.frame_range);step=max(1,(end-start)//120)
  # Retain body bob but remove object translation and planar hip drift in world space.
  for f in range(start,end+1,step):
   bpy.context.scene.frame_set(f);pb=rig.pose.bones[hip_name]
   mat=pb.matrix.copy();world=rig.matrix_world@mat;world.translation.x=(rig.matrix_world@rig.data.bones[hip_name].matrix_local).translation.x;world.translation.y=(rig.matrix_world@rig.data.bones[hip_name].matrix_local).translation.y
   pb.matrix=rig.matrix_world.inverted()@world;bpy.context.view_layer.update()
   z=minz(meshes);pb.location+=(rig.matrix_world.to_3x3()@rig.data.bones[hip_name].matrix_local.to_3x3()).inverted()@Vector((0,0,.018-z));pb.keyframe_insert('location',frame=f,group=hip_name)
 rig.animation_data.action=next(a for a in bpy.data.actions if a.name=='Idle_Sway')
 export(rig,OUT+'/zombie_pool.glb')
 # Importer NLA track names may override action names; normalize the original walk clip.
 import struct
 p=OUT+'/zombie_pool.glb';b=open(p,'rb').read();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n])
 for a in j['animations']:
  if a['name']=='Armature|mixamo.com|Layer0':a['name']='Walk_Shuffle'
 s=json.dumps(j,separators=(',',':')).encode();s+=b' '*(-len(s)%4);tail=b[20+n:];open(p,'wb').write(struct.pack('<4sII',b'glTF',2,20+len(s)+len(tail))+struct.pack('<II',len(s),0x4e4f534a)+s+tail)
 open(PROJECT+'/story-animation-report.json','w').write(json.dumps(report,indent=2))

if __name__ == '__main__':main()
