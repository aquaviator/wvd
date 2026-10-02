import {readFileSync} from 'node:fs';
import {createFirebaseBackend} from './firebase-backend.mjs';
import {createFirebaseProvisioner} from './firebase-provisioning.mjs';
const [command,bindingPath,grantPath,...extra]=process.argv.slice(2);
let backend;
try {
  if(extra.length||!bindingPath||!['inspect','provision','publish-review'].includes(command)||(command==='inspect'&&grantPath)||(command!=='inspect'&&!grantPath))throw Error('INVALID_OPERATOR_ARGUMENTS');
  const config=JSON.parse(readFileSync(bindingPath,'utf8'));
  let grant;
  if(grantPath) {
    grant=JSON.parse(readFileSync(grantPath,'utf8'));
    if(!grant||typeof grant!=='object'||Array.isArray(grant)||Object.keys(grant).sort().join(',')!==(command==='publish-review'?'body,expectedRevision,milestoneId,projectId,title,versionId':'businessId,expectedRevision,projectIds,role,uid'))throw Error('INVALID_ACCESS_GRANT');
  }
  backend=createFirebaseBackend(config);
  if(command==='inspect')console.log(JSON.stringify({projectId:config.projectId,productId:config.productId,revision:await backend.portal.accessRevision()}));
  else {
    const {expectedRevision,...request}=grant;
    const result=command==='publish-review'?await backend.portal.publishReview(request,expectedRevision):await createFirebaseProvisioner(backend)(request,expectedRevision);
    console.log(JSON.stringify({projectId:config.projectId,productId:config.productId,...(command==='publish-review'?{digest:result.digest}:{created:result.created})}));
  }
} catch(error) {
  const safe=new Set(['INVALID_REVIEW','INVALID_TEXT','REVIEW_IMMUTABLE','ACCESS_DENIED','INVALID_OPERATOR_ARGUMENTS','INVALID_CONFIGURATION','ISOLATED_EMULATORS_REQUIRED','EMULATOR_ENVIRONMENT_FORBIDDEN','INVALID_ACCESS_GRANT','ACCESS_REVISION_REQUIRED','ACCESS_REVISION_CONFLICT','PROJECT_SCOPE_DENIED','IDENTITY_DISABLED','ACCESS_ALREADY_PROVISIONED','VERIFIED_FIREBASE_USER_REQUIRED','FIREBASE_USER_REQUIRED','IDENTITY_SERVICE_UNAVAILABLE','CORRUPT_PORTAL_STATE','STATE_CAPACITY','REVISION_EXHAUSTED']);
  console.error(safe.has(error.message)?error.message:'OPERATOR_OPERATION_FAILED');process.exitCode=1;
} finally {if(backend)await backend.close();}
