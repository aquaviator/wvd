#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {preflight, run} from './factory.mjs';
try {
  const [command, file, stateDirectory = '.factory/runs'] = process.argv.slice(2);
  if (command === 'preflight') console.log(JSON.stringify(await preflight(resolve('.factory/preflight')), null, 2));
  else if (command === 'run' && file) {
    const path = resolve(file);
    const result = await run(JSON.parse(await readFile(path, 'utf8')), dirname(path), resolve(stateDirectory));
    console.log(JSON.stringify(result, null, 2));
    if (Object.values(result.tasks).some(task => task.status !== 'PREPARED')) process.exitCode = 2;
  } else throw Error('Usage: node cli.mjs preflight | run <manifest.json> [state-directory]');
} catch (error) { console.error(error.message); process.exitCode = 1; }
