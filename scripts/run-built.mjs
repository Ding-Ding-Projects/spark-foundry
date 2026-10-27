import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { sourceIdentity,digest,manifest } from './build-receipt.mjs';
const receipt=JSON.parse(readFileSync('release/runnable.json'));
for(const [key,value] of Object.entries(sourceIdentity()))if(JSON.stringify(receipt[key])!==JSON.stringify(value))throw new Error(`Runnable build receipt mismatch: ${key}`);
for(const output of receipt.outputs)if(digest(output.path)!==output.sha256)throw new Error(`Runnable bytes changed: ${output.path}`);
const child=spawn(manifest.target.executable,[],{stdio:'inherit'});child.on('error',error=>{console.error(error);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code||0;});
