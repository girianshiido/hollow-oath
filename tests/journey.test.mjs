import {test} from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';
import {newRun,Battle,stats,resumeWave,canShop} from '../src/engine.ts';import {HERO_IDS,encounter,gearId} from '../src/content.ts';import {decode,serialize} from '../src/saves.ts';
import {ROAD_WAVES,ROAD_SCENES,roadScene,roadPosition,roadFee,roadArrival,offerRoad,resolveRoad} from '../src/journey.ts';
function atSlot(hero,slot){const r=newRun(hero);r.wave=ROAD_WAVES[slot];r.step=(roadPosition(r,slot)-1)%32+1;r.level=1000;r.foeHp=0;r.wait=.72;r.hp=stats(r).hp;r.mp=stats(r).mp;offerRoad(r);return r;}
test('Each adventure offers twelve distinct scenes from eighteen, with a varied stable order and safe timing',()=>{
 const seen=new Set(),orders=new Set();
 for(let i=0;i<100;i++){
  const r=newRun('vanguard');r.runId='run-road-test-'+String(i).padStart(7,'0');const scenes=ROAD_WAVES.map((_,slot)=>roadScene(r,slot));
  assert.equal(new Set(scenes.map(s=>s.id)).size,12);orders.add(scenes.map(s=>s.id).join(','));
  ROAD_WAVES.forEach((wave,slot)=>{const p=roadPosition(r,slot);assert.equal(Math.ceil(p/32),wave);assert.ok((p-1)%32+1>=10&&(p-1)%32+1<=23);assert.equal(roadScene(decode(serialize(r)).run,slot).id,scenes[slot].id);scenes[slot].choices.forEach(c=>seen.add(c.label));assert.ok(existsSync(new URL('../public/art/road-'+scenes[slot].art+'.webp',import.meta.url)));});
  assert.ok(roadScene(r,11).choices.every(c=>!c.promise));
 }
 assert.ok(orders.size>90);assert.equal(ROAD_SCENES.length,18);assert.ok(seen.size>30);
});
test('All four classes pause at a completed fight; clocks, HP, MP and progress wait for a choice',()=>{
 for(const hero of HERO_IDS){const r=atSlot(hero,0);r.journey.pending=null;r.foeHp=1;r.wait=0;r.playerGauge=1;r.broken=encounter(r.wave,r.step).seals.length;const gear={slot:'weapon',tier:r.wave,relic:false};r.inventory=[gear];r.equipped.weapon=gearId(gear);r.chronicle.gearFreeAttempt=false;
  const b=new Battle(r,()=>{},()=>.5);b.tick(.1);assert.equal(r.journey.pending,0);assert.equal(r.foeHp,0);const frozen=serialize(r).replace(/"updated":\d+/, '"updated":0');b.tick(20,20);assert.equal(serialize(r).replace(/"updated":\d+/, '"updated":0'),frozen);assert.ok(!canShop(r));assert.ok(decode(serialize(r)));
  assert.ok(resolveRoad(r,2));b.tick(.73);assert.equal(r.step,(roadPosition(r,0)-1)%32+2);
 }
});
test('A choice is atomic, paid once, retained after reload and cannot be farmed after defeat',()=>{
 const r=atSlot('hexweaver',0);r.gold=0;const scene=roadScene(r,0),paid=scene.choices.findIndex(c=>c.cost==='gold');
 if(paid>=0){const before=JSON.stringify(r);assert.equal(resolveRoad(r,paid),false);assert.equal(JSON.stringify(r),before);}
 r.gold=roadFee(0)*10;assert.equal(resolveRoad(r,0),true);const gold=r.gold;assert.equal(resolveRoad(r,0),false);assert.equal(r.gold,gold);
 const loaded=decode(serialize(r));assert.ok(loaded);assert.deepEqual(loaded.run.journey,r.journey);
 r.phase='fallen';r.hp=0;resumeWave(r);assert.ok(decode(serialize(r)),'A retry before the recorded encounter must keep a valid save');r.step=(roadPosition(r,0)-1)%32+1;offerRoad(r);assert.equal(r.journey.pending,null);assert.equal(r.journey.choices.length,1);
});
test('Kindness returns exactly once at the next encounter, including after export/import',()=>{
 let r;for(let i=0;i<200;i++){r=atSlot('nightblade',0);r.runId='run-road-kind-'+String(i).padStart(7,'0');r.step=(roadPosition(r,0)-1)%32+1;r.journey.pending=0;if(roadScene(r,0).choices.some(c=>c.promise))break;}
 r.gold=10000;const option=roadScene(r,0).choices.findIndex(c=>c.promise);assert.ok(option>=0);resolveRoad(r,option);r=decode(serialize(r)).run;
 r.wave=ROAD_WAVES[1];r.step=(roadPosition(r,1)-1)%32+1;r.foeHp=0;r.wait=.72;offerRoad(r);const gift=roadArrival(r,1);assert.equal(gift.gold,roadFee(0)*3);const gold=r.gold;assert.ok(resolveRoad(r,2));assert.equal(r.gold,gold+gift.gold);assert.equal(resolveRoad(r,2),false);assert.equal(roadArrival(r,2),null);
});
test('Old saves skip past encounters without changing identity, resources or prior progress',()=>{
 const r=newRun('oathkeeper');r.wave=17;r.level=53;r.gold=1932;delete r.journey;
 const data=decode(serialize(r));assert.ok(data);assert.equal(data.run.runId,r.runId);assert.equal(data.run.journey.since,513);assert.equal(data.run.gold,1932);assert.equal(data.run.journey.pending,null);
 for(let slot=0;slot<6;slot++){data.run.wave=ROAD_WAVES[slot];data.run.step=(roadPosition(data.run,slot)-1)%32+1;offerRoad(data.run);assert.equal(data.run.journey.pending,null);}
});
test('Malformed or duplicated encounter state is rejected without discarding valid saved choices',()=>{
 const r=atSlot('vanguard',0);assert.ok(decode(serialize(r)));for(const mutate of [x=>x.journey.pending=12,x=>x.journey.choices=[{slot:0,option:9}],x=>x.journey.choices=[{slot:0,option:2},{slot:0,option:1}],x=>x.journey.boon={kind:'godmode',left:8},x=>x.journey.boon={kind:'guard',left:9},x=>x.foeHp=1,x=>x.journey.since=2000]){const bad=JSON.parse(serialize(r)).run;mutate(bad);assert.equal(decode(serialize(bad)),null);}
});
function battleWith(kind,magic=false){const r=newRun('vanguard');r.level=30;r.wait=0;r.hp=stats(r).hp;r.mp=stats(r).mp;r.journey.boon=kind?{kind,left:8}:null;r.mode=magic?'magic':'steel';const hits=[],hurts=[];const b=new Battle(r,e=>{if(e.type==='hit')hits.push(e.damage);if(e.type==='hurt')hurts.push(e.damage);},()=>.5);Object.assign(b.foe,{hp:1000000,atk:200,def:0,res:0,spd:1,seals:[],affinity:undefined,moves:['steel']});r.foeHp=b.foe.hp;return {r,b,hits,hurts};}
test('Road blessings alter the relevant combat action, preserve immunities and expire after eight victories',()=>{
 const steel=battleWith('steel'),base=battleWith(null);steel.b.tick(1);base.b.tick(1);assert.ok(steel.hits[0]>=base.hits[0]*1.14);
 const magic=battleWith('magic',true),ordinary=battleWith(null,true);magic.b.tick(1);ordinary.b.tick(1);assert.ok(magic.hits[0]>=ordinary.hits[0]*1.14);
 const guard=battleWith('guard');guard.b.tick(1);assert.ok(guard.hurts[0]<base.hurts[0]);
 const haste=battleWith('haste'),slow=battleWith(null);haste.b.tick(10);slow.b.tick(10);assert.ok(haste.hits.length>slow.hits.length);
 const immune=battleWith('steel');immune.b.foe.affinity={resists:'steel',immune:true};immune.b.tick(1);assert.ok(immune.hits.every(h=>h===0));assert.equal(immune.r.journey.boon.left,8);
 const tiny=battleWith('steel');for(let i=0;i<8;i++){tiny.r.foeHp=1;tiny.r.wait=0;tiny.r.playerGauge=1;tiny.b.tick(.001);assert.equal(tiny.r.journey.boon?.left??0,7-i);}assert.equal(tiny.r.journey.boon,null);
});
test('HP offerings never kill and free departure is always available at zero gold and mana',()=>{
 for(let slot=0;slot<12;slot++){const r=atSlot('vanguard',slot);r.hp=1;r.mp=0;r.gold=0;const c=roadScene(r,slot).choices.findIndex(c=>c.cost==='hp');if(c>=0){resolveRoad(r,c);assert.equal(r.hp,1);}else assert.ok(resolveRoad(r,2));assert.equal(r.journey.pending,null);}
});
