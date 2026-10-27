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
