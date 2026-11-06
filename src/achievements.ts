import { SPELL_IDS, WAVE_COUNT, type SpellId } from './content.ts';
import type { Run } from './engine.ts';

export const CHRONICLE_COUNTERS = [
  'streak', 'bestStreak', 'hits', 'steelHits', 'seals', 'weakHits',
  'cleanWaves', 'cleanStreak', 'bestCleanStreak'
] as const;

export interface Chronicle extends Record<typeof CHRONICLE_COUNTERS[number], number> {
  spellUses: Record<SpellId, number>;
  waveFallen: boolean;
  finished: boolean;
  activeSeconds: number | null;
}

export function newChronicle(activeSeconds: number | null = 0): Chronicle {
  return {
    streak: 0, bestStreak: 0, hits: 0, steelHits: 0, seals: 0, weakHits: 0,
    cleanWaves: 0, cleanStreak: 0, bestCleanStreak: 0, waveFallen: false,
    finished: false, activeSeconds,
    spellUses: { ember: 0, mend: 0, rime: 0, storm: 0, aegis: 0, verdict: 0 }
  };
}

export const ACHIEVEMENT_GROUPS = ['Combat', 'Survival', 'Magic', 'Campaign'] as const;
type Group = typeof ACHIEVEMENT_GROUPS[number];
interface Achievement {
  group: Group; id: string; name: string; description: string; target: number;
  progress: (run: Run) => number;
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
  timed(90, 'Faster than the Dark')
];
