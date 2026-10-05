import {isDeepStrictEqual} from 'node:util';
import {accessReport} from '../google-development-access/access-report.mjs';

// Version-one WVD receipt adapter. Names are pinned to the producing workflow;
// a renamed/removed step requires review instead of silently accepting a receipt.
const checks = {
  ACCESS_RESOURCE_RESULT: 'Verify granted Drive and Calendar access before live tests',
  ACCESS_WRITER_RESULT: 'Verify WVD Calendar writer grant without creating events',
  ACCESS_CONFIRMATION_RESULT: 'Verify explicit confirmation key version without writes or mail',
  ACCESS_RUNTIME_RESULT: 'Verify authenticated runtime provider startup over HTTP',
  ACCESS_MAIL_RESULT: 'Check existing delegated send scope without sending a message',
};
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const id = value => /^(?:[1-9]\d*)$/.test(String(value));
const deny = reason => { throw Error(reason); };
const conclusions = ['success', 'failure', 'cancelled', 'timed_out', 'action_required', 'neutral', 'skipped', 'startup_failure', 'stale'];

// The caller must retrieve run/jobs from the authenticated GitHub connection and
// the receipt from that run's artifact. JSON consistency is not authentication.
// Never mutates the registry or promotes CI checks to controller/service grants.
export function assessCiAccessReceipt(receipt, {run, jobs, binding, sourceCommit, now, maxAgeMs = 3600000} = {}) {
  if (!timestamp(now) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > 86400000 ||
      !/^[a-f0-9]{40}$/.test(sourceCommit ?? '') || !binding ||
      !['repository', 'repositoryId', 'ownerId', 'branch', 'workflow', 'serviceAccount'].every(key => typeof binding[key] === 'string' && binding[key].length)) deny('INVALID_RECEIPT_ASSESSMENT');
  if (!run || !id(run.id) || !id(run.run_attempt) || run.status !== 'completed' ||
      !conclusions.includes(run.conclusion) ||
      run.repository?.full_name !== binding.repository || String(run.repository?.id) !== binding.repositoryId ||
      String(run.repository?.owner?.id) !== binding.ownerId || run.head_repository?.full_name !== binding.repository ||
      String(run.head_repository?.id) !== binding.repositoryId || run.head_branch !== binding.branch ||
      run.path !== binding.workflow || !['push', 'workflow_dispatch'].includes(run.event) || run.head_sha !== sourceCommit ||
      !timestamp(run.run_started_at) || !timestamp(run.updated_at)) deny('ACCESS_RECEIPT_RUN_MISMATCH');
  if (!jobs || !Array.isArray(jobs.jobs) || jobs.jobs.length < 1 || jobs.jobs.length > 100 ||
      jobs.total_count !== jobs.jobs.length) deny('ACCESS_RECEIPT_JOBS_INCOMPLETE');
  const matches = jobs.jobs.filter(job => job?.name === 'access');
  if (matches.length !== 1) deny('ACCESS_RECEIPT_JOB_MISMATCH');
  const job = matches[0];
  if (String(job.run_id) !== String(run.id) || job.run_attempt !== run.run_attempt || job.head_sha !== sourceCommit ||
      job.status !== 'completed' || !conclusions.includes(job.conclusion) || !timestamp(job.started_at) || !timestamp(job.completed_at) ||
      !Array.isArray(job.steps) || job.steps.length > 100) deny('ACCESS_RECEIPT_JOB_MISMATCH');
  const step = name => {
    const found = job.steps.filter(item => item?.name === name);
    if (found.length !== 1 || found[0].status !== 'completed' ||
        !['success', 'failure', 'cancelled', 'skipped'].includes(found[0].conclusion)) deny('ACCESS_RECEIPT_STEP_MISMATCH');
    return found[0].conclusion;
  };
  if (step('Record bounded access evidence for controller handoff') !== 'success' ||
      step('Retain access evidence without credentials or provider data') !== 'success') deny('ACCESS_RECEIPT_NOT_RETAINED');
  const env = {GITHUB_SHA: sourceCommit, GITHUB_RUN_ID: String(run.id), GITHUB_RUN_ATTEMPT: String(run.run_attempt)};
  for (const [key, name] of Object.entries(checks)) env[key] = step(name);
  const expected = accessReport(env, receipt?.observedAt);
  if (expected.principal !== binding.serviceAccount || !isDeepStrictEqual(receipt, expected)) deny('ACCESS_RECEIPT_CONTENT_MISMATCH');
  const observed = Date.parse(receipt.observedAt), current = Date.parse(now);
  if (Date.parse(run.run_started_at) > Date.parse(job.started_at) || Date.parse(job.started_at) > observed ||
      observed > Date.parse(job.completed_at) || Date.parse(job.completed_at) > Date.parse(run.updated_at) ||
      Date.parse(run.updated_at) > current) deny('ACCESS_RECEIPT_TIME_MISMATCH');
  return {
    status: 'RECEIPT_MATCHED', productId: expected.productId, plane: expected.plane,
    commit: sourceCommit, runId: expected.runId, attempt: expected.attempt, source: expected.source,
    observedAt: expected.observedAt, results: expected.results,
    workflowConclusion: run.conclusion, jobConclusion: job.conclusion,
    freshness: current - observed > maxAgeMs ? 'STALE_RECHECK_REQUIRED' : 'RECENT_EVIDENCE_RECHECK_TARGET',
    checksPassed: expected.allPassed, workflowPassed: run.conclusion === 'success', jobPassed: job.conclusion === 'success',
    currentlyVerified: false, grantsPermission: false,
    provenance: 'CALLER_MUST_SUPPLY_TRUSTED_GITHUB_METADATA_AND_RUN_ARTIFACT',
  };
}
