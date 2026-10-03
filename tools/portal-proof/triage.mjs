import {createHash} from 'node:crypto';
export const careAssessments=Object.freeze(['needs-review','care-included','quote-required']);
export const ticketTriageDigest=({projectId,ticketId,triage})=>createHash('sha256')
  .update(JSON.stringify([projectId,ticketId,triage?.priority??null,triage?.careAssessment??null,triage?.note??null])).digest('hex');
