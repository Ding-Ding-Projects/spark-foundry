'use strict';
const $ = id => document.getElementById(id);
let output = '';
function render(state) {
  $('source').textContent = state.root || 'No source folder selected.';
  $('status').textContent = state.message;
  $('status').dataset.phase = state.phase;
  $('choose').disabled = state.busy;
  for (const action of ['build', 'run', 'installer']) $(action).disabled = state.busy || !state.root;
  $('cancel').disabled = !state.busy || state.phase === 'cancelling';
  if (state.busy) $('progress').removeAttribute('value'); else $('progress').value = state.phase === 'complete' ? 1 : 0;
  $('exit').textContent = state.exitCode === null ? `Phase: ${state.phase}` : `Phase: ${state.phase} · Exit status: ${state.exitCode}`;
}
async function perform(fn) { try { render(await fn()); } catch (error) { $('status').textContent = error.message; } }
$('choose').addEventListener('click', () => perform(() => window.buildStudio.choose()));
for (const action of ['build', 'run', 'installer']) $(action).addEventListener('click', () => { output = ''; $('output').textContent = ''; perform(() => window.buildStudio.run(action)); });
$('cancel').addEventListener('click', () => perform(() => window.buildStudio.cancel()));
window.buildStudio.onState(render);
window.buildStudio.onLog(chunk => { output = (output + chunk).slice(-180000); $('output').textContent = output; $('output').scrollTop = $('output').scrollHeight; });
perform(() => window.buildStudio.state());
