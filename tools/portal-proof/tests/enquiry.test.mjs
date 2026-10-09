import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {ENQUIRY_FIELD_LIMITS,enquiryCollectionId,enquiryReceiptId,normaliseEnquiryRequest} from '../enquiry.mjs';
import {createFirestoreEnquiryStore} from '../enquiry-firestore.mjs';
import {createEnquiryHandler,enquiryRoute} from '../enquiry-http.mjs';
import {createEnquiryNotificationDispatcher,createGoogleEnquiryMailSender} from '../enquiry-mail.mjs';

const at = '2026-10-06T14:00:00.000Z';
const origin = 'https://public.example.test';
const fields = {name:'Synthetic owner',business:'Synthetic business',email:'visitor@example.test',need:'A small accessible business website.',website:'',timing:'',budget:''};
const request = (overrides = {}) => ({requestId:randomUUID(),fields:{...fields},websiteTrap:'',...overrides});

// Transactional fake models atomic commits, concurrent writers, document IDs,
// query ordering and Firestore's requirement to read before writing. Real SDK
// queries and native timestamp round trips are also covered in emulator-tests.
class Database {
  rows = new Map(); tail = Promise.resolve(); failCommit = false; failNotificationResult = false;
  snapshot(path,rows = this.rows) {
    const row = rows.get(path);
    return {id:path.split('/').at(-1),ref:this.doc(path),exists:row !== undefined,data:() => {
      const copy = structuredClone(row);
      if (copy?.fields) copy.fields = Object.fromEntries(Object.entries(copy.fields).sort(([a],[b]) => a.localeCompare(b)));
      return copy;
    }};
  }
  doc(path) { return {path,id:path.split('/').at(-1),get:async () => this.snapshot(path)}; }
  collection(path) {
    const db = this;
    function query(filters = [],orders = [],after = null,limit = Infinity) {
      return {
        where:(...args) => query([...filters,args],orders,after,limit),
        orderBy:(...args) => query(filters,[...orders,args],after,limit),
        startAfter:(...values) => query(filters,orders,values,limit),
        limit:value => query(filters,orders,after,value),
        async get() {
          const value = (document,field) => field === '__name__' ? document.id : document.data()[field];
          const compare = (left,right) => { for (let i = 0; i < orders.length; i++) { const [field,direction] = orders[i],a = value(left,field),b = Array.isArray(right) ? right[i] : value(right,field); if (a !== b) return (a < b ? -1 : 1) * (direction === 'desc' ? -1 : 1); } return 0; };
          let docs = [...db.rows.keys()].filter(key => key.startsWith(path + '/') && key.slice(path.length + 1).indexOf('/') === -1).map(key => db.snapshot(key));
          docs = docs.filter(document => filters.every(([field,operator,target]) => operator === '<=' ? value(document,field) <= target : value(document,field) === target)).sort(compare);
          if (after) docs = docs.filter(document => compare(document,after) > 0);
          return {docs:docs.slice(0,limit)};
        }
      };
    }
    return query();
  }
  runTransaction(callback) {
    const task = this.tail.then(async () => {
      const next = structuredClone(this.rows); let wrote = false;
      const put = (ref,row,create = false) => {
        if (create && next.has(ref.path)) throw Error('ALREADY_EXISTS');
        if (this.failNotificationResult && ['ACCEPTED','UNKNOWN'].includes(row.notification?.status)) throw Error('SYNTHETIC_COMMIT_FAILURE');
        wrote = true; next.set(ref.path,structuredClone(row));
      };
      const result = await callback({
        get:async ref => { if (wrote) throw Error('READ_AFTER_WRITE'); return this.snapshot(ref.path,next); },
        set:(ref,row) => put(ref,row),create:(ref,row) => put(ref,row,true),delete:ref => { wrote = true; next.delete(ref.path); }
      });
      if (this.failCommit) throw Error('SYNTHETIC_COMMIT_FAILURE');
      this.rows = next; return result;
    });
    this.tail = task.catch(() => {}); return task;
  }
}

function setup(overrides = {}) {
  const db = new Database(); let time = at;
  const clock = () => time;
  const config = {db,productId:'synthetic-wvd',clock,admission:{minuteLimit:10,dailyLimit:50},retentionDays:90,...overrides};
  const store = createFirestoreEnquiryStore(config);
  return {db,clock,store,config,advance:milliseconds => {time = new Date(Date.parse(time) + milliseconds).toISOString();}};
}

