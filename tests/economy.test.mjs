import {test} from 'node:test';import assert from 'node:assert/strict';
import {newRun,Battle,resumeWave,stats,buySpell,workshopPrice,knownRank,buyGear,purchasePrice} from '../src/engine.ts';
import {HERO_IDS,GEAR_SLOTS,gearId,gearPrice,spellCost,SPELL_IDS,MAX_SPELL_RANK,spellUpgradeCost,encounter} from '../src/content.ts';
import {decode,serialize} from '../src/saves.ts';
test('Every equipment slot uses its full price regardless of class, prior ranks or equipped relics',()=>{
 for(const hero of HERO_IDS){const r=newRun(hero);r.wave=13;r.phase='fallen';r.hp=0;r.gold=10000;
  r.inventory=[{slot:'weapon',tier:12,relic:false},{slot:'weapon',tier:12,relic:true}];r.equipped.weapon=gearId(r.inventory[1]);r.chronicle.gearFreeAttempt=false;
  for(const slot of GEAR_SLOTS){const gear={slot,tier:13,relic:false};assert.equal(purchasePrice(r,gear),gearPrice(gear));}
  const before=r.gold;assert.ok(buyGear(r,{slot:'weapon',tier:13,relic:false}));assert.equal(r.gold,before-3721);assert.equal(r.inventory.length,3);
  const oldGold=r.gold;assert.equal(buyGear(r,{slot:'weapon',tier:13,relic:false}),false);assert.equal(r.gold,oldGold);
 }
});
test('Repeat victories keep earning Essence past 192, survive retries and export/import, and never duplicate first clears',()=>{
 let r=newRun('vanguard');r.level=50;
 for(let i=0;i<250;i++){
  r.phase='fallen';r.hp=0;resumeWave(r);Object.assign(r,{step:7,foeHp:1,wait:0,playerGauge:1});const events=[],b=new Battle(r,e=>events.push(e),()=>.5);b.tick(.001);
  assert.equal(events.find(e=>e.type==='kill').firstClear,i===0);
  if(i%50===0){const data=decode(serialize(r));assert.ok(data);r=data.run;}
 }
 assert.equal(r.essence,250);assert.equal(r.essenceEarned,250);assert.deepEqual(r.essenceClaims,[7]);assert.equal(r.kills,250);
 const saved=decode(serialize(r));assert.ok(saved);r=saved.run;r.phase='fallen';r.hp=0;
 const before=r.essence;while(buySpell(r,'ember')){}
 assert.equal(knownRank(r,'ember'),10);assert.equal(before-r.essence,107);assert.equal(r.essenceEarned,250);assert.ok(decode(serialize(r)));
});
test('Level n+1 always costs more Essence and MP for every core spell and chosen power',()=>{
 for(const hero of HERO_IDS)for(const support of ['aegis','haste','surge','fury']){
  const r=newRun(hero);Object.assign(r,{wave:5,level:30,phase:'fallen',hp:0,support,spellRanks:{[support]:1},essence:1000,essenceEarned:1000});
  for(const id of ['ember','mend','rime','storm',support]){let previous=0;for(let n=1;n<MAX_SPELL_RANK;n++){
   const price=workshopPrice(r,id);assert.ok(price>previous);previous=price;const cost=spellCost(id,n);
   assert.ok(buySpell(r,id));assert.equal(knownRank(r,id),n+1);assert.ok(spellCost(id,n+1)>cost);
  }assert.equal(workshopPrice(r,id),undefined);assert.equal(buySpell(r,id),false);}
 }
 assert.equal(spellUpgradeCost(0),undefined);assert.equal(spellUpgradeCost(10),undefined);
 const locked=newRun('vanguard');locked.phase='fallen';locked.hp=0;locked.essence=100;assert.equal(buySpell(locked,'storm'),false);
});
test('Guardians award three Essence again while ordinary unmarked monsters still award none',()=>{
 const r=newRun('vanguard');r.level=50;
 for(let i=0;i<3;i++){r.phase='fallen';r.hp=0;resumeWave(r);Object.assign(r,{step:32,foeHp:1,wait:0,playerGauge:1,broken:encounter(1,32).seals.length});const b=new Battle(r,()=>{},()=>.5);b.tick(.001);assert.equal(r.essence,(i+1)*3);assert.equal(r.essenceEarned,(i+1)*3);assert.deepEqual(r.essenceClaims,[32]);assert.ok(decode(serialize(r)));}
 r.phase='fallen';r.hp=0;resumeWave(r);Object.assign(r,{foeHp:1,wait:0,playerGauge:1});new Battle(r,()=>{},()=>.5).tick(.001);assert.equal(r.essence,9);
});
test('Version-eight saves preserve old cheap upgrades, currency and equipment with no retroactive charges',()=>{
 for(const hero of HERO_IDS){const r=newRun(hero);Object.assign(r,{wave:13,level:53,gold:6217,essence:40,essenceClaims:Array.from({length:12},(_,i)=>(i+1)*32).concat([7,19,27,39]),spellRanks:{ember:10,mend:7,aegis:8},wait:1,foeHp:encounter(13,1).hp});r.inventory=[{slot:'weapon',tier:12,relic:false}];r.equipped.weapon=gearId(r.inventory[0]);r.chronicle.gearFreeAttempt=false;r.hp=stats(r).hp;r.mp=stats(r).mp;delete r.essenceEarned;
  const save=decode(JSON.stringify({version:8,updated:1,run:r}));assert.ok(save);assert.equal(save.version,10);assert.equal(save.run.essence,45);assert.equal(save.run.essenceEarned,45);assert.equal(save.run.gold,6217);assert.deepEqual(save.run.spellRanks,r.spellRanks);assert.deepEqual(save.run.inventory,r.inventory);assert.equal(save.run.runId,r.runId);assert.equal(purchasePrice(save.run,{slot:'weapon',tier:13,relic:false}),3721);assert.deepEqual(decode(serialize(save.run)).run,save.run);
 }
});
test('Forged, missing or unsafe Essence counters are rejected while large valid balances round-trip',()=>{
 const r=newRun('hexweaver');r.essence=r.essenceEarned=10000;assert.ok(decode(serialize(r)));
 for(const mutate of [r=>r.essenceEarned=9999,r=>r.essenceEarned=-1,r=>r.essenceEarned=1.5,r=>delete r.essenceEarned,r=>r.essenceEarned=Number.MAX_SAFE_INTEGER+1]){const bad=structuredClone(r);mutate(bad);assert.equal(decode(serialize(bad)),null);}
});
