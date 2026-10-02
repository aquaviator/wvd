#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {preflight, run} from './factory.mjs';
import {assess, createHandoff} from './handoff.mjs';
try {
  const [command, file, stateDirectory = '.factory/runs', extra] = process.argv.slice(2);
  if (command === 'preflight') console.log(JSON.stringify(await preflight(resolve('.factory/preflight')), null, 2));
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
  } else throw Error('Usage: preflight | run <manifest> [state] | handoff <context> <task> <directory> | assess <work> <review> <output>');
} catch (error) { console.error(error.message); process.exitCode = 1; }
