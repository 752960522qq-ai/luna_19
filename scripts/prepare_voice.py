"""Generate each manifest line as an independent offline Mandarin male MP3.
Install edge-tts, then run python scripts/prepare_voice.py. Existing clips are retained.
No actor voice cloning. Uses the provider's standard generic voice.
"""
from pathlib import Path
import asyncio,json
import edge_tts
ROOT=Path(__file__).resolve().parents[1]/'web/assets/audio/voice'
async def main():
 for key,text in json.loads((ROOT/'manifest.json').read_text()).items():
  output=ROOT/(key+'.mp3')
  if output.exists() and output.stat().st_size>1000:continue
  temp=ROOT/(key+'.tmp.mp3')
  await edge_tts.Communicate(text,'zh-CN-YunxiNeural',rate='+5%',pitch='+2Hz').save(str(temp))
  if temp.stat().st_size<1000:raise ValueError(f'Empty voice: {key}')
  temp.replace(output);print(key,flush=True)
if __name__=='__main__':asyncio.run(main())
