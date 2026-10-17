"""Correct opaque Cody surfaces wrongly exported as alpha-blended surfaces."""
from pathlib import Path
import json,struct
path=Path(__file__).resolve().parents[1]/'web/assets/cody_story.glb'
b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n])
for m in j['materials']:
 m.pop('alphaMode',None);m.pop('alphaCutoff',None)
s=json.dumps(j,separators=(',',':')).encode();s+=b' '*(-len(s)%4);tail=b[20+n:]
path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(s)+len(tail))+struct.pack('<II',len(s),0x4e4f534a)+s+tail)
