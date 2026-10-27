import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from './engine.js';

const funded = amount => Object.assign(G.newGame(1000), { energy: amount, runEarned: amount, totalEarned: amount });
const roundTrip = s => G.parseSave(G.serialize(s, 1000), 1000, { offline: false }).state;

test('first automation is reachable in twelve taps and pays out continuously', () => {
  const s = G.newGame(1000);
  for (let i = 0; i < 11; i++) G.tap(s);
  assert.equal(G.buyProducer(s, 0), false);
  G.tap(s);
  assert.equal(G.buyProducer(s, 0), true);
  assert.equal(s.energy, 0);
  assert.equal(G.tick(s, 12), 12);
  assert.equal(s.energy, 12);
  assert.equal(G.cost(s, 0), 14);
});

test('all automation and research work; research cannot be repurchased', () => {
  const s = funded(100000);
  for (let i = 0; i < 4; i++) assert.equal(G.buyProducer(s, i), true);
  assert.equal(G.rate(s), 630);
  for (const u of G.UPGRADES) {
    assert.equal(G.buyUpgrade(s, u.id), true);
    const energy = s.energy;
    assert.equal(G.buyUpgrade(s, u.id), false);
    assert.equal(s.energy, energy);
  }
  assert.equal(G.rate(s), 2520);
  assert.equal(G.tapPower(s), 262);
  assert.deepEqual(roundTrip(s), s);
});

test('unknown purchase inputs are harmless and unaffordable purchases are atomic', () => {
  const s = G.newGame(1000), snapshot = structuredClone(s);
  for (const i of [-1, 4, 0.5, NaN, Infinity, '0', undefined]) assert.equal(G.buyProducer(s, i), false);
  for (const id of ['unknown', '__proto__', null, {}]) assert.equal(G.buyUpgrade(s, id), false);
  assert.equal(G.buyProducer(s, 0), false);
  assert.equal(G.buyUpgrade(s, 'gloves'), false);
  assert.deepEqual(s, snapshot);
});

test('prestige thresholds, reset, permanent bonus, and no repeated claim', () => {
  const s = funded(24999);
  assert.equal(G.prestige(s), 0);
  G.tap(s);
  s.settings = { sound: true, reducedMotion: true };
  G.buyProducer(s, 0); G.buyUpgrade(s, 'gloves');
  assert.equal(G.prestige(s), 1);
  assert.equal(s.stars, 1);
  assert.equal(s.totalEarned, 25000);
  assert.equal(s.energy, 0);
  assert.equal(s.runEarned, 0);
  assert.deepEqual(s.producers, [0, 0, 0, 0]);
  assert.deepEqual(s.upgrades, []);
  assert.deepEqual(s.settings, { sound: true, reducedMotion: true });
  assert.equal(G.tapPower(s), 1.25);
  assert.equal(G.prestige(s), 0);
  const later = funded(100000); later.stars = 1;
  assert.equal(G.prestige(later), 2);
  assert.equal(later.stars, 3);
});

test('stabilizer cooldown prevents repeated rewards; boost expires exactly', () => {
  const s = funded(12); G.buyProducer(s, 0);
  assert.equal(G.stabilize(s, 0.75), true);
  for (let i = 0; i < 100; i++) assert.equal(G.stabilize(s, 1), false);
  assert.equal(G.tick(s, 20), 35);
  assert.equal(s.boostsRemaining, 0);
  assert.equal(s.stabilityCooldown, 10);
  assert.equal(G.stabilize(s, 1), false);
  G.tick(s, 10);
  assert.equal(G.stabilize(s, 0.74), false);
  assert.equal(s.stabilityCooldown, 30);
  assert.equal(s.boostsRemaining, 0);
});

test('invalid clock deltas and minigame scores never corrupt state', () => {
  const s = funded(12); G.buyProducer(s, 0);
  const before = structuredClone(s);
  for (const n of [NaN, Infinity, -Infinity, -1, '10', null, undefined]) {
    assert.equal(G.tick(s, n), 0);
    assert.equal(G.stabilize(s, n), false);
  }
  assert.equal(G.stabilize(s, 1.01), false);
  assert.deepEqual(s, before);
});

