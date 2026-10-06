import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {liveServiceConfiguration} from './live-config.mjs';
import {createLiveOwnerResolver} from './live-auth.mjs';
import {createLivePortalApplication} from './live-app.mjs';
import {createFirestoreEnquiryStore} from './enquiry-firestore.mjs';
import {createEnquiryHandler,enquiryRoute} from './enquiry-http.mjs';
import {createEnquiryNotificationDispatcher,createGoogleEnquiryMailSender} from './enquiry-mail.mjs';
import {createKeylessMailAuthClient} from './google-keyless-mail-auth.mjs';

export async function readLiveServiceConfiguration({env=process.env,args=process.argv.slice(2),read=readFile}={}) {
  const supplied=env.WVD_SERVICE_CONFIG_JSON;
  if((supplied!==undefined&&args.length!==0)||(supplied===undefined&&args.length!==1))throw Error('INVALID_CONFIGURATION_SOURCE');
  const raw=supplied===undefined?await read(args[0],'utf8'):supplied;
  if(typeof raw!=='string'||Buffer.byteLength(raw)<2||Buffer.byteLength(raw)>16384)throw Error('INVALID_LIVE_CONFIGURATION');
  let document;try{document=JSON.parse(raw);}catch{throw Error('INVALID_LIVE_CONFIGURATION');}
  return liveServiceConfiguration(document,env);
}

export function composeLiveService({config,backend,signer,clock,browserBundle}) {
  const checked=liveServiceConfiguration(config);
  if(typeof backend?.close!=='function'||typeof clock!=='function'||(checked.mail!==null&&typeof signer?.request!=='function'))throw Error('INVALID_CONFIGURATION');
  const resolveOwnerSession=createLiveOwnerResolver({auth:backend.auth,portal:backend.portal,owner:checked.portal.owner,maxConcurrentRequests:checked.portal.maxConcurrentRequests});
  const store=createFirestoreEnquiryStore({db:backend.db,productId:checked.portal.firebase.productId,clock,admission:checked.enquiries.admission,retentionDays:checked.enquiries.retentionDays});
  let notify;
  if(checked.mail!==null){
    const {subject,senderEmail,recipientEmail,requestTimeoutMs}=checked.mail;
    const authClient=createKeylessMailAuthClient({signer,serviceAccount:checked.authentication.serviceAccount,subject,clock});
    const sender=createGoogleEnquiryMailSender({authClient,senderEmail,recipientEmail,requestTimeoutMs,clock});
    notify=createEnquiryNotificationDispatcher({store,sender,clock});
  }
  const enquiryHandler=createEnquiryHandler({store,resolveOwnerSession,allowedPublicOrigins:checked.enquiries.allowedPublicOrigins,maxConcurrentRequests:checked.enquiries.maxConcurrentRequests,notify});
  const server=createLivePortalApplication({portal:backend.portal,resolveOwnerSession,config:checked.portal,enquiryHandler,enquiryRoute,browserBundle});
  return {server,close:()=>backend.close()};
}

// Live startup uses the Cloud Run attached identity only. Reading configuration
// and constructing handlers never seeds identities or sends a notification.
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  let backend,runtime;
  try {
    if(!process.env.K_SERVICE||process.env.GOOGLE_APPLICATION_CREDENTIALS!==undefined)throw Error('ATTACHED_RUNTIME_IDENTITY_REQUIRED');
    const config=await readLiveServiceConfiguration();
    const port=Number(process.env.PORT??8080);
    if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('INVALID_LIVE_CONFIGURATION');
    const {GoogleAuth}=await import('google-auth-library');
    const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']});
    const credentials=await auth.getCredentials();
    if(credentials.client_email!==config.authentication.serviceAccount||credentials.private_key)throw Error('RUNTIME_IDENTITY_MISMATCH');
    const signer=config.mail===null?undefined:await auth.getClient();
    const {createFirebaseBackend}=await import('./firebase-backend.mjs');
    backend=createFirebaseBackend(config.portal.firebase);
    const browserBundle=await readFile(new URL('../portal-runtime/dist/firebase-auth-sdk.js',import.meta.url));
    runtime=composeLiveService({config,backend,signer,clock:()=>new Date().toISOString(),browserBundle});
    await new Promise((resolve,reject)=>{runtime.server.once('error',reject);runtime.server.listen(port,'0.0.0.0',resolve);});
    console.log(JSON.stringify({event:'WVD_SERVICE_LISTENING',ownerConfigured:config.portal.owner!==null,providerAccessChecked:false}));
    let stopping=false;
    const stop=async()=>{if(stopping)return;stopping=true;runtime.server.closeAllConnections();await new Promise(resolve=>runtime.server.close(resolve));await runtime.close();};
    process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop());
  }catch {
    runtime?.server.closeAllConnections();runtime?.server.close();if(backend)await backend.close().catch(()=>{});
    console.error('WVD_SERVICE_START_FAILED_CHECK_TARGET_IDENTITY_AND_CONFIGURATION');process.exitCode=1;
  }
}
