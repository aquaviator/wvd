import {createFirebaseInvitationIdentityResolver} from './firebase-auth.mjs';
import {createFirebaseInvitations} from './firebase-invitations.mjs';

export const clientInvitationPolicy=Object.freeze({ref:'wvd-client-v1-seven-days',maxLifetimeMs:7*24*60*60*1000});

// Firebase proves identity; the current WVD aggregate proves product access.
// A stored admin flag on any other UID never substitutes for the owner binding.
export function createLiveClientAccess({auth,portal,resolveOwnerSession,maxConcurrentRequests=8}) {
  const googleAuth={verifyIdToken:async(raw,revoked)=>{
    const token=await auth.verifyIdToken(raw,revoked);
    return token?.firebase?.sign_in_provider==='google.com'?token:null;
  },getUser:uid=>auth.getUser(uid)};
  const resolveIdentity=createFirebaseInvitationIdentityResolver({auth:googleAuth});
  let active=0;
  const resolveSession=async raw=>{
    if(active>=maxConcurrentRequests)throw Error('IDENTITY_SERVICE_UNAVAILABLE');
    active++;
    try {
      const owner=await resolveOwnerSession(raw);if(owner)return owner;
      const proof=await resolveIdentity(raw);if(!proof)return null;
      try {
        const access=await portal.workspaceAccess(proof.actorId);
        if(access.admin)return null;
        return {actorId:proof.actorId,liveClient:true};
      }catch(error){if(['ACCESS_DENIED','IDENTITY_DISABLED'].includes(error?.message))return null;throw error;}
    }finally{active--;}
  };
  // Only the bound WVD owner can issue/list/revoke. Redemption requires the
  // invited, currently verified Google email and rechecks issuer authority.
  const invitations=createFirebaseInvitations({auth,resolveSession:resolveOwnerSession,resolveInvitationIdentity:resolveIdentity,
    portal:{
      memberInvitationsFor:(...args)=>portal.memberInvitationsFor(...args),
      createMemberInvitation:(...args)=>portal.createClientInvitation(...args),
      memberInvitationRecord:(...args)=>portal.memberInvitationRecord(...args),
      redeemMemberInvitation:(...args)=>portal.redeemMemberInvitation(...args),
      revokeMemberInvitation:(...args)=>portal.revokeMemberInvitation(...args)
    }});
  return {resolveSession,invitations};
}
