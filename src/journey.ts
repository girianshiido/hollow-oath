import {gearPrice} from './content.ts';
import type {Run} from './engine.ts';

export const ROAD_WAVES = [2,4,7,9,12,14,17,19,22,24,27,30] as const;
export type Boon = 'steel' | 'magic' | 'guard' | 'haste';
export interface Journey {
  since: number;
  choices: {slot: number; option: number}[];
  pending: number | null;
  boon: {kind: Boon; left: number} | null;
}
interface Choice {label: string; result: string; boon?: Boon; cost?: 'gold'|'hp'|'mp'; gold?: number; promise?: boolean}
interface Scene {id: string; title: string; art: string; text: string; choices: readonly Choice[]}
const leave: Choice = {label:'Continue on your way',result:'You leave the place undisturbed. The road ahead is waiting.'};
export const ROAD_SCENES: readonly Scene[] = [
  {id:'pilgrim',title:'A Name at the Wayside',art:'prisoner',text:'A pilgrim sits beside a broken cage, too weak to loosen its last chain. She offers you a silver button. “For someone who still remembers how to open a door.”',choices:[{label:'Free her and leave travelling money',cost:'gold',promise:true,result:'You break the chain and refuse the button. She promises that your kindness will find its way back to you.'},{label:'Carry her pack to the next shelter',cost:'hp',boon:'guard',result:'The burden strains you, but the pilgrim ties a protective thread around your wrist before you part.'},leave]},
  {id:'shrine',title:'The Cracked Bowl',art:'shrine',text:'The bowl beneath the silver tree is dry. Its carved hands face the road, as if still waiting to shelter a traveller. A spark moves beneath the stone.',choices:[{label:'Give the shrine a little of your strength',cost:'hp',boon:'steel',result:'The stone warms beneath your palm. A narrow gold line follows the edge of your weapon.'},{label:'Feed the spark with your mana',cost:'mp',boon:'magic',result:'The spark rises and settles among your fingers. For a while, your spells will carry its light.'},leave]},
  {id:'fare',title:'The Ferryman’s Fare',art:'ferry',text:'A ferryman holds his boat against the landing. “The dead cross free. The living must still make a choice.” A sealed purse rests beneath his lamp.',choices:[{label:'Pay for his blessing of safe passage',cost:'gold',boon:'haste',result:'He shows you where the old road runs beneath the water. Your next steps feel unexpectedly light.'},{label:'Recover the purse from the cold water',cost:'hp',gold:2,result:'The current tears at you. You return the purse; its owner insists that you keep a share.'},leave]},
  {id:'edge',title:'An Edge in the Dark',art:'forge',text:'A lone armorer still tends the coals beneath a fallen arch. He studies your weapon, then your tired hands. “I can lend you an edge. Nothing here stays sharp forever.”',choices:[{label:'Pay for a temporary edge',cost:'gold',boon:'steel',result:'He draws the blade across a luminous stone. Its edge will hold for a little longer.'},{label:'Work the bellows in exchange for a ward',cost:'hp',boon:'guard',result:'You work until your arms tremble. In return, he fastens a small ward to your coat.'},leave]},
  {id:'map',title:'The Unfinished Map',art:'mirror',text:'A map lies open beneath a cracked mirror. Its ink traces roads that have vanished beneath the eclipse. A loose page carries the mark of a caravan still trying to reach home.',choices:[{label:'Spend mana to restore the caravan’s route',cost:'mp',promise:true,result:'The road reappears in silver ink. You leave the map where its owners will find it.'},{label:'Memorize the paths that still remain',boon:'haste',result:'You follow the map with a finger until its turns settle in your memory.'},leave]},
  {id:'seed',title:'The Last Gardener',art:'garden',text:'An old gardener cups a pale seed in both hands. “The flowers remember sunlight. I am trying to remember what we owe them.” A small bed of luminous leaves waits beside him.',choices:[{label:'Help tend the stubborn roots',cost:'hp',boon:'guard',result:'You clear the rubble by hand. A pale leaf clings to your sleeve, warm against the cold.'},{label:'Give him money for the surviving gardens',cost:'gold',promise:true,result:'He takes only what he needs. “Someone will be glad to hear there are still people helping.”'},leave]},
  {id:'letters',title:'Letters Without an Address',art:'prisoner',text:'A courier shelters beside an abandoned cage. Her satchel is full of letters addressed to streets that no longer exist. She asks whether a name can survive without a home.',choices:[{label:'Help her search for the families',cost:'hp',promise:true,result:'You find a door bearing one of the names. The courier promises to carry word of your help along her route.'},{label:'Copy the names into your own record',boon:'magic',result:'As you speak the names, a quiet resonance gathers around your hands.'},leave]},
  {id:'vigil',title:'A Candle Kept Alight',art:'shrine',text:'A single candle burns at the roadside shrine. Beside it, a note asks the next traveller to keep the light alive until its keeper returns.',choices:[{label:'Leave gold for the keeper’s return',cost:'gold',promise:true,result:'You weight the note with your offering. Somewhere along this road, another traveller will find a reason to continue.'},{label:'Kindle a second flame with mana',cost:'mp',boon:'magic',result:'Two flames now stand against the wind. One small reflection follows you into the dark.'},leave]},
  {id:'cargo',title:'Cargo for the Living',art:'ferry',text:'The ferryman has lashed a chest of tools to his boat. “A village on the other bank is rebuilding. The rope will not hold unless someone helps me.”',choices:[{label:'Haul the chest onto the landing',cost:'hp',promise:true,result:'Together you drag the tools ashore. He promises to tell the village whose hands brought them home.'},{label:'Trade gold for a charm against the current',cost:'gold',boon:'guard',result:'He knots a length of old sailcloth around your wrist. “Stand firm. Let the dark pass around you.”'},leave]},
  {id:'bellows',title:'The Armorer’s Apprentice',art:'forge',text:'An apprentice is keeping the forge alive while her master sleeps. She has managed to awaken its rune, but cannot decide whether to temper it for steel or sorcery.',choices:[{label:'Feed the steel rune with mana',cost:'mp',boon:'steel',result:'You guide the light into the steel channel. The apprentice lends your weapon the first clean edge she has made.'},{label:'Pay for a sorcerous temper',cost:'gold',boon:'magic',result:'She works slowly and carefully. The finished rune shines in time with your breathing.'},leave]},
  {id:'reflection',title:'A Reflection Out of Step',art:'mirror',text:'Your reflection moves a heartbeat before you do. It raises an open hand toward a constellation etched in the broken glass. Beyond it lies a passage that has not yet collapsed.',choices:[{label:'Follow the reflection through the narrow passage',cost:'hp',boon:'haste',result:'Stone scrapes your shoulders. You emerge with the rhythm of that strange reflection still guiding your steps.'},{label:'Read the constellation with your mana',cost:'mp',boon:'magic',result:'The stars resolve into a brief, precise spell. Its cadence remains with you.'},leave]},
  {id:'birds',title:'The Birds of the Cloister',art:'garden',text:'Small birds crowd an empty stone hand. A ribbon on the statue bears a message: “They return every year. There must still be somewhere worth returning to.”',choices:[{label:'Leave money for the cloister’s keeper',cost:'gold',promise:true,result:'You tuck the coins beneath the ribbon. A keeper watching from an upper window lifts a hand in thanks.'},{label:'Listen until the birds take flight',boon:'haste',result:'For a moment, you breathe in time with the garden. Your feet remember a lighter road.'},leave]},
  {id:'witness',title:'The Witness at the Gate',art:'prisoner',text:'A survivor carries a list of names toward the royal road. “They must reach someone who will listen.” The old gate is barred, but a narrow way remains.',choices:[{label:'Open the narrow way for the witness',cost:'hp',promise:true,result:'You lift the broken bar until the witness passes. Before leaving, they promise that your help will be remembered.'},{label:'Lend mana to protect the written names',cost:'mp',boon:'guard',result:'The names settle beneath a thin ward. A little of its shelter stays with you.'},leave]},
  {id:'hands',title:'The Shrine’s Open Hands',art:'shrine',text:'Someone has cleaned the stone hands and restored a few of the erased names. The bowl holds an unfinished prayer, its final line waiting for a living voice.',choices:[{label:'Speak the names and offer your strength',cost:'hp',boon:'steel',result:'The hands turn warm beneath yours. You rise with a steadier grip on your weapon.'},{label:'Carry the prayer in a thread of mana',cost:'mp',boon:'guard',result:'You carry the prayer without completing it for its author. Its patient light settles around you.'},leave]},
  {id:'homeward',title:'The Homeward Crossing',art:'ferry',text:'The ferryman is preparing his last crossing before the royal stair. A family waits on the far bank. “They have been safe for years. Someone should tell the people still keeping watch.”',choices:[{label:'Pay the family’s passage',cost:'gold',promise:true,result:'He pushes away from the landing. “When they ask who helped us, I will have an answer.”'},{label:'Help pull the boat against the current',cost:'hp',boon:'haste',result:'The rope burns your palms, but the boat clears the shallows. You learn where the current gives way.'},leave]},
  {id:'keepsake',title:'The Unclaimed Keepsake',art:'forge',text:'The armorer unwraps a small badge from an earlier watch. “Nobody came to claim it. Perhaps its next purpose can be chosen freely.” He offers to lend you its final warmth.',choices:[{label:'Pay to wake its protective mark',cost:'gold',boon:'guard',result:'The badge glows once, then rests quiet against your coat. Its warmth will stand beside you for a while.'},{label:'Wake its edge with your mana',cost:'mp',boon:'steel',result:'The old badge lends its light to your weapon, asking for no oath in return.'},leave]},
  {id:'unwritten',title:'The Unwritten Constellation',art:'mirror',text:'The mirror holds a patch of sky with no stars. Someone has scratched a question into its frame: “What will you do when there is nothing left to hold in place?”',choices:[{label:'Sketch a new constellation with mana',cost:'mp',boon:'magic',result:'The stars you draw belong to no royal seal. Their unfamiliar pattern follows your next spells.'},{label:'Search beneath the abandoned desk',cost:'hp',gold:2,result:'You move the fallen stone and find an unclaimed traveller’s purse. Beside it lies a map leading away from the throne.'},leave]},
  {id:'tomorrow',title:'A Garden for Tomorrow',art:'garden',text:'Someone has cleared a patch of earth for ordinary flowers. No wards, no rites, no royal emblem. Just an empty bed, prepared in the hope that tomorrow will come.',choices:[{label:'Leave money for the first planting',cost:'gold',promise:true,result:'You leave the coins beside the waiting seeds. The gardener promises to send word down the road.'},{label:'Clear the last stones from the bed',cost:'hp',boon:'guard',result:'You work until the soil can breathe. The quiet certainty of that small task stays with you.'},leave]}
];

