import { HEROES, HERO_IDS, SPELL_IDS, WAVE_COUNT, type HeroId, type SpellId } from './content.ts';
import type { Run } from './engine.ts';

export const CHRONICLE_COUNTERS = [
  'streak', 'bestStreak', 'hits', 'steelHits', 'seals', 'weakHits',
  'cleanWaves', 'cleanStreak', 'bestCleanStreak', 'immuneHits'
] as const;

export interface Chronicle extends Record<typeof CHRONICLE_COUNTERS[number], number> {
  legacyMastery: number;
  spellUses: Record<SpellId, number> & {verdict: number};
  waveFallen: boolean;
  gearFreeAttempt: boolean;
  spellFreeAttempt: boolean;
  clearedGearFree: boolean;
  clearedSpellFree: boolean;
  nearDeathClear: boolean;
  finished: boolean;
  activeSeconds: number | null;
}

export function newChronicle(activeSeconds: number | null = 0): Chronicle {
  return {
    streak: 0, bestStreak: 0, hits: 0, steelHits: 0, seals: 0, weakHits: 0,
    cleanWaves: 0, cleanStreak: 0, bestCleanStreak: 0, immuneHits: 0, waveFallen: false,
    gearFreeAttempt: true, spellFreeAttempt: true, clearedGearFree: false, clearedSpellFree: false, nearDeathClear: false,
    finished: false, activeSeconds, legacyMastery: 0,
    spellUses: { ember: 0, mend: 0, rime: 0, storm: 0, aegis: 0, haste: 0, surge: 0, fury: 0, verdict: 0 }
  };
}

export const TOTAL_KEYS = ['kills', 'deaths', 'hits', 'steelHits', 'seals', 'weakHits',
  'cleanWaves', 'immuneHits', 'essence', 'relics', 'gear'] as const;
export const BEST_KEYS = ['streak', 'cleanStreak', 'waves', 'level', 'mastery',
  'gearFree', 'spellFree', 'nearDeath'] as const;
export interface AchievementProfile {
  totals: Record<typeof TOTAL_KEYS[number], number>;
  best: Record<typeof BEST_KEYS[number], number>;
  spells: Record<SpellId, number> & {verdict: number};
  victories: HeroId[];
  fastest: number | null;
}
export function emptyProfile(): AchievementProfile {
  return {
    totals: {kills:0, deaths:0, hits:0, steelHits:0, seals:0, weakHits:0, cleanWaves:0, immuneHits:0, essence:0, relics:0, gear:0},
    best: {streak:0, cleanStreak:0, waves:0, level:0, mastery:0, gearFree:0, spellFree:0, nearDeath:0},
    spells: newChronicle().spellUses, victories: [], fastest: null
  };
}
export function profileFromRun(run: Run): AchievementProfile {
  const c = run.chronicle;
  const relics = run.inventory.filter(item => item.relic).length;
  return {
    totals: {
      kills: run.kills, deaths: run.deaths, hits: c.hits, steelHits: c.steelHits, seals: c.seals, weakHits: c.weakHits,
      cleanWaves: c.cleanWaves, immuneHits: c.immuneHits, relics, gear: run.inventory.length - relics,
      essence: run.essenceClaims.reduce((sum, id) => sum + (id % 32 === 0 ? 3 : 1), 0)
    },
    best: {
      streak: c.bestStreak, cleanStreak: c.bestCleanStreak,
      waves: c.finished ? WAVE_COUNT : run.wave - (run.phase === 'clear' ? 0 : 1), level: run.level,
      mastery: Math.max(1, c.legacyMastery ?? 0, ...Object.values(run.spellRanks)), gearFree: Number(c.clearedGearFree),
      spellFree: Number(c.clearedSpellFree), nearDeath: Number(c.nearDeathClear)
    },
    spells: {...c.spellUses}, victories: c.finished ? [run.hero] : [], fastest: c.finished ? c.activeSeconds : null
  };
}
export function mergeProfile(target: AchievementProfile, source: AchievementProfile, sameRun = false): void {
  const combine = (a: number, b: number) => sameRun ? Math.max(a, b) : Math.min(Number.MAX_SAFE_INTEGER, a + b);
  for (const key of TOTAL_KEYS) target.totals[key] = combine(target.totals[key], source.totals[key]);
  for (const key of BEST_KEYS) target.best[key] = Math.max(target.best[key], source.best[key]);
  for (const id of [...SPELL_IDS, 'verdict'] as const) target.spells[id] = combine(target.spells[id], source.spells[id]);
  for (const hero of source.victories) if (!target.victories.includes(hero)) target.victories.push(hero);
  if (source.fastest !== null) target.fastest = target.fastest === null ? source.fastest : Math.min(target.fastest, source.fastest);
}

