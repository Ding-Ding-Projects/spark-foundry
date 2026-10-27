// A Web Lock, not a localStorage lease, is the authority to write a save.
// Without Web Locks we fail closed: an explicit temporary session cannot write.
export function createSaveOwner({ locks, channel, load, flush, pause, status }) {
  let owned = false, temporary = false, suspended = false, pending = false;
  let waitingForPlay = false, releaseLock, abort;
  const report = mode => status(mode);
  const broadcast = message => { try { channel?.postMessage(message); } catch { /* Closing the owner still releases its lock. */ } };
  function release() {
    if (!owned) return true;
    const wasSuspended = suspended;
    suspended = false;
    let saved = false;
    try { saved = flush(); } catch { /* Keep the writer and its unsaved state. */ }
    if (!saved) { suspended = wasSuspended; report('save-failed'); return false; }
    owned = false;
    pause();
    releaseLock?.();
    releaseLock = undefined;
    report('paused');
    return true;
  }
  function acquire(wait = false) {
    suspended = false;
    if (owned) { report('active'); return; }
    if (temporary) { report('temporary'); return; }
    if (pending) return;
    if (!locks?.request) { report('unsupported'); return; }
    pending = true;
    waitingForPlay = wait;
    const controller = new AbortController();
    abort = controller;
    report('waiting');
    // No steal/expiry: a suspended owner must flush or close before transfer.
    Promise.resolve().then(() => locks.request('spark-foundry-v1-writer', { signal: controller.signal, ifAvailable: !wait }, async lock => {
      if (abort !== controller || controller.signal.aborted) return;
      pending = false;
      waitingForPlay = false;
      if (!lock) { report('paused'); return; }
      owned = true;
      const held = new Promise(resolve => { releaseLock = resolve; });
      try { load(); report('active'); broadcast('playing'); }
      catch {
        owned = false;
        pause();
        releaseLock();
        releaseLock = undefined;
        report('unavailable');
      }
      await held;
    })).catch(() => {
      if (abort !== controller || controller.signal.aborted) return;
      pending = false;
      waitingForPlay = false;
      report('unsupported');
    });
  }
  if (channel) channel.onmessage = event => {
    if (event.data === 'request-play' && owned) release();
    // Several requests may arrive before the next queued owner acquires its
    // lock. Ask that new owner too, but never auto-promote a preview tab.
    if (event.data === 'playing' && pending && waitingForPlay) broadcast('request-play');
  };
  return {
    get canPlay() { return (owned || temporary) && !suspended; },
    get canSave() { return owned && !suspended; },
    acquire,
    requestPlay() {
      if (owned || temporary) return;
      // A click during the initial availability probe upgrades it to a queued
      // request rather than silently losing the user's intent.
      if (pending && !waitingForPlay) { abort.abort(); pending = false; }
      acquire(true);
      // Enqueue the request before asking the old owner to release.
      queueMicrotask(() => { if (pending && waitingForPlay) broadcast('request-play'); });
    },
    playTemporary() {
      if (owned || pending || temporary) return;
      try { load(); temporary = true; suspended = false; report('temporary'); }
      catch { pause(); report('unavailable'); }
    },
    leave() {
      if (pending) { abort.abort(); pending = false; waitingForPlay = false; report('paused'); }
      const released = release();
      // Also stop held inputs and session-local games when a temporary page is
      // cached, or when a failed flush requires retaining the writer lock.
      if (temporary || !released) { pause(); suspended = true; }
      return released;
    },
  };
}
