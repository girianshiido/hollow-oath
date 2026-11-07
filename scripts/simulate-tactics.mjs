import {HERO_IDS,GEAR_SLOTS,gearId,SPELL_IDS,spellCost} from '../src/content.ts';
import {Battle,newRun,stats,activeSeal,enemyAffinity,knownRank,buyGear,equipGear,buySpell,resumeWave} from '../src/engine.ts';
import {decode,serialize} from '../src/saves.ts';
for(const hero of HERO_IDS){
 const r=newRun(hero),b=new Battle(r,()=>{},()=>.5);let elapsed=0,guard=0,maxWave=1;
 while(r.phase!=='victory'&&elapsed<180000&&r.deaths<1000){
  if(r.phase==='fallen'){
   // Recovery camp purchases the highest affordable gear and learned ranks.
   for(const slot of GEAR_SLOTS){for(let tier=r.wave;tier>=1;tier--){const gear={slot,tier,relic:false};if(buyGear(r,gear)){equipGear(r,gear,slot);break;} const old=r.inventory.find(g=>gearId(g)===gearId(gear));if(old){equipGear(r,old,slot);break;}}}
   for(const id of ['mend','aegis','ember','rime','storm'])while(buySpell(r,id)){}
   resumeWave(r);b.refresh();
  }
  if(r.phase==='fight'){
   const seal=activeSeal(r,b.foe),weak=enemyAffinity(r,b.foe)?.weak;
   let action=seal??(r.hp<stats(r).hp*.6?'mend':r.intent&&r.ward===0&&b.foe.boss?'aegis':weak??'steel');
   if(action!=='steel'&&knownRank(r,action)&&r.mp>=spellCost(action,knownRank(r,action))){r.spell=action;r.mode='magic'}else r.mode='steel';
  }
  b.tick(.1);elapsed+=.1;
  if(++guard%1000===0&&!decode(serialize(r)))throw Error(hero+' invalid save '+JSON.stringify({wave:r.wave,step:r.step,intent:r.intent,castWait:r.castWait,hp:r.hp,broken:r.broken}));
  maxWave=Math.max(maxWave,r.wave);
 }
 console.log(JSON.stringify({hero,phase:r.phase,wave:r.wave,level:r.level,deaths:r.deaths,minutes:Math.round(elapsed/60),kills:r.kills,spellRanks:r.spellRanks}));
 if(r.phase!=='victory')process.exitCode=1;
}
