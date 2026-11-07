import { ACHIEVEMENTS, ACHIEVEMENT_GROUPS, emptyProfile, mergeProfile, profileFromRun } from './achievements.ts';
import { audioActive, audioSettings, backgroundAudio, configureAudio, playSound, setMusic, stopSounds, unlockAudio } from './audio.ts';
import { offlineStatus, renderUpdates, updateGame } from './updates.ts';
import './style.css';
import {
  CHARACTER_NAME_LIMIT, ELEMENT_NAMES, ENEMY_MOVES, aegisProtection, spellBoost, spellRankCap, encounter, gearBonus, gearId, gearName, gearPrice, GEAR_NAMES, GEAR_SLOTS,
  HEROES, HERO_IDS, normalizeCharacterName, SEALS, spellCost, SPELLS, SPELL_IDS, STAT_NAMES, WAVES, xpGoal,
  type Gear, type GearSlot, type HeroId, type SpellId, type Stats
} from './content.ts';
import { activeSeal, enemyAffinity, enemyStage, nextEnemyMove, availableEssence, Battle, buyGear, buySpell, canShop, equipGear, knownRank, newRun, newRunId, preparedSpellCost, resumeWave, stats, workshopPrice, type BattleEvent, type Run } from './engine.ts';
import { Effects, strikeColor } from './graphics.ts';
import { icon } from './icons.ts';
import { achievementHistory, decode, deleteSlot, listSlots, readSlot, serialize, writeSlot, type Save } from './saves.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
const embeddedArt = (globalThis as typeof globalThis & {HOLLOW_ART?: Record<string, string>}).HOLLOW_ART;
const art = (name: string) => embeddedArt?.[name] ?? new URL('art/' + name + '.webp', document.baseURI).href;
const find = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const number = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1});
const fmt = (x: number) => number.format(x);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const savedDate = new Intl.DateTimeFormat('en', {dateStyle: 'medium', timeStyle: 'short'});
const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const symbol = (text: string) => '<span aria-hidden="true">' + text + '</span>';
let hero: HeroId = 'vanguard';
let slot = '';
let createSlot = false;
let screen = 'title';
let battle: Battle | undefined;
let unlocked = new Set<string>();
let history = {other: emptyProfile(), prior: emptyProfile()};
let recordsDirty = false;
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
let achievementToastTimer = 0;
let longTimer = 0;
let suppressTap = false;
let actionPointer: {id: number; x: number; y: number} | undefined;
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
  if (name === 'prologue') setMusic('silent');
  else if (name === 'epilogue' || name === 'ending') setMusic('ending');
  else if (name !== 'arena') setMusic('title');
  effects?.dispose();
  effects = undefined;
  dialogKind = '';
  app.innerHTML = body + '<dialog id="sheet" class="sheet" aria-labelledby="sheet-title"></dialog><div id="toast" class="toast" role="status"></div><div id="achievement-toast" class="toast achievement-toast" role="status"></div>';
  const dialog = find<HTMLDialogElement>('sheet');
  dialog.addEventListener('close', () => {
    dialogKind = '';
    lastFrame = 0;
    if (dialogOpener?.isConnected) dialogOpener.focus({preventScroll: true});
    dialogOpener = null;
  });
  dialog.addEventListener('cancel', event => {
    if (dialogKind !== 'portrait' && dialogKind !== 'rename') return;
    event.preventDefault();
    close();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      const {clientX: x, clientY: y} = event;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) close();
    }
  });
  app.querySelector<HTMLElement>('main')?.focus({preventScroll: true});
}

function title(): void {
  battle = undefined;
  storyRun = undefined;
  mount('title', `<main class="frame title-screen" tabindex="-1">
    <div class="title-plate" aria-hidden="true" style="--cover:url(&quot;${art('title')}&quot;)"></div>
    <div class="title-atmosphere" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="folio"><span>AN ILLUSTRATED DARK FANTASY</span><i></i><button class="title-sound" id="title-sound" data-action="title-sound">Play music</button></div>
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
    <footer class="title-footer">
      <div class="title-bottom">
        <button class="text-action" data-action="help">How to play</button>
        <button class="text-action" data-action="achievements">Achievements</button>
        <button class="text-action" id="update-game" data-action="update" hidden><span>Check for updates</span></button>
      </div>
      <p id="update-status" class="update-status" role="status"></p>
    </footer>
  </main>`);
  renderUpdates();
  renderTitleSound();
}

function renderTitleSound(): void {
  const button = document.querySelector('#title-sound');
  if (button) button.textContent = audioActive() ? 'Mute sound' : 'Play music';
}
async function toggleTitleSound(): Promise<void> {
  const {muted, volume} = audioSettings();
  if (audioActive()) configureAudio(true, volume);
  else {
    if (muted || !volume) configureAudio(false, volume || 60);
    await unlockAudio();
  }
  renderTitleSound();
}

