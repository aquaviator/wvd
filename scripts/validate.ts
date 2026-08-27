import fs from 'node:fs';
import path from 'node:path';
import { loadCategories, loadMarketing, loadProducts, loadProfiles } from '../src/lib/validation/load';
import { validateClaimLifecycle, validateMarketingClaimReferences } from '../src/lib/validation/regulatory';

const errors: string[] = [];
const today = process.env.WVD_VALIDATION_DATE ?? new Date().toISOString().slice(0, 10);
const duplicate = (values: string[], label: string) => [...new Set(values.filter((x, i) => values.indexOf(x) !== i))].forEach(x => errors.push(`Duplicate ${label}: ${x}`));
try {
  const products = loadProducts(); const categories = loadCategories(); const marketing = loadMarketing(); const profiles = loadProfiles();
  duplicate(products.map(x => x.product.product_id), 'product ID'); duplicate(products.map(x => x.product.slug), 'product slug'); duplicate(products.map(x => x.seo.title), 'SEO title'); duplicate(products.map(x => x.seo.canonical), 'canonical URL');
  const productIds = new Set(products.map(x => x.product.product_id)); const categorySlugs = new Set(categories.map(x => x.slug)); const profileIds = new Set(profiles.map(x => x.profile_id));
  const claims = products.flatMap(record => record.compliance.approved_claims);
  for (const record of products) {
    const { product, funnel, compliance, media } = record;
    if (!categorySlugs.has(product.category)) errors.push(`${product.product_id}: unknown category '${product.category}'`);
    if (product.status === 'active' && !product.disclosure) errors.push(`${product.product_id}: active product requires disclosure`);
    if (compliance.regulatory_sensitive && product.status === 'active') {
      if (!compliance.verified_at || !compliance.review_by || !compliance.disclaimer || compliance.approval_status !== 'approved') errors.push(`${product.product_id}: active regulatory product lacks approved mandatory review information`);
      if (compliance.review_by && compliance.review_by < today) errors.push(`${product.product_id}: regulatory review overdue (${compliance.review_by})`);
      if (!compliance.approved_claims.length) errors.push(`${product.product_id}: active regulatory product has no approved claims`);
      compliance.approved_claims.forEach(claim => errors.push(...validateClaimLifecycle(claim, today, true).map(error => `${product.product_id}: ${error}`)));
    }
    for (const claim of compliance.approved_claims) if (claim.expires_at && claim.expires_at < today) errors.push(`${product.product_id}: approved claim ${claim.id} expired (${claim.expires_at})`);
    for (const [kind, offer] of Object.entries(funnel.offers)) if (offer) { if (offer.product_id === product.product_id) errors.push(`${product.product_id}: ${kind} references itself`); if (!productIds.has(offer.product_id)) errors.push(`${product.product_id}: ${kind} references missing product ${offer.product_id}`); const target = products.find(x => x.product.product_id === offer.product_id); if (target?.product.status === 'retired') errors.push(`${product.product_id}: ${kind} references retired product`); }
    for (const image of product.images ?? []) if (!fs.existsSync(path.join(process.cwd(), 'public', image.src.replace(/^\//, '')))) errors.push(`${product.product_id}: missing image ${image.src}`);
    if (media.product_id !== product.product_id) errors.push(`${product.product_id}: media manifest product ID mismatch`);
    const mediaPaths = [media.hero.website.path, media.hero.product_card.path, ...media.screenshots.map(x => x.path), media.video.promo.source, media.video.promo.poster, media.video.promo.captions, media.video.tutorial.source, media.video.tutorial.poster, media.video.tutorial.captions, ...Object.values(media.website).map(x => x.path), media.etsy.primary.path, ...media.etsy.gallery.map(x => x.path), ...media.social.vertical, ...media.social.square, ...media.social.landscape];
    for (const mediaPath of mediaPaths) if (!fs.existsSync(path.join(process.cwd(), 'public', mediaPath.replace(/^\//, '')))) errors.push(`${product.product_id}: missing media ${mediaPath}`);
    const approvedClaimIds = new Set(compliance.approved_claims.filter(x => x.status === 'approved').map(x => x.id));
    for (const claimId of [...media.video.promo.claim_ids, ...media.video.tutorial.claim_ids]) if (!approvedClaimIds.has(claimId)) errors.push(`${product.product_id}: media references unapproved claim ${claimId}`);
  }
  for (const asset of marketing) {
    if (!productIds.has(asset.product_id)) errors.push(`${asset.concept_id}: missing product ${asset.product_id}`);
    if (!profileIds.has(asset.social_profile_id)) errors.push(`${asset.concept_id}: missing social profile ${asset.social_profile_id}`);
    if (asset.status === 'active' && asset.expires_at && asset.expires_at < today) errors.push(`${asset.concept_id}: active marketing expired (${asset.expires_at})`);
    if (asset.status === 'active' && asset.regulatory_locked && asset.review_by && asset.review_by < today) errors.push(`${asset.concept_id}: regulatory marketing review overdue`);
    if (asset.status === 'active' && !['approved','active'].includes(asset.status)) errors.push(`${asset.concept_id}: unapproved content cannot be active`);
    for (const run of asset.executions) if (!fs.existsSync(path.join(process.cwd(), 'public', run.media_path.replace(/^\//, '')))) errors.push(`${asset.concept_id}: missing media ${run.media_path}`);
    errors.push(...validateMarketingClaimReferences(asset, claims, today));
  }
} catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
if (errors.length) { console.error(`WVD validation failed (${errors.length}):\n${errors.map(x => `- ${x}`).join('\n')}`); process.exit(1); }
console.log(`WVD validation passed for ${today}.`);
