import {test} from 'node:test';import assert from 'node:assert/strict';
import {encounter,gearId,gearPrice,HERO_IDS} from '../src/content.ts';
import {Battle,newRun,equipGear,stats,wavePower,weaponRank,purchasePrice,buyGear} from '../src/engine.ts';
import {decode,serialize} from '../src/saves.ts';
function setup(hero='vanguard',wave=12,tier=12){const r=newRun(hero);Object.assign(r,{level:53,wave,wait:0,foeHp:encounter(wave,1).hp});const g={slot:'weapon',tier,relic:false};r.inventory.push(g);equipGear(r,g,'weapon');r.hp=stats(r).hp;r.mp=stats(r).mp;return r;}
function hit(wave,mode){const r=setup('vanguard',wave,12);r.mode=mode;r.spell='ember';r.spellRanks.ember=3;let value;const b=new Battle(r,e=>{if(e.type==='hit')value=e.damage},()=>.5);b.foe.def=b.foe.res=100;b.foe.seals=[];b.foe.affinity=undefined;b.foe.hp=r.foeHp=99999;b.foe.spd=.001;b.player.spd=1;b.tick(1);return value;}
test('The next wave halves offensive power at unchanged weapon rank for both steel and spells',()=>{
 for(const mode of ['steel','magic'])assert.ok(Math.abs(hit(12,mode)/2-hit(13,mode))<=1);
 const r=setup();assert.equal(wavePower(r),1);r.wave=13;assert.equal(wavePower(r),.5);r.wave=14;assert.equal(wavePower(r),.25);
 const next={slot:'weapon',tier:14,relic:false};r.inventory.push(next);equipGear(r,next,'weapon');assert.equal(wavePower(r),1);assert.equal(weaponRank(r),14);
});
test('Every class pays the full weapon price even when a lower rank is already owned',()=>{
 for(const hero of HERO_IDS){
 const r=newRun(hero);r.wave=3;r.gold=10000;r.phase='fallen';r.hp=0;
 for(let tier=1;tier<=3;tier++){const gear={slot:'weapon',tier,relic:false};assert.ok(buyGear(r,gear));}
 assert.equal(r.inventory.length,3);assert.equal(r.gold,10000-[1,2,3].reduce((total,tier)=>total+gearPrice({slot:'weapon',tier,relic:false}),0));
 const lower={slot:'weapon',tier:2,relic:false};assert.equal(purchasePrice(r,lower),gearPrice(lower));assert.equal(buyGear(r,lower),false);
 r.wave=4;const g={slot:'weapon',tier:4,relic:false};assert.equal(purchasePrice(r,g),gearPrice(g));r.phase='fight';r.hp=1;assert.equal(buyGear(r,g),false);
 }
});
test('Repeated strikes vary within ±12% and a killing blow still reports its complete roll',()=>{
 const r=setup('vanguard',1,1),hits=[];const rolls=[0,1,.25,.75,.5];let i=0;
 const b=new Battle(r,e=>{if(e.type==='hit')hits.push(e.damage)},()=>rolls[i++%rolls.length]);b.player.atk=100;b.player.spd=1;b.foe.def=0;b.foe.spd=.001;b.foe.seals=[];b.foe.affinity=undefined;b.foe.hp=r.foeHp=10000;
 b.tick(5);assert.deepEqual(hits,[88,112,94,106,100]);
 r.foeHp=1;b.tick(1);assert.equal(hits.at(-1),88);assert.equal(r.foeHp,0);
});
test('Defenses vary across ordinary creatures and physical armor differs from magic protection',()=>{
 const foes=Array.from({length:31},(_,i)=>encounter(12,i+1)),physical=foes.map(f=>f.def),magic=foes.map(f=>f.res);
 assert.ok(new Set(physical.map(Math.round)).size>=12);assert.ok(new Set(magic.map(Math.round)).size>=12);
 assert.ok(Math.max(...physical)/Math.min(...physical)>3);assert.ok(foes.some(f=>f.def>f.res*2));assert.ok(foes.some(f=>f.res>f.def*2));
});
test('Old equipped weapons keep their rank and savings through the balance update',()=>{
 for(const hero of HERO_IDS){const r=setup(hero,12,6),saved=decode(serialize(r));assert.ok(saved);assert.equal(saved.run.equipped.weapon,gearId(r.inventory[0]));assert.equal(wavePower(saved.run),1/64);assert.equal(saved.run.level,53);assert.equal(saved.run.gold,r.gold);}
});
