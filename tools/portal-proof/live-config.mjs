import {firebaseConfiguration} from './firebase-config.mjs';
import {validFirebaseEmail} from './firebase-user.mjs';

const exact=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...names].sort().join(',');
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const httpsOrigin=value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.origin===value&&!url.username&&!url.password&&url.hostname.includes('.')&&url.hostname!=='localhost'&&!url.hostname.endsWith('.localhost')&&!/^\d+(?:\.\d+){3}$/.test(url.hostname);}catch{return false;}};
export function ownerBinding(value) {
  if(value===null)return null;
  if(!exact(value,['uid','email'])||typeof value.uid!=='string'||!value.uid||value.uid.length>128||/[\s/\\]/.test(value.uid)||!validFirebaseEmail(value.email))throw Error('INVALID_OWNER_BINDING');
  return Object.freeze({...value});
}
export function livePortalConfiguration(value,env=process.env) {
  if(!exact(value,['origin','firebase','web','owner','maxConcurrentRequests']))throw Error('INVALID_LIVE_CONFIGURATION');
  if(!httpsOrigin(value.origin))throw Error('INVALID_LIVE_CONFIGURATION');
  const firebase=firebaseConfiguration(value.firebase,env);
  if(firebase.mode!=='live')throw Error('LIVE_FIREBASE_REQUIRED');
  const web=value.web;
  if(!exact(web,['projectId','apiKey','authDomain','appId'])||web.projectId!==firebase.projectId||web.authDomain!==`${firebase.projectId}.firebaseapp.com`||typeof web.apiKey!=='string'||!/^AIza[A-Za-z0-9_-]{30,80}$/.test(web.apiKey)||typeof web.appId!=='string'||!/^1:\d+:web:[A-Za-z0-9]+$/.test(web.appId))throw Error('INVALID_FIREBASE_WEB_CONFIGURATION');
  if(!Number.isSafeInteger(value.maxConcurrentRequests)||value.maxConcurrentRequests<1||value.maxConcurrentRequests>32)throw Error('INVALID_LIVE_CONFIGURATION');
  return Object.freeze({origin:value.origin,firebase,web:Object.freeze({...web}),owner:ownerBinding(value.owner),maxConcurrentRequests:value.maxConcurrentRequests});
}

// Pure validation shared with deployment tooling. This accepts configuration
// references only; no credentials, provider calls, or default account targets.
export function liveServiceConfiguration(value,env=process.env) {
  if(!exact(value,['authentication','portal','enquiries','mail'])||!exact(value.authentication,['serviceAccount']))throw Error('INVALID_LIVE_CONFIGURATION');
  const portal=livePortalConfiguration(value.portal,env),serviceAccount=value.authentication.serviceAccount;
  if(typeof serviceAccount!=='string'||!new RegExp(`^[a-z][a-z0-9-]{4,28}[a-z0-9]@${portal.firebase.projectId}\\.iam\\.gserviceaccount\\.com$`).test(serviceAccount))throw Error('INVALID_RUNTIME_IDENTITY');
  const enquiry=value.enquiries;
  if(!exact(enquiry,['allowedPublicOrigins','admission','maxConcurrentRequests','retentionDays'])||!Array.isArray(enquiry.allowedPublicOrigins)||enquiry.allowedPublicOrigins.length<1||enquiry.allowedPublicOrigins.length>8||new Set(enquiry.allowedPublicOrigins).size!==enquiry.allowedPublicOrigins.length||!enquiry.allowedPublicOrigins.every(httpsOrigin)||!exact(enquiry.admission,['minuteLimit','dailyLimit'])||!integer(enquiry.admission.minuteLimit,1,60)||!integer(enquiry.admission.dailyLimit,enquiry.admission.minuteLimit,1000)||!integer(enquiry.maxConcurrentRequests,1,20)||enquiry.maxConcurrentRequests>portal.maxConcurrentRequests||!integer(enquiry.retentionDays,1,365))throw Error('INVALID_ENQUIRY_CONFIGURATION');
  const address=value=>validFirebaseEmail(value)&&/^[\x21-\x7e]+$/.test(value)&&!/[<>(),;:"\\]/.test(value);
  const mail=value.mail;
  if(mail!==null&&(!exact(mail,['subject','senderEmail','recipientEmail','requestTimeoutMs'])||!address(mail.subject)||!address(mail.senderEmail)||!address(mail.recipientEmail)||!integer(mail.requestTimeoutMs,1,15000)))throw Error('INVALID_MAIL_CONFIGURATION');
  return Object.freeze({authentication:Object.freeze({serviceAccount}),portal,enquiries:Object.freeze({...enquiry,allowedPublicOrigins:Object.freeze([...enquiry.allowedPublicOrigins]),admission:Object.freeze({...enquiry.admission})}),mail:mail===null?null:Object.freeze({...mail})});
}
