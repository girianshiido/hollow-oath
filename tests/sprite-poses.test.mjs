import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {MonsterPoses,PIKEMAN_FRAMES} from '../src/sprite-poses.ts';
test('Contact and recoil are shown in order when attacks land on the same tick',()=>{
 const p=new MonsterPoses();p.trigger('attack');p.trigger('hurt');assert.equal(p.pose,'attack');p.tick(239);assert.equal(p.pose,'attack');p.tick(1);assert.equal(p.pose,'hurt');p.tick(189);assert.equal(p.pose,'hurt');p.tick(1);assert.equal(p.pose,'idle');
});
test('Reset between opponents prevents stale impact frames and invalid elapsed times do not advance a pose',()=>{
 const p=new MonsterPoses();p.trigger('hurt');p.trigger('attack');for(const t of [NaN,Infinity,-1,0])p.tick(t);assert.equal(p.pose,'hurt');p.reset();p.tick(500);assert.equal(p.pose,'idle');p.trigger('attack');p.tick(240);assert.equal(p.pose,'idle');
});
test('Many queued impacts stay brief and a large frame step drains the queue safely',()=>{
 const p=new MonsterPoses();p.trigger('attack');for(let i=0;i<100;i++)p.trigger(i%2?'attack':'hurt');p.tick(1000);assert.equal(p.pose,'idle');
});
test('Three frame assets have matching transparent 305 by 358 canvases',()=>{
 for(const {art} of Object.values(PIKEMAN_FRAMES)){
  const bytes=readFileSync(new URL('../public/art/'+art+'.webp',import.meta.url));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  // Extended WebP headers carry the alpha flag and 24-bit canvas dimensions.
  assert.equal(bytes.toString('ascii',12,16),'VP8X');assert.ok(bytes[20]&16);assert.equal(bytes.readUIntLE(24,3)+1,305);assert.equal(bytes.readUIntLE(27,3)+1,358);
 }
});
