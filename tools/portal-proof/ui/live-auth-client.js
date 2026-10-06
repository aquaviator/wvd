// Separate live Google client. The local/emulator client remains isolated.
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const message=error=>({
  'auth/popup-closed-by-user':'Sign-in was cancelled. You can try again.',
  'auth/cancelled-popup-request':'Sign-in was cancelled. You can try again.',
  'auth/popup-blocked':'Allow the Google sign-in window, then try again.',
  'auth/unauthorized-domain':'Sign-in is not configured for this address yet. Please contact WVD.'
}[error?.code]??'Unable to sign in right now. Please try again.');

export async function createLiveAuthClient(config,{loadSdk=()=>import('./firebase-auth-sdk.js')}={}) {
  if(!exact(config,['mode','firebase','ownerConfigured','enquiriesEnabled'])||config.mode!=='firebase-live'||typeof config.ownerConfigured!=='boolean'||typeof config.enquiriesEnabled!=='boolean')throw Error('INVALID_AUTH_CONFIGURATION');
  const web=config.firebase;
  if(!exact(web,['projectId','apiKey','authDomain','appId'])||typeof web.projectId!=='string'||!/^[a-z][a-z0-9-]{5,29}$/.test(web.projectId)||web.projectId.startsWith('demo-')||web.authDomain!==`${web.projectId}.firebaseapp.com`||typeof web.apiKey!=='string'||!/^AIza[A-Za-z0-9_-]{30,80}$/.test(web.apiKey)||typeof web.appId!=='string'||!/^1:\d+:web:[A-Za-z0-9]+$/.test(web.appId))throw Error('INVALID_AUTH_CONFIGURATION');
  const sdk=await loadSdk();
  const app=sdk.initializeApp({...web},'wvd-owner-portal');
  const auth=sdk.initializeAuth(app,{persistence:sdk.inMemoryPersistence,popupRedirectResolver:sdk.browserPopupRedirectResolver});
  const provider=new sdk.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  let user=null,generation=0;
  const clear=async()=>{generation++;user=null;await sdk.signOut(auth);};
  const token=async()=>{
    if(!user||auth.currentUser?.uid!==user.uid)throw Error('Please sign in again.');
    const current=user,attempt=generation,raw=await current.getIdToken();
    if(attempt!==generation||user!==current||auth.currentUser?.uid!==current.uid||typeof raw!=='string'||!raw||raw.length>8192||/\s/.test(raw))throw Error('Please sign in again.');
    return raw;
  };
  return {
    async login() {
      const attempt=++generation;
      try {
        const result=await sdk.signInWithPopup(auth,provider);
        if(attempt!==generation||result?.user?.emailVerified!==true||typeof result.user.getIdToken!=='function')throw Error();
        user=result.user;
        return {sessionToken:await token()};
      }catch(error){if(attempt===generation)await clear().catch(()=>{});throw Error(message(error));}
    },
    async getSessionToken(){const attempt=generation;try {return await token();}catch {if(attempt===generation)await clear().catch(()=>{});throw Error('Please sign in again.');}},
    async logout(){try{await clear();return {signedOut:true};}catch{throw Error('Signed out of this page. Reload before signing in again.');}}
  };
}
