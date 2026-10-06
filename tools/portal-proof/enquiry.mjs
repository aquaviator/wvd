import {createHash} from 'node:crypto';
import {validEmailAddress} from './email-address.mjs';

export const ENQUIRY_BODY_LIMIT = 16384;
export const ENQUIRY_FIELD_LIMITS = Object.freeze({name:120,business:200,email:320,need:2000,website:500,timing:300,budget:300});
const keys = Object.keys(ENQUIRY_FIELD_LIMITS);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
export const exactEnquiryKeys = (value, expected) => plain(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value,key));
export const validEnquiryId = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const validEnquiryInstant = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export const validEnquiryProduct = value => typeof value === 'string' && /^[a-z][a-z0-9-]{1,62}$/.test(value);

// Firestore TTL applies to a collection group across the entire database. Give
// each product's service enquiries a dedicated, versioned collection ID so an
// expiry policy cannot also delete unrelated generic enquiries collections.
export function enquiryCollectionId(productId) {
  if (!validEnquiryProduct(productId)) throw Error('INVALID_ENQUIRY');
  return `${productId}_service_enquiries_v1`;
}

// This intentionally mirrors the public brief's existing bounds. It does not
// qualify leads, verify a mailbox, create a booking or consent to marketing.
export function normaliseEnquiryFields(input) {
  if (!exactEnquiryKeys(input,keys)) throw Error('INVALID_ENQUIRY');
  const fields = {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value !== 'string' || value.length > ENQUIRY_FIELD_LIMITS[key] || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) || /[\ud800-\udfff]/u.test(value)) throw Error('INVALID_ENQUIRY');
    fields[key] = value.trim();
  }
  if (['name','business','email','need'].some(key => !fields[key]) || !validEmailAddress(fields.email)) throw Error('INVALID_ENQUIRY');
  if (fields.website) {
    let url;
    try { url = new URL(fields.website); } catch { throw Error('INVALID_ENQUIRY'); }
    if (!['https:','http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw Error('INVALID_ENQUIRY');
  }
  return fields;
}

export function normaliseEnquiryRequest(input) {
  if (!exactEnquiryKeys(input,['requestId','fields','websiteTrap']) || typeof input.requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.requestId) || input.websiteTrap !== '') throw Error('INVALID_ENQUIRY');
  return {requestId:input.requestId,fields:normaliseEnquiryFields(input.fields),websiteTrap:''};
}

export function enquiryPayloadDigest(fields) {
  return createHash('sha256').update(JSON.stringify(normaliseEnquiryFields(fields))).digest('hex');
}

export function enquiryReceiptId(productId,requestId) {
  if (!validEnquiryProduct(productId) || typeof requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(requestId)) throw Error('INVALID_ENQUIRY');
  return createHash('sha256').update(JSON.stringify(['wvd-enquiry-v1',productId,requestId])).digest('hex');
}
