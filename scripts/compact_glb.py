"""Repack embedded image buffers; preserve geometry, skins, animation and UVs."""
from pathlib import Path
import struct,json,io,sys
from PIL import Image

def compact(src,dst,size=1024):
 b=Path(src).read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);binary=b[28+n:];images={im['bufferView']:im for im in j.get('images',[]) if 'bufferView' in im};out=bytearray()
 for i,v in enumerate(j['bufferViews']):
  raw=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
  if i in images:
   im=Image.open(io.BytesIO(raw));im.thumbnail((size,size));opaque=im.mode!='RGBA' or im.getextrema()[3]==(255,255);bio=io.BytesIO()
   if opaque:im.convert('RGB').save(bio,'JPEG',quality=85);images[i]['mimeType']='image/jpeg'
   else:im.save(bio,'PNG',compress_level=7);images[i]['mimeType']='image/png'
   raw=bio.getvalue()
  out.extend(b'\0'*(-len(out)%4));v['byteOffset']=len(out);v['byteLength']=len(raw);out.extend(raw)
 out.extend(b'\0'*(-len(out)%4));j['buffers'][0]['byteLength']=len(out)
 encoded=json.dumps(j,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
 Path(dst).write_bytes(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(out))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(out),0x004e4942)+out)
 print(Path(dst).name,Path(dst).stat().st_size)
if __name__=='__main__':compact(sys.argv[1],sys.argv[2],int(sys.argv[3]) if len(sys.argv)>3 else 1024)
