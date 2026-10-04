import {createHash} from 'node:crypto';
// A shared global budget, not an IP identity claim or a CAPTCHA. No forwarded
// header is trusted. One bounded document per product and calendar; no TTL sweep.
export function createFirestoreBookingAdmission({db,productId,calendarId,clock,windowMs,maxRequests}){
 if(typeof db?.doc!=='function'||typeof db?.runTransaction!=='function'||typeof productId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(productId)||typeof calendarId!=='string'||!calendarId.length||calendarId.length>256||typeof clock!=='function'||!Number.isSafeInteger(windowMs)||windowMs<1000||windowMs>3600000||!Number.isSafeInteger(maxRequests)||maxRequests<1||maxRequests>10000)throw Error('INVALID_CONFIGURATION');
 const binding={productId,calendarId,windowMs,maxRequests},ref=db.doc('wvd_booking_admission/'+createHash('sha256').update(calendarId).digest('hex'));
 return async()=>{
  const now=clock();if(typeof now!=='string'||!Number.isFinite(Date.parse(now))||new Date(now).toISOString()!==now)throw Error('ADMISSION_UNAVAILABLE');
  const epoch=Date.parse(now);if(epoch<0)throw Error('ADMISSION_UNAVAILABLE');
  return db.runTransaction(async tx=>{
   const doc=await tx.get(ref),row=doc.exists?doc.data():null;
   if(row&&(!row.binding||Object.keys(row.binding).sort().join(',')!==Object.keys(binding).sort().join(',')||Object.keys(binding).some(k=>row.binding[k]!==binding[k])||Object.keys(row).sort().join(',')!=='binding,count,windowStart'||!Number.isSafeInteger(row.count)||row.count<0||row.count>maxRequests||!Number.isSafeInteger(row.windowStart)||row.windowStart<0))throw Error('ADMISSION_UNAVAILABLE');
   if(row&&epoch<row.windowStart)return false;
   const current=row&&epoch-row.windowStart<windowMs?row:{binding,windowStart:epoch,count:0};
   if(current.count>=maxRequests)return false;
   current.count++;if(doc.exists)tx.set(ref,current);else tx.create(ref,current);return true;
  },{maxAttempts:5});
 };
}
