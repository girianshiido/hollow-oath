import {chapterBoss,chapterEndurance,chapterInfo} from './chapters.ts';
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
    name: 'Vanguard', defaultName: 'Aldric', role: 'The iron wall', color: '#e5ad6f',
    text: 'Heavy strikes and steel plate. Endures where others break.',
    base: { hp: 154, mp: 16, atk: 24, def: 17, mag: 10, res: 9, spd: 0.88, regen: 0.1 },
    gain: { hp: 17, mp: 0.85, atk: 3.5, def: 2.5, mag: 1.55, res: 1.55, spd: 0.005, regen: 0.10 }
  },
  hexweaver: {
    name: 'Hexweaver', defaultName: 'Seris', role: 'The glass flame', color: '#c2a0f2',
    text: 'Crushing spells and deep mana reserves. Vulnerable to steel.',
    base: { hp: 104, mp: 33, atk: 13, def: 8, mag: 30, res: 17, spd: 0.98, regen: 0.1 },
    gain: { hp: 11, mp: 1.6, atk: 1.8, def: 1.3, mag: 4.1, res: 2.5, spd: 0.006, regen: 0.17 }
  },
  nightblade: {
    name: 'Nightblade', defaultName: 'Nyx', role: 'The swift edge', color: '#a4d5a5',
    text: 'Strikes faster than any other oathbound. Wears light armor.',
    base: { hp: 118, mp: 21, atk: 18, def: 10, mag: 15, res: 11, spd: 1.52, regen: 0.1 },
    gain: { hp: 13, mp: 1, atk: 2.6, def: 1.55, mag: 2.2, res: 1.6, spd: 0.011, regen: 0.12 }
  },
  oathkeeper: {
    name: 'Oathkeeper', defaultName: 'Ilyan', role: 'The last light', color: '#91d6d5',
    text: 'Wards off sorcery and excels at healing. Fights a war of attrition.',
    base: { hp: 134, mp: 27, atk: 16, def: 13, mag: 20, res: 23, spd: 0.96, regen: 0.1 },
    gain: { hp: 15, mp: 1.35, atk: 2.3, def: 1.9, mag: 2.8, res: 3.05, spd: 0.006, regen: 0.15 }
  }
} satisfies Record<HeroId, {name: string; defaultName: string; role: string; color: string; text: string; base: Stats; gain: Stats}>;
export const HERO_IDS = Object.keys(HEROES) as HeroId[];
export const CHARACTER_NAME_LIMIT = 24;
export function normalizeCharacterName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().normalize('NFC');
  return name.length <= CHARACTER_NAME_LIMIT && !/[\u0000-\u001f\u007f-\u009f\u2028-\u202e\u2066-\u2069]/.test(name) ? name : null;
}


