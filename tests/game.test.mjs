import { ACHIEVEMENTS } from '../src/achievements.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encounter, gearId, gearName, gearPrice, GEAR_SLOTS, HERO_IDS, SPELLS, WAVE_COUNT } from '../src/content.ts';
import { activeSeal, Battle, buyGear, buySpell, canShop, equipGear, knownRank, newRun, preparedSpellCost, resumeWave, stats } from '../src/engine.ts';
import { decode, serialize } from '../src/saves.ts';

function at(wave, step, level = 15) {
  const r = newRun('vanguard');
  Object.assign(r, { wave, step, level, wait: 0, foeHp: encounter(wave, step).hp });
  Object.assign(r, { hp: stats(r).hp, mp: stats(r).mp });
  return r;
}
test('The campaign has 1024 encounters and 32 distinct boss artworks', () => {
  const bosses = new Set();
  let count = 0;
  for (let wave = 1; wave <= WAVE_COUNT; wave++) {
    for (let step = 1; step <= 32; step++) {
      const e = encounter(wave, step);
      assert.ok(e.hp > 0 && e.xp > 0 && e.gold > 0);
      assert.equal(e.boss, step === 32);
      if (e.boss) bosses.add(e.art);
      count++;
    }
  }
  assert.equal(count, 1024);
  assert.equal(bosses.size, 32);
});
test('Twice and triple the Speed give two and three strikes before the first player action', () => {
  for (const ratio of [2, 3]) {
    const r = at(1, 1);
    const sequence = [];
    const battle = new Battle(r, e => sequence.push(e.type));
    battle.foe.hp = r.foeHp = 9999;
    battle.foe.spd = ratio;
    battle.player.spd = 1;
    battle.tick(1);
    assert.deepEqual(sequence, [...Array(ratio).fill('hurt'), 'hit']);
  }
});
test('Tick partitioning preserves the timing and combat result', () => {
  const a = at(6, 7), b = structuredClone(a);
  const battleA = new Battle(a, () => {}, () => 1), battleB = new Battle(b, () => {}, () => 1);
  battleA.tick(4);
  for (let i = 0; i < 80; i++) battleB.tick(0.05);
  for (const key of ['hp','xp','gold','step','foeHp','broken','kills']) assert.equal(a[key], b[key]);
  for (const key of ['mp','playerGauge','enemyGauge','wait']) assert.ok(Math.abs(a[key] - b[key]) < 1e-6);
});
test('A Briar Seal stops even extremely strong steel and breaks with Ember Bolt', () => {
  const r = at(1, 32, 250);
  const battle = new Battle(r, () => {});
  const full = r.foeHp;
  battle.tick(1);
  assert.equal(r.foeHp, full);
  assert.equal(activeSeal(r, battle.foe), 'ember');
  Object.assign(r, {mode: 'magic', spell: 'ember'});
  battle.tick(1);
  assert.equal(r.phase, 'clear');
  assert.equal(r.broken, 1);
  assert.ok(r.inventory.some(g => g.relic));
});
test('Every seal of the final boss blocks damage at its own threshold', () => {
  const r = at(32, 32, 1000);
  const battle = new Battle(r, () => {});
  for (const seal of ['steel', 'rime', 'storm']) {
    assert.equal(activeSeal(r, battle.foe), seal);
    r.mode = seal === 'steel' ? 'magic' : 'steel';
    r.spell = 'ember';
    const before = r.foeHp;
    battle.tick(1);
    assert.equal(r.foeHp, before);
    r.mode = seal === 'steel' ? 'steel' : 'magic';
    if (seal !== 'steel') r.spell = seal;
    battle.tick(1);
  }
  assert.equal(r.phase, 'victory');
});
test('Magic consumes MP and returns to the sword; MP recovers on the combat clock', () => {
  const r = at(1, 1, 1);
  r.mp = SPELLS.ember.cost;
  r.mode = 'magic';
  const battle = new Battle(r, () => {});
  battle.tick(1.2);
  assert.equal(r.mode, 'steel');
  assert.ok(r.mp < 1 && r.mp > 0);
  const prior = r.mp;
  battle.tick(0.2);
  assert.ok(r.mp > prior);
});
test('Mend only spends mana when wounded and restores HP', () => {
  const r = at(1, 2, 5);
  Object.assign(r, {mode: 'magic', spell: 'mend'});
  const events = [];
  const other = new Battle(r, e => events.push(e.type));
  other.foe.hp = r.foeHp = 9999;
  other.player.spd = 2;
  other.tick(0.5);
  assert.equal(r.mp, other.player.mp);
  assert.ok(!events.includes('heal'));
  r.hp = other.player.hp * 0.4;
  const prior = r.hp;
  other.tick(1.2);
  assert.ok(r.hp > prior);
  assert.ok(events.includes('heal'));
});
test('Death retries the same wave at 1 and retains experience, gold and gear', () => {
  const r = at(2, 25);
  r.hp = 1;
  r.xp = 30;
  r.gold = 500;
  const gear = {slot: 'weapon', tier: 2, relic: false};
  const battle = new Battle(r, () => {});
  battle.foe.spd = 3;
  battle.tick(5);
  assert.equal(r.phase, 'fallen');
  assert.equal(r.step, 25);
  assert.ok(buyGear(r, gear));
  equipGear(r, gear, 'weapon');
  resumeWave(r);
  assert.equal(r.wave, 2);
  assert.equal(r.step, 1);
  assert.equal(r.hp, stats(r).hp);
  assert.equal(r.mp, stats(r).mp);
  assert.equal(r.xp, 30);
  assert.equal(r.gold, 500 - gearPrice(gear));
  assert.equal(r.equipped.weapon, gearId(gear));
});
test('Purchasing and equipping respect gold, wave, ownership and the gear slot', () => {
  const r = newRun('nightblade');
  const item = {slot: 'weapon', tier: 1, relic: false};
  assert.equal(buyGear(r, item), false);
  r.gold = 500;
  assert.equal(buyGear(r, item), false);
  r.phase = 'fallen';
  r.hp = 0;
  assert.equal(buyGear(r, {...item,tier:2}), false);
  assert.equal(buyGear(r, item), true);
  assert.equal(buyGear(r, item), false);
  equipGear(r, item, 'armor');
  assert.equal(r.equipped.armor, undefined);
  const atk = stats(r).atk;
  equipGear(r, item, 'weapon');
  assert.ok(stats(r).atk > atk);
});
test('All classes can round-trip versioned saves; bad saves and locked spells are rejected', () => {
  for (const hero of HERO_IDS) {
    const r = newRun(hero);
    assert.deepEqual(decode(serialize(r))?.run, r);
    r.spell = 'storm';
    assert.equal(decode(serialize(r)), null);
  }
  assert.equal(decode('not JSON'), null);
  assert.equal(decode('{"version":25,"updated":100,"run":{}}'), null);
});

