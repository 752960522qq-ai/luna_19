import bpy,os,json
from mathutils import Vector,Quaternion
root='/workspace/scratch/466d16a9ce68'
report={}
for name in ['cody','character2']:
 bpy.ops.wm.open_mainfile(filepath=root+'/source/'+name+'_run.blend')
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');hip=rig.pose.bones['Hips' if name=='cody' else 'root_hips'];run=rig.animation_data.action;run.name='Run'
 frames=range(1,23);meshes=[o for o in bpy.data.objects if o.type=='MESH']
 def minz():
  deps=bpy.context.evaluated_depsgraph_get();z=100
  for o in meshes:
   e=o.evaluated_get(deps);m=e.to_mesh();z=min(z,min((e.matrix_world@v.co).z for v in m.vertices));e.to_mesh_clear()
  return z
 for f in frames:
  bpy.context.scene.frame_set(f);bpy.context.view_layer.update();z=minz()
  hip.location+=(rig.matrix_world.to_3x3()@rig.data.bones[hip.name].matrix_local.to_3x3()).inverted()@Vector((0,0,.018-z))
  hip.keyframe_insert('location',frame=f,group=hip.name)
 idle=bpy.data.actions.new('Idle');rig.animation_data.action=idle
 for pb in rig.pose.bones:
  pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion();pb.location=Vector();pb.scale=Vector((1,1,1))
  pb.keyframe_insert('rotation_quaternion',frame=1,group=pb.name);pb.keyframe_insert('location',frame=1,group=pb.name)
 bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
 z=minz();hip.location+=(rig.matrix_world.to_3x3()@rig.data.bones[hip.name].matrix_local.to_3x3()).inverted()@Vector((0,0,.018-z));hip.keyframe_insert('location',frame=1,group=hip.name)
 rig.animation_data.action=run
 bounds=[]
 for f in frames:bpy.context.scene.frame_set(f);bpy.context.view_layer.update();bounds.append(minz())
 report[name]={'minimum_foot_height':min(bounds),'maximum_foot_height':max(bounds),'frames':22}
 bpy.context.scene.frame_set(1)
 bpy.ops.object.select_all(action='SELECT')
 bpy.ops.export_scene.gltf(filepath=root+'/luna_19/web/assets/'+name+'_run.glb',export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True)
 bpy.ops.wm.save_as_mainfile(filepath=root+'/source/'+name+'_run.blend')
open(root+'/luna_19/grounding-report.json','w').write(json.dumps(report,indent=2))
