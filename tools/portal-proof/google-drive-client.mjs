// Uses an explicitly supplied Google Auth client; no ambient credential lookup.
// Only retained-revision metadata/media GETs are exposed to the source adapter.
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,256}$/.test(value);
export function createGoogleDriveRevisionClient({authClient}){
  if(typeof authClient?.request!=='function')throw Error('INVALID_CONFIGURATION');
  return {revisions:{async get(params,options){
    if(!params||!id(params.fileId)||!id(params.revisionId)||!options||!Number.isSafeInteger(options.timeout)||options.timeout<1||options.timeout>60000||options.retry!==false||!(options.signal instanceof AbortSignal)||!Number.isSafeInteger(options.maxContentLength)||options.maxContentLength<1||options.maxContentLength>512*1024)throw Error('INVALID_CONFIGURATION');
    const media=params.alt==='media';
    if(Object.keys(params).sort().join(',')!==(media?'acknowledgeAbuse,alt,fileId,revisionId':'fields,fileId,revisionId')||media&&(params.acknowledgeAbuse!==false||options.responseType!=='stream')||!media&&params.fields!=='id,kind,mimeType,size,keepForever')throw Error('INVALID_CONFIGURATION');
    return authClient.request({url:`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.fileId)}/revisions/${encodeURIComponent(params.revisionId)}`,method:'GET',params:media?{alt:'media',acknowledgeAbuse:false}:{fields:params.fields},timeout:options.timeout,retry:false,signal:options.signal,maxContentLength:options.maxContentLength,responseType:media?'stream':'json',maxRedirects:0});
  }}};
}
