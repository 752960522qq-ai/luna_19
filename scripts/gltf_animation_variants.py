"""Smooth baked zombie locomotion and derive a timing variant without re-sampling it."""
import copy,json,struct,math,bisect,re
from pathlib import Path

def timing_variant(j,binary,source='Walk_Shuffle',name='Walk_Heavy',factor=1.22):
 clip=copy.deepcopy(next(a for a in j['animations'] if a['name']==source));clip['name']=name
 j['animations']=[a for a in j['animations'] if a['name']!=name]
 cache={}
 for sampler in clip['samplers']:
  index=sampler['input']
  if index not in cache:
   accessor=copy.deepcopy(j['accessors'][index]);view=j['bufferViews'][accessor['bufferView']]
   offset=view.get('byteOffset',0)+accessor.get('byteOffset',0)
   values=struct.unpack_from('<'+'f'*accessor['count'],binary,offset)
   encoded=struct.pack('<'+'f'*len(values),*(v*factor for v in values))
   binary.extend(b'\0'*(-len(binary)%4));new_view={'buffer':0,'byteOffset':len(binary),'byteLength':len(encoded)};binary.extend(encoded)
   accessor['bufferView']=len(j['bufferViews']);accessor.pop('byteOffset',None);j['bufferViews'].append(new_view)
   for key in ['min','max']:
    if key in accessor:accessor[key]=[v*factor for v in accessor[key]]
   cache[index]=len(j['accessors']);j['accessors'].append(accessor)
  sampler['input']=cache[index]
 j['animations'].append(clip);binary.extend(b'\0'*(-len(binary)%4));j['buffers'][0]['byteLength']=len(binary)
 return j,binary

def smooth_walk(j,binary):
 clip=next(a for a in j['animations'] if a['name']=='Walk_Shuffle')
 if clip.get('extras',{}).get('motionFilter')=='loop-quaternion-v1':return
 def read(index):
  ac=j['accessors'][index];v=j['bufferViews'][ac['bufferView']];size={'SCALAR':1,'VEC4':4}[ac['type']]
  data=struct.unpack_from('<'+'f'*(ac['count']*size),binary,v.get('byteOffset',0)+ac.get('byteOffset',0))
  return [list(data[i:i+size]) for i in range(0,len(data),size)]
 def append(values,size):
  raw=struct.pack('<'+'f'*len(values),*values);binary.extend(b'\0'*(-len(binary)%4));offset=len(binary);binary.extend(raw)
  view=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)})
  accessor={'bufferView':view,'componentType':5126,'count':len(values)//size,'type':'SCALAR' if size==1 else 'VEC4'}
  if size==1:accessor.update(min=[min(values)],max=[max(values)])
  index=len(j['accessors']);j['accessors'].append(accessor);return index
 def normalize(q):
  length=math.sqrt(sum(x*x for x in q));return [x/length for x in q]
 def slerp(a,b,t):
  dot=sum(x*y for x,y in zip(a,b))
  if dot<0:b=[-x for x in b];dot=-dot
  if dot>.9995:return normalize([x+(y-x)*t for x,y in zip(a,b)])
  theta=math.acos(min(1,dot));d=math.sin(theta)
  return [(math.sin((1-t)*theta)*x+math.sin(t*theta)*y)/d for x,y in zip(a,b)]
 duration=max(read(s['input'])[-1][0] for s in clip['samplers']);count=60
 times=[i*duration/count for i in range(count+1)];input_index=append(times,1)
 for channel in clip['channels']:
  target=channel['target'];name=j['nodes'][target['node']]['name']
  if target['path']!='rotation' or not re.search(r'(Left|Right)(UpLeg|Leg|Foot|ToeBase)(?:_\d+)?$',name):continue
  old=clip['samplers'][channel['sampler']];knots=[x[0] for x in read(old['input'])];values=read(old['output']);samples=[]
  for t in times[:-1]:
   i=max(0,min(len(knots)-2,bisect.bisect_right(knots,t)-1));f=(t-knots[i])/max(1e-9,knots[i+1]-knots[i]);samples.append(slerp(values[i],values[i+1],f))
  filtered=[]
  for i,q in enumerate(samples):
   total=[0.,0.,0.,0.]
   for offset in range(-3,4):
    other=samples[(i+offset)%count];sign=1 if sum(a*b for a,b in zip(q,other))>=0 else -1;weight=4-abs(offset)
    total=[a+sign*weight*b for a,b in zip(total,other)]
   filtered.append(normalize(total))
  filtered.append(filtered[0]);output_index=append([v for q in filtered for v in q],4)
  channel['sampler']=len(clip['samplers']);clip['samplers'].append({'input':input_index,'output':output_index,'interpolation':'LINEAR'})
 clip.setdefault('extras',{})['motionFilter']='loop-quaternion-v1'
 binary.extend(b'\0'*(-len(binary)%4));j['buffers'][0]['byteLength']=len(binary)

def update(path):
 path=Path(path);b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);binary=bytearray(b[28+n:]);smooth_walk(j,binary);j,binary=timing_variant(j,binary)
 encoded=json.dumps(j,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
 path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
if __name__=='__main__':
 import sys
 for file in sys.argv[1:]:update(file)
