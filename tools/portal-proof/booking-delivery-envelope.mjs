import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
const ref=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const base64=(value,max)=>typeof value==='string'&&value.length<=max&&/^[A-Za-z0-9+/]*={0,2}$/.test(value)&&Buffer.from(value,'base64').toString('base64')===value;
export function validDeliveryEnvelope(value){return Boolean(value&&Object.keys(value).sort().join(',')==='ciphertext,iv,keyRef,tag'&&ref(value.keyRef)&&base64(value.iv,16)&&Buffer.from(value.iv,'base64').length===12&&base64(value.tag,24)&&Buffer.from(value.tag,'base64').length===16&&base64(value.ciphertext,16384)&&value.ciphertext.length>0);}
// Explicit keys supplied by the runtime's approved secret mechanism. No key
// generation/defaults, key logging or plaintext persistence in this adapter.
export function createBookingDeliveryCipher({keyRef,readKey}){
 if(!ref(keyRef)||typeof readKey!=='function')throw Error('INVALID_CONFIGURATION');
 const key=async ref=>{const result=await readKey(ref);if(!Buffer.isBuffer(result)||result.length!==32)throw Error('DELIVERY_KEY_UNAVAILABLE');return Buffer.from(result);};
 const aad=value=>{if(typeof value!=='string'||!value.length||Buffer.byteLength(value)>1024)throw Error('INVALID_DELIVERY_CONTEXT');return Buffer.from(value);};
 return {
  async seal(plaintext,context){
   if(typeof plaintext!=='string'||!plaintext.length||Buffer.byteLength(plaintext)>12288)throw Error('INVALID_DELIVERY_PAYLOAD');
   const bound=aad(context),secret=await key(keyRef);
   try{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(bound);const ciphertext=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);return {keyRef,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};}finally{secret.fill(0);}
  },
  async open(envelope,context){
   if(!validDeliveryEnvelope(envelope))throw Error('INVALID_DELIVERY_PAYLOAD');
   const bound=aad(context),secret=await key(envelope.keyRef);
   try{const cipher=createDecipheriv('aes-256-gcm',secret,Buffer.from(envelope.iv,'base64'));cipher.setAAD(bound);cipher.setAuthTag(Buffer.from(envelope.tag,'base64'));return Buffer.concat([cipher.update(Buffer.from(envelope.ciphertext,'base64')),cipher.final()]).toString('utf8');}catch{throw Error('INVALID_DELIVERY_PAYLOAD');}finally{secret.fill(0);}
  }
 };
}
