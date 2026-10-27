import { newGame, PRODUCERS, UPGRADES, rate, tapPower, tap, cost, buyProducer, buyUpgrade, tick, prestigeGain, prestige, stabilize, serialize, parseSave } from './engine.js?v=189fca3ebfc5';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'spark-foundry-v1';
let state = newGame();
let lastTick = Date.now();
let savingBlocked = false;
let toastTimer;
let holding = null;
let lastPulse = 0;
let tuning = false;
let tuneStart = 0;
let tunePosition = 0;
let audioContext;
let firstVisit = true;
let welcomeMessage = '';
const number = n => {
  if (!Number.isFinite(n)) return 'MAX';
  if (n < 1000) return new Intl.NumberFormat('en', { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);
  if (n >= 1e15) return n.toExponential(2);
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
};
function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 5500);
}
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    firstVisit = false;
    const loaded = parseSave(raw);
    state = loaded.state;
    if (loaded.offlineEarned >= 1) welcomeMessage = `Welcome back. Your foundry made ${number(loaded.offlineEarned)} J while you were away.`;
  }
} catch (error) {
  savingBlocked = true;
  firstVisit = false;
  welcomeMessage = 'Local save unavailable or invalid. It has not been overwritten. Import a backup or erase progress in settings to enable saving.';
}
function save() {
  if (savingBlocked) { $('save-status').textContent = 'Saving unavailable'; return; }
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
    $('save-status').textContent = 'Saved on this device';
  } catch {
    $('save-status').textContent = 'Save unavailable · export a backup';
  }
}
function settle() {
  const now = Date.now();
  tick(state, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
}
function sound(frequency = 440) {
  if (!state.settings.sound) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .13);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + .14);
  } catch { /* Sound is optional; gameplay remains available without Web Audio. */ }
}
function pulse() {
  settle();
  const earned = tap(state);
  sound(320 + Math.random() * 80);
  $('burst').textContent = `+${number(earned)} J`;
  $('burst').classList.remove('show');
  void $('burst').offsetWidth;
  $('burst').classList.add('show');
  render();
}
function stopHolding() { holding = null; $('ignite').classList.remove('pulsing'); }
$('ignite').addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  event.preventDefault();
  $('ignite').focus();
  $('ignite').setPointerCapture(event.pointerId);
  holding = 'pointer'; lastPulse = performance.now();
  $('ignite').classList.add('pulsing'); pulse();
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('ignite').addEventListener(event, stopHolding);
$('ignite').addEventListener('keydown', event => {
  if (![' ', 'Enter'].includes(event.key)) return;
  event.preventDefault();
  if (event.repeat || holding) return;
  holding = 'keyboard'; lastPulse = performance.now();
  $('ignite').classList.add('pulsing'); pulse();
});
$('ignite').addEventListener('keyup', event => {
  if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); stopHolding(); }
});
// Assistive technology can activate a button with a click without pointer events.
$('ignite').addEventListener('click', event => { if (event.detail === 0 && !holding) pulse(); });
$('ignite').addEventListener('blur', stopHolding);
window.addEventListener('blur', stopHolding);