export const BOON_TEXT: Record<Boon,string> = {steel:'+15% steel damage',magic:'+15% spell damage',guard:'−12% incoming damage',haste:'+12% attack speed'};
export function newJourney(since=0): Journey {return {since,choices:[],pending:null,boon:null};}
function seed(text: string): number {let x=2166136261;for(const c of text)x=Math.imul(x^c.charCodeAt(0),16777619);x=Math.imul(x^(x>>>16),0x85ebca6b);return (x^(x>>>13))>>>0;}
export function roadPosition(run: Run, slot: number): number {return (ROAD_WAVES[slot]!-1)*32+10+seed(run.runId+':road:'+slot)%14;}
export function roadScene(run: Run, slot: number): Scene {
  const act=Math.floor(slot/4);
  const pool=ROAD_SCENES.slice(act*6,act*6+6).sort((a,b)=>seed(run.runId+a.id)-seed(run.runId+b.id)||a.id.localeCompare(b.id));
  const scene=pool[slot%4]!;
  // The last encounter pays kindness forward immediately; no promise can outlive the campaign.
  return slot===11?{...scene,choices:scene.choices.map(c=>c.promise?{...c,promise:false,gold:3,result:'Before you part, another traveller recognizes the help you have given. They insist on sharing their gold. You will carry this kindness beyond the royal stair.'}:c)}:scene;
}
export function roadFee(slot: number): number {return Math.max(10,Math.round(gearPrice({slot:'weapon',tier:ROAD_WAVES[slot]!,relic:false})*.18));}
export function roadDetail(slot: number, option: Choice): string {
  return [option.cost==='gold'?`Costs ${roadFee(slot)} gold`:option.cost==='hp'?'Costs 12% of current HP (never lethal)':option.cost==='mp'?'Costs 35% of current MP':'No cost',option.gold?`Gain ${roadFee(slot)*option.gold} gold`:'',option.boon?BOON_TEXT[option.boon]+' for the next 8 victories; replaces an existing road blessing':'',option.promise?`Receive ${roadFee(slot)*3} gold at your next roadside encounter`:''].filter(Boolean).join(' · ');
}
export function roadArrival(run: Run, slot: number): {gold:number;text:string} | null {
  const prior=run.journey.choices.filter(c=>c.slot<slot).at(-1);
  if(!prior || !roadScene(run,prior.slot).choices[prior.option]?.promise)return null;
  return {gold:roadFee(prior.slot)*3,text:`A messenger has found you. Your help at “${roadScene(run,prior.slot).title}” has reached people farther down the road. They send ${roadFee(prior.slot)*3} gold in thanks.`};
}
export function offerRoad(run: Run): void {
  if(run.phase!=='fight' || run.foeHp!==0 || run.wait<=0)return;
  const position=(run.wave-1)*32+run.step;
  if(position<=run.journey.since || run.journey.pending!==null)return;
  const slot=ROAD_WAVES.findIndex((_,i)=>roadPosition(run,i)===position);
  if(slot>=0 && !run.journey.choices.some(c=>c.slot===slot))run.journey.pending=slot;
}
export function resolveRoad(run: Run, option: number): boolean {
  const slot=run.journey.pending;
  if(slot===null || !Number.isInteger(slot) || slot<0 || slot>11 || !Number.isInteger(option) || run.phase!=='fight' || run.foeHp!==0 || roadPosition(run,slot)!==(run.wave-1)*32+run.step)return false;
  const choice=roadScene(run,slot).choices[option];
  if(!choice || run.journey.choices.some(c=>c.slot===slot))return false;
  const arrival=roadArrival(run,slot);
  if(choice.cost==='gold' && run.gold+(arrival?.gold??0)<roadFee(slot))return false;
  if(choice.cost==='gold')run.gold-=roadFee(slot);
  if(choice.cost==='hp')run.hp=Math.max(1,run.hp-Math.round(run.hp*.12));
  if(choice.cost==='mp')run.mp*=.65;
  run.gold=Math.min(Number.MAX_SAFE_INTEGER,run.gold+(choice.gold??0)*roadFee(slot)+(arrival?.gold??0));
  if(choice.boon)run.journey.boon={kind:choice.boon,left:8};
  run.journey.choices.push({slot,option});
  run.journey.pending=null;
  return true;
}
export function validJourney(run: Run): boolean {
  const j=run.journey;
  if(!j || !Number.isInteger(j.since) || j.since<0 || j.since>1024 || !Array.isArray(j.choices) || j.choices.length>12)return false;
  let previous=-1;
  for(const c of j.choices){
    if(!c || !Number.isInteger(c.slot) || c.slot<=previous || c.slot>11 || !Number.isInteger(c.option) || c.option<0 || c.option>2 || roadPosition(run,c.slot)<=j.since || ROAD_WAVES[c.slot]!>run.wave)return false;
    previous=c.slot;
  }
  if(j.pending!==null && (!Number.isInteger(j.pending) || j.pending<0 || j.pending>11 || j.pending<=previous || roadPosition(run,j.pending)<=j.since || roadPosition(run,j.pending)!==(run.wave-1)*32+run.step || run.phase!=='fight' || run.foeHp!==0 || run.wait<=0))return false;
  return j.boon===null || (!!j.boon && Object.hasOwn(BOON_TEXT,j.boon.kind) && Number.isInteger(j.boon.left) && j.boon.left>=1 && j.boon.left<=8);
}
