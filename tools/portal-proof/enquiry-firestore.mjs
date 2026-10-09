import {randomUUID} from 'node:crypto';
import {enquiryCollectionId,enquiryPayloadDigest,enquiryReceiptId,exactEnquiryKeys,normaliseEnquiryFields,normaliseEnquiryRequest,validEnquiryId,validEnquiryInstant,validEnquiryProduct} from './enquiry.mjs';

const DAY = 86400000;
const providerReceipt = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const knownFailures = new Set(['NOT_CONFIGURED','CREDENTIAL_UNAVAILABLE','SEND_OUTCOME_UNKNOWN']);
const publicNotification = state => ({status:state.status === 'SENDING' ? 'UNKNOWN' : state.status,updatedAt:state.updatedAt,...(state.lastFailure ? {lastFailure:state.lastFailure} : {})});

// Separate product-scoped contact records, not anonymous Portal tickets. The
// existing server-only wvd_products rules also deny direct client access here.
// Admission, content and notification intent commit atomically. Provider calls
// never occur in a Firestore transaction, whose callback may be retried.
export function createFirestoreEnquiryStore({db,productId,clock,admission,retentionDays}) {
  if (typeof db?.doc !== 'function' || typeof db?.collection !== 'function' || typeof db?.runTransaction !== 'function' || !validEnquiryProduct(productId) || typeof clock !== 'function' || !exactEnquiryKeys(admission,['minuteLimit','dailyLimit']) || !Number.isSafeInteger(admission.minuteLimit) || admission.minuteLimit < 1 || admission.minuteLimit > 1000 || !Number.isSafeInteger(admission.dailyLimit) || admission.dailyLimit < 1 || admission.dailyLimit > 10000 || !Number.isSafeInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) throw Error('INVALID_CONFIGURATION');
  const limits = {...admission};
  const path = `wvd_products/${productId}/${enquiryCollectionId(productId)}`;
  const collection = db.collection(path);
  const budgetRef = db.doc(`wvd_products/${productId}/private/enquiry-admission`);
  const now = () => { const value = clock(); if (!validEnquiryInstant(value) || Date.parse(value) < 0) throw Error('ENQUIRY_UNAVAILABLE'); return value; };
  const refFor = id => { if (!validEnquiryId(id)) throw Error('INVALID_ENQUIRY'); return db.doc(`${path}/${id}`); };

  function checkNotification(state,createdAt) {
    if (!state || typeof state !== 'object' || Array.isArray(state) || Object.keys(state).some(key => !['status','updatedAt','attempts','lastFailure','claimId','claimedAt','providerReceipt'].includes(key)) || !['PENDING','SENDING','ACCEPTED','UNKNOWN'].includes(state.status) || !validEnquiryInstant(state.updatedAt) || state.updatedAt < createdAt || ![0,1].includes(state.attempts) || (state.lastFailure !== undefined && !knownFailures.has(state.lastFailure))) throw Error('CORRUPT_ENQUIRY');
    if (state.status === 'PENDING') {
      if (state.attempts !== 0 || state.claimId !== undefined || state.claimedAt !== undefined || state.providerReceipt !== undefined || state.lastFailure === 'SEND_OUTCOME_UNKNOWN') throw Error('CORRUPT_ENQUIRY');
    } else if (state.attempts !== 1 || !uuid(state.claimId) || !validEnquiryInstant(state.claimedAt) || state.claimedAt < createdAt || state.updatedAt < state.claimedAt || (state.status === 'ACCEPTED' ? !providerReceipt(state.providerReceipt) : state.providerReceipt !== undefined)) throw Error('CORRUPT_ENQUIRY');
    return state;
  }

  function decode(document) {
    if (!document.exists) return null;
    const row = document.data();
    try {
      if (!exactEnquiryKeys(row,['schemaVersion','productId','id','payloadHash','createdAt','expiresAt','deleteAt','fields','notification']) || row.schemaVersion !== 1 || row.productId !== productId || !validEnquiryId(row.id) || document.id !== row.id || !validEnquiryId(row.payloadHash) || !validEnquiryInstant(row.createdAt) || !validEnquiryInstant(row.expiresAt) || row.expiresAt !== new Date(Date.parse(row.createdAt) + retentionDays * DAY).toISOString()) throw Error();
      const deleteAt = row.deleteAt instanceof Date ? row.deleteAt : row.deleteAt?.toDate?.();
      const normalized = normaliseEnquiryFields(row.fields);
      if (!(deleteAt instanceof Date) || deleteAt.toISOString() !== row.expiresAt || enquiryPayloadDigest(row.fields) !== row.payloadHash || Object.keys(normalized).some(key => normalized[key] !== row.fields[key])) throw Error();
      checkNotification(row.notification,row.createdAt);
      return {...row,deleteAt};
    } catch { throw Error('CORRUPT_ENQUIRY'); }
  }

  const visible = row => ({id:row.id,createdAt:row.createdAt,expiresAt:row.expiresAt,fields:structuredClone(row.fields),notification:publicNotification(row.notification)});
  function budget(document,at) {
    const epoch = Date.parse(at),minuteStart = Math.floor(epoch / 60000) * 60000,dayStart = Math.floor(epoch / DAY) * DAY;
    const old = document.exists ? document.data() : null;
    if (old && (!exactEnquiryKeys(old,['schemaVersion','productId','minuteStart','minuteCount','dayStart','dayCount','updatedAt']) || old.schemaVersion !== 1 || old.productId !== productId || ![old.minuteStart,old.minuteCount,old.dayStart,old.dayCount].every(value => Number.isSafeInteger(value) && value >= 0) || old.minuteCount > 1000 || old.dayCount > 10000 || old.minuteStart % 60000 !== 0 || old.dayStart % DAY !== 0 || !validEnquiryInstant(old.updatedAt))) throw Error('ENQUIRY_UNAVAILABLE');
    if (old && (at < old.updatedAt || minuteStart < old.minuteStart || dayStart < old.dayStart)) throw Error('ENQUIRY_UNAVAILABLE');
    const minuteCount = old?.minuteStart === minuteStart ? old.minuteCount : 0;
    const dayCount = old?.dayStart === dayStart ? old.dayCount : 0;
    if (minuteCount >= limits.minuteLimit || dayCount >= limits.dailyLimit) throw Object.assign(Error('ENQUIRY_RATE_LIMITED'),{retryAfter:Math.max(1,Math.ceil(((dayCount >= limits.dailyLimit ? dayStart + DAY : minuteStart + 60000) - epoch) / 1000))});
    return {schemaVersion:1,productId,minuteStart,minuteCount:minuteCount + 1,dayStart,dayCount:dayCount + 1,updatedAt:at};
  }

  async function cleanup({limit = 50} = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw Error('INVALID_ENQUIRY');
    const at = now();
    const found = await collection.where('expiresAt','<=',at).orderBy('expiresAt','asc').limit(limit).get();
    if (!found.docs.length) return {deleted:0,hasMore:false};
    const deleted = await db.runTransaction(async transaction => {
      const documents = await Promise.all(found.docs.map(document => transaction.get(refFor(document.id))));
      let count = 0;
      for (const document of documents) {
        const row = decode(document);
        if (row && row.expiresAt <= at) { transaction.delete(refFor(row.id)); count++; }
      }
      return count;
    },{maxAttempts:5});
    return {deleted,hasMore:found.docs.length === limit};
  }

  // Activity performs one bounded cleanup pass. A native deleteAt TTL policy or
  // a scheduled private cleanup invocation is still required during quiet time.
  async function accept(input) {
    const normalized = normaliseEnquiryRequest(input);
    const id = enquiryReceiptId(productId,normalized.requestId),payloadHash = enquiryPayloadDigest(normalized.fields),at = now();
    await cleanup();
    return db.runTransaction(async transaction => {
      const ref = refFor(id),document = await transaction.get(ref),old = decode(document);
      if (old) {
        if (old.expiresAt <= at) throw Error('ENQUIRY_EXPIRED');
        if (old.payloadHash !== payloadHash) throw Error('ENQUIRY_CONFLICT');
        return {created:false,receiptId:id,receivedAt:old.createdAt};
      }
      const budgetDocument = await transaction.get(budgetRef),nextBudget = budget(budgetDocument,at);
      const expiresAt = new Date(Date.parse(at) + retentionDays * DAY).toISOString();
      const row = {schemaVersion:1,productId,id,payloadHash,createdAt:at,expiresAt,deleteAt:new Date(expiresAt),fields:normalized.fields,notification:{status:'PENDING',updatedAt:at,attempts:0}};
      transaction.set(budgetRef,nextBudget);
      transaction.create(ref,row);
      return {created:true,receiptId:id,receivedAt:at};
    },{maxAttempts:5});
  }

  function cursorValue(value) {
    if (typeof value !== 'string' || value.length < 1 || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error('INVALID_ENQUIRY');
    try {
      const parsed = JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
      if (!exactEnquiryKeys(parsed,['v','productId','createdAt','id']) || parsed.v !== 1 || parsed.productId !== productId || !validEnquiryInstant(parsed.createdAt) || !validEnquiryId(parsed.id) || Buffer.from(JSON.stringify(parsed)).toString('base64url') !== value) throw Error();
      return parsed;
    } catch { throw Error('INVALID_ENQUIRY'); }
  }

  async function list({limit = 25,cursor} = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw Error('INVALID_ENQUIRY');
    const after = cursor === undefined ? null : cursorValue(cursor),at = now();
    await cleanup();
    let query = collection.orderBy('createdAt','desc').orderBy('__name__','desc');
    if (after) query = query.startAfter(after.createdAt,after.id);
    const documents = await query.limit(limit + 1).get();
    const rows = documents.docs.map(decode).filter(row => row && row.expiresAt > at);
    const page = rows.slice(0,limit),last = page.at(-1);
    return {enquiries:page.map(visible),nextCursor:rows.length > limit ? Buffer.from(JSON.stringify({v:1,productId,createdAt:last.createdAt,id:last.id})).toString('base64url') : null};
  }

  async function read(id) {
    const ref = refFor(id),at = now();
    await cleanup();
    const row = decode(await ref.get());
    return row && row.expiresAt > at ? visible(row) : null;
  }

  async function updateNotification(id,change) {
    const ref = refFor(id),at = now();
    return db.runTransaction(async transaction => {
      const row = decode(await transaction.get(ref));
      if (!row || row.expiresAt <= at) return {changed:false,enquiry:null};
      if (row.notification.updatedAt > at) throw Error('ENQUIRY_UNAVAILABLE');
      const result = change(row,at);
      if (result.changed) {
        checkNotification(row.notification,row.createdAt);
        transaction.set(ref,row);
      }
      return {...result,enquiry:visible(row)};
    },{maxAttempts:5});
  }

  return {
    accept,list,read,cleanup,
    async noteNotificationFailure(id,reason) {
      if (!['NOT_CONFIGURED','CREDENTIAL_UNAVAILABLE'].includes(reason)) throw Error('INVALID_ENQUIRY');
      return updateNotification(id,(row,at) => {
        if (row.notification.status !== 'PENDING') return {changed:false};
        row.notification = {...row.notification,updatedAt:at,lastFailure:reason};
        return {changed:true};
      });
    },
    async claimNotification(id) {
      const claimId = randomUUID();
      const result = await updateNotification(id,(row,at) => {
        if (row.notification.status !== 'PENDING') return {changed:false};
        row.notification = {status:'SENDING',updatedAt:at,attempts:1,claimId,claimedAt:at};
        return {changed:true,claimId};
      });
      return {...result,claimed:result.changed};
    },
    async finishNotification({id,claimId,status,receipt}) {
      if (!uuid(claimId) || !['ACCEPTED','UNKNOWN'].includes(status) || (status === 'ACCEPTED' ? !providerReceipt(receipt) : receipt !== undefined)) throw Error('INVALID_ENQUIRY');
      return updateNotification(id,(row,at) => {
        if (row.notification.status !== 'SENDING' || row.notification.claimId !== claimId) return {changed:false};
        row.notification = {...row.notification,status,updatedAt:at,...(status === 'ACCEPTED' ? {providerReceipt:receipt} : {lastFailure:'SEND_OUTCOME_UNKNOWN'})};
        return {changed:true};
      });
    }
  };
}
