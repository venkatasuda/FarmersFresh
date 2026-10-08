import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const project = 'bjevoybwufubtprkxbvb';
const bucket = `farmersfresh-backups-${project}`;
const mode = process.argv[2];
assert(['--init-demo', '--backup-demo', '--verify-demo', '--self-test'].includes(mode), 'Use --init-demo, --backup-demo, --verify-demo <snapshot>, or --self-test.');
const selfTest = mode === '--self-test';
const directory = resolve('reports', `encrypted-backup-${Date.now()}-${randomBytes(4).toString('hex')}`);
mkdirSync(directory, { recursive: true, mode: 0o700 });
if (process.platform === 'win32') {
  assert(process.env.USERDOMAIN && process.env.USERNAME, 'Windows account identity unavailable.');
  command('icacls', [directory, '/inheritance:r', '/grant:r', `${process.env.USERDOMAIN}\\${process.env.USERNAME}:(OI)(CI)F`]);
}
const config = selfTest ? {} : JSON.parse(readFileSync('ops/backup/secrets/config.json', 'utf8').replace(/^\uFEFF/, ''));
const restic = process.env.RESTIC_BIN || config.resticBin || resolve('ops/backup/tools/restic.exe');
const repository = selfTest ? join(directory, 'repository') : config.repository;
if (!selfTest) assert.equal(repository, `s3:https://s3.us-east-005.backblazeb2.com/${bucket}/restic`, 'Only the approved private demo bucket and prefix are allowed.');
const passwordFile = selfTest ? join(directory, 'password.txt') : resolve('ops/backup/secrets/password.txt');
if (selfTest) writeFileSync(passwordFile, randomBytes(32).toString('base64url'), { mode: 0o600 });
assert(readFileSync(passwordFile, 'utf8').trim().length >= 32, 'Use a separately retained random encryption password of at least 32 characters.');
const env = { ...process.env, RESTIC_REPOSITORY: repository, RESTIC_PASSWORD_FILE: passwordFile,
  AWS_ACCESS_KEY_ID: config.keyId || '', AWS_SECRET_ACCESS_KEY: config.applicationKey || '' };
if (!selfTest) assert(config.keyId && config.applicationKey, 'Restricted B2 credentials missing.');

