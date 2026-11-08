// Fixed, current-rank equipment and comparable levels; no menus or reaction delay.
import {HERO_IDS,GEAR_SLOTS,gearId,encounter,spellUpgradeCost,spellCost} from '../src/content.ts';
import {Battle,newRun,stats,activeSeal,enemyAffinity,chapterCounter,knownRank} from '../src/engine.ts';
import {decode,serialize} from '../src/saves.ts';
export function chapterTrial(hero,wave,policy='tactical') {
 const r=newRun(hero);Object.assign(r,{wave,step:32,level:Math.round(wave*2.6+7),wait:0,chapterIntro:false});
 r.inventory=GEAR_SLOTS.map(slot=>({slot,tier:wave,relic:false}));r.equipped=Object.fromEntries(r.inventory.map(g=>[g.slot,gearId(g)]));r.chronicle.gearFreeAttempt=false;
 // Evenly spend the first-clear Essence budget; this is a fixture, not a wave gate.
 let rank=1,budget=Math.floor((wave*6-5)/5);while(rank<10&&budget>=spellUpgradeCost(rank)){budget-=spellUpgradeCost(rank);rank++;}
 r.spellRanks=Object.fromEntries(['ember','mend','rime','storm','aegis'].map(id=>[id,rank]));
 r.hp=stats(r).hp;r.mp=stats(r).mp;r.foeHp=encounter(wave,32).hp;
 let interrupted=0,incoming=0,changes=0,t=0;
 const b=new Battle(r,e=>{if(e.type==='interrupt')interrupted++;if(e.type==='hurt')incoming++;if(e.type==='chapter-phase')changes++;},()=>.5);
 while(r.phase==='fight'&&t<360) {
  const counter=chapterCounter(r,b.foe),seal=activeSeal(r,b.foe);
  let action=policy==='steel'?'steel':seal??(r.hp<b.player.hp*.6&&(!counter||r.castWait>1.4)?'mend':counter??enemyAffinity(r,b.foe)?.weak??'steel');
  if(action!=='steel' && knownRank(r,action) && r.mp>=spellCost(action,knownRank(r,action))){r.mode='magic';r.spell=action;}else r.mode='steel';
  b.tick(.05);t+=.05;
 }
 if(!decode(serialize(r)))throw Error('Invalid chapter trial save '+hero+' '+wave);
 return {hero,wave,policy,phase:r.phase,seconds:Math.round(t*10)/10,interrupted,incoming,changes,hp:Math.round(r.hp),foePercent:Math.round(r.foeHp/b.foe.hp*100)};
}
if(process.argv[1]?.endsWith('benchmark-chapters.mjs'))for(const hero of HERO_IDS)for(let wave=4;wave<=32;wave+=4)console.log(JSON.stringify(chapterTrial(hero,wave)));
