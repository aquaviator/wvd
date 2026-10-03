// Shared bounded JSON transport reader. Parsing and field validation belong to
// each boundary; raw bytes must be bounded even without Content-Length.
export async function readJsonBody(request,limit=32768) {
  const fail=(status,error)=>{throw Object.assign(new Error(error),{httpStatus:status});};
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type']??''))fail(415,'UNSUPPORTED_MEDIA_TYPE');
  const length=request.headers['content-length'];
  if(length!==undefined&&!/^\d+$/.test(length))fail(400,'INVALID_REQUEST');
  if(Number(length)>limit)fail(413,'REQUEST_TOO_LARGE');
  const chunks=[];let bytes=0;
  for await(const chunk of request){const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=buffer.length;if(bytes>limit)fail(413,'REQUEST_TOO_LARGE');chunks.push(buffer);}
  if(length!==undefined&&Number(length)!==bytes)fail(400,'INVALID_REQUEST');
  return Buffer.concat(chunks,bytes).toString('utf8');
}
