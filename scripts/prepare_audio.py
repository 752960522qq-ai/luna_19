"""Reproducible CC0 source slicing. Usage: python scripts/prepare_audio.py /path/to/extracted/packs"""
from pathlib import Path
import subprocess,sys,json,csv,numpy as np
ROOT=Path(__file__).resolve().parents[1];src=Path(sys.argv[1]);out=ROOT/'web/assets/audio/sfx';out.mkdir(parents=True,exist_ok=True)
def read(p):
 b=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','44100','-']);return np.frombuffer(b,dtype='<f4').copy()
manifest={};rows=[]
def cut(key,p,start=0,length=None):
 a=read(p);sr=44100;a=a[int(start*sr):int((start+length)*sr) if length else None];where=np.flatnonzero(abs(a)>.008)
 if not len(where):raise ValueError(f'silent {p}')
 lo=max(0,int(where[0])-220);hi=min(len(a),int(where[-1])+1323);a=a[lo:hi];a*=.82/max(.01,float(max(abs(a))));fade=min(220,len(a)//8);a[:fade]*=np.linspace(0,1,fade);a[-fade:]*=np.linspace(1,0,fade)
 dest=out/(key+'.mp3');temp=out/(key+'.tmp.mp3');subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar','44100','-ac','1','-i','pipe:0','-codec:a','libmp3lame','-b:a','96k',str(temp)],input=a.astype('<f4').tobytes(),check=True)
 assert temp.stat().st_size>1000,key
 temp.replace(dest)
 manifest[key]=f'assets/audio/sfx/{key}.mp3';rows.append([key,str(p.relative_to(src)),round(start+lo/sr,4),round(start+hi/sr,4),round(len(a)/sr,4),round(float(np.sqrt(np.mean(a*a))),5)])
impact=src/'impacts/Audio';z=src/'zombies/zombies'
for key,file in {'wood':'impactWood_medium_003','metal':'impactMetal_medium_003','glass':'impactGlass_medium_004','door':'impactPlank_medium_000','break':'impactWood_heavy_003','hurt':'impactPunch_medium_001','equip':'impactMetal_light_002','empty':'impactTin_light_000','pickup':'impactBell_light_000','ui':'impactGeneric_light_000','save':'impactBell_heavy_001','console':'impactMetal_light_000'}.items():
 p=impact/(file+'.ogg')
 if not p.exists():p=next(impact.glob(file.split('_')[0]+'*.ogg'))
 cut(key,p)
for kind,file in [('stepwood','footstep_wood'),('stepstone','footstep_concrete')]:
 for i in range(3):cut(kind+str(i),impact/(file+f'_{i:03}.ogg'))
for i,n in enumerate([1,3,5,7,9,12,14,17,21]):cut('zombie'+str(i),z/f'zombie-{n}.wav',length=2.8)
# Uploaded recordings contain isolated shots; retain only first transient and tail.
for key,file in [('pistol','cz'),('rifle','sks')]:
 p=src/'guns/sounds'/(file+'.wav');a=read(p);idx=np.flatnonzero(abs(a)>.08);start=max(0,idx[0]/44100-.01);cut(key,p,start,1.05)
for key,file in [('reloadpistol','pistol_reload.wav'),('reloadrifle','rifle_reload.wav')]:cut(key,src/file)
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
with (ROOT/'audio-sources/audio-slices.csv').open('w') as f:
 w=csv.writer(f,lineterminator="\n");w.writerow(['key','source','start_seconds','end_seconds','duration_seconds','rms']);w.writerows(rows)
