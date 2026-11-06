import { audioSettings, backgroundAudio, configureAudio, playSound, stopSounds, unlockAudio } from './audio.ts';
import { offlineStatus, renderUpdates, updateGame } from './updates.ts';
import './style.css';
import {
  encounter, gearBonus, gearId, gearName, gearPrice, GEAR_NAMES, GEAR_SLOTS,
  HEROES, HERO_IDS, SEALS, SPELLS, SPELL_IDS, STAT_NAMES, WAVES, xpGoal,
  type Gear, type GearSlot, type HeroId, type SpellId, type Stats
} from './content.ts';
import { activeSeal, Battle, buyGear, CAMP_STARTS, canShop, equipGear, newRun, resumeWave, stats, type BattleEvent, type Run } from './engine.ts';
import { Effects, strikeColor } from './graphics.ts';
import { icon } from './icons.ts';
import { decode, readSlot, serialize, SLOT_COUNT, writeSlot, type Save } from './saves.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
const embeddedArt = (globalThis as typeof globalThis & {HOLLOW_ART?: Record<string, string>}).HOLLOW_ART;
const art = (name: string) => embeddedArt?.[name] ?? new URL('art/' + name + '.webp', document.baseURI).href;
const find = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const number = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1});
const fmt = (x: number) => number.format(x);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const slots = () => Array.from({length: SLOT_COUNT}, (_, index) => readSlot(index));
const symbol = (text: string) => '<span aria-hidden="true">' + text + '</span>';
let hero: HeroId = 'vanguard';
let slot = 0;
let screen = 'title';
let battle: Battle | undefined;
let effects: Effects | undefined;
let dialogKind = '';
let gearTab = 'stats';
let shopTier = 1;
const AUTO_EQUIP_KEY = 'hollow-oath.auto-equip';
let autoEquip = false;
try { autoEquip = localStorage.getItem(AUTO_EQUIP_KEY) === 'true'; }
catch { /* Use the default if storage is unavailable. */ }
let dialogOpener: HTMLElement | null = null;
let toastTimer = 0;
let longTimer = 0;
let suppressTap = false;
let bookPointer: {id: number; x: number; y: number} | undefined;
let saved = true;
let dirty = false;
let nextSave = 0;
let nextHud = 0;
let lastFrame = 0;
let displaySeal = '';
let displayPhase = '';
let rewardLine = '';
let paceHint = '';
const current = (): Run => battle!.run;

function mount(name: string, body: string): void {
  stopSounds();
  screen = name;
  effects?.dispose();
  effects = undefined;
  dialogKind = '';
  app.innerHTML = body + '<dialog id="sheet" class="sheet" aria-labelledby="sheet-title"></dialog><div id="toast" class="toast" role="status"></div>';
  const dialog = find<HTMLDialogElement>('sheet');
  dialog.addEventListener('close', () => {
    dialogKind = '';
    lastFrame = 0;
    if (dialogOpener?.isConnected) dialogOpener.focus({preventScroll: true});
    dialogOpener = null;
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      const {clientX: x, clientY: y} = event;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) dialog.close();
    }
  });
  app.querySelector<HTMLElement>('main')?.focus({preventScroll: true});
}

function title(): void {
  battle = undefined;
  mount('title', `<main class="frame title-screen" tabindex="-1">
    <div class="title-plate" aria-hidden="true" style="--cover:url(&quot;${art('title')}&quot;)"></div>
    <div class="folio"><span>AN ILLUSTRATED DARK FANTASY</span><i></i><span>VOL. I</span></div>
    <div class="title-center">
      <p class="title-kicker">THE CHRONICLE OF THE HOLLOW</p>
      <h1>HOLLOW<span>OATH</span></h1>
      <div class="title-rule" aria-hidden="true">${icon('mark')}</div>
      <p class="title-note">Break the seals. Outlive the dark.</p>
      <div class="title-actions">
        <button class="primary" data-action="new">New Game ${icon('next')}</button>
        <button class="secondary" data-action="load">Load Game ${symbol('◇')}</button>
      </div>
    </div>
    <div class="title-bottom"><button class="text-action" data-action="help">How to play</button><span>32 WAVES <b>◆</b> 4 OATHS</span></div>
  </main>`);
}

