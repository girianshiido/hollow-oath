import {HERO_IDS,GEAR_SLOTS,gearId,SPELL_IDS,spellCost} from '../src/content.ts';
import {Battle,newRun,stats,activeSeal,enemyAffinity,knownRank,buyGear,equipGear,buySpell,resumeWave,weaponRank,finishChapterIntro,chapterCounter,finishInterlude,needsSupportChoice,chooseSupport,actionSpellCost} from '../src/engine.ts';
import {decode,serialize} from '../src/saves.ts';
import {resolveRoad} from '../src/journey.ts';
for(const support of (process.argv.includes('--all-powers')?['aegis','haste','surge','fury']:['aegis']))for(const hero of HERO_IDS){
 let seed=20261107+HERO_IDS.indexOf(hero);
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const r=newRun(hero),b=new Battle(r,()=>{},random);let elapsed=0,guard=0,maxWave=1, encounterTime=0, encounterKey="";
 while(r.phase!=='victory'&&elapsed<180000&&r.deaths<1000){
  if(r.interlude!==null)finishInterlude(r);
  if(needsSupportChoice(r))chooseSupport(r,support);
  if(r.chapterIntro)finishChapterIntro(r);
  if(r.journey.pending!==null){const choice=process.argv.includes('--road-choices')?guard%3:2;if(!resolveRoad(r,choice))resolveRoad(r,2);}
  if(r.phase==='fallen'){
   // Recovery camp purchases the highest affordable gear and learned ranks.
   for(const slot of GEAR_SLOTS){for(let tier=r.wave;tier>=1;tier--){const gear={slot,tier,relic:false};if(buyGear(r,gear)){equipGear(r,gear,slot);break;} const old=r.inventory.find(g=>gearId(g)===gearId(gear));if(old){equipGear(r,old,slot);break;}}}
   for(const id of ['mend',...(r.support?[r.support]:[]),'ember','rime','storm'])while(buySpell(r,id)){}
   resumeWave(r);b.refresh();
  }
  const key=r.wave+':'+r.step+':'+r.deaths;
  if(key!==encounterKey){encounterKey=key;encounterTime=0;}
  encounterTime+=.1;
  if(r.phase==='fight'){
   const seal=activeSeal(r,b.foe),weak=enemyAffinity(r,b.foe)?.weak;
   const counter=chapterCounter(r,b.foe);
   let action=seal??(r.hp<stats(r).hp*.6&&(!counter||r.castWait>1.4)?'mend':counter??(r.support&&r.ward===0&&!r.empower&&b.foe.boss?r.support:weak??'steel'));
   // Stop spending healing MP on a losing equipment mismatch; fall and re-equip.
   if(encounterTime>35&&weaponRank(r)<r.wave)action='steel';
   if(action!=='steel'&&knownRank(r,action)&&r.mp>=actionSpellCost(r,action)){r.spell=action;r.mode='magic'}else r.mode='steel';
  }
  b.tick(.1);elapsed+=.1;
  if(++guard%1000===0&&!decode(serialize(r)))throw Error(hero+' invalid save '+JSON.stringify({wave:r.wave,step:r.step,intent:r.intent,castWait:r.castWait,hp:r.hp,broken:r.broken}));
  maxWave=Math.max(maxWave,r.wave);
 }
 console.log(JSON.stringify({hero,support,phase:r.phase,wave:r.wave,level:r.level,deaths:r.deaths,minutes:Math.round(elapsed/60),kills:r.kills,spellRanks:r.spellRanks}));
 if(r.phase!=='victory')process.exitCode=1;
}
