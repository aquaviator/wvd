import {normaliseEnquiryFields,type EnquiryFields} from './enquiry';

export type EnquirySubmission={requestId:string;fields:EnquiryFields;websiteTrap:string};
export type EnquiryReceipt={status:'RECEIVED';receiptId:string;receivedAt:string};

export function prepareEnquirySubmission(fields:EnquiryFields,requestId:string,websiteTrap=''):EnquirySubmission{
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(requestId)||websiteTrap!=='')throw Error('Please check the enquiry and try again.');
  return {requestId,fields:normaliseEnquiryFields(fields),websiteTrap};
}

export function readEnquiryReceipt(value:unknown):EnquiryReceipt{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('RECEIPT_NOT_CONFIRMED');
  const receipt=value as Record<string,unknown>;
  if(Object.keys(receipt).sort().join(',')!=='receiptId,receivedAt,status'||receipt.status!=='RECEIVED'||typeof receipt.receiptId!=='string'||!/^[a-f0-9]{64}$/.test(receipt.receiptId)||typeof receipt.receivedAt!=='string'||!Number.isFinite(Date.parse(receipt.receivedAt))||new Date(receipt.receivedAt).toISOString()!==receipt.receivedAt)throw Error('RECEIPT_NOT_CONFIRMED');
  return receipt as EnquiryReceipt;
}

export function enquiryReference(receipt:EnquiryReceipt):string{
  return `WVD-${readEnquiryReceipt(receipt).receiptId.slice(0,12).toUpperCase()}`;
}
