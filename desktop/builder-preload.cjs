'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('buildStudio', Object.freeze({
  state: () => ipcRenderer.invoke('builder:state'),
  choose: () => ipcRenderer.invoke('builder:choose'),
  run: action => ipcRenderer.invoke('builder:run', action),
  cancel: () => ipcRenderer.invoke('builder:cancel'),
  onState: callback => { const handler = (_event, value) => callback(value); ipcRenderer.on('builder:state', handler); return () => ipcRenderer.removeListener('builder:state', handler); },
  onLog: callback => { const handler = (_event, value) => callback(value); ipcRenderer.on('builder:log', handler); return () => ipcRenderer.removeListener('builder:log', handler); }
}));
