import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {firebaseConfiguration} from './firebase-config.mjs';
import {FirestoreBookingReservations} from './booking-reservations.mjs';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
function binding(value) {
 if(!value||Object.keys(value).sort().join(',')!=='calendarId,databaseId,mode,productId,projectId'||typeof value.calendarId!=='string'||!value.calendarId.length||value.calendarId.length>256||/[\s\x00-\x1f\x7f]/.test(value.calendarId))throw Error('INVALID_BOOKING_BACKUP');
 const {calendarId,...config}=value;
 const checked=firebaseConfiguration(config,config.mode==='emulator'?{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9097',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8087'}:{});
 return {...checked,calendarId};
}
// Pure read-only use of the existing journal codec; no provider SDK or network.
async function checkedSchedule(schedule,target) {
 if(!schedule||Object.keys(schedule).sort().join(',')!=='binding,reservations,schemaVersion'||Object.keys(schedule.binding??{}).sort().join(',')!=='calendarId,productId'||Buffer.byteLength(JSON.stringify(schedule))>131072)throw Error('INVALID_BOOKING_BACKUP');
 const db={doc:path=>({path}),runTransaction:async callback=>callback({get:async()=>({exists:true,data:()=>structuredClone(schedule)}),set:()=>{throw Error('READ_ONLY_REHEARSAL');},create:()=>{throw Error('READ_ONLY_REHEARSAL');}})};
 const store=new FirestoreBookingReservations({db,productId:target.productId,calendarId:target.calendarId,backupBinding:target});
 return (await store.backupSnapshot()).schedule;
}
const payload=value=>({schemaVersion:1,kind:'WVD_BOOKING_JOURNAL_BACKUP',binding:binding(value.binding),exportedAt:value.exportedAt,scheduleJson:value.scheduleJson});
export async function createBookingBackup({schedule,binding:target,exportedAt}) {
 if(!instant(exportedAt))throw Error('INVALID_BOOKING_BACKUP');
 const checked=binding(target),state=await checkedSchedule(schedule,checked);
 const data=payload({binding:checked,exportedAt,scheduleJson:JSON.stringify(state)});
 return JSON.stringify({...data,digest:hash(data)});
}
export async function verifyBookingBackup(raw,expectedBinding) {
 if(typeof raw!=='string'||Buffer.byteLength(raw)>135168)throw Error('INVALID_BOOKING_BACKUP');
 let envelope,data;
 try{
  envelope=JSON.parse(raw);
  if(!envelope||Object.keys(envelope).sort().join(',')!=='binding,digest,exportedAt,kind,scheduleJson,schemaVersion'||envelope.schemaVersion!==1||envelope.kind!=='WVD_BOOKING_JOURNAL_BACKUP'||!instant(envelope.exportedAt)||typeof envelope.scheduleJson!=='string'||Buffer.byteLength(envelope.scheduleJson)>131072)throw Error();
  data=payload(envelope);if(envelope.digest!==hash(data))throw Error();
 }catch{throw Error('INVALID_BOOKING_BACKUP');}
 if(!isDeepStrictEqual(data.binding,binding(expectedBinding)))throw Error('BACKUP_SCOPE_DENIED');
 let schedule;try{schedule=await checkedSchedule(JSON.parse(data.scheduleJson),data.binding);}catch{throw Error('INVALID_BOOKING_BACKUP');}
 return {binding:data.binding,schedule,digest:envelope.digest,exportedAt:data.exportedAt};
}
export async function exportBookingBackup(store,expectedBinding,clock) {
 const target=binding(expectedBinding);
 if(typeof store?.backupSnapshot!=='function'||typeof clock!=='function')throw Error('INVALID_BOOKING_BACKUP');
 const snapshot=await store.backupSnapshot();
 if(!isDeepStrictEqual(binding(snapshot.binding),target))throw Error('BACKUP_SCOPE_DENIED');
 return createBookingBackup({...snapshot,exportedAt:clock()});
}
const report=verified=>({verified:true,digest:verified.digest,reservations:verified.schedule.reservations.length,activeHolds:verified.schedule.reservations.filter(x=>!['CANCELLED','REJECTED'].includes(x.phase)).length,cancelled:verified.schedule.reservations.filter(x=>x.phase==='CANCELLED').length,liveWrites:false});
export async function rehearseBookingBackup(raw,expectedBinding) {
 return report(await verifyBookingBackup(raw,expectedBinding));
}
// Actual Firestore restore/reopen proof, only in a random named emulator DB.
// No caller-selected restore destination, live option or active-journal overwrite.
export async function rehearseFirestoreBookingBackup(raw,expectedBinding) {
 const verified=await verifyBookingBackup(raw,expectedBinding),{calendarId,...source}=verified.binding;
 if(source.mode!=='emulator')throw Error('ISOLATED_EMULATORS_REQUIRED');
 firebaseConfiguration(source);
 const target={...source,databaseId:'booking-restore-'+randomUUID(),calendarId};
 const {initializeApp,deleteApp}=await import('firebase-admin/app');
 const {getFirestore}=await import('firebase-admin/firestore');
 const app=initializeApp({projectId:target.projectId},'booking-restore-'+randomUUID()),db=getFirestore(app,target.databaseId);
 const ref=db.doc('wvd_calendar_schedules/'+createHash('sha256').update(calendarId).digest('hex'));let created=false;
 try{
  await ref.create(verified.schedule);created=true;
  const reopened=new FirestoreBookingReservations({db,productId:target.productId,calendarId,backupBinding:target});
  const restored=await reopened.backupSnapshot();
  if(!isDeepStrictEqual(restored.schedule,verified.schedule))throw Error('BACKUP_REHEARSAL_FAILED');
  return report(verified);
 }finally{
  try{if(created)await ref.delete();}finally{try{await db.terminate();}finally{await deleteApp(app);}}
 }
}