test('normalizes only the existing bounded brief and rejects extra fields, traps and unsafe input',() => {
  const source = request({fields:{...fields,name:'  Synthetic owner  ',need:'A site for a café 😀.'}});
  assert.equal(normaliseEnquiryRequest(source).fields.name,'Synthetic owner');
  assert.equal(source.fields.name,'  Synthetic owner  ');
  for (const input of [null,[],{...source,recipient:'attacker@example.test'},{...source,websiteTrap:'bot value'},{...source,requestId:'not-a-v4-id'},{...source,fields:{...fields,need:''}},{...source,fields:{...fields,email:'a@example.test\r\nBcc:x@example.test'}},{...source,fields:{...fields,website:'https://user:secret@example.test'}},{...source,fields:{...fields,website:'javascript:alert(1)'}},{...source,fields:{...fields,need:'bad\u0000value'}},{...source,fields:{...fields,need:'bad\ud800value'}}]) assert.throws(() => normaliseEnquiryRequest(input),/INVALID_ENQUIRY/);
  for (const [key,limit] of Object.entries(ENQUIRY_FIELD_LIMITS)) assert.throws(() => normaliseEnquiryRequest(request({fields:{...fields,[key]:'a'.repeat(limit + 1)}})),/INVALID_ENQUIRY/);
});

test('simultaneous identical requests commit one enquiry, budget increment and notification intent',async () => {
  const s = setup(),input = request();
  const results = await Promise.all(Array.from({length:6},() => s.store.accept(input)));
  assert.equal(results.filter(result => result.created).length,1);
  assert.equal(new Set(results.map(result => result.receiptId)).size,1);
  const rows = [...s.db.rows.values()];
  assert.equal(rows.length,2);
  assert.deepEqual(rows.find(row => row.notification).notification,{status:'PENDING',updatedAt:at,attempts:0});
  assert.equal(rows.find(row => row.minuteCount).minuteCount,1);
  const reopened = createFirestoreEnquiryStore(s.config);
  assert.equal((await reopened.accept(input)).created,false);
  assert.equal((await reopened.read(results[0].receiptId)).fields.need,fields.need);
});

test('conflicting reuse of an ID never changes saved content or consumes another admission',async () => {
  const s = setup(),input = request(),accepted = await s.store.accept(input);
  await assert.rejects(s.store.accept({...input,fields:{...fields,need:'Different content'}}),/ENQUIRY_CONFLICT/);
  assert.equal((await s.store.read(accepted.receiptId)).fields.need,fields.need);
  assert.equal([...s.db.rows.values()].find(row => row.minuteCount).minuteCount,1);
});

test('capture commit failure leaves neither content, admission nor notification',async () => {
  const s = setup(); s.db.failCommit = true;
  await assert.rejects(s.store.accept(request()),/SYNTHETIC_COMMIT_FAILURE/);
  assert.equal(s.db.rows.size,0);
});

test('persistent global minute/day budgets survive reopening and still allow exact retries',async () => {
  const s = setup({admission:{minuteLimit:1,dailyLimit:2}}),first = request();
  await s.store.accept(first);
  await assert.rejects(createFirestoreEnquiryStore(s.config).accept(request()),error => error.message === 'ENQUIRY_RATE_LIMITED' && error.retryAfter === 60);
  assert.equal((await s.store.accept(first)).created,false);
  s.advance(60000); await s.store.accept(request()); s.advance(60000);
  await assert.rejects(s.store.accept(request()),error => error.message === 'ENQUIRY_RATE_LIMITED' && error.retryAfter > 60);
  s.advance(86400000); assert.equal((await s.store.accept(request())).created,true);
});

test('private pages are complete at equal timestamps and cursors cannot cross products',async () => {
  const s = setup();
  const accepted = await Promise.all(Array.from({length:5},() => s.store.accept(request())));
  const first = await s.store.list({limit:2}),second = await s.store.list({limit:2,cursor:first.nextCursor}),third = await s.store.list({limit:2,cursor:second.nextCursor});
  assert.equal(third.nextCursor,null);
  assert.deepEqual(new Set([...first.enquiries,...second.enquiries,...third.enquiries].map(row => row.id)),new Set(accepted.map(row => row.receiptId)));
  const foreign = createFirestoreEnquiryStore({...s.config,productId:'other-product'});
  assert.equal(await foreign.read(accepted[0].receiptId),null);
  await assert.rejects(foreign.list({cursor:first.nextCursor}),/INVALID_ENQUIRY/);
  assert.notEqual(enquiryReceiptId('other-product',request().requestId),accepted[0].receiptId);
});

