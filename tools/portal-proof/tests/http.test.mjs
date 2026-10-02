import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createPortalHandler} from '../http.mjs';
import {PortalProof} from '../domain.mjs';

function fixture() {
  return new PortalProof({identities:[{id:'owner',active:true}],projects:[{id:'p',businessId:'b'}],memberships:[{actorId:'owner',businessId:'b',role:'Owner',active:true,projectIds:['p']}],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]},()=> '2026-10-02T11:00:00Z');
}
async function invoke(patch={}, chunks, portal=fixture()) {
  const body=JSON.stringify({projectId:'p',milestoneId:'m',versionId:'v',operationId:'o'});
  const request=Object.assign(Readable.from(chunks ?? [Buffer.from(body)]),{
    url:'/api/portal/approve',method:'POST',headers:{authorization:'Bearer verified',origin:'https://client.wearvalleydigital.com','content-type':'application/json'},...patch
  });
  const result={};
  const response={headersSent:false,writeHead(status,headers){result.status=status;result.headers=headers;this.headersSent=true;},end(text){result.data=JSON.parse(text);},destroy(){result.destroyed=true;}};
  const handle=createPortalHandler({portal,allowedOrigin:'https://client.wearvalleydigital.com',resolveSession:async token=>token==='verified'?{actorId:'owner'}:null});
  await handle(request,response);return {result,portal};
}
test('HTTP approval uses verified bearer session and durable-domain result',async()=>{const {result,portal}=await invoke();assert.equal(result.status,200);assert.equal(result.data.actorId,'owner');assert.equal(result.headers['Cache-Control'],'no-store');assert.equal(result.headers['X-Content-Type-Options'],'nosniff');assert.equal(portal.snapshot().receipts.length,1);});
test('GET reads canonical query parameters without a body',async()=>{const {result}=await invoke({url:'/api/portal/overview?projectId=p',method:'GET'},[]);assert.equal(result.status,200);assert.equal(result.data.projectId,'p');});
for(const [name,patch,status,chunks] of [
  ['missing authorization',{headers:{}},401],
  ['unknown token',{headers:{authorization:'Bearer wrong',origin:'https://client.wearvalleydigital.com','content-type':'application/json'}},401],
  ['wrong origin',{headers:{authorization:'Bearer verified',origin:'https://evil.example','content-type':'application/json'}},403],
  ['unsupported media',{headers:{authorization:'Bearer verified','content-type':'text/plain'}},415],
  ['query on write',{url:'/api/portal/approve?actorId=owner'},400],
  ['duplicate query',{url:'/api/portal/overview?projectId=p&projectId=foreign',method:'GET'},400,[]],
  ['prototype query',{url:'/api/portal/overview?projectId=p&__proto__=x',method:'GET'},400,[]],
  ['unknown path',{url:'/api/admin/seed'},404],
  ['oversized chunks',{},413,[Buffer.alloc(16000,32),Buffer.alloc(17000,32)]],
  ['declared oversized',{headers:{authorization:'Bearer verified','content-type':'application/json','content-length':'32769'}},413],
  ['length mismatch',{headers:{authorization:'Bearer verified','content-type':'application/json','content-length':'1'}},400],
  ['actor injection',{},400,[Buffer.from('{"actorId":"owner","projectId":"p","milestoneId":"m","versionId":"v","operationId":"o"}')]]
]) test(`${name} rejects without mutation`,async()=>{const portal=fixture();const before=portal.snapshot();const {result}=await invoke(patch,chunks,portal);assert.equal(result.status,status);assert.deepEqual(portal.snapshot(),before);});
test('Broken request stream produces sanitised failure and no mutation',async()=>{const portal=fixture();const before=portal.snapshot();const chunks=(async function*(){throw new Error('private upstream detail');})();const {result}=await invoke({},chunks,portal);assert.equal(result.status,503);assert.deepEqual(result.data,{error:'SERVICE_UNAVAILABLE'});assert.deepEqual(portal.snapshot(),before);});
