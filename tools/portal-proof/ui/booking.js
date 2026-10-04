// Isolated preview only. No capability appears in a URL, analytics or console.
const byId=id=>document.getElementById(id);
const cancellationEnabled=document.body.dataset.cancellationEnabled==='true';
const day=byId('day'),find=byId('find'),slots=byId('slots'),confirm=byId('confirm'),retry=byId('retry'),message=byId('message'),meet=byId('meet');
const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'});
const dateKey=value=>{const parts=dateFormat.formatToParts(value);return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');};
const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const fullFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
let selected=null,pending=null,management=null,cancelling=false,busy=false;
const storageKey='wvd-development-booking-retry-v1';
const managementKey='wvd-development-booking-management-v1',cancelModeKey='wvd-development-booking-cancel-v1';
const lock=()=>{day.disabled=busy||pending!==null||management!==null;find.disabled=day.disabled;confirm.disabled=busy;retry.disabled=busy;byId('cancel').disabled=busy||pending!==null;byId('cancel-agree').disabled=busy;byId('keep').disabled=busy;for(const button of slots.querySelectorAll('button'))button.disabled=busy||pending!==null||management!==null;};
const say=text=>{message.textContent=text;};
async function post(path,body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal,cache:'no-store',redirect:'error'});return {code:response.status,data:await response.json()};}finally{clearTimeout(timer);}}
function remember(){try{sessionStorage.setItem(storageKey,JSON.stringify(pending));}catch{/* The current page retains the capability if tab storage is unavailable. */}}
function clear(){pending=null;try{sessionStorage.removeItem(storageKey);}catch{}}
function clearManagement(){management=null;cancelling=false;byId('management').hidden=true;byId('cancel-question').hidden=true;try{sessionStorage.removeItem(managementKey);sessionStorage.removeItem(cancelModeKey);}catch{}}
function candidates(value){const base=Date.parse(value+'T00:00:00.000Z'),values=[];for(let minutes=-120;minutes<1440;minutes+=15){const date=new Date(base+minutes*60000),time=timeFormat.format(date);if(dateKey(date)===value&&time>='09:00'&&time<='17:30')values.push(date.toISOString());}return values;}
byId('availability').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||pending)return;busy=true;selected=null;confirm.hidden=true;meet.hidden=true;slots.replaceChildren();byId('selection').textContent='';lock();say('Checking available times…');
 try{const {code,data}=await post('/api/calls/availability',{starts:candidates(day.value)});if(code!==200||data.provisional!==true||!Array.isArray(data.slots))throw Error();
  for(const slot of data.slots){const button=document.createElement('button');button.type='button';button.textContent=timeFormat.format(new Date(slot.start));button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{if(busy||pending)return;selected=slot.start;for(const other of slots.querySelectorAll('button'))other.setAttribute('aria-pressed',String(other===button));byId('selection').textContent=fullFormat.format(new Date(selected))+' · 30 minutes, UK time';confirm.hidden=false;say('This time is available now. It will be checked again when you confirm.');});slots.append(button);}
  say(data.slots.length?'Choose an available time.':'No times are available on this date. Try another date.');
 }catch{say('Availability could not be checked. Please try again.');}finally{busy=false;lock();}
});
async function submit(){
 if(busy||!pending)return;busy=true;meet.hidden=true;confirm.hidden=true;retry.hidden=true;lock();say(cancelling?'Checking your cancellation. Please keep this page open.':'Checking your booking. Please keep this page open.');
 try{const {code,data}=await post(cancelling?'/api/calls/cancel':'/api/calls/book',pending);
  if(!cancelling&&code===200&&data.status==='CONFIRMED'&&data.start===pending.start&&/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(data.meetUrl)){say('Confirmed: '+fullFormat.format(new Date(data.start))+', UK time. This development preview sends no email invitation.');meet.href=data.meetUrl;meet.hidden=false;management={...pending};try{sessionStorage.setItem(managementKey,JSON.stringify(management));}catch{}clear();byId('management').hidden=!cancellationEnabled;byId('cancel-question').hidden=true;slots.replaceChildren();selected=null;byId('selection').textContent='';}
  else if(code===409&&data.status==='UNAVAILABLE'){clear();selected=null;slots.replaceChildren();byId('selection').textContent='';say('That time is no longer available. Choose another date or check the times again.');}
  else if((code===409||code===200)&&data.status==='CANCELLED'){clear();clearManagement();selected=null;slots.replaceChildren();byId('selection').textContent='';say('This booking has been cancelled. You can choose a new time.');}
  else{retry.hidden=false;say(cancelling?'Cancellation is not confirmed yet. Check its status before booking another time.':'Your booking is not confirmed yet. Check its status before choosing another time.');}
 }catch{retry.hidden=false;say(cancelling?'The connection was interrupted. Cancellation may still be processing. Check its status before booking another time.':'The connection was interrupted. Your booking may still be processing. Check its status before choosing another time.');}finally{busy=false;retry.textContent=cancelling?'Check cancellation status':'Check booking status';lock();}
}
confirm.addEventListener('click',()=>{if(busy||pending||!selected)return;pending={requestKey:crypto.randomUUID(),start:selected};remember();submit();});retry.addEventListener('click',submit);
byId('cancel').addEventListener('click',()=>{if(busy||pending||!management)return;byId('cancel-question').hidden=false;byId('cancel-agree').focus();});
byId('keep').addEventListener('click',()=>{byId('cancel-question').hidden=true;byId('cancel').focus();});
byId('cancel-agree').addEventListener('click',()=>{if(busy||pending||!management)return;pending={...management};cancelling=true;remember();try{sessionStorage.setItem(cancelModeKey,'true');}catch{}byId('cancel-question').hidden=true;submit();});
day.value=dateKey(new Date(Date.now()+172800000));day.min=dateKey(new Date());
try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||sessionStorage.getItem(managementKey));if(saved&&Object.keys(saved).sort().join(',')==='requestKey,start'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(saved.requestKey)&&new Date(saved.start).toISOString()===saved.start){pending=saved;cancelling=sessionStorage.getItem(cancelModeKey)==='true';retry.hidden=false;retry.textContent=cancelling?'Check cancellation status':'Check booking status';byId('selection').textContent=fullFormat.format(new Date(saved.start))+' · UK time';say(cancelling?'A cancellation is waiting for confirmation. Check its status before booking another time.':'Check your existing booking before choosing another time.');}}catch{}
if(!pending)say('Choose a date to see available times.');lock();
