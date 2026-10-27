import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { runRegexJob, LIMITS } from './regex-worker.js';
import { createRunner, escapeLiteral, explainPattern, TIMEOUT_MS, STARTUP_TIMEOUT_MS } from './regex-workbench.js';
class BrowserWorker {
  constructor(){
    this.worker=new Worker(`const {parentPort}=require('node:worker_threads'); import(${JSON.stringify(new URL('./regex-worker.js',import.meta.url).href)}).then(({runRegexJob})=>{parentPort.on('message',job=>{try{parentPort.postMessage({ok:true,result:runRegexJob(job)})}catch(e){parentPort.postMessage({ok:false,error:e.message})}});parentPort.postMessage({ready:true});});`,{eval:true});
    this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));
  }
  postMessage(data){this.worker.postMessage(data);}
  terminate(){this.worker.terminate();}
}
test('literal helpers do not interpret special characters',()=>{
  const value='a+b.[x](z)$?^|{}\\';assert.equal(new RegExp(escapeLiteral(value)).test(value),true);
  assert.equal(explainPattern('(?<name>\\d+)$')[0].meaning,'Named capture opening');
});
test('match capture indices and replacement use actual JavaScript semantics',()=>{
  const r=runRegexJob({pattern:'(?<n>\\d+)',flags:'gd',sample:'A12 B34',replacement:'[$<n>]'});
  assert.equal(r.matches.length,2);assert.equal(r.matches[0].groups.n,'12');assert.deepEqual(r.matches[0].indices[1],[1,3]);assert.equal(r.replaced,'A[12] B[34]');assert.deepEqual(r.split,['A','12',' B','34','']);
});
test('zero-width Unicode traversal advances whole code points',()=>{
  const r=runRegexJob({pattern:'(?:)',flags:'gu',sample:'🚀a'});assert.deepEqual(r.matches.map(m=>m.index),[0,2,3]);
});
test('search resets global and sticky state independently per item',()=>{
  assert.deepEqual(runRegexJob({pattern:'a',flags:'g',items:['a','a','b']}).matches,[true,true,false]);
  assert.deepEqual(runRegexJob({pattern:'a',flags:'y',items:['ba','a']}).matches,[false,true]);
});
test('invalid syntax flags and unsupported atomic groups fail closed',()=>{
  for(const job of [{pattern:'['},{pattern:'a',flags:'gg'},{pattern:'a',flags:'uv'},{pattern:'(?>a)'},{pattern:'a++'},{pattern:'(?R)'}])assert.throws(()=>runRegexJob(job));
});
test('every input and collection bound enforced',()=>{
  for(const key of ['pattern','sample','replacement'])assert.throws(()=>runRegexJob({[key]:'a'.repeat(LIMITS[key]+1)}));
  assert.throws(()=>runRegexJob({items:Array(501).fill('a')}));assert.throws(()=>runRegexJob({items:['a'.repeat(65537)]}));assert.throws(()=>runRegexJob({items:[null]}));
  const r=runRegexJob({pattern:'a',flags:'g',sample:'a'.repeat(600)});assert.equal(r.matches.length,500);assert.equal(r.truncated,true);
});
test('actual worker finishes normal jobs and errors without UI execution',async()=>{
  const runner=createRunner(BrowserWorker);assert.equal((await runner.run({pattern:'x',sample:'x'})).matches.length,1);await assert.rejects(runner.run({pattern:'['}));
});
test('actual catastrophic backtracking worker is terminated and next run recovers',async()=>{
  const runner=createRunner(BrowserWorker);const start=Date.now();await assert.rejects(runner.run({pattern:'(a+)+$',sample:'a'.repeat(12000)+'!'}),/Stopped after/);assert.ok(Date.now()-start<STARTUP_TIMEOUT_MS+TIMEOUT_MS+2000);assert.equal((await runner.run({pattern:'safe',sample:'safe'})).matches.length,1);
});
test('cancel and missing Worker fail explicitly',async()=>{
  const runner=createRunner(BrowserWorker);const promise=runner.run({pattern:'a',sample:'a'});runner.cancel();await assert.rejects(promise,/canceled/);await assert.rejects(createRunner(null).run({}),/unavailable/);
});

test('worker startup delay does not consume the execution budget',async()=>{
  class SlowStartup extends BrowserWorker {
    constructor(){super();this.worker.removeAllListeners('message');this.worker.on('message',data=>{if(data.ready)setTimeout(()=>this.onmessage?.({data}),TIMEOUT_MS+50);else this.onmessage?.({data});});}
  }
  const result=await createRunner(SlowStartup).run({pattern:'ready',sample:'ready'});assert.equal(result.matches.length,1);
});