export type Strike = 'steel' | 'ember' | 'rime' | 'storm';
export type SpellId = Exclude<Strike, 'steel'> | 'mend' | 'aegis';
export const ELEMENT_NAMES: Record<Strike, string> = {steel: 'steel', ember: 'fire', rime: 'ice', storm: 'lightning'};
interface Spell {
  name: string; level: number; cost: number; color: string; text: string;
  strike?: Exclude<Strike, 'steel'>; price?: number;
}
export const SPELLS: Record<SpellId, Spell> = {
  ember: {name: 'Ember Bolt', level: 1, cost: 4, color: '#ff9d60', strike: 'ember', text: 'Hurls fire. Burns Briar Seals.'},
  mend: {name: 'Mend', level: 2, cost: 6, color: '#9effc1', text: 'Heals any missing HP. Returns to steel at full HP or insufficient MP.'},
  rime: {name: 'Rime Lance', level: 4, cost: 5, color: '#92e9ff', strike: 'rime', text: 'Pierces with ice and delays the next enemy strike. Quenches Cinder Seals.'},
  storm: {name: 'Storm Sigil', level: 7, cost: 7, color: '#d4adff', strike: 'storm', text: 'Strikes with lightning and pierces magic defense. Breaks Mirror Seals.'},
  aegis: {name: 'Aegis', level: 3, cost: 8, color: '#9fe6c0', price: 5, text: 'Reduces physical and magic damage for several incoming attacks. Returns to steel after casting; charges survive spell changes.'}
};
export const SPELL_IDS = Object.keys(SPELLS) as SpellId[];
export const MAX_SPELL_RANK = 10;
export const spellCost = (id: SpellId, rank: number) => SPELLS[id].cost + Math.min(2, Math.max(0, rank - 1)) * 2 + Math.max(0, rank - 3);
export const spellBoost = (rank: number) => 1 + Math.min(2, rank - 1) * .24 + Math.max(0, rank - 3) * .09;
export const aegisProtection = (rank: number) => ({reduction: .30 + (Math.max(1, rank) - 1) / 9 * .15, charges: 5 + Math.floor((Math.max(1, rank) - 1) / 3)});
// The price is for advancing from this learned level to the next one.
export const SPELL_UPGRADE_PRICES = [4,5,6,8,10,13,16,20,25] as const;
export const spellUpgradeCost = (rank: number): number | undefined => Number.isInteger(rank) ? SPELL_UPGRADE_PRICES[rank-1] : undefined;
export type EnemyMove = 'steel' | 'ember' | 'rime' | 'storm' | 'heavy' | 'mend' | 'drain';
export const ENEMY_MOVES: Record<EnemyMove, {name: string; warning: string; color: string}> = {
  steel: {name: 'Strike', warning: 'Readying steel', color: '#e6c28a'},
  heavy: {name: 'Crushing Blow', warning: 'Preparing a crushing blow…', color: '#ffba79'},
  ember: {name: 'Cinder Hex', warning: 'Gathering fire…', color: '#ff9d60'},
  rime: {name: 'Frost Shard', warning: 'Gathering frost…', color: '#92e9ff'},
  storm: {name: 'Stormcall', warning: 'Gathering lightning…', color: '#d4adff'},
  mend: {name: 'Mend', warning: 'Preparing to heal…', color: '#9effc1'},
  drain: {name: 'Life Drain', warning: 'Gathering a life-draining curse…', color: '#ed92bf'}
};
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
const NEWCOMERS = [
  ['Wickstalker','Hearthwick Prowler','Marshlight Hunter','Moonwick Shade','Hexflame Lurker','Griefwick Reaper'],
  ['Rimewing','Suncrest Raptor','Thornfeather','Glacier Pinion','Duskwing Harrier','Bloodquill'],
  ['Sepulcher Tortoise','Reliquary Shellback','Mossvault Terrapin','Frostcrypt Bulwark','Runeshell Colossus','Gravestone Walker'],
  ['Bellmaw','Brassgullet','Hollow Tollbeast','Frostbell Devourer','Midnight Knelljaw','Dirge Eater'],
  ['Censer Effigy','Ember Thurible','Rootsmoke Idol','Winter Incense','Veilfume Prophet','Mourning Censer'],
  ['Bladefin Koi','Sunriver Razorfin','Reedwater Skimmer','Glacial Sabrefin','Starcurrent Koi','Bloodstream Cutter'],
  ['Veilmoth Oracle','Dawnscale Seer','Thornwing Augur','Frostveil Diviner','Nightdust Prophet','Omenwing'],
  ['Glaivehorn Sentinel','Sunlance Warden','Rootward Guardian','Winterhorn Keeper','Duskglaive Custodian','Ruinantler']
] as const;
const NEWCOMER_STEPS = [5, 11, 17, 23, 29, 9, 15, 21] as const;
const NEWCOMER_PALETTES = [0, 57, 132, 205, 285, 327] as const;

function newcomer(wave: number, step: number) {
  const unlocked = Math.min(NEWCOMERS.length, Math.floor(wave / 4));
  // The last arrival has a second palette in the final wave, where it makes its only appearances.
  const encore = wave === WAVE_COUNT && step === 30;
  const position = encore ? NEWCOMER_STEPS.length : NEWCOMER_STEPS.findIndex(candidate => candidate === step);
  if (!unlocked || position < 0 || position >= unlocked + 2) return undefined;
  // Introduce the latest creature at the first sighting, then rotate through earlier arrivals.
  const index = position === 0 || encore || unlocked === 1 ? unlocked - 1 : (wave + position - 1) % (unlocked - 1);
  const palette = (wave - (index + 1) * 4 + position) % NEWCOMER_PALETTES.length;
  return {name: NEWCOMERS[index]![palette]!, art: 'newcomer-' + (index + 1), hue: NEWCOMER_PALETTES[palette]!};
}

const ASPECTS = ['Gloam', 'Cinder', 'Rime', 'Viridian', 'Astral', 'Sable', 'Ivory', 'Blood'];
const REGULAR_SEALS: Strike[] = ['ember', 'rime', 'storm', 'steel'];
export interface Enemy {
  name: string; hp: number; atk: number; def: number; res: number; spd: number;
  arcane: boolean; boss: boolean; chapter?: boolean; xp: number; gold: number; art: string;
  moves: readonly EnemyMove[]; healLimit: number;
  hue: number; seals: readonly Strike[]; essence: number;
  affinity?: {resists: Strike; weak: Strike; immune: boolean};
}

