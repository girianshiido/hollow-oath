import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encounter,HERO_IDS} from '../src/content.ts';
import {Battle,newRun,stats,enemyPreparation} from '../src/engine.ts';
import {decode,serialize} from '../src/saves.ts';
import {benchmark} from '../scripts/benchmark-encounters.mjs';
function setup(){const r=newRun('vanguard');Object.assign(r,{wave:12,step:1,level:53,foeHp:encounter(12,1).hp,wait:0});r.support='aegis';r.spellRanks.aegis=1;r.hp=stats(r).hp;r.mp=stats(r).mp;return r;}
test('Routine enemy spells resolve on the Speed clock without an additional Gathering turn',()=>{
 for(const move of ['ember','rime','storm']){
  const r=setup(),events=[],b=new Battle(r,e=>events.push(e));b.foe.moves=[move];b.foe.spd=1;b.player.spd=.001;
  b.tick(.99);assert.equal(events.filter(e=>e.type==='hurt').length,0);
  b.tick(.01);assert.equal(events.filter(e=>e.type==='hurt').length,1);assert.equal(r.intent,null);assert.ok(!events.some(e=>e.type==='intent'));
  assert.equal(enemyPreparation(b.foe,move),0);
 }
});
test('Specials still pause enemy attacks during preparation while the player keeps acting',()=>{
 const r=setup(),events=[],b=new Battle(r,e=>events.push(e));b.foe.moves=['heavy'];b.foe.spd=1;b.player.spd=1;b.player.atk=1;b.foe.hp=r.foeHp=99999;
 b.tick(1);assert.equal(r.intent,'heavy');assert.equal(r.castWait,1);
 const hp=r.hp;b.tick(.9);assert.equal(r.hp,hp);assert.ok(events.some(e=>e.type==='hit'));
 b.tick(.1);assert.ok(events.some(e=>e.type==='hurt'&&e.move==='heavy'));assert.equal(r.intent,null);
 assert.equal(enemyPreparation(encounter(11,32),'storm'),1.8);
});
test('Wave 12 at level 53 with rank-12 gear lets almost all ordinary enemies retaliate for every class',()=>{
 for(const hero of HERO_IDS){
  const result=benchmark(hero,53,12,12);
  assert.equal(result.killed,31,hero);
  assert.ok(result.acted>=29,hero+' '+JSON.stringify(result));
  assert.equal(result.castersActed,result.casters,hero);
  assert.ok(result.oneHit<=1,hero);
 }
});
test('Routine-caster timing stays independent of tick partitioning and loaded progress stays valid',()=>{
 const r=setup(),other=structuredClone(r),a=new Battle(r,()=>{},()=>.5),b=new Battle(other,()=>{},()=>.5);
 for(const battle of [a,b]){battle.foe.moves=['ember'];battle.foe.spd=1;battle.player.spd=.001;}
 a.tick(4);for(let i=0;i<400;i++)b.tick(.01);
 assert.equal(r.hp,other.hp);assert.equal(r.enemyTurns,other.enemyTurns);assert.ok(Math.abs(r.mp-other.mp)<1e-7);
 assert.ok(decode(serialize(r)));assert.ok(decode(serialize(other)));
});
