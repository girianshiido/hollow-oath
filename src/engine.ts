import { newChronicle, type Chronicle } from './achievements.ts';
import {
  encounter, ENCOUNTER_COUNT, gearBonus, gearId, gearPrice, HEROES, MAX_SPELL_RANK, spellCost, SPELLS, WAVE_COUNT, xpGoal,
  type Enemy, type Gear, type GearSlot, type HeroId, type SpellId, type Stats, type Strike
} from './content.ts';

export type Phase = 'fight' | 'fallen' | 'clear' | 'victory';
export interface Run {
  hero: HeroId; level: number; xp: number; gold: number; wave: number; step: number;
  deaths: number; kills: number; hp: number; mp: number; foeHp: number; broken: number;
  playerGauge: number; enemyGauge: number; mode: 'steel' | 'magic'; spell: SpellId;
  chronicle: Chronicle;
  essence: number; essenceClaims: number[]; spellRanks: Partial<Record<SpellId, number>>; ward: number;
  phase: Phase; wait: number; inventory: Gear[]; equipped: Partial<Record<GearSlot, string>>;
}
export type BattleEvent =
  | {type: 'hit'; strike: Strike; damage: number; affinity?: 'resisted' | 'immune' | 'weak'}
  | {type: 'hurt'; damage: number; arcane: boolean}
  | {type: 'seal'; strike: Strike}
  | {type: 'block'; strike: Strike; attempt: Strike}
  | {type: 'heal'; amount: number}
  | {type: 'ward'; amount: number}
  | {type: 'empty' | 'fallen' | 'enter' | 'armed'}
  | {type: 'kill'; xp: number; gold: number; essence: number; loot?: Gear}
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
const thresholds: Record<number, number[]> = { 0: [], 1: [1], 2: [1, 0.52], 3: [1, 0.66, 0.33] };
function sealFloor(foe: Enemy, index: number): number {
  return Math.ceil(foe.hp * (thresholds[foe.seals.length]?.[index] ?? 0));
}
export function activeSeal(run: Run, foe: Enemy): Strike | undefined {
  return run.foeHp >= 1 && run.foeHp <= sealFloor(foe, run.broken) ? foe.seals[run.broken] : undefined;
}
function openEncounter(run: Run): void {
  run.foeHp = encounter(run.wave, run.step).hp;
  run.broken = 0;
  run.wait = 0.65;
  run.playerGauge = 0;
  run.enemyGauge = 0;
}

export function newRun(hero: HeroId): Run {
  const run: Run = {
    hero, level: 1, xp: 0, gold: 0, wave: 1, step: 1, deaths: 0, kills: 0,
    hp: HEROES[hero].base.hp, mp: HEROES[hero].base.mp, foeHp: 0, broken: 0,
    playerGauge: 0, enemyGauge: 0, mode: 'steel', spell: 'ember',
    chronicle: newChronicle(), essence: 0, essenceClaims: [], spellRanks: {}, ward: 0,
    phase: 'fight', wait: 0, inventory: [], equipped: {}
  };
  openEncounter(run);
  return run;
}

export function resumeWave(run: Run): void {
  if (run.phase === 'fallen' || run.phase === 'victory') run.step = 1;
  else if (run.phase === 'clear') {
    run.wave++;
    run.step = 1;
    run.chronicle.waveFallen = false;
  } else return;
  const values = stats(run);
  run.hp = values.hp;
  run.mp = values.mp;
  run.ward = 0;
  run.phase = 'fight';
  openEncounter(run);
}

export function canShop(run: Run): boolean {
  return run.phase === 'fallen';
}

export function knownRank(run: Run, id: SpellId): number {
  const spell = SPELLS[id];
  return run.level < spell.level ? 0 : (run.spellRanks[id] ?? (spell.price ? 0 : 1));
}
export function preparedSpellCost(run: Run): number {
  return spellCost(run.spell, knownRank(run, run.spell));
}
export function workshopPrice(run: Run, id: SpellId): number | undefined {
  const rank = knownRank(run, id);
  if (run.level < SPELLS[id].level || rank >= MAX_SPELL_RANK) return undefined;
  return rank === 0 ? SPELLS[id].price : rank === 1 ? 4 : 12;
}
export function buySpell(run: Run, id: SpellId): boolean {
  const price = workshopPrice(run, id);
  if (!canShop(run) || price === undefined || run.essence < price) return false;
  run.essence -= price;
  run.spellRanks[id] = knownRank(run, id) + 1;
  return true;
}

export function availableEssence(run: Run, foe: Enemy): number {
  const claim = (run.wave - 1) * ENCOUNTER_COUNT + run.step;
  return run.essenceClaims.includes(claim) ? 0 : foe.essence;
}

export function buyGear(run: Run, gear: Gear): boolean {
  if (!canShop(run) || gear.relic || gear.tier < 1 || gear.tier > run.wave || !Number.isInteger(gear.tier) ||
      run.gold < gearPrice(gear) || run.inventory.some(item => gearId(item) === gearId(gear))) return false;
  run.gold -= gearPrice(gear);
  run.inventory.push(gear);
  return true;
}

