import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
export const manifest=JSON.parse(readFileSync('build-manifest.json','utf8'));
if(manifest.schema!==1 || manifest.target.platform!=='win32' || manifest.target.arch!=='x64' || manifest.commands.build!=='npm run build' || manifest.commands.package!=='npm run package:windows')throw new Error('Unsupported build manifest.');
for(const output of [manifest.target.executable,...Object.values(manifest.outputs)]){const path=relative(process.cwd(),resolve(output));if(isAbsolute(output)||path.startsWith('..')||isAbsolute(path))throw new Error('Build output escapes the source directory.');}
export const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
export function sourceIdentity(){
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 if(git('status','--porcelain'))throw new Error('Build packaging requires a clean committed source tree. Commit source changes before packaging.');
 const source=git('rev-parse','HEAD');if(process.env.GITHUB_SHA&&process.env.GITHUB_SHA!==source)throw new Error('Workflow source does not match checkout.');
 return {source,tree:git('rev-parse','HEAD^{tree}'),index:git('write-tree'),manifest:digest('build-manifest.json'),manifestSchema:manifest.schema,target:manifest.target,commands:manifest.commands};
}
export function verifyFile(path,type){const bytes=readFileSync(path);if(bytes.length<(type==='exe'?1024*1024:32))throw new Error(`Missing or implausible artifact: ${path}`);if(type==='exe'&&bytes.subarray(0,2).toString()!=='MZ')throw new Error(`Invalid Windows executable: ${path}`);if(type==='nupkg'&&bytes.subarray(0,2).toString()!=='PK')throw new Error(`Invalid package archive: ${path}`);return {path,bytes:statSync(path).size,sha256:digest(path)};}
export function record(path,before,outputs){const after=sourceIdentity();if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Source changed during packaging.');writeFileSync(path,JSON.stringify({...before,version:process.env.SPARK_BUILD_VERSION||'1.0.0',builtAt:new Date().toISOString(),unsigned:true,outputs},null,2));}
