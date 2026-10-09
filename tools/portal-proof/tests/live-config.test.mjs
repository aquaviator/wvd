import test from 'node:test';
import assert from 'node:assert/strict';
import {livePortalConfiguration,liveServiceConfiguration,ownerBinding} from '../live-config.mjs';
import {readLiveServiceConfiguration} from '../live-main.mjs';

export const liveConfig=()=>({authentication:{serviceAccount:'wvd-runtime@wvd-development.iam.gserviceaccount.com'},portal:{origin:'https://wvd-service.example.run.app',firebase:{projectId:'wvd-development',productId:'wvd',databaseId:'(default)',mode:'live'},web:{projectId:'wvd-development',apiKey:'AIza'+'x'.repeat(35),authDomain:'wvd-development.firebaseapp.com',appId:'1:123456789:web:abcdef123456'},owner:null,maxConcurrentRequests:8},enquiries:{allowedPublicOrigins:['https://wearvalleydigital.com','https://www.wearvalleydigital.com'],admission:{minuteLimit:10,dailyLimit:50},maxConcurrentRequests:2,retentionDays:90},mail:null});

test('live service configuration is explicit, immutable and permits closed owner setup',()=>{
  const source=liveConfig(),config=liveServiceConfiguration(source,{});
  assert.equal(config.portal.owner,null);assert.equal(config.portal.firebase.mode,'live');
  source.enquiries.allowedPublicOrigins.push('https://changed.example');
  assert.equal(config.enquiries.allowedPublicOrigins.length,2);
  assert.ok(Object.isFrozen(config.portal.web));assert.ok(Object.isFrozen(config.enquiries.admission));
  assert.deepEqual(ownerBinding({uid:'known-owner',email:'admin@example.test'}),{uid:'known-owner',email:'admin@example.test'});
});
test('live origin, web project and emulator boundaries reject unsafe configurations',()=>{
  for(const origin of ['http://localhost:4702','https://localhost','https://127.0.0.1','https://example.com/','https://user@example.com','https://example.com/path','https://example.com?query','https://example.com#token','https://child.localhost'])assert.throws(()=>livePortalConfiguration({...liveConfig().portal,origin},{}));
  for(const patch of [{projectId:'another-project'},{authDomain:'foreign.firebaseapp.com'},{apiKey:'arbitrary'},{appId:'invalid'},{refreshToken:'secret'}])assert.throws(()=>livePortalConfiguration({...liveConfig().portal,web:{...liveConfig().portal.web,...patch}},{}));
  assert.throws(()=>liveServiceConfiguration(liveConfig(),{FIREBASE_AUTH_EMULATOR_HOST:''}),/EMULATOR_ENVIRONMENT_FORBIDDEN/);
  const demo=liveConfig();demo.portal.firebase.projectId='demo-wvd-portal';assert.throws(()=>liveServiceConfiguration(demo,{}),/EMULATOR_ENVIRONMENT_FORBIDDEN/);
});
test('owner binding is never inferred from email, token claims or an incomplete object',()=>{
  for(const owner of [undefined,{},[],{email:'admin@example.test'},{uid:'id',email:'invalid'},{uid:'../other',email:'admin@example.test'},{uid:'id',email:'admin@example.test',admin:true}])assert.throws(()=>ownerBinding(owner),/INVALID_OWNER_BINDING/);
});
test('runtime schema rejects foreign identity, extra fields and out-of-bound admission',()=>{
  const mutations=[
    value=>value.extra=true,value=>value.authentication.key='private',value=>value.authentication.serviceAccount='wvd-runtime@other-project.iam.gserviceaccount.com',
    value=>value.enquiries.allowedPublicOrigins=['https://wearvalleydigital.com','https://wearvalleydigital.com'],
    value=>value.enquiries.allowedPublicOrigins=['*'],value=>value.enquiries.allowedPublicOrigins=['http://localhost:4702'],
    value=>value.enquiries.admission.minuteLimit=0,value=>value.enquiries.admission.dailyLimit=9,
    value=>value.enquiries.retentionDays=366,value=>value.enquiries.maxConcurrentRequests=9,
    value=>value.mail={subject:'admin@example.test',senderEmail:'hello@example.test',recipientEmail:'owner@example.test',requestTimeoutMs:15001},
    value=>value.mail={subject:'admin@example.test',senderEmail:'hello@example.test\r\nBcc: bad@example.test',recipientEmail:'owner@example.test',requestTimeoutMs:10000}
  ];
  for(const mutation of mutations){const value=liveConfig();mutation(value);assert.throws(()=>liveServiceConfiguration(value,{}));}
  const valid=liveConfig();valid.mail={subject:'admin@example.test',senderEmail:'admin@example.test',recipientEmail:'hello@example.test',requestTimeoutMs:10000};assert.equal(liveServiceConfiguration(valid,{}).mail.recipientEmail,'hello@example.test');
});
test('runtime reads exactly one bounded env or file document and validates before startup',async()=>{
  const raw=JSON.stringify(liveConfig());
  assert.equal((await readLiveServiceConfiguration({env:{WVD_SERVICE_CONFIG_JSON:raw},args:[],read:()=>assert.fail('no file read')})).portal.owner,null);
  assert.equal((await readLiveServiceConfiguration({env:{},args:['explicit.json'],read:async(path,encoding)=>{assert.equal(path,'explicit.json');assert.equal(encoding,'utf8');return raw;}})).portal.origin,liveConfig().portal.origin);
  for(const [env,args] of [[{},[]],[{},['one','two']],[{WVD_SERVICE_CONFIG_JSON:raw},['file']],[{WVD_SERVICE_CONFIG_JSON:' '.repeat(16385)},[]],[{WVD_SERVICE_CONFIG_JSON:'{bad'},[]]])await assert.rejects(()=>readLiveServiceConfiguration({env,args,read:()=>assert.fail('not reached')}));
});
