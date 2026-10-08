import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deliveryPlan, deliveryStatus} from '../delivery.mjs';
import {developmentStandard} from '../standard.mjs';
const fixture = () => JSON.parse(readFileSync(new URL('../idea.example.json', import.meta.url)));
const revision = 'a'.repeat(40);
function evidence(plan) {
  let predecessorHash = plan.planHash;
  return plan.stages.map(stage => {
    const receipt = {stage: stage.id, productId: plan.idea.productId, planHash: plan.planHash,
      predecessorHash, revision, result: 'PASS', blockers: [], limitations: ['SYNTHETIC TEST ONLY'],
      observedAt: '2026-10-08T12:00:00Z', targetRef: 'fixture/target', releaseAuthorityRef: 'fixture/authority', rollbackRef: 'fixture/rollback',
      checks: stage.criteria.map(id => ({id, result: 'PASS', evidenceRef: `fixture/${id}`}))};
    predecessorHash = createHash('sha256').update(JSON.stringify(receipt)).digest('hex');
    return receipt;
  });
}
test('all supported flavours produce bounded, unexecuted plans', () => {
  for (const flavour of Object.keys(developmentStandard().flavours)) {
    const plan = deliveryPlan({...fixture(), flavour});
    assert.equal(plan.blueprint.id, flavour);
    assert(plan.stages.every(s => s.status === 'NOT_RUN'));
    assert.equal(plan.execution.deploysFromThisCommand, false);
    assert.equal(deliveryStatus(plan, [], revision).nextStage, 'research');
  }
});
test('unsupported scope and credential fields are rejected', () => {
  assert.throws(() => deliveryPlan({...fixture(), flavour: 'unknown'}));
  assert.throws(() => deliveryPlan({...fixture(), accessToken: 'not-a-real-token'}));
  assert.throws(() => deliveryPlan({...fixture(), acceptance: []}));
});
test('complete synthetic evidence is explicitly only a structural assessment', () => {
  const plan = deliveryPlan(fixture());
  const result = deliveryStatus(plan, evidence(plan), revision);
  assert.equal(result.status, 'RECORDED_DELIVERY_COMPLETE');
  assert.match(result.limitation, /Structural evidence check only/);
});
test('code changes invalidate build, verification and deployment', () => {
  const plan = deliveryPlan(fixture());
  const result = deliveryStatus(plan, evidence(plan), 'b'.repeat(40));
  assert.equal(result.nextStage, 'build');
  assert(result.stages[4].reasons.includes('STALE_REVISION'));
});
test('changed upstream research invalidates downstream receipts', () => {
  const plan = deliveryPlan(fixture()), receipts = evidence(plan);
  receipts[0].checks[0].evidenceRef = 'fixture/revised-research';
  assert.equal(deliveryStatus(plan, receipts, revision).nextStage, 'blueprint');
});
for (const [name, change] of [
  ['cross-product evidence', r => r[0].productId = 'other-product'],
  ['missing checks', r => r[0].checks.pop()],
  ['duplicate checks', r => r[0].checks[1] = r[0].checks[0]],
  ['failed checks', r => r[0].checks[0].result = 'FAIL'],
  ['blockers', r => r[0].blockers.push('Unresolved')],
  ['missing release authority', r => delete r[4].releaseAuthorityRef]
]) test(`holds ${name}`, () => {
  const plan = deliveryPlan(fixture()), receipts = evidence(plan); change(receipts);
  assert.equal(deliveryStatus(plan, receipts, revision).status, 'INCOMPLETE');
});
test('tampered plan and duplicate receipts cannot bypass stage requirements', () => {
  const plan = deliveryPlan(fixture()), receipts = evidence(plan);
  assert.throws(() => deliveryStatus(plan, [receipts[0], receipts[0]], revision));
  plan.stages[0].criteria = [];
  assert.throws(() => deliveryStatus(plan, receipts, revision), /PLAN_CHANGED/);
});
