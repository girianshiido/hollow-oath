// Isolated ordinary encounters: fixed hero level, fresh HP/MP, no healing.
// Gear tiers and steel policy are explicit so before/after results stay comparable.
import {HERO_IDS, GEAR_SLOTS, gearId, encounter} from '../src/content.ts';
import {Battle, newRun, stats, activeSeal, knownRank, preparedSpellCost} from '../src/engine.ts';
export function benchmark(hero, level, wave, gearTier=0) {
 const result={hero,level,wave,gearTier,foes:31,killed:0,acted:0,casters:0,castersActed:0,oneHit:0,twoHits:0,playerHits:0,enemyHits:0,damage:0,seconds:0};
 for(let step=1;step<32;step++){
  const r=newRun(hero);Object.assign(r,{level,wave,step,foeHp:encounter(wave,step).hp,wait:0});
  if(gearTier){r.chronicle.gearFreeAttempt=false;r.inventory=GEAR_SLOTS.map(slot=>({slot,tier:gearTier,relic:false}));r.equipped=Object.fromEntries(r.inventory.map(g=>[g.slot,gearId(g)]));}
  r.hp=stats(r).hp;r.mp=stats(r).mp;
  let playerHits=0,enemyHits=0,damage=0,seconds=0;
  const b=new Battle(r,e=>{if(e.type==='hit'&&e.damage>0)playerHits++;if(e.type==='hurt'){enemyHits++;damage+=e.damage;}},()=>.5);
  const caster=b.foe.moves[0]!=='steel';
  while(r.phase==='fight'&&r.foeHp>0&&seconds<120){
   const seal=activeSeal(r,b.foe);
   if(seal&&seal!=='steel'&&knownRank(r,seal)){r.spell=seal;r.mode=r.mp>=preparedSpellCost(r)?'magic':'steel';}else r.mode='steel';
   b.tick(.025);seconds+=.025;
  }
  result.killed+=Number(r.foeHp===0);result.acted+=Number(enemyHits>0);result.casters+=Number(caster);result.castersActed+=Number(caster&&enemyHits>0);result.oneHit+=Number(playerHits===1&&r.foeHp===0);result.twoHits+=Number(playerHits<=2&&r.foeHp===0);result.playerHits+=playerHits;result.enemyHits+=enemyHits;result.damage+=damage;result.seconds+=seconds;
 }
 return result;
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 for(const [level,wave,gearTier] of [[1,1,0],[7,1,0],[7,1,1],[53,12,0],[53,12,6],[53,12,12]]){
  for(const hero of HERO_IDS)console.log(JSON.stringify(benchmark(hero,level,wave,gearTier)));
 }
}