export function encounter(wave: number, step: number): Enemy {
  const boss = step === ENCOUNTER_COUNT;
  const elite = !boss && (wave >= 9 ? step % 6 === 0 : wave >= 2 ? step % 8 === 0 : step === 24);
  const [_, bossName, seal] = WAVES[wave - 1]!;
  const family = wave === 1 && step <= 12 ? step - 1 : ((wave - 1) * 7 + (step - 1) * 5 + Math.floor(step / 9)) % FAMILIES.length;
  const [name, kind] = FAMILIES[family]!;
  const arrival = newcomer(wave, step);
  const scale = 1 + 0.44 * (wave - 1) ** 1.32;
  const position = (step - 1) / 31;
  const guard = kind === 'guard';
  const swift = kind === 'swift';
  const first = wave === 1 && step <= 5;
  const regularSeal = wave === 1 ? 'ember' : REGULAR_SEALS[(wave + (step === 24 ? 2 : 0)) % 4]!;
  const chapter = boss && chapterBoss(wave);
  const phaseCount = chapter ? chapterInfo(wave).phases.length : wave === 32 ? 5 : wave >= 24 ? 4 : wave >= 12 ? 3 : wave >= 5 ? 2 : 1;
  const baseIndex = REGULAR_SEALS.indexOf(seal);
  const seals: readonly Strike[] = boss ? Array.from({length: phaseCount}, (_, i) => REGULAR_SEALS[(baseIndex + i) % 4]!) : elite ? [regularSeal] : [];
  const spellMoves: EnemyMove[] = wave < 3 ? ['ember'] : ['ember', 'rime', 'storm'];
  const element = spellMoves[(wave + family) % spellMoves.length]!;
  const moves: EnemyMove[] = boss ? ['steel', element, 'heavy', ...(wave >= 4 && wave % 3 !== 1 ? ['mend' as const] : []), ...(wave >= 8 && wave % 2 === 0 ? ['drain' as const] : [])] :
    kind === 'hex' ? [element, ...(wave >= 4 ? ['steel' as const, spellMoves[(wave + family + 1) % spellMoves.length]!] : [])] :
    elite ? ['steel', element, 'heavy'] : wave >= 5 && family % 4 === 0 ? ['steel', 'steel', 'heavy'] : ['steel'];
  const marked = step === 7 || step === 19 || step === 27;
  const affinityIndex = (family + Math.floor((wave - 1) / 4)) % 4;
  const resistances: Strike[] = ['steel', 'ember', 'rime', 'storm'];
  const weaknesses: Strike[] = ['storm', 'rime', 'ember', 'steel'];
  const resist = family === 15 ? 'ember' : resistances[affinityIndex]!;
  const weak = family === 15 ? 'rime' : weaknesses[affinityIndex]!;
  const affinity = (marked || (wave >= 3 && step % 3 === 0) || (family === 15 && wave > 1)) && !seals.includes(resist) ?
    {resists: resist, weak, immune: step === 27 && wave >= 5 && resist !== 'steel'} : undefined;
  const defenseProfile = [0.65, 1.35, .85, 1.7, 1.1, .75, 1.5, .95];
  const armorFactor = defenseProfile[family % defenseProfile.length]!;
  const magicFactor = defenseProfile[(family * 3 + 2) % defenseProfile.length]!;
  const veteran = .9 + ((family * 7 + step * 3 + wave) % 5) * .05;
  const endurance = boss ? 1 : 1 + Math.min(.30, Math.max(0, wave - 3) * .025);
  const openingBoost = step <= 2 ? 0 : Math.max(0, 1 - (wave - 1) / 8) * (guard ? 0.22 : swift ? 0 : 0.14);
  // A classic creature's named aspect always uses the same palette.
  const aspect = wave===1 && step<=12 ? 0 : Math.round((((wave-1)*39+Math.floor(step/7)*29)%360)/45)%ASPECTS.length;
  return {
    name: boss ? bossName : arrival?.name ?? (aspect===0 ? name : ASPECTS[aspect]+' '+name),
    hp: Math.round((boss ? 104 : (19 + 17 * position) * (guard ? 1.25 : 1) * (elite ? 1.45 : 1) * (1 + openingBoost) * (marked ? 1.14 : 1)) * scale * endurance * (chapter ? chapterEndurance(wave) : 1)),
    atk: (boss ? (38 + (wave % 4) * 3) * (wave < 5 ? 1 : wave < 9 ? 0.9 : 0.8) : (first ? 6.5 : 13.3 + 7.5 * position) * (swift ? 0.83 : 1)) * scale ** 1.05,
    def: (boss ? 13 * (.85 + (wave % 5) * .075) : (guard ? 12 : kind === 'hex' ? 3 : 6) * armorFactor * veteran) * scale ** .78,
    res: (boss ? 12 * (1.15 - (wave % 5) * .075) : (kind === 'hex' ? 14 : guard ? 4 : 8) * magicFactor * veteran) * scale ** .78,
    spd: (boss ? 1.14 + (wave % 5) * 0.13 : first ? 0.61 : swift ? 1.61 : guard ? 0.79 : 1.03) * (1 + (wave - 1) * 0.017),
    arcane: boss ? wave % 3 !== 1 : kind === 'hex',
    boss, chapter, xp: Math.round((boss ? 155 : 13 + 14 * position + (elite ? 14 : 0)) * scale ** 0.96),
    gold: Math.round((boss ? 130 : 7 + 6 * position + (elite ? 10 : 0)) * scale ** 0.87),
    art: boss ? 'boss-' + wave : arrival?.art ?? 'foe-' + (family + 1),
    hue: boss ? 0 : arrival?.hue ?? aspect*45,
    moves, healLimit: boss ? 2 : 0, seals, affinity, essence: boss ? 3 : marked ? 1 : 0
  };
}

