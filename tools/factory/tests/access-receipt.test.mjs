import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assessCiAccessReceipt} from '../access-receipt.mjs';
import {accessReport} from '../../google-development-access/access-report.mjs';

const binding = JSON.parse(readFileSync(new URL('../../google-development-access/binding.json', import.meta.url)));
const names = [
  'Verify granted Drive and Calendar access before live tests',
  'Verify WVD Calendar writer grant without creating events',
  'Verify explicit confirmation key version without writes or mail',
  'Verify authenticated runtime provider startup over HTTP',
  'Check existing delegated send scope without sending a message',
  'Record bounded access evidence for controller handoff',
  'Retain access evidence without credentials or provider data',
];
function fixture() {
  const sourceCommit = 'a'.repeat(40), now = '2026-10-05T15:10:00.000Z';
  const run = {id: 123, run_attempt: 1, status: 'completed', conclusion: 'success',
    repository: {full_name: binding.repository, id: Number(binding.repositoryId), owner: {id: Number(binding.ownerId)}},
    head_repository: {full_name: binding.repository, id: Number(binding.repositoryId)}, head_branch: binding.branch,
    path: binding.workflow, event: 'push', head_sha: sourceCommit,
    run_started_at: '2026-10-05T15:00:00Z', updated_at: '2026-10-05T15:01:00Z'};
  const jobs = {total_count: 1, jobs: [{name: 'access', run_id: 123, run_attempt: 1, head_sha: sourceCommit,
    status: 'completed', conclusion: 'success', started_at: run.run_started_at, completed_at: run.updated_at,
    steps: names.map(name => ({name, status: 'completed', conclusion: 'success'}))}]};
  const receipt = accessReport({GITHUB_SHA: sourceCommit, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1',
    ACCESS_RESOURCE_RESULT: 'success', ACCESS_WRITER_RESULT: 'success', ACCESS_CONFIRMATION_RESULT: 'success',
    ACCESS_RUNTIME_RESULT: 'success', ACCESS_MAIL_RESULT: 'success'}, '2026-10-05T15:00:30.000Z');
  return {receipt, options: {run, jobs, binding, sourceCommit, now}};
}
test('receipt matches exact provider evidence without granting current access or changing input', () => {
  const {receipt, options} = fixture(), before = structuredClone({receipt, options});
  const result = assessCiAccessReceipt(receipt, options);
  assert.equal(result.status, 'RECEIPT_MATCHED'); assert.equal(result.checksPassed, true);
  assert.equal(result.currentlyVerified, false); assert.equal(result.grantsPermission, false);
  assert.deepEqual({receipt, options}, before);
});
test('foreign repositories, forks, owners, workflows, refs and commits cannot supply evidence', () => {
  for (const change of [
    o => o.run.repository.full_name = 'foreign/wvd', o => o.run.repository.id++, o => o.run.repository.owner.id++,
    o => o.run.head_repository.id++, o => o.run.head_branch = 'main', o => o.run.path = '.github/workflows/ci.yml',
    o => o.run.event = 'pull_request', o => o.sourceCommit = 'b'.repeat(40),
    o => o.binding = {...o.binding, serviceAccount: 'foreign@example.invalid'},
  ]) { const {receipt, options} = fixture(); change(options); assert.throws(() => assessCiAccessReceipt(receipt, options)); }
});
test('old attempts and truncated, ambiguous or unfinished jobs and steps are rejected', () => {
  for (const change of [
    o => o.run.run_attempt++, o => o.jobs.jobs[0].run_id++, o => o.jobs.jobs[0].head_sha = 'b'.repeat(40),
    o => o.jobs.total_count++, o => {o.jobs.jobs.push(structuredClone(o.jobs.jobs[0])); o.jobs.total_count++;},
    o => o.jobs.jobs[0].steps.pop(), o => o.jobs.jobs[0].steps.push({...o.jobs.jobs[0].steps[0]}),
    o => o.jobs.jobs[0].steps[0].status = 'in_progress', o => o.run.status = 'in_progress',
    o => o.jobs.jobs[0].steps[6].conclusion = 'failure',
  ]) { const {receipt, options} = fixture(); change(options); assert.throws(() => assessCiAccessReceipt(receipt, options)); }
});
test('receipt cannot promote failed, cancelled or skipped provider steps to PASS', () => {
  for (const [conclusion, status] of [['failure', 'FAIL'], ['cancelled', 'CANCELLED'], ['skipped', 'NOT_CHECKED']]) {
    const {receipt, options} = fixture(); options.jobs.jobs[0].steps[4].conclusion = conclusion;
    options.run.conclusion = 'failure';
    assert.throws(() => assessCiAccessReceipt(receipt, options), /CONTENT_MISMATCH/);
    receipt.results[4].status = status; receipt.allPassed = false;
    const result = assessCiAccessReceipt(receipt, options);
    assert.equal(result.checksPassed, false); assert.equal(result.results[4].status, status);
    assert.equal(result.workflowPassed, false);
  }
});
test('successful access checks never hide an unrelated workflow failure', () => {
  const {receipt, options} = fixture(); options.run.conclusion = 'failure';
  const result = assessCiAccessReceipt(receipt, options);
  assert.equal(result.checksPassed, true); assert.equal(result.workflowPassed, false);
});
test('changed receipt claims, extra fields and invalid timestamps fail closed', () => {
  for (const change of [
    r => r.results[0].capabilities.push('email.read'), r => r.results.reverse(), r => r.results.pop(),
    r => r.source = 'https://example.invalid', r => r.runId = '124', r => r.attempt = '2',
    r => r.principal = 'foreign@example.invalid', r => r.grantsPermission = true,
    r => r.mailSentByTheseChecks = true, r => r.secret = 'do-not-echo',
    r => r.observedAt = '2026-10-05T16:00:00.000Z', r => r.observedAt = '2026-10-05T14:00:00.000Z',
  ]) { const {receipt, options} = fixture(); change(receipt); assert.throws(() => assessCiAccessReceipt(receipt, options)); }
});
test('historical receipts stay usable as history but require refresh', () => {
  const {receipt, options} = fixture(); options.now = '2026-10-06T15:10:00.000Z';
  assert.equal(assessCiAccessReceipt(receipt, options).freshness, 'STALE_RECHECK_REQUIRED');
  options.now = '2026-10-05T15:00:00.000Z';
  assert.throws(() => assessCiAccessReceipt(receipt, options), /TIME_MISMATCH/);
});
test('CLI emits bounded assessment and fails mismatched input without echoing provider data', () => {
  const {receipt, options} = fixture(), directory = mkdtempSync(join(tmpdir(), 'wvd-receipt-'));
  const receiptFile = join(directory, 'receipt.json'), evidenceFile = join(directory, 'evidence.json');
  const cli = new URL('../cli.mjs', import.meta.url);
  try {
    writeFileSync(receiptFile, JSON.stringify(receipt)); writeFileSync(evidenceFile, JSON.stringify(options));
    const output = execFileSync(process.execPath, [cli.pathname, 'access-receipt', receiptFile, evidenceFile], {encoding: 'utf8'});
    assert.equal(JSON.parse(output).status, 'RECEIPT_MATCHED');
    receipt.secret = 'do-not-echo'; writeFileSync(receiptFile, JSON.stringify(receipt));
    const result = spawnSync(process.execPath, [cli.pathname, 'access-receipt', receiptFile, evidenceFile], {encoding: 'utf8'});
    assert.equal(result.status, 1); assert.equal((result.stdout + result.stderr).includes('do-not-echo'), false);
    writeFileSync(receiptFile, '{"secret":"do-not-echo" invalid');
    const malformed = spawnSync(process.execPath, [cli.pathname, 'access-receipt', receiptFile, evidenceFile], {encoding: 'utf8'});
    assert.equal(malformed.status, 1); assert.equal(malformed.stderr.trim(), 'INVALID_ACCESS_RECEIPT_INPUT');
  } finally {rmSync(directory, {recursive: true, force: true});}
});
