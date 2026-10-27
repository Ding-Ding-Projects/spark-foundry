import { COPY, PRODUCT_COPY } from './preferences-copy.js?v=1bc73bbe10b9';
import { attachRegexWorkbench } from './regex-workbench.js?v=19b1549cdbb0';
export const PREFERENCE_KEY = 'spark-foundry.preferences.v1';
export const WORDING_KEY = 'spark-foundry.wording.v1';
export const DEFAULTS = Object.freeze({ version: 1, language: 'en', englishTone: 5, cantoneseTone: 5, emojis: true, setupStep: 0, setupComplete: false });
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const byteLength = value => new TextEncoder().encode(value).length;
// Parse the entire payload, including duplicate-key checks that JSON.parse alone cannot perform.
export function parseWording(source) {
  if (typeof source !== 'string' || byteLength(source) > 262144) throw new Error('Invalid wording');
  let at = 0;
  const fail = () => { throw new Error('Invalid wording'); };
  const space = () => { while (/\s/.test(source[at] || '') && at < source.length) { if (!' \r\n\t'.includes(source[at])) fail(); at++; } };
  function string() {
    const start = at++;
    while (at < source.length) { const c = source[at++]; if (c === '\\') at++; else if (c === '"') { try { return JSON.parse(source.slice(start, at)); } catch { fail(); } } }
    fail();
  }
  function value(depth) {
    if (depth > 8) fail(); space();
    if (source[at] === '"') return string();
    if (source[at] === '{') {
      at++; space(); const result = Object.create(null); const keys = new Set();
      if (source[at] === '}') { at++; return result; }
      while (at < source.length) {
        space(); if (source[at] !== '"') fail(); const key = string();
        if (keys.has(key) || forbidden.has(key)) fail(); keys.add(key); space(); if (source[at++] !== ':') fail();
        result[key] = value(depth + 1); space(); const next = source[at++]; if (next === '}') return result; if (next !== ',') fail();
      }
      fail();
    }
    if (source[at] === '[') {
      at++; space(); const result = []; if (source[at] === ']') { at++; return result; }
      while (at < source.length) { result.push(value(depth + 1)); space(); const next = source[at++]; if (next === ']') return result; if (next !== ',') fail(); } fail();
    }
    const token = source.slice(at).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/)?.[0];
    if (!token) fail(); at += token.length; return JSON.parse(token);
  }
  const data = value(0); space(); if (at !== source.length) fail();
  if (!data || Array.isArray(data) || data.version !== 1 || Object.keys(data).sort().join(',') !== 'replacements,version') fail();
  const entries = data.replacements;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) fail();
  for (const [key, replacement] of Object.entries(entries)) {
    if (!key.length || [...key].length > 160 || typeof replacement !== 'string' || [...replacement].length > 1000) fail();
  }
  return data;
}
export function normalizePreferences(data) {
  const result = { ...DEFAULTS };
  if (!data || data.version !== 1) return result;
  if (['en','yue','both'].includes(data.language)) result.language = data.language;
  for (const key of ['englishTone','cantoneseTone']) if (Number.isInteger(data[key]) && data[key] >= 1 && data[key] <= 5) result[key] = data[key];
  if (typeof data.emojis === 'boolean') result.emojis = data.emojis;
  if (Number.isInteger(data.setupStep) && data.setupStep >= 0 && data.setupStep <= 3) result.setupStep = data.setupStep;
  result.setupComplete = data.setupComplete === true;
  return result;
}
export function localized(key, prefs) {
  const pairs = COPY[key] || [key,key];
  const en = Array.isArray(pairs[0]) ? pairs[prefs.englishTone - 1][0] : pairs[0];
  const yue = Array.isArray(pairs[0]) ? pairs[prefs.cantoneseTone - 1][1] : pairs[1];
  return prefs.language === 'yue' ? yue : prefs.language === 'both' ? `${en}\n${yue}` : en;
}
const replacementTries = new WeakMap();
export function applyWording(text, replacements) {
  // Literal longest-match substitution. A trie avoids executing imported text as regex,
  // avoids engine pattern limits, and prevents replacement cascades.
  let root = replacementTries.get(replacements);
  if (!root) {
    root = { children: new Map() };
    for (const [key,value] of Object.entries(replacements)) {
      let node = root;
      for (let i=0;i<key.length;i++) { const unit=key[i]; if (!node.children.has(unit)) node.children.set(unit,{children:new Map()}); node=node.children.get(unit); }
      node.value=value;
    }
    replacementTries.set(replacements,root);
  }
  if (!root.children.size) return text;
  let output='';
  for (let at=0;at<text.length;) {
    let node=root, end=at, replacement;
    for (let cursor=at;cursor<text.length;cursor++) {
      node=node.children.get(text[cursor]); if (!node) break;
      if (Object.hasOwn(node,'value')) { end=cursor+1; replacement=node.value; }
    }
    if (end>at) { output+=replacement; at=end; } else { output+=text[at]; at++; }
  }
  return output;
}

