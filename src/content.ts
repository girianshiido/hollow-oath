export const WAVE_COUNT = 32;
export const ENCOUNTER_COUNT = 32;
export const STAT_NAMES = {
  hp: 'Max HP', mp: 'Max MP', atk: 'Attack', def: 'Defense',
  mag: 'Magic attack', res: 'Magic defense', spd: 'Speed', regen: 'MP recovery'
};
export type Stats = Record<keyof typeof STAT_NAMES, number>;
export type HeroId = 'vanguard' | 'hexweaver' | 'nightblade' | 'oathkeeper';

export const HEROES = {
  vanguard: {
    name: 'Vanguard', role: 'The iron wall', color: '#e5ad6f',
    text: 'Heavy strikes and steel plate. Endures where others break.',
    base: { hp: 154, mp: 16, atk: 24, def: 17, mag: 10, res: 9, spd: 0.88, regen: 0.1 },
    gain: { hp: 17, mp: 0.85, atk: 3.5, def: 2.5, mag: 1.55, res: 1.55, spd: 0.005, regen: 0.10 }
  },
  hexweaver: {
    name: 'Hexweaver', role: 'The glass flame', color: '#c2a0f2',
    text: 'Crushing spells and deep mana reserves. Vulnerable to steel.',
    base: { hp: 104, mp: 33, atk: 13, def: 8, mag: 30, res: 17, spd: 0.98, regen: 0.1 },
    gain: { hp: 11, mp: 1.6, atk: 1.8, def: 1.3, mag: 4.1, res: 2.5, spd: 0.006, regen: 0.17 }
  },
  nightblade: {
    name: 'Nightblade', role: 'The swift edge', color: '#a4d5a5',
    text: 'Strikes faster than any other oathbound. Wears light armor.',
    base: { hp: 118, mp: 21, atk: 18, def: 10, mag: 15, res: 11, spd: 1.52, regen: 0.1 },
    gain: { hp: 13, mp: 1, atk: 2.6, def: 1.55, mag: 2.2, res: 1.6, spd: 0.011, regen: 0.12 }
  },
  oathkeeper: {
    name: 'Oathkeeper', role: 'The last light', color: '#91d6d5',
    text: 'Wards off sorcery and excels at healing. Fights a war of attrition.',
    base: { hp: 134, mp: 27, atk: 16, def: 13, mag: 20, res: 23, spd: 0.96, regen: 0.1 },
    gain: { hp: 15, mp: 1.35, atk: 2.3, def: 1.9, mag: 2.8, res: 3.05, spd: 0.006, regen: 0.15 }
  }
} satisfies Record<HeroId, {name: string; role: string; color: string; text: string; base: Stats; gain: Stats}>;
export const HERO_IDS = Object.keys(HEROES) as HeroId[];

export type SpellId = 'ember' | 'mend' | 'rime' | 'storm';
export type Strike = 'steel' | Exclude<SpellId, 'mend'>;
export const SPELLS = {
  ember: {name: 'Ember Bolt', level: 1, cost: 4, color: '#ff9d60', text: 'Hurls fire. Burns Briar Seals.'},
  mend: {name: 'Mend', level: 2, cost: 6, color: '#9effc1', text: 'Restores HP when wounded. Uses steel while healthy.'},
  rime: {name: 'Rime Lance', level: 4, cost: 5, color: '#92e9ff', text: 'Pierces with ice and delays the next enemy strike. Quenches Cinder Seals.'},
  storm: {name: 'Storm Sigil', level: 7, cost: 7, color: '#d4adff', text: 'Strikes with lightning and pierces magic defense. Breaks Mirror Seals.'}
} satisfies Record<SpellId, {name: string; level: number; cost: number; color: string; text: string}>;
export const SPELL_IDS = Object.keys(SPELLS) as SpellId[];
export const SEALS: Record<Strike, {name: string; hint: string; color: string}> = {
  steel: {name: 'Null Seal', hint: 'Strike with steel', color: '#eac180'},
  ember: {name: 'Briar Seal', hint: 'Cast Ember Bolt', color: SPELLS.ember.color},
  rime: {name: 'Cinder Seal', hint: 'Cast Rime Lance', color: SPELLS.rime.color},
  storm: {name: 'Mirror Seal', hint: 'Cast Storm Sigil', color: SPELLS.storm.color}
};

