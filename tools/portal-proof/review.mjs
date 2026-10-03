import {createHash} from 'node:crypto';
import {reviewDeliverable} from './deliverable.mjs';
export const reviewDigest = ({projectId,milestoneId,versionId,title,body,deliverable}) => {
  const content=[projectId,milestoneId,versionId,title,body];
  // Preserve existing text-only fingerprints and approval receipts unchanged.
  if(deliverable!==undefined)content.push(reviewDeliverable(deliverable));
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
};
