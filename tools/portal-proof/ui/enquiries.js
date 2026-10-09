// Owner-only data is rendered as text and removed with the surrounding workspace.
export function renderEnquiryInbox({container,api,status,isCurrent}) {
  const node=(tag,text)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;return item;};
  const section=node('section'),list=node('div'),detail=node('div');section.className='enquiry-inbox';
  section.append(node('h2','Enquiries'),node('p','Website enquiries saved for WVD. Email notification status is shown separately.'));
  const refresh=node('button','Refresh enquiries');refresh.type='button';
  const more=node('button','Load more enquiries');more.type='button';more.hidden=true;
  section.append(refresh,list,more,detail);container.append(section);
  let cursor=null,loading=false;const seen=new Set();
  const current=()=>isCurrent()&&section.isConnected;
  const reference=id=>'WVD-'+id.slice(0,12).toUpperCase();
  const notification=value=>({ACCEPTED:'Owner notification accepted by the email provider.',PENDING:'Owner notification pending.',UNKNOWN:'Owner notification outcome is uncertain. Check the mailbox before retrying.'}[value?.status]??'Owner notification status unavailable.');
  const show=async id=>{
    detail.replaceChildren();
    try {
      const row=await api('/api/admin/enquiries/'+encodeURIComponent(id),null,'GET');
      if(!current())return;
      const article=node('article'),heading=node('h3','Enquiry from '+row.fields.name);heading.tabIndex=-1;article.append(heading,node('p','Reference: '+reference(row.id)));
      const values=node('dl');
      for(const [key,label]of [['name','Name'],['business','Business or organisation'],['email','Contact email'],['need','Project brief'],['website','Existing website'],['timing','Timing'],['budget','Budget']]){
        if(!row.fields[key])continue;values.append(node('dt',label),node('dd',row.fields[key]));
      }
      values.append(node('dt','Full reference'),node('dd',row.id));
      article.append(values,node('p',notification(row.notification)));detail.append(article);heading.focus();
    }catch(error){if(current())status(error.message);}
  };
  const load=async reset=>{
    if(loading||!current())return;loading=true;refresh.disabled=true;more.disabled=true;
    if(reset){cursor=null;seen.clear();list.replaceChildren();detail.replaceChildren();more.hidden=true;}
    try {
      const query=new URLSearchParams({limit:'25',...(cursor?{cursor}:{})});
      const page=await api('/api/admin/enquiries?'+query,null,'GET');
      if(!current())return;
      if(!Array.isArray(page.enquiries))throw Error('Enquiries could not be loaded. Please try again.');
      for(const row of page.enquiries){
        if(seen.has(row.id))continue;seen.add(row.id);
        const card=node('article');card.append(node('h3',row.fields.name+' — '+row.fields.business),node('p','Reference: '+reference(row.id)),node('p',new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(row.createdAt))+' (UK time)'),node('p',notification(row.notification)));
        const open=node('button','Read enquiry');open.type='button';open.addEventListener('click',()=>show(row.id));card.append(open);list.append(card);
      }
      cursor=typeof page.nextCursor==='string'?page.nextCursor:null;more.hidden=!cursor;
      if(!seen.size)list.append(node('p','No current enquiries have been received.'));
    }catch(error){if(current())status(error.message);}finally {loading=false;refresh.disabled=false;more.disabled=false;}
  };
  refresh.addEventListener('click',()=>load(true));more.addEventListener('click',()=>load(false));
  return load(true);
}
