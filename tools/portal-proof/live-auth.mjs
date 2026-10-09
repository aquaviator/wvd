import {createFirebaseInvitationIdentityResolver} from './firebase-auth.mjs';
import {ownerBinding} from './live-config.mjs';

// The configured owner is an operator binding, never a request or token role.
// Reuse the existing revoked-token and current Firebase-account proof checks.
export function createLiveOwnerResolver({auth,portal,owner,maxConcurrentRequests}) {
  const binding=ownerBinding(owner);
  if(typeof auth?.verifyIdToken!=='function'||typeof auth?.getUser!=='function'||typeof portal?.workspaceAccess!=='function'||!Number.isSafeInteger(maxConcurrentRequests)||maxConcurrentRequests<1||maxConcurrentRequests>32)throw Error('INVALID_CONFIGURATION');
  if(binding===null)return async()=>null;
  const proofFor=createFirebaseInvitationIdentityResolver({auth:{
    verifyIdToken:async(raw,revoked)=>{
      const decoded=await auth.verifyIdToken(raw,revoked);
      return decoded?.firebase?.sign_in_provider==='google.com'&&decoded.uid===binding.uid?decoded:null;
    },
    getUser:uid=>auth.getUser(uid)
  }});
  let active=0;
  return async raw=>{
    if(active>=maxConcurrentRequests)throw Error('IDENTITY_SERVICE_UNAVAILABLE');
    active++;
    try {
      const proof=await proofFor(raw);
      if(!proof||proof.actorId!==binding.uid||proof.email!==binding.email)return null;
      try {
        const access=await portal.workspaceAccess(binding.uid);
        return access.admin===true?{actorId:binding.uid}:null;
      }catch(error){if(['ACCESS_DENIED','IDENTITY_DISABLED'].includes(error?.message))return null;throw Error('IDENTITY_SERVICE_UNAVAILABLE');}
    }finally {active--;}
  };
}
