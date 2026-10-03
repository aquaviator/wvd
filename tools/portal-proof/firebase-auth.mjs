// Adapted from Human V1's FirebaseAuthRepository: Firebase sign-in alone is
// insufficient; a current trusted product identity must also be provisioned.
// The Firebase Admin SDK verifies issuer/audience/signature/expiry and revocation.
const invalid = new Set(['auth/argument-error','auth/invalid-id-token','auth/id-token-expired',
  'auth/id-token-revoked','auth/user-disabled','auth/user-not-found']);
function tokenVerifier(auth) {
  if(typeof auth?.verifyIdToken!=='function')throw Error('INVALID_CONFIGURATION');
  return async raw=>{
    if(typeof raw!=='string'||!raw||raw.length>8192||/\s/.test(raw))return null;
    let decoded;
    try {decoded=await auth.verifyIdToken(raw,true);}
    catch(error){if(invalid.has(error?.code))return null;throw Error('IDENTITY_SERVICE_UNAVAILABLE');}
    if(typeof decoded?.uid!=='string'||!decoded.uid||decoded.uid.length>128||decoded.email_verified!==true||!['google.com','password'].includes(decoded.firebase?.sign_in_provider))return null;
    return decoded;
  };
}
export function createFirebaseSessionResolver({auth,portal}) {
  if(typeof portal?.activeIdentity!=='function')throw Error('INVALID_CONFIGURATION');
  const verify=tokenVerifier(auth);
  return async raw=>{
    const decoded=await verify(raw);if(!decoded)return null;
    // Actor ID equals the verified Firebase UID. No client-selected mapping or
    // custom JWT role confers permissions. Domain transactions recheck access.
    return await portal.activeIdentity(decoded.uid)?{actorId:decoded.uid}:null;
  };
}
// Separate pre-provisioning identity proof for invitation redemption. It must
// never replace the normal portal session resolver or grant permissions alone.
export function createFirebaseInvitationIdentityResolver({auth}) {
  if(typeof auth?.getUser!=='function')throw Error('INVALID_CONFIGURATION');
  const verify=tokenVerifier(auth);
  return async raw=>{
    const decoded=await verify(raw);if(!decoded||typeof decoded.email!=='string'||!decoded.email||decoded.email.length>320)return null;
    let user;
    try{user=await auth.getUser(decoded.uid);}catch(error){if(invalid.has(error?.code))return null;throw Error('IDENTITY_SERVICE_UNAVAILABLE');}
    if(user?.uid!==decoded.uid||user.disabled||user.emailVerified!==true||user.email!==decoded.email||!user.providerData?.some(x=>['google.com','password'].includes(x.providerId)))return null;
    return {actorId:decoded.uid,email:user.email};
  };
}
