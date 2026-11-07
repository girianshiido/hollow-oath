"""Original Hollow Oath ending score: The Dawn Remembers. Stdlib MIDI writer."""
from pathlib import Path
import struct
PPQ=480
TEMPO=681818 # 88 BPM
tracks=[]
def vlq(n):
    out=[n&127]; n>>=7
    while n: out.insert(0,(n&127)|128); n>>=7
    return bytes(out)
def chunk(tag,data): return tag+struct.pack('>I',len(data))+data
def track(name,ch,program,volume,pan,notes):
    events=[(0,b'\xff\x03'+vlq(len(name))+name.encode()),(0,bytes([0xc0|ch,program])),(0,bytes([0xb0|ch,7,volume])),(0,bytes([0xb0|ch,10,pan])),(0,bytes([0xb0|ch,91,36]))]
    occupied={}
    for beat,dur,pitch,velocity in notes:
        start=round(beat*PPQ); end=round((beat+dur)*PPQ)
        assert start>=occupied.get(pitch,-1),(name,beat,pitch)
        occupied[pitch]=end
        events.extend([(start,bytes([0x90|ch,pitch,velocity])),(end,bytes([0x80|ch,pitch,0]))])
    events.sort(key=lambda x:(x[0], 0 if x[1][0]&0xf0==0x80 else 1))
    data=b'';last=0
    for tick,msg in events: data+=vlq(tick-last)+msg;last=tick
    data+=vlq(max(0,36*4*PPQ-last))+b'\xff\x2f\x00'
    tracks.append(chunk(b'MTrk',data))
# D major, B minor, G, A: a returning eight-bar song with a broad final ascent.
chords=[(50,57,62,66),(47,54,59,62),(43,55,59,62),(45,57,61,64),
        (50,57,62,66),(47,54,59,62),(43,55,59,62),(45,57,61,64)]
melody=[[(0,1,74),(1, .5,73),(1.5,.5,69),(2,1.75,66)],
[(0,1.5,69),(1.5,.5,71),(2,1,73),(3,.75,74)],
[(0,1,71),(1,1,69),(2,1.75,67)],[(0,1.5,69),(1.5,.5,73),(2,1.75,76)],
[(0,1,78),(1, .5,76),(1.5,.5,74),(2,1.75,73)],[(0,1.5,74),(1.5,.5,73),(2,1,71),(3,.75,69)],
[(0,1,67),(1,1,69),(2,1.5,71)],[(0,1,73),(1,1,69),(2,1.8,74)]]
strings=[];cello=[];harp=[];piano=[];horn=[];flute=[];bells=[]
for bar in range(36):
    beat=bar*4
    chord=chords[bar%8] if bar<32 else [(43,55,59,62),(45,57,61,64),(50,57,62,66),(50,57,62,66)][bar-32]
    section=bar//8
    dynamic=[48,57,64,69,48][section]
    for p in chord[1:]: strings.append((beat,3.93,p,dynamic))
    cello.append((beat,3.9,chord[0],58 if bar<32 else 48))
    if bar<35:
        pattern=[chord[0]+12,chord[1]+12,chord[2]+12,chord[3]+12,chord[2]+12,chord[1]+12,chord[3]+12,chord[2]+12]
        for j,p in enumerate(pattern): harp.append((beat+j*.5,.43,p,43+(j%3)*4))
    if bar>=4:
        for offset in (0,2):
            for p in chord[1:]: piano.append((beat+offset,1.7,p+12,39 if section<2 else 47))
    if 4<=bar<32:
        for off,dur,p in melody[(bar-4)%8]:
            if bar<12 or 20<=bar<28: horn.append((beat+off,dur,p-12,76 if bar<12 else 84))
            else: flute.append((beat+off,dur,p,70 if bar<20 else 77))
        if 24<=bar<32:
            # Sustained violin response above the song, with generous spaces.
            strings.append((beat+.1,3.7,chord[2]+24,48))
    if bar in (0,8,16,24,32): bells.append((beat,2,86 if bar!=32 else 90,42))
# Final resolving phrase, then space for the reverb and fade.
flute.extend([(128,1.4,79,65),(129.5,.4,78,63),(130,1.7,76,61),(132,1.8,73,60),(134,1.7,76,57),(136,5.7,74,55)])
track('Warm strings',0,48,82,53,strings)
track('Cello foundation',1,42,89,59,cello)
track('Harp of dawn',2,46,82,78,harp)
track('Quiet piano',3,0,77,43,piano)
track('Horn - the oath remembered',4,60,96,61,horn)
track('Flute - the gates reopen',5,73,90,74,flute)
track('Celesta glints',6,8,66,85,bells)
meta=b'\x00\xff\x51\x03'+TEMPO.to_bytes(3,'big')+b'\x00\xff\x58\x04\x04\x02\x18\x08\x00\xff\x2f\x00'
root=Path(__file__).resolve().parents[1]
(root/'music/the-dawn-remembers.mid').write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(tracks)+1,PPQ)+chunk(b'MTrk',meta)+b''.join(tracks))
print('The Dawn Remembers: 36 bars, 88 BPM, 98.18 seconds plus release; 7 tracks.')
