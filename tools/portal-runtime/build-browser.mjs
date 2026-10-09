import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const require=createRequire(new URL('../portal-proof/package.json',import.meta.url));
const {build}=require('esbuild');
const output=fileURLToPath(new URL('./dist/firebase-auth-sdk.js',import.meta.url));
await build({entryPoints:[fileURLToPath(new URL('./firebase-auth-sdk-entry.js',import.meta.url))],outfile:output,bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,legalComments:'eof',tsconfigRaw:{compilerOptions:{}},nodePaths:[fileURLToPath(new URL('../portal-proof/node_modules',import.meta.url))]});
const bytes=await readFile(output);
if(bytes.length>1048576)throw Error('BROWSER_AUTH_BUNDLE_TOO_LARGE');
console.log(JSON.stringify({status:'LIVE_AUTH_BROWSER_BUILT',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));