export const WAVES = [
  ['Briar Abbey', 'The Root-Crowned', 'ember'], ['Bell of the Blind', 'Abbess of Silence', 'rime'],
  ['Aurelian Steps', 'The Gilded Sphinx', 'storm'], ['Drowned Causeway', 'Anchorcoil', 'steel'],
  ['Cinder Foundry', 'The Furnace Knight', 'rime'], ['Harrowfrost Wood', 'The Winter Elder', 'ember'],
  ['Court of Thorns', 'The Scarlet Duelist', 'steel'], ['Moonwork Vault', 'The Crescent Engine', 'storm'],
  ['Saffron Necropolis', 'The Serpent Pharaoh', 'storm'], ['Porcelain Spire', 'The Ivory Widow', 'steel'],
  ['The Broken Zodiac', 'Astronomer of Ruin', 'storm'], ['The Sunken Belfry', 'The Bell-Tusk', 'ember'],
  ['Pyre Cathedral', 'The Vermilion Saint', 'rime'], ['Pale Leviathan Sea', 'The Glacier Whale', 'ember'],
  ['Hammerdeep', 'Anvilhorn', 'rime'], ['The Gilded Prison', 'Saint of the Iron Casket', 'storm'],
  ['Emerald Fen', 'The Coral-Crowned Queen', 'storm'], ['The Amber Wrecks', 'Captain Deadwake', 'steel'],
  ['The Poison Garden', 'The Orchid Oracle', 'ember'], ['Moonglass Ridge', 'The Chainbound Wolf', 'ember'],
  ['The Blood Caldera', 'The Crimson Drake', 'rime'], ['The Glass Basilica', 'Bishop of Black Glass', 'steel'],
  ['The Brass Aerie', 'The Brass Gryphon', 'storm'], ['Wheel of Penitents', 'The Thorn Harlequin', 'steel'],
  ['The Violet Abyss', 'The Thousand-Eyed', 'storm'], ['Mireward Bastion', 'The Mire Crusader', 'ember'],
  ['The Dying Meridian', 'The Sun Mechanism', 'rime'], ['The Puppet Reliquary', 'The Marionette Saint', 'ember'],
  ['The Jade Procession', 'The Serpent Bride', 'steel'], ['The Red Dominion', 'The Scarlet Tyrant', 'rime'],
  ['The Fallen Firmament', 'The Broken Seraph', 'storm'], ['The Hollow Throne', 'The Hollow King', 'steel']
] as const satisfies readonly [string, string, Strike][];

const FAMILIES = [
  ['Mossfang', 'swift'], ['Crypt Pikeman', 'guard'], ['Moss Golem', 'guard'],
  ['Gravebloom', 'hex'], ['Carrion Acolyte', 'hex'], ['Gargoyle', 'swift'],
  ['Gravehound', 'swift'], ['Iron Scarab', 'guard'], ['Eel Wyrm', 'hex'],
  ['Crypt Headsman', 'guard'], ['Thorn Widow', 'swift'], ['Lantern Wraith', 'hex'],
  ['Iron Bowman', 'swift'], ['Ghost Stag', 'guard'], ['Mawstone', 'hex'],
  ['Cinder Newt', 'swift'], ['Siege Crawler', 'guard'], ['Bone Heron', 'swift'],
  ['Sporeguard', 'guard'], ['Veiled Alchemist', 'hex'], ['Crag Fiend', 'guard'],
  ['Blood Scorpion', 'swift'], ['Astral Cuttle', 'hex'], ['Ivory Revenant', 'guard']
] as const;
const ASPECTS = ['Gloam', 'Cinder', 'Rime', 'Viridian', 'Astral', 'Sable', 'Ivory', 'Blood'];
const REGULAR_SEALS: Strike[] = ['ember', 'rime', 'storm', 'steel'];
export interface Enemy {
  name: string; hp: number; atk: number; def: number; res: number; spd: number;
  arcane: boolean; boss: boolean; xp: number; gold: number; art: string;
  hue: number; seals: readonly Strike[];
}