export const GEAR_SLOTS = ['weapon', 'armor', 'shield', 'helm', 'boots', 'ring'] as const;
export type GearSlot = typeof GEAR_SLOTS[number];
export interface Gear { slot: GearSlot; tier: number; relic: boolean }
export const GEAR_NAMES: Record<GearSlot, string> = {
  weapon: 'Weapon', armor: 'Armor', shield: 'Shield', helm: 'Helmet', boots: 'Boots', ring: 'Ring'
};
// One row per rank, in GEAR_SLOTS order. The first entry is the relic epithet.
const GEAR_NAMES_BY_RANK = [
  ['the Briar', 'Iron Blade', 'Thornhide Coat', 'Gatewatch Shield', 'Pilgrim’s Hood', 'Trailworn Boots', 'Copper Vow'],
  ['the Bells', 'Bellringer’s Edge', 'Silent Vestment', 'Clapper Guard', 'Vigil Mask', 'Hushwalkers', 'Chimeband'],
  ['the Sunsteps', 'Aurelian Fang', 'Sunweave Hauberk', 'Dawn Disc', 'Lion’s Visor', 'Gilt Striders', 'Amber Eye'],
  ['the Undertow', 'Keelbreaker', 'Brinecoat', 'Wreckwood Buckler', 'Diver’s Helm', 'Tide Treads', 'Drowned Pearl'],
  ['the Furnace', 'Slagcleaver', 'Furnace Lamellar', 'Cinder Bulwark', 'Forgeface', 'Coalstep Sabatons', 'Ember Knot'],
  ['Harrowfrost', 'Rimecleaver', 'Winterbark Mail', 'Owlwood Ward', 'Hoarfrost Cowl', 'Snowdrift Boots', 'Blue Sap Ring'],
  ['the Thorn Court', 'Scarlet Needle', 'Bramble Doublet', 'Duelist’s Parry', 'Briar Circlet', 'Rosepath Shoes', 'Petal Signet'],
  ['the Moonworks', 'Crescent Cutter', 'Clockwork Carapace', 'Orbit Guard', 'Silver Dial Helm', 'Pendulum Treads', 'Lunar Cog'],
  ['the Saffron Tomb', 'Cobra’s Mercy', 'Saffron Shroud', 'Sarcophagus Lid', 'Pharaoh’s Asp', 'Dune Bindings', 'Scarab Coil'],
  ['the Spire', 'Widow’s Pin', 'Porcelain Jack', 'China Shell', 'Cracked Doll Mask', 'Silkfoot Slippers', 'White Web Ring'],
  ['the Zodiac', 'Comet Needle', 'Star Chart Mantle', 'Constellation Aegis', 'Seer’s Astrolabe', 'Sky Meridian Boots', 'Empty House'],
  ['the Belfry', 'Tusksplitter', 'Belfry Harness', 'Bronze Bell Guard', 'Ringer’s Cap', 'Marsh Trotters', 'Bell-Tongue Loop'],
  ['the Pyre', 'Vermilion Talon', 'Ashfeather Cape', 'Pyrewake Shield', 'Phoenix Crest', 'Firewalking Spurs', 'Sootglass Band'],
  ['the Pale Sea', 'Glacier Harpoon', 'Leviathan Hide', 'Floeshard Shield', 'Whalebone Helm', 'Icewake Boots', 'Northwater Opal'],
  ['Hammerdeep', 'Anvilbite', 'Anvilhide Hauberk', 'Hammerdeep Rampart', 'Oxhorn Helm', 'Ironfoundry Treads', 'Forgemaster’s Stamp'],
  ['the Gilded Prison', 'Jailer’s Keyblade', 'Gilded Straitcoat', 'Casket Door', 'Saint’s Blindfold', 'Manacle Boots', 'Prisoner’s Gold'],
  ['the Emerald Fen', 'Reedfang', 'Fenmoss Robe', 'Lilypad Targe', 'Coral Tiara', 'Bogskip Sandals', 'Greenwater Bead'],
  ['the Amber Wrecks', 'Deadwake Cutlass', 'Drowned Captain’s Coat', 'Capstan Guard', 'Wreckmaster’s Tricorn', 'Deckgrip Boots', 'Amber Doubloon'],
  ['the Poison Garden', 'Orchid’s Thorn', 'Venomleaf Tunic', 'Poison Petal Guard', 'Gardener’s Veil', 'Rootstalker Boots', 'Nightshade Cluster'],
  ['Moonglass Ridge', 'Chainfang', 'Moonglass Pelt', 'Packleader’s Ward', 'Silver Muzzle', 'Wolfprint Greaves', 'Moonchain Loop'],
  ['the Blood Caldera', 'Drake’s Tongue', 'Caldera Scale', 'Bloodstone Aegis', 'Wyrmjaw Helm', 'Lavawalk Spurs', 'Magma Vein'],
  ['the Glass Basilica', 'Obsidian Crosier', 'Stainedglass Mantle', 'Black Pane Shield', 'Bishop’s Mitre', 'Vesper Treads', 'Onyx Sacrament'],
  ['the Brass Aerie', 'Gryphon’s Beak', 'Aerie Brigandine', 'Brass Wing Guard', 'Owl’s Gaze', 'Skyhook Boots', 'High Perch Seal'],
  ['the Thorn Wheel', 'Harlequin’s Razor', 'Penitent’s Motley', 'Thornwheel Buckler', 'Jester’s Effigy', 'Spindle Shoes', 'Crooked Halo'],
  ['the Violet Abyss', 'Tentacle Hook', 'Abyssal Shroud', 'Many-Eyed Ward', 'Gazer’s Crown', 'Deepcurrent Boots', 'Violet Iris'],
  ['Mireward', 'Crusader’s Cleaver', 'Mireplate Coat', 'Bastion Tower Shield', 'Crocodile Casque', 'Siltbound Greaves', 'Marsh Oath'],
  ['the Meridian', 'Solar Caliper', 'Heliac Armor', 'Meridian Wheel', 'Sunface Helm', 'Zenith Sandals', 'Last Daystar'],
  ['the Reliquary', 'Puppeteer’s Shears', 'Stringbound Jacket', 'Marionette Brace', 'Cracked Harlequin Face', 'Puppetstep Shoes', 'Sixfold Knot'],
  ['the Jade Procession', 'Jade Viper', 'Bride’s Winding Silk', 'Serpent Fan', 'Mourning Veil', 'Procession Slippers', 'Ghost Wedding Band'],
  ['the Red Dominion', 'Tyrant’s Spur', 'Crimson Barding', 'Dominion Wall', 'Conqueror’s Sallet', 'Warsteed Boots', 'Red Decree'],
  ['the Firmament', 'Seraph’s Shard', 'Fallen Pinions', 'Firmament Guard', 'Broken Aureole', 'Heavenfall Striders', 'Blue Exile'],
  ['the Hollow Throne', 'Eclipse Reaver', 'Night Without End', 'Throne of Ash', 'Antler Diadem', 'Eventide Greaves', 'Last Light’s End']
] as const;
type GearNames = readonly [string, string, string, string, string, string];
const RELICS: Record<HeroId, GearNames> = {
  vanguard: ['Kingsbane', 'Oathplate', 'Graveward', 'The Last Crown', 'Wraithstep', 'Hollow Seal'],
  hexweaver: ['Witch’s Thorn', 'Veil of Starlight', 'The Argent Mirror', 'Astral Diadem', 'Leywalker', 'The Silver Thread'],
  nightblade: ['Widow’s Whisper', 'Nightweave', 'Shadowguard', 'The Faceless Mask', 'Silent Footfall', 'The Unseen Hand'],
  oathkeeper: ['Dawn’s Vow', 'The Pilgrim’s Mantle', 'Mercy’s Aegis', 'Halo of Witness', 'The Long Pilgrimage', 'Light’s Promise']
};
// Rank motifs follow the campaign. Each class has four sets of equipment silhouettes.
const GEAR_MOTIFS = [
  'Briar', 'Hushbell', 'Sunstep', 'Undertow', 'Furnace', 'Harrowfrost', 'Thorncourt', 'Moonwork',
  'Saffron', 'Ivoryspire', 'Zodiac', 'Belfry', 'Vermilion', 'Palewake', 'Hammerdeep', 'Gilded Tomb',
  'Reedwater', 'Amberwake', 'Venombloom', 'Moonglass', 'Bloodcaldera', 'Blackglass', 'Brasswind', 'Penitent',
  'Violet Deep', 'Mireward', 'Meridian', 'Stringbound', 'Jadeveil', 'Red Dominion', 'Firmament', 'Eventide'
] as const;
const CLASS_GEAR: Record<Exclude<HeroId, 'vanguard'>, readonly GearNames[]> = {
  hexweaver: [
    ['Spellfoil', 'Threadcloak', 'Focus Mirror', 'Witch Hat', 'Ley Treads', 'Runeband'],
    ['Rune Épée', 'Silk Robes', 'Scrying Disc', 'Seer’s Hood', 'Spellstep Shoes', 'Glyph Loop'],
    ['Sigil Rapier', 'Astral Mantle', 'Prism Ward', 'Weaver’s Veil', 'Leywalkers', 'Orbit Ring'],
    ['Voidfoil', 'Starwoven Shroud', 'Null Mirror', 'Oracle’s Diadem', 'Astral Slippers', 'Witch’s Signet']
  ],
  nightblade: [
    ['Shiv', 'Shadow Jerkin', 'Parrying Dagger', 'Cutpurse Hood', 'Softsoles', 'Viper Band'],
    ['Stiletto', 'Duskleather Vest', 'Fencer’s Guard', 'Sable Mask', 'Hushstep Shoes', 'Lockpick Loop'],
    ['Talon Knife', 'Shade Harness', 'Sleeve Buckler', 'Specter Cowl', 'Roofrunner Boots', 'Poison Ring'],
    ['Nightfang', 'Phantom Leathers', 'Hidden Parry', 'Faceless Veil', 'Silent Striders', 'Assassin’s Token']
  ],
  oathkeeper: [
    ['Sidesword', 'Pilgrim’s Tabard', 'Votive Shield', 'Lay Brother’s Cowl', 'Wayfarer Sandals', 'Prayer Bead'],
    ['Sanctified Saber', 'Chapel Mail', 'Reliquary Ward', 'Abbot’s Hood', 'Vigil Boots', 'Prayer Ring'],
    ['Dawn Falchion', 'Vesper Vestments', 'Procession Shield', 'Votive Circlet', 'Shrinewalkers', 'Mercy Band'],
    ['Judgment Blade', 'Saint’s Cuirass', 'Beacon Aegis', 'Lightbearer’s Halo', 'Pilgrim Greaves', 'Oath Seal']
  ]
};
export const gearId = (gear: Gear) => gear.slot + ':' + gear.tier + ':' + Number(gear.relic);

export function gearName(gear: Gear, hero: HeroId): string {
  const slot = GEAR_SLOTS.indexOf(gear.slot);
  const index = gear.tier - 1;
  const rank = GEAR_NAMES_BY_RANK[index]!;
  if (gear.relic) return RELICS[hero][slot]! + ' of ' + rank[0];
  if (hero === 'vanguard') return rank[slot + 1]!;
  return GEAR_MOTIFS[index]! + ' ' + CLASS_GEAR[hero][Math.floor(index / 8)]![slot]!;
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
export const xpGoal = (level: number) =>
  Math.floor((33 + 12 * level + 7 * level ** 1.61) * (1 + Math.min(0.18, Math.max(0, level - 3) * 0.022)));
