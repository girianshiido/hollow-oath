import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encounter, gearId, gearPrice, HERO_IDS, SPELLS, WAVE_COUNT } from '../src/content.ts';
import { activeSeal, Battle, buyGear, equipGear, newRun, resumeWave, stats } from '../src/engine.ts';
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
  assert.ok(buyGear(r, gear));
  equipGear(r, gear, 'weapon');
  const battle = new Battle(r, () => {});
  battle.foe.spd = 3;
  battle.tick(5);
  assert.equal(r.phase, 'fallen');
  assert.equal(r.step, 25);
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
