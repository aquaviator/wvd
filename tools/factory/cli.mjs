#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {preflight, run} from './factory.mjs';
import {assess, createHandoff} from './handoff.mjs';
import {developmentStandard,reuseCatalogue,projectPlan} from './standard.mjs';
import {accessInventory,accessPlan,validateAccessInventory} from './access.mjs';
import {assessCiAccessReceipt} from './access-receipt.mjs';
try {
  const [command, file, stateDirectory = '.factory/runs', extra] = process.argv.slice(2);
  if (command === 'access-check') console.log(JSON.stringify(validateAccessInventory(accessInventory()),null,2));
  else if (command === 'access-receipt' && file && process.argv[4]) {
    // Metadata must be fetched through the trusted connector. Local JSON is not
    // itself authenticated evidence; this command checks its exact bindings.
    const readEvidence = async path => {
      try {
        const bytes = await readFile(resolve(path));
        if (bytes.length > 1048576) throw Error();
        return JSON.parse(bytes.toString('utf8'));
      } catch {throw Error('INVALID_ACCESS_RECEIPT_INPUT');}
    };
    const receipt = await readEvidence(file);
    const evidence = await readEvidence(stateDirectory);
    const binding = JSON.parse(await readFile(new URL('../google-development-access/binding.json', import.meta.url), 'utf8'));
    console.log(JSON.stringify(assessCiAccessReceipt(receipt, {...evidence, binding, now: new Date().toISOString()}), null, 2));
  }
  else if(command === 'access' && file && stateDirectory) console.log(JSON.stringify(accessPlan(accessInventory(),{productId:'wvd',capability:file,plane:stateDirectory}),null,2));
  else if (command === 'preflight') console.log(JSON.stringify(await preflight(resolve('.factory/preflight')), null, 2));
  else if (command === 'standard') console.log(JSON.stringify({standard:developmentStandard(),catalogue:reuseCatalogue()},null,2));
  else if (command === 'project' && file) console.log(JSON.stringify(projectPlan(JSON.parse(await readFile(resolve(file),'utf8'))),null,2));
  else if (command === 'run' && file) {
    const path = resolve(file);
    const result = await run(JSON.parse(await readFile(path, 'utf8')), dirname(path), resolve(stateDirectory));
    console.log(JSON.stringify(result, null, 2));
    if (Object.values(result.tasks).some(task => task.status !== 'PREPARED')) process.exitCode = 2;
  } else if (command === 'handoff' && file && extra) {
    const task = JSON.parse(await readFile(stateDirectory, 'utf8'));
    console.log(JSON.stringify(await createHandoff(resolve(file), task, resolve(extra)), null, 2));
  } else if (command === 'assess' && file && extra) {
    const work = JSON.parse(await readFile(file, 'utf8'));
    const review = JSON.parse(await readFile(stateDirectory, 'utf8'));
    const result = assess(work, review, await readFile(extra));
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'VERIFIED') process.exitCode = 2;
  } else throw Error('Usage: access-check | access <capability> <plane> | access-receipt <receipt> <github-evidence> | standard | project <product-config> | preflight | run <manifest> [state] | handoff <context> <task> <directory> | assess <work> <review> <output>');
} catch (error) { console.error(error.message); process.exitCode = 1; }
