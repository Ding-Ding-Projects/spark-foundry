import { createSaveOwner } from './save-owner.js?v=03c24a5c8f7e';
import { newGame, CONSTELLATIONS, CHALLENGES, CHAPTERS, ACHIEVEMENTS, buyConstellation, startChallenge, abandonChallenge, launchBeacon, chapter, checkProgress, sideReward, routingSolved, producerUnlocked, PRODUCERS, UPGRADES, rate, tapPower, tap, cost, buyProducer, buyUpgrade, tick, prestigeGain, prestige, stabilize, serialize, parseSave } from './engine.js?v=67ac8b92323e';

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
function loadCurrentSave() {
  state = newGame(); savingBlocked = false; welcomeMessage = '';
  const now = Date.now();
  lastTick = now;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      firstVisit = false;
      const loaded = parseSave(raw, now);
      state = loaded.state;
      if (loaded.offlineEarned >= 1) welcomeMessage = `Welcome back. Your foundry made ${number(loaded.offlineEarned)} J while you were away.`;
    }
  } catch (error) {
    savingBlocked = true;
    firstVisit = false;
    welcomeMessage = 'Local save unavailable or invalid. It has not been overwritten. Import a backup or erase progress in settings to enable saving.';
  }
  applySettings(); render();
  if (welcomeMessage) notify(welcomeMessage);
}
function save() {
  if (!ownership.canSave) return false;
  if (savingBlocked) { $('save-status').textContent = 'Saving unavailable'; return false; }
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
    $('save-status').textContent = 'Saved on this device';
    return true;
  } catch {
    $('save-status').textContent = 'Save unavailable · export a backup';
    return false;
  }
}
function settle() {
  if (!ownership.canPlay) return;
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
  if (!ownership.canPlay) return;
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

const symbols = ['⌁', '⟐', '♨', '◎', '✿', '⧖', '✺'];
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
  checkProgress(state);
  renderCampaign();
  $('energy').textContent = number(state.energy);
  $('rate').textContent = number(rate(state));
  $('stars').textContent = number(state.stars);
  $('star-bonus').textContent = `Permanent +${number(state.stars * 25)}% power`;
  $('tap-power').textContent = `+${number(tapPower(state))} J / pulse`;
  const level = chapter(state) < 0 ? 6 : chapter(state) + 1;
  $('level').textContent = String(level).padStart(2, '0');
  $('level-label').textContent = state.completed ? 'The expanse is alight' : CHAPTERS[level - 1].name;
  $('core-status').textContent = state.boostsRemaining > 0 ? 'RESONANCE ACTIVE' : state.producers.some(Boolean) ? 'FOUNDRY ONLINE' : 'MANUAL IGNITION';
  PRODUCERS.forEach((p, i) => {
    $(`owned-${i}`).textContent = number(state.producers[i]);
    const price = cost(state, i);
    $(`cost-${i}`).textContent = producerUnlocked(state, i) ? `${number(price)} J` : `At ${number(p.unlock)} J earned`;
    $(`output-${i}`).textContent = !producerUnlocked(state, i) ? 'Keep expanding to unlock this machine.' : `+${number(p.rate)} J / sec base`;
    $(`buy-${i}`).disabled = !producerUnlocked(state, i) || (state.challenge === 'compact' && state.producers[i] >= 5) || state.energy < price || !Number.isFinite(price);
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
  const index = chapter(state), goal = CHAPTERS[index < 0 ? 5 : index];
  $('goal-title').textContent = state.completed ? 'The beacon is lit. Your sky is limitless.' : goal.name;
  $('goal-count').textContent = `${number(Math.min(state.runEarned, goal.target))} / ${number(goal.target)} J earned`;
  $('goal-progress').max = goal.target; $('goal-progress').value = Math.min(state.runEarned, goal.target);
  $('goal-progress').setAttribute('aria-label', goal.name);
  $('goal-description').textContent = state.completed ? 'Campaign complete. Keep building in endless mode, try contracts, or go supernova to explore your constellation.' : `${goal.story} ${!state.producers[goal.producer] ? 'Machine still needed. ' : ''}${!state.upgrades.includes(goal.research) ? 'Research still needed.' : ''}`;
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
  if (!ownership.canPlay) return;
  stopHolding();
  $('confirm-title').textContent = title; $('confirm-description').textContent = description;
  $('confirm-action').textContent = label;
  $('confirm-action').onclick = () => { $('confirm-dialog').close(); if (ownership.canPlay) action(); };
  $('confirm-dialog').showModal(); $('confirm-cancel').focus();
}
$('confirm-cancel').addEventListener('click', () => $('confirm-dialog').close());
$('prestige').addEventListener('click', () => {
  const gain = prestigeGain(state);
  if (!gain) return;
  confirmAction('A brighter beginning?', `Gain ${number(gain)} star essence. Each star permanently adds 25% power. Stored energy, machines, research, and this run's progress will reset. Existing stars, constellation abilities, achievements, completed contracts and settings remain. Any active contract ends.`, 'Go supernova', () => {
    settle(); const earned = prestige(state); cancelSideGames(); tuning = false; $('timing-track').classList.remove('active');
    notify(`A new beginning. +${number(earned)} star essence. Your light grows stronger.`); sound(880); render(); save();
  });
});
$('reset').addEventListener('click', () => confirmAction('Erase your universe?', 'This cannot be undone. All machines, research, energy, and permanent star essence will be erased. Export a backup first if you might want to return.', 'Erase everything', () => {
  state = newGame(); cancelSideGames(); lastTick = Date.now(); savingBlocked = false; tuning = false;
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
      state = imported.state; cancelSideGames(); lastTick = Date.now(); savingBlocked = false; tuning = false;
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

// Side activities use session-local boards; rewards and cooldowns are persistent.
let memorySequence = [], memoryInput = [], memoryPhase = 'idle';
const pipeGlyphs = ['━', '┃', '┗', '┏', '┓', '┛'];
const pipeNames = ['east–west', 'north–south', 'north–east', 'east–south', 'south–west', 'west–north'];
let pipes = [3, 1, 5, 0, 2, 0, 4, 5, 3];
function cancelSideGames() { memorySequence = []; memoryInput = []; memoryPhase = 'idle'; $('memory-status').textContent = 'Ready to receive a signal.'; }
for (let i = 1; i <= 4; i++) {
  const button = document.createElement('button'); button.className = 'secondary'; button.textContent = String(i); button.setAttribute('aria-label', `Signal ${i}`);
  button.addEventListener('click', () => {
    if (memoryPhase !== 'repeat') return;
    memoryInput.push(i);
    if (memoryInput.at(-1) !== memorySequence[memoryInput.length - 1]) {
      settle(); sideReward(state, 'memory', false); memoryPhase = 'idle'; $('memory-status').textContent = 'Signal lost. No energy lost. Try a fresh sequence after cooldown.'; save();
    } else if (memoryInput.length === memorySequence.length) {
      settle(); sideReward(state, 'memory', true); memoryPhase = 'idle'; $('memory-status').textContent = 'Relay restored! Production reward delivered.'; notify('Echo relay solved. Bonus energy received.'); save();
    } else $('memory-status').textContent = `${memoryInput.length} of 4 signals received. Keep going.`;
    render();
  });
  $('memory-pads').append(button);
}
$('memory-start').addEventListener('click', () => {
  settle(); if (state.memoryCooldown > 0) return;
  if (memoryPhase === 'show') { memoryPhase = 'repeat'; $('memory-status').textContent = 'Repeat the four signals using the numbered buttons.'; }
  else if (memoryPhase === 'idle') { memorySequence = Array.from({length: 4}, () => 1 + Math.floor(Math.random() * 4)); memoryInput = []; memoryPhase = 'show'; $('memory-status').textContent = `Incoming sequence: ${memorySequence.join(' · ')}. Take your time.`; }
  render();
});
function renderPipes() {
  [...$('routing-grid').children].forEach((button, i) => { button.textContent = pipeGlyphs[pipes[i]]; button.setAttribute('aria-label', `Row ${Math.floor(i / 3) + 1}, column ${i % 3 + 1}: ${pipeNames[pipes[i]]}. Activate to change conduit.`); });
}
for (let i = 0; i < 9; i++) {
  const button = document.createElement('button'); button.className = 'pipe-button';
  button.addEventListener('click', () => { if (state.routingCooldown > 0) return; pipes[i] = (pipes[i] + 1) % 6; renderPipes(); });
  $('routing-grid').append(button);
}
renderPipes();
$('routing-check').addEventListener('click', () => {
  settle(); if (state.routingCooldown > 0) return;
  if (!routingSolved(pipes)) { $('routing-status').textContent = 'The pulse stops before OUT. Keep adjusting; test pulses are free.'; return; }
  sideReward(state, 'routing', true); $('routing-status').textContent = 'Lightway connected! Production reward delivered. A new board awaits after cooldown.';
  pipes = Array.from({length: 9}, () => Math.floor(Math.random() * 6)); renderPipes(); save(); render();
});
for (const c of CONSTELLATIONS) {
  const row = document.createElement('article'); row.className = 'upgrade'; row.innerHTML = `<div><h3>${c.name}</h3><p>${c.description}</p></div><button class="secondary" id="constellation-${c.id}"></button>`;
  $('constellations').append(row);
  $(`constellation-${c.id}`).addEventListener('click', () => { settle(); if (buyConstellation(state, c.id)) { notify(`${c.name} joins your constellation.`); save(); render(); } });
}
for (const c of CHALLENGES) {
  const row = document.createElement('article'); row.className = 'upgrade'; row.innerHTML = `<div><h3>${c.name}</h3><p>${c.description}</p></div><button class="secondary" id="challenge-${c.id}">Start contract</button>`;
  $('challenges').append(row);
  $(`challenge-${c.id}`).addEventListener('click', () => confirmAction(`Begin ${c.name}?`, 'This resets current energy, machines and research without granting stars. Your permanent progress is safe. You can leave the contract at any time and keep the new run.', 'Begin contract', () => { settle(); if (startChallenge(state, c.id)) { cancelSideGames(); tuning = false; $('timing-track').classList.remove('active'); notify('Contract underway. Your objective is in the expedition panel.'); save(); render(); } }));
}
$('abandon-challenge').addEventListener('click', () => { abandonChallenge(state); notify('Contract left. Your machines and energy remain.'); save(); render(); });
$('launch-beacon').addEventListener('click', () => { settle(); if (launchBeacon(state)) { notify('The expanse answers. Every outpost has a way home. Campaign complete!'); sound(880); save(); render(); } });
for (const c of CHAPTERS) { const li = document.createElement('li'); li.textContent = c.name; $('chapter-list').append(li); }
for (const a of ACHIEVEMENTS) { const div = document.createElement('div'); div.id = `achievement-${a.id}`; div.innerHTML = `<strong>${a.name}</strong><small>${a.description}</small>`; $('achievements').append(div); }
function renderCampaign() {
  const current = chapter(state);
  [...$('chapter-list').children].forEach((li, i) => { const c = CHAPTERS[i]; const done = state.runEarned >= c.target && state.producers[c.producer] > 0 && state.upgrades.includes(c.research); li.textContent = `${done ? '✓' : '○'} ${c.name}`; li.classList.toggle('done', done); });
  $('campaign-story').textContent = state.completed ? 'Your beacon bridges the darkness. Ships return, windows glow, and the quiet expanse is quiet no longer.' : `Chapter ${current < 0 ? 6 : current + 1} of 6 · ${CHAPTERS[current < 0 ? 5 : current].story}`;
  $('launch-beacon').disabled = state.completed || current !== -1 || state.energy < 5000000;
  $('launch-beacon').textContent = state.completed ? '✓ Campaign complete · endless mode active' : 'Launch beacon · 5M J';
  $('ending-status').textContent = state.completed ? 'Thank you, starmaker. Your foundry keeps running. Optional contracts, constellation discoveries and endless growth remain yours.' : 'Complete all chapter objectives, then spend 5M stored J. No minigames or prestige required.';
  $('essence-balance').textContent = `${number(state.stars - state.spentStars)} unspent essence · ${number(state.stars)} lifetime stars. Spending never reduces your permanent power.`;
  for (const c of CONSTELLATIONS) { const done = state.constellations.includes(c.id), button = $(`constellation-${c.id}`); button.disabled = done || state.stars - state.spentStars < c.cost; button.textContent = done ? '✓ Permanent' : `${c.cost} essence`; }
  const active = CHALLENGES.find(c => c.id === state.challenge);
  $('challenge-status').textContent = active ? `${active.name}: ${number(state.runEarned)} / ${number(active.target)} J earned. Completion is automatic.` : state.stars ? 'Choose a different way to build. Rewards are awarded once and never stack.' : 'Go supernova once to unlock contracts.';
  $('abandon-challenge').hidden = !active;
  for (const c of CHALLENGES) { const done = state.completedChallenges.includes(c.id); const button = $(`challenge-${c.id}`); button.disabled = !!active || !state.stars || done; button.textContent = done ? '✓ Reward earned' : 'Start contract'; }
  for (const a of ACHIEVEMENTS) { const node = $(`achievement-${a.id}`); node.classList.toggle('done', state.achievements.includes(a.id)); node.setAttribute('aria-label', `${a.name}: ${state.achievements.includes(a.id) ? 'earned' : 'not yet earned'}. ${a.description}`); }
  $('memory-start').disabled = state.memoryCooldown > 0 || memoryPhase === 'repeat';
  $('memory-start').textContent = state.memoryCooldown > 0 ? `Relay cooling · ${Math.ceil(state.memoryCooldown)}s` : memoryPhase === 'show' ? 'Hide sequence · ready to repeat' : memoryPhase === 'repeat' ? 'Repeat using the buttons above' : 'Receive sequence';
  for (const button of $('memory-pads').children) button.disabled = memoryPhase !== 'repeat';
  $('routing-check').disabled = state.routingCooldown > 0;
  $('routing-check').textContent = state.routingCooldown > 0 ? `Lightway cooling · ${Math.ceil(state.routingCooldown)}s` : 'Send a test pulse';
  for (const button of $('routing-grid').children) button.disabled = state.routingCooldown > 0;
}
// Keep inactive tabs truly paused, including keyboard/AT events and pending dialogs.
const sessionNotice = document.createElement('section');
sessionNotice.className = 'session-notice';
sessionNotice.setAttribute('aria-label', 'Game session');
const sessionMessage = document.createElement('p');
sessionMessage.setAttribute('role', 'status');
const sessionButton = document.createElement('button');
sessionButton.className = 'secondary';
sessionNotice.append(sessionMessage, sessionButton);
document.querySelector('main').before(sessionNotice);
let sessionMode = 'waiting';
function sessionStatus(mode) {
  sessionMode = mode;
  const playing = ownership.canPlay;
  document.querySelector('main').inert = !playing;
  $('settings-button').disabled = !playing;
  sessionNotice.hidden = mode === 'active';
  const messages = {
    waiting: 'Paused while another tab plays. Close that tab, or request play here. Your latest save will load before play resumes.',
    paused: 'Paused to protect your save. Choose Play in this tab to load the latest progress and resume. If another tab is playing, it must save and pause first.',
    unsupported: 'Safe shared saving is unavailable in this browser. You can play a temporary session and export a backup; it will not change your local save.',
    temporary: 'Temporary session — automatic saving is off. Export a backup in settings before leaving. Your existing local save is untouched.',
    'save-failed': 'Could not save for transfer. This tab is still playing. Export a backup in settings or fix local saving before trying again.',
    unavailable: 'The game could not load. Reload this page to try again.',
  };
  sessionMessage.textContent = messages[mode] || '';
  sessionButton.hidden = ['active', 'temporary', 'save-failed', 'unavailable'].includes(mode);
  sessionButton.textContent = mode === 'unsupported' ? 'Play without automatic saving' : 'Play in this tab';
  if (!playing) $('save-status').textContent = 'Paused · no changes saved';
  if (mode === 'active') $('save-status').textContent = savingBlocked ? 'Saving unavailable' : 'Local save ready';
  if (mode === 'temporary') $('save-status').textContent = 'Temporary · export a backup';
}
let saveChannel;
try { saveChannel = new BroadcastChannel('spark-foundry-save-owner'); } catch { /* Closing the owning tab still releases its Web Lock. */ }
const ownership = createSaveOwner({
  locks: navigator.locks,
  channel: saveChannel,
  load: loadCurrentSave,
  flush: () => { settle(); return save(); },
  pause: () => {
    stopHolding(); cancelSideGames(); tuning = false;
    $('timing-track').classList.remove('active');
    for (const id of ['settings-dialog', 'confirm-dialog']) $(id).close();
  },
  status: sessionStatus,
});
sessionButton.addEventListener('click', () => {
  if (sessionMode === 'unsupported') ownership.playTemporary();
  else ownership.requestPlay();
});
for (const type of ['click', 'pointerdown', 'keydown', 'change']) document.addEventListener(type, event => {
  if (!ownership.canPlay && (event.target.closest('main, #settings-dialog, #confirm-dialog') || event.target === $('settings-button'))) {
    event.preventDefault(); event.stopImmediatePropagation();
  }
}, true);
setInterval(() => { if (ownership.canPlay) { settle(); render(); } }, 100);
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => {
  settle(); stopHolding();
  if (document.hidden) { tuning = false; $('timing-track').classList.remove('active'); save(); }
  render();
});
window.addEventListener('pagehide', () => ownership.leave());
window.addEventListener('pageshow', () => ownership.acquire());
applySettings(); render(); requestAnimationFrame(animate);
// First-run setup is owned by the shared preferences module.
ownership.acquire();

window.addEventListener('beforeunload', event => {
  if (ownership.canPlay && !ownership.canSave) { event.preventDefault(); event.returnValue = ''; }
});
window.desktop?.onBeforeClose(() => {
  settle(); stopHolding();
  if (ownership.canPlay && !ownership.canSave) return window.confirm('This temporary session has not been saved. Export a backup from settings before closing if you want to keep it. Close without saving?');
  return !ownership.canSave || save();
});
