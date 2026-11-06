import { HEROES, HERO_IDS, SPELL_IDS, WAVE_COUNT, type HeroId, type SpellId } from './content.ts';
import type { Run } from './engine.ts';

export const CHRONICLE_COUNTERS = [
  'streak', 'bestStreak', 'hits', 'steelHits', 'seals', 'weakHits',
  'cleanWaves', 'cleanStreak', 'bestCleanStreak', 'immuneHits'
] as const;

export interface Chronicle extends Record<typeof CHRONICLE_COUNTERS[number], number> {
  spellUses: Record<SpellId, number>;
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
    finished: false, activeSeconds,
    spellUses: { ember: 0, mend: 0, rime: 0, storm: 0, aegis: 0, verdict: 0 }
  };
}

export const ACHIEVEMENT_GROUPS = ['Combat', 'Survival', 'Magic', 'Campaign', 'Classes', 'Oddities'] as const;
type Group = typeof ACHIEVEMENT_GROUPS[number];
interface Achievement {
  group: Group; id: string; name: string; description: string; target: number;
  progress: (run: Run, victories?: ReadonlySet<HeroId>) => number;
  minutes?: number;
}

const kills = (r: Run) => r.kills;
const streak = (r: Run) => r.chronicle.bestStreak;
const hits = (r: Run) => r.chronicle.hits;
const clean = (r: Run) => r.chronicle.cleanWaves;
const spells = (r: Run) => SPELL_IDS.reduce((sum, id) => sum + r.chronicle.spellUses[id], 0);
const waves = (r: Run) => r.chronicle.finished ? WAVE_COUNT : r.wave - (r.phase === 'clear' ? 0 : 1);
const metric = (group: Group, id: string, name: string, description: string,
  target: number, progress: Achievement['progress']): Achievement => ({ group, id, name, description, target, progress });
const finishedAs = (run: Run, hero: HeroId, victories?: ReadonlySet<HeroId>) =>
  (run.hero === hero && run.chronicle.finished) || victories?.has(hero) === true;