function heroScreen(): void {
  const h = HEROES[hero];
  mount('hero', `<main class="frame hero-screen" tabindex="-1" style="--hero:${h.color}">
    <header class="selection-head"><button class="round" data-action="title" aria-label="Back to title">${icon('back')}</button>
      <span>THE OATHBOUND</span><small>FILE 0${slot + 1}</small></header>
    <div class="hero-display">
      <figure class="hero-portrait"><img src="${art(hero)}" alt="Portrait of the ${h.name}"><span>${icon('mark')} OATH / 0${HERO_IDS.indexOf(hero) + 1}</span></figure>
      <div class="hero-info">
        <div class="hero-name"><span class="kicker">${h.role}</span><h1>${h.name}</h1><p>${h.text}</p></div>
        <div class="hero-metrics">${heroMetric('Steel', h.base.atk, 30)}${heroMetric('Sorcery', h.base.mag, 32)}${heroMetric('Speed', h.base.spd, 1.6)}</div>
      </div>
    </div>
    <nav class="hero-roster" aria-label="Classes">${HERO_IDS.map(id => `<button data-action="hero" data-id="${id}" aria-pressed="${id === hero}" style="--tint:${HEROES[id].color}">
      <img src="${art(id)}" alt=""><span>${HEROES[id].name}</span></button>`).join('')}</nav>
    <button class="primary oath-button" data-action="start">Swear the Oath ${icon('next')}</button>
  </main>`);
}

function heroMetric(label: string, value: number, max: number): string {
  return `<div><span>${label}</span><span class="metric"><i style="width:${value / max * 100}%"></i></span></div>`;
}
function slotLabel(data: Save | null): string {
  if (!data) return '<strong>Empty file</strong><small>Ready for a new oath</small>';
  const r = data.run;
  const where = r.phase === 'victory' ? 'Oath fulfilled' : 'Wave ' + r.wave + ' · Encounter ' + r.step;
  return `<strong>${HEROES[r.hero].name} <span>Lv. ${fmt(r.level)}</span></strong><small>${where}</small>`;
}
function slotScreen(kind: 'new' | 'load' | 'import', incoming?: Save): void {
  const heading = kind === 'new' ? 'Choose a file' : kind === 'load' ? 'Load Game' : 'Import an oath';
  const entries = slots();
  pendingImport = incoming;
  mount('slots', `<main class="frame record-screen" tabindex="-1">
    <header class="selection-head"><button class="round" data-action="title" aria-label="Back to title">${icon('back')}</button><span>HOLLOW OATH</span></header>
    <div class="record-body"><p class="kicker">THE ARCHIVE</p><h1>${heading}</h1>
    <p>${kind === 'import' ? 'Choose where to restore your backup.' : 'Your oaths are saved on this device.'}</p>
    <div class="slot-list">${entries.map((data, i) => `<button class="file-row" data-action="${kind}-slot" data-id="${i}" ${kind === 'load' && !data ? 'disabled' : ''}>
      <span class="file-number">0${i + 1}</span><span>${slotLabel(data)}</span>${icon('next')}</button>`).join('')}</div>
    ${kind === 'load' ? '<button class="text-action" data-action="import">Import a backup</button>' : ''}
    </div>
  </main>`);
}

function openDialog(kind: string, heading: string, body: string, kicker = 'HOLLOW OATH'): void {
  const dialog = find<HTMLDialogElement>('sheet');
  dialogKind = kind;
  dialog.innerHTML = `<div class="sheet-inner"><header><div><p class="kicker">${kicker}</p><h2 id="sheet-title">${heading}</h2></div>
    <button class="round" data-action="close" aria-label="Close">${icon('close')}</button></header>${body}</div>`;
  if (!dialog.open) {
    dialogOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stopSounds();
    dialog.showModal();
    if (battle) save();
  }
}
const close = () => find<HTMLDialogElement>('sheet').close();

function help(): void {
  openDialog('help', 'The field guide', `<div class="guide">
    <p><strong>Auto combat.</strong> Both sides strike independently. Twice the Speed means twice the attack rate. Steel tests Defense. Sorcery tests Magic Defense.</p>
    <p><strong>Sword and grimoire.</strong> Tap to switch. Hold the grimoire or tap its caret to choose a spell. On a keyboard, use <kbd>1</kbd> for steel, <kbd>2</kbd> for magic and <kbd>3</kbd> for the spell list. When mana runs low, steel takes over. Tap the grimoire again once you have enough MP.</p>
    <p><strong>Seals.</strong> Read the prompt above a protected foe. A seal ignores mismatched attacks even if you outlevel the enemy. Some bosses raise a new seal as their HP falls. Save your mana for the right strike.</p>
    <p><strong>Survive the wave.</strong> Each wave has 31 foes and a boss. HP carries between fights. Mend and level gains can restore HP. Falling returns you to the first encounter of the current wave with full HP and MP, and you keep XP, gold and gear.</p>
    <p><strong>The armory.</strong> Equip gear anytime in the left menu. The shop opens at encounters 9–10, 17–18 and 25–26, and after a defeat before you retry. Each wave opens a new gear rank. Some bosses drop relics. The next wave begins with full HP and MP.</p>
    ${screen === 'arena' ? '<button class="secondary wide" data-action="options">Back to options</button>' : ''}
  </div>`);
}

