"""Original chapter/final boss scores. Stdlib MIDI writer; FluidSynth HQ renders.

python3 scripts/compose-chapter-boss.py writes editable single-pass MIDI scores
and extended two-pass render scores under /private/tmp/hollow-chapter-audio.
"""
from pathlib import Path
import struct

PPQ=480
ROOT=Path(__file__).resolve().parents[1]
SCRATCH=Path('/private/tmp/hollow-chapter-audio')
SCRATCH.mkdir(exist_ok=True)
INTRO_BARS=4
LOOP_BARS=48

def vlq(n):
    out=[n&127];n>>=7
    while n:out.insert(0,(n&127)|128);n>>=7
    return bytes(out)

def chunk(tag,data):return tag+struct.pack('>I',len(data))+data

CHORDS=[(38,50,53,57),(34,50,53,58),(41,48,53,57),(36,48,52,55),
        (43,50,55,58),(38,50,53,57),(34,50,53,58),(33,49,52,57)]
TUNE=[[(0,.7,74),(.75,.2,69),(1,.45,72),(1.5,.45,74),(2,.9,77),(3,.45,76),(3.5,.4,74)],
      [(0,1.4,77),(1.5,.4,74),(2,.9,70),(3,.45,74),(3.5,.4,72)],
      [(0,.9,72),(1,.45,69),(1.5,.4,72),(2,.9,77),(3,.45,76),(3.5,.4,72)],
      [(0,1.4,76),(1.5,.4,74),(2,.9,72),(3,.45,67),(3.5,.4,72)],
      [(0,.7,74),(.75,.2,79),(1,.45,77),(1.5,.4,74),(2,1.4,70),(3.5,.4,74)],
      [(0,.9,77),(1,.45,76),(1.5,.4,74),(2,.9,69),(3,.9,72)],
      [(0,.9,74),(1,.45,77),(1.5,.4,82),(2,.9,81),(3,.9,77)],
      [(0,.7,76),(.75,.2,73),(1,.9,69),(2,.45,73),(2.5,1.35,76)]]

