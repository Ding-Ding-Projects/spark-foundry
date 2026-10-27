import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { requiredArtifacts, collectReleaseArtifacts, validateReleaseReceipt } from './scripts/release-artifacts.mjs';
const require=createRequire(import.meta.url);
const version='1.3.1';
const hash=(data,algorithm='sha256')=>createHash(algorithm).update(data).digest('hex');
// Plain-text test doubles, never runnable binaries or release deliverables.
const verify=(path)=>{const data=readFileSync(path);return {path,bytes:data.length,sha256:hash(data)};};
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'spark-artifact-layout-test-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 for(const [path] of requiredArtifacts(version)){mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),'TEST ONLY: non-executable artifact layout fixture\n');}
 const packagePath=requiredArtifacts(version)[1][0],data=readFileSync(join(root,packagePath));
 writeFileSync(join(root,requiredArtifacts(version)[2][0]),`${hash(data,'sha1').toUpperCase()} ${packagePath.split('/').at(-1)} ${data.length}\r\n`);
 return {root,verify};
}
test('allowlist matches the pinned builder default x64 Squirrel layout and configured names',()=>{
 const target=readFileSync(require.resolve('electron-builder-squirrel-windows'),'utf8');
 assert.match(target,/path\.join\(this\.outDir, `squirrel-windows\$\{/);
 const {getArchSuffix}=require('app-builder-lib');const {Arch}=require('builder-util');
 assert.equal(getArchSuffix(Arch.x64),'');
 assert.equal(require('electron-winstaller').convertVersion(version),version);
 const config=require('./desktop/package-config.cjs');
 assert.equal(config.squirrelWindows.name,'spark_foundry');assert.equal(config.squirrelWindows.artifactName,'SparkFoundrySetup.exe');
 assert.equal(requiredArtifacts(version).length,5);
});
test('nested installer/feed/package and top-level companions retain exact receipt paths',t=>{
 const options=fixture(t),outputs=collectReleaseArtifacts(version,options);
 assert.deepEqual(outputs.map(item=>item.path),requiredArtifacts(version).map(([path])=>path));
 assert.deepEqual(validateReleaseReceipt({outputs},version,options),outputs);
});
test('missing installer cannot be replaced by an unpacked game executable or top-level lookalike',t=>{
 const options=fixture(t);rmSync(join(options.root,requiredArtifacts(version)[0][0]));
 for(const path of ['release/game/win-unpacked/Spark Foundry.exe','release/game/SparkFoundrySetup.exe']){mkdirSync(dirname(join(options.root,path)),{recursive:true});writeFileSync(join(options.root,path),'TEST ONLY');}
 assert.throws(()=>collectReleaseArtifacts(version,options),/ENOENT/);
});
test('every required artifact is mandatory, including each portable companion',t=>{
 for(const [path] of requiredArtifacts(version)){const options=fixture(t);rmSync(join(options.root,path));assert.throws(()=>collectReleaseArtifacts(version,options),/ENOENT/);}
});
test('production verifier rejects test doubles, empty and malformed executable/archive content',t=>{
 const options=fixture(t);assert.throws(()=>collectReleaseArtifacts(version,{root:options.root}),/implausible artifact/);
 // Exercise production byte validation without manufacturing an executable.
 const {root}=options;const path=join(root,'invalid-content.txt');
 writeFileSync(path,'x'.repeat(1024*1024));
 return import('./scripts/build-receipt.mjs').then(({verifyFile})=>{
  assert.throws(()=>verifyFile(path,'exe'),/Invalid Windows executable/);
  assert.throws(()=>verifyFile(path,'nupkg'),/Invalid package archive/);
  writeFileSync(path,'');assert.throws(()=>verifyFile(path,'feed'),/implausible artifact/);
 });
});
test('feed must name and hash the exact versioned package with its actual size',t=>{
 for(const replacement of ['0'.repeat(40),'spark_foundry-0.0.0-full.nupkg','999999']){
  const options=fixture(t),path=join(options.root,requiredArtifacts(version)[2][0]);
  const fields=readFileSync(path,'utf8').trim().split(' ');fields[replacement==='999999'?2:replacement.startsWith('spark_')?1:0]=replacement;writeFileSync(path,fields.join(' '));
  assert.throws(()=>collectReleaseArtifacts(version,options),/RELEASES does not match/);
 }
});
test('publication rejects changed, missing, duplicate, wrong-version and unsafe receipt paths',t=>{
 const options=fixture(t),outputs=collectReleaseArtifacts(version,options);
 for(const path of ['/tmp/evil.exe','release/game/win-unpacked/Spark Foundry.exe','release/game/squirrel-windows/../SparkFoundrySetup.exe','release/game/SparkFoundrySetup.exe','release/builder/SparkFoundryBuilder-0.0.0.exe']){
  const changed=structuredClone(outputs);changed[0].path=path;assert.throws(()=>validateReleaseReceipt({outputs:changed},version,options),/outside the required/);
 }
 assert.throws(()=>validateReleaseReceipt({outputs:outputs.slice(1)},version,options),/outside the required/);
 assert.throws(()=>validateReleaseReceipt({outputs:[outputs[0],...outputs.slice(0,-1)]},version,options),/outside the required/);
 const changed=structuredClone(outputs);changed[0].sha256='0'.repeat(64);assert.throws(()=>validateReleaseReceipt({outputs:changed},version,options),/changed since packaging/);
});
test('symlinks cannot redirect an allowlisted artifact',t=>{
 const options=fixture(t),path=join(options.root,requiredArtifacts(version)[0][0]);rmSync(path);symlinkSync(join(options.root,requiredArtifacts(version)[3][0]),path);
 assert.throws(()=>collectReleaseArtifacts(version,options),/Unsafe release artifact/);
});
test('failure evidence explicitly includes nested Squirrel assets without recursive unpacked collection',()=>{
 const workflow=readFileSync('.github/workflows/release.yml','utf8');
 assert.match(workflow,/release\/game\/squirrel-windows\/SparkFoundrySetup.exe/);
 assert.match(workflow,/release\/game\/squirrel-windows\/RELEASES/);
 assert.doesNotMatch(workflow,/-Recurse|release\/game\/\*\*|npm test|npm run lint/);
});
