import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Approved October 6, 2026: demo only; remove when an upstream patch is available.
const expiry = Date.parse('2026-10-13T00:00:00Z');
const advisory = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const chain = {
  'eslint-config-next': ['16.3.8', '@next/eslint-plugin-next'],
  '@next/eslint-plugin-next': ['16.3.8', 'fast-glob'],
  'fast-glob': ['3.3.1', 'micromatch'],
  micromatch: ['4.0.8', 'braces'],
  braces: ['3.0.3', advisory],
};

function check(report, runtime, lock, target, now = Date.now()) {
  for (const audit of [report, runtime]) {
    assert.equal(audit.auditReportVersion, 2, 'Invalid audit response');
    assert.ok(audit.vulnerabilities && audit.metadata?.vulnerabilities, 'Incomplete audit');
    assert.ok(!audit.error, 'Audit service failed');
  }
  assert.equal(runtime.metadata.vulnerabilities.total, 0, 'Runtime dependencies must be clean');
  const blocked = Object.values(report.vulnerabilities).filter(v => ['high', 'critical'].includes(v.severity));
  if (!blocked.length) return false;
  assert.equal(target, 'https://farmersfresh.vercel.app', 'Exception is restricted to the approved demo');
  assert.ok(now < expiry, 'Demo exception expired on October 13, 2026');
  for (const [name, [version]] of Object.entries(chain)) {
    const dependency = lock.packages[`node_modules/${name}`];
    assert.equal(dependency?.version, version, `Changed dependency: ${name}`);
    assert.equal(dependency.dev, true, `Runtime exposure: ${name}`);
  }
  for (const finding of blocked) {
    assert.ok(Object.hasOwn(chain, finding.name), `Unapproved finding: ${finding.name}`);
    assert.equal(finding.severity, 'high', 'Critical findings are never exempt');
    assert.deepEqual(finding.nodes, [`node_modules/${finding.name}`], 'Changed dependency exposure');
    assert.deepEqual(finding.via.map(v => typeof v === 'string' ? v : v.url), [chain[finding.name][1]], 'Unapproved advisory');
  }
  return true;
}

if (process.argv.includes('--self-test')) {
  const vulnerabilities = Object.fromEntries(Object.entries(chain).map(([name, [, via]]) => [name, {
    name, severity: 'high', nodes: [`node_modules/${name}`], via: [name === 'braces' ? { url: via } : via],
  }]));
  const report = { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: { total: 5 } } };
  const runtime = { ...report, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } };
  const lock = { packages: Object.fromEntries(Object.entries(chain).map(([name, [version]]) => [`node_modules/${name}`, { version, dev: true }])) };
  const run = (r = report, rt = runtime, l = lock, target = 'https://farmersfresh.vercel.app', now = expiry - 1) => check(r, rt, l, target, now);
  assert.equal(run(), true);
  assert.equal(run(runtime), false);
  assert.throws(() => run(report, runtime, lock, 'https://real.example'));
  assert.throws(() => run(report, runtime, lock, undefined, expiry));
  assert.throws(() => run(report, report));
  for (const mutate of [
    r => { r.vulnerabilities.braces.via.push({ url: 'https://other-advisory' }); },
    r => { r.vulnerabilities.braces.severity = 'critical'; },
    r => { r.vulnerabilities.braces.nodes.push('node_modules/other/braces'); },
    r => { r.vulnerabilities.unknown = { name: 'unknown', severity: 'high' }; },
    r => { delete r.metadata; },
  ]) {
    const changed = structuredClone(report);
    mutate(changed);
    assert.throws(() => run(changed));
  }
  for (const change of [{ dev: false }, { version: '3.0.4' }]) {
    const changed = structuredClone(lock);
    Object.assign(changed.packages['node_modules/braces'], change);
    assert.throws(() => run(report, runtime, changed));
  }
  console.log('Dependency gate rejection checks passed.');
} else {
  function audit(args, path) {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, 'audit', '--json', ...args], { encoding: 'utf8' });
    writeFileSync(path, result.stdout || '');
    assert.ok(!result.error && [0, 1].includes(result.status), 'npm audit failed to execute');
    return JSON.parse(result.stdout);
  }
  const report = audit([], 'dependency-audit.json');
  const runtime = audit(['--omit=dev'], 'runtime-dependency-audit.json');
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const excepted = check(report, runtime, lock, process.env.FARMERSFRESH_RELEASE_TARGET);
  if (excepted) {
    const proof = spawnSync(process.execPath, [fileURLToPath(new URL('./verify-lint-exposure.mjs', import.meta.url))], { stdio: 'inherit' });
    assert.equal(proof.status, 0, 'Lint vulnerability exposure check failed');
    console.log(`Approved demo-only exception: ${advisory}; expires 2026-10-13T00:00:00Z.`);
  } else console.log('No high or critical dependency vulnerabilities.');
}
