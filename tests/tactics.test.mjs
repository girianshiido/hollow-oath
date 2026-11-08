import {test} from 'node:test';import assert from 'node:assert/strict';
import {aegisProtection, encounter, HERO_IDS, spellRankCap, SPELL_IDS, spellCost, spellUpgradeCost} from '../src/content.ts';
import {activeSeal, Battle, buySpell, enemyAffinity, newRun, sealFloor, stats, workshopPrice} from '../src/engine.ts';
import {profileFromRun} from '../src/achievements.ts';
import {decode, serialize} from '../src/saves.ts';
function setup(hero='vanguard',wave=15,step=32){const r=newRun(hero);Object.assign(r,{wave,step,level:40,wait:0,foeHp:encounter(wave,step).hp});r.hp=stats(r).hp;r.mp=stats(r).mp;return r;}
test('Five direct spells progress to ten levels across the whole campaign with affordable Essence totals',()=>{
 assert.deepEqual(SPELL_IDS,['ember','mend','rime','storm','aegis']);
 assert.equal(spellRankCap(1),1);assert.equal(spellRankCap(32),10);
 for(let wave=1;wave<=32;wave++)assert.ok(spellRankCap(wave)<=10);
 const total=Array.from({length:9},(_,i)=>spellUpgradeCost(i+1)).reduce((a,b)=>a+b,0)*5+5;
 assert.ok(total<=192);
 const r=setup();r.phase='fallen';r.hp=0;r.essence=192;
 for(const wave of [1,8,16,32]){r.wave=wave;while(buySpell(r,'ember')){}assert.equal(r.spellRanks.ember??1,spellRankCap(wave));}
 assert.equal(workshopPrice(r,'ember'),undefined);
 assert.ok(spellCost('ember',10)>spellCost('ember',3));
});
test('Aegis carries its cast level through spell changes, spends exactly eight hits at level ten and cannot stack',()=>{
 for(const hero of HERO_IDS){
  const r=setup(hero,32,1);r.spellRanks.aegis=10;r.spell='aegis';r.mode='magic';
  const events=[],b=new Battle(r,e=>events.push(e));b.foe.moves=['steel'];b.foe.atk=10;b.foe.spd=.001;b.foe.hp=r.foeHp=99999;b.player.spd=1;
  b.tick(1);assert.equal(r.ward,8);assert.equal(r.mode,'steel');
  r.spell='ember';r.mode='magic';b.tick(1);assert.equal(r.ward,8);assert.equal(r.wardRank,10);
  r.spell='aegis';r.mode='magic';const mp=r.mp;b.tick(1);assert.equal(r.ward,8);assert.ok(r.mp>=mp);
  for(let i=0;i<8;i++){r.enemyGauge=1;b.tick(.001);}
  assert.equal(r.ward,0);assert.equal(events.filter(e=>e.type==='hurt').length,8);
  assert.ok(events.filter(e=>e.type==='hurt').every(e=>e.blocked>0));
 }
 assert.deepEqual(aegisProtection(1),{reduction:.3,charges:5});assert.equal(aegisProtection(10).charges,8);assert.ok(Math.abs(aegisProtection(10).reduction-.45)<1e-9);
});
test('Enemy spells telegraph before damage; Rime can delay a prepared spell by no more than 0.6s',()=>{
 const r=setup(),events=[],b=new Battle(r,e=>events.push(e));b.foe.moves=['storm'];b.foe.hp=r.foeHp=999999;b.foe.seals=[];b.foe.affinity=undefined;
 b.foe.spd=1;b.player.spd=1;r.enemyGauge=1;r.playerGauge=0;b.tick(.001);
 assert.equal(r.intent,'storm');assert.ok(!events.some(e=>e.type==='hurt'));const hp=r.hp;
 b.tick(.5);assert.equal(r.hp,hp);
 r.spell='rime';r.mode='magic';b.player.spd=20;r.mp=1000;b.player.mp=1000;
 b.tick(.5);assert.ok(r.castDelay<=.600001);
 r.mode='steel';b.player.spd=.001;b.tick(2);
 assert.ok(events.some(e=>e.type==='hurt'&&e.arcane&&e.move==='storm'));
});
test('Boss Mend consumes an action, has a two-use limit, and cannot heal back through a broken phase',()=>{
 const r=setup('oathkeeper'),events=[],b=new Battle(r,e=>events.push(e));b.player.spd=.001;b.foe.moves=['mend'];b.foe.spd=1;
 r.foeHp=Math.floor(b.foe.hp*.2);r.broken=2;
 const hp=r.hp;
 for(let i=0;i<3;i++){r.enemyGauge=1;b.tick(.001);if(r.intent)b.tick(1.81);}
 assert.equal(r.enemyHeals,2);assert.ok(r.foeHp<=sealFloor(b.foe,2));assert.ok(events.some(e=>e.type==='enemy-heal'&&!e.drain));
 assert.ok(events.slice(0,events.findIndex(e=>e.type==='enemy-heal')+1).every(e=>e.type!=='hurt'));assert.ok(r.hp<=hp);
});
test('Life Drain uses actual HP lost, is reduced by Aegis and has a finite total healing budget',()=>{
 const results=[];
 for(const ward of [0,5]){
  const r=setup('nightblade'),events=[],b=new Battle(r,e=>events.push(e));b.foe.moves=['drain'];b.foe.seals=[];b.player.spd=.001;b.foe.spd=1;
  r.foeHp=Math.floor(b.foe.hp*.3);r.ward=ward;r.wardRank=1;r.enemyGauge=1;
  const hp=r.hp;b.tick(.001);b.tick(1.8);
  const lost=hp-r.hp,healed=events.filter(e=>e.type==='enemy-heal').reduce((sum,e)=>sum+e.amount,0);
  assert.equal(healed,Math.round(lost*.5));results.push({lost,healed});
  r.hp=b.player.hp=1e9;
  for(let i=0;i<100;i++){r.foeHp=Math.floor(b.foe.hp*.3);r.enemyGauge=1;b.tick(.001);b.tick(1.8);}
  assert.ok(r.enemyRecovery<=Math.floor(b.foe.hp*.18));
 }
 assert.ok(results[1].lost<results[0].lost);assert.ok(results[1].healed<results[0].healed);
});
test('Five boss phases change weaknesses and no required seal is resisted or locked for an arriving hero',()=>{
 for(const hero of HERO_IDS){
  for(let wave=1;wave<=32;wave++){
   const r=setup(hero,wave,32);r.level=1;const b=new Battle(r,()=>{});
   assert.ok(b.foe.seals.every(s=>s==='steel'||s==='ember'));
  }
  const r=setup(hero,32,32),b=new Battle(r,()=>{});
  assert.equal(b.foe.seals.length,5);
  for(let i=0;i<5;i++){r.broken=i;r.foeHp=sealFloor(b.foe,i);const seal=activeSeal(r,b.foe);assert.equal(seal,b.foe.seals[i]);const a=enemyAffinity(r,b.foe);assert.equal(a.weak,seal);assert.notEqual(a.resists,seal);}
 }
});
test('Legacy Verdict purchases are refunded once, counts survive and a partially cast enemy spell round-trips',()=>{
 const r=setup('hexweaver',32,32);r.essenceClaims=Array.from({length:31},(_,i)=>(i+1)*32);r.essence=10;
 r.spell='verdict';r.spellRanks={verdict:3,storm:2,aegis:3};r.chronicle.spellUses.verdict=42;r.ward=100;
 r.foeHp=Math.round(104*(1+.44*(r.wave-1)**1.32));const old={version:6,updated:Date.now(),run:r};const loaded=decode(JSON.stringify(old));assert.ok(loaded);
 assert.equal(loaded.version,8);assert.equal(loaded.run.essence,34);assert.equal(loaded.run.spell,'storm');assert.equal(loaded.run.spellRanks.verdict,undefined);assert.equal(loaded.run.chronicle.spellUses.verdict,42);
 assert.equal(profileFromRun(loaded.run).best.mastery,3);assert.equal(loaded.run.spellRanks.aegis,3);assert.equal(loaded.run.ward,5);
 assert.equal(decode(serialize(loaded.run)).run.essence,34);
 const current=loaded.run;current.intent='storm';current.castWait=1.234;current.castDelay=.4;current.enemyTurns=7;
 const round=decode(serialize(current));assert.ok(round);assert.equal(round.run.castWait,1.234);assert.equal(round.run.enemyTurns,7);
 current.castWait=100;assert.equal(decode(serialize(current)),null);
 const onlyVerdict=structuredClone(old);onlyVerdict.run.spellRanks={verdict:3};onlyVerdict.run.ward=0;assert.equal(profileFromRun(decode(JSON.stringify(onlyVerdict)).run).best.mastery,3);
});
test('Enemy frost delays the player action and enemy lightning pierces part of magic defense',()=>{
 const damage={};
 for(const move of ['ember','rime','storm']){
  const r=setup(),b=new Battle(r,()=>{});b.player.spd=.001;b.player.res=100;b.foe.atk=100;r.playerGauge=.9;r.intent=move;r.castWait=.001;
  const hp=r.hp;b.tick(.001);damage[move]=hp-r.hp;
  assert.ok(Math.abs(r.playerGauge-(move==='rime'?.720001:.900001))<1e-7);
 }
 assert.ok(damage.storm>damage.ember);
});