test('A fallen guardian automatically opens the next wave', () => {
  const r = at(1, 32, 250);
  r.mode = 'magic';
  const battle = new Battle(r, () => {});
  battle.tick(1);
  assert.equal(r.phase, 'clear');
  battle.tick(1);
  assert.equal(r.phase, 'fight');
  assert.equal(r.wave, 2);
  assert.equal(r.step, 1);
  assert.equal(r.hp, stats(r).hp);
});

test('Shop and Workshop open only after defeat', () => {
  const r = newRun('vanguard');
  r.gold = 200;
  r.essence = 4;
  for (const phase of ['fight', 'clear', 'victory']) {
    r.phase = phase;
    for (let step = 1; step <= 32; step++) {
      r.step = step;
      assert.equal(canShop(r), false);
      assert.equal(buySpell(r, 'ember'), false);
      assert.equal(buyGear(r, {slot:'ring', tier:1, relic:false}), false);
    }
  }
  r.phase = 'clear';
  assert.equal(canShop(r), false);
  r.phase = 'fallen';
  r.hp = 0;
  assert.equal(canShop(r), true);
  assert.ok(buyGear(r, {slot:'ring', tier:1, relic:false}));
  resumeWave(r);
  assert.equal(canShop(r), false);
});


test('Every class, rank, slot and relic has a distinct equipment name', () => {
  const names = new Set();
  for (const hero of HERO_IDS) {
    for (let tier = 1; tier <= WAVE_COUNT; tier++) {
      for (const slot of GEAR_SLOTS) {
        for (const relic of [false, true]) {
          const name = gearName({ slot, tier, relic }, hero);
          assert.ok(name);
          assert.ok(!names.has(name), name);
          names.add(name);
        }
      }
    }
  }
  assert.equal(names.size, HERO_IDS.length * WAVE_COUNT * GEAR_SLOTS.length * 2);
  assert.equal(gearName({slot:'weapon', tier:1, relic:false}, 'vanguard'), 'Iron Blade');
});

