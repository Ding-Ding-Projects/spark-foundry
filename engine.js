/** Deterministic game rules. All actions mutate only the supplied state. */
export const VERSION = 2;
export const MAX_VALUE = 1e100;
export const OFFLINE_CAP = 4 * 60 * 60;
export const PRODUCERS = Object.freeze([
  { id: 'collector', name: 'Spark collector', description: 'Catch the first light.', cost: 12, rate: 1 },
  { id: 'dynamo', name: 'Ion dynamo', description: 'Turn charged particles into possibility.', cost: 120, rate: 9 },
  { id: 'forge', name: 'Plasma forge', description: 'A little star, working for you.', cost: 1200, rate: 70 },
  { id: 'array', name: 'Orbital array', description: 'Harvest the light between worlds.', cost: 12000, rate: 550 },
  { id: 'garden', name: 'Solar garden', description: 'Grow a forest of captured sunlight.', cost: 90000, rate: 3600, unlock: 50000 },
  { id: 'gate', name: 'Wormhole mill', description: 'Bring distant starlight home.', cost: 650000, rate: 23000, unlock: 400000 },
  { id: 'heart', name: 'Galaxy heart', description: 'The engine that can relight the expanse.', cost: 4500000, rate: 150000, unlock: 3000000 },
]);
export const UPGRADES = Object.freeze([
  { id: 'gloves', name: 'Conductive gloves', description: 'Double sparks per tap.', cost: 35, requiresRunEarned: 0, effect: 'tap' },
  { id: 'coils', name: 'Superconducting coils', description: 'Double all automatic production.', cost: 200, requiresRunEarned: 100, effect: 'production' },
  { id: 'resonance', name: 'Resonant touch', description: 'Taps also collect 10% of one second of production.', cost: 700, requiresRunEarned: 500, effect: 'resonance' },
  { id: 'plasma', name: 'Plasma compression', description: 'Double all automatic production again.', cost: 3000, requiresRunEarned: 2000, effect: 'production' },
  { id: 'lattice', name: 'Photon lattice', description: 'Double all automatic production again.', cost: 900000, requiresRunEarned: 400000, effect: 'production' },
  { id: 'beacon', name: 'Beacon lens', description: 'Unlock the final beacon launch. The expanse is listening.', cost: 2500000, requiresRunEarned: 3000000, effect: 'ending' },
  { id: 'quantum', name: 'Quantum fingertips', description: 'Multiply base sparks per tap by five.', cost: 8000, requiresRunEarned: 5000, effect: 'tap' },
]);
export const CONSTELLATIONS = Object.freeze([
  { id: 'seed', name: 'First light', cost: 1, description: 'Begin every new run with three free collectors.' },
  { id: 'craft', name: 'Resourceful hands', cost: 2, description: 'Machines cost 20% less, including this run.' },
  { id: 'pulse', name: 'Living core', cost: 3, description: 'Pulses gain 20% of one second of automatic output.' },
  { id: 'orbit', name: 'Deep orbit', cost: 5, description: 'Solar gardens, mills and galaxy hearts produce twice as much.' },
]);
export const CHALLENGES = Object.freeze([
  { id: 'quiet', name: 'Silent skies', description: 'No manual energy. Start with one collector; earn 500,000 J. Reward: permanent +20% automatic output.', target: 500000 },
  { id: 'compact', name: 'Small constellation', description: 'At most five of each machine. Earn 2,000,000 J. Reward: permanent +20% pulse power.', target: 2000000 },
]);
export const CHAPTERS = Object.freeze([
  { name: 'First light', target: 12, producer: 0, research: 'gloves', story: 'Wake the outpost: build a collector and research Conductive gloves.' },
  { name: 'A working sky', target: 1200, producer: 1, research: 'coils', story: 'Build an Ion dynamo and research Superconducting coils.' },
  { name: 'Stellar industry', target: 25000, producer: 3, research: 'plasma', story: 'Build an Orbital array and research Plasma compression. Supernova is now an optional shortcut.' },
  { name: 'Garden of suns', target: 400000, producer: 4, research: 'resonance', story: 'Build a Solar garden and research Resonant touch.' },
  { name: 'Across the expanse', target: 3000000, producer: 5, research: 'lattice', story: 'Build a Wormhole mill and research the Photon lattice.' },
  { name: 'Bring everyone home', target: 15000000, producer: 6, research: 'beacon', story: 'Build a Galaxy heart, research the Beacon lens, and bank 5,000,000 J to relight the expanse.' },
]);
export const ACHIEVEMENTS = Object.freeze([
  { id: 'automation', name: 'A helping hand', description: 'Build your first machine.' },
  { id: 'million', name: 'A million little lights', description: 'Earn 1,000,000 J across all runs.' },
  { id: 'reborn', name: 'From the ashes', description: 'Earn your first star essence.' },
  { id: 'scientist', name: 'Bright ideas', description: 'Research every breakthrough in one run.' },
  { id: 'play', name: 'Off-duty engineer', description: 'Win each of the three optional side games.' },
  { id: 'home', name: 'No one left in the dark', description: 'Relight the expanse.' },
]);
const clamp = n => Math.min(MAX_VALUE, Math.max(0, n));
export function newGame(now = Date.now()) {
  return { version: VERSION, energy: 0, totalEarned: 0, runEarned: 0, producers: PRODUCERS.map(() => 0), upgrades: [], stars: 0, spentStars: 0, constellations: [], challenge: '', completedChallenges: [], achievements: [], wins: [], memoryCooldown: 0, routingCooldown: 0, completed: false, boostsRemaining: 0, stabilityCooldown: 0, lastSaved: now, settings: { sound: false, reducedMotion: false } };
}
function baseRate(s) {
  let result = PRODUCERS.reduce((sum, p, i) => sum + p.rate * s.producers[i] * (i >= 4 && s.constellations.includes('orbit') ? 2 : 1), 0) * (1 + s.stars * 0.25);
  if (s.upgrades.includes('coils')) result *= 2;
  if (s.upgrades.includes('plasma')) result *= 2;
  if (s.upgrades.includes('lattice')) result *= 2;
  if (s.completedChallenges.includes('quiet')) result *= 1.2;
  return clamp(result);
}
export function rate(s) { return clamp(baseRate(s) * (s.boostsRemaining > 0 ? 2 : 1)); }
export function tapPower(s) {
  let result = (1 + s.stars * 0.25) * (s.upgrades.includes('gloves') ? 2 : 1) * (s.upgrades.includes('quantum') ? 5 : 1);
  if (s.upgrades.includes('resonance')) result += rate(s) * 0.1;
  if (s.constellations.includes('pulse')) result += rate(s) * .2;
  if (s.completedChallenges.includes('compact')) result *= 1.2;
  return s.challenge === 'quiet' ? 0 : clamp(result);
}
function earn(s, amount) {
  const earned = Math.min(clamp(amount), MAX_VALUE - s.energy, MAX_VALUE - s.runEarned, MAX_VALUE - s.totalEarned);
  s.energy += earned; s.runEarned += earned; s.totalEarned += earned;
  return earned;
}
export function tap(s) { return earn(s, tapPower(s)); }
export function cost(s, index) {
  if (!Number.isInteger(index) || !PRODUCERS[index]) return Infinity;
  const value = Math.ceil(PRODUCERS[index].cost * (s.constellations.includes('craft') ? .8 : 1) * 1.16 ** s.producers[index]);
  return value > MAX_VALUE || s.producers[index] >= 2000 ? Infinity : value;
}
export function producerUnlocked(s, index) { return !!PRODUCERS[index] && s.runEarned >= (PRODUCERS[index].unlock || 0); }
export function buyProducer(s, index) {
  const price = cost(s, index);
  if (!producerUnlocked(s, index) || (s.challenge === 'compact' && s.producers[index] >= 5) || s.energy < price || !Number.isFinite(price)) return false;
  s.energy -= price; s.producers[index] += 1; return true;
}
export function buyUpgrade(s, id) {
  const item = UPGRADES.find(u => u.id === id);
  if (!item || s.upgrades.includes(id) || s.energy < item.cost || s.runEarned < item.requiresRunEarned) return false;
  s.energy -= item.cost; s.upgrades.push(id); return true;
}
export function tick(s, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  seconds = Math.min(seconds, OFFLINE_CAP);
  const boosted = Math.min(seconds, s.boostsRemaining);
  const earned = earn(s, clamp(baseRate(s) * (seconds + boosted)));
  s.boostsRemaining = Math.max(0, s.boostsRemaining - seconds);
  s.stabilityCooldown = Math.max(0, s.stabilityCooldown - seconds);
  s.memoryCooldown = Math.max(0, s.memoryCooldown - seconds);
  s.routingCooldown = Math.max(0, s.routingCooldown - seconds);
  checkProgress(s);
  return earned;
}
export function prestigeGain(s) { return Math.floor(Math.sqrt(s.runEarned / 25000)); }
export function prestige(s) {
  const gain = prestigeGain(s);
  if (!gain) return 0;
  const next = newGame(s.lastSaved);
  next.stars = Math.min(MAX_VALUE, s.stars + gain);
  for (const key of ['spentStars', 'constellations', 'completedChallenges', 'achievements', 'wins', 'completed', 'memoryCooldown', 'routingCooldown', 'stabilityCooldown']) next[key] = Array.isArray(s[key]) ? [...s[key]] : s[key];
  if (next.constellations.includes('seed')) next.producers[0] = 3;
  next.totalEarned = s.totalEarned;
  next.settings = { ...s.settings };
  Object.assign(s, next);
  return gain;
}
/** Accuracy is 0..1: at least 0.75 earns 15 seconds of double automatic output. */
export function stabilize(s, accuracy) {
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1 || s.stabilityCooldown > 0) return false;
  s.stabilityCooldown = 30;
  if (accuracy < 0.75) return false;
  s.boostsRemaining = 15;
  if (!s.wins.includes('timing')) s.wins.push('timing');
  return true;
}
const validNumber = (n, max = MAX_VALUE) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function validate(raw) {
  if (!isRecord(raw) || ![1, VERSION].includes(raw.version)) throw new Error('Unsupported save version.');
  for (const field of ['energy', 'totalEarned', 'runEarned', 'stars']) {
    if (!validNumber(raw[field])) throw new Error(`Invalid ${field} in save.`);
  }
  if (raw.energy > raw.runEarned || raw.runEarned > raw.totalEarned || !Number.isInteger(raw.stars)) throw new Error('Inconsistent save totals.');
  if (!Array.isArray(raw.producers) || raw.producers.length !== (raw.version === 1 ? 4 : PRODUCERS.length) || !raw.producers.every(n => validNumber(n, 2000) && Number.isInteger(n))) throw new Error('Invalid producers in save.');
  if (!Array.isArray(raw.upgrades) || raw.upgrades.length > UPGRADES.length || new Set(raw.upgrades).size !== raw.upgrades.length || !raw.upgrades.every(id => UPGRADES.some(u => u.id === id) && (raw.version !== 1 || !['lattice', 'beacon'].includes(id)))) throw new Error('Invalid research in save.');
  if (!validNumber(raw.boostsRemaining, 15) || !validNumber(raw.stabilityCooldown, 30) || !validNumber(raw.lastSaved, 8640000000000000)) throw new Error('Invalid save timing.');
  if (!isRecord(raw.settings) || typeof raw.settings.sound !== 'boolean' || typeof raw.settings.reducedMotion !== 'boolean') throw new Error('Invalid settings in save.');
  const extra = newGame(raw.lastSaved);
  if (raw.version === VERSION) {
    if (!validNumber(raw.spentStars) || !Number.isInteger(raw.spentStars) || raw.spentStars > raw.stars || typeof raw.completed !== 'boolean' || !['', ...CHALLENGES.map(c => c.id)].includes(raw.challenge)) throw new Error('Invalid campaign progress.');
    if (raw.challenge === 'compact' && raw.producers.some(n => n > 5)) throw new Error('Invalid compact contract fleet.');
    for (const [key, allowed] of [['constellations', CONSTELLATIONS.map(x => x.id)], ['completedChallenges', CHALLENGES.map(x => x.id)], ['achievements', ACHIEVEMENTS.map(x => x.id)], ['wins', ['timing', 'memory', 'routing']]]) {
      if (!Array.isArray(raw[key]) || new Set(raw[key]).size !== raw[key].length || !raw[key].every(id => allowed.includes(id))) throw new Error('Invalid ' + key + '.');
      extra[key] = [...raw[key]];
    }
    if (raw.spentStars !== CONSTELLATIONS.filter(x => raw.constellations.includes(x.id)).reduce((sum, x) => sum + x.cost, 0)) throw new Error('Inconsistent constellation spending.');
    for (const key of ['memoryCooldown', 'routingCooldown']) { if (!validNumber(raw[key], 90)) throw new Error('Invalid side-game cooldown.'); extra[key] = raw[key]; }
    for (const key of ['spentStars', 'challenge', 'completed']) extra[key] = raw[key];
  }
  // Explicit reconstruction means unknown keys can never modify prototypes or state.
  return { ...extra, version: VERSION, energy: raw.energy, totalEarned: raw.totalEarned, runEarned: raw.runEarned, producers: raw.version === 1 ? [...raw.producers, 0, 0, 0] : [...raw.producers], upgrades: [...raw.upgrades], stars: raw.stars, boostsRemaining: raw.boostsRemaining, stabilityCooldown: raw.stabilityCooldown, lastSaved: raw.lastSaved, settings: { sound: raw.settings.sound, reducedMotion: raw.settings.reducedMotion } };
}
export function serialize(s, now = Date.now()) {
  if (!validNumber(now, 8640000000000000)) throw new Error('Invalid save timestamp.');
  return JSON.stringify(validate({ ...s, lastSaved: now }));
}
export function parseSave(text, now = Date.now(), { offline = true } = {}) {
  if (typeof text !== 'string' || text.length > 20000) throw new Error('Save must be a JSON text file under 20 KB.');
  if (!validNumber(now, 8640000000000000)) throw new Error('Invalid current timestamp.');
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('This is not a valid JSON save.'); }
  const state = validate(raw);
  const offlineSeconds = offline ? Math.min(OFFLINE_CAP, Math.max(0, (now - state.lastSaved) / 1000)) : 0;
  const offlineEarned = tick(state, offlineSeconds);
  state.lastSaved = now;
  return { state, offlineEarned, offlineSeconds };
}

