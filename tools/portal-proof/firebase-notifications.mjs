import {createNotificationPlanner} from './notification-plan.mjs';
import {verifiedFirebaseUser} from './firebase-provisioning.mjs';
// Trusted preparation only. No HTTP route, email sender or outbox acknowledgement.
// Auth reads remain outside database transactions; current scope is read again
// before returning the preparation. Delivery must recheck at its own boundary.
export function createFirebaseNotificationPreparation({auth,portal,productId}) {
  if(typeof auth?.getUser!=='function')throw Error('INVALID_CONFIGURATION');
  const planner=createNotificationPlanner({portal,productId});
  return async(intentId,policy,{maxClientRecipients}={})=>{
    if(!Number.isSafeInteger(maxClientRecipients)||maxClientRecipients<1||maxClientRecipients>200)throw Error('NOTIFICATION_CAPACITY_REQUIRED');
    const bound=structuredClone(policy),plan=await planner(intentId,bound);
    if(plan.clientActorIds.length>maxClientRecipients)throw Error('NOTIFICATION_CAPACITY');
    const clientRecipients=[],suppressedClientActorIds=[];
    for(const actorId of plan.clientActorIds){
      try{const identity=await verifiedFirebaseUser(auth,actorId);clientRecipients.push({actorId,email:identity.email});}
      catch(error){if(['FIREBASE_USER_REQUIRED','VERIFIED_FIREBASE_USER_REQUIRED'].includes(error?.message))suppressedClientActorIds.push(actorId);else throw error;}
    }
    const current=await planner(intentId,bound);
    if(JSON.stringify(current)!==JSON.stringify(plan))throw Error('NOTIFICATION_PLAN_CHANGED');
    return {...current,clientRecipients,suppressedClientActorIds,sent:false,acknowledged:false};
  };
}
