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
    this.#state.feedback ??= [];
    this.#state.tickets ??= [];
    this.#state.replies ??= [];
  }
  snapshot() { return structuredClone(this.#state); }
  authorise(actorId, projectId, action) { return structuredClone(authorise(this.#state, actorId, projectId, action)); }
  projectOverview(actorId, projectId) {
    const project = authorise(this.#state, actorId, projectId, 'view');
    const milestones = this.#state.milestones.filter(x => x.projectId === projectId);
    return structuredClone({
      projectId, stage: project.stage ?? null, nextStep: project.nextStep ?? null,
      completedMilestones: milestones.filter(x => x.status === 'approved'),
      awaitingClient: milestones.filter(x => x.status === 'awaiting-client')
    });
  }
  #timestamp() {
    const timestamp = this.#clock();
    if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) throw new Error('INVALID_SERVER_TIME');
    return timestamp;
  }
  #retry(operationId, payload) {
    if (typeof operationId !== 'string' || !operationId || operationId.length > 128) throw new Error('INVALID_OPERATION');
    const existing = [...this.#state.receipts, ...this.#state.feedback, ...this.#state.tickets, ...this.#state.replies].find(x => x.operationId === operationId);
    if (!existing) return null;
    for (const [key, value] of Object.entries(payload)) if (existing[key] !== value) throw new Error('OPERATION_CONFLICT');
    return structuredClone(existing);
  }
  #text(value, maximum) {
    // Prototype bounds only; production request-body/rate limits remain separate.
    if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error('INVALID_TEXT');
    return value;
  }
  #save(collection, payload, eventType) {
    const next = structuredClone(this.#state);
    const record = { ...payload, id: `${collection}-${next[collection].length + 1}`, timestamp: this.#timestamp() };
    next[collection].push(record);
    // Payload-free notification intent; recipient selection is unresolved.
    next.outbox.push({id: record.id, type: eventType, receiptId: record.id, status: 'pending'});
    this.#state = next;
    return structuredClone(record);
  }
  submitFeedback({ actorId, projectId, milestoneId, versionId, body, operationId }) {
    const project = authorise(this.#state, actorId, projectId, 'feedback');
    this.#text(body, 10000);
    const payload = {kind:'feedback',actorId,projectId,milestoneId,versionId,body,operationId};
    const retry = this.#retry(operationId, payload);
    if (retry) return retry;
    const milestone = this.#state.milestones.find(x => x.id === milestoneId && x.projectId === projectId);
    if (!milestone) denied();
    if (typeof versionId !== 'string' || !versionId || milestone.currentVersionId !== versionId) throw new Error('VERSION_CONFLICT');
    return this.#save('feedback', {...payload,businessId:project.businessId}, 'feedback-saved');
  }
  createTicket({actorId, projectId, type, subject, body, operationId}) {
    const project = authorise(this.#state, actorId, projectId, 'ticket');
    if (!['question','fault','change-request'].includes(type)) throw new Error('INVALID_TICKET_TYPE');
    this.#text(subject, 200); this.#text(body, 10000);
    const payload = {kind:'ticket',actorId,projectId,type,subject,body,operationId};
    const retry = this.#retry(operationId, payload);
    return retry ?? this.#save('tickets', {...payload,businessId:project.businessId}, 'ticket-created');
  }
  readTicket(actorId, projectId, ticketId) {
    authorise(this.#state, actorId, projectId, 'ticket');
    const ticket = this.#state.tickets.find(x => x.id === ticketId && x.projectId === projectId);
    if (!ticket) denied();
    return structuredClone({ticket, replies:this.#state.replies.filter(x =>
      x.ticketId === ticketId && x.projectId === projectId && x.businessId === ticket.businessId)});
  }
  replyToTicket({actorId,projectId,ticketId,body,operationId}) {
    const {ticket} = this.readTicket(actorId,projectId,ticketId);
    this.#text(body, 10000);
    const payload = {kind:'reply',actorId,projectId,ticketId,body,operationId};
    const retry = this.#retry(operationId,payload);
    return retry ?? this.#save('replies',{...payload,businessId:ticket.businessId},'ticket-replied');
  }
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
    const existing = this.#retry(operationId,{kind:'approval',actorId,projectId,milestoneId,versionId});
    if (existing) return existing;
    const milestone = this.#state.milestones.find(x => x.id === milestoneId && x.projectId === projectId);
    if (!milestone) denied();
    if (typeof versionId !== 'string' || !versionId || milestone.currentVersionId !== versionId) throw new Error('VERSION_CONFLICT');
    if (milestone.status !== 'awaiting-client') throw new Error('STATE_CONFLICT');
    const timestamp = this.#timestamp();
    const receipt = {
      id: `approval-${this.#state.receipts.length + 1}`, kind:'approval', operationId, actorId,
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