test('90-day expiry hides private data and bounded cleanup deletes expired records only',async () => {
  const s = setup(),receipts = await Promise.all(Array.from({length:4},() => s.store.accept(request())));
  const initial = await s.store.read(receipts[0].receiptId);
  assert.equal(Date.parse(initial.expiresAt) - Date.parse(at),90 * 86400000);
  assert.ok([...s.db.rows.values()].find(row => row.notification).deleteAt instanceof Date);
  s.advance(90 * 86400000);
  assert.deepEqual(await s.store.cleanup({limit:2}),{deleted:2,hasMore:true});
  assert.equal([...s.db.rows.values()].filter(row => row.notification).length,2);
  assert.deepEqual((await s.store.list()).enquiries,[]);
  assert.equal(await s.store.read(receipts[0].receiptId),null);
  assert.equal([...s.db.rows.values()].filter(row => row.notification).length,0);
  assert.equal([...s.db.rows.values()].filter(row => row.dayCount).length,1);
});

test('service retention uses a product-specific collection and leaves generic and other product enquiries intact',async () => {
  assert.equal(enquiryCollectionId('wvd'),'wvd_service_enquiries_v1');
  assert.equal(enquiryCollectionId('other-product'),'other-product_service_enquiries_v1');
  for (const productId of [undefined,null,'','WVD','wvd/enquiries','wvd_service','a']) assert.throws(() => enquiryCollectionId(productId),/INVALID_ENQUIRY/);
  const s = setup({productId:'wvd'}),input = request(),accepted = await s.store.accept(input);
  const ownPath = `wvd_products/wvd/${enquiryCollectionId('wvd')}/${accepted.receiptId}`;
  const genericPath = `wvd_products/wvd/enquiries/${accepted.receiptId}`;
  const genericRow = structuredClone(s.db.rows.get(ownPath));
  assert.ok(genericRow);
  s.db.rows.set(genericPath,structuredClone(genericRow));
  const other = createFirestoreEnquiryStore({...s.config,productId:'other-product'}),otherAccepted = await other.accept(input);
  const otherPath = `wvd_products/other-product/${enquiryCollectionId('other-product')}/${otherAccepted.receiptId}`;
  const otherRow = structuredClone(s.db.rows.get(otherPath));
  assert.ok(otherRow);
  s.advance(90 * 86400000);
  assert.deepEqual(await s.store.cleanup(),{deleted:1,hasMore:false});
  assert.equal(s.db.rows.has(ownPath),false);
  assert.deepEqual(s.db.rows.get(genericPath),genericRow);
  assert.deepEqual(s.db.rows.get(otherPath),otherRow);
  assert.deepEqual((await s.store.list()).enquiries,[]);
  assert.equal(await s.store.read(accepted.receiptId),null);
  assert.deepEqual(s.db.rows.get(genericPath),genericRow);
  assert.deepEqual(s.db.rows.get(otherPath),otherRow);
});

test('corrupt content and foreign binding fail closed without replacement',async () => {
  const s = setup(),input = request(),accepted = await s.store.accept(input);
  const record = [...s.db.rows.values()].find(row => row.notification);
  record.fields.need = 'tampered';
  await assert.rejects(s.store.read(accepted.receiptId),/CORRUPT_ENQUIRY/);
  await assert.rejects(s.store.accept(input),/CORRUPT_ENQUIRY/);
  assert.equal(record.fields.need,'tampered');
});

class Response {
  headers = {}; status = undefined; body = '';
  setHeader(name,value) { this.headers[name.toLowerCase()] = value; }
  removeHeader(name) { delete this.headers[name.toLowerCase()]; }
  writeHead(status,headers) { this.status = status; for (const [name,value] of Object.entries(headers)) this.setHeader(name,value); }
  end(value) { this.body = value ?? ''; }
  json() { return JSON.parse(this.body); }
}
async function invoke(handler,{method = 'POST',url = '/api/enquiries',input = request(),headers = {},raw} = {}) {
  const data = raw === undefined ? JSON.stringify(input) : raw;
  const req = Readable.from(method === 'POST' ? [Buffer.from(data)] : []);
  Object.assign(req,{method,url,headers:{origin,'content-type':'application/json',...headers}});
  const response = new Response(); await handler(req,response); return response;
}
function handlerFor(s,options = {}) { return createEnquiryHandler({store:s.store,resolveOwnerSession:async token => token === 'owner-token' ? {actorId:'synthetic-owner'} : null,allowedPublicOrigins:[origin],maxConcurrentRequests:2,...options}); }

