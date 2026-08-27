import type { Claim, Marketing } from '../../schemas/manifests';

export function validateClaimLifecycle(claim: Claim, today: string, forPublication: boolean): string[] {
  const errors: string[] = [];
  if (forPublication && claim.status !== 'approved') errors.push(`${claim.id}: claim is not approved for publication`);
  if (forPublication && claim.review_by < today) errors.push(`${claim.id}: claim review overdue (${claim.review_by})`);
  if (forPublication && claim.expires_at && claim.expires_at < today) errors.push(`${claim.id}: claim expired (${claim.expires_at})`);
  return errors;
}

export function validateMarketingClaimReferences(asset: Marketing, claims: Claim[], today: string): string[] {
  const errors: string[] = [];
  const byId = new Map(claims.map(claim => [claim.id, claim]));
  const publishable = ['approved', 'active'].includes(asset.status);
  for (const claimId of asset.claim_ids) {
    const claim = byId.get(claimId);
    if (!claim) { errors.push(`${asset.concept_id}: references unknown claim ${claimId}`); continue; }
    errors.push(...validateClaimLifecycle(claim, today, publishable).map(error => `${asset.concept_id}: ${error}`));
    if (publishable && claim.marketing_expires_at && claim.marketing_expires_at < today) errors.push(`${asset.concept_id}: claim ${claimId} is expired for marketing use (${claim.marketing_expires_at})`);
  }
  return errors;
}
