import { newChronicle, type Chronicle } from './achievements.ts';
import {newJourney, offerRoad, type Journey} from './journey.ts';
import {CHAPTER_COUNTER,chapterInfo} from './chapters.ts';
import {
  encounter, ENCOUNTER_COUNT, gearBonus, gearId, gearPrice, HEROES, aegisProtection, spellBoost, MAX_SPELL_RANK, spellUpgradeCost, normalizeCharacterName, spellCost, SPELLS, WAVE_COUNT, xpGoal,
  enchantmentEffect, isSupport, type SupportId,
  type Enemy, type EnemyMove, type Gear, type GearSlot, type HeroId, type SpellId, type Stats, type Strike
} from './content.ts';

export type Phase = 'fight' | 'fallen' | 'clear' | 'victory';
export interface Run {
  runId: string;
  name: string;
  journalRead: number;
  journey: Journey;
  chapterIntro: boolean;
  chapterSeen: number;
  interlude: number | null;
  support: SupportId | null;
  empower: {rank: number; left: number} | null;
  hero: HeroId; level: number; xp: number; gold: number; wave: number; step: number;
  deaths: number; kills: number; hp: number; mp: number; foeHp: number; broken: number;
  playerGauge: number; enemyGauge: number; mode: 'steel' | 'magic'; spell: SpellId;
  chronicle: Chronicle;
  essence: number; essenceEarned: number; essenceClaims: number[]; spellRanks: Partial<Record<SpellId, number>>; ward: number; wardRank: number;
  enemyTurns: number; enemyHeals: number; enemyRecovery: number; intent: EnemyMove | null; castWait: number; castDelay: number;
  phase: Phase; wait: number; inventory: Gear[]; equipped: Partial<Record<GearSlot, string>>;
}
export type BattleEvent =
  | {type: 'hit'; strike: Strike; damage: number; affinity?: 'resisted' | 'immune' | 'weak'}
  | {type: 'hurt'; damage: number; arcane: boolean; move: EnemyMove; blocked: number}
  | {type: 'intent'; move: EnemyMove}
  | {type: 'interrupt'; strike: Strike}
  | {type: 'chapter-phase'; phase: number}
  | {type: 'enemy-heal'; amount: number; drain: boolean}
  | {type: 'seal'; strike: Strike}
  | {type: 'block'; strike: Strike; attempt: Strike}
  | {type: 'heal'; amount: number}
  | {type: 'ward'; amount: number}
  | {type: 'empower'; spell: SupportId; amount: number}
  | {type: 'empty' | 'fallen' | 'enter' | 'armed'}
  | {type: 'kill'; xp: number; gold: number; essence: number; firstClear: boolean; loot?: Gear}
  | {type: 'level'; level: number; spells: SpellId[]};

