import {createHash} from 'node:crypto';

// Explicit field order binds an edit to the progress the administrator read.
export const progressDigest=({projectId,stage,nextStep})=>createHash('sha256')
  .update(JSON.stringify([projectId,stage??null,nextStep??null])).digest('hex');