export function chapter(s) {
  return CHAPTERS.findIndex(c => s.runEarned < c.target || !s.producers[c.producer] || !s.upgrades.includes(c.research));
}
export function checkProgress(s) {
  const tests = [s.producers.some(Boolean), s.totalEarned >= 1000000, s.stars > 0, s.upgrades.length === UPGRADES.length, s.wins.length === 3, s.completed];
  ACHIEVEMENTS.forEach((a, i) => { if (tests[i] && !s.achievements.includes(a.id)) s.achievements.push(a.id); });
  const c = CHALLENGES.find(c => c.id === s.challenge);
  if (c && s.runEarned >= c.target) {
    if (!s.completedChallenges.includes(c.id)) s.completedChallenges.push(c.id);
    s.challenge = '';
  }
}
export function buyConstellation(s, id) {
  const item = CONSTELLATIONS.find(c => c.id === id);
  if (!item || s.constellations.includes(id) || s.stars - s.spentStars < item.cost) return false;
  s.spentStars += item.cost; s.constellations.push(id); return true;
}
export function startChallenge(s, id) {
  if (!CHALLENGES.some(c => c.id === id) || s.stars < 1 || s.challenge) return false;
  const next = newGame(s.lastSaved);
  for (const key of ['stars', 'spentStars', 'constellations', 'completedChallenges', 'achievements', 'wins', 'completed', 'totalEarned', 'settings', 'memoryCooldown', 'routingCooldown', 'stabilityCooldown']) next[key] = structuredClone(s[key]);
  next.challenge = id;
  if (id === 'quiet' || s.constellations.includes('seed')) next.producers[0] = s.constellations.includes('seed') ? 3 : 1;
  Object.assign(s, next); return true;
}
export function abandonChallenge(s) { if (!s.challenge) return false; s.challenge = ''; return true; }
export function launchBeacon(s) {
  if (s.completed || chapter(s) !== -1 || s.energy < 5000000) return false;
  s.energy -= 5000000; s.completed = true; checkProgress(s); return true;
}
/** Side games grant at most 30 seconds of base production (minimum 20 J), once per 90s. */
export function sideReward(s, game, success) {
  if (!['memory', 'routing'].includes(game) || typeof success !== 'boolean' || s[game + 'Cooldown'] > 0) return false;
  s[game + 'Cooldown'] = 90;
  if (!success) return false;
  if (!s.wins.includes(game)) s.wins.push(game);
  earn(s, Math.max(20, baseRate(s) * 30)); checkProgress(s); return true;
}
export function routingSolved(cells) {
  if (!Array.isArray(cells) || cells.length !== 9 || !cells.every(n => Number.isInteger(n) && n >= 0 && n < 6)) return false;
  // Six conduit shapes: horizontal, vertical, NE, ES, SW, WN.
  const seen = new Set(); let at = 0, incoming = 3;
  while (!seen.has(at)) {
    seen.add(at); const ports = [[1, 3], [0, 2], [0, 1], [1, 2], [2, 3], [3, 0]][cells[at]];
    if (!ports.includes(incoming)) return false;
    const out = ports.find(x => x !== incoming);
    if (at === 8 && out === 1) return true;
    const row = Math.floor(at / 3), col = at % 3;
    if ((out === 0 && row === 0) || (out === 1 && col === 2) || (out === 2 && row === 2) || (out === 3 && col === 0)) return false;
    at += [-3, 1, 3, -1][out]; incoming = (out + 2) % 4;
  }
  return false;
}
