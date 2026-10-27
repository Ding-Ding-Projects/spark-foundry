import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWording, normalizePreferences, localized, applyWording, DEFAULTS } from './preferences.js';
const payload = replacements => JSON.stringify({version:1,replacements});
test('wording contract accepts dynamic inventory, empty inventory and Unicode bounds',()=> {
 assert.equal(Object.keys(parseWording(payload({})).replacements).length,0);
 assert.equal(Object.keys(parseWording(payload(Object.fromEntries(Array.from({length:300},(_,i)=>[`term ${i}`,`value ${i}`])))).replacements).length,300);
 assert.doesNotThrow(()=>parseWording(payload({['界'.repeat(160)]:'界'.repeat(1000)})));
 assert.throws(()=>parseWording(payload({['界'.repeat(161)]:'ok'})));
 assert.throws(()=>parseWording(payload({x:'界'.repeat(1001)})));
});
test('wording parser rejects malformed, duplicate, escaped duplicate, unsupported and unsafe input',()=> {
 for (const source of ['','null','[]','{}','{"version":2,"replacements":{}}','{"version":1,"replacements":{},"extra":true}','{"version":1,"version":1,"replacements":{}}','{"version":1,"replacements":{"a":"b","\\u0061":"c"}}','{"version":1,"replacements":{"__proto__":"x"}}','{"version":1,"replacements":{"constructor":"x"}}',payload({x:1}),payload({x:null}),payload({x:[]}),payload({x:{a:'b'}}),payload({'':'value'}),payload({})+' garbage','{"version":1,"replacements":{},}', '\u00a0'+payload({})]) assert.throws(()=>parseWording(source));
});
test('byte limit and nesting bounds fail closed without leaking payload in errors',()=> {
 const source = payload(Object.fromEntries(Array.from({length:300},(_,i)=>[`key ${i}`,'界'.repeat(1000)])));
 assert.throws(()=>parseWording(source),/^Error: Invalid wording$/);
 assert.throws(()=>parseWording('{"version":1,"replacements":'+ '['.repeat(10)+'0'+']'.repeat(10)+'}'));
});
test('literal substitutions do not execute markup, expand replacement syntax or cascade',()=> {
 assert.equal(applyWording('alpha a.b alpha',{'alpha':'beta','beta':'gamma','a.b':'$&'}),'beta $& beta');
 assert.equal(applyWording('alpha',{'alpha':'<b>text</b>'}),'<b>text</b>');
});
test('preferences clamp invalid values and retain independently selected valid values',()=> {
 assert.deepEqual(normalizePreferences({version:8}),{...DEFAULTS});
 const prefs = normalizePreferences({version:1,language:'both',englishTone:1,cantoneseTone:3,emojis:false,setupStep:2,setupComplete:true});
 assert.equal(prefs.englishTone,1); assert.equal(prefs.cantoneseTone,3); assert.equal(prefs.language,'both'); assert.equal(prefs.setupStep,2); assert.equal(prefs.emojis,false);
 for (const value of [0,6,2.5,'1',null]) assert.equal(normalizePreferences({version:1,englishTone:value}).englishTone,5);
});
test('three modes and every independent tone level render distinct product messages',()=> {
 for (const language of ['en','yue']) {
   const variants = new Set(); for (let level=1;level<=5;level++) variants.add(localized('preview',{...DEFAULTS,language,englishTone:level,cantoneseTone:level})); assert.equal(variants.size,5);
 }
 const both = localized('preview',{...DEFAULTS,language:'both',englishTone:1,cantoneseTone:5});
 assert.ok(both.includes(localized('preview',{...DEFAULTS,language:'en',englishTone:1})));
 assert.ok(both.includes(localized('preview',{...DEFAULTS,language:'yue',cantoneseTone:5})));
});
test('both public surfaces and native server include the shared local-only settings assets',()=> {
 const read = f=>readFileSync(new URL(f,import.meta.url),'utf8');
 for (const page of ['index.html','docs.html']) { assert.match(read(page),/src="preferences.js"/); assert.match(read(page),/href="preferences.css"/); }
 for (const asset of ['preferences.js','preferences-copy.js','preferences.css','regex-workbench.js','regex-worker.js','regex-workbench.css','regex-capabilities.md']) { assert.ok(read('scripts/build.mjs').includes(`'${asset}'`)); assert.ok(read('desktop/main.cjs').includes(`'${asset}'`)); }
 const source=read('preferences.js'); assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|sendBeacon|innerHTML|outerHTML|eval)\s*\(/); assert.doesNotMatch(source,/console\./);
 assert.match(source,/new TextDecoder\('utf-8',\{fatal:true\}\)/); assert.match(source,/MutationObserver/);
});