function heroScreen(): void {
  const h = HEROES[hero];
  mount('hero', `<main class="frame hero-screen" tabindex="-1" style="--hero:${h.color}">
    <header class="selection-head"><button class="round" data-action="title" aria-label="Back to title">${icon('back')}</button>
      <span>THE OATHBOUND</span></header>
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
  if (!data) return '<strong>Unreadable save</strong>';
  const r = data.run;
  const where = r.phase === 'victory' ? 'Oath fulfilled' : 'Wave ' + r.wave + ' · Encounter ' + r.step;
  return `<strong>${escapeHtml(r.name)}</strong>
    <small>${HEROES[r.hero].name} · Lv. ${fmt(r.level)} · ${where}</small><small>${savedDate.format(data.updated)}</small>`;
}
function slotScreen(): void {
  const entries = listSlots();
  mount('slots', `<main class="frame record-screen" tabindex="-1">
    <header class="selection-head"><button class="round" data-action="title" aria-label="Back to title">${icon('back')}</button><span>HOLLOW OATH</span></header>
    <div class="record-body"><p class="kicker">THE ARCHIVE</p><h1>Load Game</h1>
    <p>${entries.length ? 'Your oaths are saved on this device.' : 'No saved games yet.'}</p>
    <div class="slot-list">${entries.map(({id, data}, index) => `<div class="file-entry">
      <button class="file-row" data-action="load-slot" data-id="${id}" ${data ? '' : 'disabled'}>
        ${data ? `<img class="file-portrait" src="${art(data.run.hero)}" alt="">` : icon('bag')}
        <span>${slotLabel(data)}</span>${icon('next')}</button>
      <button class="compact delete-file" data-action="delete-slot" data-id="${id}"
        aria-label="Delete save ${index + 1}${data ? ' for ' + HEROES[data.run.hero].name : ''}">Delete</button></div>`).join('')}</div>
    <button class="text-action" data-action="import">Import a backup</button>
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
function close(): void {
  if (dialogKind === 'portrait' || dialogKind === 'rename') {
    const opener = dialogKind === 'portrait' ? 'view-portrait' : 'rename-character';
    gearView();
    find(opener).focus({preventScroll: true});
  } else {
    dialogKind = '';
    lastFrame = 0;
    find<HTMLDialogElement>('sheet').close();
  }
}

function help(): void {
  openDialog('help', 'The field guide', `<div class="guide">
    <p><strong>Auto combat.</strong> Both sides strike independently. Twice the Speed means twice the attack rate. Steel tests Defense. Sorcery tests Magic Defense.</p>
    <p><strong>Six actions.</strong> Tap the sword or one of five spells to select automatic attacks. Hold a spell to pause and read its level, cost and effects. On a keyboard, keys 1–6 select actions; Shift+Enter on a spell opens details. Low MP returns you to steel. Aegis protects several incoming hits and returns to steel after casting.</p>
    <p><strong>Affinities and seals.</strong> Enemies may resist an element, be immune to it or take extra damage from a weakness.  Read the prompt above a protected foe. A seal ignores mismatched attacks even if you outlevel the enemy. Bosses change seals and weaknesses as their HP falls, up to five phases. The matching action is marked with !. Dangerous enemy attacks have a visible preparation time; Aegis can soften them. Some bosses heal or drain life, with limited total recovery. Save your mana for the right strike.</p>
    <p><strong>Survive the wave.</strong> Each wave has 31 foes and a boss. HP carries between fights. Mend and level gains can restore HP. Falling returns you to the first encounter of the current wave with full HP and MP, and you keep XP, gold and gear.</p>
    <p><strong>The armory.</strong> Equip gear anytime in the left menu. The Shop and Workshop open only after a defeat, before you retry. Each wave opens a new gear rank. Some bosses drop relics. Marked foes and guardians award Arcane Essence on their first defeat. Spend it at the Workshop to learn spells or raise their level. Spells always cast at the highest level learned, up to level 10 as the campaign progresses. The next wave begins with full HP and MP.</p>
    ${screen === 'arena' ? '<button class="secondary wide" data-action="options">Back to options</button>' : ''}
  </div>`);
}

let storyRun: Run | undefined;
let storyEnding = false;
let storyPage = 0;
function beginStory(run: Run, ending: boolean): void {
  storyRun = run;
  storyEnding = ending;
  storyPage = 0;
  lastFrame = 0;
  showStory();
}
function storyPages(run: Run, ending: boolean): {heading: string; text: string}[] {
  return ending ? [
    {heading: 'The last shadow falls.', text: `${run.name} has defeated the Hollow King. Across thirty-two waves, every monster that stood between the realm and the dawn has fallen.`},
    {heading: 'The kingdom breathes again.', text: 'The eclipse breaks. Roads open, bells ring, and lights return to windows long abandoned. The people of the kingdom are safe at last.'},
    {heading: 'An oath fulfilled.', text: `The scars will remain, but so will hope. And wherever the story is told, they will remember the name ${run.name}.`}
  ] : [
    {heading: 'A kingdom beneath the eclipse.', text: 'When the sun vanished behind a hollow crown, monsters poured from the forgotten gates. Thirty-two waves now stand between the kingdom and the dawn.'},
    {heading: 'One oath remains.', text: `${run.name} steps into the dark. Steel may falter, and magic may fade. Yet every fall brings knowledge, and every return brings the dawn closer.`}
  ];
}
function showStory(): void {
  const pages = storyPages(storyRun!, storyEnding), page = pages[storyPage]!;
  const final = storyPage === pages.length - 1;
  mount(storyEnding ? 'epilogue' : 'prologue', `<main class="story-screen" tabindex="-1" aria-labelledby="story-heading">
    <div class="story-copy">
      <p class="kicker">${storyEnding ? 'THE OATH FULFILLED' : 'HOLLOW OATH'} · ${storyPage + 1} / ${pages.length}</p>
      <h1 id="story-heading">${escapeHtml(page.heading)}</h1>
      <p class="story-text">${escapeHtml(page.text)}</p>
      <button class="secondary wide" data-action="story-next">${final ? storyEnding ? 'See the dawn' : 'Enter the Hollow' : 'Continue'} ${icon('next')}</button>
    </div>
  </main>`);
}
function advanceStory(): void {
  if (!storyRun || (screen !== 'prologue' && screen !== 'epilogue')) return;
  if (++storyPage < storyPages(storyRun, storyEnding).length) { showStory(); return; }
  const run = storyRun;
  if (!storyEnding) { storyRun = undefined; startArena(run); return; }
  mount('ending', `<main class="ending-screen" tabindex="-1" aria-labelledby="ending-title" style="--hero-glow:${HEROES[run.hero].color}">
    <img class="ending-art" src="${art('ending-' + run.hero)}" alt="${escapeHtml(run.name)}, the ${HEROES[run.hero].name}, overlooking the saved kingdom at dawn">
    <div class="ending-shade" aria-hidden="true"></div>
    <div class="title-atmosphere ending-atmosphere" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="ending-inscription"><p class="kicker">THE DAWN REMEMBERS</p><h1 id="ending-title">The End</h1><p>${escapeHtml(run.name)} · ${HEROES[run.hero].name}</p></div>
    <button class="secondary" data-action="exit">Return to Title ${icon('next')}</button>
  </main>`);
}

function startArena(run: Run, isNew = false): void {
  createSlot = isNew;
  battle = new Battle(run, battleEvent);
  history = achievementHistory(run.runId);
  const profile = currentProfile();
  unlocked = new Set(ACHIEVEMENTS.filter(item => item.progress(profile) >= item.target).map(item => item.id));
  recordsDirty = false;
  dirty = false;
  nextSave = nextHud = lastFrame = 0;
  displaySeal = displayPhase = '';
  rewardLine = '';
  paceHint = '';
  mount('arena', `<main class="frame arena" tabindex="-1">
    <div id="world" class="world" aria-hidden="true"></div>
    <header class="battle-head">
      <button class="round" data-action="gear" aria-label="Armory" title="Character and equipment">${icon('bag')}</button>
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
      <p id="affinity" class="affinity"></p>
    </section>
    <div class="battle-art" id="battle-art">
      <div class="sigil" aria-hidden="true">${icon('mark')}</div>
      <div class="ground" aria-hidden="true"></div>
      <div class="enemy-figure" id="figure"><img id="enemy" alt="" draggable="false"></div>
      <canvas id="fx" aria-hidden="true"></canvas><div id="numbers" aria-hidden="true"></div><div id="aegis-status" class="ward-status" role="status"></div><div id="enemy-intent" class="enemy-intent" role="status"></div>
    </div>
    <footer class="battle-foot">
      <div class="tally"><span id="step"></span><div id="pips" aria-hidden="true"></div><span>32</span></div>
      <div class="combat-line" id="combat-line">Auto combat active</div>
      <div class="combat-controls" role="group" aria-label="Automatic combat actions">
        <button class="combat-button" data-action="steel" id="steel" aria-label="Sword · Physical attack" aria-keyshortcuts="1" style="--spell:#eac180">${icon('steel')}<small>ATK</small></button>
        ${SPELL_IDS.map((id, i) => `<button class="combat-button spell-slot" data-action="ability" data-id="${id}" id="action-${id}" aria-describedby="actions-help" aria-keyshortcuts="${i + 2}" style="--spell:${SPELLS[id].color}">${icon(id === 'aegis' ? 'shield' : id)}<small id="cost-${id}"></small><span class="action-lock" aria-hidden="true">${icon('lock')}</span></button>`).join('')}
      </div>
      <span class="sr-only" id="actions-help">Tap to select automatic casting. Hold a spell, right-click it or press Shift+Enter on it for details and pause combat. Only the framed action is selected. A ! marks the action needed for a seal. Keys 1 to 6 select actions.</span>
    </footer>
    <div id="outcome" hidden></div>
  </main>`);
  effects = new Effects(find<HTMLCanvasElement>('fx'), run.hero);
  bindActions();
  displayEncounter();
  updateHud();
  save();
}

function bindActions(): void {
  for (const button of app.querySelectorAll<HTMLButtonElement>('.spell-slot')) {
    const id = button.dataset.id as SpellId;
    button.addEventListener('contextmenu', event => { event.preventDefault(); spellInfo(id); });
    button.addEventListener('keydown', event => {
      if (event.shiftKey && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); spellInfo(id); }
    });
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      clearTimeout(longTimer);
      suppressTap = false;
      actionPointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
      button.setPointerCapture(event.pointerId);
      longTimer = window.setTimeout(() => { suppressTap = true; spellInfo(id); }, 440);
    });
    button.addEventListener('pointermove', event => {
      if (actionPointer?.id === event.pointerId && Math.hypot(event.clientX - actionPointer.x, event.clientY - actionPointer.y) > 12) {
        suppressTap = true; clearTimeout(longTimer);
      }
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => { clearTimeout(longTimer); actionPointer = undefined; });
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
  const trait = enemyAffinity(r, foe);
  find('affinity').textContent = trait
    ? (trait.immune ? 'Immune to ' : 'Resists ') + ELEMENT_NAMES[trait.resists] + ' · Weak to ' + ELEMENT_NAMES[trait.weak]
    : '';
  find('enemy-kind').textContent = foe.boss ? 'WAVE GUARDIAN' : (availableEssence(r, foe) ? 'ESSENCE-BEARER' : foe.seals.length ? 'SEALED FOE' : foe.arcane ? 'ARCANE FOE' : 'ENCOUNTER');
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
  find('identity').textContent = r.name + ' · LV ' + fmt(r.level);
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
  for (const id of SPELL_IDS) {
    const rank = knownRank(r, id), button = find('action-' + id);
    button.setAttribute('aria-pressed', String(r.mode === 'magic' && r.spell === id));
    button.dataset.locked = String(!rank);
    button.classList.toggle('locked', !rank);
    button.classList.toggle('low-mana', Boolean(rank && r.mp + 1e-8 < spellCost(id, rank)));
    button.setAttribute('aria-label', spellLabel(r, id) + (rank ? ' · ' + spellCost(id, rank) + ' MP' : ' · Locked, hold for details'));
    find('cost-' + id).textContent = rank ? spellCost(id, rank) + ' MP' : r.level < SPELLS[id].level ? 'LV ' + SPELLS[id].level : 'Learn';
  }
  const protection = aegisProtection(r.wardRank);
  find('aegis-status').textContent = r.ward > 0 ? '◇ Aegis −' + Math.round(protection.reduction * 100) + '% · ' + r.ward + ' hits' : '';
  const intent = find('enemy-intent'), next = r.intent ?? nextEnemyMove(r, foe);
  intent.hidden = r.phase !== 'fight';
  intent.textContent = r.intent ? ENEMY_MOVES[next].warning : 'Next: ' + ENEMY_MOVES[next].name;
  intent.classList.toggle('casting', Boolean(r.intent));
  intent.style.setProperty('--intent', ENEMY_MOVES[next].color);
  find('figure').classList.toggle('preparing', Boolean(r.intent));
  find('figure').style.setProperty('--intent', ENEMY_MOVES[next].color);
  intent.style.setProperty('--cast', String(r.intent ? Math.min(1, r.castWait / 2.4) : 0));
  const trait = enemyAffinity(r, foe);
  find('affinity').textContent = trait ? (trait.immune ? 'Immune to ' : 'Resists ') + ELEMENT_NAMES[trait.resists] + ' · Weak to ' + ELEMENT_NAMES[trait.weak] : '';
  if (foe.boss) find('enemy-kind').textContent = 'WAVE GUARDIAN · PHASE ' + (enemyStage(r, foe) + 1) + '/' + foe.seals.length;
  const seal = r.phase === 'fight' ? activeSeal(r, foe) : undefined;
  for (const button of app.querySelectorAll<HTMLElement>('.combat-button')) button.classList.toggle('recommended', Boolean(seal && (button.id === 'steel' ? seal === 'steel' : button.dataset.id === seal)));
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
  find('combat-line').textContent = paceHint || rewardLine || (r.mode === 'steel' ? 'Auto combat · Steel ready' : 'Auto combat · ' + preparedSpellCost(r) + ' MP per cast');
}
function outcome(): void {
  const r = current(), el = find('outcome');
  if (r.phase === 'victory') {
    queueMicrotask(() => {
      if (screen === 'arena' && battle?.run === r) { save(); beginStory(r, true); }
    });
    return;
  }
  setMusic(r.phase === 'fallen' ? 'defeat' : 'battle');
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
    <button class="text-action exit-link" data-action="achievements">Achievements</button>
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
  dirty = recordsDirty = true;
  switch (event.type) {
    case 'hit':
      if (!reduced.matches) effects?.add(event.strike);
      if (event.affinity === 'immune') {
        void playSound('block');
        pop('IMMUNE', '#d2c9bb', 'seal-float');
        break;
      }
      void playSound(event.strike);
      pop('−' + fmt(event.damage) + (event.affinity === 'weak' ? '!' : ''), strikeColor(event.strike));
      if (event.affinity === 'resisted') pop('RESISTED', '#d2c9bb', 'seal-float');
      animate('hit');
      break;
    case 'intent':
      break;
    case 'enemy-heal':
      void playSound('heal');
      if (!reduced.matches) effects?.add(event.drain ? 'drain' : 'enemy-heal');
      pop('+' + fmt(event.amount) + ' HP', '#9effc1', 'enemy-heal-number');
      break;
    case 'hurt':
      void playSound(event.move === 'steel' || event.move === 'heavy' ? 'hurt' : event.move === 'drain' ? 'hurt' : event.move === 'mend' ? 'heal' : event.move);
      if (!reduced.matches && event.arcane) effects?.add('enemy-' + (event.move === 'drain' ? 'drain' : event.move) as 'enemy-ember' | 'enemy-rime' | 'enemy-storm' | 'enemy-drain');
      if (event.move === 'rime') pop('SLOWED', '#92e9ff', 'seal-float');
      if (event.blocked > 0) pop('AEGIS −' + fmt(event.blocked), '#9fe6c0', 'seal-float');
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
    case 'ward':
      void playSound('heal');
      if (!reduced.matches) effects?.add('ward');
      pop('AEGIS · ' + fmt(event.amount) + ' HITS', '#a4ffc0', 'incoming');
      break;
    case 'empty':
      paceHint = 'Low MP · Switched to steel';
      break;
    case 'level':
      void playSound('reward');
      toast('Level ' + fmt(event.level) + (event.spells.length ? ' · Learned ' + event.spells.map(id => SPELLS[id].name).join(', ') : ' · Stats increased'));
      break;
    case 'kill':
      if (current().phase === 'victory') history = achievementHistory(current().runId);
      animate('slain');
      paceHint = '';
      if (event.essence || event.loot || battle?.foe.boss) void playSound('reward');
      if (event.essence && !event.loot) toast('+' + event.essence + ' Arcane Essence');
      if (event.loot) toast('Relic found · ' + gearName(event.loot, current().hero));
      rewardLine = '+' + fmt(event.xp) + ' XP · +' + fmt(event.gold) + ' gold' + (event.loot ? ' · Relic: ' + gearName(event.loot, current().hero) : '') + (event.essence ? ' · +' + event.essence + ' Essence' : '');
      if (current().phase === 'clear') toast('Guardian slain · ' + rewardLine);
      save();
      break;
    case 'enter':
      rewardLine = '';
      paceHint = '';
      displayEncounter();
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
function spellLabel(run: Run, id: SpellId): string {
  const rank = knownRank(run, id);
  return SPELLS[id].name + (rank ? ' Lvl ' + rank : '');
}
function spellInfo(id: SpellId): void {
  if (!battle || screen !== 'arena') return;
  const r = current(), spell = SPELLS[id], rank = knownRank(r, id), shown = Math.max(1, rank);
  const protection = aegisProtection(shown);
  const detail = id === 'aegis' ? `−${Math.round(protection.reduction * 100)}% physical and magic damage for ${protection.charges} incoming attacks. Cast once, then return to steel. Active charges survive changing spells. Cannot stack or refresh remaining charges.` :
    id === 'mend' ? `Healing ×${spellBoost(shown).toFixed(2)}. Casts only when wounded; otherwise uses steel.` :
    `Power ×${spellBoost(shown).toFixed(2)} of the base spell.${id === 'rime' ? ' Delays enemy attacks; a prepared spell can be delayed by at most 0.6 seconds in total.' : ''}`;
  const unlock = rank ? '' : r.level < spell.level ? `Reach character level ${spell.level}.${spell.price ? ' Then learn it at the Workshop after a defeat.' : ' Learned automatically.'}` : 'Learn this spell at the Workshop after a defeat for ' + spell.price + ' Arcane Essence.';
  openDialog('spell-info', spellLabel(r, id), `<div class="spell-detail" style="--spell:${spell.color}"><div class="spell-symbol">${icon(id === 'aegis' ? 'shield' : id)}</div><p>${spell.text}</p><p>${detail}</p><p><strong>${rank ? 'Current level: ' + rank + ' / 10' : 'Not learned · Level 1 preview'} · ${spellCost(id, shown)} MP</strong></p>${unlock ? '<p>' + unlock + '</p>' : ''}<p class="sheet-foot">Combat is paused. Closing this page keeps your selected action.</p><button class="secondary wide" data-action="close">Return to combat ${icon('next')}</button></div>`, 'SPELL DETAILS');
}
function selectSpell(id: SpellId): void {
  if (!battle || current().phase !== 'fight') return;
  if (!knownRank(current(), id)) { spellInfo(id); return; }
  if (id === 'aegis' && current().ward > 0) { spellInfo(id); return; }
  current().spell = id;
  mode('magic');
}
function mode(value: 'steel' | 'magic'): void {
  if (!battle || current().phase !== 'fight') return;
  const r = current();
  if (value === 'magic' && r.mp + 1e-8 < preparedSpellCost(r)) {
    paceHint = 'Need ' + preparedSpellCost(r) + ' MP for ' + spellLabel(r, r.spell);
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
  saved = writeSlot(slot, battle.run, createSlot);
  if (saved) createSlot = false;
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
  if ((gearTab === 'shop' || gearTab === 'workshop') && !shopOpen) gearTab = 'stats';
  const tabs = [['stats', 'Character'], ['equip', 'Equipment'], ['shop', shopOpen ? 'Shop' : 'Shop closed'], ['workshop', 'Workshop']];
  let body = '';
  if (gearTab === 'stats') {
    body = `<div class="character-strip">
      <button class="portrait-trigger" id="view-portrait" data-action="portrait" aria-label="Enlarge ${HEROES[r.hero].name} portrait">
        <img src="${art(r.hero)}" alt=""><span>${icon('zoom')}</span>
      </button><span><strong>${escapeHtml(r.name)}</strong><small>${HEROES[r.hero].name} · Lv. ${fmt(r.level)}<br>${fmt(r.xp)} / ${fmt(xpGoal(r.level))} XP</small></span>
      <button class="compact rename-character" id="rename-character" data-action="rename">Rename</button></div>
      <dl class="stat-grid">${Object.entries(STAT_NAMES).map(([key, name]) => `<div><dt>${name}</dt><dd>${statText(key as keyof Stats, s[key as keyof Stats])}</dd></div>`).join('')}</dl>
      <p class="sheet-foot">${fmt(r.kills)} foes slain · ${fmt(r.deaths)} falls · ${fmt(r.inventory.length)} gear owned</p><p class="sheet-foot">${fmt(r.essence)} Arcane Essence</p>`;
  } else if (gearTab === 'equip') {
    body = `<div class="gear-list">${GEAR_SLOTS.map(g => {
      const items = r.inventory.filter(item => item.slot === g).sort((a, b) => b.tier - a.tier || Number(b.relic) - Number(a.relic));
      const equipped = items.find(item => r.equipped[g] === gearId(item));
      return `<label class="gear-row"><span><strong>${GEAR_NAMES[g]}</strong><small>${equipped ? bonusText(equipped) : 'No bonuses equipped'}</small></span>
        <select data-equip="${g}" aria-label="${GEAR_NAMES[g]}"><option value="">Unequipped</option>${items.map(item => `<option value="${gearId(item)}" ${item === equipped ? 'selected' : ''}>${gearName(item, r.hero)} · Rank ${item.tier}</option>`).join('')}</select></label>`;
    }).join('')}</div>`;
  } else if (gearTab === 'workshop') {
    body = `<div class="sheet-caption"><span>ARCANE WORKSHOP</span><span class="coin">◆ ${fmt(r.essence)} Essence</span></div>
      <div class="gear-list">${SPELL_IDS.map(id => {
        const s = SPELLS[id], rank = knownRank(r, id), price = workshopPrice(r, id);
        const status = r.level < s.level ? 'Lv. ' + s.level : price === undefined ? (rank >= 10 ? 'Max level' : 'Wave ' + (Math.ceil(rank * 31 / 9) + 1)) : '◆ ' + price;
        const action = (rank ? 'Upgrade ' : 'Learn ') + s.name;
        return `<div class="gear-row"><span><strong>${spellLabel(r, id)}</strong>
          <small>${s.text}</small>
          ${price === undefined ? '' : `<small>${rank ? 'Next level · ' : 'Learn · '}${spellCost(id, rank + 1)} MP per cast</small>`}</span>
          <button class="compact" data-action="buy-spell" data-id="${id}" ${price === undefined || r.essence < price ? 'disabled' : ''} aria-label="${price === undefined ? status : action + ' for ' + price + ' Arcane Essence'}">${status}</button></div>`;
      }).join('')}</div><p class="sheet-foot">Spells always use their highest learned level. Upgrades raise MP costs. Current wave allows level ${spellRankCap(r.wave)} / 10. Marked foes and guardians yield Essence once per file.</p>`;
  } else {
    body = `<label class="auto-equip"><input type="checkbox" id="auto-equip" ${autoEquip ? 'checked' : ''}> Auto-equip purchases</label>
      <div class="sheet-caption"><label>GEAR RANK <select id="shop-rank">${Array.from({length: r.wave}, (_, i) => `<option ${shopTier === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label><span class="coin">◆ ${fmt(r.gold)} gold</span></div>
      <div class="gear-list">${GEAR_SLOTS.map(g => {
        const gear = {slot: g, tier: shopTier, relic: false};
        const owned = r.inventory.some(item => gearId(item) === gearId(gear));
        const price = gearPrice(gear), name = gearName(gear, r.hero);
        return `<div class="gear-row"><span><strong>${name}</strong><small>${bonusText(gear)}</small></span>
          <button class="compact" data-action="buy" data-id="${g}" ${owned || r.gold < price ? 'disabled' : ''} aria-label="${owned ? name + ' owned' : 'Buy ' + name + ' for ' + price + ' gold'}">${owned ? 'Owned' : '◆ ' + fmt(price)}</button></div>`;
      }).join('')}</div><p class="sheet-foot">Every purchase is added to your collection.</p>`;
  }
  openDialog('gear', 'The Armory', `<div class="gear-tabs" role="group" aria-label="Armory pages">${tabs.map(([id, name]) =>
    `<button data-action="gear-tab" data-id="${id}" aria-pressed="${gearTab === id}" ${(id === 'shop' || id === 'workshop') && !shopOpen ? 'disabled' : ''}>${name}</button>`).join('')}</div>${shopOpen ? '' : '<p class="shop-note">The Shop and Workshop open after a defeat, before you retry.</p>'}${body}`, shopOpen ? 'RECOVERY CAMP' : 'EQUIPMENT');
}
function portrait(): void {
  const {hero} = current();
  openDialog('portrait', escapeHtml(current().name), `
    <figure class="portrait-large"><img src="${art(hero)}" alt="Portrait of the ${HEROES[hero].name}"></figure>
    <button class="text-action" id="portrait-return" data-action="close">Back to Character</button>`, 'CHARACTER PORTRAIT');
  find('portrait-return').focus({preventScroll: true});
}

function nameDialog(isNew: boolean): void {
  const selected = isNew ? hero : current().hero;
  const fallback = HEROES[selected].defaultName;
  openDialog(isNew ? 'name' : 'rename', isNew ? 'Name your character' : 'Rename your character', `
    <form id="character-name-form" class="character-name-form">
      <label for="character-name">Character name</label>
      <input type="text" id="character-name" value="${escapeHtml(isNew ? fallback : current().name)}"
        maxlength="${CHARACTER_NAME_LIMIT}" autocomplete="off" spellcheck="false" dir="auto">
      <p class="sheet-foot">Default name · ${fallback}</p>
      <p id="name-status" class="update-status" role="status"></p>
      <button class="primary wide" type="submit">${isNew ? 'Begin adventure' : 'Save name'} ${icon('next')}</button>
      <button class="text-action" type="button" data-action="default-name">Use default name</button>
    </form>`, HEROES[selected].name.toUpperCase());
  const input = find<HTMLInputElement>('character-name');
  input.focus({preventScroll: true});
  input.select();
}

function elapsedLabel(seconds: number): string {
  const full = Math.floor(seconds);
  return Math.floor(full / 60) + 'm ' + String(full % 60).padStart(2, '0') + 's';
}
function currentProfile() {
  const profile = emptyProfile();
  mergeProfile(profile, history.other);
  if (battle) {
    const active = profileFromRun(battle.run);
    mergeProfile(active, history.prior, true);
    mergeProfile(profile, active);
  }
  return profile;
}
function notifyAchievements(): void {
  recordsDirty = false;
  const profile = currentProfile();
  const gained = ACHIEVEMENTS.filter(item => !unlocked.has(item.id) && item.progress(profile) >= item.target);
  if (!gained.length) return;
  for (const item of gained) unlocked.add(item.id);
  const notice = find('achievement-toast');
  notice.textContent = 'Achievement unlocked · ' + gained[0]!.name + (gained.length > 1 ? ' +' + (gained.length - 1) : '');
  notice.classList.add('shown');
  clearTimeout(achievementToastTimer);
  achievementToastTimer = window.setTimeout(() => notice.classList.remove('shown'), 3300);
}
function achievements(): void {
  history = achievementHistory(battle?.run.runId);
  const profile = currentProfile();
  const elapsed = battle?.run.chronicle.activeSeconds;
  const count = ACHIEVEMENTS.filter(item => item.progress(profile) >= item.target).length;
  openDialog('achievements', 'Achievements', `<div class="sheet-caption"><span>${count} / ${ACHIEVEMENTS.length} UNLOCKED</span><span>ALL ADVENTURES</span></div>
    <p class="chronicle-note">${profile.fastest !== null ? 'Best campaign time · ' + elapsedLabel(profile.fastest) :
      'Timed challenges count from the start of a new game.'}
      ${elapsed != null && !battle?.run.chronicle.finished ? '<br>Current game · ' + elapsedLabel(elapsed) : ''}</p>
    <div class="achievement-groups">${ACHIEVEMENT_GROUPS.map((group, index) => {
      const entries = ACHIEVEMENTS.filter(item => item.group === group);
      const complete = entries.filter(item => item.progress(profile) >= item.target).length;
      return `<details class="achievement-group" ${index === 0 ? 'open' : ''}>
        <summary>${group}<span>${complete} / ${entries.length}</span></summary>
        ${group === 'Classes' ? '<p class="achievement-group-note">Class victories count across all your adventures.</p>' : ''}
        ${entries.map(item => {
          const value = Math.min(item.progress(profile), item.target);
          const earned = value >= item.target;
          const status = earned ? 'Unlocked' : item.minutes ? 'Locked' :
            fmt(value) + ' / ' + fmt(item.target);
          return `<div class="achievement-item ${earned ? 'earned' : ''}">
            <span class="achievement-icon">${icon(earned ? 'mark' : 'lock')}</span>
            <div><strong>${item.name}</strong><small>${item.description}</small>
            ${item.minutes ? '' : `<progress aria-label="${item.name} progress" max="${item.target}" value="${value}"></progress>`}</div>
            <span class="achievement-status">${status}</span></div>`;
        }).join('')}</details>`;
    }).join('')}</div>
    <p class="sheet-foot">Time counts during active battles and transitions, including lost attempts. It pauses in menus and on the defeat screen.</p>
    <button class="text-action" data-action="${battle ? 'options' : 'close'}">${battle ? 'Back to options' : 'Back to title'}</button>`, 'OATH RECORD');
}

function options(): void {
  const sound = audioSettings();
  openDialog('options', 'Game paused', `<div class="options-list">
    <button class="primary wide" data-action="close">Resume ${icon('next')}</button>
    <fieldset class="audio-settings">
      <legend>Music and sound effects</legend>
      <label class="audio-mute"><input type="checkbox" id="mute-sound" ${sound.muted ? 'checked' : ''}> Mute sound</label>
      <div class="audio-volume"><label for="sound-volume">Volume</label><output id="volume-value" for="sound-volume">${sound.volume}%</output>
        <input type="range" id="sound-volume" min="0" max="100" value="${sound.volume}" ${sound.muted ? 'disabled' : ''}></div>
      <button class="compact" id="preview-sound" data-action="sound-preview" ${sound.muted || !sound.volume ? 'disabled' : ''}>Test sound</button>
    </fieldset>
    <button class="secondary wide" data-action="achievements">Achievements ${icon('mark')}</button>
    <button class="secondary wide" data-action="help">How to play ${icon('book')}</button>
    <button class="secondary wide" id="update-game" data-action="update" hidden><span>Check for updates</span>${icon('next')}</button>
    <p id="update-status" class="update-status" role="status"></p>
    <button class="secondary wide" data-action="export">Export backup ${icon('bag')}</button>
    <button class="secondary wide" data-action="exit">Save &amp; return to title ${icon('back')}</button>
    <p class="sheet-foot">${saved ? 'Auto-save is active on this device.' : 'Auto-save is unavailable. Export a backup to keep this oath.'}</p>
    <p class="sheet-foot" id="offline-state">${offlineStatus()}</p>
  </div>`);
  renderUpdates();
}

function exportSave(): void {
  const url = URL.createObjectURL(new Blob([serialize(current())], {type: 'application/json'}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'hollow-oath-' + current().hero + '.json';
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
    if (!data) { toast('This is not a valid Hollow Oath backup.'); return; }
    if (!writeSlot(newRunId(), data.run)) { toast('This device could not store the imported oath.'); return; }
    slotScreen();
    toast('Backup restored as a new save.');
  });
  input.click();
}
function confirmDelete(id: string): void {
  const data = readSlot(id);
  const name = data ? escapeHtml(data.run.name) + ' · Wave ' + data.run.wave : 'Unreadable save';
  openDialog('delete', 'Delete this save?', `<p class="guide">${name}. This removes the playable save from this device. Its achievements remain in the shared record.</p>
    <button class="secondary wide" data-action="delete-confirm" data-id="${id}">Delete save</button>
    <button class="text-action" data-action="close" autofocus>Keep save</button>
    <p class="update-status" id="delete-status" role="status"></p>`, 'THE ARCHIVE');
}

app.addEventListener('submit', event => {
  if (!(event.target instanceof HTMLFormElement) || event.target.id !== 'character-name-form') return;
  event.preventDefault();
  const name = normalizeCharacterName(find<HTMLInputElement>('character-name').value);
  if (name === null) {
    find('name-status').textContent = 'Use up to ' + CHARACTER_NAME_LIMIT + ' characters and omit control characters.';
    return;
  }
  if (dialogKind === 'name') {
    const run = newRun(hero, name);
    slot = run.runId;
    createSlot = true;
    battle = new Battle(run, battleEvent);
    save();
    beginStory(run, false);
  } else if (dialogKind === 'rename') {
    const run = current();
    const previous = run.name;
    run.name = name || HEROES[run.hero].defaultName;
    save();
    if (!saved) {
      run.name = previous;
      find('name-status').textContent = 'This device could not save the new name.';
      return;
    }
    updateHud();
    close();
  }
});

app.addEventListener('input', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.id !== 'mute-sound' && input.id !== 'sound-volume') return;
  const muted = find<HTMLInputElement>('mute-sound').checked;
  const slider = find<HTMLInputElement>('sound-volume');
  const volume = slider.valueAsNumber;
  configureAudio(muted, volume);
  void unlockAudio();
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
  const {action, id} = target.dataset;
  if (action !== 'title-sound') void unlockAudio().then(renderTitleSound);
  switch (action) {
    case 'story-next': advanceStory(); break;
    case 'title': title(); break;
    case 'title-sound': void toggleTitleSound(); break;
    case 'new': heroScreen(); break;
    case 'load': slotScreen(); break;
    case 'delete-slot': confirmDelete(id!); break;
    case 'delete-confirm':
      if (deleteSlot(id!)) {
        slotScreen();
        toast('Save deleted. Achievements kept.');
      } else find('delete-status').textContent = 'This device could not preserve your achievements. The save is still here.';
      break;
    case 'load-slot': {
      slot = id!;
      const data = readSlot(slot);
      if (data) startArena(data.run);
      break;
    }
    case 'hero':
      hero = id as HeroId;
      heroScreen();
      app.querySelector<HTMLElement>('button[data-id="' + hero + '"]')?.focus({preventScroll: true});
      break;
    case 'start': nameDialog(true); break;
    case 'rename': nameDialog(false); break;
    case 'default-name': {
      const input = find<HTMLInputElement>('character-name');
      input.value = HEROES[dialogKind === 'name' ? hero : current().hero].defaultName;
      input.focus();
      break;
    }
    case 'help': help(); break;
    case 'close': close(); break;
    case 'options': options(); break;
    case 'achievements': achievements(); break;
    case 'visit-shop':
    case 'gear':
      gearTab = action === 'visit-shop' && canShop(current()) ? 'shop' : 'stats';
      shopTier = current().wave;
      gearView();
      break;
    case 'portrait': portrait(); break;
    case 'gear-tab':
      gearTab = id!;
      gearView();
      app.querySelector<HTMLElement>('button[data-action="gear-tab"][data-id="' + gearTab + '"]')?.focus();
      break;
    case 'buy-spell': {
      const spell = id as SpellId;
      if (buySpell(current(), spell)) {
        save();
        gearView();
        toast(spellLabel(current(), spell));
        notifyAchievements();
      }
      break;
    }
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
        toast((autoEquip ? 'Equipped ' : 'Purchased ') + gearName(gear, current().hero) + '.');
        notifyAchievements();
      }
      break;
    }
    case 'steel': mode('steel'); break;
    case 'ability':
      if (!suppressTap || event.detail === 0) selectSpell(id as SpellId);
      suppressTap = false;
      break;
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
    case 'update': void updateGame(battle ? () => { save(); return saved; } : undefined); break;
    case 'export': exportSave(); break;
    case 'import': importSave(); break;
  }
});

window.addEventListener('keydown', event => {
  if (event.repeat || screen !== 'arena' || dialogKind || event.altKey || event.ctrlKey || event.metaKey) return;
  void unlockAudio();
  if (event.key === '1') mode('steel');
  const index = Number(event.key) - 2;
  if (index >= 0 && index < SPELL_IDS.length && Number.isInteger(index)) {
    if (event.shiftKey) spellInfo(SPELL_IDS[index]!); else selectSpell(SPELL_IDS[index]!);
  }
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
  if (screen !== 'arena' || !battle || dialogKind || document.hidden) { lastFrame = 0; return; }
  if (lastFrame && (battle.run.phase === 'fight' || battle.run.phase === 'clear')) {
    const elapsed = (now - lastFrame) / 1000;
    battle.tick(Math.min(elapsed, 0.15), elapsed);
    dirty = true;
  }
  lastFrame = now;
  if (recordsDirty) notifyAchievements();
  effects?.draw(now);
  if (now >= nextHud) {
    updateHud();
    nextHud = now + 72;
  }
  if (dirty && now >= nextSave) save();
}
title();
requestAnimationFrame(frame);
