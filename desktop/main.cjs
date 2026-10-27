const { app, BrowserWindow, protocol, session, Menu, ipcMain, autoUpdater, dialog, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
if (require('electron-squirrel-startup')) app.quit();
const guide = require('../package.json').sparkMode === 'guide' || process.argv.includes('--guide');
const files = new Set(['index.html','app.js','engine.js','save-owner.js','style.css','docs.html','docs.js','preview.html','preferences.js','preferences-copy.js','preferences.css','regex-workbench.js','regex-worker.js','regex-workbench.css','regex-capabilities.md']);
protocol.registerSchemesAsPrivileged([{scheme:'spark',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
let window, closeAllowed=false, closeHandler=false, closeRequest, updateReady=false, updateBusy=false;
let state={phase:'current',message:`Spark Foundry ${app.getVersion()} · unsigned desktop edition`};
function sendState(phase,message){state={phase,message};if(window&&!window.isDestroyed())window.webContents.send('update-state',state);}
function trusted(event){return window && event.sender===window.webContents && event.senderFrame===window.webContents.mainFrame;}
async function prepareClose(restart=false){
 if(closeRequest)return;
 if(guide || window.webContents.getURL().startsWith('spark://app/docs.html')){closeAllowed=true;restart?autoUpdater.quitAndInstall():window.close();return;}
 if(!closeHandler){await dialog.showMessageBox(window,{type:'warning',message:'The game has not confirmed that progress can be saved. Keep this window open and export a save before quitting.'});return;}
 const id=crypto.randomUUID();closeRequest={id,restart};window.webContents.send('prepare-close',id);
 setTimeout(()=>{if(closeRequest?.id===id){closeRequest=null;sendState('failed','Save confirmation timed out. The game remains open.');}},10000);
}
ipcMain.on('close-handler-ready',event=>{if(trusted(event))closeHandler=true;});
ipcMain.on('close-ready',(event,id,ok)=>{if(!trusted(event)||closeRequest?.id!==id)return;const restart=closeRequest.restart;closeRequest=null;if(ok!==true){sendState('failed','Progress could not be saved. Export a backup before closing.');return;}closeAllowed=true;session.defaultSession.flushStorageData();restart?autoUpdater.quitAndInstall():window.close();});
ipcMain.on('update-state-request',event=>{if(trusted(event))event.sender.send('update-state',state);});
async function checkUpdates(){
 if(guide||!app.isPackaged||process.platform!=='win32'){sendState('current','Automatic updates require the installed Windows game. This companion/development copy does not install updates.');return;}
 if(updateBusy||updateReady)return;updateBusy=true;sendState('checking','Checking unsigned update feed…');
 try{autoUpdater.checkForUpdates();}catch(error){updateBusy=false;sendState('failed',`Update check failed: ${error.message}`);}
}
ipcMain.handle('updates-check',event=>{if(trusted(event))return checkUpdates();});
ipcMain.handle('updates-restart',event=>{if(trusted(event)&&updateReady)return prepareClose(true);});
app.whenReady().then(async()=>{
 protocol.handle('spark',async request=>{
  const url=new URL(request.url);const file=decodeURIComponent(url.pathname.slice(1))||'index.html';
  if(url.hostname!=='app'||!files.has(file))return new Response('Not found',{status:404});
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.md':'text/markdown; charset=utf-8'};
  try{return new Response(await fs.readFile(path.join(__dirname,'../dist',file)),{headers:{'Content-Type':types[path.extname(file)]||'text/plain','Content-Security-Policy':"default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"}});}catch{return new Response('Build assets missing. Run build.bat.',{status:500});}
 });
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 session.defaultSession.setPermissionCheckHandler(()=>false);
 session.defaultSession.on('will-download',(event,item)=>{if(!item.getURL().startsWith('blob:spark://app/')){event.preventDefault();return;}item.setSaveDialogOptions({title:'Export Spark Foundry save',defaultPath:'spark-foundry-save.json',filters:[{name:'Game save',extensions:['json']}]});});
 window=new BrowserWindow({width:1320,height:900,minWidth:360,minHeight:600,backgroundColor:'#08131d',title:guide?'Spark Foundry Guide':'Spark Foundry',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{try{const target=new URL(url);if(target.protocol!=='spark:'||target.hostname!=='app'||!(files.has(target.pathname.slice(1))||target.pathname==='/'))event.preventDefault();}catch{event.preventDefault();}});
 window.webContents.on('will-attach-webview',event=>event.preventDefault());
 window.on('close',event=>{if(!closeAllowed){event.preventDefault();void prepareClose();}});
 window.webContents.on('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame)closeHandler=false;});
 Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Application',submenu:[{label:'Game',click:()=>window.loadURL('spark://app/index.html')},{label:'Field guide',click:()=>window.loadURL('spark://app/docs.html')},{label:'Check for updates',click:checkUpdates},{label:'Restart to install update',click:()=>updateReady&&prepareClose(true)},{label:'Release notes',click:()=>shell.openExternal('https://github.com/Ding-Ding-Projects/spark-foundry/releases')},{type:'separator'},{label:'Quit',click:()=>prepareClose()}]},{label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}]));
 await window.loadURL(`spark://app/${guide?'docs.html':'index.html'}`);
 if(!guide&&app.isPackaged&&process.platform==='win32'){
  autoUpdater.setFeedURL({url:require('../build-manifest.json').updateFeed});
  autoUpdater.on('update-available',()=>sendState('downloading','Downloading unsigned update; Squirrel checks package integrity. Continue playing.'));
  autoUpdater.on('update-not-available',()=>{updateBusy=false;sendState('current',`Spark Foundry ${app.getVersion()} is current · unsigned update channel`);});
  autoUpdater.on('error',error=>{updateBusy=false;sendState('failed',`Update failed: ${error.message}. Try Check for updates again.`);});
  autoUpdater.on('update-downloaded',(_event,_notes,name)=>{updateBusy=false;updateReady=true;sendState('ready',`Version ${name||'from latest release'} is ready · unsigned; Windows may warn about the publisher. See Application → Release notes.`);});
  setTimeout(checkUpdates,15000);setInterval(checkUpdates,4*60*60*1000).unref();
 }
});
app.on('window-all-closed',()=>app.quit());
