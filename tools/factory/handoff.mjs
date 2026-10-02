import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
// Identity/authentication is supplied by the trusted operator or future provider
// adapter. This module checks binding, not authenticity of a submitted identity.
export function assess(work, review, outputBytes) {
  const errors = [];
  if (!work || !review || !Buffer.isBuffer(outputBytes)) return {status: 'HOLD', reasons: ['Missing work, review or output bytes']};
  if (!nonempty(work.projectId) || !nonempty(work.taskId) || !nonempty(work.creatorId) || !nonempty(work.contextHash) || !Array.isArray(work.acceptance) || !work.acceptance.length || work.acceptance.some(id => !nonempty(id)) || new Set(work.acceptance).size !== work.acceptance.length) errors.push('Invalid work contract');
  for (const key of ['projectId', 'taskId', 'contextHash']) if (review[key] !== work[key]) errors.push(`Review binding mismatch:${key}`);
  const outputHash = sha(outputBytes);
  if (work.outputHash !== outputHash || review.outputHash !== outputHash) errors.push('Review/output version mismatch');
  if (!nonempty(review.reviewerId) || review.reviewerId === work.creatorId) errors.push('Independent reviewer required');
  if (review.verdict !== 'VERIFIED') errors.push('Review has not verified output');
  if (!Array.isArray(review.criteria)) errors.push('Criterion evidence missing');
  else {
    const expected = work.acceptance || [];
    const actual = review.criteria.map(item => item.id);
    if (actual.length !== expected.length || new Set(actual).size !== actual.length || actual.some(id => !expected.includes(id))) errors.push('Criterion set mismatch');
    for (const item of review.criteria) if (item.passed !== true || !nonempty(item.evidence)) errors.push(`Criterion failed or evidence missing:${item.id}`);
  }
  if (!Array.isArray(review.limitations)) errors.push('Explicit limitations required');
  if (!Array.isArray(review.blockers) || review.blockers.length) errors.push('Unresolved review blockers');
  return {status: errors.length ? 'HOLD' : 'VERIFIED', reasons: errors, outputHash};
}
export async function createHandoff(contextPath, task, directory) {
  if (!task || !nonempty(task.creatorId) || !nonempty(task.reviewerId) || task.creatorId === task.reviewerId || !nonempty(task.objective) || !Array.isArray(task.acceptance) || !task.acceptance.length || task.acceptance.some(id => !nonempty(id)) || new Set(task.acceptance).size !== task.acceptance.length) throw Error('Incomplete worker/verifier task');
  const bytes = await readFile(contextPath), context = JSON.parse(bytes);
  if (context.projectId !== task.projectId || context.taskId !== task.taskId) throw Error('Context task mismatch');
  await mkdir(directory, {recursive: true, mode: 0o700});
  const contract = {...task, contextHash: sha(bytes), status: 'READY_FOR_WORKER', provider: 'NOT_CONNECTED'};
  const path = join(directory, 'handoff.json');
  // Refuse overwriting a handoff: a changed task is a new version/directory.
  await writeFile(path, JSON.stringify({contract, context}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  return {path, contract};
}
