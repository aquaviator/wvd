import { DatabaseSync } from 'node:sqlite';
import { PortalProof } from './domain.mjs';

import {validatePortalState as validate} from './state.mjs';

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
