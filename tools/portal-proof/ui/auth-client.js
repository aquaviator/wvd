// Firebase owns authentication. WVD retains its server-side provisioning checks.
// This bounded REST client is emulator-only; it never connects to live Auth.
export function createAuthClient(config,{request,fetcher=fetch}={}) {
  if(config?.mode==='local'&&Object.keys(config).length===1)return {
    login:input=>request('/api/auth/login',input),
    redeem:input=>request('/api/auth/redeem',input),
    logout:()=>request('/api/auth/logout',{})
  };
  if(config?.mode!=='firebase-emulator'||Object.keys(config).length!==2||!/^http:\/\/(127\.0\.0\.1|localhost):([1-9][0-9]{0,4})$/.test(config.authOrigin)||Number(config.authOrigin?.split(':').at(-1))>65535)throw Error('INVALID_AUTH_CONFIGURATION');
  const call=async(action,body,message)=>{
    const response=await fetcher(config.authOrigin+'/identitytoolkit.googleapis.com/v1/accounts:'+action+'?key=emulator-only',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000),body:JSON.stringify(body)});
    if(!response.ok)throw Error(message);return response.json();
  };
  const idToken=data=>{if(typeof data.idToken!=='string'||data.idToken.length>8192||!data.idToken)throw Error('Unable to sign in.');return data.idToken;};
  const credentials=input=>{if(!input||Object.keys(input).sort().join(',')!=='email,password'||typeof input.email!=='string'||input.email.length>320||!input.email||typeof input.password!=='string'||input.password.length<15||input.password.length>1024)throw Error('Enter an email and a password of at least 15 characters.');return {email:input.email,password:input.password,returnSecureToken:true};};
  return {
    async login({email,password}) {
      const data=await call('signInWithPassword',{email,password,returnSecureToken:true},'Unable to sign in. Check your development account credentials.');
      // Do not retain refresh tokens. Expiry requires signing in again.
      return {sessionToken:idToken(data)};
    },
    async register(input){
      const data=await call('signUp',credentials(input),'Unable to create the development account. Try signing in if it already exists.');
      await call('sendOobCode',{requestType:'VERIFY_EMAIL',idToken:idToken(data)},'Account created, but verification could not be requested. Sign in to request verification again.');
      return {verificationRequested:true};
    },
    async requestVerification({email,password}){
      const data=await call('signInWithPassword',{email,password,returnSecureToken:true},'Unable to sign in for verification.');
      await call('sendOobCode',{requestType:'VERIFY_EMAIL',idToken:idToken(data)},'Unable to request verification.');return {verificationRequested:true};
    },
    async confirmVerification({code}){
      if(typeof code!=='string'||!code||code.length>2048)throw Error('Enter a valid verification code.');
      const data=await call('update',{oobCode:code},'Unable to verify the development account. Request a new verification code.');
      if(data.emailVerified!==true)throw Error('Unable to verify the development account.');return {verified:true};
    },
    redeem:async()=>{throw Error('Ask your development operator to provision your account.');},
    // Ends this browser session only; server verification checks revocation.
    logout:async()=>({signedOut:true})
  };
}