test('public receipt follows durable acceptance and notification failure does not undo it',async () => {
  const s = setup(),input = request(); let calls = 0;
  const handler = handlerFor(s,{notify:async id => {calls++;assert.ok(await s.store.read(id));throw Error('private delivery error');}});
  const first = await invoke(handler,{input}),retry = await invoke(handler,{input});
  assert.equal(first.status,201);assert.equal(retry.status,200);assert.deepEqual(first.json(),retry.json());
  assert.deepEqual(Object.keys(first.json()),['status','receiptId','receivedAt']);
  assert.equal(first.json().status,'RECEIVED');assert.equal(first.headers['access-control-allow-origin'],origin);assert.equal(first.headers['cache-control'],'no-store');
  assert.equal(first.body.includes(fields.email),false);assert.equal(calls,2);
  s.db.failCommit = true;
  assert.equal((await invoke(handler)).status,503);
});

test('public transport rejects invalid origins, schema, content types, query injection and oversized/chunked bodies',async () => {
  const s = setup(),handler = handlerFor(s);
  for (const scenario of [
    {headers:{origin:'https://foreign.example'},status:403},
    {headers:{origin:undefined},status:403},
    {headers:{'content-type':'text/plain'},status:415},
    {headers:{'content-length':'17000'},status:413},
    {raw:' '.repeat(16385),status:413},
    {raw:'{',status:400},
    {input:request({websiteTrap:'spam'}),status:400},
    {url:'/api/enquiries?recipient=someone',status:400},
    {method:'GET',status:405},
    {url:'/api/enquiries/foreign',status:404}
  ]) assert.equal((await invoke(handler,scenario)).status,scenario.status);
  assert.equal(s.db.rows.size,0);
  assert.equal(enquiryRoute('/api/admin/enquiries/bad'),true);assert.equal(enquiryRoute('/api/enquiriesevil'),false);
});

test('preflight permits the exact public JSON contract and no authorization header',async () => {
  const handler = handlerFor(setup());
  const good = await invoke(handler,{method:'OPTIONS',headers:{'access-control-request-method':'POST','access-control-request-headers':'content-type'}});
  assert.equal(good.status,204);assert.equal(good.headers['access-control-allow-methods'],'POST');
  assert.equal((await invoke(handler,{method:'OPTIONS',headers:{'access-control-request-method':'POST','access-control-request-headers':'Content-Type, Authorization'}})).status,403);
});

test('private reads require the trusted owner resolver and never grant cross-origin access',async () => {
  const s = setup(),accepted = await s.store.accept(request()),handler = handlerFor(s);
  for (const authorization of [undefined,'Bearer member-token','Bearer forged-owner','Bearer bad token','Bearer ' + 'x'.repeat(8193)]) {
    const result = await invoke(handler,{method:'GET',url:'/api/admin/enquiries',headers:{authorization}});
    assert.equal(result.status,401);assert.equal(result.headers['access-control-allow-origin'],undefined);assert.equal(result.body.includes(fields.email),false);
  }
  const good = await invoke(handler,{method:'GET',url:`/api/admin/enquiries/${accepted.receiptId}`,headers:{authorization:'Bearer owner-token'}});
  assert.equal(good.status,200);assert.equal(good.json().fields.email,fields.email);assert.equal(good.headers['access-control-allow-origin'],undefined);assert.equal(good.body.includes('claimId'),false);
  assert.equal((await invoke(handler,{method:'GET',url:'/api/admin/enquiries?limit=51',headers:{authorization:'Bearer owner-token'}})).status,400);
  assert.equal((await invoke(handler,{method:'GET',url:'/api/admin/enquiries?limit=1&limit=2',headers:{authorization:'Bearer owner-token'}})).status,400);
  assert.equal((await invoke(handler,{method:'GET',url:'/api/admin/enquiries?__proto__=x',headers:{authorization:'Bearer owner-token'}})).status,400);
  assert.equal((await invoke(handler,{method:'POST',url:'/api/admin/enquiries',headers:{authorization:'Bearer owner-token'}})).status,405);
});

test('handler concurrency is bounded before another durable capture',async () => {
  const s = setup(); let release,started;
  const barrier = new Promise(resolve => {release = resolve;}),ready = new Promise(resolve => {started = resolve;});
  const handler = handlerFor(s,{maxConcurrentRequests:1,notify:async () => {started();await barrier;}});
  const first = invoke(handler);await ready;
  assert.equal((await invoke(handler)).status,429);release();assert.equal((await first).status,201);
  assert.equal([...s.db.rows.values()].filter(row => row.notification).length,1);
});

