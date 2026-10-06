# WVD service launch — 6 October 2026

## Founder direction and scope

The founder explicitly requested that Wear Valley Digital go live as a service
offering so the business can be promoted and social profiles prepared, without
waiting for Salon or the other products to launch. This authorises public access
to the WVD brochure/services Site. Product audiences, commercial acceptance,
booking/customer-email activation and private portal authority are separate.

Use the existing Site identity and existing hosting. No new subscription or
extra spending was enabled. No social post, customer email or test email was sent.

## Live service release

- Site: appgprj_6ac361a8bfd48191b3bde453565cf2ab.
- Title: Wear Valley Digital — Websites, Software & Automation.
- Primary public URL: https://wearvalleydigital.com/
- Alternate public hostname: https://www.wearvalleydigital.com/
- Original hosted URL remains https://wear-valley-digital.leatfield.chatgpt.site
- Sites source: e1b95d27f8691885964a4cd5579a65e10acba627.
- Prior Sites source: 5ee9b94a7556476b7c3130f31a075612c441e090.
- Saved version 5: appgprj_6ac361a8bfd48191b3bde453565cf2ab~appgver_c989b141d880819185a3a4ed86fa2598.
- Deployment: appgdep_6ac4dbbf31e8819180b7ef82065e6e72.
- Native deployment succeeded at 2026-10-06T11:30:22.989717+00:00.
- Public access enabled at 2026-10-06T10:27:00.860717+00:00, policy revision 2.
  The audience is unchanged. Native readback at 11:31 UTC confirmed public,
  active, version 5, with current_live_url=https://wearvalleydigital.com.
- Both custom domains have ACTIVE Site/provider status and ACTIVE TLS.

The service offering is live on the branded domain. Anonymous HTTPS checks of
both homepages, Services and Enquire returned 200 and the expected content.
The www homepage serves directly and declares the apex URL as canonical.

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
components, logo assets, responsive styling and test suites. The factory implementation,
Google backend, portal authentication and product repositories required no change.
The new public social-image file reuses the existing primary-logo WebP unchanged
(Git blob 1d383a460177320395bc5d6cc6b199887be132c5).

All 16 modified tracked frontend blobs matched controller c592385103d111988b13aebebfe62fe44fb0cd18
at the prior Sites revision. The 17-file frontend change plus two adapted existing
browser suites are mirrored onto the full current controller tree; no wholesale
Sites checkout replacement, workflow edit or lockfile change is required.

## Initial service-content verification

The following CI and screenshot receipt belongs to the initial service-content
release: Sites 5ee9b94 / controller 705592e. It remains historical evidence for
that exact source; the branded-domain verification follows below.

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

Integrated controller source: 705592e48444fb78d2694d48906d79603a4b346e.
Push CI 37449515567 and PR CI 37449520567 both succeeded on attempt 1, all four
jobs (quality, portal-database, portal-google, google-windows). Public browser
suite: 82 passed. Site unit suite: 19 passed. Build: 28 routes. Existing factory
59, Google utilities 10, portal unit 523 (one Windows-only skip), portal browser 4
and Firebase emulator 4 also passed. No failing test or workflow required repair.

Public artifact 11406730090, public-guide-evidence-37449515567, is bound to that
exact commit/run. ZIP 2,493,341 bytes; SHA-256
bfad47a9f51b4987f4da45f4bc15c53c0fce463914e4d878e83f2921e6dfadd0 matched GitHub.
Its 20 PNGs total 2,657,551 decoded bytes, within the unchanged 5 MiB cap.
Reviewed desktop/mobile Home and Enquiry draft screenshots: service-first copy,
development labels, required/optional fields, explicit not-sent state and usable
email/copy controls; no clipping/overlap observed. Services has no screenshot in
the existing bundle, but its desktop/mobile accessibility/narrow-screen checks
passed. Root also inspected desktop Home and mobile Enquiry.

Managed local preview was unavailable, so no substitute preview was started.
Existing unattended CI supplied browser evidence. It is not a live hosted-browser
or mailbox-receipt test. Native hosting confirmed successful deployment and
public access; the separate web reader could not retrieve this Sites URL, which
is recorded as a verification limit rather than evidence of an outage.
Development container 37449520570 was skipped by its existing rules. No live
Google probe, extra email, product deployment or account permission change ran.

## Custom domain connection

Nameservers observed at Cloudflare: sam.ns.cloudflare.com and clara.ns.cloudflare.com.
The MX remains priority 1 smtp.google.com. All six existing email, Google
verification, mail and webmail records were compared unchanged after the DNS
write, including content, TTL, proxy status and settings. No nameserver changed.

