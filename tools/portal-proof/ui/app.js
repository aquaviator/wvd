import {createAuthClient} from './auth-client.js';
let authClient;
const el=id=>document.getElementById(id);
let sessionToken=null,revision=0,adminAccess=false,displayedProjectId=null;
const reviewTime=value=>new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(value))+' (UK time)';
const status=message=>{el('status').textContent=message;};
const messages={PROJECT_CONFLICT:'That project name is already in use. Reload the client overview before creating another project.',MILESTONE_CONFLICT:'That milestone already exists. Reload the project and use its review workflow.',REVIEW_IMMUTABLE:'That version already has different review content. Use a new version identifier.',PROGRESS_CONFLICT:'Project progress has changed. Reload the project before saving.',UNAUTHENTICATED:'Please sign in again.',ACCESS_DENIED:'Your account does not have permission for this action.',REVIEW_CONFLICT:'The review content has changed or is unavailable. Reload the project.',VERSION_CONFLICT:'This milestone has changed. Reload the project before reviewing it.',STATE_CONFLICT:'This milestone is no longer awaiting approval.',INVALID_INVITATION:'This invitation is invalid or expired. Ask WVD for a new one.',INVALID_PASSWORD:'Choose a password of at least 15 characters.',RATE_LIMITED:'Too many attempts. Please wait 15 minutes.',SERVICE_UNAVAILABLE:'The service is temporarily unavailable. Please try again.'};
function signedOut(){sessionToken=null;adminAccess=false;displayedProjectId=null;revision++;el('workspace').hidden=true;el('account').hidden=false;el('logout').hidden=true;el('overview').replaceChildren();el('tickets').replaceChildren();el('projects').replaceChildren();el('admin-overview').replaceChildren();el('admin-overview').hidden=true;el('ticket').reset();}
async function api(path,body,method='POST'){
  const headers={};if(sessionToken)headers.Authorization=`Bearer ${sessionToken}`;
  const options={method,headers,credentials:'omit',cache:'no-store'};
  if(method==='POST'){headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
  const response=await fetch(path,options);const data=await response.json();
  if(!response.ok){if(response.status===401&&path.startsWith('/api/portal/'))signedOut();throw new Error(messages[data.error]??'The request could not be completed.');}return data;
}
function node(tag,text){const result=document.createElement(tag);result.textContent=text;return result;}
async function busy(form,fn){const button=form.querySelector('button');button.disabled=true;try{await fn();}catch(error){status(error.message);}finally{button.disabled=false;}}
const projectId=()=>el('projects').value;
const read=(action,params)=>api(`/api/portal/${action}?${new URLSearchParams(params)}`,null,'GET');
async function administration(){
  const token=sessionToken,box=el('admin-overview');box.replaceChildren();box.hidden=true;
  const access=await read('workspace-access',{});
  if(token!==sessionToken)return;adminAccess=access.admin===true;
  if(!adminAccess)return;
  const overview=await read('admin-overview',{});
  if(token!==sessionToken)return;
  const selected=projectId();el('projects').replaceChildren();
  for(const business of overview.businesses)for(const item of business.projects){const option=node('option',item.projectId);option.value=item.projectId;el('projects').append(option);}
  if(overview.businesses.some(x=>x.projects.some(p=>p.projectId===selected)))el('projects').value=selected;
  box.append(node('h2','WVD administration'),node('p','Client and project overview. Select a project to read feedback and support conversations.'));
  const refresh=node('button','Refresh overview');refresh.type='button';refresh.addEventListener('click',async()=>{refresh.disabled=true;try{await administration();}catch(error){status(error.message);}finally{refresh.disabled=false;}});box.append(refresh);
  for(const business of overview.businesses){
    const section=node('section','');section.append(node('h3',`Client: ${business.businessId}`));
    for(const item of business.projects){
      const card=node('article','');card.append(node('h4',item.projectId),node('p',`Stage: ${item.stage??'Awaiting update'}`),node('p',`Next step: ${item.nextStep??'Awaiting update'}`),node('p',`${item.awaitingReview} awaiting review · ${item.feedbackCount} feedback ${item.feedbackCount===1?'record':'records'} · ${item.ticketCount} support ${item.ticketCount===1?'ticket':'tickets'}`));
      const open=node('button','Open project');open.type='button';open.addEventListener('click',()=>{el('projects').value=item.projectId;project().catch(error=>status(error.message));});card.append(open);section.append(card);
    }
    box.append(section);
  }
  if(overview.businesses.length){
    const details=document.createElement('details');details.className='create-project';details.append(node('summary','Create a project for an existing client'));
    const form=document.createElement('form'),client=document.createElement('select');client.id='new-project-client';client.required=true;
    const placeholder=node('option','Choose an existing client');placeholder.value='';placeholder.disabled=true;placeholder.selected=true;client.append(placeholder);
    for(const business of overview.businesses){const option=node('option',business.businessId);option.value=business.businessId;client.append(option);}
    const clientLabel=node('label','Client');clientLabel.htmlFor=client.id;form.append(clientLabel,client);
    const fields={};for(const [key,text,maximum,tag] of [['projectId','New project name',128,'input'],['stage','Starting stage',200,'input'],['nextStep','First next step',2000,'textarea']]){const input=document.createElement(tag);input.required=true;input.maxLength=maximum;fields[key]=input;const label=node('label',text);label.append(input);form.append(label);}
    form.append(node('p','Client account access is assigned separately. Creating a project does not change existing account permissions.'),node('button','Create project'));
    form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{const created=await api('/api/portal/create-project',{businessId:client.value,...Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value]))});await administration();el('projects').value=created.projectId;await project();status('Project created. Client access is assigned separately.');});});details.append(form);box.append(details);
  }
  if(!overview.businesses.length)box.append(node('p','No client projects are recorded.'));
  box.hidden=false;
}
async function project(){
  const id=projectId(),generation=++revision;if(id!==displayedProjectId){el('ticket').reset();displayedProjectId=id;}el('overview').replaceChildren();el('tickets').replaceChildren();if(!id)return;
  const [overview,tickets]=await Promise.all([read('overview',{projectId:id}),read('tickets',{projectId:id})]);
  if(generation!==revision||!sessionToken)return;
  const box=el('overview');box.append(node('h2','Project progress'),node('p',`Stage: ${overview.stage??'Awaiting update'}`),node('p',`Next step: ${overview.nextStep??'Awaiting update'}`));
  if(adminAccess){
    const form=document.createElement('form');form.append(node('h3','Update project progress'));
    const stage=document.createElement('input');stage.required=true;stage.maxLength=200;stage.value=overview.stage??'';
    const nextStep=document.createElement('textarea');nextStep.required=true;nextStep.maxLength=2000;nextStep.value=overview.nextStep??'';
    const stageLabel=node('label','Project stage'),nextLabel=node('label','Next project step');stageLabel.append(stage);nextLabel.append(nextStep);form.append(stageLabel,nextLabel,node('button','Save progress'));
    form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/update-progress',{projectId:id,stage:stage.value,nextStep:nextStep.value,expectedDigest:overview.progressDigest,operationId:crypto.randomUUID()});await administration();await project();status('Project progress saved.');});});box.append(form);
  }
  if(overview.progressHistory.length){const history=document.createElement('details');history.append(node('summary','Progress history'));for(const item of overview.progressHistory)history.append(node('p',`${reviewTime(item.timestamp)} — ${item.stage}`),node('p',item.nextStep));box.append(history);}
  if(adminAccess){
    const details=document.createElement('details');details.className='create-milestone';details.append(node('summary','Add a milestone'));
    const form=document.createElement('form'),fields={};
    for(const [key,text,maximum,tag] of [['milestoneId','Milestone name',128,'input'],['versionId','First review version',128,'input'],['title','First review title',200,'input'],['body','First review text',10000,'textarea']]){const input=document.createElement(tag);input.required=true;input.maxLength=maximum;fields[key]=input;const label=node('label',text);label.append(input);form.append(label);}
    form.append(node('p','The first review is published for the client Owner to approve.'),node('button','Add milestone'));
    form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/create-milestone',{projectId:id,...Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value]))});await administration();await project();status('Milestone added for client approval.');});});details.append(form);box.append(details);
  }
  if(adminAccess){
    for(const milestone of [...overview.completedMilestones,...overview.awaitingClient]){
      const details=document.createElement('details');details.className='publish-review';details.append(node('summary',`Publish review for ${milestone.id}`));
      const form=document.createElement('form');
      const version=document.createElement('input');version.required=true;version.maxLength=128;
      const title=document.createElement('input');title.required=true;title.maxLength=200;title.value=milestone.review?.title??'';
      const body=document.createElement('textarea');body.required=true;body.maxLength=10000;body.value=milestone.review?.body??'';
      for(const [text,input] of [['New review version',version],['Review title',title],['Review text',body]]){const label=node('label',text);label.append(input);form.append(label);}
      form.append(node('p','Published versions cannot be edited. The client Owner must approve each new version.'),node('button','Publish review'));
      form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/publish-review',{projectId:id,milestoneId:milestone.id,versionId:version.value,title:title.value,body:body.value,expectedVersionId:milestone.currentVersionId});await administration();await project();status('Review version published for client approval.');});});details.append(form);box.append(details);
    }
  }
  box.append(node('h3','Completed milestones'));for(const m of overview.completedMilestones)box.append(node('p',`${m.id} — approved`));
  box.append(node('h3','Approval history'));
  if(!overview.approvalHistory.length)box.append(node('p','No approvals recorded.'));
  for(const receipt of overview.approvalHistory){
    const details=document.createElement('details');details.className='approval-record';
    details.append(node('summary',`${receipt.milestoneId} — version ${receipt.versionId}`),node('p',`Approved: ${reviewTime(receipt.timestamp)}`));
    if(receipt.review)details.append(node('h4',receipt.review.title),node('p',receipt.review.body));
    else details.append(node('p','This legacy approval has no stored review text.'));
    box.append(details);
  }
  box.append(node('h3','Review feedback'));
  if(!overview.feedbackHistory.length)box.append(node('p','No feedback recorded.'));
  for(const feedback of overview.feedbackHistory){
    const card=node('article','');card.className='feedback-record';
    card.append(node('h4',`${feedback.milestoneId} — version ${feedback.versionId}`),node('p',`Saved: ${reviewTime(feedback.timestamp)}`),node('p',feedback.body));box.append(card);
  }
  box.append(node('h3','Awaiting your review'));if(!overview.awaitingClient.length)box.append(node('p','Nothing awaiting review.'));
  for(const m of overview.awaitingClient){
    const card=node('article','');card.append(node('h3',m.id),node('p',`Review version: ${m.currentVersionId}`));
    if(m.review){card.append(node('h4',m.review.title),node('p',m.review.body));}
    const approval=node('button','Approve this version');approval.type='button';approval.disabled=!overview.canApprove||Boolean(m.reviewRequired&&!m.review);
    if(m.reviewRequired&&!m.review)card.append(node('p','Review content is unavailable. Approval is paused.'));
    approval.addEventListener('click',async()=>{approval.disabled=true;try{await api('/api/portal/approve',{projectId:id,milestoneId:m.id,versionId:m.currentVersionId,...(m.review?{reviewDigest:m.review.digest}:{}),operationId:crypto.randomUUID()});status('Milestone approved.');await project();}catch(error){status(error.message);}finally{approval.disabled=false;}});
    card.append(approval,node('p','Only the client Owner can approve.'));
    const form=document.createElement('form'),label=node('label','Feedback'),body=document.createElement('textarea');body.required=true;body.maxLength=10000;label.append(body);form.append(label,node('button','Send feedback'));
    form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/feedback',{projectId:id,milestoneId:m.id,versionId:m.currentVersionId,body:body.value,operationId:crypto.randomUUID()});body.value='';await project();status('Feedback saved.');});});card.append(form);box.append(card);
  }
  for(const ticket of tickets){
    const card=node('article','');card.append(node('h3',ticket.subject),node('p',ticket.body));
    const open=node('button','Read conversation');open.type='button';
    open.addEventListener('click',async()=>{open.disabled=true;try{const data=await read('read-ticket',{projectId:id,ticketId:ticket.id});if(generation!==revision)return;const replies=node('div','');for(const reply of data.replies)replies.append(node('p',reply.body));
      const form=document.createElement('form'),label=node('label','Your reply'),body=document.createElement('textarea');body.required=true;body.maxLength=10000;label.append(body);form.append(label,node('button','Send reply'));form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/reply',{projectId:id,ticketId:ticket.id,body:body.value,operationId:crypto.randomUUID()});status('Reply saved.');await project();});});card.append(replies,form);open.remove();
    }catch(error){status(error.message);open.disabled=false;}});card.append(open);el('tickets').append(card);
  }
}
el('login').addEventListener('submit',event=>{event.preventDefault();busy(el('login'),async()=>{const input=Object.fromEntries(new FormData(el('login'))),data=await authClient.login(input);sessionToken=data.sessionToken;el('login').reset();let projects;try{projects=await read('projects',{});}catch(error){signedOut();throw error;}el('projects').replaceChildren();for(const p of projects){const option=node('option',p.id);option.value=p.id;el('projects').append(option);}el('account').hidden=true;el('workspace').hidden=false;el('logout').hidden=false;status(projects.length?'Signed in.':'No projects are assigned to your account.');await administration();await project();});});
el('redeem').addEventListener('submit',event=>{event.preventDefault();busy(el('redeem'),async()=>{await authClient.redeem(Object.fromEntries(new FormData(el('redeem'))));el('redeem').reset();el('invite-panel').open=false;status('Password set. You can now sign in.');});});
el('logout').addEventListener('click',async()=>{try{await authClient.logout();signedOut();status('Signed out.');}catch(error){status(error.message);}});
el('projects').addEventListener('change',()=>{project().catch(error=>status(error.message));});
el('ticket').addEventListener('submit',event=>{event.preventDefault();busy(el('ticket'),async()=>{await api('/api/portal/ticket',{...Object.fromEntries(new FormData(el('ticket'))),projectId:projectId(),operationId:crypto.randomUUID()});el('ticket').reset();status('Ticket saved.');await project();});});
// Tokens are held in memory only. An optional invitation fragment is removed
// immediately so it cannot appear in subsequent page/referrer URLs.
if(location.hash.startsWith('#invite=')){const code=location.hash.slice(8);history.replaceState(null,'',location.pathname);if(/^[A-Za-z0-9_-]{43}$/.test(code)){el('redeem').elements.invitationToken.value=code;el('invite-panel').open=true;}}

try {
  const config=await api('/auth-config.json',null,'GET');
  authClient=createAuthClient(config,{request:api});
  if(config.mode==='firebase-emulator'){
    el('invite-panel').hidden=true;
    el('account').querySelector('h1').textContent='Development project workspace';
    status('Firebase emulator: synthetic development accounts only.');
  }
  el('login').querySelector('button').disabled=false;
} catch { status('Sign-in is unavailable. Please try again later.'); }
