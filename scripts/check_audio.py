"""Check all referenced offline audio files exist, decode and contain a signal."""
from pathlib import Path
import json,subprocess,numpy as np
root=Path(__file__).resolve().parents[1]/'web';audio=root/'assets/audio';count=0
for category in ['sfx','voice']:
 manifest=json.loads((audio/category/'manifest.json').read_text())
 for key,value in manifest.items():
  p=root/value if category=='sfx' else audio/'voice'/(key+'.mp3')
  raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','24000','-']);samples=np.frombuffer(raw,dtype='<f4')
  assert len(samples)>2400 and np.sqrt(np.mean(samples*samples))>.001,(key,'silent or invalid');count+=1
 print(category,len(manifest),'decoded, non-silent')
print('PASS',count,'offline clips')
