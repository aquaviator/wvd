import {renderClientWorkspace,clientInvitationControls} from './client-workspace.js';
import {createAuthClient} from './auth-client.js';
let authClient,invitationsEnabled=false,deliverablesEnabled=false,pendingMemberInvite=null;
let workspaceConfig=null;
let liveMode=false,ownerConfigured=false,enquiryInboxRenderer=null;
const el=id=>document.getElementById(id);
let sessionToken=null,revision=0,adminAccess=false,displayedProjectId=null;
const reviewTime=value=>new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(value))+' (UK time)';
const status=message=>{el('status').textContent=message;};
const messages={DELIVERABLE_UNAVAILABLE:'The referenced preview is not available for this review.',DELIVERABLE_CONTENT_CONFLICT:'The referenced file differs from the reviewed version. Ask WVD to publish a new review.',INVITATION_DENIED:'This invitation cannot be accepted. Check the invited email or ask the Owner for a new invitation.',INVITATION_CONFLICT:'This invitation has changed. Ask the Owner for a new invitation.',CLIENT_CONFLICT:'That client already exists. Refresh the overview and add projects to the existing client.',ACCESS_REVISION_CONFLICT:'Account access has changed. Refresh the account list before saving.',ACCESS_ROLE_CONFLICT:'The account role has changed. Refresh the account list before saving.',TRIAGE_CONFLICT:'The ticket assessment has changed. Reload the project before saving.',PROJECT_CONFLICT:'That project name is already in use. Reload the client overview before creating another project.',MILESTONE_CONFLICT:'That milestone already exists. Reload the project and use its review workflow.',REVIEW_IMMUTABLE:'That version already has different review content. Use a new version identifier.',PROGRESS_CONFLICT:'Project progress has changed. Reload the project before saving.',UNAUTHENTICATED:'Please sign in again.',ACCESS_DENIED:'Your account does not have permission for this action.',REVIEW_CONFLICT:'The review content has changed or is unavailable. Reload the project.',VERSION_CONFLICT:'This milestone has changed. Reload the project before reviewing it.',STATE_CONFLICT:'This milestone is no longer awaiting approval.',INVALID_INVITATION:'This invitation is invalid or expired. Ask WVD for a new one.',INVALID_PASSWORD:'Choose a password of at least 15 characters.',RATE_LIMITED:'Too many attempts. Please wait 15 minutes.',SERVICE_UNAVAILABLE:'The service is temporarily unavailable. Please try again.'};
function signedOut(){sessionToken=null;adminAccess=false;displayedProjectId=null;revision++;el('workspace').hidden=true;el('account').hidden=false;el('logout').hidden=true;el('overview').replaceChildren();el('tickets').replaceChildren();el('projects').replaceChildren();el('admin-overview').replaceChildren();el('admin-overview').hidden=true;el('ticket').reset();}
async function api(path,body,method='POST'){
  const session=sessionToken;let bearer=session;
  if(session&&liveMode){try{bearer=await authClient.getSessionToken();if(session!==sessionToken)throw Error('Please sign in again.');}catch(error){if(session===sessionToken)signedOut();throw error;}}
  const headers={};if(bearer)headers.Authorization=`Bearer ${bearer}`;
  const options={method,headers,credentials:'omit',cache:'no-store'};
  if(method==='POST'){headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
  const response=await fetch(path,options);const data=await response.json();
  if(session&&session!==sessionToken)throw Error('Please sign in again.');
  if(!response.ok){if(response.status===401&&(path.startsWith('/api/portal/')||liveMode&&path.startsWith('/api/admin/'))){signedOut();if(liveMode)await authClient.logout().catch(()=>{});}const error=new Error(messages[data.error]??'The request could not be completed.');error.code=data.error;throw error;}return data;
}
function node(tag,text){const result=document.createElement(tag);result.textContent=text;return result;}
function deliverableReference(container,review,onViewed,onUnavailable){
  if(!review?.deliverable)return;const item=review.deliverable;
  container.append(node('p',`Deliverable: ${item.label}`),node('p',`Deliverable version: ${item.sourceVersion}`));
  if(!deliverablesEnabled||!['text/plain','image/png'].includes(item.mediaType)){container.append(node('p','Preview access is not connected for this deliverable.'));return;}
  const button=node('button','View referenced deliverable'),snapshot=node(item.mediaType==='image/png'?'img':'pre','');button.type='button';snapshot.className='deliverable-snapshot';snapshot.hidden=true;const generation=revision;const clear=()=>{snapshot.hidden=true;snapshot.removeAttribute('src');snapshot.textContent='';onUnavailable?.();};
  button.addEventListener('click',async()=>{button.disabled=true;clear();try{
    const data=await api('/api/portal/deliverable',{projectId:review.projectId,milestoneId:review.milestoneId,versionId:review.versionId,reviewDigest:review.digest});
    if(generation!==revision||!sessionToken||!container.isConnected)return;
    if(data.reviewDigest!==review.digest)throw Error('The referenced content could not be verified.');
    if(item.mediaType==='image/png'){
      if(data.mediaType!=='image/png'||typeof data.contentBase64!=='string'||data.contentBase64.length>699052||data.contentBase64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(data.contentBase64)||!Number.isSafeInteger(data.width)||!Number.isSafeInteger(data.height)||data.width<1||data.height<1||data.width>2048||data.height>2048)throw Error('The referenced content could not be verified.');
      snapshot.alt=item.label;snapshot.src=`data:image/png;base64,${data.contentBase64}`;
      await snapshot.decode();
      if(snapshot.naturalWidth!==data.width||snapshot.naturalHeight!==data.height)throw Error('The referenced content could not be verified.');
    }else{if(typeof data.contentText!=='string')throw Error('The referenced content could not be verified.');snapshot.textContent=data.contentText;}
    if(generation!==revision||!sessionToken||!container.isConnected)return;
    snapshot.hidden=false;onViewed?.();
  }catch(error){status(error.message);}finally{button.disabled=false;}});
  container.append(button,snapshot);return clear;
}
async function busy(form,fn){status('');const button=form.querySelector('button');button.disabled=true;try{await fn();}catch(error){status(error.message);}finally{button.disabled=false;}}
const projectId=()=>el('projects').value;
const read=(action,params)=>api(`/api/portal/${action}?${new URLSearchParams(params)}`,null,'GET');
async function administration(){
  const token=sessionToken,box=el('admin-overview');box.replaceChildren();box.hidden=true;
  const access=await read('workspace-access',{});
  if(token!==sessionToken)return;adminAccess=access.admin===true;
  if(liveMode)el('workspace').querySelector('h1').textContent=adminAccess?'Owner workspace':'Your project workspace';
  if(!adminAccess)return;
  const overview=await read('admin-overview',{});
  if(token!==sessionToken)return;
  const selected=projectId();el('projects').replaceChildren();
  for(const business of overview.businesses)for(const item of business.projects){const option=node('option',item.projectId);option.value=item.projectId;el('projects').append(option);}
  if(overview.businesses.some(x=>x.projects.some(p=>p.projectId===selected)))el('projects').value=selected;
  box.append(node('h2','WVD administration'),node('p','Client and project overview. Select a project to read feedback and support conversations.'));
  if(enquiryInboxRenderer){await enquiryInboxRenderer({container:box,api,status,isCurrent:()=>token===sessionToken&&box.isConnected});if(token!==sessionToken)return;}
  const refresh=node('button','Refresh overview');refresh.type='button';refresh.addEventListener('click',async()=>{refresh.disabled=true;try{await administration();}catch(error){status(error.message);}finally{refresh.disabled=false;}});box.append(refresh);
  for(const business of overview.businesses){
    const section=node('section','');section.append(node('h3',`Client: ${business.businessId}`));
    for(const item of business.projects){
      const card=node('article','');card.append(node('h4',item.projectId),node('p',`Stage: ${item.stage??'Awaiting update'}`),node('p',`Next step: ${item.nextStep??'Awaiting update'}`),node('p',`${item.awaitingReview} awaiting review · ${item.feedbackCount} feedback ${item.feedbackCount===1?'record':'records'} · ${item.ticketCount} support ${item.ticketCount===1?'ticket':'tickets'}`));
      const open=node('button','Open project');open.type='button';open.addEventListener('click',()=>{el('projects').value=item.projectId;project().catch(error=>status(error.message));});card.append(open);if(liveMode&&invitationsEnabled)card.append(clientInvitationControls({businessId:business.businessId,projectId:item.projectId,clientOrigin:workspaceConfig?.clientOrigin,api,status,isCurrent:()=>token===sessionToken&&card.isConnected}));section.append(card);
    }
    const accounts=document.createElement('details');accounts.className='admin-accounts';accounts.append(node('summary','Client accounts'));
    const load=node('button','Load accounts');load.type='button';const list=node('div','');list.className='account-list';
    load.addEventListener('click',async()=>{load.disabled=true;try{
      const result=await read('admin-accounts',{businessId:business.businessId});
      if(token!==sessionToken||!accounts.isConnected)return;
      list.replaceChildren();
      for(const account of result.accounts){const card=node('article','');card.append(node('h4',`Account: ${account.accountId}`),node('p',`Role: ${account.role}`),node('p',`Portal identity: ${account.identityActive?'Active':'Disabled'}`),node('p',`Client membership: ${account.membershipActive?'Active':'Revoked'}`),node('p',`Project access: ${account.projectIds.length?account.projectIds.join(', '):'No projects assigned'}`));
        if(Number.isSafeInteger(result.revision)){
          const form=document.createElement('form');form.className='account-project-access';const group=document.createElement('fieldset');group.append(node('legend','Assigned projects'));const choices=[];
          for(const item of business.projects){const check=document.createElement('input');check.type='checkbox';check.value=item.projectId;check.checked=account.projectIds.includes(item.projectId);check.disabled=(!account.identityActive||!account.membershipActive)&&!check.checked;const label=node('label',item.projectId);label.prepend(check);group.append(label);choices.push(check);}
          form.append(group,node('p','This changes project access only. Account role and activation stay the same.'),node('button','Save project access'));
          form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/admin-update-access',{uid:account.accountId,businessId:business.businessId,role:account.role,projectIds:choices.filter(x=>x.checked).map(x=>x.value),expectedRevision:result.revision});if(token!==sessionToken||!accounts.isConnected)return;await administration();await project();status('Project access saved.');});});card.append(form);
        }
        list.append(card);}
      if(!result.accounts.length)list.append(node('p','No client accounts are recorded.'));
      load.textContent='Refresh accounts';
    }catch(error){if(token===sessionToken)status(error.message);}finally{load.disabled=false;}});
    accounts.append(node('p','Stored portal access. This view does not check current Firebase sign-in status. An active, verified Firebase account is required when adding project access.'),load,list);section.append(accounts);
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
  const newClient=document.createElement('details');newClient.className='create-client';newClient.append(node('summary','Create a client and first project'));
  const clientForm=document.createElement('form'),clientFields={};
  for(const [key,text,maximum,tag] of [['businessId','New client name',128,'input'],['projectId','First project name',128,'input'],['stage','First project stage',200,'input'],['nextStep','First project next step',2000,'textarea']]){const input=document.createElement(tag);input.required=true;input.maxLength=maximum;clientFields[key]=input;const label=node('label',text);label.append(input);clientForm.append(label);}
  clientForm.append(node('p','Creates a client record and first project. Sign-in accounts and project permissions are set up separately.'),node('button','Create client'));
  clientForm.addEventListener('submit',event=>{event.preventDefault();busy(clientForm,async()=>{const created=await api('/api/portal/create-client',Object.fromEntries(Object.entries(clientFields).map(([key,input])=>[key,input.value])));if(token!==sessionToken||!newClient.isConnected)return;await administration();el('projects').value=created.projectId;await project();status('Client and first project created. Account access is assigned separately.');});});newClient.append(clientForm);box.append(newClient);
  if(!overview.businesses.length)box.append(node('p','No client projects are recorded.'));
  box.hidden=false;
}
async function project(){
  const id=projectId(),generation=++revision;if(id!==displayedProjectId){el('ticket').reset();displayedProjectId=id;}el('overview').replaceChildren();el('tickets').replaceChildren();if(liveMode){el('project-selector').hidden=!id;el('support-tickets').hidden=!id;}if(!id)return;
  const [overview,tickets]=await Promise.all([read('overview',{projectId:id}),read('tickets',{projectId:id})]);
  const colleagues=overview.canManageColleagues?await read('colleagues',{projectId:id}):null;
  const catalogue=adminAccess?await read('deliverable-catalogue',{projectId:id}):[];
  const addDeliverableChoice=form=>{if(!catalogue.length)return null;const select=document.createElement('select'),label=node('label','Referenced deliverable');select.setAttribute('aria-label','Referenced deliverable');const empty=node('option','No referenced deliverable (text review only)');empty.value='';select.append(empty);for(const item of catalogue){const option=node('option',`${item.label} — ${item.sourceVersion}`);option.value=item.id;select.append(option);}label.append(select);form.append(label);return select;};
  if(generation!==revision||!sessionToken)return;
  const box=el('overview');box.append(node('h2','Project progress'),node('p',`Stage: ${overview.stage??'Awaiting update'}`),node('p',`Next step: ${overview.nextStep??'Awaiting update'}`));
  if(adminAccess){
    const form=document.createElement('form');form.append(node('h3','Update project progress'));
    const stage=document.createElement('input');stage.required=true;stage.maxLength=200;stage.value=overview.stage??'';
    const nextStep=document.createElement('textarea');nextStep.required=true;nextStep.maxLength=2000;nextStep.value=overview.nextStep??'';
    const stageLabel=node('label','Project stage'),nextLabel=node('label','Next project step');stageLabel.append(stage);nextLabel.append(nextStep);form.append(stageLabel,nextLabel,node('button','Save progress'));
    form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/update-progress',{projectId:id,stage:stage.value,nextStep:nextStep.value,expectedDigest:overview.progressDigest,operationId:crypto.randomUUID()});await administration();await project();status('Project progress saved.');});});box.append(form);
  }
  if(colleagues){
    const details=document.createElement('details');details.className='colleague-access';details.append(node('summary','Manage Member access to this project'),node('p',`Project: ${id}`),node('p','Existing Member accounts for this client. These controls change access to this project only; business roles and activation stay the same. Stored portal status does not check current Firebase sign-in status.'));
    const refresh=node('button','Refresh colleague access');refresh.type='button';refresh.addEventListener('click',()=>project().catch(error=>status(error.message)));details.append(refresh);
    for(const account of colleagues.accounts){const card=node('article','');card.append(node('h4',`Member account: ${account.accountId}`),node('p',`This project: ${account.hasProjectAccess?'Assigned':'Not assigned'}`));
      const form=document.createElement('form'),button=node('button',account.hasProjectAccess?'Remove this project':'Grant this project');button.disabled=!account.hasProjectAccess&&(!account.identityActive||!account.membershipActive);form.append(button);
      if(!account.identityActive||!account.membershipActive)card.append(node('p','Portal access is disabled or revoked. New grants are unavailable.'));
      form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/update-colleague-access',{projectId:id,uid:account.accountId,grant:!account.hasProjectAccess,expectedRevision:colleagues.revision});if(generation!==revision||!sessionToken)return;await project();status('Colleague project access saved.');});});card.append(form);details.append(card);
    }
    if(!colleagues.accounts.length)details.append(node('p','No Member accounts are recorded for this client.'));
    if(invitationsEnabled){
      const form=document.createElement('form');form.className='member-invitation';form.append(node('h3','Invite a Member to this project'));
      const email=document.createElement('input');email.type='email';email.required=true;email.maxLength=320;
      const expiry=document.createElement('input');expiry.type='datetime-local';expiry.required=true;
      for(const [text,input]of [['Member email',email],['Invitation expiry (your local time)',expiry]]){const label=node('label',text);label.append(input);form.append(label);}
      form.append(node('p','The recipient must sign in with a verified Firebase account matching this email. This grants Member access to this project. No email is sent.'),node('button','Create Member invitation'));
      const resultBox=node('div','');resultBox.className='invitation-actions';form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{resultBox.replaceChildren();const result=await api('/api/invitations/create',{businessId:colleagues.businessId,email:email.value,projectIds:[id],expiresAt:new Date(expiry.value).toISOString(),operationId:crypto.randomUUID()});if(generation!==revision||!sessionToken||!details.isConnected)return;resultBox.append(node('p',`Invitation expires ${reviewTime(result.expiresAt)}.`));
        if(result.token){const link=(workspaceConfig?.clientOrigin??location.origin)+'/#member-invite='+result.token;const copy=node('button','Copy invitation link');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link);status('Invitation link copied. Share it with the invited colleague.');}catch{status('Clipboard access is unavailable. Revoke this invitation and try again in a supported browser.');}});resultBox.append(copy);}
        const revoke=node('button','Revoke this invitation');revoke.type='button';revoke.addEventListener('click',async()=>{revoke.disabled=true;try{await api('/api/invitations/revoke',{invitationId:result.invitationId});resultBox.replaceChildren(node('p','Invitation revoked.'));status('Invitation revoked.');}catch(error){status(error.message);revoke.disabled=false;}});resultBox.append(revoke);status('Member invitation created. Copy the link now; it is not retained after leaving this view.');
      });});details.append(form,resultBox);
      const load=node('button','Load your invitations'),historyBox=node('div','');load.type='button';historyBox.className='member-invitation-history';
      const loadHistory=async()=>{const history=await api('/api/invitations/list',{projectId:id});if(generation!==revision||!sessionToken||!details.isConnected)return;historyBox.replaceChildren();for(const invitation of history.invitations){const card=node('article','');card.append(node('h4',`Invitation: ${invitation.email}`),node('p',`Status: ${invitation.expired?'Expired':invitation.status}`),node('p',`Expires: ${reviewTime(invitation.expiresAt)}`));if(invitation.canRevoke){const revoke=node('button','Revoke pending invitation');revoke.type='button';revoke.addEventListener('click',async()=>{revoke.disabled=true;try{await api('/api/invitations/revoke',{invitationId:invitation.invitationId});await loadHistory();status('Invitation revoked.');}catch(error){status(error.message);revoke.disabled=false;}});card.append(revoke);}historyBox.append(card);}if(!history.invitations.length)historyBox.append(node('p','You have no invitations for this project.'));load.textContent='Refresh your invitations';};
      load.addEventListener('click',async()=>{load.disabled=true;try{await loadHistory();}catch(error){status(error.message);}finally{load.disabled=false;}});details.append(node('h3','Your invitations to this project'),load,historyBox);
    }box.append(details);
  }
  if(overview.progressHistory.length){const history=document.createElement('details');history.append(node('summary','Progress history'));for(const item of overview.progressHistory)history.append(node('p',`${reviewTime(item.timestamp)} — ${item.stage}`),node('p',item.nextStep));box.append(history);}
  if(adminAccess){
    const details=document.createElement('details');details.className='create-milestone';details.append(node('summary','Add a milestone'));
    const form=document.createElement('form'),fields={};
    for(const [key,text,maximum,tag] of [['milestoneId','Milestone name',128,'input'],['versionId','First review version',128,'input'],['title','First review title',200,'input'],['body','First review text',10000,'textarea']]){const input=document.createElement(tag);input.required=true;input.maxLength=maximum;fields[key]=input;const label=node('label',text);label.append(input);form.append(label);}
    const deliverableChoice=addDeliverableChoice(form);
    form.append(node('p','The first review is published for the client Owner to approve.'),node('button','Add milestone'));
    form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/create-milestone',{projectId:id,...Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value])),...(deliverableChoice?.value?{deliverableId:deliverableChoice.value}:{})});await administration();await project();status('Milestone added for client approval.');});});details.append(form);box.append(details);
  }
  if(adminAccess){
    for(const milestone of [...overview.completedMilestones,...overview.awaitingClient]){
      const details=document.createElement('details');details.className='publish-review';details.append(node('summary',`Publish review for ${milestone.id}`));
      const form=document.createElement('form');
      const version=document.createElement('input');version.required=true;version.maxLength=128;
      const title=document.createElement('input');title.required=true;title.maxLength=200;title.value=milestone.review?.title??'';
      const body=document.createElement('textarea');body.required=true;body.maxLength=10000;body.value=milestone.review?.body??'';
      for(const [text,input] of [['New review version',version],['Review title',title],['Review text',body]]){const label=node('label',text);label.append(input);form.append(label);}
      const deliverableChoice=addDeliverableChoice(form);
      form.append(node('p','Published versions cannot be edited. The client Owner must approve each new version.'),node('button','Publish review'));
      form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/publish-review',{projectId:id,milestoneId:milestone.id,versionId:version.value,title:title.value,body:body.value,expectedVersionId:milestone.currentVersionId,...(deliverableChoice?.value?{deliverableId:deliverableChoice.value}:{})});await administration();await project();status('Review version published for client approval.');});});details.append(form);box.append(details);
    }
  }
  box.append(node('h3','Completed milestones'));for(const m of overview.completedMilestones)box.append(node('p',`${m.id} — approved`));
  box.append(node('h3','Approval history'));
  if(!overview.approvalHistory.length)box.append(node('p','No approvals recorded.'));
  for(const receipt of overview.approvalHistory){
    const details=document.createElement('details');details.className='approval-record';
    details.append(node('summary',`${receipt.milestoneId} — version ${receipt.versionId}`),node('p',`Approved: ${reviewTime(receipt.timestamp)}`));
    if(receipt.review){details.append(node('h4',receipt.review.title),node('p',receipt.review.body));deliverableReference(details,receipt.review);}
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
    let reviewed=!m.review?.deliverable,clearPreview;const approval=node('button','Approve this version');approval.type='button';const unavailable=()=>{reviewed=false;approval.disabled=true;};approval.disabled=!overview.canApprove||Boolean(m.reviewRequired&&!m.review)||!reviewed;
    if(m.review?.deliverable){const notice=node('p','Approval is paused until the referenced preview can be reviewed.');card.append(notice);clearPreview=deliverableReference(card,m.review,()=>{reviewed=true;notice.textContent='Referenced content verified for this review version.';approval.disabled=!overview.canApprove;},()=>{unavailable();notice.textContent='Approval is paused until the referenced preview can be reviewed.';});}
    if(m.reviewRequired&&!m.review)card.append(node('p','Review content is unavailable. Approval is paused.'));
    approval.addEventListener('click',async()=>{approval.disabled=true;try{await api('/api/portal/approve',{projectId:id,milestoneId:m.id,versionId:m.currentVersionId,...(m.review?{reviewDigest:m.review.digest}:{}),operationId:crypto.randomUUID()});status('Milestone approved.');await project();}catch(error){if(['DELIVERABLE_CONTENT_CONFLICT','DELIVERABLE_UNAVAILABLE'].includes(error.code)){unavailable();clearPreview?.();}status(error.message);}finally{approval.disabled=!overview.canApprove||Boolean(m.reviewRequired&&!m.review)||!reviewed;}});
    card.append(approval,node('p','Only the client Owner can approve.'));
    const form=document.createElement('form'),label=node('label','Feedback'),body=document.createElement('textarea');body.required=true;body.maxLength=10000;label.append(body);form.append(label,node('button','Send feedback'));
    form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/feedback',{projectId:id,milestoneId:m.id,versionId:m.currentVersionId,body:body.value,operationId:crypto.randomUUID()});body.value='';await project();status('Feedback saved.');});});card.append(form);box.append(card);
  }
  if(liveMode&&!adminAccess)renderClientWorkspace({container:box,support:el('support-tickets'),overview,api,reload:project,status,isCurrent:()=>generation===revision&&Boolean(sessionToken)});
  for(const ticket of tickets){
    const card=node('article','');card.append(node('h3',ticket.subject),node('p',ticket.body));
    const careLabel=value=>({'needs-review':'Needs review','care-included':'Included in agreed Care','quote-required':'Separate quote required'})[value];
    if(ticket.triage){const note=node('p',ticket.triage.note);note.className='assessment-note';card.append(node('h4','WVD assessment'),node('p',`Priority: ${ticket.triage.priority}`),node('p',`Care scope: ${careLabel(ticket.triage.careAssessment)}`),note,node('p',`Assessed: ${reviewTime(ticket.triage.timestamp)}`));}
    else card.append(node('p','Awaiting WVD assessment.'));
    if(ticket.triageHistory.length){const history=document.createElement('details');history.append(node('summary','Assessment history'));for(const entry of ticket.triageHistory)history.append(node('p',`${reviewTime(entry.timestamp)} — ${entry.priority}; ${careLabel(entry.careAssessment)}`),node('p',entry.note));card.append(history);}
    if(adminAccess){
      const details=document.createElement('details');details.className='triage-ticket';details.append(node('summary','Assess support scope'));
      const form=document.createElement('form'),priority=document.createElement('input');priority.required=true;priority.maxLength=100;priority.value=ticket.triage?.priority??'';
      const priorityLabel=node('label','WVD priority');priorityLabel.append(priority);form.append(priorityLabel);
      const care=document.createElement('select');care.id=`triage-care-${ticket.id}`;care.required=true;
      const placeholder=node('option','Choose an assessment');placeholder.value='';placeholder.disabled=true;care.append(placeholder);
      for(const value of ['needs-review','care-included','quote-required']){const option=node('option',careLabel(value));option.value=value;care.append(option);}care.value=ticket.triage?.careAssessment??'';
      const label=node('label','Care assessment');label.htmlFor=care.id;form.append(label,care);
      const note=document.createElement('textarea');note.required=true;note.maxLength=2000;note.value=ticket.triage?.note??'';const noteLabel=node('label','Assessment note (visible to client)');noteLabel.append(note);form.append(noteLabel,node('p',"Use the client's agreed Care scope."),node('button','Save assessment'));
      form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/triage-ticket',{projectId:id,ticketId:ticket.id,priority:priority.value,careAssessment:care.value,note:note.value,expectedDigest:ticket.triageDigest,operationId:crypto.randomUUID()});await project();status('Ticket assessment saved.');});});details.append(form);card.append(details);
    }
    const open=node('button','Read conversation');open.type='button';
    open.addEventListener('click',async()=>{open.disabled=true;try{const data=await read('read-ticket',{projectId:id,ticketId:ticket.id});if(generation!==revision)return;const replies=node('div','');for(const reply of data.replies)replies.append(node('p',reply.body));
      const form=document.createElement('form'),label=node('label','Your reply'),body=document.createElement('textarea');body.required=true;body.maxLength=10000;label.append(body);form.append(label,node('button','Send reply'));form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/reply',{projectId:id,ticketId:ticket.id,body:body.value,operationId:crypto.randomUUID()});status('Reply saved.');await project();});});card.append(replies,form);open.remove();
    }catch(error){status(error.message);open.disabled=false;}});card.append(open);el('tickets').append(card);
  }
}
function invitedRegistration(){
    if(!liveMode&&pendingMemberInvite&&invitationsEnabled&&authClient&&!el('firebase-registration')){
      const details=document.createElement('details');details.id='firebase-registration';details.append(node('summary','Create your invited development account'));
      const form=document.createElement('form'),email=document.createElement('input'),password=document.createElement('input');email.type='email';email.required=true;email.maxLength=320;email.autocomplete='username';password.type='password';password.required=true;password.minLength=15;password.maxLength=1024;password.autocomplete='new-password';
      for(const [text,input]of [['Invited account email',email],['Invited account password',password]]){const label=node('label',text);label.append(input);form.append(label);}
      form.append(node('p','Synthetic emulator accounts only. Use the email named in the invitation and a password of at least 15 characters. Registration does not grant project access.'),node('button','Create invited account'));
      form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{try{await authClient.register({email:email.value,password:password.value});status('Verification requested. In this emulator, use the action code shown by the development Auth emulator, then sign in.');}finally{password.value='';}});});
      const resend=node('button','Request another verification code');resend.type='button';resend.addEventListener('click',async()=>{resend.disabled=true;try{await authClient.requestVerification({email:email.value,password:password.value});status('Verification requested from the development Auth emulator.');}catch(error){status(error.message);}finally{password.value='';resend.disabled=false;}});form.append(resend);
      const verify=document.createElement('form'),code=document.createElement('input');code.required=true;code.maxLength=2048;code.autocomplete='off';const label=node('label','Development email verification code');label.append(code);verify.append(label,node('button','Verify development email'));
      verify.addEventListener('submit',event=>{event.preventDefault();busy(verify,async()=>{try{await authClient.confirmVerification({code:code.value});status('Email verified. Sign in above to accept the invitation.');}finally{code.value='';}});});details.append(form,verify);el('account').append(details);
    }

}
el('login').addEventListener('submit',event=>{event.preventDefault();busy(el('login'),async()=>{const input=Object.fromEntries(new FormData(el('login'))),data=await authClient.login(input);sessionToken=data.sessionToken;el('login').reset();if(liveMode&&!ownerConfigured){await authClient.logout();signedOut();status('Google sign-in completed. Owner workspace access is awaiting activation.');return;}let projects;try{if(pendingMemberInvite){if(!invitationsEnabled)throw Error('Invitation acceptance is unavailable.');await api('/api/invitations/redeem',{token:pendingMemberInvite});pendingMemberInvite=null;el('firebase-registration')?.remove();}projects=await read('projects',{});}catch(error){signedOut();if(liveMode)await authClient.logout().catch(()=>{});throw error;}el('projects').replaceChildren();for(const p of projects){const option=node('option',p.id);option.value=p.id;el('projects').append(option);}el('account').hidden=true;el('workspace').hidden=false;el('logout').hidden=false;status(projects.length?'Signed in.':'No projects are assigned to your account.');await administration();await project();});});
el('redeem').addEventListener('submit',event=>{event.preventDefault();busy(el('redeem'),async()=>{await authClient.redeem(Object.fromEntries(new FormData(el('redeem'))));el('redeem').reset();el('invite-panel').open=false;status('Password set. You can now sign in.');});});
el('logout').addEventListener('click',async()=>{
  // The local adapter must revoke its bearer session before that token is
  // cleared. Firebase sign-out owns its token and can clear private UI first.
  const button=el('logout');button.disabled=true;if(liveMode)signedOut();
  try{await authClient.logout();if(!liveMode)signedOut();status('Signed out.');}
  catch(error){if(!liveMode)signedOut();status(error.message);}
  finally{button.disabled=false;}
});
el('projects').addEventListener('change',()=>{project().catch(error=>status(error.message));});
el('ticket').addEventListener('submit',event=>{event.preventDefault();busy(el('ticket'),async()=>{await api('/api/portal/ticket',{...Object.fromEntries(new FormData(el('ticket'))),projectId:projectId(),operationId:crypto.randomUUID()});el('ticket').reset();status('Ticket saved.');await project();});});
// Tokens are held in memory only. An optional invitation fragment is removed
// immediately so it cannot appear in subsequent page/referrer URLs.
function captureMemberInvitation(){if(location.hash.startsWith('#member-invite=')){const code=location.hash.slice(15);history.replaceState(null,'',location.pathname);if(/^[A-Za-z0-9_-]{43}$/.test(code)){pendingMemberInvite=code;invitedRegistration();if(authClient)status(sessionToken?'Sign out, then sign in with the email named in this invitation.':'Sign in with the verified email account named in your Member invitation.');}}}
captureMemberInvitation();window.addEventListener('hashchange',captureMemberInvitation);
if(location.hash.startsWith('#invite=')){const code=location.hash.slice(8);history.replaceState(null,'',location.pathname);if(/^[A-Za-z0-9_-]{43}$/.test(code)){el('redeem').elements.invitationToken.value=code;el('invite-panel').open=true;}}

