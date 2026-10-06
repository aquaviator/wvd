# WVD service launch — 6 October 2026

## Founder direction and scope

The founder explicitly requested that Wear Valley Digital go live as a service
offering so the business can be promoted and social profiles prepared, without
waiting for Salon or the other products to launch. This authorises public access
to the WVD brochure/services Site. Product audiences, commercial acceptance,
booking/customer-email activation and private portal authority are separate.

Use the existing Site identity and existing hosting. No new subscription or
extra spending was enabled. No social post, customer email or test email was sent.

## Release candidate and current state

- Site: appgprj_6ac361a8bfd48191b3bde453565cf2ab.
- Title: Wear Valley Digital — Websites, Software & Automation.
- Current Site URL: https://wear-valley-digital.leatfield.chatgpt.site
- Sites source: 5ee9b94a7556476b7c3130f31a075612c441e090.
- Prior Sites source: d6200202c28c9ee509021c56f649ddaa8d6a5b5e.
- Saved version: appgprj_6ac361a8bfd48191b3bde453565cf2ab~appgver_2c99c17fd9bc81919b31f8b5efb409be.
- Deployment: appgdep_6ac4cb4e23a08191b1bf019842d4c342.
- Native deployment succeeded at 2026-10-06T10:20:17.390517+00:00.
- The new release is staged under the current owner-only audience. Public access
  is the next authorised release action after the integrated controller checks.
- Custom apex and www domains are registered with Sites but still PENDING.
  Cloudflare DNS changes and TLS validation are not complete.

This checkpoint does not yet claim public access or custom-domain delivery.
Append the actual public access, CI and domain result after those actions finish.

## User-facing changes

Home and Services lead with websites, bespoke software and business automation,
with scoping/quote, delivery and handover described without unsupported prices,
response guarantees or product availability. The original brand and existing
founder profile are retained. Product work follows the services content and is
explicitly labelled in development.

The enquiry page prepares a browser-local email draft for
hello@wearvalleydigital.com. The visitor reviews and sends it through their email
application; it is not a hosted submission or booking confirmation. Mailbox
receipt was not re-tested. Current primary CTAs and footer provide this route.

Optional visitor analytics are disabled, including the old consent code; the
existing event function is a no-op. Privacy/cookie/website terms now describe
the actual service launch and email-draft behaviour. Historical Etsy information
no longer presents general services as an Etsy purchase.

Removed the public link into the owner-only Wedding prototype, retired the dummy
Etsy QA checkout, corrected an obsolete demo link, and replaced unsupported exact
catalogue/retail-execution claims with clearly bounded descriptions and examples.
Paused product purchase controls stay disabled and emit no Offer schema.

Canonical, social and structured-data URLs use the actual current Site origin.
The 16 indexable routes match the sitemap. Twelve policy, retired/demo or paused
routes remain noindexed and outside the sitemap. Search indexing/ranking and AI
citation are not verified. GPTBot is disallowed while ordinary search retrieval
remains allowed, consistent with the existing training/search preference.

## Reuse and source handback

Reused the exact existing WVD Astro frontend, contact draft builder, product
components, logo assets, responsive styling and test suites. The reusable factory,
Google backend, portal authentication and product repositories required no change.
The new public social-image file reuses the existing primary-logo WebP unchanged
(Git blob 1d383a460177320395bc5d6cc6b199887be132c5).

All 16 modified tracked frontend blobs matched controller c592385103d111988b13aebebfe62fe44fb0cd18
at the prior Sites revision. The 17-file frontend change plus two adapted existing
browser suites are mirrored onto the full current controller tree; no wholesale
Sites checkout replacement, workflow edit or lockfile change is required.

## Verification completed before integrated CI

- Official Sites build: content validation passed for 2026-10-06; 28 routes built.
- Independent generated-output review: 28 HTML routes, 32 parseable JSON-LD
  blocks and 16 sitemap entries; no missing internal links/fragments/assets,
  duplicate IDs, H1/canonical/description omissions or noindex/sitemap mismatch.
- All canonical/OG/Twitter/schema URLs use the actual Site origin.
- No private prototype URL, active external checkout, dummy QA destination,
  Offer schema or tracking/network collector remains in the generated output.
- Enquiry function checks passed: exact destination, encoded text round-trip,
  required/email/website validation and lossless long-draft copy fallback.
- Existing browser test expectations are adapted for type-selected JSON-LD,
  disabled analytics, retired QA and current navigation/required-field labels.
  Accessibility, media, no-network/no-storage enquiry and private-product checks
  remain. Their TypeScript syntax checks passed.

Managed local browser preview is unavailable in this environment; no substitute
preview was started. The existing unattended GitHub CI is the browser verification
path. Observe its exact commit, all required jobs, screenshots and concrete
failures before the final launch handback. Existing path filters do not require
a new live Google probe or standalone portal-container run for this frontend slice.

## Custom domain connection

Nameservers observed at Cloudflare: sam.ns.cloudflare.com and clara.ns.cloudflare.com.
The existing MX points to smtp.google.com; preserve all mail-related DNS and do
not replace nameservers. No Cloudflare DNS write connector is currently available.

Sites apex connection: appgdom_6ac4cab6b89c8191bd1450898cacd9ea.
Sites www connection: appgdom_6ac4cacd0ac4819187cac3c462c31626.
Read the native domain connection for exact A/CNAME/TXT requirements; tokens are
public DNS verification values, not account credentials. After DNS is updated,
refresh both statuses and require ACTIVE/TLS success. Then change the site's
public canonical origin and robots sitemap to https://wearvalleydigital.com and
verify/redeploy the same source identity. Until that happens, the Sites URL is
the truthful canonical origin.

## Work explicitly separate from this release

Salon/Wedding customer access, subscriptions/hire, hosted product acceptance,
booking admission, recipient verification and dispatch, client portal activation,
backup/recovery, article-media retrofit and actual search-index observation remain
their own backlog. They are not prerequisites for advertising WVD's scoped services.