export function stats(run: Run): Stats {
  const hero = HEROES[run.hero];
  const level = run.level - 1;
  const values = { ...hero.base };
  const keys = Object.keys(values) as (keyof Stats)[];
  for (const key of keys) values[key] += hero.gain[key] * (key === 'regen' ? 16 * Math.log1p(level / 16) : level);
  for (const gear of run.inventory) {
    if (run.equipped[gear.slot] !== gearId(gear)) continue;
    const bonus = gearBonus(gear);
    for (const key of keys) values[key] += bonus[key] ?? 0;
  }
  values.hp = Math.round(values.hp);
  values.mp = Math.round(values.mp);
  return values;
}
export function sealFloor(foe: Enemy, index: number): number {
  return index < foe.seals.length ? Math.ceil(foe.hp * (1 - index / foe.seals.length)) : 0;
}
export function enemyStage(run: Run, foe: Enemy): number {
  let stage = 0;
  while (stage + 1 < foe.seals.length && run.foeHp <= sealFloor(foe, stage + 1)) stage++;
  return stage;
}
export function enemyAffinity(run: Run, foe: Enemy): Enemy['affinity'] {
  if (!foe.boss || (run.wave < 5 && !foe.chapter)) return foe.affinity;
  const weak = foe.seals[enemyStage(run, foe)] ?? 'steel';
  const choices: Strike[] = ['steel', 'ember', 'rime', 'storm'];
  return {weak, resists: choices[(choices.indexOf(weak) + 2) % 4]!, immune: false};
}
function recoveryCeiling(run: Run, foe: Enemy): number {
  return foe.seals.length ? sealFloor(foe, Math.max(enemyStage(run, foe), run.broken - 1, 0)) : foe.hp;
}
export function enemyPreparation(foe: Enemy, move: EnemyMove): number {
  if (move === 'steel') return 0;
  if (foe.chapter) return 3;
  if (foe.boss) return 1.8;
  // Routine spells use the normal Speed clock. Only special blows need an extra wind-up.
  return move === 'heavy' || move === 'mend' || move === 'drain' ? 1 : 0;
}
export function nextEnemyMove(run: Run, foe: Enemy): EnemyMove {
  const moves: readonly EnemyMove[] = foe.chapter ? chapterInfo(run.wave).moves[enemyStage(run,foe)]! : foe.moves;
  const move = moves[(run.enemyTurns + (foe.chapter ? 0 : enemyStage(run, foe))) % moves.length]!;
  return move === 'mend' && (run.enemyHeals >= foe.healLimit || run.foeHp >= Math.min(foe.hp * .85, recoveryCeiling(run, foe)) || run.enemyRecovery >= Math.floor(foe.hp * .18)) ? 'steel' : move;
}
export function activeSeal(run: Run, foe: Enemy): Strike | undefined {
  return run.foeHp >= 1 && run.foeHp <= sealFloor(foe, run.broken) ? foe.seals[run.broken] : undefined;
}
function openEncounter(run: Run): void {
  const foe=encounter(run.wave, run.step);
  run.foeHp = foe.hp;
  run.chapterIntro = Boolean(foe.chapter);
  run.broken = 0;
  run.enemyTurns = run.enemyHeals = run.enemyRecovery = run.castWait = run.castDelay = 0;
  run.intent = null;
  run.wait = 0.65;
  run.playerGauge = 0;
  run.enemyGauge = 0;
}

export function newRunId(): string {
  return 'run-' + Array.from(crypto.getRandomValues(new Uint32Array(4)), part => part.toString(36)).join('-');
}
export function newRun(hero: HeroId, name: string = HEROES[hero].defaultName): Run {
  const run: Run = {
    runId: newRunId(), journalRead: 0, journey: newJourney(), chapterIntro: false, chapterSeen: 0, interlude: null, support: null, empower: null, name: normalizeCharacterName(name) || HEROES[hero].defaultName, hero, level: 1, xp: 0, gold: 0, wave: 1, step: 1, deaths: 0, kills: 0,
    hp: HEROES[hero].base.hp, mp: HEROES[hero].base.mp, foeHp: 0, broken: 0,
    playerGauge: 0, enemyGauge: 0, mode: 'steel', spell: 'ember',
    chronicle: newChronicle(), essence: 0, essenceEarned: 0, essenceClaims: [], spellRanks: {}, ward: 0, wardRank: 1, enemyTurns: 0, enemyHeals: 0, enemyRecovery: 0, intent: null, castWait: 0, castDelay: 0,
    phase: 'fight', wait: 0, inventory: [], equipped: {}
  };
  openEncounter(run);
  return run;
}

export function resumeWave(run: Run): void {
  if (run.interlude !== null || needsSupportChoice(run)) return;
  if (run.phase === 'fallen' || run.phase === 'victory') run.step = 1;
  else if (run.phase === 'clear') {
    run.wave++;
    run.step = 1;
    run.chronicle.waveFallen = false;
  } else return;
  const values = stats(run);
  run.hp = values.hp;
  run.mp = values.mp;
  if (run.mode === 'magic' && run.spell === 'mend') run.mode = 'steel';
  run.ward = 0;
  run.empower = null;
  run.chronicle.gearFreeAttempt = Object.keys(run.equipped).length === 0;
  run.chronicle.spellFreeAttempt = true;
  run.phase = 'fight';
  openEncounter(run);
}

