import {createFirebaseBackend} from './firebase-backend.mjs';
import {createApplication} from './app.mjs';
// Synthetic emulator data only. This launcher has no live project option.
const config={projectId:'demo-wvd-portal',productId:'wvd-demo',databaseId:'(default)',mode:'emulator'};
let backend,server;
try {
  backend=createFirebaseBackend(config);
  const uid='demo-owner',email='owner@example.test',password='Synthetic-demo-123!';
  const initialized=await backend.portal.initialize({identities:[{id:uid,active:true}],projects:[{id:'Demo project',businessId:'demo-business',stage:'Design review',nextStep:'Review the synthetic milestone'}],memberships:[{actorId:uid,businessId:'demo-business',active:true,role:'Owner',projectIds:['Demo project']}],milestones:[{id:'Demo milestone',projectId:'Demo project',currentVersionId:'demo-v1',status:'awaiting-client'}]});
  if(initialized.created)await backend.portal.publishReview({projectId:'Demo project',milestoneId:'Demo milestone',versionId:'demo-v1',title:'Synthetic design review',body:'Review the project heading, navigation and contact form. This synthetic milestone demonstrates approval of this exact review text; it does not approve a production deployment.'},0);
  try {
    const user=await backend.auth.getUser(uid);
    if(user.email!==email||!user.emailVerified||user.disabled)throw Error('DEMO_USER_MISMATCH');
  } catch(error) {
    if(error.code!=='auth/user-not-found')throw error;
    await backend.auth.createUser({uid,email,password,emailVerified:true});
  }
  const allowedOrigin='http://127.0.0.1:4703';
  server=createApplication({portal:backend.portal,auth:{resolveSession:backend.resolveSession},allowedOrigin,firebaseEmulator:config});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4703,'127.0.0.1',resolve);});
  console.log(`Synthetic Firebase demo: ${allowedOrigin}\nEmail: ${email}\nDevelopment-only password: ${password}\nNo live project access. Ctrl+C to stop.`);
  let stopping=false;
  const stop=async()=>{if(stopping)return;stopping=true;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await backend.close();};
  process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
} catch {
  server?.closeAllConnections();server?.close();if(backend)await backend.close();
  console.error('FIREBASE_DEMO_START_FAILED: verify isolated emulator hosts and available portal port.');
  process.exitCode=1;
}
