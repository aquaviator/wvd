import test from 'node:test';
import assert from 'node:assert/strict';
import {accessReport} from '../../google-development-access/access-report.mjs';
const env={GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',ACCESS_RESOURCE_RESULT:'success',ACCESS_WRITER_RESULT:'success',ACCESS_CONFIRMATION_RESULT:'success',ACCESS_RUNTIME_RESULT:'success',ACCESS_MAIL_RESULT:'success',SECRET_TOKEN:'never-copy'};
test('access receipt binds run and commit without copying credentials or promoting skipped checks',()=>{
 const at='2026-10-05T15:00:00.000Z',r=accessReport(env,at);assert.equal(r.allPassed,true);assert.equal(JSON.stringify(r).includes('never-copy'),false);assert.equal(r.grantsPermission,false);
 const failed=accessReport({...env,ACCESS_MAIL_RESULT:'failure',ACCESS_RUNTIME_RESULT:'skipped'},at);assert.equal(failed.allPassed,false);assert.equal(failed.results[3].status,'NOT_CHECKED');assert.equal(failed.results[4].status,'FAIL');
 assert.throws(()=>accessReport({...env,GITHUB_SHA:'other'},at));assert.throws(()=>accessReport({...env,ACCESS_MAIL_RESULT:'secret-provider-body'},at));
});