const symbols = ['⌁', '⟐', '♨', '◎'];
for (const [index, producer] of PRODUCERS.entries()) {
  const row = document.createElement('article'); row.className = 'producer';
  row.innerHTML = `<div class="machine-icon" aria-hidden="true">${symbols[index]}</div><div><h3>${producer.name} <span id="owned-${index}">0</span></h3><p>${producer.description}</p><small id="output-${index}">+${number(producer.rate)} J / sec base</small></div><button class="buy-button" id="buy-${index}"><span id="cost-${index}">${producer.cost} J</span><small>BUILD +1</small></button>`;
  $('producers').append(row);
  $(`buy-${index}`).addEventListener('click', () => {
    settle();
    if (buyProducer(state, index)) {
      sound(520); render(); save();
      if (state.producers[index] === 1) notify(`${producer.name} online. Your foundry is growing.`);
    }
  });
}
for (const upgrade of UPGRADES) {
  const row = document.createElement('article'); row.className = 'upgrade'; row.id = `upgrade-${upgrade.id}`;
  row.innerHTML = `<span class="upgrade-icon" aria-hidden="true">✧</span><div><h3>${upgrade.name}</h3><p id="description-${upgrade.id}"></p></div><button id="research-${upgrade.id}" class="secondary"></button>`;
  $('upgrades').append(row);
  $(`research-${upgrade.id}`).addEventListener('click', () => {
    settle();
    if (buyUpgrade(state, upgrade.id)) { sound(660); notify(`${upgrade.name} researched.`); render(); save(); }
  });
}
function render() {
  $('energy').textContent = number(state.energy);
  $('rate').textContent = number(rate(state));
  $('stars').textContent = number(state.stars);
  $('star-bonus').textContent = `Permanent +${number(state.stars * 25)}% power`;
  $('tap-power').textContent = `+${number(tapPower(state))} J / pulse`;
  const level = state.runEarned < 12 ? 1 : state.runEarned < 100 ? 2 : state.runEarned < 1200 ? 3 : state.runEarned < 25000 ? 4 : 5;
  $('level').textContent = String(level).padStart(2, '0');
  $('level-label').textContent = ['First light', 'Awakening', 'Gathering power', 'Stellar industry', 'Supernova ready'][level - 1];
  $('core-status').textContent = state.boostsRemaining > 0 ? 'RESONANCE ACTIVE' : state.producers.some(Boolean) ? 'FOUNDRY ONLINE' : 'MANUAL IGNITION';
  PRODUCERS.forEach((p, i) => {
    $(`owned-${i}`).textContent = number(state.producers[i]);
    const price = cost(state, i);
    $(`cost-${i}`).textContent = `${number(price)} J`;
    $(`buy-${i}`).disabled = state.energy < price || !Number.isFinite(price);
    $(`buy-${i}`).setAttribute('aria-label', `Build ${p.name} for ${number(price)} joules. ${state.producers[i]} owned.`);
  });
  for (const u of UPGRADES) {
    const done = state.upgrades.includes(u.id), locked = state.runEarned < u.requiresRunEarned;
    $(`upgrade-${u.id}`).classList.toggle('done', done);
    $(`description-${u.id}`).textContent = locked ? `Unlock at ${number(u.requiresRunEarned)} J earned this run. ${u.description}` : u.description;
    const button = $(`research-${u.id}`);
    button.textContent = done ? '✓ Applied' : locked ? 'Locked' : `${number(u.cost)} J`;
    button.disabled = done || locked || state.energy < u.cost;
    button.setAttribute('aria-label', done ? `${u.name} applied` : `Research ${u.name} for ${number(u.cost)} joules`);
  }
  $('research-count').textContent = `${state.upgrades.length} / ${UPGRADES.length} DISCOVERED`;
  const gain = prestigeGain(state);
  $('prestige').disabled = gain === 0;
  $('prestige').textContent = gain ? `Go supernova · gain ${number(gain)} star${gain === 1 ? '' : 's'} ↗` : 'Requires 25,000 J earned this run';
  $('boost-label').textContent = state.boostsRemaining > 0 ? `×2 · ${Math.ceil(state.boostsRemaining)}s` : '×2 BOOST';
  $('stabilize').disabled = !tuning && state.stabilityCooldown > 0;
  $('stabilize').textContent = tuning ? 'Lock resonance now!' : state.stabilityCooldown > 0 ? `Reactor cooling · ${Math.ceil(state.stabilityCooldown)}s` : 'Tune reactor →';
  renderGoal();
}
function renderGoal() {
  let title, target, value, description;
  if (!state.producers[0]) {
    title = 'Build your first Spark collector'; target = cost(state, 0); value = state.energy;
    description = 'Earn 12 J, then build a collector. It produces energy automatically.';
  } else if (!state.upgrades.includes('gloves')) {
    title = 'Research Conductive gloves'; target = 35; value = state.energy;
    description = 'Double the energy from each pulse. Your first breakthrough awaits below.';
  } else if (!state.producers[1]) {
    title = 'Bring an Ion dynamo online'; target = cost(state, 1); value = state.energy;
    description = 'Expand beyond collectors. Your first dynamo generates 9 J per second before bonuses.';
  } else {
    const nextStars = prestigeGain(state) + 1;
    target = nextStars * nextStars * 25000; value = state.runEarned;
    title = nextStars === 1 ? 'Prepare your first supernova' : `Reach a ${number(nextStars)}-star supernova`;
    description = prestigeGain(state) ? 'Reset now for star essence, or keep building to earn a larger reward.' : 'Earn 25,000 J over this run to unlock a fresh start with permanent power.';
  }
  $('goal-title').textContent = title;
  $('goal-count').textContent = `${number(value)} / ${number(target)} J`;
  $('goal-progress').max = target; $('goal-progress').value = Math.min(value, target);
  $('goal-progress').setAttribute('aria-label', title);
  $('goal-description').textContent = description;
}
function applySettings() {
  $('sound-setting').checked = state.settings.sound;
  $('motion-setting').checked = state.settings.reducedMotion;
  document.documentElement.classList.toggle('reduced-motion', state.settings.reducedMotion);
}
$('settings-button').addEventListener('click', () => { stopHolding(); applySettings(); $('settings-dialog').showModal(); });
$('sound-setting').addEventListener('change', event => { state.settings.sound = event.target.checked; sound(); save(); });
$('motion-setting').addEventListener('change', event => { state.settings.reducedMotion = event.target.checked; applySettings(); save(); });
function confirmAction(title, description, label, action) {
  stopHolding();
  $('confirm-title').textContent = title; $('confirm-description').textContent = description;
  $('confirm-action').textContent = label;
  $('confirm-action').onclick = () => { $('confirm-dialog').close(); action(); };
  $('confirm-dialog').showModal(); $('confirm-cancel').focus();
}
$('confirm-cancel').addEventListener('click', () => $('confirm-dialog').close());
$('prestige').addEventListener('click', () => {
  const gain = prestigeGain(state);
  if (!gain) return;
  confirmAction('A brighter beginning?', `Gain ${number(gain)} star essence. Each star permanently adds 25% power. Stored energy, machines, research, and this run's progress will reset. Existing stars and settings remain.`, 'Go supernova', () => {
    settle(); const earned = prestige(state); tuning = false; $('timing-track').classList.remove('active');
    notify(`A new beginning. +${number(earned)} star essence. Your light grows stronger.`); sound(880); render(); save();
  });
});
$('reset').addEventListener('click', () => confirmAction('Erase your universe?', 'This cannot be undone. All machines, research, energy, and permanent star essence will be erased. Export a backup first if you might want to return.', 'Erase everything', () => {
  state = newGame(); lastTick = Date.now(); savingBlocked = false; tuning = false;
  $('timing-track').classList.remove('active'); applySettings(); render(); save();
  $('settings-dialog').close(); notify('A clean slate. Your next spark is waiting.');
}));
$('export').addEventListener('click', () => {
  settle();
  const blob = new Blob([serialize(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `spark-foundry-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Save exported. Keep the file somewhere safe.');
});
$('import').addEventListener('click', () => { $('import-file').value = ''; $('import-file').click(); });
$('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 20000) throw new Error('Save file is too large. Maximum size is 20 KB.');
    const text = await file.text();
    const preview = parseSave(text, Date.now(), { offline: false }).state;
    confirmAction('Replace this universe?', `Import ${number(preview.energy)} J of stored energy and ${number(preview.stars)} stars? This replaces current progress. Export your current save first if you want a backup.`, 'Replace with import', () => {
      const imported = parseSave(text);
      state = imported.state; lastTick = Date.now(); savingBlocked = false; tuning = false;
      $('timing-track').classList.remove('active'); applySettings(); render(); save();
      $('settings-dialog').close(); notify('Save imported. Welcome to your foundry.');
    });
  } catch (error) { notify(`Import rejected: ${error.message}`); }
});
function reducedMotion() { return state.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches; }
function positionAt(now) {
  const duration = reducedMotion() ? 4000 : 2100;
  return (Math.sin((now - tuneStart) / duration * Math.PI * 2 - Math.PI / 2) + 1) / 2;
}
$('stabilize').addEventListener('click', () => {
  settle();
  if (!tuning) {
    if (state.stabilityCooldown > 0) return;
    tuning = true; tuneStart = performance.now(); tunePosition = 0;
    $('timing-track').classList.add('active');
    $('stability-description').textContent = 'Press again when the white marker enters the mint zone.';
  } else {
    tunePosition = positionAt(performance.now()); tuning = false;
    const success = stabilize(state, Math.max(0, 1 - Math.abs(tunePosition - .5) * 2));
    $('timing-track').classList.remove('active');
    $('stability-description').textContent = success ? 'Perfect resonance. Automatic output doubled for 15 seconds.' : 'Not quite aligned. Try again after the reactor cools.';
    notify(success ? 'Resonance locked! ×2 automatic output for 15 seconds.' : 'Signal missed. No energy lost. Try again in 30 seconds.');
    if (success) sound(740); save();
  }
  render();
});
function animate(now) {
  if (holding && now - lastPulse >= 200) { pulse(); lastPulse = now; }
  if (tuning) {
    tunePosition = positionAt(now);
    $('timing-needle').style.left = `calc(${tunePosition * 100}% - ${tunePosition * 3}px)`;
  }
  requestAnimationFrame(animate);
}
setInterval(() => { settle(); render(); }, 100);
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => {
  settle(); stopHolding();
  if (document.hidden) { tuning = false; $('timing-track').classList.remove('active'); save(); }
  render();
});
window.addEventListener('pagehide', () => { settle(); save(); });
applySettings(); render(); requestAnimationFrame(animate);
if (firstVisit) $('welcome-dialog').showModal();
if (welcomeMessage) notify(welcomeMessage);
if (savingBlocked) $('save-status').textContent = 'Saving unavailable';
