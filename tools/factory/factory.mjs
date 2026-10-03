import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile, rename, unlink, realpath} from 'node:fs/promises';
import {resolve, relative, isAbsolute, join} from 'node:path';
import {developmentStandard,standardHash,projectPlan} from './standard.mjs';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const identifier = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const validId = value => typeof value === 'string' && identifier.test(value);
export function validate(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || !validId(manifest.projectId)) throw Error('Invalid manifest/project ID');
  if (!Array.isArray(manifest.tasks) || !Array.isArray(manifest.sources)) throw Error('Tasks and sources required');
  if (manifest.productConfig !== undefined) {
    const plan=projectPlan(manifest.productConfig);
    if(plan.productId!==manifest.projectId)throw Error('Product/project binding mismatch');
  }
  const sources = new Set();
  for (const source of manifest.sources) {
    if (!validId(source.id) || sources.has(source.id) || !source.revision || !source.path || !/^[a-f0-9]{64}$/.test(source.sha256)) throw Error('Invalid source binding');
    sources.add(source.id);
  }
  const tasks = new Map();
  for (const task of manifest.tasks) {
    if (!validId(task.id) || tasks.has(task.id) || task.adapter !== 'assemble-context' || !Array.isArray(task.dependencies) || !Array.isArray(task.sourceIds) || !task.sourceIds.length || !Number.isSafeInteger(task.maxBytes) || task.maxBytes < 1 || !Array.isArray(task.blockers)) throw Error('Invalid task');
    if (task.sourceIds.some(id => !sources.has(id))) throw Error('Unknown source');
    tasks.set(task.id, task);
  }
  const visited = new Set(), active = new Set();
  function visit(id) {
    if (!tasks.has(id)) throw Error('Unknown dependency');
    if (active.has(id)) throw Error('Dependency cycle');
    if (visited.has(id)) return;
    active.add(id); tasks.get(id).dependencies.forEach(visit); active.delete(id); visited.add(id);
  }
  for (const id of tasks.keys()) visit(id);
  return manifest;
}
export function safePath(root, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path)) throw Error('Relative path required');
  const result = resolve(root, path), rel = relative(resolve(root), result);
  if (rel === '..' || rel.startsWith('../') || rel.startsWith('..\\')) throw Error('Path escapes workspace');
  return result;
}
export async function preflight(root) {
  if (Number(process.versions.node.split('.')[0]) < 20) throw Error('Node 20+ required');
  await mkdir(root, {recursive: true});
  const probe = join(root, `.probe-${process.pid}-${Date.now()}`);
  try { await writeFile(probe, 'runtime-ok', {flag: 'wx'}); if (await readFile(probe, 'utf8') !== 'runtime-ok') throw Error('Readback failed'); }
  finally { await unlink(probe).catch(() => {}); }
  return {commandExecution: 'PASS', fileWriteRead: 'PASS', node: process.versions.node, platform: process.platform};
}
async function atomic(path, value) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', {mode: 0o600});
  await rename(temporary, path);
}
export async function run(manifest, workspace, stateRoot) {
  validate(manifest);
  const developmentProfile={standard:developmentStandard(),standardHash,
    productPlan:manifest.productConfig===undefined?null:projectPlan(manifest.productConfig)};
  const directory = join(stateRoot, manifest.projectId);
  await mkdir(directory, {recursive: true, mode: 0o700});
  const lock = join(directory, 'run.lock');
  await writeFile(lock, String(process.pid), {flag: 'wx', mode: 0o600});
  try {
    const health = await preflight(directory);
    const statePath = join(directory, 'state.json');
    let state;
    try { state = JSON.parse(await readFile(statePath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; state = {schemaVersion: 1, projectId: manifest.projectId, tasks: {}}; }
    if (state.projectId !== manifest.projectId || state.schemaVersion !== 1) throw Error('Invalid saved state');
    const receipts = {};
    const bindings = new Map(manifest.sources.map(source => [source.id, source]));
    const pending = new Set(manifest.tasks.map(task => task.id));
    while (pending.size) {
      const task = manifest.tasks.find(t => pending.has(t.id) && t.dependencies.every(id => !pending.has(id)));
      if (!task) throw Error('Cannot resolve dependencies');
      pending.delete(task.id);
      const binding = digest({developmentProfile,task, sources: task.sourceIds.map(id => bindings.get(id)), dependencies: task.dependencies.map(id => ({binding: receipts[id].binding, status: receipts[id].status, outputHash: receipts[id].outputHash}))});
      const blocked = [...task.blockers, ...task.dependencies.filter(id => receipts[id].status !== 'PREPARED').map(id => `dependency:${id}`)];
      if (blocked.length) receipts[task.id] = {binding, status: 'BLOCKED', reasons: blocked};
      else {
        try {
          const packet = [];
          for (const id of task.sourceIds) {
            const source = bindings.get(id);
            const sourcePath = await realpath(safePath(workspace, source.path));
            const rootPath = await realpath(workspace);
            const rel = relative(rootPath, sourcePath);
            if (rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) throw Error('Source symlink escapes workspace');
            const content = await readFile(sourcePath, 'utf8');
            if (createHash('sha256').update(content).digest('hex') !== source.sha256) throw Error(`Source changed:${id}`);
            packet.push({id, revision: source.revision, sha256: source.sha256, content});
          }
          const result = {projectId: manifest.projectId, taskId: task.id, binding, developmentProfile, sources: packet};
          const encoded = JSON.stringify(result, null, 2) + '\n';
          if (Buffer.byteLength(encoded) > task.maxBytes) throw Error('Context budget exceeded; select a smaller source slice');
          const output = join(directory, `${task.id}.context.json`);
          const hash = createHash('sha256').update(encoded).digest('hex');
          const previous = state.tasks[task.id];
          let reused = false;
          if (previous?.binding === binding && previous.outputHash === hash) {
            try { reused = createHash('sha256').update(await readFile(output)).digest('hex') === hash; } catch {}
          }
          if (!reused) { await writeFile(output + '.tmp', encoded, {mode: 0o600}); await rename(output + '.tmp', output); }
          receipts[task.id] = {binding, status: 'PREPARED', outputHash: hash, output, reused};
        } catch (error) { receipts[task.id] = {binding, status: 'NOT_READY', reasons: [error.message]}; }
      }
      state.tasks[task.id] = receipts[task.id];
      await atomic(statePath, state);
    }
    return {projectId: manifest.projectId, health, tasks: receipts, verification: 'NOT_INDEPENDENTLY_VERIFIED', externalSpend: 0};
  } finally { await unlink(lock); }
}