export const ACHIEVEMENT_GROUPS = ['Combat', 'Survival', 'Magic', 'Campaign', 'Classes', 'Oddities'] as const;
type Group = typeof ACHIEVEMENT_GROUPS[number];
interface Achievement {
  group: Group; id: string; name: string; description: string; target: number;
  progress: (profile: AchievementProfile) => number;
  minutes?: number;
}

const kills = (p: AchievementProfile) => p.totals.kills;
const streak = (p: AchievementProfile) => p.best.streak;
const hits = (p: AchievementProfile) => p.totals.hits;
const clean = (p: AchievementProfile) => p.totals.cleanWaves;
const spells = (p: AchievementProfile) => SPELL_IDS.reduce((sum, id) => sum + p.spells[id], p.spells.verdict);
const waves = (p: AchievementProfile) => p.best.waves;
const metric = (group: Group, id: string, name: string, description: string,
  target: number, progress: Achievement['progress']): Achievement => ({ group, id, name, description, target, progress });
const timed = (minutes: number, name: string): Achievement => ({
  ...metric('Campaign', 'time-' + minutes, name, 'Finish the campaign in under ' + minutes + ' minutes of active play.', 1,
    p => Number(p.fastest !== null && p.fastest < minutes * 60)),
  minutes
});

export const ACHIEVEMENTS: readonly Achievement[] = [
  metric('Combat', 'kill-1', 'First Blood', 'Defeat your first foe.', 1, kills),
  metric('Combat', 'kill-32', 'Grave Sweeper', 'Defeat 32 foes.', 32, kills),
  metric('Combat', 'kill-128', 'Hollow Hunter', 'Defeat 128 foes.', 128, kills),
  metric('Combat', 'kill-512', 'The Long Hunt', 'Defeat 512 foes.', 512, kills),
  metric('Combat', 'kill-1024', 'A Thousand Graves', 'Defeat 1,024 foes.', 1024, kills),
  metric('Combat', 'kill-2048', 'The Grave Census', 'Defeat 2,048 foes.', 2048, kills),
  metric('Combat', 'hit-100', 'Blood on the Blade', 'Land 100 damaging strikes.', 100, hits),
  metric('Combat', 'hit-1000', 'Unyielding', 'Land 1,000 damaging strikes.', 1000, hits),
  metric('Combat', 'hit-5000', 'Five Thousand Cuts', 'Land 5,000 damaging strikes.', 5000, hits),
  metric('Combat', 'steel-500', 'Forged in Steel', 'Land 500 sword strikes.', 500, p => p.totals.steelHits),
  metric('Combat', 'weak-75', 'Find the Fault', 'Hit an enemy weakness 75 times.', 75, p => p.totals.weakHits),
  metric('Survival', 'streak-16', 'Steady Hand', 'Defeat 16 foes in a row without falling.', 16, streak),
  metric('Survival', 'streak-32', 'Unbroken Blade', 'Defeat 32 foes in a row without falling.', 32, streak),
  metric('Survival', 'streak-96', 'Chain of Triumph', 'Defeat 96 foes in a row without falling.', 96, streak),
  metric('Survival', 'streak-192', 'Oath of Iron', 'Defeat 192 foes in a row without falling.', 192, streak),
  metric('Survival', 'clean-1', 'Untouched Oath', 'Clear a wave on your first attempt.', 1, clean),
  metric('Survival', 'clean-5', 'Five Unbroken', 'Clear 5 waves on your first attempt.', 5, clean),
  metric('Survival', 'clean-16', 'Half the Hollow', 'Clear 16 waves on your first attempt.', 16, clean),
  metric('Survival', 'clean-streak-3', 'The Iron Road', 'Clear 3 consecutive waves without a defeat.', 3, p => p.best.cleanStreak),
  metric('Survival', 'fall-1', 'Rise Again', 'Fall in battle for the first time.', 1, p => p.totals.deaths),
  metric('Survival', 'fall-10', 'Familiar Ground', 'Fall in battle 10 times.', 10, p => p.totals.deaths),
  metric('Survival', 'fall-50', 'The Grave Knows You', 'Fall in battle 50 times.', 50, p => p.totals.deaths),
  metric('Survival', 'fall-100', 'Frequent Fall Card', 'Fall in battle 100 times.', 100, p => p.totals.deaths),
  metric('Survival', 'fall-250', 'Resident of the Underworld', 'Fall in battle 250 times.', 250, p => p.totals.deaths),
  metric('Survival', 'fall-1000', 'Death Is a Habit', 'Fall in battle 1,000 times.', 1000, p => p.totals.deaths),
  metric('Magic', 'cast-1', 'First Incantation', 'Cast a spell.', 1, spells),
  metric('Magic', 'cast-100', 'Arcane Student', 'Cast 100 spells.', 100, spells),
  metric('Magic', 'cast-1000', 'Living Grimoire', 'Cast 1,000 spells.', 1000, spells),
  metric('Magic', 'ember-50', 'Kindle the Pyre', 'Cast Ember Bolt 50 times.', 50, p => p.spells.ember),
  metric('Magic', 'rime-50', 'Winter’s Breath', 'Cast Rime Lance 50 times.', 50, p => p.spells.rime),
  metric('Magic', 'storm-50', 'Storm Caller', 'Cast Storm Sigil 50 times.', 50, p => p.spells.storm),
  metric('Magic', 'mend-50', 'Mender of Wounds', 'Cast Mend 50 times.', 50, p => p.spells.mend),
  metric('Magic', 'aegis-25', 'Shelter in the Storm', 'Cast Aegis 25 times.', 25, p => p.spells.aegis),
  metric('Magic', 'haste-25', 'Borrowed Seconds', 'Cast Haste 25 times.', 25, p => p.spells.haste),
  metric('Magic', 'surge-25', 'Beyond the Formula', 'Cast Arcane Surge 25 times.', 25, p => p.spells.surge),
  metric('Magic', 'fury-25', 'Steel Remembers', 'Cast Battle Fury 25 times.', 25, p => p.spells.fury),
  metric('Magic', 'verdict-25', 'Thunder’s Judgment', 'Cast lightning spells 25 times.', 25, p => p.spells.storm + p.spells.verdict),
  metric('Magic', 'seal-16', 'Sealbreaker', 'Break 16 enemy seals.', 16, p => p.totals.seals),
  metric('Magic', 'essence-30', 'Essence Keeper', 'Collect 30 Arcane Essence in total.', 30,
    p => p.totals.essence),
  metric('Magic', 'mastery-10', 'Arcane Virtuoso', 'Raise a spell to level 10.', 10, p => p.best.mastery),
  metric('Magic', 'mastery-3', 'Master of the Arts', 'Raise a spell to level 3.', 3,
    p => p.best.mastery),
  metric('Campaign', 'wave-1', 'Beyond the Briar', 'Clear the first wave.', 1, waves),
  metric('Campaign', 'wave-8', 'The First Quarter', 'Clear 8 waves.', 8, waves),
  metric('Campaign', 'wave-16', 'Into the Depths', 'Clear 16 waves.', 16, waves),
  metric('Campaign', 'wave-32', 'The Hollow Falls', 'Clear all 32 waves.', 32, waves),
  metric('Campaign', 'relic-5', 'Relic Warden', 'Collect 5 different relics.', 5, p => p.totals.relics),
  metric('Campaign', 'gear-10', 'A Quartermaster’s Friend', 'Buy 10 pieces of equipment.', 10, p => p.totals.gear),
  metric('Campaign', 'level-50', 'Veteran of the Hollow', 'Reach character level 50.', 50, p => p.best.level),
  timed(180, 'Before Dawn'),
  timed(120, 'Night Runner'),
  timed(90, 'Faster than the Dark'),
  ...HERO_IDS.map(hero => metric('Classes', 'victory-' + hero, HEROES[hero].name + ' Ascendant',
    'Finish the campaign as the ' + HEROES[hero].name + '.', 1,
    p => Number(p.victories.includes(hero)))),
  metric('Classes', 'victory-all', 'Four Oaths Kept', 'Finish the campaign with all four classes across your adventures.', 4,
    p => p.victories.length),
  metric('Oddities', 'gear-free', 'Dress Code Optional', 'Clear an entire wave with every equipment slot empty.', 1,
    p => p.best.gearFree),
  metric('Oddities', 'spell-free', 'The Silent Grimoire', 'Clear an entire wave without casting a spell.', 1,
    p => p.best.spellFree),
  metric('Oddities', 'near-death', 'By a Thread', 'Defeat a guardian with 5% HP or less before the rewards.', 1,
    p => p.best.nearDeath),
  metric('Oddities', 'immune-25', 'Talking to a Wall', 'Strike an immune foe 25 times in total.', 25,
    p => p.totals.immuneHits),
  metric('Oddities', 'all-spells', 'One of Everything', 'Cast five different spells at least once.', 5,
    p => SPELL_IDS.filter(id => p.spells[id] > 0).length)
];
