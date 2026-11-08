import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HERO_IDS,SUPPORT_IDS,CORE_SPELL_IDS,SPELLS,spellCost,enchantmentEffect,encounter} from '../src/content.ts';
import {Battle,newRun,stats,knownRank,workshopPrice,buySpell,chooseSupport,needsSupportChoice,finishInterlude,resumeWave,actionSpellCost} from '../src/engine.ts';
import {decode,serialize,achievementHistory} from '../src/saves.ts';
import {emptyProfile} from '../src/achievements.ts';

function fight(hero='vanguard', support='haste', rank=1) {
 const r=newRun(hero);Object.assign(r,{wave:5,step:2,level:40,wait:0});
 assert.ok(chooseSupport(r,support));r.spellRanks[support]=rank;
 r.hp=stats(r).hp;r.mp=stats(r).mp;r.foeHp=encounter(5,2).hp;
 const events=[],b=new Battle(r,e=>events.push(e),()=>.5);
 b.foe.hp=r.foeHp=999999;b.foe.spd=.001;b.foe.seals=[];b.foe.affinity=undefined;b.foe.def=b.foe.res=0;b.player.spd=1;b.player.regen=0;
 const act=(spell)=>{r.mode=spell==='steel'?'steel':'magic';if(spell!=='steel')r.spell=spell;r.playerGauge=1;b.tick(.001);};
 return {r,b,events,act};
}
test('No class can learn, select or cast any fifth spell during the first four waves',()=>{
 for(const hero of HERO_IDS)for(let wave=1;wave<=4;wave++)for(const id of SUPPORT_IDS){
  const r=newRun(hero);Object.assign(r,{wave,level:40,wait:0,hp:stats({...r,level:40}).hp,mp:100,phase:'fallen',essence:1000});
  assert.equal(knownRank(r,id),0);assert.equal(workshopPrice(r,id),undefined);assert.equal(buySpell(r,id),false);assert.equal(chooseSupport(r,id),false);
  r.phase='fight';r.mode='magic';r.spell=id;r.foeHp=encounter(wave,1).hp;
  const events=[],b=new Battle(r,e=>events.push(e));b.foe.hp=r.foeHp=999999;b.foe.spd=.001;b.player.spd=1;b.tick(1);
  assert.equal(r.chronicle.spellUses[id],0);assert.equal(r.ward,0);assert.equal(r.empower,null);assert.equal(r.mode,'steel');assert.ok(events.some(e=>e.type==='hit'));
 }
});
test('A chapter kill freezes progression, time and resources until its Chronicle and the permanent choice finish',()=>{
 for(const hero of HERO_IDS){
  const r=newRun(hero);Object.assign(r,{wave:4,step:32,level:60,wait:0,playerGauge:1,hp:stats({...r,level:60}).hp,mp:stats({...r,level:60}).mp,foeHp:1,broken:encounter(4,32).seals.length});
  const b=new Battle(r,()=>{},()=>.5);b.tick(20);
  assert.equal(r.phase,'clear');assert.equal(r.wave,4);assert.equal(r.interlude,4);assert.ok(decode(serialize(r)));
  const frozen=serialize(r);b.tick(500);assert.deepEqual(decode(serialize(r)).run,decode(frozen).run);
  resumeWave(r);assert.equal(r.wave,4);assert.equal(chooseSupport(r,'haste'),false);
  assert.ok(finishInterlude(r));assert.equal(r.chapterSeen,1);assert.equal(r.journalRead,1);assert.ok(needsSupportChoice(r));
  b.tick(20);assert.equal(r.wave,4);resumeWave(r);assert.equal(r.wave,4);
  assert.ok(chooseSupport(r,'haste'));assert.equal(knownRank(r,'haste'),1);assert.equal(chooseSupport(r,'fury'),false);
  b.tick(1);assert.equal(r.wave,5);assert.ok(decode(serialize(r)));assert.equal(r.support,'haste');
 }
});
test('All four irreversible powers can be chosen by every class, saved and improved; no other power can be bought',()=>{
 for(const hero of HERO_IDS)for(const id of SUPPORT_IDS){
  const r=newRun(hero);Object.assign(r,{wave:5,level:40,foeHp:encounter(5,1).hp,essence:1000,essenceEarned:1000});
  assert.ok(needsSupportChoice(r));assert.ok(chooseSupport(r,id));assert.equal(r.spellRanks[id],1);
  r.phase='fallen';r.hp=0;
  for(const other of SUPPORT_IDS.filter(x=>x!==id)){assert.equal(chooseSupport(r,other),false);assert.equal(workshopPrice(r,other),undefined);assert.equal(buySpell(r,other),false);assert.equal(knownRank(r,other),0);}
  while(buySpell(r,id)){}assert.equal(knownRank(r,id),10);
  const saved=decode(serialize(r));assert.ok(saved);assert.equal(saved.run.support,id);assert.equal(knownRank(saved.run,id),10);
 }
});
test('Haste accelerates only the hero, expires after its listed actions and consumes no charges while paused',()=>{
 for(const hero of HERO_IDS)for(const rank of [1,10]){
  const {r,b,events,act}=fight(hero,'haste',rank),mp=r.mp,effect=enchantmentEffect('haste',rank),enemySpeed=b.foe.spd;
  act('haste');assert.equal(r.mode,'steel');assert.equal(r.mp,mp-spellCost('haste',rank));assert.equal(r.empower.left,effect.charges);
  assert.equal(events.filter(e=>e.type==='hit').length,0);r.playerGauge=0;
  const period=1/effect.multiplier;b.tick(period-.001);assert.equal(events.filter(e=>e.type==='hit').length,0);b.tick(.001);
  assert.equal(events.filter(e=>e.type==='hit').length,1);assert.equal(r.empower.left,effect.charges-1);assert.equal(b.foe.spd,enemySpeed);assert.equal(b.player.spd,1);
  b.tick(0);assert.equal(r.empower.left,effect.charges-1);
  for(let i=1;i<effect.charges;i++)act('steel');assert.equal(r.empower,null);
  r.playerGauge=0;const hits=events.filter(e=>e.type==='hit').length;b.tick(.9);assert.equal(events.filter(e=>e.type==='hit').length,hits);b.tick(.1);assert.equal(events.filter(e=>e.type==='hit').length,hits+1);
 }
});
test('Battle Fury strengthens steel only, counts even guarded attempts, and cannot be stacked',()=>{
 for(const hero of HERO_IDS)for(const rank of [1,10]){
  const {r,b,events,act}=fight(hero,'fury',rank);act('fury');const charges=r.empower.left,mp=r.mp;
  act('fury');assert.equal(r.empower.left,charges-1);assert.equal(r.mp,mp);assert.equal(r.chronicle.spellUses.fury,1);
  const hit=events.filter(e=>e.type==='hit').at(-1);assert.equal(hit.damage,Math.round(b.player.atk*enchantmentEffect('fury',rank).multiplier/16));
  act('ember');assert.equal(r.empower.left,charges-1);assert.equal(events.filter(e=>e.type==='hit').at(-1).damage,Math.round(Math.round(b.player.mag*1.36)/16));
  b.foe.seals=['ember'];act('steel');assert.equal(r.empower.left,charges-2);assert.ok(events.some(e=>e.type==='block'));
 }
});
test('Arcane Surge boosts paid offensive attempts, adds MP cost, leaves Mend unchanged, and restores base cost on its last charge',()=>{
 for(const hero of HERO_IDS)for(const rank of [1,10]){
  const {r,b,events,act}=fight(hero,'surge',rank);act('surge');const effect=enchantmentEffect('surge',rank),charges=r.empower.left;
  r.mp=b.player.mp=1000;r.hp--;act('mend');assert.equal(r.mp,1000-spellCost('mend',1));assert.equal(r.empower.left,charges);assert.equal(r.hp,b.player.hp);
  const before=r.mp;act('ember');assert.equal(before-r.mp,spellCost('ember',1)+effect.surcharge);assert.equal(r.empower.left,charges-1);
  assert.equal(events.filter(e=>e.type==='hit').at(-1).damage,Math.round(Math.round(b.player.mag*1.36*effect.multiplier)/16));
  b.foe.affinity={resists:'ember',weak:'rime',immune:true};act('ember');assert.equal(r.empower.left,charges-2);assert.equal(events.filter(e=>e.type==='hit').at(-1).damage,0);
  r.empower.left=1;r.mp=spellCost('ember',1)*2+effect.surcharge;act('ember');assert.equal(r.empower,null);assert.equal(r.mode,'magic');assert.equal(r.mp,spellCost('ember',1));assert.equal(actionSpellCost(r,'ember'),spellCost('ember',1));
 }
});
test('Buffs survive ordinary foes and action changes, then reset on retry or the next wave',()=>{
 for(const support of SUPPORT_IDS){
  const {r,b,act}=fight('vanguard',support);act(support);const ward=r.ward,empower=structuredClone(r.empower);
  r.foeHp=1;act('steel');const after=r.empower?.left;b.tick(.8);assert.equal(r.step,3);assert.equal(r.ward,ward);assert.equal(r.empower?.left,after);
  r.phase='fallen';r.hp=0;resumeWave(r);assert.equal(r.ward,0);assert.equal(r.empower,null);assert.equal(r.support,support);
  assert.ok(ward>0||empower?.left>0);
 }
});
test('Version-nine saves retain identities, upgrades, currencies, cast history and past chapters without repeated scenes or refunds',()=>{
 for(const hero of HERO_IDS)for(const wave of [2,5,12,32]){
  const r=newRun(hero);Object.assign(r,{wave,level:60,hp:stats({...r,level:60}).hp,mp:stats({...r,level:60}).mp,foeHp:encounter(wave,1).hp,spell:'aegis',mode:'magic',spellRanks:{aegis:7,ember:4},ward:5,wardRank:7,gold:9876,essence:123,essenceEarned:200});
  r.chronicle.spellUses.aegis=89;r.chronicle.hits=100;r.chronicle.bestStreak=r.chronicle.streak=0;
  for(const key of ['support','empower','interlude','chapterSeen'])delete r[key];
  const migrated=decode(JSON.stringify({version:9,updated:1,run:r}));assert.ok(migrated);const run=migrated.run;
  assert.equal(migrated.version,10);assert.equal(run.support,null);assert.equal(run.mode,'steel');assert.equal(run.ward,0);assert.equal(run.spellRanks.aegis,7);assert.equal(run.essence,128);assert.equal(run.essenceEarned,205);assert.equal(run.gold,9876);assert.equal(run.chronicle.spellUses.aegis,89);assert.equal(run.runId,r.runId);
  assert.equal(run.chapterSeen,(1<<Math.floor((wave-1)/4))-1);assert.equal(run.interlude,null);
  const again=decode(serialize(run));assert.deepEqual(again.run,run);
  if(wave>=5){assert.ok(chooseSupport(run,'surge'));assert.equal(run.spellRanks.surge,7);assert.equal(run.spellRanks.aegis,undefined);assert.ok(decode(serialize(run)));}
 }
});
test('Pending Chronicle and active enchantment state round-trip; malformed or foreign power states are rejected',()=>{
 const r=newRun('nightblade');Object.assign(r,{wave:8,step:32,phase:'clear',foeHp:0,interlude:8,chapterSeen:1,level:30,support:'surge',spellRanks:{surge:4},empower:{rank:4,left:3}});
 assert.ok(decode(serialize(r)));
 for(const mutate of [r=>r.interlude=4,r=>r.chapterSeen=3,r=>r.empower.left=100,r=>r.empower.rank=10,r=>r.support='fury',r=>r.spellRanks.haste=2,r=>r.support=null]){
  const bad=structuredClone(r);mutate(bad);assert.equal(decode(serialize(bad)),null);
 }
 const loaded=decode(serialize(r)).run;assert.ok(finishInterlude(loaded));assert.equal(loaded.chapterSeen,3);resumeWave(loaded);assert.equal(loaded.wave,9);assert.equal(loaded.empower,null);assert.equal(loaded.support,'surge');
});
test('Old shared achievement archives retain Aegis casts and gain zero counters for new powers',()=>{
 const p=emptyProfile();p.spells.aegis=77;p.totals.kills=123;delete p.spells.haste;delete p.spells.surge;delete p.spells.fury;
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=new Map([['hollow-oath.chronicle.run-old-archive',JSON.stringify(p)]]);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return store.size},key(i){return [...store.keys()][i]},getItem(k){return store.get(k)??null}}});
 try{const history=achievementHistory();assert.equal(history.other.spells.aegis,77);assert.equal(history.other.totals.kills,123);assert.equal(history.other.spells.haste,0);}finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage;}
});
test('The interlude ships an editable MIDI and checked looping Vorbis/AAC masters',()=>{
 const root=new URL('../',import.meta.url),report=JSON.parse(readFileSync(new URL('music/interlude-report.json',root)));
 assert.equal(readFileSync(new URL('music/between-the-names.mid',root)).toString('ascii',0,4),'MThd');
 assert.equal(readFileSync(new URL('public/audio/music-interlude.ogg',root)).toString('ascii',0,4),'OggS');
 assert.equal(readFileSync(new URL('public/audio/music-interlude.m4a',root)).toString('ascii',4,8),'ftyp');
 assert.equal(report.samePitchOverlaps,0);assert.ok(report.peakDb< -2);assert.ok(report.loopSeamJump<.01);assert.equal(report.channels,2);assert.ok(report.duration>45&&report.duration<60);
});