function startArena(run: Run): void {
  battle = new Battle(run, battleEvent);
  dirty = false;
  nextSave = nextHud = lastFrame = 0;
  displaySeal = displayPhase = '';
  rewardLine = '';
  paceHint = '';
  mount('arena', `<main class="frame arena" tabindex="-1">
    <div id="world" class="world" aria-hidden="true"></div>
    <header class="battle-head">
      <button class="round" id="armory-button" data-action="gear" aria-label="Equipment and shop" title="Equipment and shop">${icon('bag')}</button>
      <div class="wave-title"><span class="kicker" id="wave-index"></span><strong id="wave-name"></strong></div>
      <button class="round" data-action="options" aria-label="Options" title="Options">${icon('dots')}</button>
    </header>
    <section class="vitals" aria-label="Character status">
      <div class="identity"><span id="identity"></span><span class="coin">◆ <b id="gold"></b></span></div>
      <div class="meter-row"><span>HP</span><div class="meter hp"><i id="hp-fill"></i></div><b id="hp"></b></div>
      <div class="meter-row"><span>MP</span><div class="meter mp"><i id="mp-fill"></i></div><b id="mp"></b></div>
      <div class="xp-rule" id="xp" role="progressbar" aria-label="Level experience"><i id="xp-fill"></i></div>
    </section>
    <section class="enemy-header" aria-label="Enemy">
      <span id="enemy-kind" class="kicker"></span><h1 id="enemy-name"></h1>
      <div class="enemy-meter meter" id="enemy-meter" role="progressbar" aria-label="Enemy HP"><i id="enemy-fill"></i></div>
      <div id="seal" class="seal" role="status"></div>
    </section>
    <div class="battle-art" id="battle-art">
      <div class="sigil" aria-hidden="true">${icon('mark')}</div>
      <div class="ground" aria-hidden="true"></div>
      <div class="enemy-figure" id="figure"><img id="enemy" alt="" draggable="false"></div>
      <canvas id="fx" aria-hidden="true"></canvas><div id="numbers" aria-hidden="true"></div>
    </div>
    <footer class="battle-foot">
      <div class="tally"><span id="step"></span><div id="pips" aria-hidden="true"></div><span>32</span></div>
      <div class="combat-line" id="combat-line">Auto combat active</div>
      <div class="combat-controls">
        <button class="combat-button" data-action="steel" id="steel" aria-keyshortcuts="1">
          ${icon('steel')}<span><b>Sword</b><small>Physical</small></span></button>
        <div class="book-group">
          <button class="combat-button" data-action="magic" id="book" aria-keyshortcuts="2" aria-describedby="book-help">
            ${icon('book')}<span><b>Grimoire</b><small id="selected-spell"></small></span>
          </button>
          <button class="spell-caret" data-action="spells" aria-keyshortcuts="3" aria-label="Choose spell" title="Choose spell"><span aria-hidden="true">▴</span></button>
        </div>
      </div>
      <span class="sr-only" id="book-help">Hold or use Choose spell to open the spell list.</span>
    </footer>
    <div id="outcome" hidden></div>
  </main>`);
  effects = new Effects(find<HTMLCanvasElement>('fx'));
  bindBook();
  displayEncounter();
  updateHud();
  save();
}

