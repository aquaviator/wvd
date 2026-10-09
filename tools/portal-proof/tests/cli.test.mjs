import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
test('operator initialization, invitation and safe server configuration',t=>{
  const dir=mkdtempSync(join(tmpdir(),'wvd-cli-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const cli=new URL('../cli.mjs',import.meta.url).pathname,fixture=new URL('../example-state.json',import.meta.url).pathname;
  const run=(args,env={})=>spawnSync(process.execPath,[cli,...args],{env:{...process.env,WVD_DATA_DIR:dir,...env},encoding:'utf8'});
  assert.equal(run(['init',fixture]).status,0);assert.equal(statSync(dir).mode&0o777,0o700);assert.equal(statSync(join(dir,'portal.sqlite')).mode&0o777,0o600);
  assert.equal(run(['invite','missing','owner@example.test']).status,1);
  const invitation=run(['invite','example-owner','owner@example.test']);assert.equal(invitation.status,0);assert.match(JSON.parse(invitation.stdout).invitationToken,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(run(['serve'],{WVD_ORIGIN:''}).status,1);
  assert.equal(run(['serve'],{WVD_ORIGIN:'http://public.example.test'}).status,1);
  assert.equal(run(['serve'],{WVD_ORIGIN:'http://127.0.0.1:8080',WVD_HOST:'0.0.0.0'}).status,1);
  assert.equal(run(['disable','example-owner']).status,0);
});
