const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
// Only client-facing projections enter this renderer. No administration controls.
export function renderClientWorkspace({container,support,overview,api,reload,status,isCurrent}) {
  container.replaceChildren();support.hidden=true;
  const nav=node('nav','');nav.setAttribute('aria-label','Project sections');nav.className='client-navigation';
  const panels=new Map();
  for(const title of ['Overview','Progress','Deliverables','Feedback','Support']){
    const panel=node('section',''),button=node('button',title);button.type='button';panel.hidden=true;
    panel.append(node('h2',title));panels.set(title,panel);
    button.addEventListener('click',()=>{container.dataset.clientSection=title;for(const [name,item]of panels)item.hidden=name!==title;support.hidden=title!=='Support';for(const child of nav.children)child.setAttribute('aria-pressed',String(child===button));});
    nav.append(button);
  }
  container.append(nav,...panels.values());
  panels.get('Overview').append(node('h3',overview.projectId),node('p',`Current stage: ${overview.stage??'Awaiting update'}`),node('p',`Next step: ${overview.nextStep??'WVD will confirm your next step.'}`),node('p',`${overview.awaitingClient.length} items awaiting your review.`));
  const progress=panels.get('Progress');
  progress.append(node('p',`Current stage: ${overview.stage??'Awaiting update'}`));
  for(const entry of overview.progressHistory)progress.append(node('h3',entry.stage),node('p',entry.nextStep));
  if(!overview.progressHistory.length)progress.append(node('p','Your project updates will appear here.'));
  for(const milestone of overview.completedMilestones)progress.append(node('p',`${milestone.id} — approved`));
  const deliverables=panels.get('Deliverables');
  const reviews=[...overview.awaitingClient,...overview.completedMilestones];
  if(!reviews.length)deliverables.append(node('p','No deliverables have been shared yet.'));
  for(const item of reviews){
    const card=node('article','');card.append(node('h3',item.review?.title??item.id),node('p',item.review?.body??'WVD will share the review content here.'),node('p',item.status==='approved'?'Approved':'Awaiting review'));
    if(item.review?.deliverable)card.append(node('p',`${item.review.deliverable.label} — file preview is not connected yet. Contact WVD through Support before approving.`));
    if(item.status!=='approved'&&overview.canApprove){
      const approve=node('button','Approve this version');approve.type='button';approve.disabled=!item.review||Boolean(item.review.deliverable);
      approve.addEventListener('click',async()=>{approve.disabled=true;try{await api('/api/portal/approve',{projectId:overview.projectId,milestoneId:item.id,versionId:item.currentVersionId,reviewDigest:item.review.digest,operationId:crypto.randomUUID()});if(isCurrent()){await reload();status('Approval saved.');}}catch(error){if(isCurrent())status(error.message);}finally{if(isCurrent())approve.disabled=!item.review||Boolean(item.review.deliverable);}});card.append(approve);
    }
    deliverables.append(card);
  }
  const feedback=panels.get('Feedback');
  for(const item of overview.feedbackHistory)feedback.append(node('article',item.body));
  if(!overview.feedbackHistory.length)feedback.append(node('p','No feedback recorded yet.'));
  for(const item of overview.awaitingClient){
    const form=node('form',''),label=node('label',`Feedback on ${item.review?.title??item.id}`),body=node('textarea','');body.required=true;body.maxLength=10000;label.append(body);
    const send=node('button','Send feedback');form.append(label,send);
    form.addEventListener('submit',async event=>{event.preventDefault();send.disabled=true;try{await api('/api/portal/feedback',{projectId:overview.projectId,milestoneId:item.id,versionId:item.currentVersionId,body:body.value,operationId:crypto.randomUUID()});if(isCurrent()){await reload();status('Feedback saved.');}}catch(error){if(isCurrent())status(error.message);}finally{send.disabled=false;}});feedback.append(form);
  }
  ([...nav.children].find(button=>button.textContent===container.dataset.clientSection)??nav.firstElementChild).click();
}

export function clientInvitationControls({businessId,projectId,clientOrigin=location.origin,api,status,isCurrent}) {
  const box=node('details','');box.className='client-invitation';box.append(node('summary',`Invite client to ${projectId}`));
  const form=node('form',''),label=node('label','Client Google account email'),email=node('input','');email.type='email';email.required=true;email.maxLength=320;label.append(email);
  const button=node('button','Create invitation'),result=node('div','');
  form.append(label,node('p','Grants access and approval rights to this project only. Valid for seven days. Copy the link and share it with this client; no email is sent automatically.'),button);
  form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;result.replaceChildren();try{
    const invite=await api('/api/invitations/create',{businessId,projectIds:[projectId],email:email.value,expiresAt:new Date(Date.now()+7*24*60*60*1000-60000).toISOString(),operationId:crypto.randomUUID()});
    if(!isCurrent())return;
    if(invite.token){const link=clientOrigin+'/#member-invite='+invite.token,field=node('input','');field.readOnly=true;field.value=link;field.setAttribute('aria-label','Client invitation link');const copy=node('button','Copy invitation link');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link);status('Invitation link copied.');}catch{field.select();status('Select and copy the invitation link.');}});result.append(field,copy);}
    result.append(node('p','Invitation created. Keep this link private; it is shown only here.'));
  }catch(error){if(isCurrent())status(error.message);}finally{button.disabled=false;}});
  const history=node('div',''),load=node('button','Review invitations');load.type='button';
  const refresh=async()=>{const data=await api('/api/invitations/list',{projectId});if(!isCurrent())return;history.replaceChildren();for(const item of data.invitations){const row=node('article',`${item.email} — ${item.expired?'expired':item.status}`);if(item.canRevoke){const revoke=node('button','Revoke invitation');revoke.type='button';revoke.addEventListener('click',async()=>{revoke.disabled=true;try{await api('/api/invitations/revoke',{invitationId:item.invitationId});result.replaceChildren();await refresh();}catch(error){if(isCurrent())status(error.message);}finally{revoke.disabled=false;}});row.append(revoke);}history.append(row);}if(!data.invitations.length)history.append(node('p','No invitations for this project.'));};
  load.addEventListener('click',async()=>{load.disabled=true;try{await refresh();}catch(error){if(isCurrent())status(error.message);}finally{load.disabled=false;}});
  box.append(form,result,load,history);return box;
}
