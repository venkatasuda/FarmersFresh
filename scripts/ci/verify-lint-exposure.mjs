import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import glob from 'fast-glob';

let globCalls = 0;
glob.globSync = () => { globCalls++; throw new Error('Vulnerable lint globbing path was invoked.'); };
const { ESLint } = await import('eslint');
const eslint = new ESLint();
const results = await eslint.lintFiles(['src', 'tests', 'scripts', 'eslint.config.mjs']);
assert.equal(globCalls, 0);
assert.equal(results.reduce((n, result) => n + result.errorCount + result.warningCount, 0), 0, 'Lint failed');
for (const result of results) {
  const config = await eslint.calculateConfigForFile(result.filePath);
  assert.equal(config.settings?.next?.rootDir, undefined, 'Root-directory glob configuration changed');
}
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
assert.equal(lock.packages['node_modules/braces'].dev, true);
const proof = { filesLinted: results.length, rootDirGlobSettings: 0, vulnerableGlobCalls: globCalls, bracesDevelopmentOnly: true };
mkdirSync('reports', { recursive: true });
writeFileSync('reports/lint-exposure.json', JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof));