export function canShop(run: Run): boolean {
  return run.phase === 'fallen';
}
export function finishChapterIntro(run: Run): void {
  run.chapterIntro=false;
}
export function chapterCounter(run: Run,foe: Enemy): Strike | undefined {
  if(!foe.chapter || !run.intent)return;
  const strike=CHAPTER_COUNTER[run.intent];
  return strike && (strike==='steel' || knownRank(run,strike)) ? strike : strike ? 'ember' : undefined;
}

export function knownRank(run: Run, id: SpellId): number {
  if (isSupport(id) && (run.support !== id || (run.wave < 5 && !(run.wave === 4 && run.phase === 'clear')))) return 0;
  const spell = SPELLS[id];
  return run.level < spell.level ? 0 : (run.spellRanks[id] ?? (spell.price ? 0 : 1));
}
export function preparedSpellCost(run: Run): number {
  return actionSpellCost(run, run.spell);
}
export function actionSpellCost(run: Run, id: SpellId): number {
  const extra = run.support === 'surge' && run.empower && SPELLS[id].strike ? enchantmentEffect('surge', run.empower.rank).surcharge : 0;
  return spellCost(id, knownRank(run, id)) + extra;
}
export function needsSupportChoice(run: Run): boolean {
  return run.support === null && run.phase !== 'victory' && (run.wave >= 5 || (run.wave === 4 && run.phase === 'clear'));
}
export function chooseSupport(run: Run, id: SupportId): boolean {
  if (!isSupport(id) || !needsSupportChoice(run) || run.interlude !== null) return false;
  const inherited = run.spellRanks.aegis ?? 1;
  delete run.spellRanks.aegis;
  run.support = id;
  run.spellRanks[id] = inherited;
  run.mode = 'steel';
  run.ward = 0;
  run.empower = null;
  return true;
}
export function finishInterlude(run: Run): boolean {
  if (run.interlude === null) return false;
  const bit = 1 << (run.interlude / 4 - 1);
  run.chapterSeen |= bit;
  run.journalRead |= bit;
  run.interlude = null;
  return true;
}
export function workshopPrice(run: Run, id: SpellId): number | undefined {
  const rank = knownRank(run, id);
  if (isSupport(id) && !rank) return undefined;
  if (run.level < SPELLS[id].level || rank >= MAX_SPELL_RANK) return undefined;
  return rank === 0 ? SPELLS[id].price : spellUpgradeCost(rank);
}
export function buySpell(run: Run, id: SpellId): boolean {
  const price = workshopPrice(run, id);
  if (!canShop(run) || price === undefined || run.essence < price) return false;
  run.essence -= price;
  run.spellRanks[id] = knownRank(run, id) + 1;
  return true;
}

export function availableEssence(run: Run, foe: Enemy): number {
  return foe.essence;
}

export function purchasePrice(run: Run, gear: Gear): number {
  return gearPrice(gear);
}
export function buyGear(run: Run, gear: Gear): boolean {
  if (!canShop(run) || gear.relic || gear.tier < 1 || gear.tier > run.wave || !Number.isInteger(gear.tier) ||
      run.gold < purchasePrice(run, gear) || run.inventory.some(item => gearId(item) === gearId(gear))) return false;
  run.gold -= purchasePrice(run, gear);
  run.inventory.push(gear);
  return true;
}

