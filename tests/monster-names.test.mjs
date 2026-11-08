import {test} from 'node:test';import assert from 'node:assert/strict';
import {encounter,WAVES} from '../src/content.ts';
test('Every color of an ordinary creature has a distinct stable name, including all eight newcomers',()=>{
 const families=new Map();
 for(let wave=1;wave<=32;wave++)for(let step=1;step<32;step++){
  const foe=encounter(wave,step),family=families.get(foe.art)??{names:new Map(),palettes:new Map()};
  if(family.names.has(foe.name))assert.equal(family.names.get(foe.name),foe.hue,foe.name+' must not describe different colors');
  if(family.palettes.has(foe.hue))assert.equal(family.palettes.get(foe.hue),foe.name,foe.art+' must name a palette consistently');
  family.names.set(foe.name,foe.hue);family.palettes.set(foe.hue,foe.name);families.set(foe.art,family);
 }
 for(let i=1;i<=8;i++){const family=families.get('newcomer-'+i);assert.ok(family.names.size>=2);assert.equal(family.names.size,family.palettes.size);}
 assert.equal(encounter(4,5).name,'Wickstalker');assert.equal(encounter(32,5).name,'Glaivehorn Sentinel');assert.notEqual(encounter(32,30).name,'Glaivehorn Sentinel');
});
test('Palette names preserve the thirty-two boss identities',()=>{
 for(let wave=1;wave<=32;wave++){const boss=encounter(wave,32);assert.equal(boss.name,WAVES[wave-1][1]);assert.equal(boss.hue,0);assert.equal(boss.art,'boss-'+wave);}
});
