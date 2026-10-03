// Disposable PostgreSQL test database only; psql must be installed.
import { spawn, execFileSync } from 'node:child_process';
const actor='00000000-0000-0000-0000-000000000091';
const business='10000000-0000-0000-0000-000000000091';
const project='20000000-0000-0000-0000-000000000091';
const milestone='30000000-0000-0000-0000-000000000091';
const operation='40000000-0000-0000-0000-000000000091';
const sql = (query) => execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-c',query],{encoding:'utf8',timeout:10000}).trim();
const cleanup = () => sql(`delete from portal.outbox where actor_id='${actor}'; delete from portal.receipts where actor_id='${actor}'; delete from portal.approvals where actor_id='${actor}'; delete from portal.milestones where id='${milestone}'; delete from portal.project_grants where project_id='${project}'; delete from portal.projects where id='${project}'; delete from portal.memberships where business_id='${business}'; delete from portal.businesses where id='${business}'; delete from portal.profiles where id='${actor}'; delete from auth.users where id='${actor}';`);
function session(name) {
 const child=spawn('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{env:{...process.env,PGAPPNAME:name},stdio:['pipe','pipe','pipe']});
 let output='',errors=''; child.stdout.on('data',b=>output+=b); child.stderr.on('data',b=>errors+=b);
 const finished=new Promise((resolve,reject)=>{child.on('error',reject); child.on('close',code=>code===0?resolve():reject(new Error(`${name} exited ${code}: ${errors}`)));});
 // Attach early to avoid unhandled rejection while waiting for a sentinel.
 finished.catch(()=>{});
 return {child,finished,send:query=>child.stdin.write(query+'\n'),output:()=>output,errors:()=>errors};
}
async function until(predicate,label) {
 const deadline=Date.now()+10000;
 while(Date.now()<deadline){if(await predicate())return; await new Promise(r=>setTimeout(r,50));}
 throw new Error(`Timed out: ${label}`);
}
let a,b;
try {
 cleanup();
 sql(`insert into auth.users values('${actor}'); insert into portal.profiles(id) values('${actor}'); insert into portal.businesses values('${business}','Concurrency test'); insert into portal.memberships values('${business}','${actor}','owner',true); insert into portal.projects values('${project}','${business}','Concurrency test'); insert into portal.project_grants values('${project}','${actor}',true); insert into portal.milestones values('${milestone}','${project}',1,'awaiting');`);
 a=session('portal-approval-concurrency');
 a.send(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${actor}',true); select portal.approve_milestone('${milestone}',1,'${operation}');\n\\echo HOLDING`);
 await until(()=>a.output().includes('HOLDING'),'approval transaction lock');
 b=session('portal-revoke-concurrency');
 b.send(`begin; update portal.memberships set active=false where business_id='${business}' and actor_id='${actor}'; commit;\n\\echo REVOKED`);
 await until(()=>sql("select count(*) from pg_stat_activity where application_name='portal-revoke-concurrency' and wait_event_type='Lock'")==='1','revocation blocked by approval');
 if(b.output().includes('REVOKED'))throw new Error('Revocation completed while approval transaction held locks');
 a.send('commit;'); a.child.stdin.end(); await a.finished;
 await until(()=>b.output().includes('REVOKED'),'revocation after commit'); b.child.stdin.end(); await b.finished;
 sql(`set role authenticated; select set_config('request.jwt.claim.sub','${actor}',false); do $$begin begin perform portal.approve_milestone('${milestone}',1,'${operation}'); raise exception 'revoked retry succeeded'; exception when insufficient_privilege then null; end; end $$;`);
 const counts=sql(`select (select count(*) from portal.approvals where actor_id='${actor}') || ':' || (select count(*) from portal.receipts where actor_id='${actor}') || ':' || (select count(*) from portal.outbox where actor_id='${actor}') || ':' || (select status from portal.milestones where id='${milestone}');`);
 if(counts!=='1:1:1:approved')throw new Error(`Unexpected committed state ${counts}`);
 console.log('Concurrent membership revocation serialized with approval; revoked retry denied.');
} finally {
 for(const s of [a,b])if(s && s.child.exitCode===null){s.child.kill('SIGKILL'); await s.finished.catch(()=>{});}
 cleanup();
}