function bindBook(): void {
  const book = find('book');
  book.addEventListener('contextmenu', event => event.preventDefault());
  book.addEventListener('pointerdown', event => {
    if (event.button !== 0 || book.hasAttribute('disabled')) return;
    clearTimeout(longTimer);
    suppressTap = false;
    bookPointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
    book.setPointerCapture(event.pointerId);
    longTimer = window.setTimeout(() => {
      suppressTap = true;
      showSpells();
    }, 440);
  });
  book.addEventListener('pointermove', event => {
    if (bookPointer?.id === event.pointerId && Math.hypot(event.clientX - bookPointer.x, event.clientY - bookPointer.y) > 12) {
      suppressTap = true;
      clearTimeout(longTimer);
    }
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    book.addEventListener(name, () => { clearTimeout(longTimer); bookPointer = undefined; });
  }
}
function displayEncounter(): void {
  const r = current(), foe = battle!.foe;
  const arenaIndex = [0, 1, 2, 0, 1, 2, 3, 3][Math.floor((r.wave - 1) / 4)]!;
  find('world').style.setProperty('--arena-art', `url("${art('arena-' + arenaIndex)}")`);
  find('world').style.setProperty('--sky', String(((r.wave - 1) % 4) * 17));
  find('wave-index').textContent = 'WAVE ' + String(r.wave).padStart(2, '0') + ' / 32';
  find('wave-name').textContent = WAVES[r.wave - 1]![0];
  find('step').textContent = String(r.step).padStart(2, '0');
  find('pips').innerHTML = Array.from({length: 32}, (_, i) => `<i class="${i + 1 < r.step ? 'done' : i + 1 === r.step ? 'now' : ''}"></i>`).join('');
  find('enemy-name').textContent = foe.name;
  find('enemy-kind').textContent = foe.boss ? 'WAVE GUARDIAN' : (foe.seals.length ? 'SEALED FOE' : foe.arcane ? 'ARCANE FOE' : 'ENCOUNTER');
  find('enemy-kind').classList.toggle('boss', foe.boss);
  const img = find<HTMLImageElement>('enemy');
  img.src = art(foe.art);
  img.alt = foe.name;
  img.style.setProperty('--hue', foe.hue + 'deg');
  img.className = 'enemy-image';
  const figure = find('figure');
  figure.className = 'enemy-figure ' + (r.foeHp === 0 ? 'slain' : 'entering');
  if (r.step < 32) new Image().src = art(encounter(r.wave, r.step + 1).art);
  displaySeal = '';
}

function meter(id: string, value: number, max: number): void {
  find(id + '-fill').style.width = Math.max(0, Math.min(100, value / max * 100)) + '%';
}
function updateHud(): void {
  if (screen !== 'arena' || !battle) return;
  const r = battle.run, s = battle.player, foe = battle.foe;
  find('identity').textContent = HEROES[r.hero].name + ' · LV ' + fmt(r.level);
  find('hp').textContent = fmt(Math.ceil(r.hp)) + ' / ' + fmt(s.hp);
  find('mp').textContent = fmt(Math.floor(r.mp + 1e-8)) + ' / ' + fmt(s.mp);
  find('gold').textContent = fmt(r.gold);
  meter('hp', r.hp, s.hp);
  meter('mp', r.mp, s.mp);
  meter('xp', r.xp, xpGoal(r.level));
  meter('enemy', r.foeHp, foe.hp);
  find('xp').setAttribute('aria-valuenow', String(r.xp));
  find('xp').setAttribute('aria-valuemax', String(xpGoal(r.level)));
  find('enemy-meter').setAttribute('aria-valuenow', String(r.foeHp));
  find('enemy-meter').setAttribute('aria-valuemax', String(foe.hp));
  find('steel').setAttribute('aria-pressed', String(r.mode === 'steel'));
  find('book').setAttribute('aria-pressed', String(r.mode === 'magic'));
  find('book').style.setProperty('--spell', SPELLS[r.spell].color);
  find('selected-spell').textContent = SPELLS[r.spell].name;
  const seal = r.phase === 'fight' ? activeSeal(r, foe) : undefined;
  const sealKey = seal ? seal + ':' + r.broken : '';
  if (sealKey !== displaySeal) {
    const el = find('seal');
    el.innerHTML = seal ? `${icon('shield')} <b>${SEALS[seal].name}</b><span>${SEALS[seal].hint}</span>` : '';
    if (seal) el.style.setProperty('--seal', SEALS[seal].color);
    displaySeal = sealKey;
  }
  if (displayPhase !== r.phase) {
    displayPhase = r.phase;
    outcome();
  }
  const atCamp = r.phase === 'fight' && canShop(r);
  find('armory-button').classList.toggle('camp-open', atCamp);
  find('combat-line').textContent = paceHint || (atCamp ? 'Camp nearby · Shop open' : rewardLine) || (r.mode === 'steel' ? 'Auto combat · Steel ready' : 'Auto combat · ' + SPELLS[r.spell].cost + ' MP per cast');
}
function outcome(): void {
  const r = current(), el = find('outcome');
  el.hidden = r.phase === 'fight' || r.phase === 'clear';
  el.className = 'outcome';
  if (el.hidden) { el.innerHTML = ''; return; }
  const lost = r.phase === 'fallen';
  el.innerHTML = `<div class="outcome-card" role="region" aria-label="Battle result">
    <div class="outcome-mark">${icon('mark')}</div>
    <p class="kicker">WAVE ${String(r.wave).padStart(2, '0')} / 32</p>
    <h2>${lost ? 'Oath Unbroken' : 'The Hollow Falls'}</h2>
    <p>${lost ? 'You fell at encounter ' + r.step + '. Your XP, gold and gear carry over.' :
      'All thirty-two waves are cleared. The oath is fulfilled.'}</p>
    <button class="primary" data-action="resume-wave">${lost ? 'Retry Wave' : 'Replay Final Wave'} ${icon('next')}</button>
    <button class="text-action" data-action="${lost ? 'visit-shop' : 'gear'}">${lost ? 'Visit Shop' : 'Open Armory'}</button>
    <button class="text-action exit-link" data-action="exit">Return to Title</button>
  </div>`;
  el.querySelector<HTMLElement>('.primary')?.focus({preventScroll: true});
}
function pop(text: string, color: string, position = ''): void {
  const node = document.createElement('span');
  node.className = 'float ' + position;
  node.textContent = text;
  node.style.color = color;
  find('numbers').append(node);
  window.setTimeout(() => node.remove(), 800);
}
function animate(name: string): void {
  if (reduced.matches) return;
  const figure = find('figure');
  figure.classList.remove('hit', 'lunging', 'slain', 'entering');
  void figure.offsetWidth;
  figure.classList.add(name);
}
function battleEvent(event: BattleEvent): void {
  dirty = true;
  switch (event.type) {
    case 'hit':
      void playSound(event.strike);
      if (!reduced.matches) effects?.add(event.strike);
      pop('−' + fmt(event.damage), strikeColor(event.strike));
      animate('hit');
      break;
    case 'hurt':
      void playSound('hurt');
      if (!reduced.matches) effects?.add('hurt');
      pop('−' + fmt(event.damage) + ' HP', event.arcane ? '#e6adff' : '#ff9584', 'incoming');
      animate('lunging');
      break;
    case 'seal':
      void playSound('seal');
      if (!reduced.matches) effects?.add('seal');
      pop('SEAL BROKEN', '#ffe2a8', 'seal-float');
      paceHint = '';
      break;
    case 'block': {
      void playSound('block');
      const seal = event.strike;
      paceHint = seal !== 'steel' && SPELLS[seal].level > current().level ?
        'Unlock ' + SPELLS[seal].name + ' at Lv. ' + SPELLS[seal].level : SEALS[seal].hint + ' to break the seal';
      pop('GUARDED', SEALS[seal].color, 'seal-float');
      break;
    }
    case 'heal':
      void playSound('heal');
      if (!reduced.matches) effects?.add('heal');
      pop('+' + fmt(event.amount) + ' HP', '#a4ffc0', 'incoming');
      break;
    case 'empty':
      paceHint = 'Low MP · Switched to steel';
      break;
    case 'level':
      void playSound('reward');
      toast('Level ' + fmt(event.level) + (event.spells.length ? ' · Learned ' + event.spells.map(id => SPELLS[id].name).join(', ') : ' · Stats increased'));
      break;
    case 'kill':
      animate('slain');
      paceHint = '';
      if (event.loot || battle?.foe.boss) void playSound('reward');
      if (event.loot) toast('Relic found · ' + gearName(event.loot));
      rewardLine = '+' + fmt(event.xp) + ' XP · +' + fmt(event.gold) + ' gold' + (event.loot ? ' · Relic: ' + gearName(event.loot) : '');
      if (current().phase === 'clear') toast('Guardian slain · ' + rewardLine);
      save();
      break;
    case 'enter':
      rewardLine = '';
      paceHint = '';
      displayEncounter();
      if (CAMP_STARTS.some(step => current().step === step)) toast('Camp nearby · Shop open in the Armory');
      save();
      break;
    case 'armed':
      if (!reduced.matches) effects?.add('seal');
      break;
    case 'fallen':
      void playSound('fallen');
      save();
      break;
  }
}
function showSpells(): void {
  if (!battle || current().phase !== 'fight') return;
  const r = current();
  openDialog('spells', 'The Grimoire', `<div class="sheet-caption"><span>${fmt(Math.floor(r.mp))} / ${fmt(battle.player.mp)} MP</span><span>CHOOSE A SPELL</span></div>
    <div class="spell-list">${SPELL_IDS.map(id => {
      const s = SPELLS[id], locked = s.level > r.level;
      return `<button class="spell-row" data-action="spell" data-id="${id}" ${locked ? 'disabled' : ''} style="--spell:${s.color}">
        <span class="spell-symbol">${icon(id)}</span><span><strong>${s.name}</strong><small>${s.text}</small></span>
        <span class="spell-cost">${locked ? icon('lock') + ' LV ' + s.level : s.cost + ' MP'}</span></button>`;
    }).join('')}</div><p class="sheet-foot">Choose a spell to prepare and switch to magic. Combat pauses while this book is open.</p>`, 'ARCANE ARTS');
}
function mode(value: 'steel' | 'magic'): void {
  if (!battle || current().phase !== 'fight') return;
  const r = current();
  if (value === 'magic' && r.mp + 1e-8 < SPELLS[r.spell].cost) {
    paceHint = 'Need ' + SPELLS[r.spell].cost + ' MP for ' + SPELLS[r.spell].name;
    r.mode = 'steel';
  } else {
    r.mode = value;
    paceHint = '';
  }
  save();
  updateHud();
}
function toast(message: string): void {
  const el = find('toast');
  el.textContent = message;
  el.classList.add('shown');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('shown'), 2700);
}