export function encounter(wave: number, step: number): Enemy {
  const boss = step === ENCOUNTER_COUNT;
  const elite = !boss && (step === 12 || step === 24) && (wave > 1 || step === 24);
  const [_, bossName, seal] = WAVES[wave - 1]!;
  const family = wave === 1 && step <= 12 ? step - 1 : ((wave - 1) * 7 + (step - 1) * 5 + Math.floor(step / 9)) % FAMILIES.length;
  const [name, kind] = FAMILIES[family]!;
  const scale = 1 + 0.44 * (wave - 1) ** 1.32;
  const position = (step - 1) / 31;
  const guard = kind === 'guard';
  const swift = kind === 'swift';
  const first = wave === 1 && step <= 5;
  const regularSeal = wave === 1 ? 'ember' : REGULAR_SEALS[(wave + (step === 24 ? 2 : 0)) % 4]!;
  const seals = boss ? (wave === 32 ? ['steel', 'rime', 'storm'] as const :
    wave >= 9 ? [seal, REGULAR_SEALS[(REGULAR_SEALS.indexOf(seal) + 1 + (wave % 3)) % 4]!] : [seal]) :
    elite ? [regularSeal] : [];
  return {
    name: boss ? bossName : wave === 1 && step < 12 ? name : ASPECTS[(wave + Math.floor(step / 8)) % 8] + ' ' + name,
    hp: Math.round((boss ? 104 : (19 + 17 * position) * (guard ? 1.25 : 1) * (elite ? 1.45 : 1)) * scale),
    atk: (boss ? 38 + (wave % 4) * 3 : (first ? 6.5 : 15 + 8 * position) * (swift ? 0.83 : 1)) * scale ** 1.05,
    def: (boss ? 13 : guard ? 10 : 4) * scale ** 0.78,
    res: (boss ? 12 : kind === 'hex' ? 12 : 4) * scale ** 0.78,
    spd: (boss ? 1.14 + (wave % 5) * 0.13 : first ? 0.61 : swift ? 1.61 : guard ? 0.79 : 1.03) * (1 + (wave - 1) * 0.017),
    arcane: boss ? wave % 3 !== 1 : kind === 'hex',
    boss, xp: Math.round((boss ? 155 : 13 + 14 * position + (elite ? 14 : 0)) * scale ** 0.96),
    gold: Math.round((boss ? 130 : 7 + 6 * position + (elite ? 10 : 0)) * scale ** 0.87),
    art: boss ? 'boss-' + wave : 'foe-' + (family + 1),
    hue: boss || (wave === 1 && step < 13) ? 0 : ((wave - 1) * 39 + Math.floor(step / 7) * 29) % 360,
    seals
  };
}

export const GEAR_SLOTS = ['weapon', 'armor', 'shield', 'helm', 'boots', 'ring'] as const;
export type GearSlot = typeof GEAR_SLOTS[number];
export interface Gear { slot: GearSlot; tier: number; relic: boolean }
export const GEAR_NAMES: Record<GearSlot, string> = {
  weapon: 'Weapon', armor: 'Armor', shield: 'Shield', helm: 'Helmet', boots: 'Boots', ring: 'Ring'
};
const GEAR_TYPES = ['Blade', 'Cuirass', 'Ward', 'Crown', 'Greaves', 'Signet'];
const METALS = ['Iron', 'Ashsteel', 'Moon Silver', 'Obsidian', 'Starforged', 'Eclipse'];
const RELICS = ['Kingsbane', 'Oathplate', 'Graveward', 'The Last Crown', 'Wraithstep', 'Hollow Seal'];
export const gearId = (gear: Gear) => gear.slot + ':' + gear.tier + ':' + Number(gear.relic);

export function gearName(gear: Gear): string {
  const i = GEAR_SLOTS.indexOf(gear.slot);
  return gear.relic ? RELICS[i]! : METALS[Math.min(5, Math.floor((gear.tier - 1) / 6))] + ' ' + GEAR_TYPES[i];
}

export function gearBonus(gear: Gear): Partial<Stats> {
  const power = (1 + (gear.tier - 1) * 0.66) * (gear.relic ? 1.24 : 1);
  switch (gear.slot) {
    case 'weapon': return { atk: 9 * power, mag: 6 * power };
    case 'armor': return { hp: 31 * power, def: 7 * power };
    case 'shield': return { def: 6 * power, res: 7 * power };
    case 'helm': return { hp: 19 * power, res: 6 * power };
    case 'boots': return { def: 2 * power, spd: 0.09 * Math.sqrt(power) };
    case 'ring': return { mp: 5 * power, mag: 5 * power, regen: 0.18 * Math.sqrt(power) };
  }
}
export const gearPrice = (gear: Gear) => Math.round([95, 85, 64, 58, 66, 77][GEAR_SLOTS.indexOf(gear.slot)]! * gear.tier ** 1.43);
export const xpGoal = (level: number) => Math.floor(33 + 12 * level + 7 * level ** 1.61);
