'use strict';
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const { readFile, realpath, stat } = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
let window, root = null, child = null, cancelRequested = false;
let state = { phase: 'idle', message: 'Choose a Spark Foundry source folder to begin.', exitCode: null, root: null, busy: false };
const page = pathToFileURL(path.join(__dirname, 'builder.html')).href;
function emit(patch) { state = { ...state, ...patch }; if (window && !window.isDestroyed()) window.webContents.send('builder:state', state); }
function log(chunk) { if (window && !window.isDestroyed()) window.webContents.send('builder:log', String(chunk).slice(0, 16000)); }
function trusted(event) { if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== page) throw new Error('Untrusted caller.'); }
async function validate(folder) {
  const resolved = await realpath(folder);
  const manifest = JSON.parse(await readFile(path.join(resolved, 'package.json'), 'utf8'));
  if (manifest.name !== 'spark-foundry') throw new Error('Select the Spark Foundry source folder containing package.json.');
  for (const file of ['build.bat', 'build-installer.bat', 'desktop/main.cjs']) {
    const target = await realpath(path.join(resolved, file));
    if (!target.startsWith(resolved + path.sep) || !(await stat(target)).isFile()) throw new Error(`Missing or unsafe entrypoint: ${file}`);
  }
  return resolved;
}
function run(command, args, phase) {
  return new Promise((resolve, reject) => {
    if (cancelRequested) return resolve(130);
    emit({ phase, message: phase === 'building' ? 'Building game assets and preparing dependencies…' : phase === 'packaging' ? 'Building the unsigned Squirrel.Windows installer…' : 'Game running. Close its window to finish.', exitCode: null });
    const active = spawn(command, args, { cwd: root, windowsHide: true, shell: false, env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } });
    child = active;
    active.stdout.on('data', log); active.stderr.on('data', log);
    active.on('error', error => { if (child === active) child = null; reject(error); });
    active.on('close', (code, signal) => { if (child === active) child = null; log(`\nProcess completed: ${code === null ? signal : code}\n`); resolve(cancelRequested ? 130 : (code ?? 1)); });
  });
}
async function cancel() {
  cancelRequested = true;
  if (!child?.pid) return;
  emit({ phase: 'cancelling', message: 'Stopping this operation and its child processes…' });
  const pid = child.pid;
  await new Promise((resolve, reject) => {
    const killer = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/pid', String(pid), '/t', '/f'], { windowsHide: true });
    killer.once('error', reject); killer.once('exit', code => code === 0 ? resolve() : reject(new Error(`Cancellation failed (exit ${code}). The operation may still be running.`)));
  });
}
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const assets = new Set(['builder.html', 'builder.js', 'builder.css'].map(file => pathToFileURL(path.join(__dirname, file)).href));
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !assets.has(details.url) }));
  window = new BrowserWindow({ width: 960, height: 760, minWidth: 600, minHeight: 500, backgroundColor: '#101728', title: 'Spark Foundry Build Studio', webPreferences: { preload: path.join(__dirname, 'builder-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== page) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.on('close', event => { if (state.busy) { event.preventDefault(); emit({ message: 'Cancel the active operation before closing Build Studio.' }); } });
  ipcMain.handle('builder:state', event => { trusted(event); return state; });
  ipcMain.handle('builder:choose', async event => {
    trusted(event); if (state.busy) throw new Error('Wait for or cancel the active operation.');
    const result = await dialog.showOpenDialog(window, { title: 'Choose trusted Spark Foundry source', properties: ['openDirectory'] });
    if (result.canceled) return state;
    root = await validate(result.filePaths[0]);
    emit({ root, phase: 'ready', exitCode: null, message: 'Source selected. Build scripts execute code from this folder; use only a checkout you trust.' }); return state;
  });
  ipcMain.handle('builder:run', async (event, action) => {
    trusted(event);
    if (!['build', 'run', 'installer'].includes(action)) throw new Error('Unsupported action.');
    if (state.busy) throw new Error('An operation is already running.');
    if (process.platform !== 'win32') throw new Error('Build Studio supports Windows only.');
    if (!root) throw new Error('Choose a trusted source folder first.');
    cancelRequested = false; emit({ busy: true });
    try {
      root = await validate(root);
      let code = await run(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe'), ['/d', '/s', '/c', action === 'installer' ? 'build-installer.bat /s' : 'build.bat /s'], action === 'installer' ? 'packaging' : 'building');
      if (code === 0 && action === 'run' && !cancelRequested) {
        const executable = path.join(root, '.tools', 'node', 'node.exe');
        if (!(await stat(executable)).isFile()) throw new Error('Verified project-local Node is missing after the build. Dependency preparation is incomplete.');
        code = await run(executable, [path.join(root, 'scripts', 'run-built.mjs')], 'running');
      }
      emit({ busy: false, phase: code === 130 ? 'cancelled' : code === 0 ? 'complete' : 'failed', exitCode: code, message: code === 130 ? 'Cancelled. Outputs may be incomplete. You can retry.' : code === 0 ? 'Operation completed successfully.' : 'Operation failed. Review the output, correct the issue, then retry.' });
    } catch (error) { emit({ busy: false, phase: 'failed', exitCode: 1, message: error.message }); }
    return state;
  });
  ipcMain.handle('builder:cancel', async event => { trusted(event); await cancel(); return state; });
  window.loadFile(path.join(__dirname, 'builder.html'));
});
app.on('window-all-closed', () => app.quit());
