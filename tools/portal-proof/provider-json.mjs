// Shared response reader for fixed-endpoint provider adapters. It does not
// perform requests, discover credentials or log provider payloads.
export async function readBoundedProviderJson(response,maxBytes) {
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1048576||!response?.body)throw Error('INVALID_RESPONSE');
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes)throw Error('RESPONSE_TOO_LARGE');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
