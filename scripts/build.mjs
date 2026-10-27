import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Only these public assets may enter the deployable output.
const files = ['index.html', 'style.css', 'app.js', 'engine.js', 'docs.html', 'docs.js', 'preview.html'];
for (const file of files) {
  const path = resolve(root, file);
  if (!(await stat(path)).isFile()) throw new Error(`Missing public asset: ${file}`);
  const content = await readFile(path, 'utf8');
  if (!content.trim()) throw new Error(`Empty public asset: ${file}`);
  if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  if (file.endsWith('.html')) {
    for (const match of content.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
      const target = match[1].split(/[?#]/)[0];
      if (!target || /^(?:https?:|data:|mailto:)/.test(target)) continue;
      const normalized = target === './' ? 'index.html' : target.replace(/^\.\//, '');
      if (!files.includes(normalized)) throw new Error(`Unlisted asset ${target} in ${file}`);
    }
  }
}
const output = resolve(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of files) await cp(resolve(root, file), resolve(output, file));
console.log(`Built ${files.length} validated public assets in dist/.`);