test('notification credentials failing before send stay durably pending and can later recover',async () => {
  const s = setup(),accepted = await s.store.accept(request()); let available = false,sends = 0;
  const notify = createEnquiryNotificationDispatcher({store:s.store,clock:s.clock,sender:{verifyAccess:async () => {if (!available) throw Error('private credential error');},send:async () => {sends++;return {status:'ACCEPTED',receipt:'synthetic-provider-receipt'};}}});
  assert.deepEqual(await notify(accepted.receiptId),{status:'PENDING',providerAccepted:false});
  assert.equal((await s.store.read(accepted.receiptId)).notification.lastFailure,'CREDENTIAL_UNAVAILABLE');assert.equal(sends,0);
  available = true;assert.deepEqual(await notify(accepted.receiptId),{status:'ACCEPTED',providerAccepted:true});assert.equal(sends,1);
  assert.equal((await s.store.read(accepted.receiptId)).notification.status,'ACCEPTED');
});

test('concurrent dispatch attempts send once and accepted messages are never automatically repeated',async () => {
  const s = setup(),accepted = await s.store.accept(request()); let sends = 0;
  const notify = createEnquiryNotificationDispatcher({store:s.store,clock:s.clock,sender:{verifyAccess:async () => {},send:async () => {sends++;return {status:'ACCEPTED',receipt:'synthetic-receipt'};}}});
  await Promise.all(Array.from({length:4},() => notify(accepted.receiptId)));
  await notify(accepted.receiptId);assert.equal(sends,1);
});

test('ambiguous provider outcome stays unknown and an ordinary submission retry cannot resend',async () => {
  const s = setup(),input = request(),accepted = await s.store.accept(input); let sends = 0;
  const notify = createEnquiryNotificationDispatcher({store:s.store,clock:s.clock,sender:{verifyAccess:async () => {},send:async () => {sends++;throw Error('timeout after possible send');}}});
  assert.deepEqual(await notify(accepted.receiptId),{status:'UNKNOWN',providerAccepted:false});
  await s.store.accept(input);await notify(accepted.receiptId);assert.equal(sends,1);
  const row = await s.store.read(accepted.receiptId);assert.equal(row.notification.status,'UNKNOWN');assert.equal(row.notification.lastFailure,'SEND_OUTCOME_UNKNOWN');
});

test('provider success with failed result persistence leaves an unrepeatable durable claim',async () => {
  const s = setup(),accepted = await s.store.accept(request()); let sends = 0;
  const notify = createEnquiryNotificationDispatcher({store:s.store,clock:s.clock,sender:{verifyAccess:async () => {},send:async () => {sends++;s.db.failNotificationResult = true;return {status:'ACCEPTED',receipt:'synthetic-receipt'};}}});
  assert.deepEqual(await notify(accepted.receiptId),{status:'UNKNOWN',providerAccepted:false});
  s.db.failNotificationResult = false;await notify(accepted.receiptId);assert.equal(sends,1);assert.equal((await s.store.read(accepted.receiptId)).notification.status,'UNKNOWN');
});

test('mail is fixed to configured owner recipient with no visitor headers and no provider retry',async () => {
  let calls = 0,mime = '';
  const sender = createGoogleEnquiryMailSender({authClient:{verifyAccess:async () => ({status:'MAIL_SEND_SCOPE_PRESENT_NO_MESSAGE_SENT'}),request:async options => {calls++;assert.equal(options.url,'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');assert.equal(options.retry,false);assert.equal(options.maxRedirects,0);mime = Buffer.from(options.data.raw,'base64url').toString('utf8');return {data:{id:'synthetic-receipt'}};}},senderEmail:'admin@example.test',recipientEmail:'hello@example.test',clock:() => at});
  assert.equal(calls,0);await sender.verifyAccess();assert.equal(calls,0);
  const result = await sender.send({id:'a'.repeat(64),createdAt:at,fields:{...fields,name:'Untrusted name\r\nBcc: attacker@example.test'}});
  assert.deepEqual(result,{status:'ACCEPTED',receipt:'synthetic-receipt'});assert.equal(calls,1);
  const [headers,body] = mime.split('\r\n\r\n');
  assert.match(headers,/^From: admin@example.test\r\nTo: hello@example.test\r\n/);assert.equal(headers.includes('attacker'),false);assert.equal(headers.includes(fields.email),false);
  assert.match(Buffer.from(body.replace(/\r\n/g,''),'base64').toString('utf8'),/Contact email: visitor@example.test/);
  await assert.rejects(sender.send({id:'a'.repeat(64),createdAt:at,fields,recipientEmail:'attacker@example.test'}),/INVALID_ENQUIRY_MAIL/);
  assert.throws(() => createGoogleEnquiryMailSender({authClient:{verifyAccess(){},request(){}},senderEmail:'admin@example.test\r\nBcc:x@example.test',recipientEmail:'hello@example.test',clock:() => at}),/INVALID_MAIL_CONFIGURATION/);
});
