const states = new WeakMap();
export const TIMEOUT_MS = 350;
export const STARTUP_TIMEOUT_MS = 3000;
export function createRunner(WorkerClass=globalThis.Worker) {
  let active;
  return {cancel(){active?.();},run(job){
    active?.();
    return new Promise((resolve,reject)=>{
      if (!WorkerClass) { reject(new Error('Web Workers are unavailable. Regex execution is disabled.'));return; }
      let worker,timer,done=false;
      const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);worker?.terminate();active=null;error?reject(error):resolve(result);};
      try {worker=new WorkerClass(new URL('./regex-worker.js',import.meta.url),{type:'module'});}
      catch {finish(new Error('Worker could not start. Serve this app over HTTP or use the desktop app.'));return;}
      active=()=>finish(new Error('Run canceled.'));
      // Startup can be delayed by browser/process scheduling; it never executes a pattern.
      timer=setTimeout(()=>finish(new Error(`Worker did not become ready within ${STARTUP_TIMEOUT_MS} ms. No expression was executed.`)),STARTUP_TIMEOUT_MS);
      let started=false;
      worker.onmessage=({data})=>{
        if(done)return;
        if(data.ready && !started){
          started=true;clearTimeout(timer);
          timer=setTimeout(()=>finish(new Error(`Stopped after ${TIMEOUT_MS} ms of execution. Simplify the expression or reduce the input.`)),TIMEOUT_MS);
          worker.postMessage(job);
        }else if(started && !data.ready){data.ok?finish(null,data.result):finish(new Error(data.error));}
      };
      worker.onerror=()=>finish(new Error('Worker failed. Regex execution stopped safely.'));
    });
  }};
}
export function escapeLiteral(text){return text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
export function explainPattern(pattern){
  const tokens=pattern.match(/\\(?:[pP]\{[^}]*\}|u\{[^}]*\}|k<[^>]*>|.)|\[(?:\\.|[^\]\\])*\]|\(\?(?:<[=!]|[:=!]|<[^>]*>)|\{\d+(?:,\d*)?\}\??|[+*?]\??|./gs)||[];
  return tokens.map(token=>({token,meaning: token.startsWith('[')?'Character class':token.startsWith('\\p')||token.startsWith('\\P')?'Unicode property (Unicode mode required)':token.startsWith('\\')?'Escape, shorthand or backreference':token==='^'?'Start assertion (line start with m)':token==='$'?'End assertion (line end with m)':token==='.'?'Any character (line breaks require s)':token==='|'?'Alternative':token.startsWith('(?<')&& !/[=!]/.test(token)?'Named capture opening':token==='('?'Capture opening':token===')'?'Group closing':token.startsWith('(?')?'Group or lookaround opening':/^[+*?{]/.test(token)?'Repetition or modifier':'Literal'}));
}
function el(tag,text,parent,attrs={}){const node=document.createElement(tag);if(text)node.textContent=text;for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);parent?.append(node);return node;}
function fallbackScope(input){
  if(input.id==='guide-search'){
    const sections=[...document.querySelectorAll('main section')];
    return {getCandidates:()=>sections.map(s=>s.textContent),onResults:({matches})=>{sections.forEach((s,i)=>{s.hidden=!matches[i];const a=document.querySelector(`nav a[href="#${s.id}"]`);if(a)a.hidden=s.hidden;});const n=matches.filter(Boolean).length;const status=document.querySelector('#search-status');if(status)status.textContent=`${n} matching sections`;const empty=document.querySelector('#no-results');if(empty)empty.hidden=n>0;}};
  }
  const target=input.dataset.searchTarget;
  if(target){const nodes=()=>[...document.querySelectorAll(target)];return{getCandidates:()=>nodes().map(n=>n.textContent),onResults:({matches})=>nodes().forEach((n,i)=>n.hidden=!matches[i])};}
  return {};
}
export function attachRegexWorkbench(input,options={}){
  if(states.has(input)){Object.assign(states.get(input).options,options);return states.get(input);}
  const state={options:{...fallbackScope(input),...options},runner:createRunner(),searchRunner:createRunner(),sequence:0,searchSequence:0,history:[],snippets:[],enabled:false};states.set(input,state);
  const trigger=el('button','Regex',null,{type:'button','aria-expanded':'false','aria-label':`Regex workbench for ${input.getAttribute('aria-label')||input.id||'this search'}`});trigger.className='regex-trigger';input.after(trigger);
  const panel=el('section','',null,{'aria-label':'Regex workbench'});panel.className='regex-workbench';panel.hidden=true;trigger.after(panel);
  panel.id=`regex-workbench-${++attachRegexWorkbench.serial}`;trigger.setAttribute('aria-controls',panel.id);
  const heading=el('div','',panel);el('h3','Pattern laboratory',heading);
  el('p','JavaScript RegExp · current browser engine; exact engine version is not exposed. UTF-16 offsets; u/v enable Unicode semantics. Patterns and samples stay on this device.',panel);
  el('p','Bounded runs: 350 ms execution (up to 3 seconds worker startup), 2,048 pattern units, 16,384 sample units, 500 matches. Match/capture previews truncate at 256 units, 100 groups and 65,536 total units. This is a partial workbench, not full RegexBuddy parity.',panel);
  const field=(name,value='',multiline=false,max=2048)=>{const label=el('label',name,panel);const node=el(multiline?'textarea':'input','',label,{maxlength:String(max)});node.value=value;return node;};
  const pattern=field('Pattern (no / delimiters)',input.value);const flagsBox=el('fieldset','',panel);el('legend','Flags',flagsBox);flagsBox.className='regex-flags';const flags=[];
  for(const [flag,name]of Object.entries({g:'All matches',i:'Ignore case',m:'Multiline',s:'Dot all',u:'Unicode',v:'Unicode sets',d:'Capture indices',y:'Sticky'})){const label=el('label',`${flag} — ${name}`,flagsBox);const check=el('input','',label,{type:'checkbox',value:flag});check.checked=flag==='i'||flag==='g';flags.push(check);}
  const readFlags=()=>flags.filter(f=>f.checked).map(f=>f.value).join('');
  const helpers=el('details','',panel);el('summary','Insert pattern tokens',helpers);const literalLabel=el('label','Literal text to escape',helpers);const literal=el('input','',literalLabel,{maxlength:'512'});const tokens=el('div','',helpers);tokens.className='regex-tokens';
  function insert(text){pattern.setRangeText(text,pattern.selectionStart,pattern.selectionEnd,'end');pattern.focus();changed();}
  const button=(parent,title,action)=>{const b=el('button',title,parent,{type:'button'});b.addEventListener('click',action);return b;};
  button(tokens,'Insert literal',()=>insert(escapeLiteral(literal.value)));
  for(const [label,token]of [['Digits','\\d+'],['Word','\\w+'],['Whitespace','\\s+'],['Class','[a-z]'],['Start','^'],['End','$'],['Boundary','\\b'],['Capture','(text)'],['Named capture','(?<name>text)'],['Non-capture','(?:text)'],['Alternative','(?:one|two)'],['Lazy repeat','.*?'],['Lookahead','(?=text)'],['Lookbehind','(?<=text)'],['Backreference','\\1'],['Unicode letter','\\p{L}+'],['Code point','\\u{1F680}']])button(tokens,label,()=>insert(token));
  const sample=field('Test text','Solar 12\nLunar 34',true,16384);const replacement=field('Replacement ($& entire match, $1 capture, $<name> named, $$ dollar)','$&',false,256);
  const actions=el('div','',panel);actions.className='regex-actions';
  const status=el('p','Plain-text search is active.',panel,{role:'status','aria-live':'polite'});
  const summary=el('pre','Run a test to inspect matches.',panel);const captures=el('pre','',panel);const replaceOut=el('details','',panel);el('summary','Replacement and split preview',replaceOut);const previews=el('pre','',replaceOut);
  const explanation=el('details','',panel);el('summary','Lexical explanation (not an engine trace or complete parser)',explanation);const annotations=el('ol','',explanation);
  const codeBox=el('details','',panel);el('summary','JavaScript source and export',codeBox);const code=el('pre','',codeBox);
  const gaps=el('details','',panel);el('summary','Capabilities and unfinished features',gaps);el('p','Only the browser JavaScript flavor runs here. PCRE, Python, .NET, conversion, engine traces, backtracking debugger, file/folder replacement and verified backups, external-tool automation, editable code templates and parameterized libraries are unavailable: they require dedicated engines, instrumentation or filesystem integrations. Atomic groups, possessive quantifiers, conditionals and recursion are not supported by JavaScript. Unicode sets and inline modifiers depend on this browser; validation uses its real engine.',gaps);el('a','Read the capability matrix',gaps,{href:'regex-capabilities.md'});
  async function search(){
    if(!state.enabled)return;const seq=++state.searchSequence;
    if(!state.options.getCandidates){status.textContent='Search integration unavailable for this field; test workbench remains available.';return;}
    try{const result=await state.searchRunner.run({pattern:input.value,flags:readFlags(),items:state.options.getCandidates()});if(seq!==state.searchSequence||!state.enabled)return;state.options.onResults?.(result);input.dispatchEvent(new CustomEvent('regex-results',{detail:{...result,enabled:true,pattern:input.value,flags:readFlags()}}));status.textContent=`Regex active: ${result.matches.filter(Boolean).length} matching items.`;status.classList.remove('regex-error');}
    catch(error){if(seq!==state.searchSequence)return;status.textContent=error.message+' Previous search results are retained.';status.classList.add('regex-error');}
  }
  async function test(){const seq=++state.sequence;status.textContent='Testing in an isolated worker…';try{const result=await state.runner.run({pattern:pattern.value,flags:readFlags(),sample:sample.value,replacement:replacement.value});if(seq!==state.sequence)return;status.classList.remove('regex-error');status.textContent=`Valid · ${result.matches.length} matches${result.truncated?' (limit reached)':''} · ${result.elapsed.toFixed(2)} ms worker execution. Timing is not a benchmark.`;summary.textContent=result.matches.map((m,i)=>`${i+1}. [${m.index}, ${m.end}) ${JSON.stringify(m.text)}`).join('\n')||'No matches.';captures.textContent=JSON.stringify(result.matches.map((m,i)=>({match:i+1,captures:m.captures,named:m.groups,indices:m.indices})),null,2);previews.textContent=`Replacement${result.replacementTruncated?' (truncated)':''}:\n${result.replaced}\n\nSplit${result.splitLimited?' (limit reached)':''}:\n${JSON.stringify(result.split,null,2)}`;}
    catch(error){if(seq!==state.sequence)return;status.textContent=error.message;status.classList.add('regex-error');summary.textContent='No current result.';captures.textContent='';previews.textContent='';}}
  function changed(){annotations.replaceChildren();for(const row of explainPattern(pattern.value))el('li',`${row.token} — ${row.meaning}`,annotations);code.textContent=`const expression = new RegExp(${JSON.stringify(pattern.value)}, ${JSON.stringify(readFlags())});\n// Run untrusted expressions in a bounded worker, not on the UI thread.`;if(state.enabled){input.value=pattern.value;search();}clearTimeout(state.debounce);state.debounce=setTimeout(test,250);}
  button(actions,'Test now',()=>{clearTimeout(state.debounce);test();});button(actions,'Stop',()=>{clearTimeout(state.debounce);state.sequence++;state.runner.cancel();status.textContent='Test stopped.';});
  button(actions,'Use for this search',async()=>{try{await state.runner.run({pattern:pattern.value,flags:readFlags(),sample:''});state.enabled=true;input.dataset.regexEnabled='true';input.value=pattern.value;state.history.unshift({pattern:pattern.value,flags:readFlags()});state.history=state.history.slice(0,20);search();}catch(error){status.textContent=error.message;}});
  button(actions,'Plain text',()=>{state.enabled=false;input.dataset.regexEnabled='false';state.searchSequence++;state.searchRunner.cancel();status.textContent='Plain-text search is active.';input.dispatchEvent(new Event('input',{bubbles:true}));});
  button(actions,'Close',close);
  button(codeBox,'Copy pattern',async()=>{try{await navigator.clipboard.writeText(pattern.value);status.textContent='Pattern copied.';}catch{status.textContent='Clipboard unavailable. Select and copy the pattern field.';}});
  button(codeBox,'Export pattern JSON',()=>{const blob=new Blob([JSON.stringify({version:1,engine:'JavaScript RegExp',pattern:pattern.value,flags:readFlags()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a','',document.body,{href:url,download:'pattern.json'});a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Export contains pattern and flags only; no sample, replacement or personal settings.';});
  const library=el('details','',panel);el('summary','Session snippets and search history',library);const saved=el('div','',library);
  function restore(item){pattern.value=item.pattern;flags.forEach(f=>f.checked=item.flags.includes(f.value));changed();}
  function renderSaved(){saved.replaceChildren();state.snippets.forEach((item,i)=>button(saved,`Snippet ${i+1}: ${item.pattern.slice(0,40)}`,()=>restore(item)));state.history.forEach((item,i)=>button(saved,`History ${i+1}: ${item.pattern.slice(0,40)}`,()=>restore(item)));}
  button(library,'Save session snippet',()=>{state.snippets.push({pattern:pattern.value,flags:readFlags()});state.snippets=state.snippets.slice(-20);renderSaved();});button(library,'Show search history',renderSaved);button(library,'Clear session collection',()=>{state.snippets=[];state.history=[];renderSaved();});el('p','Each search owns its own collection. Collections are memory-only and clear on reload.',library);
  const suites=el('details','',panel);el('summary','Expected-result tests',suites);const suiteLabel=el('label','One test per line: + expected match, - expected no match',suites);const suite=el('textarea','',suiteLabel,{maxlength:'16000'});const suiteOut=el('pre','',suites);button(suites,'Run expected-result tests',async()=>{const lines=suite.value.split('\n').filter(Boolean);if(lines.some(x=>!['+','-'].includes(x[0]))){suiteOut.textContent='Every test line must start with + or -.';return;}try{const result=await state.runner.run({pattern:pattern.value,flags:readFlags(),items:lines.map(x=>x.slice(1))});suiteOut.textContent=lines.map((line,i)=>`${result.matches[i]===(line[0]==='+')?'PASS':'FAIL'} ${i+1}: ${JSON.stringify(line.slice(1))}`).join('\n')||'No tests provided.';}catch(error){suiteOut.textContent=error.message;}});
  function close(){panel.hidden=true;trigger.setAttribute('aria-expanded','false');clearTimeout(state.debounce);state.sequence++;state.runner.cancel();trigger.focus();}
  trigger.addEventListener('click',()=>{panel.hidden=!panel.hidden;trigger.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){pattern.value=input.value;changed();pattern.focus();}});
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();event.preventDefault();close();}});
  pattern.addEventListener('input',changed);flags.forEach(f=>f.addEventListener('change',changed));sample.addEventListener('input',changed);replacement.addEventListener('input',changed);
  input.addEventListener('input',event=>{pattern.value=input.value;if(state.enabled){event.stopImmediatePropagation();search();}},{capture:true});input.addEventListener('regex-refresh',search);
  return state;
}
attachRegexWorkbench.serial=0;
export function installRegexWorkbenches(){document.querySelectorAll('input[type="search"]').forEach(input=>attachRegexWorkbench(input));}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installRegexWorkbenches);else installRegexWorkbenches();
  new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1)))installRegexWorkbenches();}).observe(document.documentElement,{childList:true,subtree:true});
}
