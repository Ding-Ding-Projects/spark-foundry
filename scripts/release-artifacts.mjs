import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyFile } from './build-receipt.mjs';

// electron-builder's x64 Squirrel target uses this subdirectory, not win-unpacked.
// Keep publication and packaging on the same exact, version-specific allowlist.
export function requiredArtifacts(version) {
 if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid artifact version.');
 return [
  ['release/game/squirrel-windows/SparkFoundrySetup.exe','exe'],
  [`release/game/squirrel-windows/spark_foundry-${version}-full.nupkg`,'nupkg'],
  ['release/game/squirrel-windows/RELEASES','feed'],
  [`release/builder/SparkFoundryBuilder-${version}.exe`,'exe'],
  [`release/guide/SparkFoundryGuide-${version}.exe`,'exe'],
 ];
}

export function collectReleaseArtifacts(version,{root=process.cwd(),verify=verifyFile}={}) {
 const outputs=requiredArtifacts(version).map(([path,type])=>{
  const local=resolve(root,path),realRoot=realpathSync(root),real=realpathSync(local);
  const rel=relative(realRoot,real);
  if(isAbsolute(rel)||rel.startsWith('..')||real!==resolve(realRoot,path)||!lstatSync(local).isFile())throw new Error(`Unsafe release artifact: ${path}`);
  return {...verify(local,type),path};
 });
 const packagePath=requiredArtifacts(version)[1][0];
 const bytes=readFileSync(resolve(root,packagePath));
 const feed=readFileSync(resolve(root,requiredArtifacts(version)[2][0]),'utf8').trim().split(/\r?\n/);
 const expected=`${createHash('sha1').update(bytes).digest('hex')} ${packagePath.split('/').at(-1)} ${bytes.length}`;
 if(feed.length!==1||feed[0].trim().toLowerCase()!==expected.toLowerCase())throw new Error('Squirrel RELEASES does not match the required full package.');
 return outputs;
}

export function validateReleaseReceipt(receipt,version,options) {
 const expected=requiredArtifacts(version).map(([path])=>path);
 if(!Array.isArray(receipt.outputs)||receipt.outputs.length!==expected.length||new Set(receipt.outputs.map(item=>item.path)).size!==expected.length||receipt.outputs.some(item=>!expected.includes(item.path)))throw new Error('Artifact path is outside the required release output set.');
 const current=collectReleaseArtifacts(version,options);
 for(const item of receipt.outputs){
  const actual=current.find(output=>output.path===item.path);
  if(actual.bytes!==item.bytes||actual.sha256!==item.sha256)throw new Error(`Artifact changed since packaging: ${item.path}`);
 }
 return current;
}