function command(binary, args, commandEnv = process.env, cwd = process.cwd()) {
  try { return execFileSync(binary, args, { cwd, encoding: 'utf8', env: commandEnv, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16_000_000 }); }
  catch {
    // CLI diagnostics may contain credentials or exported records; never print them.
    throw new Error(`Backup command failed: ${args[0]}. No success was recorded.`);
  }
}
const run = args => command(restic, args, env);
if (mode === '--init-demo') {
  run(['init']); // Refuses to overwrite an existing repository.
  console.log('Encrypted demo repository initialized. No database export has run yet.');
  process.exit(0);
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function files(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    assert(!entry.isSymbolicLink(), 'Backup files must not be symlinks.');
    const path = join(root, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
function verify(root) {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.project, project);
  const expected = new Set(manifest.files.map(file => file.path));
  assert.equal(expected.size, manifest.files.length, 'Duplicate manifest paths.');
  assert.deepEqual(files(root).map(path => relative(root, path).replaceAll('\\', '/')).filter(path => path !== 'manifest.json').sort(), [...expected].sort(), 'Restored file inventory differs.');
  for (const file of manifest.files) {
    const bytes = readFileSync(join(root, file.path));
    assert.equal(bytes.length, file.bytes, 'Restored byte count differs.');
    assert.equal(digest(bytes), file.sha256, 'Restored file hash differs.');
  }
  return manifest;
}

const payload = join(directory, 'payload');
let snapshot;
if (mode === '--verify-demo') {
  snapshot = process.argv[3];
  assert.match(snapshot || '', /^[a-f0-9]{64}$/, 'Use an exact snapshot ID, not latest.');
} else {
  mkdirSync(payload, { mode: 0o700 });
  let objects = 0;
  if (selfTest) {
    writeFileSync(join(payload, 'data.sql'), 'COPY demo FROM stdin;\nverified\n\\.\n');
    writeFileSync(join(payload, 'image.bin'), randomBytes(1024));
    run(['init']);
  } else {
    const supabase = config.supabaseBin || process.env.SUPABASE_BIN || 'supabase';
    const dumpArgs = ['db', 'dump', '--project-ref', project, '--file'];
    command(supabase, [...dumpArgs, join(payload, 'schema.sql'), '--schema', 'public']);
    command(supabase, [...dumpArgs, join(payload, 'data.sql'), '--data-only', '--use-copy', '--schema', 'public,auth,storage']);
    // The managed Storage schema is not in schema.sql; its application RLS
    // policies must travel with the object inventory and bucket records.
    const policies = JSON.parse(command(supabase, ['db', 'query', '--linked', '--project-ref', project, '--output-format', 'json', `
      set search_path='';
      select coalesce(string_agg(format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
        policyname,schemaname,tablename,permissive,cmd,
        (select string_agg(case when r='public' then 'PUBLIC' else quote_ident(r) end,',') from unnest(roles) r),
        case when qual is null then '' else ' USING ('||qual||')' end,
        case when with_check is null then '' else ' WITH CHECK ('||with_check||')' end),E'\\n' order by policyname),'') as sql
      from pg_policies where schemaname='storage';
    `]));
    assert.equal(typeof policies.rows?.[0]?.sql, 'string', 'Storage policy export failed.');
    writeFileSync(join(payload, 'storage-policies.sql'), policies.rows[0].sql);
    const exportedData = readFileSync(join(payload, 'data.sql'), 'utf8');
    assert(exportedData.includes('COPY "public"."orders"'), 'Demo order records missing from export.');
    const storageCopy = exportedData.match(/^COPY "storage"\."objects" \([^\n]+\) FROM stdin;\r?\n([\s\S]*?)^\\\.\r?$/m);
    assert(storageCopy, 'Storage metadata missing from database export.');
    const expectedObjects = storageCopy[1].trim() ? storageCopy[1].trimEnd().split('\n').length : 0;
    const keyResult = JSON.parse(command(supabase, ['projects', 'api-keys', '--project-ref', project, '--output', 'json']));
    const secret = keyResult.find(key => key.name === 'service_role')?.api_key;
    assert(secret, 'Demo Storage backup credentials unavailable.');
    const source = createClient(`https://${project}.supabase.co`, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const check = (result, label) => { assert(!result.error, `${label} failed; backup aborted.`); return result.data; };
    const buckets = check(await source.storage.listBuckets(), 'Bucket inventory');
    const objectInventory = [];
    mkdirSync(join(payload, 'objects'));
    // ponytail: serial downloads and a 500 MiB ceiling fit the demo; stream larger libraries.
    let totalBytes = 0, folders = 0;
    async function download(bucketId, prefix = '') {
      assert(++folders <= 5000 && prefix.split('/').length <= 64, 'Demo directory ceiling exceeded.');
      for (let offset = 0; ; offset += 100) {
        const entries = check(await source.storage.from(bucketId).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }), 'Object inventory');
        for (const entry of entries) {
          const name = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (!entry.id) { await download(bucketId, name); continue; }
          assert(++objects <= 5000, 'Demo object-count ceiling exceeded.');
          totalBytes += Number(entry.metadata?.size || 0);
          assert(totalBytes <= 500 * 1024 * 1024, 'Demo backup size ceiling exceeded.');
          const blob = check(await source.storage.from(bucketId).download(name), 'Object download');
          const bytes = Buffer.from(await blob.arrayBuffer());
          assert.equal(bytes.length, Number(entry.metadata?.size), 'Object changed during backup.');
          const path = `objects/${digest(Buffer.from(JSON.stringify([bucketId, name])))}`;
          writeFileSync(join(payload, path), bytes);
          objectInventory.push({ bucket: bucketId, name, path, sha256: digest(bytes), contentType: blob.type });
        }
        if (entries.length < 100) break;
      }
    }
    for (const item of buckets) await download(item.id);
    assert.equal(objects, expectedObjects, 'Storage inventory changed after database export; retry when uploads are paused.');
    writeFileSync(join(payload, 'storage.json'), JSON.stringify({ buckets, objects: objectInventory }, null, 2));
    // A missing repository must be explicitly initialized; authentication failures must not create one.
    run(['snapshots', '--json']);
  }
  const manifest = { project, createdAt: new Date().toISOString(), storageObjects: objects, files: files(payload).map(path => {
    const bytes = readFileSync(path);
    return { path: relative(payload, path).replaceAll('\\', '/'), bytes: bytes.length, sha256: digest(bytes) };
  }) };
  assert(manifest.files.reduce((sum, file) => sum + file.bytes, 0) <= 500 * 1024 * 1024, 'Demo backup size ceiling exceeded.');
  writeFileSync(join(payload, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const events = command(restic, ['backup', '.', '--json', '--tag', `farmersfresh-demo-${project}`, '--host', 'farmersfresh-demo'], env, payload);
  // restic must back up only the payload, not the project or its secrets.
  snapshot = events.trim().split('\n').map(line => JSON.parse(line)).find(event => event.message_type === 'summary')?.snapshot_id;
  assert.match(snapshot || '', /^[a-f0-9]{64}$/, 'Backup snapshot was not confirmed.');
}
run(['check', '--read-data']);
const restored = join(directory, 'downloaded');
run(['restore', snapshot, '--target', restored]);
const roots = files(restored).filter(path => path.endsWith('manifest.json'));
assert.equal(roots.length, 1, 'Expected exactly one restored backup manifest.');
const restoredRoot = resolve(roots[0], '..');
const manifest = verify(restoredRoot);
if (selfTest) {
  writeFileSync(join(restoredRoot, 'image.bin'), 'changed');
  assert.throws(() => verify(restoredRoot));
  const wrongPassword = join(directory, 'wrong-password.txt');
  writeFileSync(wrongPassword, randomBytes(32).toString('base64url'), { mode: 0o600 });
  assert.throws(() => command(restic, ['snapshots', '--json'], { ...env, RESTIC_PASSWORD_FILE: wrongPassword }));
}
const report = { passed: true, demoOnly: true, selfTest, snapshot, project,
  filesVerified: manifest.files.length, storageObjects: manifest.storageObjects,
  bytesVerified: manifest.files.reduce((sum, file) => sum + file.bytes, 0), finishedAt: new Date().toISOString(),
  databaseRestored: false, platformSecretsIncluded: false };
writeFileSync(join(directory, 'verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
