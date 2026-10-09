import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createInvitationHandler} from '../invitation-http.mjs';
import {createApplication} from '../app.mjs';
const origin='https://client.wearvalleydigital.com',token='a'.repeat(43);
async function invoke(patch={},body={token},failure){
  const calls=[],service=Object.fromEntries(['create','redeem','revoke','list'].map(action=>[action,async(...args)=>{calls.push({action,args});if(failure)throw Error(failure);return {ok:true};}]));
  const request=Object.assign(Readable.from([Buffer.from(typeof body==='string'?body:JSON.stringify(body))]),{url:'/api/invitations/redeem',method:'POST',headers:{origin,authorization:'Bearer verified','content-type':'application/json'},...patch});
  const result={},response={headersSent:false,writeHead(status,headers){Object.assign(result,{status,headers});this.headersSent=true;},end(raw){result.data=JSON.parse(raw);},destroy(){result.destroyed=true;}};
  await createInvitationHandler({invitations:service,allowedOrigin:origin})(request,response);return {result,calls};
}
test('redemption passes trusted bearer to the invitation identity service',async()=>{const {result,calls}=await invoke();assert.equal(result.status,200);assert.equal(result.headers['Cache-Control'],'no-store');assert.deepEqual(calls,[{action:'redeem',args:['verified',token]}]);});
test('creation and revocation preserve exact typed service inputs',async()=>{const input={businessId:'b',email:'member@example.test',projectIds:['p'],expiresAt:'2026-10-03T12:00:00.000Z',operationId:'op'};let out=await invoke({url:'/api/invitations/create'},input);assert.equal(out.result.status,200);assert.deepEqual(out.calls[0].args,['verified',input]);out=await invoke({url:'/api/invitations/revoke'},{invitationId:'invitation-1'});assert.deepEqual(out.calls[0].args,['verified','invitation-1']);});
for(const [name,patch,body,status] of [
 ['query token',{url:'/api/invitations/redeem?token=secret'},{token},400],
 ['wrong method',{method:'GET'},{token},405],
 ['wrong origin',{headers:{origin:'https://evil.example'}},{token},403],
 ['missing bearer',{headers:{origin}},{token},401],
 ['actor injection',{}, {token,actorId:'owner'},400],
 ['invalid token',{}, {token:'short'},400],
 ['invalid JSON',{}, '{',400],
 ['oversized body',{}, ' '.repeat(8193),413],
 ['unknown route',{url:'/api/invitations/inspect'},{token},404],
 ['role injection',{url:'/api/invitations/create'},{businessId:'b',email:'x@example.test',projectIds:['p'],expiresAt:'future',operationId:'o',role:'Owner'},400]
])test(`${name} cannot reach invitation service`,async()=>{const out=await invoke(patch,body);assert.equal(out.result.status,status);assert.deepEqual(out.calls,[]);});
test('service errors do not disclose mailbox, token or private state',async()=>{for(const [failure,status,error]of [['INVITATION_RECIPIENT_MISMATCH',403,'INVITATION_DENIED'],['UNAUTHENTICATED',401,'UNAUTHENTICATED'],['private credential detail',503,'SERVICE_UNAVAILABLE']]){const out=await invoke({}, {token},failure);assert.equal(out.result.status,status);assert.deepEqual(out.result.data,{error});}});
test('application cannot enable invitation endpoints outside isolated emulator mode',()=>assert.throws(()=>createApplication({allowedOrigin:origin,invitations:{}}),/ISOLATED_EMULATORS_REQUIRED/));

test('invitation listing uses authenticated service and an exact project selector',async()=>{const out=await invoke({url:'/api/invitations/list'},{projectId:'p'});assert.equal(out.result.status,200);assert.deepEqual(out.calls,[{action:'list',args:['verified','p']}]);});