test('Affinities modify damage, and campaign immunities never conflict with a required seal', () => {
  function strike(trait) {
    const run = at(3, 1, 15);
    run.mode = 'magic';
    const hits = [];
    const battle = new Battle(run, event => { if (event.type === 'hit') hits.push(event); });
    battle.foe.hp = run.foeHp = 2000;
    battle.foe.affinity = trait;
    battle.tick(1.1);
    assert.equal(hits.length, 1);
    return hits[0].damage;
  }
  const base = strike();
  assert.equal(strike({resists:'ember',weak:'rime',immune:false}), Math.round(base * .3));
  assert.equal(strike({resists:'ember',weak:'rime',immune:true}), 0);
  assert.equal(strike({resists:'steel',weak:'ember',immune:false}), Math.round(base * 1.5));
  for (let wave = 1; wave <= WAVE_COUNT; wave++) for (let step = 1; step <= 32; step++) {
    const foe = encounter(wave,step);
    if (foe.affinity?.immune) assert.ok(!foe.seals.includes(foe.affinity.resists));
  }
});

test('Essence is awarded once per marked encounter, even after retrying the same wave', () => {
  const run = at(1, 7, 35);
  const finish = () => {
    run.foeHp = 1;
    const battle = new Battle(run, () => {});
    battle.tick(1);
  };
  finish();
  assert.equal(run.essence, 1);
  assert.deepEqual(run.essenceClaims, [7]);
  run.wait = 0;
  finish();
  assert.equal(run.essence, 1);
  assert.equal(run.kills, 2);
});

test('Upgrades immediately increase the prepared spell cost', () => {
  const run = at(2, 1, 12);
  run.essence = 15;
  assert.equal(buySpell(run, 'aegis'), false);
  run.phase = 'fallen';
  run.hp = 0;
  assert.equal(buySpell(run, 'aegis'), true);
  assert.equal(buySpell(run, 'ember'), true);
  assert.equal(knownRank(run, 'ember'), 2);
  assert.equal(buySpell(run, 'ember'), false);
  assert.equal(preparedSpellCost(run), 6);
  resumeWave(run);
  run.wait = 0;
  const battle = new Battle(run, () => {});
  battle.foe.hp = run.foeHp = 2000;
  run.mode = 'magic';
  run.mp = 6;
  battle.tick(1.1);
  assert.equal(run.mode, 'steel');
  assert.ok(run.mp < 2);
  run.level = 1;
  assert.equal(knownRank(run, 'aegis'), 0);
});

test('Aegis absorbs the next hit and is then spent', () => {
  const run = at(1, 9, 15);
  run.spellRanks.aegis = 1;
  run.mode = 'magic';
  run.spell = 'aegis';
  const battle = new Battle(run, () => {});
  battle.foe.spd = .2;
  battle.tick(1.1);
  assert.ok(run.ward > 0);
  const hp = run.hp;
  run.mode = 'steel';
  run.enemyGauge = .999;
  battle.tick(.01);
  assert.equal(run.ward, 0);
  assert.equal(run.hp, hp);
});

test('Version-one saves retain progress and receive Essence for cleared guardians', () => {
  const run = at(5, 9, 22);
  run.xp = 42;
  run.gold = 801;
  const old = {...run};
  for (const key of ['ward','essence','essenceClaims','spellRanks']) delete old[key];
  const migrated = decode(JSON.stringify({version:1, updated:Date.now(), run:old}));
  assert.equal(migrated?.version, 4);
  assert.equal(migrated.run.level, run.level);
  assert.equal(migrated.run.xp, run.xp);
  assert.equal(migrated.run.gold, run.gold);
  assert.equal(migrated.run.foeHp, run.foeHp);
  assert.equal(migrated.run.essence, 12);
  assert.equal(preparedSpellCost(migrated.run), 4);
  assert.deepEqual(migrated.run.essenceClaims, [32,64,96,128]);
  assert.deepEqual(decode(serialize(migrated.run))?.run, migrated.run);
});


