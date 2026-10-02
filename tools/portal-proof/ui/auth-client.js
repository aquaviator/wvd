// Firebase owns authentication. WVD retains its server-side provisioning checks.
// This bounded REST client is emulator-only; it never connects to live Auth.
export function createAuthClient(config,{request,fetcher=fetch}={}) {
  if(config?.mode==='local'&&Object.keys(config).length===1)return {
    login:input=>request('/api/auth/login',input),
    redeem:input=>request('/api/auth/redeem',input),
    logout:()=>request('/api/auth/logout',{})
  };
  if(config?.mode!=='firebase-emulator'||Object.keys(config).length!==2||!/^http:\/\/(127\.0\.0\.1|localhost):([1-9][0-9]{0,4})$/.test(config.authOrigin)||Number(config.authOrigin?.split(':').at(-1))>65535)throw Error('INVALID_AUTH_CONFIGURATION');
  return {
    async login({email,password}) {
      const response=await fetcher(config.authOrigin+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000),body:JSON.stringify({email,password,returnSecureToken:true})});
      if(!response.ok)throw Error('Unable to sign in. Check your development account credentials.');
      const data=await response.json();
      if(typeof data.idToken!=='string'||data.idToken.length>8192||!data.idToken)throw Error('Unable to sign in.');
      // Do not retain refresh tokens. Expiry requires signing in again.
      return {sessionToken:data.idToken};
    },
    redeem:async()=>{throw Error('Ask your development operator to provision your account.');},
    // Ends this browser session only; server verification checks revocation.
    logout:async()=>({signedOut:true})
  };
}
