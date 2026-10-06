import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {configurationHash,desiredService,inspectManagedService,selectDeployment,deploymentClient,prepareServiceDeployment,deployService,verifyServiceDeployment,serviceConfiguration,providerOrigin,imagePrefix,serviceName} from '../../portal-runtime/deployment.mjs';
import {enquiryCollectionId} from '../enquiry.mjs';
import {enquiryTtlField} from '../../google-development-access/service-discovery.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
const candidateSource=JSON.parse(readFileSync(new URL('../../portal-runtime/wvd-development.candidate.json',import.meta.url),'utf8'));
// Initial-creation checks keep a closed synthetic owner even after the tracked
// runtime candidate is explicitly bound to the real owner account.
const candidate={...candidateSource,portal:{...candidateSource.portal,owner:null}};
const binding=JSON.parse(readFileSync(new URL('../../google-development-access/binding.json',import.meta.url),'utf8'));
const image=imagePrefix+'@sha256:'+'a'.repeat(64),source='b'.repeat(40);
const otherImage=imagePrefix+'@sha256:'+'c'.repeat(64),otherSource='d'.repeat(40);
const origin='https://wvd-service-v3b6mv7uka-nw.a.run.app';
const servicePath='/v2/'+serviceName;
const runUrl='https://run.googleapis.com'+servicePath;
const bound={...clone(candidate),portal:{...clone(candidate.portal),origin}};
const token='synthetic-access-token',idToken='synthetic-transport-token';

function managed(config=bound,releaseImage=image,revision=source){
  return {...desiredService(releaseImage,revision,config),name:serviceName,etag:'initial-etag',uri:origin,terminalCondition:{state:'CONDITION_SUCCEEDED'}};
}

function cloudRun(initial){
  let current=initial===null?null:clone(initial),sequence=0;
  const calls=[];
  const request=async(url,options)=>{
    const body=options.body===undefined?undefined:JSON.parse(options.body);
    calls.push({url,method:options.method,body});
    assert.equal(options.headers.Authorization,'Bearer '+token);
    assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
    if(url===runUrl&&options.method==='GET')return current===null?new Response('',{status:404}):Response.json(current);
    if(url===runUrl+':getIamPolicy'&&options.method==='GET')return Response.json({bindings:[{role:'roles/run.invoker',members:['serviceAccount:'+binding.serviceAccount]}]});
    if(url==='https://run.googleapis.com/v2/projects/wvd-development/locations/europe-west2/services?serviceId=wvd-service'&&options.method==='POST'){
      assert.equal(current,null);assert.equal(body.invokerIamDisabled,false);
      current={...body,name:serviceName,etag:'created-etag',uri:origin,terminalCondition:{state:'CONDITION_SUCCEEDED'}};
    }else if(url===runUrl+'?updateMask=template.containers,labels,annotations'&&options.method==='PATCH'){
      assert.equal(body.name,serviceName);assert.equal(body.etag,current.etag);
      assert.deepEqual(Object.keys(body).sort(),['annotations','etag','labels','name','template']);
      current={...current,labels:body.labels,annotations:body.annotations,template:{...current.template,...body.template},etag:'updated-'+(++sequence)};
    }else throw Error('UNEXPECTED_CLOUD_RUN_REQUEST');
    return Response.json({name:'projects/wvd-development/locations/europe-west2/operations/synthetic-'+(++sequence),done:true});
  };
  return {request,calls,current:()=>clone(current)};
}

test('private creation binds source, configuration and image digest with the approved capacity',()=>{
  const desired=desiredService(image,source,candidate);
  assert.equal(desired.invokerIamDisabled,false);
  assert.equal(desired.ingress,'INGRESS_TRAFFIC_ALL');
  assert.deepEqual(desired.scaling,{minInstanceCount:0,maxInstanceCount:1});
  assert.equal(desired.template.timeout,'60s');assert.equal(desired.template.maxInstanceRequestConcurrency,4);
  assert.deepEqual(desired.template.containers[0].resources,{limits:{cpu:'1',memory:'512Mi'},cpuIdle:true,startupCpuBoost:false});
  assert.deepEqual(desired.annotations,{'wvd.dev/config-sha256':configurationHash(candidate),'wvd.dev/image-sha256':'a'.repeat(64)});
  assert.equal(desired.template.serviceAccount,binding.serviceAccount);
  for(const value of [imagePrefix+':latest',imagePrefix+'@sha256:'+'z'.repeat(64),'foreign/'+image])assert.throws(()=>desiredService(value,source,candidate),/INVALID_DEPLOYMENT_BINDING/);
  assert.throws(()=>desiredService(image,'main',candidate),/INVALID_DEPLOYMENT_BINDING/);
});

