// Provider-free executable model. This is not an authentication service or database.
const denied = () => { throw new Error('ACCESS_DENIED'); };
const actions = new Set(['view', 'feedback', 'ticket', 'approve', 'manage-colleagues']);

export function authorise(state, actorId, projectId, action) {
  if (!actions.has(action)) denied();
  const identity = state.identities.find(x => x.id === actorId && x.active);
  const project = state.projects.find(x => x.id === projectId);
  if (!identity || !project) denied();
  // Administration is separate from client approval and colleague management.
  if (identity.wvdAdmin && ['view', 'feedback', 'ticket'].includes(action)) return project;
  const membership = state.memberships.find(x =>
    x.actorId === actorId && x.businessId === project.businessId && x.active &&
    ['Owner', 'Member'].includes(x.role) && x.projectIds.includes(projectId));
  if (!membership) denied();
  if (['approve', 'manage-colleagues'].includes(action) && membership.role !== 'Owner') denied();
  return project;
}

export class PortalProof {
  #state;
  #clock;
  constructor(state, clock) {
    this.#state = structuredClone(state);
    this.#clock = clock;
    // Reject ambiguous identifiers rather than choosing the first row.
    for (const collection of ['identities', 'projects', 'milestones']) {
      const ids = this.#state[collection].map(x => x.id);
      if (new Set(ids).size !== ids.length) throw new Error('DUPLICATE_ID');
    }
    const memberships = this.#state.memberships.map(x => JSON.stringify([x.actorId, x.businessId]));
    if (new Set(memberships).size !== memberships.length) throw new Error('DUPLICATE_MEMBERSHIP');
    this.#state.receipts ??= [];
    this.#state.outbox ??= [];
  }
  snapshot() { return structuredClone(this.#state); }
  authorise(actorId, projectId, action) { return structuredClone(authorise(this.#state, actorId, projectId, action)); }
  revokeMembership(actorId, businessId) {
    // Trusted test-adapter operation, not an exposed admin or client endpoint.
    const membership = this.#state.memberships.find(x => x.actorId === actorId && x.businessId === businessId);
    if (membership) membership.active = false;
  }
  replaceVersion(milestoneId, versionId) {
    // Trusted test-adapter operation. Historical approvals are immutable.
    const milestone = this.#state.milestones.find(x => x.id === milestoneId);
    if (!milestone || typeof versionId !== 'string' || !versionId) throw new Error('INVALID_VERSION');
    milestone.currentVersionId = versionId;
    milestone.status = 'awaiting-client';
  }
  approve({ actorId, projectId, milestoneId, versionId, operationId }) {
    // Recheck current membership even for a repeated request.
    const project = authorise(this.#state, actorId, projectId, 'approve');
    if (typeof operationId !== 'string' || !operationId || operationId.length > 128) throw new Error('INVALID_OPERATION');
    const existing = this.#state.receipts.find(x => x.operationId === operationId);
    if (existing) {
      if (existing.actorId !== actorId || existing.projectId !== projectId || existing.milestoneId !== milestoneId || existing.versionId !== versionId) throw new Error('OPERATION_CONFLICT');
      return structuredClone(existing);
    }
    const milestone = this.#state.milestones.find(x => x.id === milestoneId && x.projectId === projectId);
    if (!milestone) denied();
    if (typeof versionId !== 'string' || !versionId || milestone.currentVersionId !== versionId) throw new Error('VERSION_CONFLICT');
    if (milestone.status !== 'awaiting-client') throw new Error('STATE_CONFLICT');
    const timestamp = this.#clock();
    if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) throw new Error('INVALID_SERVER_TIME');
    const receipt = {
      id: `approval-${this.#state.receipts.length + 1}`, operationId, actorId,
      businessId: project.businessId, projectId, milestoneId, versionId, timestamp
    };
    // Synchronous copy-on-write commit models one transaction. A production
    // adapter must implement locking/constraints in the selected durable store.
    const next = structuredClone(this.#state);
    next.milestones.find(x => x.id === milestoneId).status = 'approved';
    next.receipts.push(receipt);
    next.outbox.push({ id: receipt.id, type: 'milestone-approved', receiptId: receipt.id, status: 'pending' });
    this.#state = next;
    return structuredClone(receipt);
  }
}
