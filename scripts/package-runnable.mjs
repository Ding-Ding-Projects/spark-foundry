import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import {sourceIdentity,verifyFile,record,manifest} from './build-receipt.mjs';
if(process.platform!=='win32')throw new Error('Runnable desktop packaging requires Windows.');
const source=sourceIdentity();rmSync('release/game/win-unpacked',{recursive:true,force:true});
const args=['node_modules/electron-builder/out/cli/cli.js','--config','desktop/package-config.cjs','--win','--x64','--dir','--publish','never'];
if(process.env.SPARK_BUILD_VERSION){if(!/^\d+\.\d+\.\d+$/.test(process.env.SPARK_BUILD_VERSION))throw new Error('Invalid SPARK_BUILD_VERSION');args.push(`--config.extraMetadata.version=${process.env.SPARK_BUILD_VERSION}`);}
const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,SPARK_PACKAGE_MODE:'game',CSC_IDENTITY_AUTO_DISCOVERY:'false'}});
if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
record('release/runnable.json',source,[verifyFile(manifest.target.executable,'exe'),verifyFile('release/game/win-unpacked/resources/app.asar','asar')]);
