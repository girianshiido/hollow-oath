"""Render original boss scores with the local HQ SoundFont; produce OGG and AAC.
Requires numpy, FluidSynth and ffmpeg. Run compose-chapter-boss.py first.
Intermediate masters remain under /private/tmp/hollow-chapter-audio.
"""
from pathlib import Path
import json,subprocess,wave
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
WORK=Path('/private/tmp/hollow-chapter-audio')
FONT=ROOT.parent/'science-fantasy-jrpg/soundfonts/MuseScore_General_HQ.sf2'
REPORT={}
for title,info in json.loads((WORK/'scores.json').read_text()).items():
    key='final' if title.startswith('a-crown') else 'chapter'
    stem='music-final-boss' if key=='final' else 'music-chapter'
    rendered=WORK/f'{key}-render.wav'
    normalized=WORK/f'{key}-normalized.wav'
    if not rendered.exists():
        subprocess.run(['/opt/homebrew/bin/fluidsynth','-ni','-g','0.32','-F',str(rendered),'-r','48000',str(FONT),str(WORK/f'{title}-render.mid')],check=True)
    if not normalized.exists():
        subprocess.run(['/opt/homebrew/bin/ffmpeg','-hide_banner','-loglevel','error','-i',str(rendered),'-af','loudnorm=I=-16:TP=-2:LRA=9','-ar','48000','-c:a','pcm_s16le',str(normalized),'-y'],check=True)
    with wave.open(str(normalized)) as f:
        assert f.getframerate()==48000 and f.getnchannels()==2 and f.getsampwidth()==2
        samples=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').reshape(-1,2).astype(np.float64)/32768
    intro=round(info['loopStart']*48000)
    length=round(info['body']*48000)
    start=intro+length
    body=samples[start:start+length].copy()
    opening=samples[:intro].copy()
    seam=round(.035*48000)
    ramp=np.linspace(0,1,seam)[:,None]
    preceding=samples[start-seam:start]
    # End on the samples immediately preceding the loop's first sample.
    body[-seam:]=body[-seam:]*(1-ramp)+preceding*ramp
    opening[-seam:]=opening[-seam:]*(1-ramp)+preceding*ramp
    opening[:480]*=np.linspace(0,1,480)[:,None]
    master=np.concatenate([opening,body])
    assert np.isfinite(master).all() and abs(master).max()<.99
    path=WORK/f'{stem}-master.wav'
    with wave.open(str(path),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(48000);f.writeframes(np.round(master*32767).astype('<i2').tobytes())
    for extension,codec in [('ogg',['-c:a','libvorbis','-q:a','6']),('m4a',['-c:a','aac','-b:a','192k'])]:
        dest=ROOT/'public/audio'/f'{stem}.{extension}'
        subprocess.run(['/opt/homebrew/bin/ffmpeg','-hide_banner','-loglevel','error','-i',str(path),*codec,'-ar','48000','-y',str(dest)],check=True)
    REPORT[title]={**info,'duration':len(master)/48000,'peakDb':float(20*np.log10(abs(master).max())),'rmsDb':float(20*np.log10(np.sqrt(np.mean(master**2)))),'loopSeamJump':float(abs(master[-1]-master[intro]).max()),'introJoinJump':float(abs(master[intro-1]-master[intro]).max()),'samePitchOverlaps':0,'sampleRate':48000,'channels':2}
(WORK/'audio-report.json').write_text(json.dumps(REPORT,indent=2))
print(json.dumps(REPORT,indent=2))
