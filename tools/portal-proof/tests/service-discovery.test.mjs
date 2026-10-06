import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serviceDiscovery,serviceName,ownerEmail} from '../../google-development-access/service-discovery.mjs';

const binding=JSON.parse(readFileSync(new URL('../../google-development-access/binding.json',import.meta.url),'utf8'));
const appId='1:6616382131:web:abcdef0123456789';
const serviceUrl='https://wvd-service-v3b6mv7uka-nw.a.run.app';
const publicKey='AIza'+'A'.repeat(35);
const secret='MUST_NOT_APPEAR_IN_DISCOVERY';
const now=()=> '2026-10-06T12:10:00.000Z';
const result=(report,check)=>report.results.find(r=>r.check===check);
function fixture(url,options){
 const u=new URL(url),path=u.pathname;
 if(path.endsWith(':testIamPermissions'))return {permissions:JSON.parse(options.body).permissions,unexpectedSecret:secret};
 if(path.endsWith(':getIamPolicy'))return {bindings:[{role:'roles/run.invoker',members:['allUsers','serviceAccount:private@example.com']},{role:'roles/run.admin',members:['user:other@example.com']}],etag:secret};
 if(path===`/v2/${serviceName}`)return {name:serviceName,uri:serviceUrl,ingress:'INGRESS_TRAFFIC_ALL',invokerIamDisabled:false,template:{serviceAccount:binding.serviceAccount,containers:[{image:'europe-west2-docker.pkg.dev/wvd-development/wvd-booking-runtime/service@sha256:'+'a'.repeat(64),env:[{name:'SECRET',value:secret}]}]},scaling:{minInstanceCount:0,maxInstanceCount:1},terminalCondition:{state:'CONDITION_SUCCEEDED'}};
 if(path.endsWith('/webApps'))return {apps:[{name:`projects/6616382131/webApps/${appId}`,appId,displayName:'WVD Portal Development',projectId:binding.projectId,state:'ACTIVE',unexpectedSecret:secret}]};
 if(path.includes('/webApps/')&&path.endsWith('/config'))return {projectId:binding.projectId,appId,apiKey:publicKey,authDomain:'wvd-development.firebaseapp.com',messagingSenderId:binding.projectNumber,clientSecret:secret};
 if(path==='/admin/v2/projects/wvd-development/config')return {name:'projects/6616382131/config',authorizedDomains:['localhost','wvd-development.firebaseapp.com',new URL(serviceUrl).hostname],hashConfig:secret};
 if(path.endsWith('/defaultSupportedIdpConfigs/google.com'))return {name:'projects/6616382131/defaultSupportedIdpConfigs/google.com',enabled:true,clientSecret:secret};
 if(path.endsWith('/accounts:lookup'))return {users:[{localId:'owner-firebase-uid',email:ownerEmail,emailVerified:true,disabled:false,providerUserInfo:[{providerId:'google.com',rawId:secret}],passwordHash:secret,customAttributes:secret}]};
 throw Error('UNEXPECTED_ENDPOINT');
}
const requestFrom=change=>async(url,options)=>{
 const changed=await change?.(url,options);
 return changed instanceof Response?changed:Response.json(changed??fixture(url,options));
};

