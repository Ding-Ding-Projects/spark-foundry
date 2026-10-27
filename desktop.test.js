import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const read=file=>fs.readFileSync(file,'utf8');
test('Windows delivery uses genuine Squirrel and portable companion targets only',()=>{
 const configPath=require.resolve('./desktop/package-config.cjs');
 for(const mode of ['game','builder','guide']) {process.env.SPARK_PACKAGE_MODE=mode;delete require.cache[configPath];const config=require(configPath);assert.deepEqual(config.win.target,mode==='game'?['squirrel']:['portable']);assert.equal(config.win.signAndEditExecutable,false);assert.equal(config.publish,null);assert.ok(config.files.includes('dist/**'));assert.equal(config.extraMetadata.main,mode==='builder'?'desktop/builder-main.cjs':'desktop/main.cjs');}
 delete process.env.SPARK_PACKAGE_MODE;
});
test('Desktop bridge exposes no arbitrary filesystem or shell API',()=>{
 const preload=read('desktop/preload.cjs');assert.match(preload,/onBeforeClose/);assert.match(preload,/await callback/);assert.doesNotMatch(preload,/require\(['"](?:node:)?(?:fs|child_process)/);
 const main=read('desktop/main.cjs');assert.match(main,/contextIsolation:true/);assert.match(main,/nodeIntegration:false/);assert.match(main,/sandbox:true/);assert.match(main,/event\.senderFrame===window\.webContents\.mainFrame/);assert.match(main,/closeRequest\?\.id!==id/);assert.match(main,/ok!==true/);assert.match(main,/action:'deny'/);
});
test('Build and installer entrypoints do real work without running local tests in release build',()=>{
 const p=JSON.parse(read('package.json'));assert.equal(p.scripts.build,'node scripts/build.mjs');assert.match(read('build.bat'),/download-dependencies\.bat/);assert.match(read('build-installer.bat'),/npm run package:windows/);assert.match(read('scripts/package-windows.mjs'),/process.platform !== 'win32'/);
});

test('Desktop close handshake rejects foreign senders, stale tokens and failed saves',async()=>{
 const {EventEmitter}=await import('node:events');const vm=await import('node:vm');
 const ipc=new EventEmitter();ipc.handle=()=>{};const sessions=new EventEmitter();sessions.setPermissionRequestHandler=()=>{};sessions.setPermissionCheckHandler=()=>{};sessions.flushStorageData=()=>{};
 let win,protocolHandler;const scheduled=[];
 class Window extends EventEmitter {constructor(){super();win=this;this.webContents=new EventEmitter();this.webContents.mainFrame={};this.webContents.setWindowOpenHandler=()=>{};this.webContents.getURL=()=> 'spark://app/index.html';this.sent=[];this.webContents.send=(...args)=>this.sent.push(args);this.closed=0;}isDestroyed(){return false;}loadURL(){return Promise.resolve();}close(){this.closed++;}}
 const app=new EventEmitter();app.whenReady=()=>Promise.resolve();app.getVersion=()=> '1.0.0';app.quit=()=>{};app.isPackaged=false;
 const electron={app,BrowserWindow:Window,protocol:{registerSchemesAsPrivileged(){},handle(_name,handler){protocolHandler=handler;}},session:{defaultSession:sessions},Menu:{buildFromTemplate:x=>x,setApplicationMenu(){}},ipcMain:ipc,autoUpdater:{},dialog:{showMessageBox:async()=>{}},shell:{openExternal(){}}};
 const context={require:name=>name==='electron'?electron:name==='electron-squirrel-startup'?false:name==='../package.json'?{}:require(name),__dirname:new URL('./desktop',import.meta.url).pathname,process:{argv:[],platform:'win32'},Response,URL,setTimeout:fn=>scheduled.push(fn),setInterval:()=>({unref(){}})};
 vm.runInNewContext(read('desktop/main.cjs'),context);await new Promise(resolve=>setImmediate(resolve));
 const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
 ipc.emit('close-handler-ready',event);let prevented=false;win.emit('close',{preventDefault(){prevented=true;}});assert.equal(prevented,true);
 const token=win.sent.find(x=>x[0]==='prepare-close')[1];
 ipc.emit('close-ready',{sender:{},senderFrame:{}},token,true);assert.equal(win.closed,0);
 ipc.emit('close-ready',event,'stale',true);assert.equal(win.closed,0);
 ipc.emit('close-ready',event,token,false);assert.equal(win.closed,0);
 win.emit('close',{preventDefault(){}});const next=win.sent.filter(x=>x[0]==='prepare-close').at(-1)[1];ipc.emit('close-ready',event,next,true);assert.equal(win.closed,1);
 assert.equal((await protocolHandler({url:'spark://app/../secret'})).status,404);assert.equal((await protocolHandler({url:'spark://foreign/index.html'})).status,404);
});

test('All desktop targets satisfy the pinned electron-builder configuration schema',async()=>{
 const {validateConfiguration}=require('app-builder-lib/out/util/config/config');
 for(const mode of ['game','builder','guide']){process.env.SPARK_PACKAGE_MODE=mode;delete require.cache[require.resolve('./desktop/package-config.cjs')];await validateConfiguration(require('./desktop/package-config.cjs'),{isEnabled:false});}
 delete process.env.SPARK_PACKAGE_MODE;
});
