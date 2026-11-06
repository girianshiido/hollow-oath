import {
  encounter, ENCOUNTER_COUNT, gearBonus, gearId, gearPrice, HEROES, SPELLS, WAVE_COUNT, xpGoal,
  type Enemy, type Gear, type GearSlot, type HeroId, type SpellId, type Stats, type Strike
} from './content.ts';

export type Phase = 'fight' | 'fallen' | 'clear' | 'victory';
export interface Run {
  hero: HeroId; level: number; xp: number; gold: number; wave: number; step: number;
  deaths: number; kills: number; hp: number; mp: number; foeHp: number; broken: number;
  playerGauge: number; enemyGauge: number; mode: 'steel' | 'magic'; spell: SpellId;
  phase: Phase; wait: number; inventory: Gear[]; equipped: Partial<Record<GearSlot, string>>;
}
export type BattleEvent =
  | {type: 'hit'; strike: Strike; damage: number}
  | {type: 'hurt'; damage: number; arcane: boolean}
  | {type: 'seal' | 'block'; strike: Strike}
  | {type: 'heal'; amount: number}
  | {type: 'empty' | 'fallen' | 'enter' | 'armed'}
  | {type: 'kill'; xp: number; gold: number; loot?: Gear}
  | {type: 'level'; level: number; spells: SpellId[]};

export function stats(run: Run): Stats {
  const hero = HEROES[run.hero];
  const level = run.level - 1;
  const values = { ...hero.base };
  const keys = Object.keys(values) as (keyof Stats)[];
  for (const key of keys) values[key] += hero.gain[key] * level;
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
  } else return;
  const values = stats(run);
  run.hp = values.hp;
  run.mp = values.mp;
  run.phase = 'fight';
  openEncounter(run);
}

export function buyGear(run: Run, gear: Gear): boolean {
  if (gear.relic || gear.tier < 1 || gear.tier > run.wave || !Number.isInteger(gear.tier) ||
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
  tick(seconds: number): void {
    const run = this.run;
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    let remaining = seconds;
    if (run.phase === 'clear') {
      const elapsed = Math.min(run.wait, remaining);
      run.wait -= elapsed;
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
      this.regenerate(elapsed);
      if (run.enemyGauge >= 1 - epsilon) {
        run.enemyGauge = 0;
        const defense = this.foe.arcane ? this.player.res : this.player.def;
        const damage = impact(this.foe.atk, defense);
        run.hp = Math.max(0, run.hp - damage);
        this.send({type: 'hurt', damage, arcane: this.foe.arcane});
        if (!run.hp) {
          run.phase = 'fallen';
          run.deaths++;
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
    let strike: Strike = 'steel';
    if (run.mode === 'magic' && (run.spell !== 'mend' || this.player.hp - run.hp >= Math.min(this.player.hp * 0.2, this.healPower()))) {
      if (run.mp + 1e-8 < spell.cost) {
        run.mode = 'steel';
        this.send({type: 'empty'});
      } else {
        run.mp = Math.max(0, run.mp - spell.cost);
        if (run.mp + 1e-8 < spell.cost) {
          run.mode = 'steel';
          this.send({type: 'empty'});
        }
        if (run.spell === 'mend') {
          const amount = Math.min(this.player.hp - run.hp, this.healPower());
          run.hp += amount;
          this.send({type: 'heal', amount: Math.round(amount)});
          return;
        }
        strike = run.spell;
      }
    }
    const seal = activeSeal(run, this.foe);
    if (seal) {
      if (seal !== strike) {
        this.send({type: 'block', strike: seal});
        return;
      }
      run.broken++;
      this.send({type: 'seal', strike: seal});
    }
    const damage = strike === 'steel' ? impact(this.player.atk, this.foe.def) :
      impact(this.player.mag * (strike === 'ember' ? 1.36 : strike === 'rime' ? 1.1 : 1.62), this.foe.res * (strike === 'storm' ? 0.38 : 1));
    if (strike === 'rime') run.enemyGauge = Math.max(0, run.enemyGauge - 0.23);
    const nextFloor = sealFloor(this.foe, run.broken);
    const actual = Math.min(Math.max(0, run.foeHp - nextFloor), damage);
    run.foeHp -= actual;
    this.send({type: 'hit', strike, damage: actual});
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
    const before = run.level;
    while (run.xp >= xpGoal(run.level)) run.xp -= xpGoal(run.level++);
    if (run.level > before) {
      const old = this.player;
      this.player = stats(run);
      run.hp = Math.min(this.player.hp, run.hp + this.player.hp - old.hp + this.player.hp * 0.105 * (run.level - before));
      run.mp = Math.min(this.player.mp, run.mp + this.player.mp - old.mp + this.player.mp * 0.28 * (run.level - before));
      const spells = (Object.keys(SPELLS) as SpellId[]).filter(id => SPELLS[id].level > before && SPELLS[id].level <= run.level);
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
      run.phase = run.wave === WAVE_COUNT ? 'victory' : 'clear';
      run.wait = run.phase === 'clear' ? 0.95 : 0;
    }
    else run.wait = 0.72;
    this.send({type: 'kill', xp: foe.xp, gold: foe.gold, loot});
  }
}