const timed = (minutes: number, name: string): Achievement => ({
  ...metric('Campaign', 'time-' + minutes, name, 'Finish the campaign in under ' + minutes + ' minutes of active play.', 1,
    r => Number(r.chronicle.finished && r.chronicle.activeSeconds !== null && r.chronicle.activeSeconds < minutes * 60)),
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
  metric('Combat', 'steel-500', 'Forged in Steel', 'Land 500 sword strikes.', 500, r => r.chronicle.steelHits),
  metric('Combat', 'weak-75', 'Find the Fault', 'Hit an enemy weakness 75 times.', 75, r => r.chronicle.weakHits),
  metric('Survival', 'streak-16', 'Steady Hand', 'Defeat 16 foes in a row without falling.', 16, streak),
  metric('Survival', 'streak-32', 'Unbroken Blade', 'Defeat 32 foes in a row without falling.', 32, streak),
  metric('Survival', 'streak-96', 'Chain of Triumph', 'Defeat 96 foes in a row without falling.', 96, streak),
  metric('Survival', 'streak-192', 'Oath of Iron', 'Defeat 192 foes in a row without falling.', 192, streak),
  metric('Survival', 'clean-1', 'Untouched Oath', 'Clear a wave on your first attempt.', 1, clean),
  metric('Survival', 'clean-5', 'Five Unbroken', 'Clear 5 different waves on your first attempt.', 5, clean),
  metric('Survival', 'clean-16', 'Half the Hollow', 'Clear 16 different waves on your first attempt.', 16, clean),
  metric('Survival', 'clean-streak-3', 'The Iron Road', 'Clear 3 consecutive waves without a defeat.', 3, r => r.chronicle.bestCleanStreak),
  metric('Survival', 'fall-1', 'Rise Again', 'Fall in battle for the first time.', 1, r => r.deaths),
  metric('Survival', 'fall-10', 'Familiar Ground', 'Fall in battle 10 times.', 10, r => r.deaths),
  metric('Survival', 'fall-50', 'The Grave Knows You', 'Fall in battle 50 times.', 50, r => r.deaths),
  metric('Survival', 'fall-100', 'Frequent Fall Card', 'Fall in battle 100 times.', 100, r => r.deaths),
  metric('Survival', 'fall-250', 'Resident of the Underworld', 'Fall in battle 250 times.', 250, r => r.deaths),
  metric('Survival', 'fall-1000', 'Death Is a Habit', 'Fall in battle 1,000 times.', 1000, r => r.deaths),
  metric('Magic', 'cast-1', 'First Incantation', 'Cast a spell.', 1, spells),
  metric('Magic', 'cast-100', 'Arcane Student', 'Cast 100 spells.', 100, spells),
  metric('Magic', 'cast-1000', 'Living Grimoire', 'Cast 1,000 spells.', 1000, spells),
  metric('Magic', 'ember-50', 'Kindle the Pyre', 'Cast Ember Bolt 50 times.', 50, r => r.chronicle.spellUses.ember),
  metric('Magic', 'rime-50', 'Winter’s Breath', 'Cast Rime Lance 50 times.', 50, r => r.chronicle.spellUses.rime),
  metric('Magic', 'storm-50', 'Storm Caller', 'Cast Storm Sigil 50 times.', 50, r => r.chronicle.spellUses.storm),
  metric('Magic', 'mend-50', 'Mender of Wounds', 'Cast Mend 50 times.', 50, r => r.chronicle.spellUses.mend),
  metric('Magic', 'aegis-25', 'Shelter in the Storm', 'Cast Aegis 25 times.', 25, r => r.chronicle.spellUses.aegis),
  metric('Magic', 'verdict-25', 'Thunder’s Judgment', 'Cast Thunder Verdict 25 times.', 25, r => r.chronicle.spellUses.verdict),
  metric('Magic', 'seal-16', 'Sealbreaker', 'Break 16 enemy seals.', 16, r => r.chronicle.seals),
  metric('Magic', 'essence-30', 'Essence Keeper', 'Collect 30 Arcane Essence in total.', 30,
    r => r.essenceClaims.reduce((sum, id) => sum + (id % 32 === 0 ? 3 : 1), 0)),
  metric('Magic', 'mastery-3', 'Master of the Arts', 'Raise a spell to level 3.', 3,
    r => Math.max(1, ...Object.values(r.spellRanks))),
  metric('Campaign', 'wave-1', 'Beyond the Briar', 'Clear the first wave.', 1, waves),
  metric('Campaign', 'wave-8', 'The First Quarter', 'Clear 8 waves.', 8, waves),
  metric('Campaign', 'wave-16', 'Into the Depths', 'Clear 16 waves.', 16, waves),
  metric('Campaign', 'wave-32', 'The Hollow Falls', 'Clear all 32 waves.', 32, waves),
  metric('Campaign', 'relic-5', 'Relic Warden', 'Collect 5 different relics.', 5, r => r.inventory.filter(item => item.relic).length),
  metric('Campaign', 'gear-10', 'A Quartermaster’s Friend', 'Buy 10 pieces of equipment.', 10, r => r.inventory.filter(item => !item.relic).length),
  metric('Campaign', 'level-50', 'Veteran of the Hollow', 'Reach character level 50.', 50, r => r.level),
  timed(180, 'Before Dawn'),
  timed(120, 'Night Runner'),
  timed(90, 'Faster than the Dark'),
  ...HERO_IDS.map(hero => metric('Classes', 'victory-' + hero, HEROES[hero].name + ' Ascendant',
    'Finish the campaign as the ' + HEROES[hero].name + '.', 1,
    (run, victories) => Number(finishedAs(run, hero, victories)))),
  metric('Classes', 'victory-all', 'Four Oaths Kept', 'Finish the campaign with all four classes across your saved files.', 4,
    (run, victories) => HERO_IDS.filter(hero => finishedAs(run, hero, victories)).length),
  metric('Oddities', 'gear-free', 'Dress Code Optional', 'Clear an entire wave with every equipment slot empty.', 1,
    r => Number(r.chronicle.clearedGearFree)),
  metric('Oddities', 'spell-free', 'The Silent Grimoire', 'Clear an entire wave without casting a spell.', 1,
    r => Number(r.chronicle.clearedSpellFree)),
  metric('Oddities', 'near-death', 'By a Thread', 'Defeat a guardian with 5% HP or less before the rewards.', 1,
    r => Number(r.chronicle.nearDeathClear)),
  metric('Oddities', 'immune-25', 'Talking to a Wall', 'Strike an immune foe 25 times in total.', 25,
    r => r.chronicle.immuneHits),
  metric('Oddities', 'all-spells', 'One of Everything', 'Cast all six spells at least once.', 6,
    r => SPELL_IDS.filter(id => r.chronicle.spellUses[id] > 0).length)
];
