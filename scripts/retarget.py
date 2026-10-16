import bpy, math, json, os
from mathutils import Matrix,Vector,Quaternion
ROOT=os.environ.get('LUNA19_SOURCE','/workspace/scratch/466d16a9ce68')
OUT=ROOT+'/luna_19/web/assets'
common=['Hips','Spine','Spine1','Spine2','Neck','Head']
yd={'Hips':'root_hips','Spine':'spine_lower','Spine1':'spine_middle','Spine2':'spine_upper','Neck':'head_neck_lower','Head':'head_neck_upper'}
for side,s in [('Left','left'),('Right','right')]:
 for src,dst in [('Shoulder','shoulder_1'),('Arm','shoulder_2'),('ForeArm','elbow'),('Hand','wrist')]:yd[side+src]='arm_'+s+'_'+dst
 for src,dst in [('UpLeg','thigh'),('Leg','knee'),('Foot','ankle'),('ToeBase','toes')]:yd[side+src]='leg_'+s+'_'+dst
mapped=common+[s+b for s in ['Left','Right'] for b in ['Shoulder','Arm','ForeArm','Hand','UpLeg','Leg','Foot','ToeBase']]
report=[]
for name,file in [('cody','Cody_compressed.glb'),('character2','YD3E707UG5M4T8141B03G81V6_compressed.glb')]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=ROOT+'/output/'+file)
 target=next(o for o in bpy.data.objects if o.type=='ARMATURE')
 meshes=[o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==target for m in o.modifiers)]
 keep=set(meshes+[target])
 for o in list(bpy.data.objects):
  if o.type=='MESH' and o not in keep:bpy.data.objects.remove(o,do_unlink=True)
 if name=='cody':
  rot=Matrix.Rotation(-math.pi/2,4,'Z');worlds={o:rot@o.matrix_world for o in [target]+meshes}
  for o,w in worlds.items():o.matrix_world=w
 bpy.context.view_layer.update()
 verts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
 zmin=min(v.z for v in verts);zmax=max(v.z for v in verts);scale=1.8/(zmax-zmin)
 # Normalize world size without changing bind pose or topology.
 norm=Matrix.Scale(scale,4);norm.translation.z=-zmin*scale
 worlds={o:norm@o.matrix_world for o in [target]+meshes}
 for o,w in worlds.items():o.matrix_world=w
 bpy.context.view_layer.update()
 target.name=name+'_Rig'
 target.animation_data_clear()
 mapping={s:(s if name=='cody' else yd[s]) for s in mapped}
 rest={b.name:(target.matrix_world@b.matrix_local).to_quaternion() for b in target.data.bones}
 tpos={b.name:target.matrix_world@b.head_local for b in target.data.bones}
 bpy.ops.import_scene.fbx(filepath=ROOT+'/upload/Running(2).fbx')
 source=next(o for o in bpy.data.objects if o.type=='ARMATURE' and o!=target)
 srest={b.name:(source.matrix_world@b.matrix_local).to_quaternion() for b in source.data.bones}
 spos={b.name:source.matrix_world@b.head_local for b in source.data.bones}
 source_action=source.animation_data.action
 start,end=map(int,source_action.frame_range)
 corrections={}
 for src,tgt in mapping.items():
  sb='mixamorig:'+src;align=Quaternion()
  if src.endswith(('Arm','ForeArm','UpLeg','Leg')):
   nxt=src.replace('ForeArm','Hand') if src.endswith('ForeArm') else src.replace('UpLeg','Leg') if src.endswith('UpLeg') else src.replace('Arm','ForeArm') if src.endswith('Arm') else src.replace('Leg','Foot')
   tv=tpos[mapping[nxt]]-tpos[tgt];sv=spos['mixamorig:'+nxt]-spos[sb]
   align=tv.rotation_difference(sv)
  corrections[tgt]=srest[sb].inverted()@align@rest[tgt]
 target.animation_data_create();action=bpy.data.actions.new('Run');target.animation_data.action=action
 reverse={v:k for k,v in mapping.items()}
 bpy.context.scene.render.fps=30
 bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=end-start+1
 hip_rest=spos['mixamorig:Hips'];hip_height=tpos[mapping['Hips']].z
 extrema=[]
 for f in range(start,end+1):
  bpy.context.scene.frame_set(f)
  desired={}
  for b in target.data.bones:
   pb=target.pose.bones[b.name];parent=b.parent
   parent_pose=desired[parent.name] if parent else Quaternion()
   parent_rest=rest[parent.name] if parent else Quaternion()
   if b.name in reverse:
    sb='mixamorig:'+reverse[b.name]
    d=(source.matrix_world@source.pose.bones[sb].matrix).to_quaternion()@corrections[b.name]
   else:d=parent_pose@parent_rest.inverted()@rest[b.name]
   desired[b.name]=d
   if b.name in reverse:
    pb.rotation_mode='QUATERNION';pb.rotation_quaternion=rest[b.name].inverted()@parent_rest@parent_pose.inverted()@d
    pb.keyframe_insert('rotation_quaternion',frame=f-start+1,group=b.name)
  hip=target.pose.bones[mapping['Hips']]
  delta=(source.matrix_world@source.pose.bones['mixamorig:Hips'].matrix).translation.z-hip_rest.z
  worlddelta=Vector((0,0,delta*hip_height/hip_rest.z))
  # Convert a global translation to the target bone's local pose coordinates.
  hip.location=(target.matrix_world.to_3x3()@target.data.bones[hip.name].matrix_local.to_3x3()).inverted()@worlddelta
  hip.keyframe_insert('location',frame=f-start+1,group=hip.name)
 for fc in action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 for o in list(bpy.data.objects):
  if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
 for a in list(bpy.data.actions):
  if a!=action:bpy.data.actions.remove(a)
 bpy.context.scene.frame_set(1)
 bpy.ops.object.select_all(action='DESELECT')
 for o in keep:o.select_set(True)
 bpy.context.view_layer.objects.active=target
 path=OUT+'/'+name+'_run.glb'
 bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True)
 bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/source/'+name+'_run.blend')
 report.append({'character':name,'bones':len(target.data.bones),'mapped_bones':len(mapping),'frames':end-start+1,'fps':30,'file':path})
open(ROOT+'/luna_19/retarget-report.json','w').write(json.dumps(report,indent=2))
