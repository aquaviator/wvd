const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));
const review=value=>value?{...pick(value,['projectId','milestoneId','versionId','title','body','digest']),...(value.deliverable?{deliverable:pick(value.deliverable,['label','mediaType','sourceVersion'])}:{})}:null;
const milestone=value=>({...pick(value,['id','projectId','currentVersionId','status','reviewRequired']),...(value.review?{review:review(value.review)}:{})});
const triage=value=>value?pick(value,['priority','careAssessment','note','timestamp']):null;
const ticket=value=>({...pick(value,['id','projectId','type','subject','body','timestamp']),triage:triage(value.triage),triageHistory:(value.triageHistory??[]).map(triage)});

// Positive projection: future operator fields cannot silently enter client JSON.
export function clientProjection(action,result){
  if(action==='overview')return {
    ...pick(result,['projectId','canApprove','stage','nextStep']),canManageColleagues:false,
    progressHistory:result.progressHistory.map(value=>pick(value,['stage','nextStep','timestamp'])),
    feedbackHistory:result.feedbackHistory.map(value=>pick(value,['id','milestoneId','versionId','timestamp','body'])),
    approvalHistory:result.approvalHistory.map(value=>({...pick(value,['id','milestoneId','versionId','timestamp']),review:review(value.review)})),
    completedMilestones:result.completedMilestones.map(milestone),awaitingClient:result.awaitingClient.map(milestone)
  };
  if(action==='tickets')return result.map(ticket);
  if(action==='read-ticket')return {ticket:ticket(result.ticket),replies:result.replies.map(value=>pick(value,['id','body','timestamp']))};
  if(['ticket','reply','feedback','approve'].includes(action))return pick(result,['id','projectId','milestoneId','versionId','timestamp']);
  return result;
}
