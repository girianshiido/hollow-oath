import {Battle,newRun,stats,type BattleEvent,type Run} from './engine.ts';
import {encounter,SPELL_IDS,SPELLS,spellCost,type SpellId} from './content.ts';
import {Effects,strikeColor} from './graphics.ts';
import {icon} from './icons.ts';
import {playSound,setMusic,stopSounds,unlockAudio} from './audio.ts';
import {MonsterPoses,PIKEMAN_FRAMES,type MonsterPose} from './sprite-poses.ts';

/** A disposable visual rehearsal. It never calls save, profile or achievement APIs. */
export async function mountSpriteTest(app:HTMLDivElement):Promise<void> {
  const embedded=(globalThis as typeof globalThis & {HOLLOW_ART?:Record<string,string>}).HOLLOW_ART;
  const art=(name:string)=>embedded?.[name]??new URL('art/'+name+'.webp',document.baseURI).href;
  const get=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  document.title='Hollow Oath · Sprite rehearsal';
  app.innerHTML=`<main class="frame arena sprite-test" tabindex="-1">
    <div class="world" style="--arena-art:url(&quot;${art('arena-0')}&quot;);--sky:0" aria-hidden="true"></div>
    <header class="battle-head"><button class="round" data-test="exit" aria-label="Return to title">${icon('back')}</button><div class="wave-title"><span class="kicker">SPRITE REHEARSAL · <span id="test-count">01 / 32</span></span><strong>Three-pose test</strong></div><button class="round" data-test="settings" aria-label="Test options">${icon('dots')}</button></header>
    <section class="vitals" aria-label="Test character"><div class="identity"><span>Vanguard · LV 12</span><span>No saves or rewards</span></div><div class="meter-row"><span>HP</span><div class="meter hp"><i id="test-hp-fill"></i></div><b id="test-hp"></b></div><div class="meter-row"><span>MP</span><div class="meter mp"><i id="test-mp-fill"></i></div><b id="test-mp"></b></div></section>
    <section class="enemy-header"><span class="kicker">VISUAL TEST · NO BOSS</span><h1>Crypt Pikeman</h1><div class="enemy-meter meter"><i id="test-foe-fill"></i></div><p id="test-pose" class="test-pose" role="status">Loading three poses…</p></section>
    <div class="battle-art" id="test-art"><div class="ground" aria-hidden="true"></div><div class="enemy-figure test-figure" id="test-figure"><div class="pose-frame" id="test-pose-frame"><img id="test-monster" class="enemy-image" alt="Crypt Pikeman" src="${art('foe-2')}" draggable="false"></div></div><canvas id="test-fx" aria-hidden="true"></canvas><div id="test-numbers" aria-hidden="true"></div></div>
    <footer class="battle-foot"><div class="tally"><span id="test-step">01</span><div id="test-pips" aria-hidden="true"></div><span>32</span></div><p class="combat-line" id="test-line">The same monster repeats. HP and MP reset between fights.</p><div class="combat-controls" role="group" aria-label="Test actions"><button class="combat-button" data-test="action" data-spell="steel" aria-label="Steel" style="--spell:#eac180">${icon('steel')}<small>ATK</small></button>${SPELL_IDS.filter(id=>!['aegis','haste','surge','fury'].includes(id)).map(id=>`<button class="combat-button" data-test="action" data-spell="${id}" aria-label="${SPELLS[id].name}" style="--spell:${SPELLS[id].color}">${icon(id==='aegis'?'shield':id)}<small>${spellCost(id,1)} MP</small></button>`).join('')}<button class="combat-button empty-power" disabled aria-label="Fifth spell unavailable in this rehearsal"></button></div></footer>
  </main><dialog class="sheet" id="test-dialog" aria-labelledby="test-heading"></dialog>`;
  app.querySelector<HTMLElement>('main')!.focus();
  setMusic('battle');
  const dialog=get<HTMLDialogElement>('test-dialog'),poses=new MonsterPoses();
  const image=get<HTMLImageElement>('test-monster'),figure=get('test-figure'),frame=get('test-pose-frame');
  const fx=new Effects(get<HTMLCanvasElement>('test-fx'),'vanguard');
  let ready=false,paused=false,three=true,slow=false,showEffects=true,manual:MonsterPose|null=null,complete=false;
  let count=1,delay=0,last=0,lastHud=0,displayed='',raf=0;
  let run:Run,battle:Battle;
  const pop=(text:string,color:string,position='')=>{const n=document.createElement('span');n.className='float '+position;n.style.color=color;n.textContent=text;get('test-numbers').append(n);setTimeout(()=>n.remove(),800);};
  const animate=(name:string)=>{if(three||reduced.matches)return;figure.classList.remove('hit','lunging');void figure.offsetWidth;figure.classList.add(name);};
  const event=(e:BattleEvent)=>{
    switch(e.type){
      case 'hit':if(e.damage>0){poses.trigger('hurt');animate('hit');}void playSound(e.strike);if(showEffects&&!reduced.matches)fx.add(e.strike);pop('−'+e.damage,strikeColor(e.strike));break;
      case 'hurt':poses.trigger('attack');animate('lunging');void playSound('hurt');if(showEffects&&!reduced.matches)fx.add('hurt');pop('−'+e.damage+' HP','#ff9584','incoming');break;
      case 'heal':void playSound('heal');if(showEffects&&!reduced.matches)fx.add('heal');pop('+'+e.amount+' HP','#9effc1','incoming');break;
      case 'ward':void playSound('heal');if(showEffects&&!reduced.matches)fx.add('ward');break;
      case 'empty':break;
      case 'kill':delay=.95;break;
      case 'fallen':delay=.95;break;
    }
  };
  function opponent(action:SpellId|'steel'='steel'):void {
    run=newRun('vanguard');run.level=12;run.wait=0;run.playerGauge=.5;run.enemyGauge=0;
    run.hp=stats(run).hp;run.mp=stats(run).mp;run.spellRanks.aegis=1;
    if(action!=='steel'){run.mode='magic';run.spell=action;}
    battle=new Battle(run,event,()=>.5);
    battle.foe={...encounter(1,2),name:'Crypt Pikeman',art:'foe-2',hp:210,atk:29,def:24,res:28,spd:.84,seals:[],affinity:undefined,moves:['steel'],boss:false,chapter:false,xp:0,gold:0,essence:0};
    run.foeHp=battle.foe.hp;poses.reset();displayed='';manual=null;
    figure.classList.remove('hit','lunging');get('test-numbers').replaceChildren();
    get('test-count').textContent=String(count).padStart(2,'0')+' / 32';get('test-step').textContent=String(count).padStart(2,'0');
    get('test-pips').innerHTML=Array.from({length:32},(_,i)=>`<i class="${i+1<count?'done':i+1===count?'now':''}"></i>`).join('');
  }
  function render():void {
    app.querySelector('.sprite-test')!.classList.toggle('test-paused',paused||dialog.open);
    const p=three?(manual??(run.foeHp===0&&delay>0?'hurt':poses.pose)):'idle',spec=PIKEMAN_FRAMES[p];
    if(displayed!==p){image.src=art(spec.art);image.style.setProperty('--pose-x',spec.x+'%');image.style.setProperty('--pose-y',spec.y+'%');image.dataset.pose=p;displayed=p;}
    frame.classList.toggle('three-poses',three);
    image.style.opacity=manual?'1':complete?'0':run.foeHp===0&&delay>0?String(Math.min(1,delay/.6)):'1';
    get('test-pose').textContent=!ready?'Loading three poses…':(paused?'Paused · ':'')+(three?(p==='idle'?'Standing':p==='attack'?'Attack · end of the swing':'Taking a hit'):'Original image · existing motion');
    get('test-hp').textContent=Math.ceil(run.hp)+' / '+battle.player.hp;get('test-mp').textContent=Math.floor(run.mp)+' / '+battle.player.mp;
    get('test-hp-fill').style.width=run.hp/battle.player.hp*100+'%';get('test-mp-fill').style.width=run.mp/battle.player.mp*100+'%';get('test-foe-fill').style.width=run.foeHp/battle.foe.hp*100+'%';
    get('test-line').textContent=complete?'Test wave complete. Open options to replay.':(slow?'Half speed · ':'')+'HP and MP reset between fights · '+(three?'3 images':'Original image');
    for(const b of app.querySelectorAll<HTMLButtonElement>('[data-spell]'))b.setAttribute('aria-pressed',String(b.dataset.spell==='steel'?run.mode==='steel':run.mode==='magic'&&run.spell===b.dataset.spell));
  }
  function settings():void {
    stopSounds();last=0;
    dialog.innerHTML=`<div class="sheet-inner"><header><div><p class="kicker">DISPOSABLE VISUAL TEST</p><h2 id="test-heading">Sprite rehearsal</h2></div><button class="round" data-test="close" aria-label="Close">${icon('close')}</button></header><div class="options-list"><button class="primary wide" data-test="close">Return to the test ${icon('next')}</button><button class="secondary wide" data-test="mode">${three?'Compare with original image':'Use three images'}</button><button class="secondary wide" data-test="pause">${paused?'Resume combat':'Pause combat'}</button><button class="secondary wide" data-test="speed">${slow?'Use normal speed':'Use half speed'}</button><label class="auto-equip"><input id="test-effects" type="checkbox" ${showEffects?'checked':''}> Weapon and spell effects</label><p class="sheet-foot">Inspect a still pose (pauses combat):</p><div class="test-stills">${(['idle','attack','hurt'] as const).map(p=>`<button class="compact" data-test="still" data-pose="${p}">${p==='idle'?'Standing':p==='attack'?'Attack':'Hit'}</button>`).join('')}</div><button class="secondary wide" data-test="restart">Restart the 32-monster wave</button><button class="text-action" data-test="exit">Return to title</button><p class="sheet-foot">No save, XP, gold, Essence or achievement progress is written. Your adventures are unaffected. Audio follows your game settings.</p></div></div>`;
    if(!dialog.open)dialog.showModal();
    dialog.scrollTop=0;
    render();
  }
  function close():void {dialog.close();last=0;render();}
  app.addEventListener('click',e=>{
    const button=(e.target as Element).closest<HTMLButtonElement>('button[data-test]');if(!button)return;
    void unlockAudio();
    switch(button.dataset.test){
      case 'exit':{const url=new URL(location.href);url.searchParams.delete('sprite-test');location.assign(url.href);break;}
      case 'settings':settings();break;
      case 'close':close();break;
      case 'mode':three=!three;displayed='';manual=null;poses.reset();figure.classList.remove('hit','lunging');render();settings();break;
      case 'pause':paused=!paused;manual=null;poses.reset();close();render();break;
      case 'speed':slow=!slow;close();render();break;
      case 'still':three=true;paused=true;manual=button.dataset.pose as MonsterPose;poses.reset();get('test-numbers').replaceChildren();fx.draw(performance.now()+2000);displayed='';close();render();break;
      case 'restart':count=1;delay=0;complete=false;paused=false;manual=null;poses.reset();opponent();close();render();break;
      case 'action':{if(!ready||complete)return;const id=button.dataset.spell!;run.mode=id==='steel'?'steel':'magic';if(id!=='steel')run.spell=id as SpellId;render();break;}
    }
  });
  app.addEventListener('change',e=>{if((e.target as HTMLElement).id==='test-effects')showEffects=(e.target as HTMLInputElement).checked;});
  dialog.addEventListener('close',()=>{last=0;render();});
  document.addEventListener('visibilitychange',()=>{last=0;});
  const fit=()=>{const box=figure.getBoundingClientRect(),w=Math.min(box.width,box.height*305/358);frame.style.width=w+'px';frame.style.height=w*358/305+'px';fx.resize();};
  const observer=new ResizeObserver(fit);observer.observe(figure);fit();opponent();render();
  try{await Promise.all(Object.values(PIKEMAN_FRAMES).map(async spec=>{const i=new Image();i.src=art(spec.art);await i.decode();}));ready=true;}
  catch{get('test-pose').textContent='Images could not load. Reload the page to retry.';return;}
  function tick(now:number):void {
    raf=requestAnimationFrame(tick);
    if(document.hidden||dialog.open||paused||complete){last=0;return;}
    const dt=last?Math.min(.15,(now-last)/1000)*(slow?.5:1):0;last=now;poses.tick(dt*1000);
    if(delay>0){delay-=dt;if(delay<=0){if(count===32){complete=true;settings();}else{count++;opponent(run.mode==='magic'?run.spell:'steel');}}}
    else battle.tick(dt);
    fx.draw(now);
    if(now-lastHud>=30){render();lastHud=now;}
  }
  raf=requestAnimationFrame(tick);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);observer.disconnect();fx.dispose();stopSounds();});
  window.addEventListener('pageshow',e=>{if(e.persisted&&ready){observer.observe(figure);last=0;raf=requestAnimationFrame(tick);}});
}
