import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from './engine.js';

const roundTrip = s => G.parseSave(G.serialize(s, 1000), 1000, { offline: false }).state;
function play(s, { goal = () => s.completed, games = false } = {}) {
  let seconds = 0, pulses = 0;
  const chapters = new Set([G.chapter(s)]);
  // A deterministic player: establish automation, buy research and a balanced
  // fleet, then bank energy for the ending. No resource injection or time warp.
  while (!s.producers.some(Boolean) && pulses < 12) { G.tap(s); pulses++; }
  G.buyProducer(s, 0);
  for (let step = 0; step < 20000 && !goal(); step++) {
    for (const u of G.UPGRADES) G.buyUpgrade(s, u.id);
    for (let i = G.PRODUCERS.length - 1; i >= 0; i--) if (s.producers[i] < 12) G.buyProducer(s, i);
    if (games) { G.stabilize(s, 1); G.sideReward(s, 'memory', true); G.sideReward(s, 'routing', true); }
    G.tick(s, 10); seconds += 10;
    chapters.add(G.chapter(s));
    G.launchBeacon(s);
    if (step % 100 === 0) assert.deepEqual(roundTrip(s), s);
  }
  assert.ok(goal(), `Goal unreachable after ${seconds} simulated seconds`);
  return { seconds, pulses, chapters };
}

test('complete campaign is reachable from a fresh save without any minigame or prestige', t => {
  const s = G.newGame(1000);
  assert.equal(G.launchBeacon(s), false);
  const result = play(s);
  assert.equal(s.completed, true);
  assert.equal(s.stars, 0);
  assert.equal(s.wins.length, 0);
  assert.equal(G.chapter(s), -1);
  assert.ok(s.producers.every(n => n > 0));
  assert.equal(s.upgrades.length, G.UPGRADES.length);
  assert.ok(s.achievements.includes('home'));
  assert.deepEqual([...result.chapters].sort((a,b) => a-b), [-1,0,1,2,3,4,5]);
  const bank = s.energy;
  assert.equal(G.launchBeacon(s), false);
  assert.equal(s.energy, bank);
  assert.deepEqual(roundTrip(s), s);
  t.diagnostic(`Campaign: ${result.seconds} simulated seconds, ${result.pulses} initial pulses, no side games`);
});

test('optional side games accelerate but never gate the same complete campaign', t => {
  const s = G.newGame(1000), result = play(s, { games: true });
  assert.deepEqual([...s.wins].sort(), ['memory','routing','timing']);
  assert.ok(s.achievements.includes('play'));
  assert.ok(s.completed);
  t.diagnostic(`Campaign with optional bonuses: ${result.seconds} simulated seconds`);
});

test('producer unlocks and final launch reject unmet conditions atomically', () => {
  const s = G.newGame(1000);
  s.energy = s.runEarned = s.totalEarned = 49999;
  assert.equal(G.producerUnlocked(s, 4), false);
  const before = structuredClone(s);
  assert.equal(G.buyProducer(s, 4), false);
  assert.equal(G.launchBeacon(s), false);
  assert.deepEqual(s, before);
  G.tap(s);
  assert.equal(G.producerUnlocked(s, 4), true);
  assert.equal(G.buyProducer(s, 4), false);
});

test('legacy v1 save migrates resources, preferences, timers and four producers losslessly', () => {
  const legacy = { version: 1, energy: 500, totalEarned: 9000, runEarned: 4000, producers: [3,2,1,0], upgrades: ['gloves','coils'], stars: 2, boostsRemaining: 10, stabilityCooldown: 20, lastSaved: 1000, settings: { sound: true, reducedMotion: true } };
  const s = G.parseSave(JSON.stringify(legacy), 1000).state;
  assert.equal(s.version, 2);
  for (const key of ['energy','totalEarned','runEarned','upgrades','stars','boostsRemaining','stabilityCooldown','settings']) assert.deepEqual(s[key], legacy[key]);
  assert.deepEqual(s.producers, [3,2,1,0,0,0,0]);
  assert.equal(s.completed, false);
  assert.deepEqual(s.constellations, []);
  assert.deepEqual(roundTrip(s), s);
});

