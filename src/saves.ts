import { encounter, GEAR_SLOTS, gearId, HERO_IDS, SPELLS, WAVE_COUNT, xpGoal } from './content.ts';
import { stats, type Run } from './engine.ts';

const PREFIX = 'hollow-oath.slot.';
export const SLOT_COUNT = 3;
export interface Save { version: 1; updated: number; run: Run }
const numeric = (x: unknown, min: number, max: number, integer = false): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max && (!integer || Number.isSafeInteger(x));

export function decode(text: string): Save | null {
  try {
    const data = JSON.parse(text) as Save;
    if (data?.version !== 1 || !numeric(data.updated, 0, 8.64e15)) return null;
    const r = data.run;
    if (!r || !HERO_IDS.includes(r.hero) || !numeric(r.level, 1, Number.MAX_SAFE_INTEGER, true) ||
      !numeric(r.xp, 0, xpGoal(r.level) - 1, true) || !numeric(r.gold, 0, Number.MAX_SAFE_INTEGER, true) ||
      !numeric(r.wave, 1, WAVE_COUNT, true) || !numeric(r.step, 1, 32, true) ||
      !numeric(r.kills, 0, Number.MAX_SAFE_INTEGER, true) || !numeric(r.deaths, 0, Number.MAX_SAFE_INTEGER, true) ||
      !numeric(r.playerGauge, 0, 1.000001) || !numeric(r.enemyGauge, 0, 1.000001) || !numeric(r.wait, 0, 1) ||
      !['steel', 'magic'].includes(r.mode) || !Object.hasOwn(SPELLS, r.spell) || SPELLS[r.spell].level > r.level ||
      !['fight', 'fallen', 'clear', 'victory'].includes(r.phase) ||
      !Array.isArray(r.inventory) || r.inventory.length > WAVE_COUNT * 12 || !r.equipped ||
      typeof r.equipped !== 'object' || Array.isArray(r.equipped)) return null;
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

export function readSlot(index: number): Save | null {
  try { return decode(localStorage.getItem(PREFIX + index) ?? ''); }
  catch { return null; }
}
export function writeSlot(index: number, run: Run): boolean {
  try {
    localStorage.setItem(PREFIX + index, serialize(run));
    return true;
  } catch { return false; }
}
export function serialize(run: Run): string {
  return JSON.stringify({version: 1, updated: Date.now(), run} satisfies Save);
}
