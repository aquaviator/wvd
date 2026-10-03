import {createOpaqueToken,opaqueTokenDigest,matchesOpaqueToken} from './opaque-token.mjs';
import {verifiedFirebaseUser} from './firebase-provisioning.mjs';
// Google service, optionally wired into the isolated emulator HTTP application.
// No email delivery is connected here.
// Auth reads happen outside retried transactions; domain checks run at commit.
export function createFirebaseInvitations({auth,portal,resolveSession,resolveInvitationIdentity}) {
  if(typeof auth?.getUser!=='function'||typeof portal?.memberInvitationsFor!=='function'||typeof portal?.createMemberInvitation!=='function'||typeof portal?.memberInvitationRecord!=='function'||typeof portal?.redeemMemberInvitation!=='function'||typeof portal?.revokeMemberInvitation!=='function'||typeof resolveSession!=='function'||typeof resolveInvitationIdentity!=='function')throw Error('INVALID_CONFIGURATION');
  return {
    async list(rawSession,projectId){
      const session=await resolveSession(rawSession);if(!session)throw Error('UNAUTHENTICATED');
      return portal.memberInvitationsFor(session.actorId,projectId);
    },
    async create(rawSession,input){
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='businessId,email,expiresAt,operationId,projectIds')throw Error('INVALID_INVITATION');
      const session=await resolveSession(rawSession);if(!session)throw Error('UNAUTHENTICATED');
      await verifiedFirebaseUser(auth,session.actorId);
      const token=createOpaqueToken(),result=await portal.createMemberInvitation({...input,actorId:session.actorId,tokenHash:opaqueTokenDigest(token)});
      return {created:result.created,invitationId:result.invitation.id,expiresAt:result.invitation.expiresAt,token:result.created&&matchesOpaqueToken(token,result.invitation.tokenHash)?token:null};
    },
    async redeem(rawIdentity,token){
      const identity=await resolveInvitationIdentity(rawIdentity);if(!identity)throw Error('UNAUTHENTICATED');
      const record=await portal.memberInvitationRecord(token);
      if(record.email.toLowerCase()!==identity.email.toLowerCase())throw Error('INVITATION_RECIPIENT_MISMATCH');
      if(record.status==='pending')await verifiedFirebaseUser(auth,record.actorId);
      return portal.redeemMemberInvitation({token,recipientId:identity.actorId,email:identity.email});
    },
    async revoke(rawSession,invitationId){
      const session=await resolveSession(rawSession);if(!session)throw Error('UNAUTHENTICATED');
      await verifiedFirebaseUser(auth,session.actorId);
      return portal.revokeMemberInvitation({actorId:session.actorId,invitationId});
    }
  };
}