test('service discovery exposes only selected public configuration and owner proof using read-only operations',async()=>{
 const calls=[];
 const report=await serviceDiscovery(binding,'synthetic-token',{now,request:requestFrom((url,options)=>{calls.push({url,options});})});
 assert.equal(report.status,'DISCOVERY_REPORTED');
 assert.equal(report.observedAt,now());
 assert.equal(report.changesMade,false);assert.equal(report.mailSent,false);assert.equal(report.deploymentReady,false);
 assert.deepEqual(result(report,'firebase-public-web-config').publicWebConfig,{projectId:binding.projectId,appId,apiKey:publicKey,authDomain:'wvd-development.firebaseapp.com',messagingSenderId:binding.projectNumber});
 assert.deepEqual(result(report,'firebase-owner-account').owner,{uid:'owner-firebase-uid',email:ownerEmail,emailVerified:true,disabled:false,googleProviderLinked:true});
 assert.equal(result(report,'firebase-auth-config').selectedServiceDomainAuthorized,true);
 assert.equal(result(report,'selected-service-invoker-policy').unconditionalPublicInvoker,true);
 assert.equal(result(report,'selected-service').invokerIamDisabled,false);
 assert.deepEqual(report.ttl,{plannedRetentionDays:90,readPermission:true,updatePermission:true,configurationVerified:false});
 const output=JSON.stringify(report);
 for(const forbidden of [secret,'synthetic-token','private@example.com','other@example.com','passwordHash','clientSecret','customAttributes'])assert.equal(output.includes(forbidden),false);
 assert.equal(calls.length,10);
 for(const {url,options}of calls){
  const u=new URL(url);
  assert.ok(['cloudresourcemanager.googleapis.com','iam.googleapis.com','run.googleapis.com','firebase.googleapis.com','identitytoolkit.googleapis.com'].includes(u.hostname));
  assert.ok(u.pathname.includes('wvd-development')||u.pathname.includes('6616382131'));
  assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
  assert.equal(options.headers.Authorization,'Bearer synthetic-token');
  assert.ok(options.method==='GET'||options.method==='POST'&&(u.pathname.endsWith(':testIamPermissions')||u.pathname==='/v1/projects/wvd-development/accounts:lookup'));
  if(u.pathname.endsWith('/accounts:lookup'))assert.deepEqual(JSON.parse(options.body),{email:[ownerEmail]});
  assert.equal(u.searchParams.get('fields')?.includes('clientSecret')??false,false);
 }
});

test('only complete same-project inventory confirms absence; absent owner is not provisioned',async()=>{
 const calls=[];
 const report=await serviceDiscovery(binding,'synthetic-token',{now,request:requestFrom((url,options)=>{
  calls.push({url,options});const u=new URL(url);
  if(u.pathname===`/v2/${serviceName}`)return Response.json({error:secret},{status:404});
  if(u.pathname.endsWith('/services'))return {services:[]};
  if(u.pathname.endsWith('/accounts:lookup'))return {};
 })});
 assert.equal(result(report,'selected-service').status,'ABSENT');
 assert.equal(result(report,'selected-service-absence').status,'ABSENCE_CONFIRMED');
 assert.equal(result(report,'firebase-owner-account').status,'OWNER_ACCOUNT_NOT_FOUND');
 assert.equal(result(report,'selected-service-permissions'),undefined);
 assert.equal(result(report,'selected-service-invoker-policy'),undefined);
 assert.equal(result(report,'firebase-auth-config').selectedServiceDomainAuthorized,undefined);
 assert.ok(!calls.some(c=>/batchGet|queryAccounts|create|update|send/.test(new URL(c.url).pathname)));
});

test('denial, authentication failure, not-found and provider failure remain distinct without leaked error bodies',async()=>{
 for(const [http,status]of [[401,'CREDENTIAL_REJECTED'],[403,'ACCESS_DENIED_OR_API_DISABLED'],[404,'TARGET_NOT_FOUND_OR_NOT_SHARED'],[503,'PROVIDER_ERROR']]){
  const calls=[];
  const report=await serviceDiscovery(binding,'synthetic-token',{now,request:async(url,options)=>{calls.push({url,options});return Response.json({error:{message:secret}},{status:http});}});
  assert.equal(result(report,'selected-service').status,status);
  assert.equal(result(report,'firebase-owner-account').status,status);
  assert.equal(report.ttl.readPermission,null);assert.equal(report.ttl.updatePermission,null);
  assert.equal(result(report,'firebase-public-web-config'),undefined);
  assert.equal(calls.some(c=>new URL(c.url).pathname.endsWith('/services')),http===404);
  assert.equal(JSON.stringify(report).includes(secret),false);
 }
});

