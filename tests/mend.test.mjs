import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HERO_IDS, encounter, spellCost} from '../src/content.ts';
import {Battle, newRun, resumeWave, stats} from '../src/engine.ts';
import {decode, serialize} from '../src/saves.ts';

function wounded(hero, rank, missing, mana) {
  const r = newRun(hero);
  Object.assign(r, {level: 40, step: 2, wait: 0, mode: 'magic', spell: 'mend'});
  r.spellRanks.mend = rank;
  const values = stats(r);
  r.hp = values.hp - missing;
  r.mp = mana ?? values.mp;
  r.foeHp = encounter(r.wave, r.step).hp;
  const events = [], b = new Battle(r, e => events.push(e), () => .5);
  b.foe.hp = r.foeHp = 999999;
  b.foe.spd = .001;
  b.foe.seals = [];
  b.foe.affinity = undefined;
  b.player.spd = 1;
  b.player.regen = 0;
  const act = () => { r.playerGauge = 1; b.tick(.001); };
  return {r, b, events, act};
}

test('Every class pays the full Mend cost for a single missing HP at ranks 1 and 10, then returns to steel', () => {
  for (const hero of HERO_IDS) for (const rank of [1, 10]) {
    const {r, b, events, act} = wounded(hero, rank, 1);
    const mp = r.mp, foeHp = r.foeHp;
    act();
    assert.equal(r.hp, b.player.hp, hero);
    assert.equal(r.mp, mp - spellCost('mend', rank));
    assert.equal(r.mode, 'steel');
    assert.equal(r.foeHp, foeHp, 'Healing consumes the action without also attacking');
    assert.equal(r.chronicle.spellUses.mend, 1);
    assert.deepEqual(events.filter(e => e.type === 'heal'), [{type: 'heal', amount: 1}]);
    r.hp -= 10; // A later wound must not reactivate the spell.
    act();
    assert.equal(r.hp, b.player.hp - 10);
    assert.equal(r.mp, mp - spellCost('mend', rank));
    assert.equal(r.chronicle.spellUses.mend, 1);
    assert.ok(events.some(e => e.type === 'hit' && e.strike === 'steel'));
  }
});

test('Mend repeatedly heals larger wounds, consumes one action per cast, and stops exactly at maximum HP', () => {
  for (const hero of HERO_IDS) {
    const {r, b, events, act} = wounded(hero, 1, stats({...newRun(hero), level: 40}).hp - 1);
    b.player.mp = r.mp = 1000;
    let casts = 0;
    while (r.hp < b.player.hp && casts < 30) {
      act();
      casts++;
      assert.equal(r.mode, r.hp === b.player.hp ? 'steel' : 'magic');
      assert.equal(r.mp, 1000 - casts * spellCost('mend', 1));
      assert.equal(events.filter(e => e.type === 'hit').length, 0);
    }
    assert.ok(casts > 1 && casts < 30);
    assert.equal(r.hp, b.player.hp);
    assert.equal(r.chronicle.spellUses.mend, casts);
    assert.equal(events.filter(e => e.type === 'heal').length, casts);
  }
});

test('Insufficient MP disables Mend before or after a partial heal; regeneration never reselects it', () => {
  for (const hero of HERO_IDS) for (const rank of [1, 10]) {
    const cost = spellCost('mend', rank);
    for (const available of [cost - .1, cost]) {
      const {r, b, events, act} = wounded(hero, rank, stats({...newRun(hero), level: 40}).hp - 1, available);
      act();
      assert.equal(r.mode, 'steel');
      assert.ok(r.hp < b.player.hp);
      assert.equal(r.chronicle.spellUses.mend, available < cost ? 0 : 1);
      assert.equal(r.mp, available < cost ? available : 0);
      const hp = r.hp, uses = r.chronicle.spellUses.mend;
      b.player.regen = 100;
      b.tick(.5);
      assert.ok(r.mp >= cost);
      act();
      assert.equal(r.hp, hp);
      assert.equal(r.mode, 'steel');
      assert.equal(r.chronicle.spellUses.mend, uses);
      assert.ok(events.some(e => e.type === 'hit' && e.strike === 'steel'));
    }
  }
});

test('Full-health loads, refreshes and wave resets never retain an armed Mend', () => {
  for (const hero of HERO_IDS) {
    const r = newRun(hero);
    r.level = 7;
    Object.assign(r, {hp: stats(r).hp, mp: stats(r).mp, mode: 'magic', spell: 'mend'});
    const saved = decode(serialize(r));
    assert.ok(saved);
    const b = new Battle(saved.run, () => {});
    assert.equal(saved.run.mode, 'steel');
    saved.run.mode = 'magic';
    b.refresh();
    assert.equal(saved.run.mode, 'steel');
    saved.run.mode = 'magic';
    saved.run.hp--;
    saved.run.phase = 'clear';
    resumeWave(saved.run);
    assert.equal(saved.run.wave, 2);
    assert.equal(saved.run.hp, stats(saved.run).hp);
    assert.equal(saved.run.mode, 'steel');
    assert.ok(decode(serialize(saved.run)));
  }
});
