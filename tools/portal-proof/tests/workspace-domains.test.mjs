import test from 'node:test';
import assert from 'node:assert/strict';
import {createLivePortalApplication} from '../live-app.mjs';
import {liveConfig} from './live-config.test.mjs';
import {PortalProof} from '../domain.mjs';

const workspaces={clientOrigin:'https://portal.example.test',adminOrigin:'https://admin.example.test',websiteOrigin:'https://www.example.test'};
test('branded hosts preserve role isolation, explicit origins and client project boundaries',async t=>{
  const portal=new PortalProof({identities:[{id:'owner',active:true,wvdAdmin:true},{id:'client',active:true,wvdAdmin:false}],projects:[{id:'a',businessId:'a'},{id:'b',businessId:'b'}],memberships:[{actorId:'client',businessId:'a',role:'Owner',active:true,projectIds:['a']}],milestones:[]});
  const owner=async raw=>raw==='owner'?{actorId:'owner'}:null;
  const session=async raw=>raw==='client'?{actorId:'client',liveClient:true}:owner(raw);
  const server=createLivePortalApplication({portal,resolveOwnerSession:owner,resolveSession:session,config:{...liveConfig().portal,owner:{uid:'owner',email:'owner@example.test'},workspaces},browserBundle:Buffer.from('export {};')});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const get=(host,path,token,origin)=>fetch(base+path,{headers:{'X-Forwarded-Host':host,...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})}});
  const admin='admin.example.test',client='portal.example.test';
  assert.equal((await get(admin,'/api/portal/projects','client')).status,401);
  assert.equal((await get(admin,'/api/portal/admin-overview','owner')).status,200);
  assert.equal((await get(client,'/api/portal/projects','owner')).status,401);
  assert.deepEqual((await(await get(client,'/api/portal/projects','client')).json()).map(p=>p.id),['a']);
  assert.equal((await get(client,'/api/portal/overview?projectId=b','client')).status,403);
  assert.equal((await get(client,'/api/portal/admin-overview','client')).status,403);
  assert.equal((await get(client,'/api/admin/enquiries','client')).status,403);
  assert.equal((await get(client,'/api/invitations/create','client')).status,403);
  assert.equal((await get(admin,'/api/portal/projects','owner',workspaces.clientOrigin)).status,403);
  assert.equal((await get(client,'/api/portal/projects','client',workspaces.adminOrigin)).status,403);
  for(const [host,kind]of [[admin,'admin'],[client,'client']]){
    const response=await get(host,'/auth-config.json');assert.match(response.headers.get('cache-control'),/no-store/);
    assert.equal((await response.json()).workspace.kind,kind);
    const html=await(await get(host,'/')).text();assert.match(html,/Back to website/);
  }
  // A forged forwarded hostname never makes a client into an owner.
  assert.equal((await get('unknown.example.test','/api/portal/admin-overview','client')).status,403);
});
