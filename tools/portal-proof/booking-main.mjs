import {readFile} from 'node:fs/promises';
import {GoogleAuth} from 'google-auth-library';
import {createKeylessCalendarAuthClients} from './google-keyless-calendar-auth.mjs';
import {createFirestoreBookingRuntime} from './booking-runtime.mjs';
import {createBookingServer} from './booking-server.mjs';
let runtime,server;
try{
 // Cloud Run's attached identity only. No user gcloud login or supplied key file.
 if(!process.env.K_SERVICE||process.env.GOOGLE_APPLICATION_CREDENTIALS!==undefined||process.argv.length!==3)throw Error('ATTACHED_RUNTIME_IDENTITY_REQUIRED');
 const raw=await readFile(process.argv[2],'utf8');if(Buffer.byteLength(raw)>16384)throw Error('INVALID_CONFIGURATION');const document=JSON.parse(raw);
 if(!document||Object.keys(document).sort().join(',')!=='authentication,runtime'||Object.keys(document.authentication??{}).sort().join(',')!=='serviceAccount,subject'||document.runtime?.firebase?.mode!=='live')throw Error('INVALID_CONFIGURATION');
 const {serviceAccount,subject}=document.authentication,auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']});
 const credentials=await auth.getCredentials();if(credentials.client_email!==serviceAccount||credentials.private_key)throw Error('RUNTIME_IDENTITY_MISMATCH');
 const signer=await auth.getClient(),clock=()=>new Date().toISOString();
 const clients=createKeylessCalendarAuthClients({signer,serviceAccount,subject,calendarId:document.runtime.calendarId,clock});
 runtime=await createFirestoreBookingRuntime({config:document.runtime,...clients,clock});server=createBookingServer(runtime);
 const port=Number(process.env.PORT??8080);if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('INVALID_CONFIGURATION');
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',resolve);});
 console.log('BOOKING_RUNTIME_LISTENING');
 let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await runtime.close();};
 process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop());
}catch{server?.closeAllConnections();server?.close();if(runtime)await runtime.close().catch(()=>{});console.error('BOOKING_RUNTIME_START_FAILED_CHECK_TARGET_IDENTITY_AND_CONFIGURATION');process.exitCode=1;}
