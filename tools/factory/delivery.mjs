import {createHash} from 'node:crypto';
import {developmentStandard, standardHash} from './standard.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 2000;
const id = value => typeof value === 'string' && /^[a-z][a-z0-9-]{1,62}$/.test(value);
const list = value => Array.isArray(value) && value.length > 0 && value.length <= 30 && value.every(text) && new Set(value).size === value.length;
const stages = [
  ['research', ['problem-evidence', 'primary-sources', 'alternatives', 'feasibility-and-cost', 'recommendation']],
  ['blueprint', ['scope-and-non-goals', 'user-journeys', 'reuse-review', 'architecture-and-data', 'acceptance-criteria', 'access-and-release-authority']],
  ['build', ['implementation', 'automated-checks', 'synthetic-user-journey', 'documentation']],
  ['verify', ['acceptance-results', 'security-and-isolation', 'accessibility-and-performance', 'review', 'rollback-rehearsal']],
  ['deploy', ['target-and-cost-check', 'release-authority', 'deployment-receipt', 'live-smoke-check', 'recovery-and-handover']]
];

// The controller supplies observed evidence; local JSON is not proof of provider identity.
export function deliveryPlan(idea) {
  const keys = ['schemaVersion', 'id', 'productId', 'flavour', 'problem', 'audience', 'outcome', 'nonGoals', 'acceptance', 'constraints', 'authorityRef'];
  if (!idea || typeof idea !== 'object' || Array.isArray(idea) || Object.keys(idea).some(k => !keys.includes(k)) ||
      idea.schemaVersion !== 1 || !id(idea.id) || !id(idea.productId) ||
      !Object.hasOwn(developmentStandard().flavours, idea.flavour) ||
      !['problem', 'audience', 'outcome', 'authorityRef'].every(k => text(idea[k])) ||
      !['nonGoals', 'acceptance', 'constraints'].every(k => list(idea[k]))) throw Error('INVALID_IDEA: supply the bounded idea contract; references only, no credentials');
  const profile = developmentStandard().flavours[idea.flavour];
  const plan = {
    schemaVersion: 1, workflowVersion: '1.0.0', standardHash,
    idea: structuredClone(idea),
    blueprint: {id: idea.flavour, baseline: profile.baseline, reviewCandidates: profile.reuseAssetIds,
      policy: 'Inspect current source; reuse, adapt, then build only gaps. Preserve native product stack and constitution.'},
    execution: {mode: 'connected-controller', backgroundService: false, deploysFromThisCommand: false,
      contextMaxBytes: 24000, maxRepairAttemptsBeforeDiagnosis: 2,
      defaultWorkerCount: 1, secrets: 'existing-product-scoped-secret-store',
      stopFor: ['missing-user-data', 'missing-access-or-required-consent', 'unapproved-cost', 'product-release-restriction']},
    stages: stages.map(([name, criteria], index) => ({id: name, dependsOn: index ? [stages[index - 1][0]] : [],
      criteria, status: 'NOT_RUN'})),
    metrics: {inputTokens: null, outputTokens: null, elapsedMinutes: null, repairCount: 0,
      escapedDefects: null, note: 'Record measured values only; unavailable is not zero.'}
  };
  return {...plan, planHash: hash(plan)};
}

export function deliveryStatus(plan, receipts, revision) {
  if (!plan || typeof plan !== 'object') throw Error('INVALID_PLAN');
  const expected = deliveryPlan(plan.idea);
  if (JSON.stringify(plan) !== JSON.stringify(expected)) throw Error('PLAN_CHANGED: regenerate from the idea');
  if (!Array.isArray(receipts) || receipts.length > stages.length) throw Error('INVALID_RECEIPTS');
  if (typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision)) throw Error('EXACT_GIT_REVISION_REQUIRED');
  const seen = new Set();
  for (const receipt of receipts) {
    if (!receipt || !stages.some(([name]) => name === receipt.stage) || seen.has(receipt.stage)) throw Error('UNKNOWN_OR_DUPLICATE_STAGE');
    seen.add(receipt.stage);
  }
  let previousHash = plan.planHash;
  let blocked = false;
  const results = plan.stages.map(stage => {
    const receipt = receipts.find(r => r.stage === stage.id);
    const reasons = [];
    if (blocked) reasons.push('PREDECESSOR_INCOMPLETE');
    if (!receipt) reasons.push('NO_RECEIPT');
    else {
      if (receipt.planHash !== plan.planHash || receipt.productId !== plan.idea.productId) reasons.push('PLAN_OR_PRODUCT_MISMATCH');
      if (receipt.predecessorHash !== previousHash) reasons.push('UPSTREAM_CHANGED');
      if (['build', 'verify', 'deploy'].includes(stage.id) && receipt.revision !== revision) reasons.push('STALE_REVISION');
      if (receipt.result !== 'PASS' || !Array.isArray(receipt.blockers) || receipt.blockers.length) reasons.push('FAILED_OR_BLOCKED');
      if (!Array.isArray(receipt.limitations) || !text(receipt.observedAt) || !Number.isFinite(Date.parse(receipt.observedAt))) reasons.push('MISSING_RECEIPT_METADATA');
      const checks = receipt.checks;
      if (!Array.isArray(checks) || checks.length !== stage.criteria.length ||
          new Set(checks.map(c => c?.id)).size !== stage.criteria.length ||
          checks.some(c => !c || !stage.criteria.includes(c.id) || c.result !== 'PASS' || !text(c.evidenceRef))) reasons.push('INCOMPLETE_CRITERION_EVIDENCE');
      if (stage.id === 'deploy' && (!text(receipt.targetRef) || !text(receipt.releaseAuthorityRef) || !text(receipt.rollbackRef))) reasons.push('MISSING_RELEASE_BINDING');
    }
    const complete = reasons.length === 0;
    blocked ||= !complete;
    previousHash = receipt ? hash(receipt) : null;
    return {stage: stage.id, status: complete ? 'EVIDENCE_COMPLETE' : 'HOLD', reasons,
      receiptHash: receipt ? hash(receipt) : null};
  });
  return {productId: plan.idea.productId, planHash: plan.planHash, revision,
    status: blocked ? 'INCOMPLETE' : 'RECORDED_DELIVERY_COMPLETE',
    nextStage: results.find(r => r.status === 'HOLD')?.stage ?? null, stages: results,
    limitation: 'Structural evidence check only. The connected controller must verify source authenticity, actual results, current permissions and release authority. This command never deploys.'};
}
