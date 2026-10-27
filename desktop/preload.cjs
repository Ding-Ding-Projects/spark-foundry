const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
 onBeforeClose: (callback) => { ipcRenderer.removeAllListeners('prepare-close'); ipcRenderer.on('prepare-close', async (_event, request) => { try { ipcRenderer.send('close-ready',request, (await callback()) !== false); } catch { ipcRenderer.send('close-ready',request,false); } }); ipcRenderer.send('close-handler-ready'); },
 checkForUpdates: () => ipcRenderer.invoke('updates-check'),
 restartToUpdate: () => ipcRenderer.invoke('updates-restart'),
 onUpdate: (callback) => { ipcRenderer.on('update-state', (_event, state) => callback(state)); }
});
window.addEventListener('DOMContentLoaded', () => {
 const bar=document.createElement('aside'); bar.setAttribute('role','status'); bar.setAttribute('aria-label','Desktop updates');
 bar.style.cssText='position:fixed;bottom:8px;left:8px;right:8px;z-index:9999;padding:8px 12px;border:1px solid #547587;border-radius:8px;background:#102631;color:#fff;font:13px system-ui;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
 const message=document.createElement('span'); message.textContent='Desktop edition · local saves';
 const check=document.createElement('button'); check.textContent='Check for updates'; check.onclick=()=>ipcRenderer.invoke('updates-check');
 const restart=document.createElement('button'); restart.textContent='Restart to install update'; restart.hidden=true; restart.onclick=()=>ipcRenderer.invoke('updates-restart');
 const later=document.createElement('button'); later.textContent='Later'; later.hidden=true; later.onclick=()=>{restart.hidden=true;later.hidden=true;message.textContent+=' · Restart when ready from the Application menu.';};
 bar.append(message,check,restart,later); document.body.append(bar);
 ipcRenderer.on('update-state',(_event,state)=>{message.textContent=state.message;check.disabled=['checking','downloading'].includes(state.phase);restart.hidden=state.phase!=='ready';later.hidden=restart.hidden;});
 ipcRenderer.send('update-state-request');
});