try {
  const config=await api('/auth-config.json',null,'GET');
  const {invitationsEnabled:enabled,deliverablesEnabled:previews,workspace,...authConfig}=config;workspaceConfig=workspace??null;invitationsEnabled=enabled===true;deliverablesEnabled=previews===true;
  if(config.mode==='firebase-live'){
    const {createLiveAuthClient}=await import('./live-auth-client.js');
    authClient=await createLiveAuthClient(authConfig);liveMode=true;ownerConfigured=config.ownerConfigured;
    if(config.enquiriesEnabled){const {renderEnquiryInbox}=await import('./enquiries.js');enquiryInboxRenderer=renderEnquiryInbox;}
    el('firebase-registration')?.remove();el('invite-panel').hidden=true;
    el('login').querySelectorAll('label').forEach(label=>label.remove());el('login').querySelector('button').textContent='Continue with Google';
    el('account').querySelector('h1').textContent='Your WVD workspace';el('workspace').querySelector('h1').textContent='Owner workspace';
    el('account-introduction').textContent='Sign in with your invited Google account to view your projects. WVD owners use their authorised account.';
    el('account-access-note').textContent='Access is by invitation only. Your account can see only its assigned projects.';
    document.querySelector('.portal-label').textContent='Project portal';document.title='Wear Valley Digital — Project portal';
    if(workspaceConfig){
      const admin=workspaceConfig.kind==='admin';
      document.querySelector('.portal-label').textContent=admin?'Owner workspace':'Client Portal';
      document.title='Wear Valley Digital — '+(admin?'Owner workspace':'Client Portal');
      el('account').querySelector('h1').textContent=admin?'Your WVD owner workspace':'Your client project';
      el('account-introduction').textContent=admin?'Sign in with your authorised WVD owner account.':'Sign in with the Google account named in your project invitation.';
      el('account-access-note').textContent=admin?'Owner access only. Client accounts cannot open this workspace.':'Your account can see only its assigned projects.';
      if(admin){const link=node('a','Go to Client Portal');link.href=workspaceConfig.clientOrigin;el('account').append(link);}
      if(workspaceConfig.kind==='shared'){const links=node('p','');for(const [label,url]of [['Client Portal',workspaceConfig.clientOrigin],['Owner workspace',workspaceConfig.adminOrigin]]){const a=node('a',label);a.href=url;links.append(a,document.createTextNode(' · '));}el('account').append(links);}
    }
    if(!ownerConfigured)status('Owner access is being set up. Google sign-in can be completed, but private workspace access is not active yet.');
  }else authClient=createAuthClient(authConfig,{request:api});
  if(config.mode==='firebase-emulator'){
    el('invite-panel').hidden=true;
    invitedRegistration();
    el('account').querySelector('h1').textContent='Development project workspace';
    status(pendingMemberInvite?'Sign in with the verified email account named in your Member invitation.':'Firebase emulator: synthetic development accounts only.');
  }
  el('login').querySelector('button').disabled=false;
} catch { status('Sign-in is unavailable. Please try again later.'); }
