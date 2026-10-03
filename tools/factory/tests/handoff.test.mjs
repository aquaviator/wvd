import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {assess, createHandoff, contractHash} from '../handoff.mjs';
const output = Buffer.from('real submitted output');
const hash = createHash('sha256').update(output).digest('hex');
const work = {projectId:'product',taskId:'ux',objective:'Design client journeys',creatorId:'worker',reviewerId:'verifier',contextHash:'context-version',outputHash:hash,acceptance:['roles','isolation']};
const review = {...work,contractHash:contractHash(work),verdict:'VERIFIED',criteria:[{id:'roles',passed:true,evidence:'output section 1'},{id:'isolation',passed:true,evidence:'output section 2'}],limitations:[],blockers:[]};
test('accepts exact complete independently attributed review',()=>assert.equal(assess(work,review,output).status,'VERIFIED'));
test('rejects creator self-certification',()=>assert.equal(assess(work,{...review,reviewerId:'worker'},output).status,'HOLD'));
test('changed output requires new review',()=>assert.equal(assess(work,review,Buffer.from('edited output')).status,'HOLD'));
test('changed task context invalidates review',()=>assert.equal(assess({...work,contextHash:'new'},review,output).status,'HOLD'));
test('missing/duplicate acceptance evidence cannot pass',()=>{
 assert.equal(assess(work,{...review,criteria:[review.criteria[0]]},output).status,'HOLD');
 assert.equal(assess(work,{...review,criteria:[review.criteria[0],review.criteria[0]]},output).status,'HOLD');
});
test('failed criteria and blockers prevent acceptance',()=>{
 assert.equal(assess(work,{...review,blockers:['tenant test missing']},output).status,'HOLD');
 assert.equal(assess(work,{...review,criteria:review.criteria.map(c=>({...c,passed:false}))},output).status,'HOLD');
});
test('missing review is HOLD rather than implicit acceptance',()=>assert.equal(assess(work,null,output).status,'HOLD'));
test('changed objective rejects old review',()=>assert.equal(assess({...work,objective:'Different task'},review,output).status,'HOLD'));
test('unassigned reviewer cannot certify task',()=>assert.equal(assess(work,{...review,reviewerId:'other'},output).status,'HOLD'));
test('malformed criteria and acceptance return HOLD',()=>{
 for(const criteria of [[null],[1],['bad']]) assert.equal(assess(work,{...review,criteria},output).status,'HOLD');
 assert.equal(assess({...work,acceptance:'roles'},review,output).status,'HOLD');
});
test('handoff binds exact context and refuses silent overwrite',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'wvd-handoff-')); t.after(()=>rm(dir,{recursive:true,force:true}));
 const path=join(dir,'context.json');await writeFile(path,JSON.stringify({projectId:'product',taskId:'ux',sources:[]}));
 const task={...work,reviewerId:'verifier',objective:'Design client journeys'};
 assert.equal((await createHandoff(path,task,dir)).contract.status,'READY_FOR_WORKER');
 await assert.rejects(createHandoff(path,task,dir),{code:'EEXIST'});
 await assert.rejects(createHandoff(path,{...task,taskId:'other'},join(dir,'other')),/mismatch/);
});