if (typeof document !== 'undefined') initialize();
function initialize() {
  let prefs = { ...DEFAULTS }, wording = Object.create(null), storageOK = true, wordingLoaded = false, preferencesSaved = false;
  try { const saved = localStorage.getItem(PREFERENCE_KEY); const parsed = JSON.parse(saved); prefs = normalizePreferences(parsed); preferencesSaved = parsed?.version === 1; } catch { /* Defaults remain usable. */ }
  try { const cache = localStorage.getItem(WORDING_KEY); if (cache) { wording = parseWording(cache).replacements; wordingLoaded = true; } } catch { /* Corrupt private cache never renders. */ }
  const isGame = !!document.getElementById('ignite');
  const t = key => localized(key, prefs);
  const make = (tag, text, parent, attrs = {}) => {
    const node = document.createElement(tag); if (text) node.textContent = text;
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
    if (parent) parent.append(node); return node;
  };
  const button = (key, parent, action) => { const b = make('button', t(key), parent, { type:'button', 'data-copy':key }); b.addEventListener('click', action); return b; };
  const keyed = (tag,key,parent,attrs) => make(tag,t(key),parent,{...attrs,'data-copy':key});
  const live = make('p','',document.body,{class:'preference-live',role:'status','aria-live':'polite'});
  const panel = make('dialog','',document.body,{id:'preferences-dialog','aria-labelledby':'preferences-title',class:'preferences'});
  const head = make('div','',panel,{class:'preference-heading'}); keyed('h2','settings',head,{id:'preferences-title'});
  button('close',head,()=>panel.close());
  const queryLabel = keyed('label','search',panel,{for:'preference-search'});
  const query = make('input','',panel,{id:'preference-search',type:'search',autocomplete:'off'});
  keyed('p','commands',panel,{class:'preference-note'}); keyed('p','regexGap',panel,{class:'preference-note'});
  const noResults = keyed('p','emptySearch',panel,{role:'status'}); noResults.hidden = true;
  const fields = make('div','',panel,{class:'preference-fields'});
  const rows = [];
  function row(key) { const item = make('section','',fields,{'data-setting':key}); rows.push(item); return item; }
  const languageRow = row('language'); keyed('label','language',languageRow,{for:'preference-language'});
  const language = make('select','',languageRow,{id:'preference-language'});
  for (const [value,key] of [['en','english'],['yue','cantonese'],['both','both']]) keyed('option',key,language,{value});
  language.value = prefs.language;
  language.addEventListener('change',()=>update('language',language.value));
  const tones = {};
  for (const key of ['englishTone','cantoneseTone']) {
    const item = row(key); keyed('label',key,item,{for:`preference-${key}`});
    const output = make('output',String(prefs[key]),item,{for:`preference-${key}`});
    const input = make('input','',item,{id:`preference-${key}`,type:'range',min:'1',max:'5',step:'1'}); input.value = prefs[key];
    input.addEventListener('input',()=> { output.value = input.value; update(key,Number(input.value)); });
    button('resetTone',item,()=> { input.value = 5; output.value = 5; update(key,5); }); tones[key] = input;
  }
  keyed('p','disclosure',fields,{class:'preference-note'}); const preview = keyed('p','preview',fields,{class:'tone-preview',role:'status'});
  const emojiRow = row('emojis'); const emojiLabel = keyed('label','emojis',emojiRow,{for:'preference-emojis'});
  const emojis = make('input','',emojiRow,{id:'preference-emojis',type:'checkbox'}); emojis.checked = prefs.emojis; emojis.addEventListener('change',()=>update('emojis',emojis.checked));
  const wordingRow = row('wording'); keyed('label','wording',wordingRow,{for:'preference-wording'});
  const upload = make('input','',wordingRow,{id:'preference-wording',type:'file',accept:'.json,application/json','aria-describedby':'wording-status wording-privacy'});
  const wordingStatus = make('p','',wordingRow,{id:'wording-status',role:'status',tabindex:'-1'});
  keyed('p','privacy',wordingRow,{id:'wording-privacy',class:'preference-note'});
  const schema = make('details','',wordingRow); keyed('summary','details',schema); keyed('p','schema',schema);
  button('clear',wordingRow,()=> {
    try { localStorage.removeItem(WORDING_KEY); } catch { storageOK = false; }
    wording = Object.create(null); wordingLoaded = false; upload.value = ''; refresh(); announce(storageOK ? 'noFile' : 'storageError');
  });
  upload.addEventListener('change',()=> { if (upload.files[0]) importFile(upload.files[0]); });
  for (const item of rows) {
    const detail = make('details','',item); keyed('summary','details',detail);
    const key = item.dataset.setting; keyed('p',key === 'language' ? 'languageHelp' : key === 'emojis' ? 'emojiHelp' : key === 'wording' ? 'wordingHelp' : 'toneHelp',detail);
    if (key !== 'wording') make('p','',detail,{'data-provenance':'true'});
  }
  const provenance = make('details','',fields); keyed('summary','details',provenance); keyed('p','defaults',provenance);
  keyed('p','schoolGap',fields,{class:'preference-note'});
  button('reset',fields,()=> { prefs.language = 'en'; prefs.englishTone = 5; prefs.cantoneseTone = 5; prefs.emojis = true; persist(); refresh(); });
  button('setup',fields,()=> { panel.close(); openSetup(); });
  const entry = button('settings',document.querySelector('header nav') || document.querySelector('header') || document.body,()=> { panel.showModal(); query.focus(); });
  entry.className = 'preference-entry';
  document.addEventListener('keydown',event=> { if ((event.ctrlKey || event.metaKey) && event.key === ',') { event.preventDefault(); if (!panel.open) { document.querySelectorAll('dialog[open]').forEach(d=>d.close()); panel.showModal(); } query.focus(); } });
  query.addEventListener('input',filter);
  attachRegexWorkbench(query,{getCandidates:()=>rows.map(item=>item.textContent),onResults:({matches})=>{ rows.forEach((item,index)=> { item.hidden = !matches[index]; }); noResults.hidden = matches.some(Boolean); }});
  function filter() { if (query.dataset.regexEnabled === 'true') { query.dispatchEvent(new Event('regex-refresh')); return; } const term = query.value.toLocaleLowerCase(); let found = 0; for (const item of rows) { item.hidden = !item.textContent.toLocaleLowerCase().includes(term); if (!item.hidden) found++; } noResults.hidden = found > 0; }
  function persist() { try { localStorage.setItem(PREFERENCE_KEY,JSON.stringify(prefs)); storageOK = true; preferencesSaved = true; } catch { storageOK = false; announce('storageError'); } }
  function update(key,value) { prefs[key] = value; persist(); refresh(); }
  function announce(key) { live.textContent = t(key); }
  async function importFile(file) {
    try {
      if (file.size > 262144 || !/\.json$/i.test(file.name)) throw new Error('Invalid wording');
      const bytes = await file.arrayBuffer(); const text = new TextDecoder('utf-8',{fatal:true}).decode(bytes); const parsed = parseWording(text);
      // Persistence must succeed before application, so failed imports cannot partially replace the active cache.
      localStorage.setItem(WORDING_KEY,JSON.stringify(parsed)); wording = parsed.replacements; wordingLoaded = true; refresh(); announce('applied');
      if (isGame) celebrate();
    } catch { wordingStatus.textContent = t('invalid'); announce('invalid'); }
    upload.value = '';
  }
  if (isGame) {
    document.addEventListener('dragover',event=> { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
    document.addEventListener('drop',event=> { if (!event.dataTransfer?.files.length) return; event.preventDefault(); if (event.dataTransfer.files.length !== 1) { announce('invalid'); return; } importFile(event.dataTransfer.files[0]); });
  }
  let celebrationTimer;
  function celebrate() {
    let node = document.getElementById('wording-celebration'); if (!node) node = make('div','',document.body,{id:'wording-celebration',class:'wording-celebration','aria-hidden':'true'});
    node.textContent = wording['private vocabulary'] || t('applied'); node.hidden = false;
    live.textContent = node.textContent; clearTimeout(celebrationTimer); celebrationTimer = setTimeout(()=> { node.hidden = true; },3300);
  }
  // Preserve original UI text so clearing a private cache restores it immediately, without rewriting any data.
  const originals = new WeakMap();
  function translateNode(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script,style,code,pre,textarea,[data-no-translate],.wording-celebration,.preference-live') || !node.nodeValue.trim()) return;
    const previous = originals.get(node); const original = previous && node.nodeValue === previous.rendered ? previous.original : node.nodeValue;
    let translated = original; const clean = original.trim(); const yue = PRODUCT_COPY.get(clean);
    if (yue && !parent.closest('[data-copy]')) translated = original.replace(clean,prefs.language === 'yue' ? yue : prefs.language === 'both' ? `${clean} / ${yue}` : clean);
    translated = applyWording(translated,wording);
    originals.set(node,{original,rendered:translated}); if (node.nodeValue !== translated) node.nodeValue = translated;
  }
  const attrOriginals = new WeakMap();
  function translateTree() {
    const walker = document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let node; while ((node = walker.nextNode())) translateNode(node);
    for (const control of document.querySelectorAll('[aria-label]')) {
      const current = control.getAttribute('aria-label'); const previous = attrOriginals.get(control); const original = previous && current === previous.rendered ? previous.original : current;
      const yue = PRODUCT_COPY.get(original); const localizedLabel = yue ? prefs.language === 'yue' ? yue : prefs.language === 'both' ? `${original} / ${yue}` : original : original;
      const rendered = applyWording(localizedLabel,wording); attrOriginals.set(control,{original,rendered}); if (current !== rendered) control.setAttribute('aria-label',rendered);
    }
  }
  function refresh() {
    observer?.disconnect();
    document.documentElement.lang = prefs.language === 'yue' ? 'zh-Hant-HK' : 'en'; document.documentElement.dataset.language = prefs.language;
    for (const node of document.querySelectorAll('[data-copy]')) node.textContent = t(node.dataset.copy);
    for (const node of document.querySelectorAll('[data-provenance]')) node.textContent = t(preferencesSaved ? 'originSaved' : 'originDefault');
    language.value = prefs.language; emojis.checked = prefs.emojis;
    for (const key of Object.keys(tones)) { tones[key].value = prefs[key]; tones[key].previousElementSibling.value = prefs[key]; }
    wordingStatus.textContent = t(wordingLoaded ? 'loaded' : 'noFile');
    for (const dialog of document.querySelectorAll('dialog')) {
      let decoration = dialog.querySelector('.dialog-decoration');
      if (!decoration) decoration = make('span','✨',dialog,{class:'dialog-decoration','aria-hidden':'true'});
      decoration.hidden = !prefs.emojis;
    }
    translateTree(); filter(); observe();
  }
  let observer;
  const observe = () => observer?.observe(document.body,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['aria-label']});
  observer = new MutationObserver(records=> {
    observer.disconnect();
    for (const record of records) {
      if (record.type === 'characterData') translateNode(record.target);
      else if (record.type === 'attributes') {
        const control = record.target; const original = control.getAttribute('aria-label'); const previous = attrOriginals.get(control);
        if (!previous || original !== previous.rendered) { const rendered = applyWording(original,wording); attrOriginals.set(control,{original,rendered}); if (original !== rendered) control.setAttribute('aria-label',rendered); }
      }
      else if (record.type === 'childList') for (const added of record.addedNodes) {
        if (added.nodeType === Node.TEXT_NODE) translateNode(added);
        else if (added.nodeType === Node.ELEMENT_NODE) { const w = document.createTreeWalker(added,NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) translateNode(n); }
      }
    }
    observe();
  });
  const wizard = make('dialog','',document.body,{id:'setup-dialog',class:'preferences','aria-labelledby':'setup-title'});
  const wizardHeading = keyed('h2','setup',wizard,{id:'setup-title',tabindex:'-1'});
  const progress = make('p','',wizard,{role:'status'}); const content = make('div','',wizard);
  const actions = make('div','',wizard,{class:'preference-actions'});
  const back = button('back',actions,()=>move(-1)); const next = button('next',actions,()=>move(1));
  const skip = button('skip',actions,()=>move(1)); button('later',actions,()=> { persist(); wizard.close(); });
  function move(amount) {
    if (prefs.setupStep === 3 && amount > 0) { prefs.setupComplete = true; persist(); wizard.close(); if (isGame) document.getElementById('ignite').focus(); else location.href = 'index.html'; return; }
    prefs.setupStep = Math.max(0,Math.min(3,prefs.setupStep + amount)); persist(); renderSetup();
  }
  function renderSetup() {
    content.replaceChildren(); const step = prefs.setupStep;
    progress.textContent = `${t('step')} ${step + 1} / 4`; keyed('p',['setupIntro','setupAccess','setupWording','setupReady'][step],content);
    if (step === 0) { const label = keyed('label','language',content,{for:'setup-language'}); const select = language.cloneNode(true); select.id = 'setup-language'; select.value = prefs.language; content.append(select); select.addEventListener('change',()=> { update('language',select.value); renderSetup(); }); keyed('p','disclosure',content); button('settings',content,()=> { wizard.close(); panel.showModal(); language.focus(); }); }
    if (step === 1) for (const [key,id] of [['sound','sound-setting'],['motion','motion-setting']]) {
      const original = document.getElementById(id); if (!original) continue;
      const label = keyed('label',key,content,{for:`setup-${key}`}); const input = make('input','',content,{id:`setup-${key}`,type:'checkbox'}); input.checked = original.checked;
      input.addEventListener('change',()=> { original.checked = input.checked; original.dispatchEvent(new Event('change',{bubbles:true})); });
    }
    if (step === 2) button('wording',content,()=> { wizard.close(); panel.showModal(); upload.focus(); });
    back.disabled = step === 0; skip.hidden = step !== 1 && step !== 2; next.dataset.copy = step === 3 ? 'finish' : 'next'; refresh(); wizardHeading.focus();
  }
  function openSetup() { renderSetup(); wizard.showModal(); wizardHeading.focus(); }
  wizard.addEventListener('cancel',()=>persist());
  window.addEventListener('storage',event=> {
    if (event.key === null) { prefs = {...DEFAULTS}; preferencesSaved = false; wording = Object.create(null); wordingLoaded = false; refresh(); return; }
    if (event.key === PREFERENCE_KEY) { try { const parsed = JSON.parse(event.newValue); prefs = normalizePreferences(parsed); preferencesSaved = parsed?.version === 1; } catch { prefs = {...DEFAULTS}; } refresh(); }
    if (event.key === WORDING_KEY) { try { wording = event.newValue ? parseWording(event.newValue).replacements : Object.create(null); wordingLoaded = !!event.newValue; } catch { wording = Object.create(null); wordingLoaded = false; } refresh(); }
  });
  refresh(); if (isGame && !prefs.setupComplete) openSetup();
}
