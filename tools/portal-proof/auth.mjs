import {DatabaseSync} from 'node:sqlite';
import {randomBytes, createHash, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const derive = promisify(scrypt);
const hash = token => createHash('sha256').update(token).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const emailAddress = value => {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('INVALID_REQUEST');
  return value.toLowerCase();
};
const passwordInput = value => {
  if (typeof value !== 'string' || value.length < 15 || Buffer.byteLength(value) > 1024) throw new Error('INVALID_PASSWORD');
  return value;
};
const options = {N:32768, r:8, p:3, maxmem:64 * 1024 * 1024};
const dummySalt = Buffer.alloc(16).toString('hex');

// Local invitation-only authentication. No external auth account or API key.
// The HTTP host supplies TLS, origin enforcement and the actual socket peer.
export class LocalAuth {
  #db; #clock; #busy = 0;
  constructor(path, clock = () => Date.now()) {
    this.#clock = clock;
    this.#db = new DatabaseSync(path);
    this.#db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts (
        actor_id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
        active INTEGER NOT NULL CHECK(active IN (0,1)),
        salt TEXT, password_hash TEXT, version INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS invitations (
        digest TEXT PRIMARY KEY, actor_id TEXT NOT NULL,
        version INTEGER NOT NULL, expires INTEGER NOT NULL,
        FOREIGN KEY(actor_id) REFERENCES accounts(actor_id)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        digest TEXT PRIMARY KEY, actor_id TEXT NOT NULL,
        version INTEGER NOT NULL, expires INTEGER NOT NULL,
        FOREIGN KEY(actor_id) REFERENCES accounts(actor_id)
      );
      CREATE TABLE IF NOT EXISTS attempts (
        key TEXT PRIMARY KEY, expires INTEGER NOT NULL, count INTEGER NOT NULL
      );
      PRAGMA foreign_keys=ON;`);
  }
  close() { this.#db.close(); }
  #transaction(fn) {
    this.#db.exec('BEGIN IMMEDIATE');
    try { const result=fn(); this.#db.exec('COMMIT'); return result; }
    catch (error) { this.#db.exec('ROLLBACK'); throw error; }
  }
  #now() {
    const value=this.#clock();
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('INVALID_SERVER_TIME');
    return value;
  }
  #limit(peer, identity) {
    if (typeof peer !== 'string' || !peer || peer.length > 128) throw new Error('INVALID_REQUEST');
    const now=this.#now();
    const allowed=this.#transaction(() => {
      this.#db.prepare('DELETE FROM attempts WHERE expires <= ?').run(now);
      this.#db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now);
      this.#db.prepare('DELETE FROM invitations WHERE expires <= ?').run(now);
      let ok=true;
      for (const key of [hash(`peer:${peer}`),hash(`identity:${identity}`)]) {
        const row=this.#db.prepare('SELECT count FROM attempts WHERE key=?').get(key);
        if (!row && this.#db.prepare('SELECT count(*) AS n FROM attempts').get().n >= 10000) { ok=false; continue; }
        this.#db.prepare(`INSERT INTO attempts VALUES (?, ?, 1)
          ON CONFLICT(key) DO UPDATE SET count=count+1`).run(key,now+15*60*1000);
        if ((row?.count ?? 0) >= 10) ok=false;
      }
      return ok;
    });
    if (!allowed) throw new Error('RATE_LIMITED');
  }
  async #password(password, salt) {
    if (this.#busy >= 2) throw new Error('AUTH_BUSY');
    this.#busy++;
    try { return await derive(password,salt,64,options); }
    finally { this.#busy--; }
  }
  // Trusted operator API only. Never expose these methods as public routes.
  invite(actorId, email) {
    if (typeof actorId !== 'string' || !actorId || actorId.length > 128) throw new Error('INVALID_REQUEST');
    const address=emailAddress(email), raw=token(), now=this.#now();
    this.#transaction(() => {
      const existing=this.#db.prepare('SELECT * FROM accounts WHERE actor_id=?').get(actorId);
      if (existing && existing.email !== address) throw new Error('ACCOUNT_CONFLICT');
      this.#db.prepare('INSERT OR IGNORE INTO accounts(actor_id,email,active) VALUES(?,?,1)').run(actorId,address);
      const account=this.#db.prepare('SELECT * FROM accounts WHERE actor_id=?').get(actorId);
      if (!account || account.active !== 1) throw new Error('ACCESS_DENIED');
      this.#db.prepare('DELETE FROM invitations WHERE actor_id=?').run(actorId);
      this.#db.prepare('INSERT INTO invitations VALUES(?,?,?,?)').run(hash(raw),actorId,account.version,now+24*60*60*1000);
    });
    return {invitationToken:raw,expiresAt:new Date(now+24*60*60*1000).toISOString()};
  }
  disable(actorId) {
    this.#transaction(() => {
      this.#db.prepare('UPDATE accounts SET active=0, version=version+1 WHERE actor_id=?').run(actorId);
      this.#db.prepare('DELETE FROM sessions WHERE actor_id=?').run(actorId);
      this.#db.prepare('DELETE FROM invitations WHERE actor_id=?').run(actorId);
    });
  }
  async redeem(invitationToken, password, peer) {
    if (!validToken(invitationToken)) throw new Error('INVALID_INVITATION');
    passwordInput(password); this.#limit(peer,invitationToken);
    const digest=hash(invitationToken), now=this.#now();
    const invitation=this.#db.prepare(`SELECT i.*,a.active FROM invitations i
      JOIN accounts a ON a.actor_id=i.actor_id AND a.version=i.version WHERE digest=?`).get(digest);
    if (!invitation || invitation.expires <= now || invitation.active !== 1) throw new Error('INVALID_INVITATION');
    const salt=randomBytes(16).toString('hex');
    const passwordHash=(await this.#password(password,salt)).toString('hex');
    this.#transaction(() => {
      const current=this.#db.prepare(`SELECT i.*,a.active FROM invitations i
        JOIN accounts a ON a.actor_id=i.actor_id AND a.version=i.version WHERE digest=?`).get(digest);
      if (!current || current.expires <= this.#now() || current.active !== 1) throw new Error('INVALID_INVITATION');
      this.#db.prepare('UPDATE accounts SET salt=?,password_hash=?,version=version+1 WHERE actor_id=?').run(salt,passwordHash,current.actor_id);
      this.#db.prepare('DELETE FROM invitations WHERE actor_id=?').run(current.actor_id);
      this.#db.prepare('DELETE FROM sessions WHERE actor_id=?').run(current.actor_id);
    });
    return {accepted:true};
  }
  async login(email, password, peer) {
    const address=emailAddress(email);
    if (typeof password !== 'string' || Buffer.byteLength(password)>1024) throw new Error('INVALID_REQUEST');
    this.#limit(peer,address);
    const account=this.#db.prepare('SELECT * FROM accounts WHERE email=?').get(address);
    const actual=await this.#password(password,account?.salt ?? dummySalt);
    const expected=account?.password_hash ? Buffer.from(account.password_hash,'hex') : Buffer.alloc(64);
    if (expected.length !== actual.length || !timingSafeEqual(actual,expected) || !account || account.active !== 1) throw new Error('UNAUTHENTICATED');
    const raw=token(), now=this.#now();
    this.#transaction(() => {
      const current=this.#db.prepare('SELECT * FROM accounts WHERE actor_id=?').get(account.actor_id);
      if (!current || current.active !== 1 || current.version !== account.version || current.password_hash !== account.password_hash) throw new Error('UNAUTHENTICATED');
      this.#db.prepare('DELETE FROM sessions WHERE actor_id=? AND expires<=?').run(account.actor_id,now);
      // At most five simultaneous sessions per account.
      this.#db.prepare(`DELETE FROM sessions WHERE digest IN
        (SELECT digest FROM sessions WHERE actor_id=? ORDER BY expires DESC LIMIT -1 OFFSET 4)`).run(account.actor_id);
      this.#db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(raw),account.actor_id,account.version,now+8*60*60*1000);
    });
    return {sessionToken:raw,expiresAt:new Date(now+8*60*60*1000).toISOString()};
  }
  resolveSession(raw) {
    if (!validToken(raw)) return null;
    const row=this.#db.prepare(`SELECT a.actor_id FROM sessions s JOIN accounts a
      ON a.actor_id=s.actor_id AND a.version=s.version
      WHERE s.digest=? AND s.expires>? AND a.active=1`).get(hash(raw),this.#now());
    return row ? {actorId:row.actor_id} : null;
  }
  logout(raw) { if (validToken(raw)) this.#db.prepare('DELETE FROM sessions WHERE digest=?').run(hash(raw)); }
}