test('partial inventories cannot select an app or establish a missing service',async()=>{
 const report=await serviceDiscovery(binding,'synthetic-token',{now,request:requestFrom((url,options)=>{
  const u=new URL(url);
  if(u.pathname===`/v2/${serviceName}`)return Response.json({},{status:404});
  if(u.pathname.endsWith('/services'))return {services:[],nextPageToken:secret};
  if(u.pathname.endsWith('/webApps'))return {...fixture(url,options),nextPageToken:secret};
 })});
 assert.equal(result(report,'selected-service').status,'TARGET_NOT_FOUND_OR_NOT_SHARED');
 assert.equal(result(report,'selected-service-absence').status,'PARTIAL_INVENTORY');
 assert.equal(result(report,'firebase-web-app').status,'PARTIAL_INVENTORY');
 assert.equal(result(report,'firebase-public-web-config'),undefined);
 assert.equal(JSON.stringify(report).includes(secret),false);
});

test('foreign bindings and provider-supplied identities never cause foreign reads or false owner proof',async()=>{
 let count=0;
 await assert.rejects(serviceDiscovery({...binding,projectId:'foreign-project'},'synthetic-token',{now,request:async()=>{count++;}}),/INVALID_ACCESS_BINDING/);
 await assert.rejects(serviceDiscovery(binding,'bad token',{now,request:async()=>{count++;}}),/CREDENTIAL_REQUIRED/);
 assert.equal(count,0);
 const calls=[];
 const report=await serviceDiscovery(binding,'synthetic-token',{now,request:requestFrom((url,options)=>{
  calls.push(url);const u=new URL(url),value=fixture(url,options);
  if(u.pathname.endsWith('/webApps'))value.apps[0].name=`projects/foreign-project/webApps/${appId}`;
  if(u.pathname.endsWith('/accounts:lookup'))value.users[0].email='somebody-else@example.com';
  if(u.pathname===`/v2/${serviceName}`)value.uri='https://foreign.example.com/';
  return value;
 })});
 for(const check of ['selected-service','firebase-web-app','firebase-owner-account'])assert.equal(result(report,check).status,'INVALID_OR_INCOMPLETE_RESPONSE');
 assert.equal(result(report,'firebase-public-web-config'),undefined);
 assert.ok(calls.every(url=>!url.includes('foreign')));
 assert.equal(JSON.stringify(report).includes('somebody-else'),false);
});

test('ambiguous apps, invalid public config and conditional policies never become usable launch evidence',async()=>{
 const ambiguous=await serviceDiscovery(binding,'synthetic-token',{now,request:requestFrom((url,options)=>{
  if(new URL(url).pathname.endsWith('/webApps')){const value=fixture(url,options);value.apps.push({...value.apps[0]});return value;}
 })});
 assert.equal(result(ambiguous,'firebase-web-app').status,'AMBIGUOUS_WEB_APP');
 assert.equal(result(ambiguous,'firebase-public-web-config'),undefined);
 const report=await serviceDiscovery(binding,'synthetic-token',{now,request:requestFrom((url,options)=>{
  const u=new URL(url);
  if(u.pathname.includes('/webApps/')&&u.pathname.endsWith('/config'))return {...fixture(url,options),apiKey:secret};
  if(u.pathname.endsWith(':getIamPolicy'))return {bindings:[{role:'roles/run.invoker',members:['allUsers'],condition:{expression:secret}}]};
 })});
 assert.equal(result(report,'firebase-public-web-config').status,'INVALID_OR_INCOMPLETE_RESPONSE');
 assert.equal(result(report,'selected-service-invoker-policy').unconditionalPublicInvoker,false);
 assert.equal(result(report,'selected-service-invoker-policy').conditionalPublicInvoker,true);
 assert.equal(JSON.stringify(report).includes(secret),false);
});
