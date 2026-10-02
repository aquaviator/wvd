import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {DurablePortal} from '../durable.mjs';
import {createPortalServer} from '../server.mjs';

test('Loopback HTTP approval survives database reopen and tenant denial',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'wvd-http-'));
  const path=join(directory,'test.sqlite');
  const seed={identities:[{id:'owner',active:true},{id:'other',active:true}],projects:[{id:'p',businessId:'b'}],memberships:[{actorId:'owner',businessId:'b',role:'Owner',active:true,projectIds:['p']}],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]};
  const portal=new DurablePortal(path,seed);
  // Synthetic session resolver for this isolated test only; never a live adapter.
  const server=createPortalServer({portal,allowedOrigin:'https://client.wearvalleydigital.com',resolveSession:async token=>['owner','other'].includes(token)?{actorId:token}:null});
  try {
    const listening=once(server,'listening');server.listen(0,'127.0.0.1');
    try { await listening; } catch(error) {
      // Some local runtimes prohibit all sockets; CI must execute this test.
      if(error.code==='EPERM' && !process.env.CI){t.skip('Local runtime prohibits loopback sockets; integration executes in CI');return;}
      throw error;
    }
    const url=`http://127.0.0.1:${server.address().port}/api/portal/approve`;
    const body=JSON.stringify({projectId:'p',milestoneId:'m',versionId:'v',operationId:'o'});
    const request=token=>fetch(url,{method:'POST',headers:{authorization:`Bearer ${token}`,origin:'https://client.wearvalleydigital.com','content-type':'application/json'},body});
    const first=await request('owner');assert.equal(first.status,200);const receipt=await first.json();
    assert.equal((await request('other')).status,403);
    const retry=await request('owner');assert.equal(retry.status,200);assert.deepEqual(await retry.json(),receipt);
    const second=new DurablePortal(path);try{assert.equal(second.snapshot().receipts.length,1);assert.equal(second.snapshot().outbox.length,1);assert.equal(second.snapshot().milestones[0].status,'approved');}finally{second.close();}
  } finally {
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));portal.close();rmSync(directory,{recursive:true,force:true});
  }
});
