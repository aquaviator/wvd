import {createHash} from 'node:crypto';
export const reviewDigest = ({projectId,milestoneId,versionId,title,body}) => createHash('sha256').update(JSON.stringify([projectId,milestoneId,versionId,title,body])).digest('hex');
