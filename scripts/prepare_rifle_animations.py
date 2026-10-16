"""Bake uploaded rifle clips; append only animation data, preserving shipped skins/materials."""
import bpy, os, sys, json, struct, copy
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import prepare_story_animations as s
s.SOURCE_NAMES.update({'Rifle Idle.fbx':'rifle_idle.fbx','Rifle Run.fbx':'rifle_run.fbx'})
def minz(meshes):
 d=bpy.context.evaluated_depsgraph_get(); z=10000.
 for o in meshes:
  e=o.evaluated_get(d); m=e.to_mesh()
  if len(m.vertices):
   v=np.empty(len(m.vertices)*3,dtype=np.float32);m.vertices.foreach_get('co',v)
   row=np.array(e.matrix_world)[2];z=min(z,float((v.reshape(-1,3)@row[:3]+row[3]).min()))
  e.to_mesh_clear()
 return z
s.minz=minz

def read(path):
 b=open(path,'rb').read(); n=struct.unpack_from('<I',b,12)[0]
 return json.loads(b[20:20+n]),bytearray(b[28+n:])
def append(original, baked):
 j, binary=read(original); k, source=read(baked)
 nodes={n.get('name'):i for i,n in enumerate(j['nodes'])}
 j['animations']=[a for a in j['animations'] if a['name'] not in ('RifleIdle','RifleRun')]
 for animation in k['animations']:
  if animation['name'] not in ('RifleIdle','RifleRun'):continue
  a=copy.deepcopy(animation); cache={}
  def accessor(index):
   if index in cache:return cache[index]
   ac=copy.deepcopy(k['accessors'][index]); view=copy.deepcopy(k['bufferViews'][ac['bufferView']])
   start=view.get('byteOffset',0);length=view['byteLength'];binary.extend(b'\0'*(-len(binary)%4))
   view['byteOffset']=len(binary);view['buffer']=0;binary.extend(source[start:start+length])
   ac['bufferView']=len(j['bufferViews']);j['bufferViews'].append(view)
   cache[index]=len(j['accessors']);j['accessors'].append(ac);return cache[index]
  for sampler in a['samplers']:
   sampler['input']=accessor(sampler['input']);sampler['output']=accessor(sampler['output'])
  for channel in a['channels']:
   channel['target']['node']=nodes[k['nodes'][channel['target']['node']]['name']]
  j['animations'].append(a)
 binary.extend(b'\0'*(-len(binary)%4));j['buffers'][0]['byteLength']=len(binary)
 encoded=json.dumps(j,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
 open(original,'wb').write(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
for kind,name in [('cody','cody'),('may','character2')]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 path=s.OUT+'/'+name+'_story.glb';bpy.ops.import_scene.gltf(filepath=path)
 for o in bpy.data.objects:
  if o.animation_data:
   o.animation_data.action=None
   for track in list(o.animation_data.nla_tracks):o.animation_data.nla_tracks.remove(track)
 for a in list(bpy.data.actions):bpy.data.actions.remove(a)
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');meshes=[o for o in bpy.data.objects if o.type=='MESH']
 for file,clip in [('Rifle Idle.fbx','RifleIdle'),('Rifle Run.fbx','RifleRun')]:
  action=s.retarget(rig,meshes,s.bones_map(rig,kind),file,clip,loop_blend=2 if clip=='RifleRun' else 8);action.use_fake_user=True
 tmp='/tmp/'+name+'-rifle.glb';s.export(rig,tmp);append(path,tmp)
 for entry in s.report[-2:]:entry['character']=kind
open(s.PROJECT+'/rifle-animation-report.json','w').write(json.dumps(s.report,indent=2))