function save(): void {
  if (!battle) return;
  saved = writeSlot(slot, battle.run);
  dirty = false;
  nextSave = performance.now() + 2400;
}
function statText(key: keyof Stats, value: number): string {
  if (key === 'spd') return value.toFixed(2) + '/s';
  if (key === 'regen') return value.toFixed(2) + ' MP/s';
  return fmt(value);
}
function bonusText(gear: Gear): string {
  return Object.entries(gearBonus(gear)).map(([stat, n]) => {
    const key = stat as keyof Stats;
    return '+' + statText(key, n) + ' ' + STAT_NAMES[key];
  }).join(' · ');
}
function gearView(): void {
  const r = current(), s = stats(r);
  const shopOpen = canShop(r);
  if (gearTab === 'shop' && !shopOpen) gearTab = 'stats';
  const tabs = [['stats', 'Character'], ['equip', 'Equipment'], ['shop', 'Shop']];
  let body = '';
  if (gearTab === 'stats') {
    body = `<div class="character-strip"><img src="${art(r.hero)}" alt=""><span><strong>${HEROES[r.hero].name}</strong><small>Lv. ${fmt(r.level)} · ${fmt(r.xp)} / ${fmt(xpGoal(r.level))} XP</small></span></div>
      <dl class="stat-grid">${Object.entries(STAT_NAMES).map(([key, name]) => `<div><dt>${name}</dt><dd>${statText(key as keyof Stats, s[key as keyof Stats])}</dd></div>`).join('')}</dl>
      <p class="sheet-foot">${fmt(r.kills)} foes slain · ${fmt(r.deaths)} falls · ${fmt(r.inventory.length)} gear owned</p>`;
  } else if (gearTab === 'equip') {
    body = `<div class="gear-list">${GEAR_SLOTS.map(g => {
      const items = r.inventory.filter(item => item.slot === g).sort((a, b) => b.tier - a.tier || Number(b.relic) - Number(a.relic));
      const equipped = items.find(item => r.equipped[g] === gearId(item));
      return `<label class="gear-row"><span><strong>${GEAR_NAMES[g]}</strong><small>${equipped ? bonusText(equipped) : 'No bonuses equipped'}</small></span>
        <select data-equip="${g}" aria-label="${GEAR_NAMES[g]}"><option value="">Unequipped</option>${items.map(item => `<option value="${gearId(item)}" ${item === equipped ? 'selected' : ''}>${gearName(item)} · Rank ${item.tier}</option>`).join('')}</select></label>`;
    }).join('')}</div>`;
  } else {
    body = `<label class="auto-equip"><input type="checkbox" id="auto-equip" ${autoEquip ? 'checked' : ''}> Auto-equip purchases</label>
      <div class="sheet-caption"><label>GEAR RANK <select id="shop-rank">${Array.from({length: r.wave}, (_, i) => `<option ${shopTier === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label><span class="coin">◆ ${fmt(r.gold)} gold</span></div>
      <div class="gear-list">${GEAR_SLOTS.map(g => {
        const gear = {slot: g, tier: shopTier, relic: false};
        const owned = r.inventory.some(item => gearId(item) === gearId(gear));
        const price = gearPrice(gear);
        return `<div class="gear-row"><span><strong>${gearName(gear)}</strong><small>${bonusText(gear)}</small></span>
          <button class="compact" data-action="buy" data-id="${g}" ${owned || r.gold < price ? 'disabled' : ''} aria-label="${owned ? gearName(gear) + ' owned' : 'Buy ' + gearName(gear) + ' for ' + price + ' gold'}">${owned ? 'Owned' : '◆ ' + fmt(price)}</button></div>`;
      }).join('')}</div><p class="sheet-foot">Every purchase is added to your collection.</p>`;
  }
  openDialog('gear', 'The Armory', `<div class="gear-tabs" role="group" aria-label="Armory pages">${tabs.map(([id, name]) =>
    `<button data-action="gear-tab" data-id="${id}" aria-pressed="${gearTab === id}" ${id === 'shop' && !shopOpen ? 'disabled' : ''}>${name}</button>`).join('')}</div>${shopOpen ? '' : '<p class="shop-note">Shop opens at encounters 9–10, 17–18 and 25–26, and after a defeat.</p>'}${body}`, 'TRAVELLER’S CAMP');
}
function options(): void {
  const sound = audioSettings();
  openDialog('options', 'Game paused', `<div class="options-list">
    <button class="primary wide" data-action="close">Resume ${icon('next')}</button>
    <fieldset class="audio-settings">
      <legend>Sound effects</legend>
      <label class="audio-mute"><input type="checkbox" id="mute-sound" ${sound.muted ? 'checked' : ''}> Mute sound</label>
      <div class="audio-volume"><label for="sound-volume">Volume</label><output id="volume-value" for="sound-volume">${sound.volume}%</output>
        <input type="range" id="sound-volume" min="0" max="100" value="${sound.volume}" ${sound.muted ? 'disabled' : ''}></div>
      <button class="compact" id="preview-sound" data-action="sound-preview" ${sound.muted || !sound.volume ? 'disabled' : ''}>Test sound</button>
    </fieldset>
    <button class="secondary wide" data-action="help">How to play ${icon('book')}</button>
    <button class="secondary wide" id="update-game" data-action="update" hidden><span>Check for updates</span>${icon('next')}</button>
    <p id="update-status" class="update-status" role="status"></p>
    <button class="secondary wide" data-action="export">Export backup ${icon('bag')}</button>
    <button class="secondary wide" data-action="exit">Save &amp; return to title ${icon('back')}</button>
    <p class="sheet-foot">${saved ? 'Auto-save is active. This is file 0' + (slot + 1) + '.' : 'Auto-save is unavailable. Export a backup to keep this oath.'}</p>
    <p class="sheet-foot" id="offline-state">${offlineStatus()}</p>
  </div>`);
  renderUpdates();
}

let pendingImport: Save | undefined;
function exportSave(): void {
  const url = URL.createObjectURL(new Blob([serialize(current())], {type: 'application/json'}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'hollow-oath-file-' + (slot + 1) + '.json';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function importSave(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    let data: Save | null = null;
    try { if (file.size < 350_000) data = decode(await file.text()); }
    catch { /* Read failures use the same message as invalid backups. */ }
    if (data) slotScreen('import', data);
    else toast('This is not a valid Hollow Oath backup.');
  });
  input.click();
}
function chooseSlot(i: number, isImport: boolean): void {
  slot = i;
  if (readSlot(i)) {
    openDialog('replace', 'Replace this oath?', `<p class="guide">File 0${i + 1} already holds a saved game. Replacing it will overwrite that oath.</p>
      <button class="primary wide" data-action="${isImport ? 'import-confirm' : 'new-confirm'}">Replace file 0${i + 1}</button>
      <button class="text-action" data-action="close">Keep existing save</button>`);
  } else if (isImport) finishImport();
  else heroScreen();
}
function finishImport(): void {
  if (!pendingImport) return;
  if (!writeSlot(slot, pendingImport.run)) {
    toast('This device could not store the imported oath.');
    return;
  }
  slotScreen('load');
  toast('Backup restored.');
}

app.addEventListener('input', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.id !== 'mute-sound' && input.id !== 'sound-volume') return;
  const muted = find<HTMLInputElement>('mute-sound').checked;
  const slider = find<HTMLInputElement>('sound-volume');
  const volume = slider.valueAsNumber;
  configureAudio(muted, volume);
  unlockAudio();
  slider.disabled = muted;
  find('volume-value').textContent = volume + '%';
  find<HTMLButtonElement>('preview-sound').disabled = muted || volume === 0;
});
app.addEventListener('change', event => {
  const input = event.target;
  if (input instanceof HTMLInputElement && input.id === 'auto-equip') {
    autoEquip = input.checked;
    try { localStorage.setItem(AUTO_EQUIP_KEY, String(autoEquip)); }
    catch { /* Keep the preference for the current session. */ }
    return;
  }
  if (!(input instanceof HTMLSelectElement) || !battle) return;
  if (input.dataset.equip) {
    const gear = current().inventory.find(item => gearId(item) === input.value);
    equipGear(current(), gear, input.dataset.equip as GearSlot);
    battle.refresh();
    save();
    updateHud();
    const key = input.dataset.equip;
    gearView();
    document.querySelector<HTMLSelectElement>('select[data-equip="' + key + '"]')?.focus();
  }
  if (input.id === 'shop-rank') {
    shopTier = Number(input.value);
    gearView();
    find('shop-rank').focus();
  }
});
app.addEventListener('click', event => {
  const target = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
  if (!target || target.disabled) return;
  unlockAudio();
  const {action, id} = target.dataset;
  switch (action) {
    case 'title': title(); break;
    case 'new': slotScreen('new'); break;
    case 'load': slotScreen('load'); break;
    case 'new-slot': chooseSlot(Number(id), false); break;
    case 'import-slot': chooseSlot(Number(id), true); break;
    case 'new-confirm': heroScreen(); break;
    case 'import-confirm': finishImport(); break;
    case 'load-slot': {
      slot = Number(id);
      const data = readSlot(slot);
      if (data) startArena(data.run);
      break;
    }
    case 'hero':
      hero = id as HeroId;
      heroScreen();
      app.querySelector<HTMLElement>('button[data-id="' + hero + '"]')?.focus({preventScroll: true});
      break;
    case 'start': startArena(newRun(hero)); break;
    case 'help': help(); break;
    case 'close': close(); break;
    case 'options': options(); break;
    case 'visit-shop':
    case 'gear':
      gearTab = action === 'visit-shop' && canShop(current()) ? 'shop' : 'stats';
      shopTier = current().wave;
      gearView();
      break;
    case 'gear-tab':
      gearTab = id!;
      gearView();
      app.querySelector<HTMLElement>('button[data-action="gear-tab"][data-id="' + gearTab + '"]')?.focus();
      break;
    case 'buy': {
      const gear = {slot: id as GearSlot, tier: shopTier, relic: false};
      if (buyGear(current(), gear)) {
        if (autoEquip) {
          equipGear(current(), gear, gear.slot);
          battle!.refresh();
        }
        save();
        updateHud();
        gearView();
        toast((autoEquip ? 'Equipped ' : 'Purchased ') + gearName(gear) + '.');
      }
      break;
    }
    case 'steel': mode('steel'); break;
    case 'magic':
      if (!suppressTap || event.detail === 0) mode('magic');
      suppressTap = false;
      break;
    case 'spells': showSpells(); break;
    case 'spell': {
      const spell = id as SpellId;
      if (SPELLS[spell].level > current().level) break;
      current().spell = spell;
      mode('magic');
      close();
      break;
    }
    case 'resume-wave':
      resumeWave(current());
      battle!.refresh();
      rewardLine = paceHint = '';
      displayEncounter();
      updateHud();
      save();
      lastFrame = 0;
      break;
    case 'exit': save(); title(); break;
    case 'sound-preview': void playSound('steel', true); break;
    case 'update': void updateGame(() => { save(); return saved; }); break;
    case 'export': exportSave(); break;
    case 'import': importSave(); break;
  }
});

window.addEventListener('keydown', event => {
  if (event.repeat || screen !== 'arena' || dialogKind || event.altKey || event.ctrlKey || event.metaKey) return;
  unlockAudio();
  if (event.key === '1') mode('steel');
  if (event.key === '2') mode('magic');
  if (event.key === '3') showSpells();
  if (event.key === 'Escape') options();
});
document.addEventListener('visibilitychange', () => {
  backgroundAudio();
  lastFrame = 0;
  if (document.hidden && battle) save();
});
window.addEventListener('pagehide', () => { if (battle) save(); });

function frame(now: number): void {
  requestAnimationFrame(frame);
  if (!battle || dialogKind || document.hidden) { lastFrame = 0; return; }
  if (lastFrame && (battle.run.phase === 'fight' || battle.run.phase === 'clear')) {
    battle.tick(Math.min((now - lastFrame) / 1000, 0.15));
    dirty = true;
  }
  lastFrame = now;
  effects?.draw(now);
  if (now >= nextHud) {
    updateHud();
    nextHud = now + 72;
  }
  if (dirty && now >= nextSave) save();
}
title();
requestAnimationFrame(frame);
