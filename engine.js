/** Deterministic game rules. All actions mutate only the supplied state. */
export const VERSION = 1;
export const MAX_VALUE = 1e100;
export const OFFLINE_CAP = 4 * 60 * 60;
export const PRODUCERS = Object.freeze([
  { id: 'collector', name: 'Spark collector', description: 'Catch the first light.', cost: 12, rate: 1 },
  { id: 'dynamo', name: 'Ion dynamo', description: 'Turn charged particles into possibility.', cost: 120, rate: 9 },
  { id: 'forge', name: 'Plasma forge', description: 'A little star, working for you.', cost: 1200, rate: 70 },
  { id: 'array', name: 'Orbital array', description: 'Harvest the light between worlds.', cost: 12000, rate: 550 },
]);
export const UPGRADES = Object.freeze([
  { id: 'gloves', name: 'Conductive gloves', description: 'Double sparks per tap.', cost: 35, requiresRunEarned: 0, effect: 'tap' },
  { id: 'coils', name: 'Superconducting coils', description: 'Double all automatic production.', cost: 200, requiresRunEarned: 100, effect: 'production' },
  { id: 'resonance', name: 'Resonant touch', description: 'Taps also collect 10% of one second of production.', cost: 700, requiresRunEarned: 500, effect: 'resonance' },
  { id: 'plasma', name: 'Plasma compression', description: 'Double all automatic production again.', cost: 3000, requiresRunEarned: 2000, effect: 'production' },
  { id: 'quantum', name: 'Quantum fingertips', description: 'Multiply base sparks per tap by five.', cost: 8000, requiresRunEarned: 5000, effect: 'tap' },
]);
const clamp = n => Math.min(MAX_VALUE, Math.max(0, n));
export function newGame(now = Date.now()) {
  return { version: VERSION, energy: 0, totalEarned: 0, runEarned: 0, producers: [0, 0, 0, 0], upgrades: [], stars: 0, boostsRemaining: 0, stabilityCooldown: 0, lastSaved: now, settings: { sound: false, reducedMotion: false } };
}
function baseRate(s) {
  let result = PRODUCERS.reduce((sum, p, i) => sum + p.rate * s.producers[i], 0) * (1 + s.stars * 0.25);
  if (s.upgrades.includes('coils')) result *= 2;
  if (s.upgrades.includes('plasma')) result *= 2;
  return clamp(result);
}
export function rate(s) { return clamp(baseRate(s) * (s.boostsRemaining > 0 ? 2 : 1)); }
export function tapPower(s) {
  let result = (1 + s.stars * 0.25) * (s.upgrades.includes('gloves') ? 2 : 1) * (s.upgrades.includes('quantum') ? 5 : 1);
  if (s.upgrades.includes('resonance')) result += rate(s) * 0.1;
  return clamp(result);
}
function earn(s, amount) {
  const earned = Math.min(clamp(amount), MAX_VALUE - s.energy, MAX_VALUE - s.runEarned, MAX_VALUE - s.totalEarned);
  s.energy += earned; s.runEarned += earned; s.totalEarned += earned;
  return earned;
}
export function tap(s) { return earn(s, tapPower(s)); }
export function cost(s, index) {
  if (!Number.isInteger(index) || !PRODUCERS[index]) return Infinity;
  const value = Math.ceil(PRODUCERS[index].cost * 1.16 ** s.producers[index]);
  return value > MAX_VALUE || s.producers[index] >= 2000 ? Infinity : value;
}
export function buyProducer(s, index) {
  const price = cost(s, index);
  if (s.energy < price || !Number.isFinite(price)) return false;
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
  return earned;
}
export function prestigeGain(s) { return Math.floor(Math.sqrt(s.runEarned / 25000)); }
export function prestige(s) {
  const gain = prestigeGain(s);
  if (!gain) return 0;
  const next = newGame(s.lastSaved);
  next.stars = Math.min(MAX_VALUE, s.stars + gain);
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
  return true;
}
const validNumber = (n, max = MAX_VALUE) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function validate(raw) {
  if (!isRecord(raw) || raw.version !== VERSION) throw new Error('Unsupported save version.');
  for (const field of ['energy', 'totalEarned', 'runEarned', 'stars']) {
    if (!validNumber(raw[field])) throw new Error(`Invalid ${field} in save.`);
  }
  if (raw.energy > raw.runEarned || raw.runEarned > raw.totalEarned || !Number.isInteger(raw.stars)) throw new Error('Inconsistent save totals.');
  if (!Array.isArray(raw.producers) || raw.producers.length !== 4 || !raw.producers.every(n => validNumber(n, 2000) && Number.isInteger(n))) throw new Error('Invalid producers in save.');
  if (!Array.isArray(raw.upgrades) || raw.upgrades.length > UPGRADES.length || new Set(raw.upgrades).size !== raw.upgrades.length || !raw.upgrades.every(id => UPGRADES.some(u => u.id === id))) throw new Error('Invalid research in save.');
  if (!validNumber(raw.boostsRemaining, 15) || !validNumber(raw.stabilityCooldown, 30) || !validNumber(raw.lastSaved, 8640000000000000)) throw new Error('Invalid save timing.');
  if (!isRecord(raw.settings) || typeof raw.settings.sound !== 'boolean' || typeof raw.settings.reducedMotion !== 'boolean') throw new Error('Invalid settings in save.');
  // Explicit reconstruction means unknown keys can never modify prototypes or state.
  return { version: VERSION, energy: raw.energy, totalEarned: raw.totalEarned, runEarned: raw.runEarned, producers: [...raw.producers], upgrades: [...raw.upgrades], stars: raw.stars, boostsRemaining: raw.boostsRemaining, stabilityCooldown: raw.stabilityCooldown, lastSaved: raw.lastSaved, settings: { sound: raw.settings.sound, reducedMotion: raw.settings.reducedMotion } };
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
