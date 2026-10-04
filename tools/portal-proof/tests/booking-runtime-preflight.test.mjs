import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bookingRuntimePreflight} from '../../google-development-access/booking-runtime-preflight.mjs';
const binding=JSON.parse(readFileSync(new URL('../../google-development-access/binding.json',import.meta.url),'utf8'));
test('runtime discovery reports actual missing authority without mutating or revealing credentials',async()=>{
 const requests=[],report=await bookingRuntimePreflight(binding,'synthetic-token',{request:async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify(url.includes('firestore.googleapis.com')?{name:'projects/wvd-development/databases/(default)',type:'FIRESTORE_NATIVE',locationId:'eur3'}:{permissions:[]}));}});
 assert.equal(report.changesMade,false);assert.equal(report.spendAuthorised,false);assert.deepEqual(report.results.map(x=>x.status),['ADMIN_GRANT_REQUIRED','PASS','ADMIN_GRANT_REQUIRED']);assert.equal(JSON.stringify(report).includes('synthetic-token'),false);assert.equal(requests.length,3);assert.ok(requests.every(x=>x.options.method==='GET'||x.url.endsWith(':testIamPermissions')));
});
