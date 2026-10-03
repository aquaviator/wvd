import {colleagueAccessRequest} from './colleague-access.mjs';
import {adminAccessRequest} from './admin-access.mjs';
import {accessGrant} from './access.mjs';
// Trusted operator APIs, never attached to a client HTTP route. They use the
// explicitly bound Auth/Firestore instances of the selected Google backend.
export async function verifiedFirebaseUser(auth,uid) {
  let user;
  try {user=await auth.getUser(uid);} catch(error) {
    if(error?.code==='auth/user-not-found')throw Error('FIREBASE_USER_REQUIRED');
    throw Error('IDENTITY_SERVICE_UNAVAILABLE');
  }
  if(user?.uid!==uid||user.disabled||user.emailVerified!==true||typeof user.email!=='string'||!user.email||!user.providerData?.some(item=>['google.com','password'].includes(item.providerId)))throw Error('VERIFIED_FIREBASE_USER_REQUIRED');
}
export function createFirebaseProvisioner({auth,portal}) {
  if(typeof auth?.getUser!=='function'||typeof portal?.provisionAccess!=='function')throw Error('INVALID_CONFIGURATION');
  return async (request,expectedRevision,context)=>{
    const grant=accessGrant(request);
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('ACCESS_REVISION_REQUIRED');
    await verifiedFirebaseUser(auth,grant.uid);
    // Later requests recheck Auth state. No users, credentials or claims are created.
    return portal.provisionAccess(grant,expectedRevision,context);
  };
}
export function createFirebaseAccessUpdater({auth,portal}) {
  if(typeof auth?.getUser!=='function'||typeof portal?.snapshot!=='function'||typeof portal?.updateAccess!=='function')throw Error('INVALID_CONFIGURATION');
  return async (request,expectedRevision,context)=>{
    const grant=accessGrant(request,{allowEmpty:true});
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('ACCESS_REVISION_REQUIRED');
    const state=await portal.snapshot(),member=state.memberships.find(x=>x.actorId===grant.uid&&x.businessId===grant.businessId);
    if(!member)throw Error('ACCESS_MEMBERSHIP_REQUIRED');
    if(member.role!==grant.role)throw Error('ACCESS_ROLE_CONFLICT');
    if(grant.projectIds.some(id=>state.projects.find(x=>x.id===id)?.businessId!==grant.businessId))throw Error('PROJECT_SCOPE_DENIED');
    const added=grant.projectIds.some(id=>!member.projectIds.includes(id));
    if(added){if(!member.active)throw Error('ACCESS_REVOKED');if(!state.identities.find(x=>x.id===grant.uid)?.active)throw Error('IDENTITY_DISABLED');await verifiedFirebaseUser(auth,grant.uid);}
    // Removal-only changes work even when Auth has disabled/deleted the account.
    // Commit rechecks the exact aggregate revision and existing role/scope.
    return portal.updateAccess(grant,expectedRevision,context);
  };
}

// Firebase SDK work stays outside retryable database transactions. The adapter
// checks current admin capability again when committing the audited mutation.
export function createFirebaseAdminAccessUpdater({auth,portal}) {
  if(typeof auth?.getUser!=='function'||typeof portal?.updateAccessAsAdmin!=='function'||typeof portal?.workspaceAccess!=='function'||typeof portal?.snapshot!=='function')throw Error('INVALID_CONFIGURATION');
  const commit=portal.updateAccessAsAdmin.bind(portal);
  return async request=>{
    const {actorId,expectedRevision,...grant}=adminAccessRequest(request);
    if(!(await portal.workspaceAccess(actorId)).admin)throw Error('ACCESS_DENIED');
    const update=createFirebaseAccessUpdater({auth,portal:{snapshot:()=>portal.snapshot(),updateAccess:(checked,revision)=>commit({actorId,expectedRevision:revision,...checked})}});
    return update(grant,expectedRevision);
  };
}

export function createFirebaseColleagueAccessUpdater({auth,portal}) {
  if(typeof auth?.getUser!=='function'||typeof portal?.updateColleagueAccess!=='function'||typeof portal?.colleagueAccessGrant!=='function'||typeof portal?.snapshot!=='function')throw Error('INVALID_CONFIGURATION');
  const commit=portal.updateColleagueAccess.bind(portal);
  return async request=>{
    const input=colleagueAccessRequest(request),grant=await portal.colleagueAccessGrant(input);
    const update=createFirebaseAccessUpdater({auth,portal:{snapshot:()=>portal.snapshot(),updateAccess:()=>commit(input)}});
    return update(grant,input.expectedRevision);
  };
}
