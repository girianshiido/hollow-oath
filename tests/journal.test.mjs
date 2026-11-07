import {test} from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';
import {CHAPTERS,journalArt,journalUnlocked,journalUnread,journalVoice} from '../src/journal.ts';
import {newRun} from '../src/engine.ts';import {decode,serialize} from '../src/saves.ts';import {HERO_IDS} from '../src/content.ts';
test('The Chronicle reveals eight milestones without exposing future chapters',()=>{
 const r=newRun('vanguard');assert.equal(journalUnread(r),0);
 r.wave=4;r.step=32;assert.equal(journalUnlocked(r,4),false);r.phase='clear';assert.equal(journalUnlocked(r,4),true);assert.equal(journalUnlocked(r,8),false);
 r.wave=12;r.phase='fight';assert.equal(journalUnread(r),2);r.journalRead=1;assert.equal(journalUnread(r),1);
 r.essenceClaims.push(12*32);assert.equal(journalUnread(r),2);
 r.chronicle.finished=true;assert.ok(CHAPTERS.every(c=>journalUnlocked(r,c.wave)));r.journalRead=255;assert.equal(journalUnread(r),0);
});
test('Illustrations remain stable after save/import and different adventures can reveal both variants',()=>{
 const seen=new Map(CHAPTERS.map(c=>[c.wave,new Set()]));
 const combinations=new Set();
 for(let i=0;i<64;i++){
  const r=newRun('nightblade');r.runId='run-journal-'+String(i).padStart(8,'0');
  const decoded=decode(serialize(r));assert.ok(decoded);
  combinations.add(CHAPTERS.filter(c=>c.variants===2).map(c=>journalArt(r,c)).join(','));
  for(const c of CHAPTERS){const art=journalArt(r,c);assert.equal(journalArt(decoded.run,c),art);assert.ok(existsSync(new URL('../public/art/'+art+'.webp',import.meta.url)));seen.get(c.wave).add(art);}
 }
 for(const c of CHAPTERS)assert.equal(seen.get(c.wave).size,c.variants);
 assert.ok(combinations.size>=12,'Replay illustrations should allow varied combinations across chapters');
});
test('Legacy saves gain an unread journal while retaining character identity and progress',()=>{
 const r=newRun('hexweaver','A & B');r.wave=16;r.level=53;delete r.journalRead;
 const old=JSON.stringify({version:7,updated:Date.now(),run:r});
 const save=decode(old);assert.ok(save);assert.equal(save.run.runId,r.runId);assert.equal(save.run.journalRead,0);assert.equal(save.run.name,'A & B');assert.equal(save.run.wave,16);assert.equal(journalUnread(save.run),3);
 save.run.journalRead=5;assert.equal(decode(serialize(save.run)).run.journalRead,5);save.run.journalRead=256;assert.equal(decode(serialize(save.run)),null);
});
test('Every chapter has all four distinct hero perspectives and the final record names the player',()=>{
 assert.deepEqual(CHAPTERS.map(c=>c.wave),[4,8,12,16,20,24,28,32]);
 for(const c of CHAPTERS){assert.equal(new Set(HERO_IDS.map(h=>journalVoice(h,c))).size,4);assert.ok(c.text.join(' ').length>150);}
 assert.ok(CHAPTERS.at(-1).text[0].includes('{name}'));
});