test('v2 requires every campaign field and rejects malformed enums, counts and spending', () => {
  for (const key of ['spentStars','constellations','challenge','completedChallenges','achievements','wins','memoryCooldown','routingCooldown','completed']) {
    const raw = G.newGame(1000); delete raw[key];
    assert.throws(() => G.parseSave(JSON.stringify(raw), 1000), `Missing ${key}`);
  }
  const bad = [{spentStars: 1}, {spentStars: .5}, {challenge: 'unknown'}, {completed: 1}, {memoryCooldown: 91}, {routingCooldown: -1}, {constellations: ['seed']}, {completedChallenges: ['quiet','quiet']}, {achievements: ['unknown']}, {wins: ['memory','memory']}, {wins: ['other']}];
  for (const patch of bad) assert.throws(() => G.parseSave(JSON.stringify({...G.newGame(1000), ...patch}), 1000));
});

test('constellation spending is unique and permanent; campaign and cooldowns survive prestige', () => {
  const s = G.newGame(1000); play(s);
  G.sideReward(s, 'memory', true); G.sideReward(s, 'routing', true); G.stabilize(s, 1);
  const stars = G.prestige(s);
  assert.ok(stars >= 11);
  for (const c of G.CONSTELLATIONS) assert.equal(G.buyConstellation(s, c.id), true);
  assert.equal(s.spentStars, 11);
  assert.equal(s.stars, stars);
  assert.equal(G.buyConstellation(s, 'seed'), false);
  assert.equal(G.buyConstellation(s, 'unknown'), false);
  assert.equal(s.completed, true);
  assert.equal(G.sideReward(s, 'memory', true), false);
  assert.equal(G.sideReward(s, 'routing', true), false);
  assert.equal(G.stabilize(s, 1), false);
  assert.ok(G.startChallenge(s, 'quiet'));
  assert.equal(s.producers[0], 3);
  assert.equal(G.cost(s, 1), Math.ceil(G.PRODUCERS[1].cost * .8));
  assert.deepEqual(roundTrip(s), s);
});

test('both challenges can be completed through ordinary play with permanent rewards', t => {
  const s = G.newGame(1000);
  assert.equal(G.startChallenge(s, 'quiet'), false);
  play(s, { goal: () => s.runEarned >= 25000 });
  assert.ok(G.prestige(s) >= 1);
  for (const c of G.CHALLENGES) {
    assert.equal(G.startChallenge(s, c.id), true);
    assert.equal(G.startChallenge(s, c.id), false);
    if (c.id === 'quiet') { const energy = s.energy; assert.equal(G.tap(s), 0); assert.equal(s.energy, energy); }
    const result = play(s, { goal: () => s.completedChallenges.includes(c.id) });
    assert.equal(s.challenge, '');
    if (c.id === 'compact') assert.ok(s.producers.every(n => n <= 5));
    assert.deepEqual(roundTrip(s), s);
    t.diagnostic(`${c.name}: ${result.seconds} simulated seconds`);
  }
  assert.equal(G.abandonChallenge(s), false);
  assert.equal(G.startChallenge(s, 'quiet'), true);
  assert.equal(G.abandonChallenge(s), true);
  assert.equal(s.completedChallenges.length, 2);
});

test('side-game failures consume cooldown; malformed requests do not; timers survive offline and resets', () => {
  const s = G.newGame(1000), before = structuredClone(s);
  for (const args of [['unknown',true], ['memory',1], ['routing',null]]) assert.equal(G.sideReward(s, ...args), false);
  assert.deepEqual(s, before);
  for (const game of ['memory','routing']) {
    assert.equal(G.sideReward(s, game, false), false);
    assert.equal(s[game+'Cooldown'], 90);
    assert.equal(G.sideReward(s, game, true), false);
  }
  G.tick(s, 89.5);
  assert.equal(G.sideReward(s, 'memory', true), false);
  G.tick(s, .5);
  assert.equal(G.sideReward(s, 'memory', true), true);
  assert.equal(s.energy, 20);
  const loaded = G.parseSave(G.serialize(s,1000), 91000).state;
  assert.equal(loaded.memoryCooldown, 0);
  assert.equal(loaded.routingCooldown, 0);
});

