import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveOwner } from './save-owner.js';
import { newGame, serialize, parseSave, tick, buyProducer } from './engine.js';
const turn = () => new Promise(resolve => setImmediate(resolve));
function lockManager() {
  let busy = false;
  const queue = [];
  function run() {
    if (busy || !queue.length) return;
    const job = queue.shift();
    if (job.signal?.aborted) { job.reject(new DOMException('Aborted', 'AbortError')); run(); return; }
    busy = true;
    Promise.resolve(job.fn({ name: 'writer' })).then(job.resolve, job.reject).finally(() => { busy = false; run(); });
  }
  return { request(_name, options, fn) {
    if (options.signal && (options.ifAvailable || options.steal)) return Promise.reject(new DOMException('Invalid Web Locks option combination', 'NotSupportedError'));
    if (options.signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    if (busy && options.ifAvailable) return Promise.resolve(fn(null));
    return new Promise((resolve, reject) => { queue.push({fn, resolve, reject, signal: options.signal}); run(); });
  }};
}
function setup(deferred = false) {
  const locks = lockManager(), channels = [], log = [];
  let disk = 0;
  const tab = () => {
    const channel = { postMessage(data) { for (const other of channels) if (other !== channel) {
      const deliver = () => other.onmessage?.({ data });
      if (deferred) queueMicrotask(deliver); else deliver();
    } } };
    channels.push(channel);
    const t = { value: 0, failed: false, modes: [] };
    t.owner = createSaveOwner({ locks, channel,
      load() { t.value = disk; log.push('load'); },
      flush() { log.push('flush'); if (t.failed) return false; disk = t.value; return true; },
      pause() { log.push('pause'); }, status(mode) { t.modes.push(mode); },
    });
    return t;
  };
  return { tab, log, disk: () => disk };
}
test('simultaneous tabs have one writer; takeover flushes before loading, even with third preview', async () => {
  const h = setup(), a = h.tab(), b = h.tab(), preview = h.tab();
  for (const t of [a,b,preview]) t.owner.acquire();
  await turn();
  assert.equal(a.owner.canSave, true); assert.equal(b.owner.canPlay, false); assert.equal(preview.owner.canPlay, false);
  a.value = 42;
  b.owner.requestPlay(); await turn();
  assert.equal(a.owner.canSave, false); assert.equal(b.owner.canSave, true); assert.equal(preview.owner.canSave, false);
  assert.equal(b.value, 42); assert.deepEqual(h.log.slice(-3), ['flush','pause','load']);
  b.value = 77; a.owner.requestPlay(); await turn();
  assert.equal(a.value, 77); assert.equal(b.owner.canPlay, false);
  a.owner.leave(); await turn();
});
test('failed flush refuses transfer and preserves active owner until a successful retry', async () => {
  const h = setup(), a = h.tab(), b = h.tab();
  a.owner.acquire(); await turn(); a.value = 12; a.failed = true;
  b.owner.requestPlay(); await turn();
  assert.equal(a.owner.canSave, true); assert.equal(b.owner.canPlay, false); assert.equal(h.disk(), 0);
  assert.equal(a.modes.at(-1), 'save-failed');
  a.failed = false; b.owner.requestPlay(); await turn();
  assert.equal(b.value, 12); assert.equal(a.owner.canPlay, false);
  b.owner.leave(); await turn();
});
test('missing or rejected locks require explicit temporary mode and never grant save authority', async () => {
  for (const locks of [undefined, {request() { throw new Error('unavailable'); }}]) {
    let loaded = 0, flushed = 0, mode;
    const owner = createSaveOwner({ locks, load() { loaded++; }, flush() { flushed++; return true; }, pause() {}, status(m) { mode = m; } });
    owner.acquire(); await turn(); assert.equal(mode, 'unsupported'); assert.equal(loaded, 0);
    owner.playTemporary(); assert.equal(owner.canPlay, true); assert.equal(owner.canSave, false);
    owner.leave(); assert.equal(flushed, 0);
  }
});
test('leave while acquiring aborts cleanly and a restored page can acquire again', async () => {
  const h = setup(), a = h.tab();
  a.owner.acquire(); a.owner.leave(); a.owner.acquire(); await turn();
  assert.equal(a.owner.canSave, true); a.owner.leave(); await turn();
});
test('a real save transfer preserves purchases and awards each elapsed second only once', async () => {
  const locks = lockManager(); let now = 1000, disk = serialize(newGame(now), now);
  const make = () => { let state, last;
    const t = createSaveOwner({ locks,
      load() { state = parseSave(disk, now).state; last = now; },
      flush() { tick(state, (now-last)/1000); last = now; disk = serialize(state, now); return true; },
      pause() {}, status() {},
    }); return {t, state: () => state};
  };
  const a = make(), b = make(); a.t.acquire(); await turn();
  a.state().energy = a.state().totalEarned = a.state().runEarned = 12;
  assert.equal(buyProducer(a.state(), 0), true);
  now += 10000; a.t.leave(); await turn();
  now += 2000; b.t.acquire(); await turn();
  assert.equal(b.state().producers[0], 1); assert.equal(b.state().energy, 12);
  b.t.leave(); await turn(); assert.equal(parseSave(disk, now).state.energy, 12);
});

test('all simultaneous takeover requests progress without promoting preview tabs', async () => {
  const h = setup(), a = h.tab(), b = h.tab(), c = h.tab(), preview = h.tab();
  a.owner.acquire(); await turn(); preview.owner.acquire(); await turn();
  a.value = 99;
  b.owner.requestPlay(); c.owner.requestPlay(); await turn(); await turn();
  assert.equal(b.modes.includes('active'), true);
  assert.equal(c.owner.canSave, true);
  assert.equal(c.value, 99);
  assert.equal(a.owner.canPlay, false);
  assert.equal(b.owner.canPlay, false);
  assert.equal(preview.owner.canPlay, false);
  c.owner.leave(); await turn();
});

test('canceling a queued takeover cannot later load or write, and does not block the queue', async () => {
  const h = setup(), a = h.tab(), b = h.tab(), c = h.tab();
  a.owner.acquire(); await turn(); a.failed = true;
  b.owner.requestPlay(); await turn(); b.owner.leave();
  a.failed = false; c.owner.requestPlay(); await turn();
  assert.equal(b.owner.canPlay, false);
  assert.equal(b.modes.includes('active'), false);
  assert.equal(c.owner.canSave, true);
  c.owner.leave(); await turn();
});

test('throwing loads release the lock without granting play or overwriting saved data', async () => {
  const locks = lockManager(); let mode, writes = 0, pauses = 0;
  const bad = createSaveOwner({ locks, load() { throw Error('bad data'); }, flush() { writes++; return true; }, pause() { pauses++; }, status(m) { mode = m; } });
  bad.acquire(); await turn();
  assert.equal(mode, 'unavailable'); assert.equal(bad.canPlay, false); assert.equal(bad.canSave, false);
  bad.playTemporary(); assert.equal(mode, 'unavailable'); assert.equal(bad.canPlay, false);
  assert.equal(writes, 0); assert.equal(pauses, 2);
  const good = createSaveOwner({ locks, load() {}, flush() { return true; }, pause() {}, status() {} });
  good.acquire(); await turn(); assert.equal(good.canSave, true); good.leave(); await turn();
});

test('pagehide pauses temporary play; pageshow resumes it without reloading or saving', () => {
  let loads = 0, pauses = 0, writes = 0;
  const owner = createSaveOwner({ load() { loads++; }, flush() { writes++; return true; }, pause() { pauses++; }, status() {} });
  owner.playTemporary(); owner.leave();
  assert.equal(owner.canPlay, false); assert.equal(owner.canSave, false); assert.equal(pauses, 1);
  owner.acquire(); assert.equal(owner.canPlay, true); assert.equal(loads, 1); assert.equal(writes, 0);
});

test('throwing flush retains state and lock; pagehide stops play and pageshow can recover', async () => {
  const locks = lockManager(); let fails = true, mode, pauses = 0, loads = 0;
  const owner = createSaveOwner({ locks, load() { loads++; }, flush() { if (fails) throw Error('storage denied'); return true; }, pause() { pauses++; }, status(m) { mode = m; } });
  owner.acquire(); await turn();
  assert.equal(owner.leave(), false); assert.equal(mode, 'save-failed');
  assert.equal(owner.canPlay, false); assert.equal(owner.canSave, false); assert.equal(pauses, 1);
  owner.acquire(); assert.equal(owner.canPlay, true); assert.equal(loads, 1);
  fails = false; assert.equal(owner.leave(), true); await turn(); assert.equal(owner.canSave, false);
});

test('a broken broadcast channel still permits acquisition and safe release', async () => {
  const owner = createSaveOwner({ locks: lockManager(), channel: { postMessage() { throw Error('closed'); } }, load() {}, flush() { return true; }, pause() {}, status() {} });
  owner.requestPlay(); await turn(); assert.equal(owner.canSave, true);
  owner.requestPlay(); assert.equal(owner.canSave, true);
  owner.leave(); await turn();
});

test('asynchronous broadcast delivery drains multiple requests and reloads the last save', async () => {
  const h = setup(true), a = h.tab(), b = h.tab(), c = h.tab();
  a.owner.acquire(); await turn(); a.value = 123;
  b.owner.requestPlay(); c.owner.requestPlay(); await turn(); await turn();
  assert.equal(b.modes.includes('active'), true); assert.equal(c.owner.canSave, true);
  assert.equal(c.value, 123); assert.equal(a.owner.canPlay, false); assert.equal(b.owner.canPlay, false);
  c.owner.leave(); await turn();
});

test('request during the initial lock probe is queued instead of dropped', async () => {
  const h = setup(), a = h.tab(), b = h.tab();
  a.owner.acquire(); await turn(); a.value = 7;
  b.owner.acquire(); b.owner.requestPlay(); await turn();
  assert.equal(b.owner.canSave, true); assert.equal(b.value, 7);
  b.owner.leave(); await turn();
});

test('without BroadcastChannel takeover waits for the owner to leave, never steals', async () => {
  const locks = lockManager(); let loads = 0;
  const make = () => createSaveOwner({ locks, load() { loads++; }, flush() { return true; }, pause() {}, status() {} });
  const a = make(), b = make(); a.acquire(); await turn(); b.requestPlay(); await turn();
  assert.equal(a.canSave, true); assert.equal(b.canPlay, false); assert.equal(loads, 1);
  a.leave(); await turn(); assert.equal(b.canSave, true); assert.equal(loads, 2); b.leave(); await turn();
});