export function equipGear(run: Run, gear: Gear | undefined, slot: GearSlot): void {
  const old = stats(run);
  if (gear) {
    if (gear.slot !== slot || !run.inventory.some(item => gearId(item) === gearId(gear))) return;
    run.equipped[slot] = gearId(gear);
    run.chronicle.gearFreeAttempt = false;
  } else delete run.equipped[slot];
  const next = stats(run);
  if (run.hp > 0) run.hp = Math.max(1, Math.min(next.hp, run.hp * next.hp / old.hp));
  run.mp = Math.min(run.mp, next.mp);
}
export function weaponRank(run: Run): number {
  return run.inventory.find(gear => gear.slot === 'weapon' && run.equipped.weapon === gearId(gear))?.tier ?? 1;
}
export function wavePower(run: Run): number {
  return 2 ** -Math.max(0, run.wave - weaponRank(run));
}
const impact = (power: number, protection: number) => Math.max(1, Math.round(power * 54 / (54 + protection)));

export class Battle {
  run: Run;
  foe: Enemy;
  player: Stats;
  private send: (event: BattleEvent) => void;
  private random: () => number;

  constructor(run: Run, send: (event: BattleEvent) => void, random = Math.random) {
    this.run = run;
    this.send = send;
    this.random = random;
    this.foe = encounter(run.wave, run.step);
    this.prepareSeals();
    this.player = stats(run);
    this.settleMend();
  }
  refresh(): void {
    this.foe = encounter(this.run.wave, this.run.step);
    this.prepareSeals();
    this.player = stats(this.run);
    this.settleMend();
  }
  private settleMend(): void {
    const run = this.run;
    if (run.mode === 'magic' && run.spell === 'mend' && (run.hp >= this.player.hp || run.mp + 1e-8 < preparedSpellCost(run))) run.mode = 'steel';
  }
  private prepareSeals(): void {
    this.foe.seals = this.foe.seals.map(strike => strike === 'steel' || knownRank(this.run, strike) ? strike : 'steel');
  }
  tick(seconds: number, realSeconds = seconds): void {
    const run = this.run;
    if (!Number.isFinite(seconds) || seconds <= 0 || run.journey.pending !== null || run.chapterIntro || run.interlude !== null || needsSupportChoice(run)) return;
    this.settleMend();
    const clock = run.chronicle;
    const timeScale = Number.isFinite(realSeconds) && realSeconds > 0 ? realSeconds / seconds : 1;
    const track = (elapsed: number) => {
      if (!clock.finished && clock.activeSeconds !== null) clock.activeSeconds += elapsed * timeScale;
    };
    let remaining = seconds;
    if (run.phase === 'clear') {
      const elapsed = Math.min(run.wait, remaining);
      run.wait -= elapsed;
      track(elapsed);
      remaining -= elapsed;
      if (run.wait > 1e-8) return;
      resumeWave(run);
      this.refresh();
      this.send({ type: 'enter' });
    }
    if (run.phase !== 'fight') return;
    const epsilon = 1e-8;
    // Schedule both clocks on the same time axis. The enemy acts first on an exact tie.
    while (remaining > epsilon && run.phase === 'fight' && run.journey.pending === null && !run.chapterIntro && run.interlude === null && !needsSupportChoice(run)) {
      if (run.wait > epsilon) {
        const elapsed = Math.min(run.wait, remaining);
        run.wait -= elapsed;
        remaining -= elapsed;
        track(elapsed);
        this.regenerate(elapsed);
        if (run.wait > epsilon) break;
        run.wait = 0;
        if (run.foeHp === 0) {
          run.step++;
          openEncounter(run);
          run.wait = 0.3;
          this.refresh();
          this.send({ type: 'enter' });
        }
        continue;
      }
      const playerSpeed = this.player.spd * (run.journey.boon?.kind === 'haste' ? 1.12 : 1) * (run.support === 'haste' && run.empower ? enchantmentEffect('haste', run.empower.rank).multiplier : 1);
      const playerAt = Math.max(0, (1 - run.playerGauge) / playerSpeed);
      const enemyAt = run.intent ? run.castWait : Math.max(0, (1 - run.enemyGauge) / this.foe.spd);
      const elapsed = Math.min(remaining, playerAt, enemyAt);
      run.playerGauge += elapsed * playerSpeed;
      if (run.intent) run.castWait = Math.max(0, run.castWait - elapsed);
      else run.enemyGauge += elapsed * this.foe.spd;
      remaining -= elapsed;
      track(elapsed);
      this.regenerate(elapsed);
      if (run.intent && run.castWait <= epsilon) {
        const move = run.intent;
        run.intent = null;
        run.castWait = 0;
        this.enemyAction(move);
      } else if (!run.intent && run.enemyGauge >= 1 - epsilon) {
        run.enemyGauge = 0;
        const move = nextEnemyMove(run, this.foe);
        const preparation = enemyPreparation(this.foe, move);
        if (!preparation) this.enemyAction(move);
        else {
          run.intent = move;
          run.castWait = preparation;
          run.castDelay = 0;
          this.send({type: 'intent', move});
        }
      }
      if (run.phase === 'fight' && run.playerGauge >= 1 - epsilon) {
        run.playerGauge = 0;
        this.playerTurn();
      }
    }
  }
  private recoverEnemy(wanted: number, drain: boolean): void {
    const run = this.run, foe = this.foe;
    const ceiling = recoveryCeiling(run, foe);
    const amount = Math.max(0, Math.min(Math.round(wanted), ceiling - run.foeHp, Math.floor(foe.hp * .18) - run.enemyRecovery));
    run.foeHp += amount;
    run.enemyRecovery += amount;
    if (amount) this.send({type: 'enemy-heal', amount, drain});
  }
  private enemyAction(move: EnemyMove): void {
    const run = this.run;
    run.enemyTurns++;
    if (move === 'mend') {
      run.enemyHeals++;
      this.recoverEnemy(this.foe.hp * .055, false);
      return;
    }
    const arcane = !['steel', 'heavy'].includes(move);
    const raw = this.rollDamage(impact(this.foe.atk * (move === 'heavy' ? 1.35 : move === 'drain' ? .95 : move === 'rime' ? 1 : arcane ? 1.12 : 1), arcane ? this.player.res * (move === 'storm' ? .65 : 1) : this.player.def) * (run.journey.boon?.kind === 'guard' ? .88 : 1));
    const protection = run.ward > 0 ? aegisProtection(run.wardRank).reduction : 0;
    const reduced = Math.max(1, Math.round(raw * (1 - protection)));
    if (run.ward > 0) run.ward--;
    const damage = Math.min(run.hp, reduced);
    run.hp = Math.max(0, run.hp - reduced);
    if (move === 'rime') run.playerGauge = Math.max(0, run.playerGauge - .18);
    this.send({type: 'hurt', damage: reduced, arcane, move, blocked: raw - reduced});
    if (move === 'drain') this.recoverEnemy(damage * .5, true);
    if (!run.hp) {
      run.phase = 'fallen'; run.deaths++;
      run.chronicle.streak = run.chronicle.cleanStreak = 0;
      run.chronicle.waveFallen = true;
      this.send({type: 'fallen'});
    }
  }
  private rollDamage(base: number): number {
    return Math.max(1, Math.round(base * (.88 + Math.max(0, Math.min(1, this.random())) * .24)));
  }
  private regenerate(elapsed: number): void {
    this.run.mp = Math.min(this.player.mp, this.run.mp + elapsed * this.player.regen);
  }
  private settleMana(): void {
    if (this.run.mode === 'magic' && this.run.mp + 1e-8 < preparedSpellCost(this.run)) {
      this.run.mode = 'steel';
      this.send({type: 'empty'});
    }
  }
  private playerTurn(): void {
    const run = this.run;
    if (run.mode === 'magic' && !knownRank(run, run.spell)) run.mode = 'steel';
    const spell = SPELLS[run.spell];
    const rank = knownRank(run, run.spell);
    const cost = preparedSpellCost(run);
    const boost = spellBoost(rank);
    let strike: Strike = 'steel';
    const empowered = run.empower;
    // Haste counts the hero's actions, not wall time. Menus and transitions consume nothing.
    if (run.support === 'haste' && empowered && --empowered.left === 0) run.empower = null;
    const shouldCast = !isSupport(run.spell) || (run.ward === 0 && !empowered);
    if (run.mode === 'magic' && shouldCast) {
      if (run.mp + 1e-8 < cost) {
        run.mode = 'steel';
        this.send({type: 'empty'});
      } else {
        run.mp = Math.max(0, run.mp - cost);
        run.chronicle.spellUses[run.spell]++;
        run.chronicle.spellFreeAttempt = false;
        if (run.spell === 'mend') {
          const amount = Math.min(this.player.hp - run.hp, Math.round(this.healPower() * boost));
          run.hp = Math.min(this.player.hp, run.hp + amount);
          if (run.hp >= this.player.hp) run.mode = 'steel';
          this.settleMana();
          this.send({type: 'heal', amount: Math.round(amount)});
          return;
        }
        if (run.spell === 'aegis') {
          run.ward = aegisProtection(rank).charges;
          run.wardRank = rank;
          run.mode = 'steel';
          this.send({type: 'ward', amount: run.ward});
          return;
        }
        if (isSupport(run.spell)) {
          const effect = enchantmentEffect(run.spell, rank);
          run.empower = {rank, left: effect.charges};
          run.mode = 'steel';
          this.send({type: 'empower', spell: run.spell, amount: effect.charges});
          return;
        }
        strike = spell.strike!;
      }
    }
    const enhanced = empowered && ((run.support === 'surge' && strike !== 'steel') || (run.support === 'fury' && strike === 'steel'));
    const multiplier = enhanced ? enchantmentEffect(run.support as 'surge' | 'fury', empowered.rank).multiplier : 1;
    if (enhanced && --empowered.left === 0) run.empower = null;
    this.settleMana();
    if(chapterCounter(run,this.foe)===strike) {
      run.intent=null; run.castWait=run.castDelay=run.enemyGauge=0; run.enemyTurns++;
      this.send({type:'interrupt',strike});
    }
    const seal = activeSeal(run, this.foe);
    if (seal) {
      if (seal !== strike) {
        this.send({type: 'block', strike: seal, attempt: strike});
        return;
      }
      run.broken++;
      run.chronicle.seals++;
      this.send({type: 'seal', strike: seal});
    }
    const power = strike === 'ember' ? 1.36 : strike === 'rime' ? 1.18 : 1.62;
    const baseDamage = strike === 'steel' ? impact(this.player.atk * multiplier, this.foe.def) :
      impact(this.player.mag * power * boost * multiplier, this.foe.res * (strike === 'storm' ? 0.38 : 1));
    const trait = enemyAffinity(run, this.foe);
    const affinity = trait?.resists === strike ? (trait.immune ? 'immune' : 'resisted') :
      trait?.weak === strike ? 'weak' : undefined;
    if (affinity === 'immune') run.chronicle.immuneHits++;
    const roadPower = run.journey.boon?.kind === (strike === 'steel' ? 'steel' : 'magic') ? 1.15 : 1;
    const damage = affinity === 'immune' ? 0 : this.rollDamage(baseDamage * wavePower(run) * roadPower *
      (affinity === 'resisted' ? .30 : affinity === 'weak' ? 1.5 : 1));
    if (strike === 'rime' && damage > 0) {
      const slow = Math.min(.32, .23 + (rank - 1) * .01);
      if (run.intent) { const delay = Math.min(slow, .6 - run.castDelay); run.castWait += delay; run.castDelay += delay; }
      else run.enemyGauge = Math.max(0, run.enemyGauge - slow);
    }
    const nextFloor = sealFloor(this.foe, run.broken);
    const actual = Math.min(Math.max(0, run.foeHp - nextFloor), damage);
    const priorStage=enemyStage(run,this.foe);
    run.foeHp -= actual;
    if(this.foe.chapter && run.foeHp>0 && enemyStage(run,this.foe)!==priorStage) {
      run.intent=null;run.castWait=run.castDelay=run.enemyGauge=0;
      this.send({type:'chapter-phase',phase:enemyStage(run,this.foe)});
    }
    if (actual > 0) {
      run.chronicle.hits++;
      if (strike === 'steel') run.chronicle.steelHits++;
      if (affinity === 'weak') run.chronicle.weakHits++;
    }
    this.send({type: 'hit', strike, damage: nextFloor > 0 ? actual : damage, affinity});
    if (run.foeHp === 0) this.win();
    else if (run.foeHp === nextFloor) this.send({type: 'armed'});
  }
  private healPower(): number {
    return Math.round((this.player.hp * 0.085 + this.player.mag * 0.73) * (this.run.hero === 'oathkeeper' ? 1.35 : 1));
  }
  private win(): void {
    const run = this.run;
    const foe = this.foe;
    run.gold += foe.gold;
    run.xp += foe.xp;
    run.kills++;
    if (run.journey.boon && --run.journey.boon.left === 0) run.journey.boon = null;
    const clock = run.chronicle;
    clock.streak++;
    clock.bestStreak = Math.max(clock.bestStreak, clock.streak);
    if (foe.boss) {
      if (clock.gearFreeAttempt) clock.clearedGearFree = true;
      if (clock.spellFreeAttempt) clock.clearedSpellFree = true;
      if (run.hp / this.player.hp <= 0.05) clock.nearDeathClear = true;
    }
    const before = run.level;
    while (run.xp >= xpGoal(run.level)) run.xp -= xpGoal(run.level++);
    if (run.level > before) {
      const old = this.player;
      this.player = stats(run);
      run.hp = Math.min(this.player.hp, run.hp + this.player.hp - old.hp + this.player.hp * 0.105 * (run.level - before));
      run.mp = Math.min(this.player.mp, run.mp + this.player.mp - old.mp + this.player.mp * 0.28 * (run.level - before));
      const spells = (Object.keys(SPELLS) as SpellId[]).filter(id => !isSupport(id) && SPELLS[id].level > before && SPELLS[id].level <= run.level);
      this.send({type: 'level', level: run.level, spells});
    }
    let loot: Gear | undefined;
    if (foe.boss && (run.wave === 1 || run.wave % 8 === 0 || this.random() < 0.23)) {
      const slots = ['ring', 'weapon', 'shield', 'helm', 'boots', 'armor'] as const;
      const candidate: Gear = {slot: slots[(run.wave - 1) % slots.length]!, tier: run.wave, relic: true};
      if (!run.inventory.some(item => gearId(item) === gearId(candidate))) {
        loot = candidate;
        run.inventory.push(loot);
      }
    }
    if (foe.boss) {
      if (!clock.finished && !clock.waveFallen) {
        clock.cleanWaves++;
        clock.cleanStreak++;
        clock.bestCleanStreak = Math.max(clock.bestCleanStreak, clock.cleanStreak);
      }
      if (run.wave === WAVE_COUNT) clock.finished = true;
      run.phase = run.wave === WAVE_COUNT ? 'victory' : 'clear';
      run.wait = run.phase === 'clear' ? 0.95 : 0;
      if (foe.chapter && run.wave < WAVE_COUNT && !(run.chapterSeen & (1 << (run.wave / 4 - 1)))) run.interlude = run.wave;
      if (run.phase === 'victory') run.chapterSeen |= 128;
    }
    else run.wait = 0.72;
    const essence = availableEssence(run, foe);
    const claim=(run.wave-1)*ENCOUNTER_COUNT+run.step;
    const firstClear=essence>0 && !run.essenceClaims.includes(claim);
    if (essence) {
      run.essence = Math.min(Number.MAX_SAFE_INTEGER,run.essence+essence);
      run.essenceEarned = Math.min(Number.MAX_SAFE_INTEGER,run.essenceEarned+essence);
      if(firstClear)run.essenceClaims.push(claim);
    }
    offerRoad(run);
    this.send({type: 'kill', xp: foe.xp, gold: foe.gold, essence, firstClear, loot});
  }
}
