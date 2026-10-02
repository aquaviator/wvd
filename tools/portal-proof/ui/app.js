import {createAuthClient} from './auth-client.js';
let authClient;
const el=id=>document.getElementById(id);
let sessionToken=null,revision=0;
const status=message=>{el('status').textContent=message;};
const messages={UNAUTHENTICATED:'Please sign in again.',ACCESS_DENIED:'Your account does not have permission for this action.',VERSION_CONFLICT:'This milestone has changed. Reload the project before reviewing it.',STATE_CONFLICT:'This milestone is no longer awaiting approval.',INVALID_INVITATION:'This invitation is invalid or expired. Ask WVD for a new one.',INVALID_PASSWORD:'Choose a password of at least 15 characters.',RATE_LIMITED:'Too many attempts. Please wait 15 minutes.',SERVICE_UNAVAILABLE:'The service is temporarily unavailable. Please try again.'};
function signedOut(){sessionToken=null;revision++;el('workspace').hidden=true;el('account').hidden=false;el('logout').hidden=true;el('overview').replaceChildren();el('tickets').replaceChildren();el('projects').replaceChildren();}
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
async function project(){
  const id=projectId(),generation=++revision;el('overview').replaceChildren();el('tickets').replaceChildren();if(!id)return;
  const [overview,tickets]=await Promise.all([read('overview',{projectId:id}),read('tickets',{projectId:id})]);
  if(generation!==revision||!sessionToken)return;
  const box=el('overview');box.append(node('h2','Project progress'),node('p',`Stage: ${overview.stage??'Awaiting update'}`),node('p',`Next step: ${overview.nextStep??'Awaiting update'}`));
  box.append(node('h3','Completed milestones'));for(const m of overview.completedMilestones)box.append(node('p',`${m.id} — approved`));
  box.append(node('h3','Awaiting your review'));if(!overview.awaitingClient.length)box.append(node('p','Nothing awaiting review.'));
  for(const m of overview.awaitingClient){
    const card=node('article','');card.append(node('h3',m.id),node('p',`Review version: ${m.currentVersionId}`));
    const approval=node('button','Approve this version');approval.type='button';
    approval.addEventListener('click',async()=>{approval.disabled=true;try{await api('/api/portal/approve',{projectId:id,milestoneId:m.id,versionId:m.currentVersionId,operationId:crypto.randomUUID()});status('Milestone approved.');await project();}catch(error){status(error.message);}finally{approval.disabled=false;}});
    card.append(approval,node('p','Only the client Owner can approve.'));
    const form=document.createElement('form'),label=node('label','Feedback'),body=document.createElement('textarea');body.required=true;body.maxLength=10000;label.append(body);form.append(label,node('button','Send feedback'));
    form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/feedback',{projectId:id,milestoneId:m.id,versionId:m.currentVersionId,body:body.value,operationId:crypto.randomUUID()});body.value='';status('Feedback saved.');});});card.append(form);box.append(card);
  }
  for(const ticket of tickets){
    const card=node('article','');card.append(node('h3',ticket.subject),node('p',ticket.body));
    const open=node('button','Read conversation');open.type='button';
    open.addEventListener('click',async()=>{open.disabled=true;try{const data=await read('read-ticket',{projectId:id,ticketId:ticket.id});if(generation!==revision)return;const replies=node('div','');for(const reply of data.replies)replies.append(node('p',reply.body));
      const form=document.createElement('form'),label=node('label','Your reply'),body=document.createElement('textarea');body.required=true;body.maxLength=10000;label.append(body);form.append(label,node('button','Send reply'));form.addEventListener('submit',event=>{event.preventDefault();busy(form,async()=>{await api('/api/portal/reply',{projectId:id,ticketId:ticket.id,body:body.value,operationId:crypto.randomUUID()});status('Reply saved.');await project();});});card.append(replies,form);open.remove();
    }catch(error){status(error.message);open.disabled=false;}});card.append(open);el('tickets').append(card);
  }
}
el('login').addEventListener('submit',event=>{event.preventDefault();busy(el('login'),async()=>{const input=Object.fromEntries(new FormData(el('login'))),data=await authClient.login(input);sessionToken=data.sessionToken;el('login').reset();let projects;try{projects=await read('projects',{});}catch(error){signedOut();throw error;}el('projects').replaceChildren();for(const p of projects){const option=node('option',p.id);option.value=p.id;el('projects').append(option);}el('account').hidden=true;el('workspace').hidden=false;el('logout').hidden=false;status(projects.length?'Signed in.':'No projects are assigned to your account.');await project();});});
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