test('offline rewards stop at four hours and boost applies for only fifteen seconds', () => {
  const s = funded(12); G.buyProducer(s, 0); G.stabilize(s, 1);
  const saved = G.serialize(s, 1000);
  const loaded = G.parseSave(saved, 1000 + 7 * 86400 * 1000);
  assert.equal(loaded.offlineSeconds, 14400);
  assert.equal(loaded.offlineEarned, 14415);
  assert.equal(loaded.state.boostsRemaining, 0);
  assert.equal(loaded.state.stabilityCooldown, 0);
  assert.equal(G.parseSave(saved, 0).offlineEarned, 0);
  assert.equal(G.parseSave(saved, 9999999, { offline: false }).offlineEarned, 0);
  assert.equal(G.parseSave(G.serialize(loaded.state, loaded.state.lastSaved), loaded.state.lastSaved).offlineEarned, 0);
});

test('malformed and oversized saves are rejected', () => {
  for (const value of [undefined, null, {}, '', '{', 'null', '[]', '1', '"x"', ' '.repeat(20001)]) assert.throws(() => G.parseSave(value));
  for (const field of ['energy', 'runEarned', 'totalEarned', 'stars', 'lastSaved', 'boostsRemaining', 'stabilityCooldown']) {
    for (const value of [-1, null, '1', {}, 1e101]) {
      assert.throws(() => G.parseSave(JSON.stringify({ ...G.newGame(1000), [field]: value })), `${field}: ${String(value)}`);
    }
  }
  for (const value of [[0], [0,0,0,0,0], [-1,0,0,0], [0.5,0,0,0], [2001,0,0,0], ['1',0,0,0]]) {
    assert.throws(() => G.parseSave(JSON.stringify({ ...G.newGame(1000), producers: value })));
  }
  for (const value of [['gloves','gloves'], ['unknown'], {}, null]) assert.throws(() => G.parseSave(JSON.stringify({ ...G.newGame(1000), upgrades: value })));
});

test('inconsistent totals, settings, version, and fractional stars rejected', () => {
  for (const patch of [{ energy: 1 }, { runEarned: 1 }, { version: 2 }, { stars: 0.5 }, { settings: [] }, { settings: { sound: 1, reducedMotion: false } }]) {
    assert.throws(() => G.parseSave(JSON.stringify({ ...G.newGame(1000), ...patch })));
  }
});

test('save reconstruction drops unknown and prototype-pollution properties', () => {
  const raw = JSON.parse(G.serialize(G.newGame(1000), 1000));
  Object.defineProperty(raw, '__proto__', { value: { polluted: true }, enumerable: true });
  raw.untrusted = '<script>alert(1)</script>';
  raw.settings.extra = 42;
  const s = G.parseSave(JSON.stringify(raw), 1000).state;
  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(s, '__proto__'), false);
  assert.equal(Object.hasOwn(s, 'untrusted'), false);
  assert.equal(Object.hasOwn(s.settings, 'extra'), false);
});

test('extreme accepted saves remain finite through production, tap, and prestige', () => {
  const s = funded(G.MAX_VALUE);
  s.stars = G.MAX_VALUE; s.producers = [2000, 2000, 2000, 2000];
  s.upgrades = G.UPGRADES.map(u => u.id);
  const safe = roundTrip(s);
  assert.equal(G.buyProducer(safe, 0), false);
  assert.ok(Number.isFinite(G.rate(safe)));
  assert.ok(Number.isFinite(G.tapPower(safe)));
  assert.equal(G.tap(safe), 0);
  assert.equal(G.tick(safe, Number.MAX_VALUE), 0);
  assert.ok(Number.isFinite(G.prestige(safe)));
  G.tap(safe); G.tick(safe, 1);
  assert.doesNotThrow(() => roundTrip(safe));
});

test('ten thousand deterministic mixed actions preserve valid save invariants', () => {
  let s = G.newGame(1000), seed = 12345;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 10000; i++) {
    switch (Math.floor(random() * 7)) {
      case 0: G.tap(s); break;
      case 1: G.tick(s, random() * 200); break;
      case 2: G.buyProducer(s, Math.floor(random() * 4)); break;
      case 3: G.buyUpgrade(s, G.UPGRADES[Math.floor(random() * G.UPGRADES.length)].id); break;
      case 4: G.stabilize(s, random()); break;
      case 5: G.prestige(s); break;
      case 6: s = roundTrip(s); break;
    }
    assert.ok(Number.isFinite(s.energy) && s.energy >= 0);
    assert.ok(s.energy <= s.runEarned && s.runEarned <= s.totalEarned);
  }
  assert.doesNotThrow(() => roundTrip(s));
});