def compose(final=False,repetitions=1):
    bpm=176 if final else 168
    shift=2 if final else 0
    total=INTRO_BARS+LOOP_BARS*repetitions
    parts={n:[] for n in ['Cello ostinato','Spiccato strings','Horn oath motif','Violins answer','Low brass','Organ shadows','Timpani','Orchestral drums','Bell of the watch']}
    def note(part,beat,duration,pitch,velocity):
        parts[part].append((beat,duration,pitch+(0 if part=='Orchestral drums' else shift),velocity))
    for bar in range(total):
        beat=bar*4
        if bar<INTRO_BARS:
            chord=CHORDS[[0,6,4,7][bar]]
            for pitch in chord[1:]:note('Low brass',beat,3.7,pitch,65+bar*3)
            note('Timpani',beat,.8,chord[0],78)
            note('Bell of the watch',beat,2.7,74 if bar<3 else 73,52)
            for j in range(8):note('Cello ostinato',beat+j*.5,.4,chord[0]+(12 if j%2 else 0),62+j%3*4)
            if bar==3:
                for j,p in enumerate([45,47,48,50,52,53,55,57]):note('Cello ostinato',beat+j*.5,.38,p,72)
                # Replace the rising line's conflicting pitches in the ostinato.
                parts['Cello ostinato']=sorted(parts['Cello ostinato'],key=lambda n:(n[0],n[2]))
                parts['Cello ostinato']=[n for n in parts['Cello ostinato'] if n[0]<beat]+[(beat+j*.5,.38,p+shift,72) for j,p in enumerate([45,47,48,50,52,53,55,57])]
            continue
        local=(bar-INTRO_BARS)%LOOP_BARS
        section=local//16
        index=local%8
        chord=CHORDS[index]
        for j in range(8):
            pitch=[chord[0],chord[0]+12,chord[0]+7,chord[0]+12][j%4]
            note('Cello ostinato',beat+j*.5,.39,pitch,65+(j%2)*5)
            if (local%8!=7 or j<6):
                for p in chord[1:]:note('Spiccato strings',beat+j*.5+.035,.25,p+12,41+(j%3)*4+(7 if final else 0))
        for off in [0,2]:
            for p in sorted({chord[0]+12,chord[2]}):note('Low brass',beat+off,1.65,p,57+section*4)
        if local%4==0:
            for p in chord[1:3]:note('Organ shadows',beat,3.8,p,35 if section!=1 else 27)
        for off,dur,pitch in TUNE[index]:
            if section==1:
                # Lighter middle answer before the return of the brass refrain.
                note('Violins answer',beat+off,dur,pitch+(12 if index in [4,6] else 0),67)
            else:
                note('Horn oath motif',beat+off,dur,pitch-12,84 if section==0 else 91)
                if section==2:note('Violins answer',beat+off+.02,max(.1,dur-.03),pitch,65)
        if local%8 in [0,4]:note('Bell of the watch',beat,1.8,86 if local%8==0 else 81,42)
        for off in [0,2]:note('Timpani',beat+off,.7,chord[0],67 if off==0 else 53)
        for off in [0,2.5]:note('Orchestral drums',beat+off,.12,36,65)
        for off in [1,3]:note('Orchestral drums',beat+off,.12,38,44+(7 if final else 0))
        for j in range(8):note('Orchestral drums',beat+j*.5,.1,42,26+j%2*4)
        if local%8==0:note('Orchestral drums',beat,.3,49,47)
        if local%8==7:
            for j,p in enumerate([47,45,43,41]):note('Orchestral drums',beat+3+j*.25,.12,p,50+j*3)
    configs=[('Cello ostinato',0,42,91,58),('Spiccato strings',1,45,77,43),('Horn oath motif',2,60,105,65),('Violins answer',3,48,87,79),('Low brass',4,57,82,51),('Organ shadows',5,19,63,72),('Timpani',6,47,78,64),('Orchestral drums',9,0,69,64),('Bell of the watch',7,14,61,76)]
    tracks=[];count=0
    for name,ch,program,volume,pan in configs:
        events=[(0,b'\xff\x03'+vlq(len(name))+name.encode()),(0,bytes([0xc0|ch,program])),(0,bytes([0xb0|ch,7,volume])),(0,bytes([0xb0|ch,10,pan])),(0,bytes([0xb0|ch,91,30]))]
        occupied={}
        for beat,dur,pitch,velocity in sorted(parts[name]):
            start,end=round(beat*PPQ),round((beat+dur)*PPQ)
            assert start>=occupied.get(pitch,-1),(name,beat,pitch)
            assert 0<=pitch<=127 and end>start
            occupied[pitch]=end;count+=1
            events.extend([(start,bytes([0x90|ch,pitch,velocity])),(end,bytes([0x80|ch,pitch,0]))])
        events.sort(key=lambda e:(e[0],0 if e[1][0]&0xf0==0x80 else 1))
        data=b'';last=0
        for tick,msg in events:data+=vlq(tick-last)+msg;last=tick
        data+=vlq(total*4*PPQ-last)+b'\xff\x2f\x00';tracks.append(chunk(b'MTrk',data))
    tempo=round(60_000_000/bpm)
    meta=b'\x00\xff\x51\x03'+tempo.to_bytes(3,'big')+b'\x00\xff\x58\x04\x04\x02\x18\x08\x00\xff\x2f\x00'
    data=b'MThd'+struct.pack('>IHHH',6,1,len(tracks)+1,PPQ)+chunk(b'MTrk',meta)+b''.join(tracks)
    return data,{'bpm':bpm,'notes':count,'tracks':len(tracks),'loopStart':16*tempo/1_000_000,'loopEnd':208*tempo/1_000_000,'body':192*tempo/1_000_000}

if __name__=='__main__':
    import json
    report={}
    for final,title in [(False,'the-thirty-two-chains'),(True,'a-crown-without-a-king')]:
        data,info=compose(final)
        (ROOT/'music'/f'{title}.mid').write_bytes(data)
        extended,_=compose(final,2)
        (SCRATCH/f'{title}-render.mid').write_bytes(extended)
        report[title]=info
    (SCRATCH/'scores.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
