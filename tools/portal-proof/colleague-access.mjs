export function colleagueAccessRequest(request) {
  if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).sort().join(',')!=='actorId,expectedRevision,grant,projectId,uid'||['actorId','projectId','uid'].some(key=>typeof request[key]!=='string'||!request[key].trim()||request[key].length>128)||typeof request.grant!=='boolean')throw Error('INVALID_ACCESS_GRANT');
  if(!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0)throw Error('ACCESS_REVISION_REQUIRED');
  return {...request};
}