test('only selected runtime configuration and actual provider origin formats are accepted',()=>{
  assert.equal(providerOrigin(origin),origin);
  assert.equal(providerOrigin('https://wvd-service-6616382131.europe-west2.run.app'),'https://wvd-service-6616382131.europe-west2.run.app');
  for(const value of ['http://'+new URL(origin).hostname,origin+'/',origin+'?x=1','https://foreign.run.app','https://wvd-service-66163821310.europe-west2.run.app','https://wvd-service-6616382131.europe-west2.run.app.evil.example'])assert.throws(()=>providerOrigin(value),/INVALID_PROVIDER_ORIGIN/);
  for(const mutate of [v=>{v.enquiries.retentionDays=30;},v=>{v.enquiries.allowedPublicOrigins.push('https://foreign.example');},v=>{v.portal.firebase.productId='salon';},v=>{v.mail.recipientEmail='visitor@example.com';},v=>{v.portal.owner={uid:'some-user',email:'visitor@example.com'};}]){
    const changed=clone(candidate);mutate(changed);assert.throws(()=>serviceConfiguration(changed),/OUT_OF_SCOPE/);
  }
});

test('managed inspection rejects manual image replacement and missing or stale image digest annotation',()=>{
  assert.equal(inspectManagedService(managed(),{ready:true}).release.image,image);
  for(const mutate of [v=>{v.template.containers[0].image=otherImage;},v=>{v.annotations['wvd.dev/image-sha256']='c'.repeat(64);},v=>{delete v.annotations['wvd.dev/image-sha256'];}]){
    const changed=managed();mutate(changed);
    assert.throws(()=>inspectManagedService(changed),/EXISTING_SERVICE_IMAGE_DRIFT/);
    assert.throws(()=>selectDeployment(changed,candidate,source),/EXISTING_SERVICE_IMAGE_DRIFT/);
  }
});

test('managed inspection rejects configuration, identity, capacity and traffic drift',()=>{
  for(const mutate of [v=>{v.annotations['wvd.dev/config-sha256']='0'.repeat(64);},v=>{v.template.serviceAccount='other@example.com';},v=>{v.scaling.maxInstanceCount=2;},v=>{v.template.containers[0].env.push({name:'EXTRA',value:'unexpected'});},v=>{v.traffic=[{type:'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION',percent:100,revision:'manual'}];},v=>{v.terminalCondition.state='CONDITION_FAILED';}]){
    const changed=managed();mutate(changed);assert.throws(()=>inspectManagedService(changed,{ready:true}));
  }
});

test('selection is private-first, idempotent for the exact release and explicit about later updates',()=>{
  assert.equal(selectDeployment(null,candidate,source).status,'READY_FOR_PRIVATE_CREATION');
  assert.throws(()=>selectDeployment(null,bound,source),/INITIAL_PRIVATE_CONFIGURATION_REQUIRED/);
  assert.throws(()=>selectDeployment(null,{...candidate,portal:{...candidate.portal,owner:{uid:'owner',email:'admin@wearvalleydigital.com'}}},source),/INITIAL_PRIVATE_CONFIGURATION_REQUIRED/);
  const existing=managed(),receipt=inspectManagedService(existing).release;
  assert.deepEqual({status:selectDeployment(existing,candidate,source).status,build:selectDeployment(existing,candidate,source).build},{status:'EXISTING_SOURCE_AND_CONFIGURATION',build:false});
  assert.equal(selectDeployment(managed(candidate),candidate,source).status,'READY_FOR_ORIGIN_BINDING');
  assert.throws(()=>selectDeployment(existing,candidate,otherSource),/EXPECTED_RELEASE_REQUIRED/);
  assert.throws(()=>selectDeployment(existing,candidate,otherSource,{...receipt,image:otherImage}),/EXPECTED_RELEASE_MISMATCH/);
  assert.equal(selectDeployment(existing,candidate,otherSource,receipt).status,'READY_FOR_BOUND_UPDATE');
  assert.throws(()=>selectDeployment(null,candidate,source,receipt),/EXPECTED_SERVICE_MISSING/);
});

