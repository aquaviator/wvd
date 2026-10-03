import test from 'node:test';
import assert from 'node:assert/strict';
import {rehearseFirestoreBackup} from '../firestore-rehearsal.mjs';

test('Firestore restore rehearsal rejects live, remote and corrupt sources before SDK access',async()=>{
  const saved={auth:process.env.FIREBASE_AUTH_EMULATOR_HOST,firestore:process.env.FIRESTORE_EMULATOR_HOST};
  try {
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;delete process.env.FIRESTORE_EMULATOR_HOST;
    await assert.rejects(()=>rehearseFirestoreBackup('{}',{projectId:'wvd-development',productId:'wvd-test',databaseId:'(default)',mode:'live'}),/ISOLATED_EMULATORS_REQUIRED/);
    const binding={projectId:'demo-wvd-portal',productId:'wvd-test',databaseId:'(default)',mode:'emulator'};
    process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';process.env.FIRESTORE_EMULATOR_HOST='remote.example:8080';
    await assert.rejects(()=>rehearseFirestoreBackup('{}',binding),/ISOLATED_EMULATORS_REQUIRED/);
    process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
    await assert.rejects(()=>rehearseFirestoreBackup('{}',binding),/INVALID_BACKUP/);
  }finally {
    for(const [key,value]of [['FIREBASE_AUTH_EMULATOR_HOST',saved.auth],['FIRESTORE_EMULATOR_HOST',saved.firestore]])if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
