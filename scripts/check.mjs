import { readdir, readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set([
  '.git',
  '.openai',
  '.venv',
  'node_modules',
  'vendor',
  'test-results',
  'artifacts',
  'coverage',
]);
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    entries
      .filter((entry) => !ignored.has(entry.name))
      .map(async (entry) => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(file) : [file];
      }),
  );
  return groups.flat();
}
let syntax = 0,
  links = 0;
for (const file of await walk(root)) {
  if (!/\.(?:mjs|cjs|js|html|md)$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  const references = [];
  if (/\.(?:mjs|cjs|js)$/.test(file)) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    syntax++;
    for (const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g))
      references.push(match[1]);
  }
  if (file.endsWith('.html')) {
    for (const match of text.matchAll(/(?:src|href)=["']([^"']+)["']/g)) references.push(match[1]);
  }
  if (file.endsWith('.md')) {
    for (const match of text.matchAll(/\]\(([^\s)]+)\)/g)) references.push(match[1]);
  }
  for (const reference of references) {
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(reference)) continue;
    const target = decodeURIComponent(reference.split(/[?#]/)[0]);
    if (!target) continue;
    try {
      await access(path.resolve(path.dirname(file), target));
      links++;
    } catch {
      throw new Error(`${path.relative(root, file)}: missing local reference ${reference}`);
    }
  }
}
console.log(`Checked ${syntax} JavaScript files and ${links} local references.`);