export function equipGear(run: Run, gear: Gear | undefined, slot: GearSlot): void {
  const old = stats(run);
  if (gear) {
    if (gear.slot !== slot || !run.inventory.some(item => gearId(item) === gearId(gear))) return;
    run.equipped[slot] = gearId(gear);
  } else delete run.equipped[slot];
  const next = stats(run);
  if (run.hp > 0) run.hp = Math.max(1, Math.min(next.hp, run.hp * next.hp / old.hp));
  run.mp = Math.min(run.mp, next.mp);
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
    this.player = stats(run);
  }
  refresh(): void {
    this.foe = encounter(this.run.wave, this.run.step);
    this.player = stats(this.run);
  }
  tick(seconds: number, realSeconds = seconds): void {
    const run = this.run;
    if (!Number.isFinite(seconds) || seconds <= 0) return;
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
    while (remaining > epsilon && run.phase === 'fight') {
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
      const playerAt = Math.max(0, (1 - run.playerGauge) / this.player.spd);
      const enemyAt = Math.max(0, (1 - run.enemyGauge) / this.foe.spd);
      const elapsed = Math.min(remaining, playerAt, enemyAt);
      run.playerGauge += elapsed * this.player.spd;
      run.enemyGauge += elapsed * this.foe.spd;
      remaining -= elapsed;
      track(elapsed);
      this.regenerate(elapsed);
      if (run.enemyGauge >= 1 - epsilon) {
        run.enemyGauge = 0;
        const defense = this.foe.arcane ? this.player.res : this.player.def;
        const raw = impact(this.foe.atk, defense);
        const damage = Math.max(0, raw - run.ward);
        run.ward = 0;
        run.hp = Math.max(0, run.hp - damage);
        this.send(damage ? {type: 'hurt', damage, arcane: this.foe.arcane} : {type: 'ward', amount: raw});
        if (!run.hp) {
          run.phase = 'fallen';
          run.deaths++;
          clock.streak = 0;
          clock.cleanStreak = 0;
          clock.waveFallen = true;
          this.send({type: 'fallen'});
        }
      }
      if (run.phase === 'fight' && run.playerGauge >= 1 - epsilon) {
        run.playerGauge = 0;
        this.playerTurn();
      }
    }
  }
  private regenerate(elapsed: number): void {
    this.run.mp = Math.min(this.player.mp, this.run.mp + elapsed * this.player.regen);
  }
  private playerTurn(): void {
    const run = this.run;
    const spell = SPELLS[run.spell];
    const rank = knownRank(run, run.spell);
    const cost = spellCost(run.spell, rank);
    const boost = 1 + (rank - 1) * 0.24;
    let strike: Strike = 'steel';
    const shouldCast = run.spell === 'mend'
      ? this.player.hp - run.hp >= Math.min(this.player.hp * 0.2, this.healPower())
      : run.spell !== 'aegis' || run.ward === 0;
    if (run.mode === 'magic' && shouldCast) {
      if (run.mp + 1e-8 < cost) {
        run.mode = 'steel';
        this.send({type: 'empty'});
      } else {
        run.mp = Math.max(0, run.mp - cost);
        run.chronicle.spellUses[run.spell]++;
        if (run.mp + 1e-8 < cost) {
          run.mode = 'steel';
          this.send({type: 'empty'});
        }
        if (run.spell === 'mend') {
          const amount = Math.min(this.player.hp - run.hp, Math.round(this.healPower() * boost));
          run.hp += amount;
          this.send({type: 'heal', amount: Math.round(amount)});
          return;
        }
        if (run.spell === 'aegis') {
          run.ward = Math.round((this.player.hp * 0.06 + this.player.mag * 0.65) * boost);
          this.send({type: 'ward', amount: run.ward});
          return;
        }
        strike = spell.strike!;
      }
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
    const power = strike === 'ember' ? 1.36 : strike === 'rime' ? 1.18 : run.spell === 'verdict' ? 2.45 : 1.62;
    const baseDamage = strike === 'steel' ? impact(this.player.atk, this.foe.def) :
      impact(this.player.mag * power * boost, this.foe.res * (strike === 'storm' ? 0.38 : 1));
    const trait = this.foe.affinity;
    const affinity = trait?.resists === strike ? (trait.immune ? 'immune' : 'resisted') :
      trait?.weak === strike ? 'weak' : undefined;
    const damage = affinity === 'immune' ? 0 : Math.max(1, Math.round(baseDamage *
      (affinity === 'resisted' ? 0.30 : affinity === 'weak' ? 1.5 : 1)));
    if (strike === 'rime' && damage > 0) run.enemyGauge = Math.max(0, run.enemyGauge - 0.23);
    const nextFloor = sealFloor(this.foe, run.broken);
    const actual = Math.min(Math.max(0, run.foeHp - nextFloor), damage);
    run.foeHp -= actual;
    if (actual > 0) {
      run.chronicle.hits++;
      if (strike === 'steel') run.chronicle.steelHits++;
      if (affinity === 'weak') run.chronicle.weakHits++;
    }
    this.send({type: 'hit', strike, damage: actual, affinity});
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
    const clock = run.chronicle;
    clock.streak++;
    clock.bestStreak = Math.max(clock.bestStreak, clock.streak);
    const before = run.level;
    while (run.xp >= xpGoal(run.level)) run.xp -= xpGoal(run.level++);
    if (run.level > before) {
      const old = this.player;
      this.player = stats(run);
      run.hp = Math.min(this.player.hp, run.hp + this.player.hp - old.hp + this.player.hp * 0.105 * (run.level - before));
      run.mp = Math.min(this.player.mp, run.mp + this.player.mp - old.mp + this.player.mp * 0.28 * (run.level - before));
      const spells = (Object.keys(SPELLS) as SpellId[]).filter(id => !SPELLS[id].price && SPELLS[id].level > before && SPELLS[id].level <= run.level);
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
    }
    else run.wait = 0.72;
    const essence = availableEssence(run, foe);
    if (essence) {
      run.essence += essence;
      run.essenceClaims.push((run.wave - 1) * ENCOUNTER_COUNT + run.step);
    }
    this.send({type: 'kill', xp: foe.xp, gold: foe.gold, essence, loot});
  }
}
