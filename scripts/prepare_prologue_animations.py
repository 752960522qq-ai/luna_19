"""Blender: retarget uploaded human idle / pistol stance onto the existing story rigs."""
import bpy,os,sys,json,struct
sys.path.insert(0,os.path.dirname(__file__))
import prepare_story_animations as s
s.SOURCE_NAMES.update({'Pistol Idle.fbx':'pistol_idle.fbx','Idle (2).fbx':'human_idle.fbx'})
for kind,name in [('cody','cody'),('may','character2')]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=s.OUT+'/'+name+'_story.glb')
 # Drop previously generated clips when rerunning; preserve original Run/Aim/Talk.
 for o in bpy.data.objects:
  if o.animation_data:
   for track in list(o.animation_data.nla_tracks):
    if any(strip.action and (strip.action.name.startswith('PistolAim') or (strip.action.name=='Idle' and strip.action.frame_range.y-strip.action.frame_range.x>1)) for strip in track.strips):o.animation_data.nla_tracks.remove(track)
    elif track.name=='Idle':track.name='RestPose'
 for a in list(bpy.data.actions):
  if a.name.startswith('PistolAim') or (a.name=='Idle' and a.frame_range.y-a.frame_range.x>1):bpy.data.actions.remove(a)
  else:
   a.use_fake_user=True
   if a.name=='Idle':a.name='RestPose'
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');meshes=[o for o in bpy.data.objects if o.type=='MESH'];mapping=s.bones_map(rig,kind)
 s.retarget(rig,meshes,mapping,'Idle (2).fbx','Idle')
 s.retarget(rig,meshes,mapping,'Pistol Idle.fbx','PistolAim')
 rig.animation_data.action=next(a for a in bpy.data.actions if a.name=='Idle')
 path=s.OUT+'/'+name+'_story.glb';s.export(rig,path)
 # Imported NLA names can override Blender action names during glTF export.
 b=open(path,'rb').read();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n])
 for a in j['animations']:
  duration=max(j['accessors'][sampler['input']].get('max',[0])[0] for sampler in a['samplers'])
  if a['name']=='Idle' and duration<.01:a['name']='RestPose'
 encoded=json.dumps(j,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);tail=b[20+n:]
 open(path,'wb').write(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
open(s.PROJECT+'/prologue-animation-report.json','w').write(json.dumps(s.report,indent=2))
