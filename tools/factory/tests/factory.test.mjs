import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {run, validate, safePath, preflight} from '../factory.mjs';
const hash = s => createHash('sha256').update(s).digest('hex');
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'wvd-factory-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  await writeFile(join(root, 'source.txt'), 'approved source');
  const manifest = {schemaVersion: 1, projectId: 'product-one', sources: [{id: 'skill', revision: 'v2', path: 'source.txt', sha256: hash('approved source')}], tasks: [{id: 'context', adapter: 'assemble-context', dependencies: [], sourceIds: ['skill'], blockers: [], maxBytes: 10000}]};
  return {root, manifest, state: join(root, 'state')};
}
test('runtime preflight verifies actual filesystem access', async t => {const f = await fixture(t); assert.equal((await preflight(f.root)).fileWriteRead, 'PASS');});
test('assembles version-bound sources, never awards DONE', async t => {
  const f = await fixture(t), receipt = await run(f.manifest, f.root, f.state);
  assert.equal(receipt.tasks.context.status, 'PREPARED');
  const packet = JSON.parse(await readFile(receipt.tasks.context.output, 'utf8'));
  assert.equal(packet.sources[0].content, 'approved source');
  assert.equal(packet.sources[0].revision, 'v2');
  assert.equal(receipt.verification, 'NOT_INDEPENDENTLY_VERIFIED');
});
test('rerun reuses unchanged output including downstream dependency', async t => {
  const f = await fixture(t); f.manifest.tasks.push({...f.manifest.tasks[0], id: 'next', dependencies: ['context']});
  await run(f.manifest, f.root, f.state);
  const receipt = await run(f.manifest, f.root, f.state);
  assert.equal(receipt.tasks.context.reused, true); assert.equal(receipt.tasks.next.reused, true);
});
test('source drift blocks affected task and dependent work', async t => {
  const f = await fixture(t); f.manifest.tasks.push({...f.manifest.tasks[0], id: 'next', dependencies: ['context']});
  await writeFile(join(f.root, 'source.txt'), 'unapproved change');
  const receipt = await run(f.manifest, f.root, f.state);
  assert.equal(receipt.tasks.context.status, 'NOT_READY'); assert.equal(receipt.tasks.next.status, 'BLOCKED');
});
test('blocked task does not prevent independent task', async t => {
  const f = await fixture(t); f.manifest.tasks.push({...f.manifest.tasks[0], id: 'independent'}); f.manifest.tasks[0].blockers = ['calendar connection'];
  const receipt = await run(f.manifest, f.root, f.state);
  assert.equal(receipt.tasks.context.status, 'BLOCKED'); assert.equal(receipt.tasks.independent.status, 'PREPARED');
});
test('rejects dependency cycles and missing dependencies', async t => {
  const f = await fixture(t); f.manifest.tasks[0].dependencies = ['context']; assert.throws(() => validate(f.manifest), /cycle/);
  f.manifest.tasks[0].dependencies = ['missing']; assert.throws(() => validate(f.manifest), /Unknown dependency/);
});
test('rejects duplicate task IDs and unknown sources', async t => {
  const f = await fixture(t); f.manifest.tasks.push(f.manifest.tasks[0]); assert.throws(() => validate(f.manifest), /Invalid task/);
  f.manifest.tasks.pop(); f.manifest.tasks[0].sourceIds = ['missing']; assert.throws(() => validate(f.manifest), /Unknown source/);
});
test('context budget is enforced without silent truncation', async t => {
  const f = await fixture(t); f.manifest.tasks[0].maxBytes = 2;
  assert.equal((await run(f.manifest, f.root, f.state)).tasks.context.status, 'NOT_READY');
});
test('rejects traversal, absolute paths and escaping symlinks', async t => {
  const f = await fixture(t); assert.throws(() => safePath(f.root, '../private')); assert.throws(() => safePath(f.root, '/private'));
  await symlink('/etc/hostname', join(f.root, 'external')); f.manifest.sources[0].path = 'external';
  assert.match((await run(f.manifest, f.root, f.state)).tasks.context.reasons[0], /symlink escapes/);
});
test('tampered output is recreated rather than reused', async t => {
  const f = await fixture(t), first = await run(f.manifest, f.root, f.state);
  await writeFile(first.tasks.context.output, 'tampered');
  assert.equal((await run(f.manifest, f.root, f.state)).tasks.context.reused, false);
});
test('new source revision invalidates affected contexts', async t => {
  const f = await fixture(t); await run(f.manifest, f.root, f.state);
  f.manifest.sources[0].revision = 'v3';
  assert.equal((await run(f.manifest, f.root, f.state)).tasks.context.reused, false);
});
test('concurrent runner refuses an existing lock', async t => {
  const f = await fixture(t); await run(f.manifest, f.root, f.state);
  await writeFile(join(f.state, f.manifest.projectId, 'run.lock'), 'other');
  await assert.rejects(run(f.manifest, f.root, f.state), {code: 'EEXIST'});
});
