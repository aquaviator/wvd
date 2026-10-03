import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createOpaqueToken,isOpaqueToken,opaqueTokenDigest,matchesOpaqueToken} from '../opaque-token.mjs';
test('Invitation primitives mint 32-byte opaque tokens and retain only SHA-256 digest for storage',()=>{
 const raw=createOpaqueToken(),other=createOpaqueToken(),digest=opaqueTokenDigest(raw);assert.equal(isOpaqueToken(raw),true);assert.equal(Buffer.from(raw,'base64url').length,32);assert.notEqual(raw,other);assert.notEqual(digest,raw);assert.equal(digest,createHash('sha256').update(raw).digest('hex'));assert.equal(matchesOpaqueToken(raw,digest),true);assert.equal(matchesOpaqueToken(other,digest),false);
});
test('Malformed tokens and digest encodings cannot match or throw comparison length errors',()=>{
 const raw=createOpaqueToken(),digest=opaqueTokenDigest(raw);for(const token of [null,undefined,'',raw+'x','contains spaces','x'.repeat(42)])assert.equal(matchesOpaqueToken(token,digest),false);for(const hash of [null,undefined,'',digest.slice(1),digest.toUpperCase(),'g'.repeat(64)])assert.equal(matchesOpaqueToken(raw,hash),false);
});
test('Shared digest preserves existing local peer/session hashing behaviour',()=>{
 assert.equal(opaqueTokenDigest('peer:synthetic-peer'),createHash('sha256').update('peer:synthetic-peer').digest('hex'));assert.throws(()=>opaqueTokenDigest(null),/INVALID_TOKEN/);
});
