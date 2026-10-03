import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
// Reused from the local proof for invitation links; not a replacement for Firebase
// ID tokens. Persist only the digest. Expiry/consumption belong to the transaction.
export const isOpaqueToken=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
export const createOpaqueToken=()=>randomBytes(32).toString('base64url');
export function opaqueTokenDigest(value) {
  if(typeof value!=='string')throw Error('INVALID_TOKEN');
  return createHash('sha256').update(value).digest('hex');
}
export function matchesOpaqueToken(raw,digest) {
  if(!isOpaqueToken(raw)||typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest))return false;
  return timingSafeEqual(Buffer.from(opaqueTokenDigest(raw),'hex'),Buffer.from(digest,'hex'));
}