test('A legacy choice of a lower casting rank is replaced by the learned maximum', () => {
  const run = at(5, 9, 22);
  run.spellRanks.ember = 3;
  const old = {...run, castRank: 1};
  const migrated = decode(JSON.stringify({version:2, updated:Date.now(), run:old}));
  assert.equal(migrated?.version, 4);
  assert.equal(preparedSpellCost(migrated.run), 8);
  assert.equal('castRank' in migrated.run, false);
  migrated.run.mode = 'magic';
  migrated.run.mp = 4;
  const battle = new Battle(migrated.run, () => {});
  battle.tick(1.1);
  assert.equal(migrated.run.mode, 'steel');
  assert.ok(migrated.run.mp >= 4);
});


test('Defeats reset consecutive streaks while preserving records and clean-wave totals', () => {
  const run = at(1, 32, 250);
  run.mode = 'magic';
  const battle = new Battle(run, () => {});
  battle.tick(1);
  assert.equal(run.chronicle.cleanWaves, 1);
  assert.equal(run.chronicle.cleanStreak, 1);
  assert.equal(run.chronicle.spellUses.ember, 1);
  assert.equal(run.chronicle.seals, 1);
  assert.equal(run.chronicle.hits, 1);
  assert.equal(run.chronicle.streak, 1);
  battle.tick(1);
  run.hp = 1;
  run.enemyGauge = .9999;
  run.wait = 0;
  battle.tick(.1);
  assert.equal(run.phase, 'fallen');
  assert.equal(run.chronicle.streak, 0);
  assert.equal(run.chronicle.cleanStreak, 0);
  assert.equal(run.chronicle.bestStreak, 1);
  assert.equal(run.chronicle.cleanWaves, 1);
  resumeWave(run);
  assert.ok(run.chronicle.waveFallen);
});

test('Active time excludes defeat screens and freezes after the first campaign clear', () => {
  const run = at(32, 32, 1000);
  const battle = new Battle(run, () => {});
  for (const seal of ['steel', 'rime', 'storm']) {
    run.mode = seal === 'steel' ? 'steel' : 'magic';
    if (seal !== 'steel') run.spell = seal;
    battle.tick(1);
  }
  assert.equal(run.phase, 'victory');
  assert.ok(run.chronicle.finished);
  const finish = run.chronicle.activeSeconds;
  assert.ok(finish > 0 && finish < 3);
  assert.ok(ACHIEVEMENTS.find(item => item.id === 'time-90').progress(run));
  battle.tick(2);
  resumeWave(run);
  battle.refresh();
  battle.tick(.3, 1.5);
  assert.equal(run.chronicle.activeSeconds, finish);
  run.chronicle.activeSeconds = 5400;
  assert.equal(ACHIEVEMENTS.find(item => item.id === 'time-90').progress(run), 0);
  run.phase = 'fallen';
  run.chronicle.finished = false;
  battle.tick(.3, 1.5);
  assert.equal(run.chronicle.activeSeconds, 5400);
});

test('Old saves credit only recorded achievements and cannot submit a partial timer', () => {
  const run = at(8, 1, 22);
  run.kills = 224;
  const old = {...run};
  delete old.chronicle;
  const save = decode(JSON.stringify({version:3, updated:Date.now(), run:old}));
  assert.equal(save.run.chronicle.activeSeconds, null);
  assert.equal(save.run.chronicle.cleanWaves, 7);
  assert.equal(save.run.chronicle.bestStreak, 224);
  assert.equal(save.run.chronicle.hits, 0);
  const ids = ACHIEVEMENTS.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('An immune foe still receives the attempted spell and the caster pays its MP cost', () => {
  const run = at(2, 1, 15);
  run.mode = 'magic';
  const events = [];
  const battle = new Battle(run, event => events.push(event));
  battle.foe.affinity = {resists:'ember',weak:'rime',immune:true};
  const hp = run.foeHp;
  const mp = run.mp;
  battle.tick(1.1);
  assert.equal(run.foeHp, hp);
  assert.ok(run.mp < mp);
  assert.equal(run.chronicle.spellUses.ember, 1);
  assert.equal(run.chronicle.hits, 0);
  assert.deepEqual(events.find(event => event.type === 'hit'),
    {type:'hit',strike:'ember',damage:0,affinity:'immune'});
});

test('A mismatched attack against a seal emits the actual attempted strike', () => {
  const run = at(1, 32, 15);
  const events = [];
  const battle = new Battle(run, event => events.push(event));
  battle.tick(1.1);
  assert.deepEqual(events.find(event => event.type === 'block'), {type:'block',strike:'ember',attempt:'steel'});
});
