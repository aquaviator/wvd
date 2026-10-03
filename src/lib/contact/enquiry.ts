// Browser-only draft preparation. No send, persistence or qualification rules.
export type EnquiryFields={name:string;business:string;email:string;need:string;website:string;timing:string;budget:string};
const bounds={name:120,business:200,email:320,need:2000,website:500,timing:300,budget:300};
export function buildEnquiryDraft(input:EnquiryFields,recipient:string){
  if(!input||Object.keys(input).sort().join(',')!==Object.keys(bounds).sort().join(',')||Object.entries(bounds).some(([key,max])=>typeof input[key as keyof EnquiryFields]!=='string'||input[key as keyof EnquiryFields].length>max))throw Error('Check the enquiry fields and their length limits.');
  const values=Object.fromEntries(Object.entries(input).map(([key,value])=>[key,value.trim()])) as EnquiryFields;
  if(['name','business','email','need'].some(key=>!values[key as keyof EnquiryFields]))throw Error('Add your name, business, email and what you need.');
  const mailbox=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if(!mailbox.test(values.email)||typeof recipient!=='string'||recipient.length>320||!/^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(recipient))throw Error('Check the email address.');
  if(values.website){try{const url=new URL(values.website);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error();}catch{throw Error('Use a full website address starting with https:// or http://, or leave it blank.');}}
  const body=[`Name: ${values.name}`,`Business: ${values.business}`,`Email: ${values.email}`,'',`What I need:\n${values.need}`,...(values.website?['',`Existing website: ${values.website}`]:[]),...(values.timing?['',`Timing: ${values.timing}`]:[]),...(values.budget?['',`Budget context: ${values.budget}`]:[])].join('\n');
  const subject='General project enquiry';
  const mailto=`mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  // Some mail applications cannot open long URLs. The full draft remains
  // available for manual copying instead of silently truncating the enquiry.
  return {subject,body,mailto:mailto.length<=8192?mailto:null};
}