test('deployment client permits only exact service operations and redacts ambiguous failures',async()=>{
  const calls=[];
  const api=deploymentClient(token,{request:async(url,options)=>{calls.push({url,options});return Response.json({ok:true});}});
  for(const [path,method] of [[servicePath.replace('wvd-service','wvd-booking-development'),'PATCH'],[servicePath+':setIamPolicy','POST'],[servicePath+'?updateMask=invokerIamDisabled','PATCH'],['/v2/projects/foreign/locations/europe-west2/operations/test','GET']])await assert.rejects(api(path,{method}),/FOREIGN_TARGET_OR_OPERATION/);
  assert.equal(calls.length,0);
  const broken=deploymentClient(token,{request:async()=>{throw Error('PRIVATE_PROVIDER_ERROR_TEXT');}});
  await assert.rejects(broken(servicePath),{message:'CLOUD_RUN_READ_FAILED'});
  await assert.rejects(broken(servicePath+'?updateMask=template.containers,labels,annotations',{method:'PATCH',body:{}}),{message:'CLOUD_RUN_WRITE_OUTCOME_UNKNOWN'});
});

test('preparation confirms absence through complete regional inventory and reads only permitted targets',async()=>{
  const calls=[];
  let partial=false;
  const request=async(url,options)=>{
    calls.push({url,method:options.method});const u=new URL(url);
    if(u.pathname.endsWith(':testIamPermissions'))return Response.json({permissions:JSON.parse(options.body).permissions});
    if(url===runUrl)return new Response('',{status:404});
    if(u.pathname.endsWith('/databases/(default)'))return Response.json({name:'projects/wvd-development/databases/(default)',type:'FIRESTORE_NATIVE',locationId:'eur3'});
    if(u.pathname.endsWith('/services'))return Response.json({services:[],...(partial?{nextPageToken:'more'}:{})});
    if(u.pathname.endsWith('/repositories'))return Response.json({repositories:[]});
    if(u.pathname.endsWith('/repositories/wvd-booking-runtime'))return Response.json({name:'projects/wvd-development/locations/europe-west2/repositories/wvd-booking-runtime',format:'DOCKER',dockerConfig:{immutableTags:true},vulnerabilityScanningConfig:{enablementConfig:'DISABLED'}});
    throw Error('UNEXPECTED_DISCOVERY_REQUEST');
  };
  assert.deepEqual(await prepareServiceDeployment(binding,candidate,source,token,{request}),{status:'READY_FOR_PRIVATE_CREATION',build:true,image:''});
  assert.ok(calls.every(c=>c.method==='GET'||c.method==='POST'&&new URL(c.url).pathname.endsWith(':testIamPermissions')));
  partial=true;
  await assert.rejects(prepareServiceDeployment(binding,candidate,source,token,{request}),/SERVICE_ABSENCE_NOT_CONFIRMED/);
});

test('first deployment creates privately then binds the provider-returned URL using its current etag',async()=>{
  const api=cloudRun(null);
  const result=await deployService(candidate,image,source,token,{request:api.request,wait:async()=>{}});
  assert.equal(result.status,'PRIVATE_SERVICE_PREPARED');assert.equal(result.providerBusinessFlowVerified,false);
  assert.equal(result.release.url,origin);assert.equal(result.release.configSha256,configurationHash(bound));
  const writes=api.calls.filter(c=>c.method!=='GET');
  assert.deepEqual(writes.map(c=>c.method),['POST','PATCH']);
  assert.equal(writes[0].body.invokerIamDisabled,false);
  assert.equal(writes[1].body.etag,'created-etag');
  for(const write of writes)assert.equal(write.body.annotations['wvd.dev/image-sha256'],'a'.repeat(64));
  assert.equal(api.current().invokerIamDisabled,false);
});

test('same-source recovery binds only the origin and a completed retry performs no writes',async()=>{
  const recovery=cloudRun(managed(candidate));
  const receipt=await deployService(candidate,image,source,token,{request:recovery.request,wait:async()=>{}});
  assert.deepEqual(recovery.calls.filter(c=>c.method!=='GET').map(c=>c.method),['PATCH']);
  const complete=cloudRun(recovery.current());
  assert.equal((await deployService(candidate,image,source,token,{request:complete.request,expectedRelease:receipt.release})).release.url,origin);
  assert.equal(complete.calls.filter(c=>c.method!=='GET').length,0);
});

test('bound updates use the exact expected previous release and update both image and its annotation',async()=>{
  const existing=managed(),expectedRelease=inspectManagedService(existing).release;
  existing.annotations['example.com/retained']='retained';
  const api=cloudRun(existing);
  const result=await deployService(candidate,otherImage,otherSource,token,{request:api.request,expectedRelease,wait:async()=>{}});
  assert.equal(result.release.image,otherImage);assert.equal(result.release.sourceRevision,otherSource);
  const writes=api.calls.filter(c=>c.method!=='GET');assert.equal(writes.length,1);
  assert.equal(writes[0].body.annotations['wvd.dev/image-sha256'],'c'.repeat(64));
  assert.equal(writes[0].body.annotations['example.com/retained'],'retained');
  assert.equal(writes[0].body.template.containers[0].image,otherImage);
  assert.equal(api.current().invokerIamDisabled,false);
});

