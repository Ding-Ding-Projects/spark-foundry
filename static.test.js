import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const pages = ['index.html', 'docs.html'];
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1], m[2]]));
const ids = html => [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]);

test('static pages have unique IDs, language, viewport, title and main landmarks', () => {
  for (const file of pages) {
    const html = read(file), list = ids(html);
    assert.equal(new Set(list).size, list.length, `Duplicate ID in ${file}`);
    assert.match(html, /<html\s+lang="en"/);
    assert.match(html, /name="viewport"/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<main(?:\s|>)/);
  }
});

test('every local HTML anchor resolves to an existing page and fragment', () => {
  for (const file of pages) for (const match of read(file).matchAll(/<a\b[^>]*>/g)) {
    const href = attrs(match[0]).href;
    if (!href || /^(?:https?:|mailto:)/.test(href)) continue;
    let [target, fragment] = href.split('#');
    if (!target) target = file;
    if (target === './') target = 'index.html';
    target = target.replace(/^\.\//, '');
    assert.ok(pages.includes(target), `${file}: unexpected link ${href}`);
    if (fragment) assert.ok(ids(read(target)).includes(fragment), `${file}: missing fragment ${href}`);
  }
});

test('modal dialogs have explicit accessible names and confirmation defaults to cancel', () => {
  const html = read('index.html');
  for (const match of html.matchAll(/<dialog\b[^>]*>/g)) {
    const a = attrs(match[0]);
    assert.ok(a['aria-label'] || a['aria-labelledby'], `Unnamed dialog ${a.id}`);
    if (a['aria-labelledby']) for (const id of a['aria-labelledby'].split(' ')) assert.ok(ids(html).includes(id));
  }
  const app = read('app.js');
  assert.match(app, /\$\('confirm-dialog'\)\.showModal\(\);\s*\$\('confirm-cancel'\)\.focus\(\)/);
  assert.match(app, /\$\('confirm-cancel'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\$\('confirm-dialog'\)\.close\(\)\)/);
});

test('public game uses local assets, motion preference, responsive layout and keyboard focus styles', () => {
  for (const file of pages) {
    const html = read(file);
    assert.doesNotMatch(html, /<(?:script|link)\b[^>]*(?:src|href)=["']https?:/i);
  }
  const css = read('style.css');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:680px\)/);
});

test('phone viewports preserve zoom and reserve safe areas on both pages', () => {
  for (const file of pages) {
    const viewport = attrs(read(file).match(/<meta\b[^>]*name="viewport"[^>]*>/)[0]).content;
    assert.match(viewport, /width=device-width/);
    assert.match(viewport, /viewport-fit=cover/);
    assert.doesNotMatch(viewport, /user-scalable\s*=\s*(?:no|0)|maximum-scale/i);
  }
});

test('phone CSS declares touch targets, flexible content and short-screen dialog scrolling', () => {
  // Source-level guardrails, not a substitute for browser layout / gesture QA.
  const css = read('style.css');
  const phone = css.slice(css.indexOf('/* Phone controls'));
  assert.match(phone, /button,\.topbar a,footer a,\.skip\{min-height:44px;min-width:44px\}/);
  assert.match(phone, /grid-template-columns:34px minmax\(0,1fr\)/);
  assert.match(phone, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(phone, /#ignite\{[^}]*-webkit-touch-callout:none;touch-action:pinch-zoom/);
  assert.match(phone, /max-height:calc\(100dvh[^}]*overflow-y:auto/);
  assert.match(phone, /@media\(max-height:600px\)/);
  assert.match(phone, /env\(safe-area-inset-bottom\)/);
  const guide = read('docs.html');
  assert.match(guide, /header a,nav a,footer a\{min-height:44px/);
  assert.match(guide, /code\{white-space:normal;overflow-wrap:anywhere\}/);
});

test('all literal game element lookups resolve to an HTML element', () => {
  const known = new Set(ids(read('index.html')));
  for (const match of read('app.js').matchAll(/\$\('([^']+)'\)/g)) {
    assert.ok(known.has(match[1]), `Missing game element: ${match[1]}`);
  }
});

test('campaign and optional puzzle controls are present with keyboard-native buttons', () => {
  const html = read('index.html');
  for (const id of ['memory-start','routing-check','launch-beacon','abandon-challenge']) {
    assert.match(html, new RegExp(`<button\\b[^>]*id="${id}"`));
  }
  for (const id of ['memory-status','routing-status','ending-status','challenge-status']) {
    const tag = [...html.matchAll(/<[^/!][^>]*>/g)].map(m=>m[0]).find(tag=>attrs(tag).id===id);
    assert.equal(attrs(tag).role, 'status');
  }
});
