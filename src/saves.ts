import { BEST_KEYS, CHRONICLE_COUNTERS, emptyProfile, mergeProfile, newChronicle, profileFromRun, TOTAL_KEYS, type AchievementProfile } from './achievements.ts';
import { encounter, ENCOUNTER_COUNT, GEAR_SLOTS, gearId, HEROES, HERO_IDS, MAX_SPELL_RANK, ENEMY_MOVES, aegisProtection, normalizeCharacterName, SPELL_IDS, SPELLS, WAVE_COUNT, xpGoal } from './content.ts';
import { knownRank, stats, type Run } from './engine.ts';

const PREFIX = 'hollow-oath.slot.';
const HISTORY = 'hollow-oath.chronicle.';
const validRunId = (id: unknown): id is string => typeof id === 'string' && /^(?:run-[a-z0-9-]{7,32}|legacy-[a-z0-9]{2,14})$/.test(id);
export interface Save { version: 7; updated: number; run: Run }
const numeric = (x: unknown, min: number, max: number, integer = false): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max && (!integer || Number.isSafeInteger(x));

function legacyRunId(run: Run): string {
  // Old exports have no identifier. Ignore the envelope date and object key order.
  const source = JSON.stringify(run, (_, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
  let first = 2166136261, second = 5381;
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return 'legacy-' + (first >>> 0).toString(36) + (second >>> 0).toString(36);
}

export function decode(text: string): Save | null {
  try {
    const raw = JSON.parse(text) as {version: number; updated: number; run: Run & {castRank?: unknown}};
    if (!raw || ![1, 2, 3, 4, 5, 6, 7].includes(raw.version) || !numeric(raw.updated, 0, 8.64e15)) return null;
    const data: Save = {version: 7, updated: raw.updated, run: raw.run};
    const r = data.run;
    let retiredMastery = 0;
    if (r && raw.version < 6) r.runId = legacyRunId(r);
    // Retire Verdict without losing its purchase value or historical cast counts.
    if (r && raw.version < 7) {
      const old = r as Run & {spellRanks: Record<string, number>; spell: string};
      const rank = old.spellRanks?.verdict;
      if (rank !== undefined) {
        if (!numeric(rank, 1, 3, true) || r.level < 8) return null;
        retiredMastery = rank;
        r.essence += 8 + (rank >= 2 ? 4 : 0) + (rank >= 3 ? 12 : 0);
        delete old.spellRanks.verdict;
      }
      if ((r.spell as string) === 'verdict') r.spell = 'storm';
      r.wardRank = Math.min(10, r.spellRanks?.aegis ?? 1);
      r.ward = r.ward > 0 ? aegisProtection(r.wardRank).charges : 0;
      r.enemyTurns = r.enemyHeals = r.enemyRecovery = r.castWait = r.castDelay = 0;
      r.intent = null;
    }
    if (!r || !HERO_IDS.includes(r.hero) || !numeric(r.level, 1, Number.MAX_SAFE_INTEGER, true) ||
      !numeric(r.xp, 0, xpGoal(r.level) - 1, true) || !numeric(r.gold, 0, Number.MAX_SAFE_INTEGER, true) ||
      !numeric(r.wave, 1, WAVE_COUNT, true) || !numeric(r.step, 1, 32, true) ||
      !numeric(r.kills, 0, Number.MAX_SAFE_INTEGER, true) || !numeric(r.deaths, 0, Number.MAX_SAFE_INTEGER, true) ||
      !numeric(r.playerGauge, 0, 1.000001) || !numeric(r.enemyGauge, 0, 1.000001) || !numeric(r.wait, 0, 1) ||
      !['steel', 'magic'].includes(r.mode) || !Object.hasOwn(SPELLS, r.spell) || SPELLS[r.spell].level > r.level ||
      !['fight', 'fallen', 'clear', 'victory'].includes(r.phase) ||
      !Array.isArray(r.inventory) || r.inventory.length > WAVE_COUNT * 12 || !r.equipped ||
      typeof r.equipped !== 'object' || Array.isArray(r.equipped)) return null;
    if (!validRunId(r.runId)) return null;
    const name = r.name === undefined ? '' : normalizeCharacterName(r.name);
    if (name === null) return null;
    r.name = name || HEROES[r.hero].defaultName;
    if (r.journalRead === undefined) r.journalRead = 0;
    if (!numeric(r.journalRead, 0, 255, true)) return null;
    if (raw.version === 1) {
      if (SPELLS[r.spell].price) return null;
      const cleared = r.phase === 'clear' || r.phase === 'victory' ? r.wave : r.wave - 1;
      r.essenceClaims = Array.from({length: cleared}, (_, index) => (index + 1) * ENCOUNTER_COUNT);
      r.essence = cleared * 3;
      r.spellRanks = {};
      r.ward = 0;
    }
    if (!numeric(r.essence, 0, WAVE_COUNT * 6, true) || !Array.isArray(r.essenceClaims) ||
      r.essenceClaims.length > WAVE_COUNT * 4 || !r.spellRanks || typeof r.spellRanks !== 'object' ||
      Array.isArray(r.spellRanks) || !numeric(r.ward, 0, 8, true) || !numeric(r.wardRank, 1, 10, true) ||
      !numeric(r.enemyTurns, 0, Number.MAX_SAFE_INTEGER, true) || !numeric(r.enemyHeals, 0, 2, true) ||
      !numeric(r.enemyRecovery, 0, Math.floor(encounter(r.wave, r.step).hp * .18), true) ||
      !(r.intent === null || Object.hasOwn(ENEMY_MOVES, r.intent)) || !numeric(r.castWait, 0, 2.400001) ||
      !numeric(r.castDelay, 0, .600001) || (r.intent === null && r.castWait > 0)) return null;
    const claims = new Set<number>();
    let earned = 0;
    for (const id of r.essenceClaims) {
      if (!numeric(id, 1, r.wave * ENCOUNTER_COUNT, true) || claims.has(id)) return null;
      const source = encounter(Math.ceil(id / ENCOUNTER_COUNT), (id - 1) % ENCOUNTER_COUNT + 1);
      if (!source.essence) return null;
      claims.add(id);
      earned += source.essence;
    }
    if (r.essence > earned) return null;
    for (const [id, rank] of Object.entries(r.spellRanks)) {
      if (!Object.hasOwn(SPELLS, id) || !numeric(rank, 1, MAX_SPELL_RANK, true) ||
        SPELLS[id as keyof typeof SPELLS].level > r.level) return null;
    }
    if (!knownRank(r, r.spell)) return null;
    delete raw.run.castRank;
    if (raw.version < 4) {
      const clock = newChronicle(null);
      clock.finished = r.phase === 'victory' || claims.has(WAVE_COUNT * ENCOUNTER_COUNT);
      const completed = clock.finished ? WAVE_COUNT : r.wave - (r.phase === 'clear' ? 0 : 1);
      if (!r.deaths) {
        clock.streak = clock.bestStreak = r.kills;
        clock.cleanWaves = clock.cleanStreak = clock.bestCleanStreak = completed;
      }
      clock.waveFallen = r.deaths > 0;
      r.chronicle = clock;
    }
    const clock = r.chronicle;
    if (clock) clock.legacyMastery = Math.max(clock.legacyMastery ?? 0, retiredMastery);
    if (clock?.spellUses && clock.spellUses.verdict === undefined) clock.spellUses.verdict = 0;
    if (raw.version < 5 && clock) {
      clock.gearFreeAttempt = clock.spellFreeAttempt = false;
      clock.clearedGearFree = clock.clearedSpellFree = clock.nearDeathClear = false;
      clock.immuneHits = 0;
    }
    if (!clock || !numeric(clock.legacyMastery, 0, 3, true) || typeof clock.finished !== 'boolean' || typeof clock.waveFallen !== 'boolean' ||
      ![clock.gearFreeAttempt, clock.spellFreeAttempt, clock.clearedGearFree,
        clock.clearedSpellFree, clock.nearDeathClear].every(value => typeof value === 'boolean') ||
      (clock.activeSeconds !== null && !numeric(clock.activeSeconds, 0, Number.MAX_SAFE_INTEGER)) ||
      !clock.spellUses || ![...SPELL_IDS, 'verdict'].every(id => numeric(clock.spellUses[id as keyof typeof clock.spellUses], 0, Number.MAX_SAFE_INTEGER, true)) ||
      !CHRONICLE_COUNTERS.every(key => numeric(clock[key], 0, Number.MAX_SAFE_INTEGER, true)) ||
      clock.bestStreak > r.kills || clock.streak > clock.bestStreak || clock.cleanWaves > WAVE_COUNT ||
      clock.bestCleanStreak > clock.cleanWaves || clock.cleanStreak > clock.bestCleanStreak ||
      clock.steelHits > clock.hits || clock.weakHits > clock.hits) return null;
    const gearIds = new Set<string>();
    for (const gear of r.inventory) {
      if (!gear || !GEAR_SLOTS.includes(gear.slot) || !numeric(gear.tier, 1, r.wave, true) || typeof gear.relic !== 'boolean') return null;
      const id = gearId(gear);
      if (gearIds.has(id)) return null;
      gearIds.add(id);
    }
    for (const [slot, id] of Object.entries(r.equipped)) {
      if (typeof id !== 'string' || !id.startsWith(slot + ':') || !gearIds.has(id)) return null;
    }
    if (clock.gearFreeAttempt && Object.keys(r.equipped).length) return null;
    const foe = encounter(r.wave, r.step);
    const values = stats(r);
    if (!numeric(r.hp, 0, values.hp) || !numeric(r.mp, 0, values.mp) || !numeric(r.foeHp, 0, foe.hp, true) ||
      !numeric(r.broken, 0, foe.seals.length, true)) return null;
    if (r.phase === 'fallen' ? r.hp !== 0 : r.hp <= 0) return null;
    if ((r.phase === 'clear' || r.phase === 'victory') &&
      (r.foeHp !== 0 || r.step !== 32 || (r.phase === 'victory') !== (r.wave === WAVE_COUNT))) return null;
    if (r.phase === 'fight' && r.foeHp === 0 && (r.wait === 0 || r.step === 32)) return null;
    return data;
  } catch {
    return null;
  }
}

function storageIds(prefix: string): string[] {
  const ids: string[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) ids.push(key.slice(prefix.length));
    }
  } catch { /* Storage is optional. */ }
  return ids;
}
export function readSlot(id: string): Save | null {
  try { return decode(localStorage.getItem(PREFIX + id) ?? ''); }
  catch { return null; }
}
export function listSlots(): {id: string; data: Save | null}[] {
  return storageIds(PREFIX).filter(id => validRunId(id) || /^\d+$/.test(id))
    .map(id => ({id, data: readSlot(id)}))
    .sort((a, b) => (b.data?.updated ?? 0) - (a.data?.updated ?? 0) || a.id.localeCompare(b.id));
}
function readHistory(id: string): AchievementProfile | null {
  try {
    const p = JSON.parse(localStorage.getItem(HISTORY + id) ?? 'null') as AchievementProfile | null;
    if (p?.spells && p.spells.verdict === undefined) p.spells.verdict = 0;
    const count = (value: unknown) => numeric(value, 0, Number.MAX_SAFE_INTEGER, true);
    if (!p || !p.totals || !p.best || !p.spells ||
      !TOTAL_KEYS.every(key => count(p.totals[key])) || !BEST_KEYS.every(key => count(p.best[key])) ||
      ![...SPELL_IDS, 'verdict'].every(key => count(p.spells[key as keyof typeof p.spells])) ||
      !Array.isArray(p.victories) || p.victories.length > HERO_IDS.length || !p.victories.every(hero => HERO_IDS.includes(hero)) ||
      (p.fastest !== null && !numeric(p.fastest, 0, Number.MAX_SAFE_INTEGER))) return null;
    return p;
  } catch { return null; }
}
function archive(run: Run): boolean {
  try {
    const key = HISTORY + run.runId;
    const prior = readHistory(run.runId);
    const record = prior ?? emptyProfile();
    const before = prior && JSON.stringify(prior);
    mergeProfile(record, profileFromRun(run), true);
    const next = JSON.stringify(record);
    if (before !== next) localStorage.setItem(key, next);
    return true;
  } catch { return false; }
}
export function achievementHistory(activeId?: string): {other: AchievementProfile; prior: AchievementProfile} {
  const entries = new Map<string, AchievementProfile>();
  for (const id of storageIds(HISTORY).filter(validRunId)) {
    const history = readHistory(id);
    if (history) entries.set(id, history);
  }
  // Import achievements from legacy saves and include saves that could not be archived due to storage limits.
  for (const {data} of listSlots()) {
    if (!data) continue;
    const id = data.run.runId;
    const record = entries.get(id) ?? emptyProfile();
    mergeProfile(record, profileFromRun(data.run), true);
    entries.set(id, record);
  }
  const other = emptyProfile();
  for (const [id, record] of entries) if (id !== activeId) mergeProfile(other, record);
  return {other, prior: (activeId && entries.get(activeId)) || emptyProfile()};
}
export function writeSlot(id: string, run: Run, allowCreate = true): boolean {
  try {
    if (!allowCreate && localStorage.getItem(PREFIX + id) === null) return false;
    localStorage.setItem(PREFIX + id, serialize(run));
    archive(run);
    return true;
  } catch { return false; }
}
export function deleteSlot(id: string): boolean {
  const data = readSlot(id);
  if (data && !archive(data.run)) return false;
  try { localStorage.removeItem(PREFIX + id); return true; }
  catch { return false; }
}
export function serialize(run: Run): string {
  return JSON.stringify({version: 7, updated: Date.now(), run} satisfies Save);
}