test('uncertain creation is never repeated and foreign operations are not followed',async()=>{
  for(const outcome of ['unknown','foreign']){
    const calls=[];
    await assert.rejects(deployService(candidate,image,source,token,{wait:async()=>{},request:async(url,options)=>{
      calls.push({url,method:options.method});
      if(options.method==='GET')return new Response('',{status:404});
      if(outcome==='unknown')throw Error('SECRET_PROVIDER_DETAIL');
      return Response.json({name:'projects/foreign/locations/europe-west2/operations/other',done:true});
    }}),/CLOUD_RUN_WRITE_OUTCOME_UNKNOWN/);
    assert.deepEqual(calls.map(c=>c.method),['GET','POST']);
  }
});

test('HTTP verification proves private transport and application denial without claiming Google login or mail',async()=>{
  const current=managed(),receipt=inspectManagedService(current).release,api=cloudRun(current),requests=[];
  const request=async(url,options)=>{
    if(url.startsWith('https://run.googleapis.com/'))return api.request(url,options);
    assert.ok(url.startsWith(origin+'/'));assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
    const path=new URL(url).pathname;requests.push({path,headers:options.headers});
    if(path==='/health'&&!options.headers['X-Serverless-Authorization'])return new Response('',{status:403});
    assert.equal(options.headers['X-Serverless-Authorization'],'Bearer '+idToken);
    if(path==='/health')return Response.json({status:'ok',mode:'live-portal',providerAccessChecked:false});
    if(path==='/auth-config.json')return Response.json({mode:'firebase-live',firebase:bound.portal.web,ownerConfigured:false,enquiriesEnabled:true});
    if(path==='/')return new Response('<main id="login">Continue with Google</main><script src="/app.js"></script>',{headers:{'Content-Type':'text/html','X-Robots-Tag':'noindex, nofollow'}});
    if(path==='/firebase-auth-sdk.js')return new Response('/* synthetic SDK */'+' '.repeat(1024),{headers:{'Content-Type':'text/javascript'}});
    assert.ok(['/api/portal/workspace-access','/api/admin/enquiries'].includes(path));
    assert.equal(options.headers.Authorization,'Bearer wvd-synthetic-invalid-firebase-token');assert.equal(options.headers.Origin,origin);
    return Response.json({error:'UNAUTHENTICATED'},{status:401});
  };
  const result=await verifyServiceDeployment(receipt,token,idToken,{request});
  assert.equal(result.status,'PRIVATE_SERVICE_HTTP_VERIFIED');
  for(const field of ['anonymousIamDenied','googleLoginShellAvailable','privateApiDenied','enquiryInboxDenied'])assert.equal(result[field],true);
  for(const field of ['googleIdentityFlowVerified','ownerConfigured','providerBusinessFlowVerified','messagesSent'])assert.equal(result[field],false);
  assert.equal(requests.filter(r=>r.path==='/health').length,2);
  assert.equal(api.calls.filter(c=>c.method!=='GET').length,0);
});

test('private verification requires an IAM token and rejects unexpected anonymous access',async()=>{
  const current=managed(),receipt=inspectManagedService(current).release,api=cloudRun(current);
  await assert.rejects(verifyServiceDeployment(receipt,token,undefined,{request:api.request}),/RUNTIME_ID_TOKEN_REQUIRED/);
  await assert.rejects(verifyServiceDeployment(receipt,token,idToken,{request:async(url,options)=>url.startsWith('https://run.googleapis.com/')?api.request(url,options):Response.json({status:'ok'})}),/ANONYMOUS_IAM_DENIAL_REQUIRED/);
});

test('administrator helper shares the exact Node release and dedicated collection contracts without live access',()=>{
  assert.equal(enquiryTtlField,`projects/wvd-development/databases/(default)/collectionGroups/${enquiryCollectionId('wvd')}/fields/deleteAt`);
  const directory=mkdtempSync(join(tmpdir(),'wvd-service-setup-'));
  try{
    const service=managed(),fixture=join(directory,'synthetic-release.json');
    writeFileSync(fixture,JSON.stringify({service,receipt:inspectManagedService(service).release,ttlField:enquiryTtlField}),{mode:0o600});
    const result=spawnSync('python3',[fileURLToPath(new URL('./service-access-setup.test.py',import.meta.url)),fixture],{encoding:'utf8',timeout:20000,maxBuffer:1048576,env:{PATH:process.env.PATH,PYTHONDONTWRITEBYTECODE:'1'}});
    assert.equal(result.status,0,(result.stdout??'')+(result.stderr??'')+(result.error?.message??''));
    assert.match(result.stderr,/Ran 12 tests/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
