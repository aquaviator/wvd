// Trusted operator API, never attached to a client HTTP route. Uses the same
// explicitly bound Auth and Firestore instances as the verified server backend.
export function createFirebaseProvisioner({auth,portal}) {
  if(typeof auth?.getUser!=='function'||typeof portal?.provisionAccess!=='function')throw Error('INVALID_CONFIGURATION');
  return async (request,expectedRevision)=>{
    if(typeof request?.uid!=='string'||!request.uid.trim()||request.uid.length>128)throw Error('INVALID_ACCESS_GRANT');
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('ACCESS_REVISION_REQUIRED');
    let user;
    try {user=await auth.getUser(request.uid);} catch(error) {
      if(error?.code==='auth/user-not-found')throw Error('FIREBASE_USER_REQUIRED');
      throw Error('IDENTITY_SERVICE_UNAVAILABLE');
    }
    if(user?.uid!==request.uid||user.disabled||user.emailVerified!==true||typeof user.email!=='string'||!user.email||!user.providerData?.some(item=>['google.com','password'].includes(item.providerId)))throw Error('VERIFIED_FIREBASE_USER_REQUIRED');
    // Auth state is rechecked at each subsequent server request. This read
    // neither creates users nor changes credentials, roles or custom claims.
    return portal.provisionAccess(request,expectedRevision);
  };
}
