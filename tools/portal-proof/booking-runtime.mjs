import {randomUUID} from 'node:crypto';
import {firebaseConfiguration} from './firebase-config.mjs';
import {FirestoreBookingReservations,createReservedIntroCallBooking,createIntroCallBookingReconciler,createReservedIntroCallCancellation} from './booking-reservations.mjs';
import {createGoogleBookingRuntimeCalendar} from './google-booking-read-client.mjs';
import {createGoogleCallEvidenceReader} from './google-calendar-evidence.mjs';
import {createIntroCallScreening} from './call-screening.mjs';
import {createGovukHolidayEvidenceReader} from './govuk-holiday-evidence.mjs';
import {createGoogleBookingEventWriter} from './google-booking-event.mjs';
import {createGoogleBookingCancellation} from './google-booking-cancellation.mjs';
import {createGoogleBookingRescheduler} from './google-booking-reschedule.mjs';
import {createGoogleRescheduleScreening} from './google-reschedule-screening.mjs';
import {createReservedIntroCallRescheduler} from './booking-reschedule.mjs';
import {createBookingManagement} from './booking-management.mjs';
import {createFirestoreBookingAdmission} from './booking-admission.mjs';
// No default targets or credentials. Pure composition remains independently
// testable; the Firestore entry point below selects the actual SDK target.
export function composeBookingRuntime({db,config,eventAuthClient,freeBusyAuthClient,clock,readHolidays}){
 if(!config||Object.keys(config).sort().join(',')!=='admission,calendarId,calendarIds,firebase,linkLifetimeMs,maxConcurrentRequests,maxQueryWindowMs,origin,policy,requestTimeoutMs'||typeof clock!=='function'||typeof readHolidays!=='function'||!Number.isSafeInteger(config.maxConcurrentRequests)||config.maxConcurrentRequests<1||config.maxConcurrentRequests>100||!config.admission||Object.keys(config.admission).sort().join(',')!=='maxRequests,windowMs')throw Error('INVALID_CONFIGURATION');
 const bound=structuredClone(config);
 firebaseConfiguration(bound.firebase,bound.firebase?.mode==='emulator'?{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9097',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8087'}:{});
 const {productId}=bound.firebase,calendarId=bound.calendarId;
 let origin;try{origin=new URL(bound.origin);}catch{throw Error('INVALID_CONFIGURATION');}
 if(origin.origin!==bound.origin||!['emulator','live'].includes(bound.firebase.mode)||bound.firebase.mode==='live'&&origin.protocol!=='https:'||bound.firebase.mode==='emulator'&&(origin.protocol!=='http:'||!['localhost','127.0.0.1'].includes(origin.hostname)))throw Error('INVALID_CONFIGURATION');
 const calendar=createGoogleBookingRuntimeCalendar({eventAuthClient,freeBusyAuthClient,calendarId,calendarIds:bound.calendarIds,maxQueryWindowMs:bound.maxQueryWindowMs});
 const common={calendar,calendarId,calendarIds:bound.calendarIds,productId,clock,policy:bound.policy,maxQueryWindowMs:bound.maxQueryWindowMs,requestTimeoutMs:bound.requestTimeoutMs};
 const store=new FirestoreBookingReservations({db,productId,calendarId,backupBinding:{...bound.firebase,calendarId}});
 const evidence=createGoogleCallEvidenceReader(common),screen=createIntroCallScreening({...common,readEvidence:evidence});
 const readCurrentHolidays=()=>readHolidays();
 const book=createReservedIntroCallBooking({store,productId,screen:async({starts})=>screen({starts,holidayEvidence:await readCurrentHolidays()}),writeEvent:createGoogleBookingEventWriter(common)});
 const reconcile=createIntroCallBookingReconciler({...common,store});
 const cancel=createReservedIntroCallCancellation({store,productId,clock,cancelEvent:createGoogleBookingCancellation(common)});
 const screenReschedule=createGoogleRescheduleScreening({...common,readHolidays:readCurrentHolidays});
 const reschedule=createReservedIntroCallRescheduler({store,productId,screen:screenReschedule,provider:createGoogleBookingRescheduler(common)});
 const management=createBookingManagement({store,productId,calendarId,managementOrigin:bound.origin,clock,linkLifetimeMs:bound.linkLifetimeMs,cancel,reschedule,screenReschedule});
 const admit=createFirestoreBookingAdmission({db,productId,calendarId,clock,...bound.admission}),maxConcurrentRequests=bound.maxConcurrentRequests;
 return {binding:bound,store,calendar,management,admit,callAvailability:{screen,readHolidayEvidence:readCurrentHolidays,maxConcurrentRequests,admit},callBooking:{productId,calendarId,book,reconcile,cancel,reschedule,admit,maxConcurrentRequests},callManagement:{productId,calendarId,management,admit,maxConcurrentRequests}};
}
export async function createFirestoreBookingRuntime({config,eventAuthClient,freeBusyAuthClient,clock=()=>new Date().toISOString()}){
 const firebase=firebaseConfiguration(config?.firebase);
 // Validate all composition before loading SDKs or acquiring live credentials.
 composeBookingRuntime({db:{doc:()=>({}),runTransaction:()=>{throw Error('PREFLIGHT_ONLY');}},config,eventAuthClient,freeBusyAuthClient,clock,readHolidays:async()=>{throw Error('PREFLIGHT_ONLY');}});
 const {initializeApp,applicationDefault,deleteApp}=await import('firebase-admin/app');
 const {getFirestore}=await import('firebase-admin/firestore');
 const app=initializeApp({projectId:firebase.projectId,...(firebase.mode==='live'?{credential:applicationDefault()}:{})},'booking-'+randomUUID());
 const db=getFirestore(app,firebase.databaseId);
 try{
  const runtime=composeBookingRuntime({db,config,eventAuthClient,freeBusyAuthClient,clock,readHolidays:createGovukHolidayEvidenceReader({clock,requestTimeoutMs:config.requestTimeoutMs})});
  return {...runtime,close:async()=>{try{await db.terminate();}finally{await deleteApp(app);}}};
 }catch(error){try{await db.terminate();}finally{await deleteApp(app);}throw error;}
}
