import { z } from 'zod';

const id = z.string().regex(/^WVD-[A-Z]+-\d{3}(?:-C\d{3})?$/, 'must use a WVD namespace ID');
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase URL slug');
const date = z.string().date();
const url = z.string().url();
const image = z.object({ src: z.string().min(1), alt: z.string().min(1), width: z.number().int().positive(), height: z.number().int().positive() });

export const productSchema = z.object({
  product_id: id,
  name: z.string().min(1), slug, status: z.enum(['draft', 'active', 'paused', 'retired']),
  category: slug, audience_cluster: slug, product_type: z.enum(['spreadsheet', 'template', 'guide', 'software', 'bundle']),
  pricing: z.object({ standard_price: z.number().nonnegative(), launch_price: z.number().nonnegative().nullable(), currency: z.string().length(3) }),
  customer: z.object({ target: z.string().min(1), problem: z.string().min(1), desired_outcome: z.string().min(1) }),
  copy: z.object({ headline: z.string().min(1), subheadline: z.string().min(1), short_description: z.string().min(1), benefits: z.array(z.string().min(1)).min(1), features: z.array(z.string().min(1)).min(1) }),
  contents: z.object({ included_files: z.array(z.string().min(1)).min(1), requirements: z.array(z.string()), compatibility: z.array(z.string()).min(1) }),
  trust: z.object({ version: z.string().min(1), last_updated: date, support_boundary: z.string().min(1) }),
  opportunity_scores: z.object({ shelf_life: z.number().int().min(1).max(5), maintenance: z.number().int().min(1).max(5), urgency: z.number().int().min(1).max(5), pain_consequence: z.number().int().min(1).max(5), opportunity_window: z.number().int().min(1).max(5), external_dependency: z.number().int().min(1).max(5) }),
  how_it_works: z.array(z.string().min(1)).optional(), faqs: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).optional(),
  images: z.array(image).optional(), successor_product_id: id.optional(), disclosure: z.string().min(1).optional(), featured: z.boolean().default(false)
});

export const complianceSchema = z.object({
  regulatory_sensitive: z.boolean(), regulatory_baseline: z.string().min(1).nullable(), verified_at: date.nullable(), review_by: date.nullable(), expires_at: date.nullable(), disclaimer: z.string().min(1).nullable(),
  approved_claims: z.array(z.object({ id: z.string().regex(/^CLAIM-\d{3}$/), statement: z.string().min(1), source: url, verified_at: date, review_by: date, expires_at: date.nullable() }))
});

const offer = z.object({ product_id: id, label: z.string().min(1) });
export const funnelSchema = z.object({ checkout: z.object({ provider: z.enum(['etsy']), provider_url_or_id: url.nullable() }), offers: z.object({ order_bump: offer.nullable(), bundle_upgrade: offer.nullable(), cross_sell: offer.nullable(), upsell: offer.nullable() }), funnel_version: z.string().min(1) });

export const seoSchema = z.object({ title: z.string().min(1).max(65), meta_description: z.string().min(1).max(170), canonical: url, primary_keyword: z.string().min(1), secondary_keywords: z.array(z.string()), og_title: z.string().min(1), og_description: z.string().min(1), og_image: z.string().min(1), index: z.boolean() });
export const categorySchema = z.object({ category_id: z.string().regex(/^CAT-[A-Z]+$/), name: z.string().min(1), slug, description: z.string().min(1), seo: z.object({ title: z.string().min(1), meta_description: z.string().min(1) }), audience_cluster: slug });
export const socialProfileSchema = z.object({ profile_id: slug, name: z.string().min(1), platforms: z.array(z.string()), active: z.boolean() });
export const marketingSchema = z.object({ concept_id: id, product_id: id, status: z.enum(['draft','pending_approval','approved','active','paused','expired','retired']), content_type: z.enum(['video','image','carousel','text']), shelf_life_type: z.enum(['evergreen','seasonal','regulatory']), effective_from: date, review_by: date.nullable(), expires_at: date.nullable(), regulatory_locked: z.boolean(), claim_ids: z.array(z.string()), priority: z.number().int().min(1), social_profile_id: slug, executions: z.array(z.object({ platform: z.string().min(1), media_path: z.string().min(1), hook: z.string().min(1), caption: z.string().min(1), cta: z.string().min(1), destination: url })).min(1) });

export type Product = z.infer<typeof productSchema>;
export type Funnel = z.infer<typeof funnelSchema>;
export type Compliance = z.infer<typeof complianceSchema>;
export type Seo = z.infer<typeof seoSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Marketing = z.infer<typeof marketingSchema>;
