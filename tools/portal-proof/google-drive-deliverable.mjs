// Read-only adapter for an explicitly authenticated Google Drive v3 client.
// Reuses the Calendar adapter's explicit client, timeout and retry policy.
// https://developers.google.com/workspace/drive/api/guides/manage-downloads
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,256}$/.test(value);
const reference=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
const unavailable=()=>Error('DELIVERABLE_SERVICE_UNAVAILABLE');
const conflict=()=>Error('DELIVERABLE_CONTENT_CONFLICT');
const close=value=>{try{if(typeof value?.destroy==='function')value.destroy();}catch{}};
const metadataFields='id,kind,mimeType,size,keepForever';
export function createGoogleDriveDeliverableSource({drive,bindings,requestTimeoutMs,maxConcurrentReads}) {
  if(typeof drive?.revisions?.get!=='function'||!Array.isArray(bindings)||!bindings.length||bindings.length>200||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>60000||!Number.isSafeInteger(maxConcurrentReads)||maxConcurrentReads<1||maxConcurrentReads>20)throw Error('INVALID_CONFIGURATION');
  let bound;
  try{
    bound=bindings.map(row=>{
      if(!row||Array.isArray(row)||Object.keys(row).sort().join(',')!=='fileId,mediaType,projectId,revisionId,sourceId,sourceVersion'||typeof row.projectId!=='string'||!row.projectId.trim()||row.projectId.length>128||!reference(row.sourceId)||!reference(row.sourceVersion)||!opaque(row.fileId)||!opaque(row.revisionId)||!['text/plain','image/png','image/jpeg','application/pdf','application/zip'].includes(row.mediaType))throw Error();
      return {...row};
    });
    if(new Set(bound.map(row=>JSON.stringify([row.projectId,row.sourceId,row.sourceVersion]))).size!==bound.length)throw Error();
  }catch{throw Error('INVALID_CONFIGURATION');}
  let active=0;
  return {async readVersion({projectId,sourceId,sourceVersion,maxBytes,signal}){
    const binding=bound.find(row=>row.projectId===projectId&&row.sourceId===sourceId&&row.sourceVersion===sourceVersion);
    if(!binding)throw Error('DELIVERABLE_UNAVAILABLE');
    if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>512*1024||!(signal instanceof AbortSignal))throw Error('INVALID_DELIVERABLE');
    if(signal.aborted||active>=maxConcurrentReads)throw unavailable();
    active++;const controller=new AbortController();let stream,timer,rejectAbort;
    const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
    const cancel=()=>{controller.abort();close(stream);rejectAbort(unavailable());};
    signal.addEventListener('abort',cancel,{once:true});timer=setTimeout(cancel,requestTimeoutMs);
    const check=()=>{if(controller.signal.aborted)throw unavailable();};
    const get=async(params,options={})=>{
      check();const result=await drive.revisions.get({fileId:binding.fileId,revisionId:binding.revisionId,...params},{timeout:requestTimeoutMs,retry:false,signal:controller.signal,maxContentLength:8192,...options});
      // A provider may finish after cancellation; release any late stream.
      if(controller.signal.aborted){close(result?.data);throw unavailable();}
      if(result?.status!==200){close(result?.data);throw unavailable();}return result.data;
    };
    const metadata=async()=>{
      const data=await get({fields:metadataFields});
      if(!data||data.kind!=='drive#revision'||data.id!==binding.revisionId||data.mimeType!==binding.mediaType||typeof data.size!=='string'||! /^[1-9][0-9]{0,15}$/.test(data.size)||Number(data.size)>maxBytes)throw conflict();
      // Never mutate retention. Native Workspace documents and purgeable blob
      // revisions cannot be substituted with a current export or latest file.
      if(data.keepForever!==true)throw Error('DELIVERABLE_UNAVAILABLE');
      return Number(data.size);
    };
    const operation=Promise.resolve().then(async()=>{
      const expected=await metadata();
      stream=await get({alt:'media',acknowledgeAbuse:false},{responseType:'stream',maxContentLength:maxBytes});
      if(typeof stream?.[Symbol.asyncIterator]!=='function'||typeof stream.destroy!=='function')throw unavailable();
      const chunks=[];let size=0;
      try{
        for await(const chunk of stream){check();if(!(chunk instanceof Uint8Array)||!chunk.byteLength)throw conflict();size+=chunk.byteLength;if(size>maxBytes||size>expected)throw conflict();chunks.push(Buffer.from(chunk));}
        check();if(size!==expected||await metadata()!==expected)throw conflict();
        return {sourceId:binding.sourceId,sourceVersion:binding.sourceVersion,mediaType:binding.mediaType,bytes:Buffer.concat(chunks,size)};
      }finally{close(stream);}
    });
    // Retain admission until an uncooperative provider really settles, even when
    // the caller has already timed out. No unbounded abandoned SDK requests.
    operation.then(()=>{active--;},()=>{active--;close(stream);});
    try{return await Promise.race([operation,aborted]);}
    catch(error){if(['DELIVERABLE_UNAVAILABLE','DELIVERABLE_CONTENT_CONFLICT'].includes(error?.message))throw Error(error.message);throw unavailable();}
    finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);}
  }};
}
