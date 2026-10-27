// All execution of user-supplied expressions stays in a disposable worker.
export const LIMITS = Object.freeze({pattern:2048, sample:16384, replacement:256, matches:500, items:500, corpus:65536, output:65536});
export function runRegexJob(job) {
  const start = performance.now();
  const {pattern='',flags='',sample='',replacement='',items} = job;
  for (const [key,value,limit] of [['pattern',pattern,LIMITS.pattern],['sample',sample,LIMITS.sample],['replacement',replacement,LIMITS.replacement]]) {
    if (typeof value !== 'string' || value.length > limit) throw new Error(`${key} exceeds ${limit} UTF-16 units.`);
  }
  if (typeof flags !== 'string' || !/^[dgimsuvy]*$/.test(flags)) throw new Error('Unknown regular expression flag.');
  const regex = new RegExp(pattern,flags); // Syntax and supported flags are checked by the actual engine.
  if (items !== undefined) {
    if (!Array.isArray(items) || items.length > LIMITS.items || items.some(x=>typeof x!=='string') || items.reduce((n,x)=>n+x.length,0)>LIMITS.corpus) throw new Error('Search scope exceeds 500 items or 65,536 UTF-16 units.');
    return {matches:items.map(text=>{regex.lastIndex=0;return regex.test(text);}),elapsed:performance.now()-start};
  }
  const matches=[];
  let outputSize=0, outputLimited=false;
  let match;
  while (matches.length < LIMITS.matches && (match=regex.exec(sample)) !== null) {
    const clip=value=>typeof value==='string'?value.slice(0,256):value;
    const entry={index:match.index,end:match.index+match[0].length,text:clip(match[0]),captures:[...match].slice(1,101).map(clip),groups:Object.fromEntries(Object.entries(match.groups??{}).slice(0,100).map(([k,v])=>[k,clip(v)])),indices:match.indices?.slice(0,101)??null};
    outputSize+=JSON.stringify(entry).length;
    if(outputSize>LIMITS.output){outputLimited=true;break;}
    matches.push(entry);
    if (!regex.global && !regex.sticky) break;
    if (match[0]==='') {
      const i=regex.lastIndex;
      regex.lastIndex += (regex.unicode || regex.unicodeSets) && sample.codePointAt(i)>0xffff ? 2 : 1;
    }
  }
  regex.lastIndex=0;
  const replaced=sample.replace(regex,replacement);
  regex.lastIndex=0;
  const split=sample.split(regex,LIMITS.matches+1);
  return {matches,truncated:matches.length===LIMITS.matches || outputLimited,replaced:replaced.slice(0,LIMITS.output),replacementTruncated:replaced.length>LIMITS.output,split,splitLimited:split.length===LIMITS.matches+1,elapsed:performance.now()-start};
}
if (typeof self !== 'undefined' && typeof document === 'undefined') {
self.onmessage = ({data}) => {
  try { self.postMessage({ok:true,result:runRegexJob(data)}); }
  catch(error) { self.postMessage({ok:false,error:error.message}); }
};

self.postMessage({ready:true});
}
