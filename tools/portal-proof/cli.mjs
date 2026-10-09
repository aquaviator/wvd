import {readFileSync,mkdirSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {DurablePortal} from './durable.mjs';
import {LocalAuth} from './auth.mjs';
import {createApplication} from './app.mjs';

process.umask(0o077);
const [command,...args]=process.argv.slice(2);
const directory=resolve(process.env.WVD_DATA_DIR??'./wvd-data');
mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
const portalPath=join(directory,'portal.sqlite'),authPath=join(directory,'auth.sqlite');
try {
  if(command==='init') {
    if(args.length!==1)throw new Error('Usage: node cli.mjs init /path/to/trusted-state.json');
    const portal=new DurablePortal(portalPath,JSON.parse(readFileSync(args[0],'utf8')));portal.close();
    console.log('Portal database initialized. No accounts or public server enabled.');
  } else if(command==='invite') {
    if(args.length!==2)throw new Error('Usage: node cli.mjs invite actor-id email');
    const portal=new DurablePortal(portalPath);
    const identity=portal.snapshot().identities.find(x=>x.id===args[0]&&x.active);portal.close();
    if(!identity)throw new Error('ACTIVE_PORTAL_IDENTITY_REQUIRED');
    const auth=new LocalAuth(authPath);const invitation=auth.invite(...args);auth.close();
    // Deliberate local operator output only; never write this to a public log.
    console.log(JSON.stringify(invitation));
  } else if(command==='disable') {
    if(args.length!==1)throw new Error('Usage: node cli.mjs disable actor-id');
    const auth=new LocalAuth(authPath);auth.disable(args[0]);auth.close();console.log('Account disabled; sessions revoked.');
  } else if(command==='serve') {
    if(args.length)throw new Error('Usage: node cli.mjs serve');
    const origin=process.env.WVD_ORIGIN;
    if(!origin)throw new Error('WVD_ORIGIN_REQUIRED');
    const url=new URL(origin),port=Number(process.env.WVD_PORT??8080),host=process.env.WVD_HOST??'127.0.0.1';
    if(url.origin!==origin || !['https:','http:'].includes(url.protocol) || (url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw new Error('HTTPS_OR_LOOPBACK_ORIGIN_REQUIRED');
    if(!Number.isInteger(port)||port<1||port>65535)throw new Error('INVALID_PORT');
    if(url.protocol==='http:'&&!['127.0.0.1','::1','localhost'].includes(host))throw new Error('HTTP_REQUIRES_LOOPBACK_BIND');
    const portal=new DurablePortal(portalPath),auth=new LocalAuth(authPath);
    const server=createApplication({portal,auth,allowedOrigin:origin});
    server.on('error',()=>{console.error('Server could not start. Check port and host.');portal.close();auth.close();process.exitCode=1;});
    server.listen(port,host,()=>console.log(`WVD portal listening on ${host}:${port}. External hosting must terminate TLS.`));
    let stopping=false;
    const stop=()=>{if(stopping)return;stopping=true;server.close(()=>{portal.close();auth.close();});server.closeIdleConnections();};
    process.on('SIGINT',stop);process.on('SIGTERM',stop);
  } else throw new Error('Commands: init <trusted-state.json>, invite <actor-id> <email>, disable <actor-id>, serve');
} catch(error) {console.error(error.message);process.exitCode=1;}
