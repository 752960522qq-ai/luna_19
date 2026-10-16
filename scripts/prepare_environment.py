"""Compress embedded environment / gun textures without changing geometry or skins.
Usage: python scripts/prepare_environment.py /path/to/upload
Requires Pillow. Original user files remain untouched.
"""
from pathlib import Path
import struct,json,io,sys,hashlib
from PIL import Image
r=Path(__file__).resolve().parents[1];up=Path(sys.argv[1]);report=[]
for src,dst in [('m92_lowpoly_gun.glb','m92.glb'),('delta_car-15.glb','colt723.glb'),('log_cabin.glb','cabin.glb')]:
 b=(up/src).read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);binary=b[28+n:];images={im['bufferView']:im for im in j.get('images',[]) if 'bufferView'in im};out=bytearray()
 for i,v in enumerate(j['bufferViews']):
  raw=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
  if i in images:
   im=Image.open(io.BytesIO(raw));im.thumbnail((1024,1024));opaque=im.mode!='RGBA' or im.getextrema()[3]==(255,255)
   bio=io.BytesIO()
   if opaque:im.convert('RGB').save(bio,'JPEG',quality=88);images[i]['mimeType']='image/jpeg'
   else:im.save(bio,'PNG',compress_level=7);images[i]['mimeType']='image/png'
   raw=bio.getvalue()
  out.extend(b'\0'*(-len(out)%4));v['byteOffset']=len(out);v['byteLength']=len(raw);out.extend(raw)
 out.extend(b'\0'*(-len(out)%4));j['buffers'][0]['byteLength']=len(out);s=json.dumps(j,separators=(',',':')).encode();s+=b' '*(-len(s)%4)
 (r/'web/assets'/dst).write_bytes(struct.pack('<4sII',b'glTF',2,28+len(s)+len(out))+struct.pack('<II',len(s),0x4e4f534a)+s+struct.pack('<II',len(out),0x004e4942)+out)
 report.append({'source':src,'sha256':hashlib.sha256(b).hexdigest(),'output':dst,'outputBytes':(r/'web/assets'/dst).stat().st_size,'maxTextureSize':1024})
 print(dst,len(out))
(r/'environment-assets-report.json').write_text(json.dumps(report,indent=2))
