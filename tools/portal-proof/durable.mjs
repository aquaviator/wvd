import { DatabaseSync } from 'node:sqlite';
import { PortalProof } from './domain.mjs';

const collections = ['identities','projects','memberships','milestones','receipts','outbox','feedback','tickets','replies'];
const string = value => typeof value === 'string' && value.length > 0;
function validate(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('CORRUPT_PORTAL_STATE');
  for (const name of collections) {
    if (!Array.isArray(state[name]) || state[name].some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('CORRUPT_PORTAL_STATE');
  }
  if (state.identities.some(x => !string(x.id) || typeof x.active !== 'boolean' || (x.wvdAdmin !== undefined && typeof x.wvdAdmin !== 'boolean')) ||
      state.projects.some(x => !string(x.id) || !string(x.businessId)) ||
      state.memberships.some(x => !string(x.actorId) || !string(x.businessId) || typeof x.active !== 'boolean' || !['Owner','Member'].includes(x.role) || !Array.isArray(x.projectIds) || x.projectIds.some(id => !string(id))) ||
      state.milestones.some(x => !string(x.id) || !string(x.projectId) || !string(x.currentVersionId) || !string(x.status))) throw new Error('CORRUPT_PORTAL_STATE');
  for (const name of ['receipts','feedback','tickets','replies']) {
    if (state[name].some(x => !string(x.id) || !string(x.operationId) || !string(x.actorId) || !string(x.projectId))) throw new Error('CORRUPT_PORTAL_STATE');
  }
  if (state.outbox.some(x => !string(x.id) || !string(x.receiptId) || !string(x.type) || !string(x.status))) throw new Error('CORRUPT_PORTAL_STATE');
  const corrupt = () => { throw new Error('CORRUPT_PORTAL_STATE'); };
  for (const name of collections.filter(x => x !== 'memberships')) {
    const ids = state[name].map(x => x.id);
    if (new Set(ids).size !== ids.length) corrupt();
  }
  const identities = new Map(state.identities.map(x => [x.id,x]));
  const projects = new Map(state.projects.map(x => [x.id,x]));
  const milestones = new Map(state.milestones.map(x => [x.id,x]));
  const tickets = new Map(state.tickets.map(x => [x.id,x]));
  const memberships = new Set();
  for (const member of state.memberships) {
    const key = JSON.stringify([member.actorId,member.businessId]);
    if (memberships.has(key) || !identities.has(member.actorId) || !state.projects.some(x => x.businessId === member.businessId) || new Set(member.projectIds).size !== member.projectIds.length || member.projectIds.some(id => projects.get(id)?.businessId !== member.businessId)) corrupt();
    memberships.add(key);
  }
  for (const milestone of state.milestones) if (!projects.has(milestone.projectId)) corrupt();
  const records = new Map(), operations = new Set();
  const types = {receipts:['approval','milestone-approved'],feedback:['feedback','feedback-saved'],tickets:['ticket','ticket-created'],replies:['reply','ticket-replied']};
  for (const [name,[kind,eventType]] of Object.entries(types)) {
    for (const record of state[name]) {
      const project = projects.get(record.projectId);
      if (records.has(record.id) || operations.has(record.operationId) || !identities.has(record.actorId) || !project || record.businessId !== project.businessId || record.kind !== kind) corrupt();
      if (name === 'receipts' || name === 'feedback') {
        // Historical versions intentionally survive replacement of currentVersionId.
        if (!string(record.versionId) || milestones.get(record.milestoneId)?.projectId !== record.projectId) corrupt();
      }
      if (name === 'replies') {
        const ticket = tickets.get(record.ticketId);
        if (!ticket || ticket.projectId !== record.projectId || ticket.businessId !== record.businessId) corrupt();
      }
      records.set(record.id,{record,eventType}); operations.add(record.operationId);
    }
  }
  for (const intent of state.outbox) {
    const linked = records.get(intent.receiptId);
    if (!linked || intent.id !== intent.receiptId || intent.type !== linked.eventType) corrupt();
  }
  // This proof persists one pending intent with every domain write; no dispatcher
  // removes intents, so a missing link indicates an incomplete/tampered aggregate.
  if (state.outbox.length !== records.size) corrupt();
  return state;
}

// Bounded local adapter proof: one JSON aggregate, synchronous writes, trusted
// fixture administration. Not a hosted backend, identity provider, distributed
// store or notification dispatcher. Caller owns filesystem permissions/backups.
export class DurablePortal {
  #db; #clock;
  constructor(path, state, clock = () => new Date().toISOString()) {
    this.#clock = clock;
    this.#db = new DatabaseSync(path);
    try {
      this.#db.exec('PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS portal_state (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL CHECK(revision >= 0), state_json TEXT NOT NULL)');
      this.#db.exec('BEGIN IMMEDIATE');
      try {
        const existing = this.#db.prepare('SELECT revision, state_json FROM portal_state WHERE id = 1').get();
        if (existing) new PortalProof(this.#decode(existing), this.#clock);
        else {
          if (state === undefined) throw new Error('PORTAL_SEED_REQUIRED');
          const normalized = new PortalProof(state, this.#clock).snapshot();
          validate(normalized);
          this.#db.prepare('INSERT INTO portal_state VALUES (1, 0, ?)').run(JSON.stringify(normalized));
        }
        this.#db.exec('COMMIT');
      } catch (error) { this.#db.exec('ROLLBACK'); throw error; }
    } catch (error) { this.#db.close(); throw error; }
  }
  #decode(row) {
    if (!row || !Number.isSafeInteger(row.revision) || row.revision < 0) throw new Error('CORRUPT_PORTAL_STATE');
    try { return validate(JSON.parse(row.state_json)); }
    catch { throw new Error('CORRUPT_PORTAL_STATE'); }
  }
  #run(method, args) {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.#db.prepare('SELECT revision, state_json FROM portal_state WHERE id = 1').get();
      const proof = new PortalProof(this.#decode(row), this.#clock);
      const before = JSON.stringify(proof.snapshot());
      const result = proof[method](...args);
      const after = JSON.stringify(validate(proof.snapshot()));
      if (after !== before) {
        if (row.revision >= Number.MAX_SAFE_INTEGER) throw new Error('REVISION_EXHAUSTED');
        this.#db.prepare('UPDATE portal_state SET revision = ?, state_json = ? WHERE id = 1').run(row.revision + 1, after);
      }
      this.#db.exec('COMMIT');
      return result;
    } catch (error) { this.#db.exec('ROLLBACK'); throw error; }
  }
  close() { this.#db.close(); }
  snapshot() { return this.#run('snapshot', []); }
  projectsFor(...args) { return this.#run('projectsFor', args); }
  ticketsFor(...args) { return this.#run('ticketsFor', args); }
  authorise(...args) { return this.#run('authorise', args); }
  projectOverview(...args) { return this.#run('projectOverview', args); }
  approve(...args) { return this.#run('approve', args); }
  submitFeedback(...args) { return this.#run('submitFeedback', args); }
  createTicket(...args) { return this.#run('createTicket', args); }
  readTicket(...args) { return this.#run('readTicket', args); }
  replyToTicket(...args) { return this.#run('replyToTicket', args); }
  // Trusted fixture mutations only: never expose these as unauthenticated routes.
  revokeMembership(...args) { return this.#run('revokeMembership', args); }
  replaceVersion(...args) { return this.#run('replaceVersion', args); }
}
