"""Original Chronicle interlude, Between the Names. MIDI + HQ FluidSynth OGG/AAC.
16 quiet bars at 76 BPM; a steady-state loop retains the reverb across its seam.
"""
from pathlib import Path
import struct, json, subprocess, wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
WORK=Path('/private/tmp/hollow-interlude'); WORK.mkdir(exist_ok=True)
FONT=ROOT.parent/'science-fantasy-jrpg/soundfonts/MuseScore_General_HQ.sf2'
PPQ=480; TEMPO=789474; BEATS=64; SECONDS=BEATS*TEMPO/1e6

def vlq(n):
    out=[n&127]; n>>=7
    while n: out.insert(0,(n&127)|128); n>>=7
    return bytes(out)
def chunk(tag,data): return tag+struct.pack('>I',len(data))+data
chords=[(38,57,60,64),(34,57,62,65),(41,57,60,64),(36,55,62,64),
        (43,58,62,65),(33,57,62,65),(34,57,60,65),(33,55,61,64),
        (38,57,60,64),(34,57,62,65),(41,57,60,67),(36,55,62,64),
        (43,58,62,65),(33,57,62,65),(34,57,60,64),(33,55,61,64)]
melody={0:[(1,1.6,69),(3,.8,72)],1:[(.5,2.8,76)],2:[(0,1.6,74),(2,1.6,72)],3:[(1,2.6,67)],
        4:[(0,1.7,70),(2.5,1.1,69)],5:[(.5,2.7,65)],6:[(1,2.5,64)],7:[(0,1.2,67),(2,1.5,69)],
        8:[(.5,1.5,74),(2.5,1.1,76)],9:[(0,2.7,77)],10:[(.5,1.2,76),(2,1.7,72)],11:[(1,2.5,74)],
        12:[(0,1.7,70),(2.5,1.1,69)],13:[(.5,2.8,65)],14:[(1,2.5,64)],15:[(0,1.4,61),(2,1.5,64)]}
parts=[('A quiet piano',0,0,77,51,[]),('Harp - names on water',1,46,67,77,[]),('Veiled strings',2,48,59,57,[]),('Cello of the old oath',3,42,66,64,[]),('English horn - remembered voices',4,69,82,68,[])]
for bar,chord in enumerate(chords):
    beat=bar*4
    parts[3][5].append((beat,3.85,chord[0],48))
    for pitch in chord[1:]: parts[2][5].append((beat+.12,3.7,pitch,39+(bar//8)*3))
    for j,pitch in enumerate([chord[1]+12,chord[2]+12,chord[3]+12,chord[2]+12]):
        parts[1][5].append((beat+j,.82,pitch,42+(j%2)*5))
    for pitch in chord[1:]:parts[0][5].append((beat+.5,2.5,pitch+12,35))
    for off,dur,pitch in melody[bar]:parts[4][5].append((beat+off,dur,pitch,57+(bar//8)*4))

def midi(cycles):
    tracks=[]
    meta=b'\x00\xff\x51\x03'+TEMPO.to_bytes(3,'big')+b'\x00\xff\x58\x04\x04\x02\x18\x08\x00\xff\x2f\x00'
    tracks.append(chunk(b'MTrk',meta))
    for name,ch,program,volume,pan,notes in parts:
        events=[(0,b'\xff\x03'+vlq(len(name))+name.encode()),(0,bytes([0xc0|ch,program])),(0,bytes([0xb0|ch,7,volume])),(0,bytes([0xb0|ch,10,pan])),(0,bytes([0xb0|ch,91,42]))]
        occupied={}
        for beat,dur,pitch,velocity in sorted((beat+cycle*BEATS,dur,pitch,vel) for cycle in range(cycles) for beat,dur,pitch,vel in notes):
            start=round(beat*PPQ);end=round((beat+dur)*PPQ)
            assert start>=occupied.get(pitch,-1),(name,beat,pitch)
            occupied[pitch]=end
            events.extend([(start,bytes([0x90|ch,pitch,velocity])),(end,bytes([0x80|ch,pitch,0]))])
        events.sort(key=lambda e:(e[0],0 if e[1][0]&0xf0==0x80 else 1))
        data=b'';last=0
        for tick,msg in events:data+=vlq(tick-last)+msg;last=tick
        data+=vlq(cycles*BEATS*PPQ-last)+b'\xff\x2f\x00'
        tracks.append(chunk(b'MTrk',data))
    return b'MThd'+struct.pack('>IHHH',6,1,len(tracks),PPQ)+b''.join(tracks)
(ROOT/'music/between-the-names.mid').write_bytes(midi(1))
render_midi=WORK/'render.mid';render_midi.write_bytes(midi(3))
render=WORK/'render.wav';normalized=WORK/'normalized.wav'
subprocess.run(['/opt/homebrew/bin/fluidsynth','-ni','-g','0.40','-F',str(render),'-r','48000',str(FONT),str(render_midi)],check=True,stdout=subprocess.DEVNULL)
subprocess.run(['/opt/homebrew/bin/ffmpeg','-hide_banner','-loglevel','error','-i',str(render),'-af','loudnorm=I=-18:TP=-2.5:LRA=7','-ar','48000','-c:a','pcm_s16le','-y',str(normalized)],check=True)
with wave.open(str(normalized)) as f:samples=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').reshape(-1,2).astype(np.float64)/32768
start=round(SECONDS*48000);length=round(SECONDS*48000)
body=samples[start:start+length].copy();seam=1680;ramp=np.linspace(0,1,seam)[:,None]
body[-seam:]=body[-seam:]*(1-ramp)+samples[start-seam:start]*ramp
assert np.isfinite(body).all() and abs(body).max()<.99
master=WORK/'master.wav'
with wave.open(str(master),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(48000);f.writeframes(np.round(body*32767).astype('<i2').tobytes())
for ext,codec in [('ogg',['-c:a','libvorbis','-q:a','6']),('m4a',['-c:a','aac','-b:a','160k'])]:
    subprocess.run(['/opt/homebrew/bin/ffmpeg','-hide_banner','-loglevel','error','-i',str(master),*codec,'-ar','48000','-y',str(ROOT/f'public/audio/music-interlude.{ext}')],check=True)
decoded=subprocess.check_output(['/opt/homebrew/bin/ffmpeg','-hide_banner','-loglevel','error','-i',str(ROOT/'public/audio/music-interlude.ogg'),'-f','f32le','-'])
a=np.frombuffer(decoded,dtype='<f4').reshape(-1,2);assert np.isfinite(a).all() and abs(a).max()<.99
report={'title':'Between the Names','bpm':76,'bars':16,'tracks':len(parts),'notes':sum(len(p[5]) for p in parts),'samePitchOverlaps':0,'soundfont':FONT.name,'sampleRate':48000,'channels':2,'duration':len(body)/48000,'peakDb':float(20*np.log10(abs(a).max())),'rmsDb':float(20*np.log10(np.sqrt(np.mean(a*a)))),'loopSeamJump':float(abs(a[-1]-a[0]).max())}
(ROOT/'music/interlude-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