test('routing puzzle accepts a connected route and rejects malformed, broken and out-of-bounds grids', () => {
  for (const cells of [null, [], Array(9).fill(6), Array(9).fill(.5), Array(9).fill(0), Array(9).fill('1')]) assert.equal(G.routingSolved(cells), false);
  const solution = [0,0,4,0,0,1,0,0,2];
  assert.equal(G.routingSolved(solution), true);
  for (const cell of [0,1,2,5,8]) {
    const broken = [...solution]; broken[cell] = (broken[cell] + 1) % 6;
    assert.equal(G.routingSolved(broken), false, `Broken path cell ${cell}`);
  }
  // Routes leaving through the top, bottom, or an earlier right edge do not win.
  for (const cells of [[5,0,4,0,0,1,0,0,2], [4,0,0,1,0,0,1,0,0], [0,0,0,0,0,0,0,0,0]]) assert.equal(G.routingSolved(cells), false);
});

test('twenty thousand mixed campaign actions retain finite, serializable state', () => {
  let s = G.newGame(1000), seed = 92741;
  const random = () => ((seed = (Math.imul(seed,1664525)+1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 20000; i++) {
    switch (Math.floor(random()*13)) {
      case 0: G.tap(s); break;
      case 1: G.tick(s, random()*500); break;
      case 2: G.buyProducer(s, Math.floor(random()*G.PRODUCERS.length)); break;
      case 3: G.buyUpgrade(s, G.UPGRADES[Math.floor(random()*G.UPGRADES.length)].id); break;
      case 4: G.buyConstellation(s, G.CONSTELLATIONS[Math.floor(random()*G.CONSTELLATIONS.length)].id); break;
      case 5: G.startChallenge(s, random()<.5 ? 'quiet' : 'compact'); break;
      case 6: G.abandonChallenge(s); break;
      case 7: G.prestige(s); break;
      case 8: G.launchBeacon(s); break;
      case 9: G.stabilize(s, random()); break;
      case 10: G.sideReward(s, random()<.5 ? 'memory' : 'routing', random()<.7); break;
      case 11: G.checkProgress(s); break;
      case 12: s=roundTrip(s); break;
    }
    assert.ok(Number.isFinite(s.energy) && s.energy>=0);
    assert.ok(s.energy<=s.runEarned && s.runEarned<=s.totalEarned);
    assert.ok(s.spentStars<=s.stars);
    assert.ok(Number.isFinite(G.rate(s)) && Number.isFinite(G.tapPower(s)));
    if (s.challenge==='compact') assert.ok(s.producers.every(n=>n<=5));
  }
  assert.deepEqual(roundTrip(s),s);
});

test('all permanent rewards and huge production stay finite at numeric resource limits', () => {
  const s=G.newGame(1000);
  s.energy=s.runEarned=s.totalEarned=s.stars=G.MAX_VALUE;
  s.producers=G.PRODUCERS.map(()=>2000);
  s.upgrades=G.UPGRADES.map(u=>u.id);
  s.completedChallenges=G.CHALLENGES.map(c=>c.id);
  for (const c of G.CONSTELLATIONS) G.buyConstellation(s,c.id);
  assert.ok(Number.isFinite(G.rate(s)));
  assert.ok(Number.isFinite(G.tapPower(s)));
  for (const game of ['memory','routing']) assert.equal(G.sideReward(s,game,true),true);
  assert.equal(G.tap(s),0);
  assert.equal(G.tick(s,Number.MAX_VALUE),0);
  assert.deepEqual(roundTrip(s),s);
  assert.ok(Number.isFinite(G.prestige(s)));
  assert.deepEqual(roundTrip(s),s);
});


test('legacy research and active challenge counts respect their version-specific constraints', () => {
  const legacy = {version:1,energy:0,totalEarned:0,runEarned:0,producers:[0,0,0,0],upgrades:[],stars:0,boostsRemaining:0,stabilityCooldown:0,lastSaved:1000,settings:{sound:false,reducedMotion:false}};
  for (const id of ['lattice','beacon']) assert.throws(()=>G.parseSave(JSON.stringify({...legacy,upgrades:[id]}),1000));
  const compact=G.newGame(1000); compact.challenge='compact'; compact.stars=1; compact.producers[0]=6;
  assert.throws(()=>G.parseSave(JSON.stringify(compact),1000));
});
