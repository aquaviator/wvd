import {describe,it,expect} from 'vitest';
import {buildEnquiryDraft,normaliseEnquiryFields,type EnquiryFields} from '../src/lib/contact/enquiry';
import {enquiryReference,prepareEnquirySubmission,readEnquiryReceipt} from '../src/lib/contact/submission';
import {normaliseEnquiryRequest} from '../tools/portal-proof/enquiry.mjs';
const fields={name:'Synthetic visitor',business:'Synthetic business',email:'visitor@example.test',need:'A clearer website',website:'',timing:'',budget:''};
describe('general enquiry draft',()=>{
 it('keeps timing/budget/site optional and prepares only a reviewable email',()=>{const result=buildEnquiryDraft(fields,'hello@wearvalleydigital.com');expect(result.subject).toBe('General project enquiry');expect(result.body).toContain('A clearer website');expect(result.body).not.toContain('Budget context:');expect(result.mailto).toMatch(/^mailto:hello@wearvalleydigital.com\?/);});
 it('encodes user text into the body without adding email headers or rejecting uncertain budgets',()=>{const result=buildEnquiryDraft({...fields,business:'Synthetic\nBcc: foreign@example.test',budget:'Not sure yet',need:'A&B? Need #1'},'hello@wearvalleydigital.com');const url=new URL(result.mailto!);expect([...url.searchParams.keys()]).toEqual(['subject','body']);expect(url.searchParams.get('subject')).toBe('General project enquiry');expect(url.searchParams.get('body')).toContain('Not sure yet');expect(url.searchParams.get('body')).toContain('A&B? Need #1');});
 it('preserves a long Unicode enquiry for manual copying instead of truncating the mail URL',()=>{const need='界'.repeat(1500),result=buildEnquiryDraft({...fields,need},'hello@wearvalleydigital.com');expect(result.mailto).toBeNull();expect(result.body).toContain(need);});
 it('requires core fields and refuses executable or credential-bearing website links',()=>{for(const input of [{...fields,name:''},{...fields,website:'javascript:alert(1)'},{...fields,website:'https://user:password@example.test/'},{...fields,email:'a@example.test\nBcc: b@example.test'}])expect(()=>buildEnquiryDraft(input,'hello@wearvalleydigital.com')).toThrow();expect(()=>buildEnquiryDraft(fields,'hello?bcc=foreign@example.test')).toThrow();});
});

const requestId='39cc67bf-fb2d-47d2-9be2-a0617110b575';
const receipt={status:'RECEIVED' as const,receiptId:'0123456789abcdef'.repeat(4),receivedAt:'2026-10-06T16:00:00.000Z'};

describe('direct enquiry submission',()=>{
 it('prepares the exact public API contract without requiring optional budget, timing or website',()=>{
  const result=prepareEnquirySubmission({...fields,name:'  Synthetic visitor  ',need:' A clearer website for a café 😀. '},requestId);
  expect(Object.keys(result).sort()).toEqual(['fields','requestId','websiteTrap']);
  expect(Object.keys(result.fields).sort()).toEqual(['budget','business','email','name','need','timing','website']);
  expect(result).toEqual({requestId,websiteTrap:'',fields:{...fields,name:'Synthetic visitor',need:'A clearer website for a café 😀.'}});
  expect(normaliseEnquiryRequest(result)).toEqual(result);
 });
 it('preserves the caller-owned request ID and byte-stable normalized content for an uncertain retry',()=>{
  const source={...fields,timing:' Flexible ',budget:' Not sure yet '};
  const first=prepareEnquirySubmission(source,requestId),retry=prepareEnquirySubmission(source,requestId);
  expect(JSON.stringify(retry)).toBe(JSON.stringify(first));
  expect(first.fields.budget).toBe('Not sure yet');
  expect(source.timing).toBe(' Flexible ');
  expect(normaliseEnquiryRequest(first)).toEqual(first);
 });
 it('rejects invalid idempotency IDs and a populated honeypot before a request can be prepared',()=>{
  for(const id of ['',requestId.toUpperCase(),'39cc67bf-fb2d-17d2-9be2-a0617110b575','39cc67bf-fb2d-47d2-7be2-a0617110b575','../another-id'])expect(()=>prepareEnquirySubmission(fields,id)).toThrow();
  expect(()=>prepareEnquirySubmission(fields,requestId,'https://bot.example.test')).toThrow();
 });
 it('rejects unknown/missing fields, excessive input, controls and unsafe websites',()=>{
  const missing:Partial<EnquiryFields>={...fields};delete missing.email;
  const invalid:unknown[]=[null,[],missing,{...fields,recipientEmail:'foreign@example.test'},{...fields,name:' '},{...fields,need:'x'.repeat(2001)},{...fields,budget:'x'.repeat(301)},{...fields,need:'invalid\u0000value'},{...fields,need:'invalid\ud800value'},{...fields,website:'javascript:alert(1)'},{...fields,website:'https://user:password@example.test/'},{...fields,email:'visitor@example.test\r\nBcc: foreign@example.test'}];
  for(const value of invalid)expect(()=>prepareEnquirySubmission(value as EnquiryFields,requestId)).toThrow();
  expect(normaliseEnquiryFields({...fields,budget:'Unsure; happy to discuss'}).budget).toBe('Unsure; happy to discuss');
 });
});

describe('durable enquiry receipt',()=>{
 it('accepts the exact durable receipt and derives a readable reference without customer data',()=>{
  expect(readEnquiryReceipt(receipt)).toEqual(receipt);
  expect(enquiryReference(receipt)).toBe('WVD-0123456789AB');
 });
 it('rejects incomplete, noncanonical or merely sent/queued responses instead of confirming receipt',()=>{
  for(const value of [null,[],true,'RECEIVED',{}, {...receipt,status:'SENT'}, {...receipt,status:'QUEUED'}, {...receipt,status:'received'}, {...receipt,receiptId:'a'.repeat(63)}, {...receipt,receiptId:'A'.repeat(64)}, {...receipt,receiptId:'g'.repeat(64)}, {...receipt,receivedAt:'2026-10-06T16:00:00Z'}, {...receipt,receivedAt:'2026-10-06T17:00:00.000+01:00'}, {...receipt,receivedAt:'not-a-date'}, {...receipt,receivedAt:1791302400000}, {...receipt,messageSent:true}, {status:'RECEIVED',receiptId:receipt.receiptId}])expect(()=>readEnquiryReceipt(value)).toThrow('RECEIPT_NOT_CONFIRMED');
 });
});
