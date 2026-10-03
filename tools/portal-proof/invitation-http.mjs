import {readJsonBody} from './http-body.mjs';
import {isOpaqueToken} from './opaque-token.mjs';
// Optional adapter only. The application must explicitly enable the invitation
// service and its policy; this module neither deploys it nor sends invitations.
export function createInvitationHandler({invitations,allowedOrigin}) {
  if(new URL(allowedOrigin).origin!==allowedOrigin||!['create','redeem','revoke'].every(k=>typeof invitations?.[k]==='function'))throw Error('INVALID_CONFIGURATION');
  return async(request,response)=>{
    const send=(status,data)=>{response.writeHead(status,{'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(data));};
    const reject=(status,error)=>send(status,{error});
    try {
      if(typeof request.url!=='string'||request.url.length>4096)return reject(400,'INVALID_REQUEST');
      const url=new URL(request.url,'http://localhost');
      const route=/^\/api\/invitations\/(create|redeem|revoke)$/.exec(url.pathname);
      if(!route)return reject(404,'NOT_FOUND');
      if(request.method!=='POST')return reject(405,'METHOD_NOT_ALLOWED');
      if(request.headers.origin!==allowedOrigin)return reject(403,'ORIGIN_DENIED');
      if(url.search)return reject(400,'INVALID_REQUEST');
      const auth=/^Bearer ([^\s]+)$/.exec(request.headers.authorization??'');
      if(!auth||auth[1].length>8192)return reject(401,'UNAUTHENTICATED');
      let input;try{input=JSON.parse(await readJsonBody(request,8192));}catch(error){if(error?.httpStatus)throw error;if(error instanceof SyntaxError)return reject(400,'INVALID_REQUEST');throw error;}
      const action=route[1],fields=action==='create'?['businessId','email','projectIds','expiresAt','operationId']:action==='redeem'?['token']:['invitationId'];
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==fields.length||!fields.every(k=>Object.hasOwn(input,k)))return reject(400,'INVALID_REQUEST');
      if(!fields.every(k=>k==='projectIds'?Array.isArray(input[k])&&input[k].length>0&&input[k].length<=50&&input[k].every(x=>typeof x==='string'&&x.length>0&&x.length<=128):k==='token'?isOpaqueToken(input[k]):typeof input[k]==='string'&&input[k].length>0&&input[k].length<=(k==='email'?320:128)))return reject(400,'INVALID_REQUEST');
      const result=await invitations[action](auth[1],action==='create'?input:input[action==='redeem'?'token':'invitationId']);
      send(200,result);
    }catch(error){
      if(response.headersSent){response.destroy();return;}
      const message=error instanceof Error?error.message:'';
      if([400,413,415].includes(error?.httpStatus))return reject(error.httpStatus,message);
      if(message==='UNAUTHENTICATED')return reject(401,message);
      if(['OPERATION_CONFLICT','INVITATION_CONSUMED'].includes(message))return reject(409,'INVITATION_CONFLICT');
      if(message.startsWith('INVALID_'))return reject(400,'INVALID_REQUEST');
      if(['ACCESS_DENIED','PROJECT_SCOPE_DENIED','BUSINESS_SCOPE_DENIED','IDENTITY_DISABLED','ACCESS_REVOKED','VERIFIED_FIREBASE_USER_REQUIRED','FIREBASE_USER_REQUIRED','INVITATION_RECIPIENT_MISMATCH','INVITATION_EXPIRED','INVITATION_REVOKED','INVITATION_NOT_FOUND'].includes(message))return reject(403,'INVITATION_DENIED');
      reject(503,'SERVICE_UNAVAILABLE');
    }
  };
}
