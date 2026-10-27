import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { sourceIdentity, record } from './build-receipt.mjs';
import { collectReleaseArtifacts } from './release-artifacts.mjs';
if(process.platform !== 'win32') throw new Error('Windows packaging requires a Windows build host. No installer was produced.');
const source=sourceIdentity();
const version=process.env.SPARK_BUILD_VERSION;
if(version && !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('SPARK_BUILD_VERSION must be numeric major.minor.patch.');
for(const mode of ['game','builder','guide']) {
 if(JSON.stringify(sourceIdentity())!==JSON.stringify(source))throw new Error('Source changed before packaging target.');
 rmSync(`release/${mode}`,{recursive:true,force:true});
 const args=['node_modules/electron-builder/out/cli/cli.js','--config','desktop/package-config.cjs','--win','--x64','--publish','never'];
 if(version) args.push(`--config.extraMetadata.version=${version}`);
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,SPARK_PACKAGE_MODE:mode,CSC_IDENTITY_AUTO_DISCOVERY:'false'}});
 if(result.error) throw result.error;
 if(result.status!==0) process.exit(result.status||1);
}
const outputs=collectReleaseArtifacts(version||'1.0.0');
record('release/source.json',source,outputs);
for(const output of outputs)console.log(`${output.sha256}  ${output.path} (${output.bytes} bytes)`);
