import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chapterBoss,chapterInfo} from '../src/chapters.ts';
import {HERO_IDS,encounter,gearId,spellCost} from '../src/content.ts';
import {newRun,Battle,stats,finishChapterIntro,chapterCounter,enemyPreparation,enemyStage,nextEnemyMove,sealFloor} from '../src/engine.ts';
import {decode,serialize} from '../src/saves.ts';
import {chapterTrial} from '../scripts/benchmark-chapters.mjs';
function setup(wave=4){const r=newRun('vanguard');Object.assign(r,{wave,step:32,level:45,wait:0,foeHp:encounter(wave,32).hp});r.hp=stats(r).hp;r.mp=stats(r).mp;return r;}
test('Exactly eight chapter guardians have individual introductions and three to five distinct phases',()=>{
 let count=0;
 for(let wave=1;wave<=32;wave++){const boss=encounter(wave,32);assert.equal(Boolean(boss.chapter),wave%4===0);assert.equal(Boolean(encounter(wave,31).chapter),false);if(!boss.chapter)continue;count++;const c=chapterInfo(wave);assert.equal(boss.seals.length,c.phases.length);assert.equal(new Set(c.phases).size,c.phases.length);assert.ok(c.moves.every(m=>m.length>=3));assert.equal(enemyPreparation(boss,'heavy'),3);assert.equal(enemyPreparation(boss,'steel'),0);}
 assert.equal(count,8);assert.equal(chapterInfo(32).phases.length,5);
});
test('A chapter entrance freezes both combat clocks and the timer without altering attack speed',()=>{
 const r=setup();r.chapterIntro=true;const b=new Battle(r,()=>{});const before=JSON.stringify(r),speed=b.player.spd;b.tick(10);assert.equal(JSON.stringify(r),before);assert.ok(decode(serialize(r)));
 finishChapterIntro(r);b.tick(.3);assert.ok(r.chronicle.activeSeconds>0);assert.equal(b.player.spd,speed);assert.ok(decode(serialize(r)));
});
test('Three-second preparations leave the player attacking at the normal pace',()=>{
 const r=setup(),events=[],b=new Battle(r,e=>events.push(e),()=>.5);b.foe.hp=r.foeHp=1e6;b.foe.seals=[];b.foe.spd=.001;b.player.spd=2;r.intent='heavy';r.castWait=3;r.mode='magic';r.spell='ember';
 b.tick(2.5);assert.equal(events.filter(e=>e.type==='hit').length,5);assert.ok(!events.some(e=>e.type==='hurt'));assert.equal(r.intent,'heavy');b.tick(.5);assert.ok(events.some(e=>e.type==='hurt'&&e.move==='heavy'));
});
test('A matching counter spends MP and interrupts a chapter preparation even through the wrong seal',()=>{
 const r=setup(),events=[],b=new Battle(r,e=>events.push(e),()=>.5);r.intent='heavy';r.castWait=3;r.mode='magic';r.spell='rime';r.playerGauge=1;b.foe.seals=['storm'];const hp=r.foeHp,mp=r.mp;
 assert.equal(chapterCounter(r,b.foe),'rime');b.tick(.001);assert.equal(r.intent,null);assert.equal(r.castWait,0);assert.equal(r.enemyTurns,1);assert.equal(r.foeHp,hp);assert.ok(r.mp<mp-spellCost('rime',1)+.1);assert.ok(events.some(e=>e.type==='interrupt'));assert.ok(events.some(e=>e.type==='block'));
 const ordinary=setup(3),c=new Battle(ordinary,()=>{});ordinary.intent='heavy';assert.equal(chapterCounter(ordinary,c.foe),undefined);
});
test('A phase transition changes technique and weakness, clears the old preparation and preserves player tempo',()=>{
 const r=setup(),events=[],b=new Battle(r,e=>events.push(e),()=>.5);b.player.atk=1e6;b.player.spd=1;r.broken=1;r.playerGauge=1;r.intent='heavy';r.castWait=3;const speed=b.player.spd,prior=nextEnemyMove(r,b.foe);
 b.tick(.001);assert.equal(enemyStage(r,b.foe),1);assert.equal(r.foeHp,sealFloor(b.foe,1));assert.equal(r.intent,null);assert.equal(b.player.spd,speed);assert.equal(events.filter(e=>e.type==='chapter-phase').length,1);assert.notEqual(nextEnemyMove(r,b.foe),prior);
});
test('Version-seven chapter saves retain boss HP percentage, resources and earned progress through migration',()=>{
 for(let wave=4;wave<=32;wave+=4){const r=setup(wave),prior=Math.round(104*(1+.44*(wave-1)**1.32));r.foeHp=Math.floor(prior*.57);r.broken=1;r.enemyRecovery=Math.floor(prior*.03);r.intent='storm';r.castWait=1.2;r.gold=991;r.xp=21;delete r.chapterIntro;
  const migrated=decode(JSON.stringify({version:7,updated:1234,run:r}));assert.ok(migrated);assert.equal(migrated.version,8);assert.equal(migrated.run.runId,r.runId);assert.equal(migrated.run.gold,991);assert.equal(migrated.run.xp,21);assert.equal(migrated.run.castWait,1.2);assert.equal(migrated.run.chapterIntro,false);assert.ok(Math.abs(migrated.run.foeHp/encounter(wave,32).hp-r.foeHp/prior)<.001);assert.deepEqual(migrated.run.journey,r.journey);assert.deepEqual(decode(serialize(migrated.run)).run,migrated.run);
 }
});
test('Chapter-intro and long-cast save state is bounded and only valid at a full-health chapter boss',()=>{
 const r=setup();r.chapterIntro=true;assert.ok(decode(serialize(r)));r.foeHp--;assert.equal(decode(serialize(r)),null);r.chapterIntro=false;r.intent='heavy';r.castWait=3.6;assert.ok(decode(serialize(r)));r.castWait=3.7;assert.equal(decode(serialize(r)),null);
 const normal=setup(3);normal.chapterIntro=true;assert.equal(decode(serialize(normal)),null);normal.chapterIntro=false;normal.intent='heavy';normal.castWait=3;assert.equal(decode(serialize(normal)),null);
 const invalidLegacy=setup();invalidLegacy.foeHp=100;invalidLegacy.broken=999;assert.equal(decode(JSON.stringify({version:7,updated:1,run:invalidLegacy})),null);
});
test('All four classes can defeat all eight chapter guardians using current-rank gear and tactical choices',()=>{
 for(const hero of HERO_IDS)for(let wave=4;wave<=32;wave+=4){const result=chapterTrial(hero,wave);assert.ok(['clear','victory'].includes(result.phase),JSON.stringify(result));assert.ok(result.seconds>20&&result.seconds<180,JSON.stringify(result));assert.equal(result.changes,chapterInfo(wave).phases.length-1);assert.ok(result.interrupted>0);}
 for(const hero of HERO_IDS)assert.notEqual(chapterTrial(hero,4,'steel').phase,'clear');
});
test('The two original chapter scores ship editable MIDI plus Vorbis and AAC audio',()=>{
 for(const [title,file] of [['the-thirty-two-chains','music-chapter'],['a-crown-without-a-king','music-final-boss']]){
  const midi=readFileSync(new URL('../music/'+title+'.mid',import.meta.url));assert.equal(midi.toString('ascii',0,4),'MThd');assert.equal(midi.readUInt16BE(10),10);
  const ogg=readFileSync(new URL('../public/audio/'+file+'.ogg',import.meta.url));assert.equal(ogg.toString('ascii',0,4),'OggS');assert.ok(ogg.length>100000);
  const aac=readFileSync(new URL('../public/audio/'+file+'.m4a',import.meta.url));assert.equal(aac.toString('ascii',4,8),'ftyp');
 }
});
