import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, tap, tapPower, rate, tick, cost, buyProducer, buyUpgrade, prestigeGain, prestige, stabilize, serialize, parseSave, OFFLINE_CAP, MAX_VALUE } from './engine.js';
function funded(amount = 10000) { const s = newGame(1000); s.energy = s.runEarned = s.totalEarned = amount; return s; }
test('new game starts with no output; twelve taps buy first collector', () => {
  const s = newGame(1000); assert.equal(rate(s), 0); assert.equal(tapPower(s), 1);
  assert.equal(buyProducer(s, 0), false);
  for (let i = 0; i < 12; i++) tap(s);
  assert.equal(buyProducer(s, 0), true); assert.equal(s.energy, 0); assert.equal(rate(s), 1);
  assert.equal(cost(s, 0), 14); assert.equal(tick(s, 2.5), 2.5); assert.equal(s.runEarned, 14.5);
});
test('producer costs grow and invalid purchases do nothing', () => {
  const s = funded(); const initial = s.energy;
  assert.equal(buyProducer(s, -1), false); assert.equal(buyProducer(s, 1.5), false); assert.equal(s.energy, initial);
  for (let i = 0; i < 4; i++) { if (cost(s, i) <= s.energy) assert.equal(buyProducer(s, i), true); }
  assert.equal(rate(s), 80);
});
test('research is unique, gated, and has intended effects', () => {
  const s = funded(); s.producers[0] = 10;
  assert.equal(buyUpgrade(s, 'gloves'), true); assert.equal(tapPower(s), 2);
  assert.equal(buyUpgrade(s, 'gloves'), false); assert.equal(buyUpgrade(s, 'missing'), false);
  assert.equal(buyUpgrade(s, 'coils'), true); assert.equal(rate(s), 20);
  assert.equal(buyUpgrade(s, 'resonance'), true); assert.equal(tapPower(s), 4);
  assert.equal(buyUpgrade(s, 'plasma'), true); assert.equal(rate(s), 40); assert.equal(tapPower(s), 6);
  const fresh = funded(50); assert.equal(buyUpgrade(fresh, 'coils'), false);
});
test('boost expires partway through a tick and cooldown prevents repeat rewards', () => {
  const s = funded(); s.producers[0] = 1;
  assert.equal(stabilize(s, .75), true); assert.equal(rate(s), 2);
  assert.equal(stabilize(s, 1), false); assert.equal(tick(s, 20), 35);
  assert.equal(rate(s), 1); assert.equal(s.stabilityCooldown, 10);
  tick(s, 10); assert.equal(stabilize(s, .5), false); assert.equal(s.stabilityCooldown, 30);
  tick(s, 30); assert.equal(stabilize(s, NaN), false); assert.equal(s.stabilityCooldown, 0);
});
test('prestige rewards run production and resets only the run', () => {
  const s = funded(100000); s.producers[1] = 3; s.upgrades = ['gloves']; s.settings.sound = true;
  assert.equal(prestigeGain(s), 2); assert.equal(prestige(s), 2);
  assert.equal(s.stars, 2); assert.equal(s.runEarned, 0); assert.equal(s.totalEarned, 100000);
  assert.equal(s.energy, 0); assert.deepEqual(s.producers, [0, 0, 0, 0]); assert.deepEqual(s.upgrades, []);
  assert.equal(s.settings.sound, true); assert.equal(tapPower(s), 1.5); assert.equal(prestige(s), 0);
});
test('save roundtrip is stable and independent', () => {
  const s = funded(); buyProducer(s, 1);
  const result = parseSave(serialize(s, 2000), 2000);
  assert.deepEqual(result.state, { ...s, lastSaved: 2000 }); assert.equal(result.offlineEarned, 0);
  result.state.producers[0]++; assert.equal(s.producers[0], 0);
});
test('offline progress caps at four hours and consumes temporary boost once', () => {
  const s = funded(); s.producers[0] = 1; stabilize(s, 1);
  const result = parseSave(serialize(s, 1000), 1000 + 8 * 3600 * 1000);
  assert.equal(result.offlineSeconds, OFFLINE_CAP); assert.equal(result.offlineEarned, OFFLINE_CAP + 15);
  assert.equal(result.state.boostsRemaining, 0); assert.equal(result.state.stabilityCooldown, 0);
  const again = parseSave(serialize(result.state, result.state.lastSaved), result.state.lastSaved);
  assert.equal(again.offlineEarned, 0);
  assert.equal(parseSave(serialize(s, 1000), 100000, { offline: false }).offlineEarned, 0);
  assert.equal(parseSave(serialize(s, 1000), 500).offlineEarned, 0);
});
test('invalid save schemas and unsafe numeric input are rejected', () => {
  for (const text of ['', 'null', '[]', '{}', '{', 'x'.repeat(20001)]) assert.throws(() => parseSave(text));
  for (const patch of [{ energy: -1 }, { energy: '1' }, { version: 2 }, { stars: .5 }, { producers: [1] }, { upgrades: ['gloves','gloves'] }, { upgrades: ['unknown'] }, { settings: {sound: false} }, { boostsRemaining: 16 }, { lastSaved: -1 }]) {
    assert.throws(() => parseSave(JSON.stringify({ ...newGame(0), ...patch }), 100));
  }
  assert.throws(() => parseSave('{"version":1,"energy":1e999}'));
  assert.throws(() => serialize({ ...newGame(), energy: NaN }));
});
test('time and large resources remain finite', () => {
  const s = funded(MAX_VALUE); s.producers[0] = 2000; s.stars = 1e99;
  assert.equal(tap(s), 0); assert.equal(tick(s, 20), 0); assert.ok(Number.isFinite(rate(s)));
  assert.equal(tick(s, Infinity), 0); assert.equal(tick(s, -2), 0); assert.equal(buyProducer(s, 0), false);
  assert.doesNotThrow(() => serialize(s));
});
