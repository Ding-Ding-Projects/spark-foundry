import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { basename, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { validateReleaseReceipt } from './release-artifacts.mjs';
const required=['GITHUB_REPOSITORY','GITHUB_SHA','GITHUB_RUN_ID','GITHUB_RUN_NUMBER','GITHUB_RUN_ATTEMPT','SPARK_BUILD_VERSION','GH_TOKEN'];
for(const key of required)if(!process.env[key])throw new Error(`Required publication context unavailable: ${key}`);
const {GITHUB_REPOSITORY:repo,GITHUB_SHA:source,GITHUB_RUN_ID:runId,GITHUB_RUN_NUMBER:runNumber,GITHUB_RUN_ATTEMPT:attempt,SPARK_BUILD_VERSION:version}=process.env;
if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||!/^[a-f0-9]{40}$/.test(source)||!/^\d+$/.test(runId)||!/^\d+$/.test(runNumber)||!/^\d+$/.test(attempt)||!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid publication identity.');
const gh=(...args)=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:20*1024*1024}).trim();
const api=path=>JSON.parse(gh('api',path));
const sha256=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const receipt=JSON.parse(readFileSync('release/source.json','utf8'));
if(receipt.source!==source||receipt.version!==version||receipt.unsigned!==true)throw new Error('Artifact receipt does not match intended source/version.');
const lineage=api(`repos/${repo}/compare/${source}...main`);
if(!['ahead','identical'].includes(lineage.status))throw new Error('Intended source is not proven in the target main lineage.');
const jobs=api(`repos/${repo}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`);
if(jobs.total_count>100)throw new Error('Timing job listing is incomplete.');
const starts=jobs.jobs.map(job=>job.started_at).filter(Boolean).map(value=>Date.parse(value));
if(!starts.length||starts.some(value=>!Number.isFinite(value)))throw new Error('Verified first-job timing unavailable.');
const started=new Date(Math.min(...starts));
const tag=`v${version}-run${runId}`;
const releases=JSON.parse(gh('api','--paginate','--slurp',`repos/${repo}/releases?per_page=100`)).flat();
if(releases.some(release=>release.tag_name===tag))throw new Error('Immutable release tag already exists. No release or asset will be overwritten.');
const assets=validateReleaseReceipt(receipt,version).map(item=>resolve(item.path));
assets.push(resolve('release/source.json'));
let dish=null;
try{
 const catalogue=JSON.parse(gh('api','repos/Ding-Ding-Projects/dim-sum-photos/contents/catalog/index.json','-H','Accept: application/vnd.github.raw+json'));
 const photos=JSON.parse(gh('api','--paginate','--slurp','repos/Ding-Ding-Projects/dim-sum-photos/releases?per_page=100')).flat();
 const published=new Set(photos.filter(release=>/^catalog-v1/.test(release.tag_name)&&!release.draft&&!release.prerelease).flatMap(release=>release.assets.map(asset=>asset.browser_download_url)));
 const used=releases.map(release=>`${release.name}\n${release.body}`).join('\n');
 const walk=value=>{if(!value||typeof value!=='object'||dish)return;if(value.name?.en&&value.name?.zhHant&&!used.includes(value.name.en)&&!used.includes(value.name.zhHant)){const strings=[];const collect=item=>{if(typeof item==='string')strings.push(item);else if(item&&typeof item==='object')Object.values(item).forEach(collect);};collect(value);const photo=strings.find(url=>published.has(url));if(photo)dish={en:value.name.en,zh:value.name.zhHant,photo};}for(const item of Object.values(value))walk(item);};
 walk(catalogue);
}catch{ /* Catalogue availability never delays a release. */ }
const codename=dish?`\nRelease name: ${dish.en} / ${dish.zh}\n\n[Published photo](${dish.photo}) · [Authoritative catalogue](https://github.com/Ding-Ding-Projects/dim-sum-photos/blob/main/catalog/index.json)\n`:'\nNo verified unused catalogue identity and published photo link could be resolved. This release uses its version only.\n';
const sizes=receipt.outputs.map(item=>`- ${basename(item.path)}: ${item.bytes.toLocaleString('en-US')} bytes; SHA-256 \`${item.sha256}\``).join('\n');
const baseNotes=`# Spark Foundry ${version}\n\nWindows x64 offline game, portable build companion, and offline field guide.\n\n**Unsigned:** Squirrel.Windows artifacts are unsigned and may trigger Windows unknown-publisher or SmartScreen warnings. Hashes establish byte integrity, not publisher trust.\n\nSource: \`${source}\`\n\n[Workflow](https://github.com/${repo}/actions/runs/${runId})\n${codename}\n## Verification\n\nThis workflow builds and packages; it does not run tests, lint, or UI/installer runtime checks. Publication-language enforcement is the sole dedicated policy scan. Local test results, where available, are reported separately; no unrun checks are implied. Without CI test gates, releases can ship code whose tests would fail. Windows installation, cancellation, update and uninstall runtime behavior remain unverified by this workflow.\n\n## Files\n\n${sizes}\n\nRetained build scripts are available in this exact tag's source archive.\n`;
const notes=join(tmpdir(),`spark-release-notes-${runId}-${attempt}.md`);
writeFileSync(notes,`${baseNotes}\nWorkflow timing: publication is in progress; final verified timing is pending.\n`);
try{
 gh('release','create',tag,...assets,'--repo',repo,'--target',source,'--title',dish?`${version} · ${dish.en} / ${dish.zh}`:version,'--notes-file',notes);
 let release=api(`repos/${repo}/releases/tags/${tag}`);
 if(release.draft||release.prerelease)throw new Error('Published release is not a normal release.');
 let object=api(`repos/${repo}/git/ref/tags/${tag}`).object;const seen=new Set();
 for(let depth=0;object.type==='tag'&&depth<8;depth++){if(seen.has(object.sha))throw new Error('Tag cycle detected.');seen.add(object.sha);object=api(`repos/${repo}/git/tags/${object.sha}`).object;}
 if(object.type!=='commit'||object.sha!==source)throw new Error('Published tag does not resolve to exact source.');
 const download=mkdtempSync(join(tmpdir(),'spark-release-proof-'));
 try{for(const file of assets){const name=basename(file),asset=release.assets.find(item=>item.name===name);if(!asset||asset.size!==statSync(file).size)throw new Error(`Published asset unavailable or wrong size: ${name}`);gh('release','download',tag,'--repo',repo,'--pattern',name,'--dir',download);if(sha256(join(download,name))!==sha256(file))throw new Error(`Downloaded release digest mismatch: ${name}`);}}finally{rmSync(download,{recursive:true,force:true});}
 const completed=new Date();const total=Math.floor((completed-started)/1000);if(total<0)throw new Error('Workflow timing is invalid.');
 const duration=[Math.floor(total/3600),Math.floor(total%3600/60),total%60].map(n=>String(n).padStart(2,'0')).join(':');
 const finalNotes=`${baseNotes}\n## Workflow timing\n\nWorkflow started: ${started.toISOString()}\n\nWorkflow completed: ${completed.toISOString()}\n\nWorkflow duration: ${duration}\n\nTiming spans the first job start through confirmed release publication and downloadable-asset verification; this final metadata update follows that measurement.\n`;
 writeFileSync(notes,finalNotes);gh('release','edit',tag,'--repo',repo,'--notes-file',notes);
 release=api(`repos/${repo}/releases/tags/${tag}`);
 if(release.draft||release.prerelease||release.body?.trim()!==finalNotes.trim())throw new Error('Final release state or timing notes could not be verified.');
 writeFileSync('release/publication.json',JSON.stringify({tag,source,version,url:release.html_url,isDraft:release.draft,isPrerelease:release.prerelease,workflowStarted:started.toISOString(),workflowCompleted:completed.toISOString(),workflowDuration:duration,assets:release.assets.map(item=>({name:item.name,size:item.size,url:item.browser_download_url}))},null,2));
 console.log(`Published and verified ${release.html_url}`);
}finally{rmSync(notes,{force:true});}