The founder reinstalled/authenticated the Cloudflare plugin. Account reads and
DNS reads/writes then became available and were verified through that plugin;
the earlier browser sign-in fallback was not needed to complete this connection.
Cloudflare account: 220fb33a64b2c61857c059e4ab99d2c8.
Active authoritative zone: de2eeaf40be0ed74196e3edcfc0a5ca7.
The access registry records this controller route without credentials or any
inference of equivalent access in CI/deployed services.

Four ownership TXT records were created at 2026-10-06T11:19:03.927896Z.
At 2026-10-06T11:21:54.453699Z, the existing apex CNAME to wvd.pages.dev was
updated to the first A target below, the second apex A was added, and the
existing www CNAME to wvd.pages.dev was updated to the Sites target. Both API
batches succeeded and readback contained all seven desired records. Website
records use DNS-only and Auto TTL; public answers reported TTL 300 seconds.

Sites apex connection: appgdom_6ac4cab6b89c8191bd1450898cacd9ea.
Sites www connection: appgdom_6ac4cacd0ac4819187cac3c462c31626.
Native status/provider/SSL were all ACTIVE at 2026-10-06T11:25:16.344666Z for
the apex and 2026-10-06T11:25:23.540423Z for www. No native error remained.
The installed DNS records, as relative names within wearvalleydigital.com:

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 162.159.143.30 |
| A | @ | 172.66.3.26 |
| CNAME | www | custom-domains.chatgpt.site. |
| TXT | _openai-site-verification | openai-site-verification=GmmizM6GeItCz28hAh1eWyGykiZkt-BtXGUnCTwwLHA |
| TXT | _cf-custom-hostname | d2abc3cc-2035-4f9d-a74a-e4e8b9f25657 |
| TXT | _openai-site-verification.www | openai-site-verification=QvJAhFXZoHW22-dsOaOxrGBPNh3sHq_KL6wzOJ_wnuU |
| TXT | _cf-custom-hostname.www | 9812ef06-3e86-4e04-af58-51335f02f9d1 |

These are public DNS verification values, not account credentials.
The existing apex record ID is c6f4a7c4d8bfa8fa31b247da403bca99; the existing
www record ID is 14b9f5d336bc0e04e9796625e580c97e; the new second apex A record
is 871ad78e6dc20565fcae9ac988ce5e4e. A future rollback requires a fresh DNS read
and an explicit routing decision; the previous website target was wvd.pages.dev
with proxy enabled on both CNAMEs. Preserve current email and unrelated records.

## Branded-domain verification and handback

Public DNS was independently checked through Cloudflare's public DoH resolver
at 11:24:02–11:24:07 UTC: exact apex A pair, exact www CNAME, all four exact TXT
values, unchanged NS and unchanged Google MX. Google DoH timed out in one round;
the successful alternate-resolver results provide the public DNS evidence.

The initial post-cutover Sites 404 responses cleared after native hostname
activation. At 11:26:56–11:26:58 UTC, both homepages, Services and Enquire served
200 over normally validated HTTPS. No credential or TLS bypass was used.

Only astro.config.mjs and public/robots.txt changed in Sites source e1b95d27:
canonical/social/schema/sitemap defaults now use https://wearvalleydigital.com.
No local or production WVD_PUBLIC_SITE_URL override was configured. The official
build passed content validation and generated 28 routes. Independent output
review passed: 28 HTML routes, 32 valid JSON-LD blocks, 16 branded sitemap routes
and 12 consistently excluded noindex routes, with no old cloud-origin reference.
The packaged key pages, sitemap and robots matched that reviewed build.

Following version 5 deployment, final anonymous HTTPS checks at
11:31:29–11:31:30 UTC returned 200 for apex and www home, Services, Enquire,
sitemap-index.xml, sitemap-0.xml and robots.txt. Every checked response matched
the reviewed local build byte for byte. Canonical, OG, social-image and JSON-LD
site URLs use the branded apex; www declares the apex canonical. The hosted
sitemap has exactly 16 entries and robots points to the branded sitemap index.

The exact two frontend files and the controller access/evidence updates are
being mirrored to the existing development/shared-factory-bootstrap branch.
Current controller CI is pending; retain the successful initial-release receipt
above against its original source until the new exact-commit results are recorded.
No new application behaviour, product audience, customer send or charge was added.

## Work explicitly separate from this release

Salon/Wedding customer access, subscriptions/hire, hosted product acceptance,
booking admission, recipient verification and dispatch, client portal activation,
backup/recovery, article-media retrofit and actual search-index observation remain
their own backlog. They are not prerequisites for advertising WVD's scoped services.
