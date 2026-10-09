import {createGoogleBookingKeyReader} from './google-booking-key.mjs';
import {createBookingDeliveryCipher} from './booking-delivery-envelope.mjs';

// Envelope aliases are stable identifiers, never caller-selected Google paths.
// Retained versions may be opened; only the explicitly active alias seals.
export function createGoogleBookingCipher({authClient,projectId,secretId,activeKey,versions,requestTimeoutMs=10000}) {
 if(!versions||Object.getPrototypeOf(versions)!==Object.prototype||Object.keys(versions).length<1||Object.keys(versions).length>10||!Object.hasOwn(versions,activeKey)||Object.entries(versions).some(([alias,version])=>!/^[A-Za-z0-9_-]{1,128}$/.test(alias)||typeof version!=='string'||!/^[1-9][0-9]{0,15}$/.test(version)))throw Error('INVALID_KEY_CONFIGURATION');
 const bound=new Map(Object.entries(versions));
 const read=createGoogleBookingKeyReader({authClient,projectId,secretId,requestTimeoutMs});
 const resolve=async alias=>{
  if(!bound.has(alias))throw Error('BOOKING_KEY_UNAVAILABLE');
  return read(`projects/${projectId}/secrets/${secretId}/versions/${bound.get(alias)}`);
 };
 const cipher=createBookingDeliveryCipher({keyRef:activeKey,readKey:resolve,consumeKey:true});
 return {...cipher,async verifyAccess(){
  const key=await resolve(activeKey);
  try{return {status:'CONFIRMATION_KEY_ACCESS_PASS',activeKey,version:bound.get(activeKey),writesPerformed:false};}
  finally{key.fill(0);}
 }};
}
