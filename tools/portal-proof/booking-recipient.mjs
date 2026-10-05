import {createFirebaseInvitationIdentityResolver} from './firebase-auth.mjs';
// Optional adapter for an already-authenticated customer. Reuse the existing
// fresh verified-account proof; this does not provision portal access or require
// registration for booking. The request separately proves its booking capability.
export function createFirebaseBookingRecipientResolver({auth,projectId}){
 if(typeof auth?.verifyIdToken!=='function'||typeof auth?.getUser!=='function'||auth.app?.options?.projectId!==projectId||typeof projectId!=='string'||!/^[a-z][a-z0-9-]{4,62}$/.test(projectId))throw Error('INVALID_RECIPIENT_CONFIGURATION');
 const resolve=createFirebaseInvitationIdentityResolver({auth:{
  async verifyIdToken(proof,checkRevoked){
   const identity=await auth.verifyIdToken(proof,checkRevoked);
   if(identity?.aud!==projectId||identity.iss!=='https://securetoken.google.com/'+projectId||identity.sub!==identity.uid||identity.firebase?.tenant!==undefined)throw Object.assign(Error('INVALID_IDENTITY'),{code:'auth/invalid-id-token'});
   return identity;
  },
  getUser:uid=>auth.getUser(uid)
 }});
 return async({proof,reservationId})=>{
  if(typeof proof!=='string'||!proof.length||proof.length>4096||typeof reservationId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(reservationId))return {verified:false};
  const identity=await resolve(proof);
  return identity?{verified:true,email:identity.email}:{verified:false};
 };
}
