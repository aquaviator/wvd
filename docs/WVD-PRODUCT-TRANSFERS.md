# Salon and Wedding reconciliation — 5 October 2026

Scope: WVD presentation and controller continuation only. Product code, workers'
Drive records, repositories, release gates and audiences are preserved.

## Fresh source observations

Read through the connected WVD Drive identity admin@wearvalleydigital.com.
Use these modification times to avoid rereading unchanged records next run:

| Record | Drive ID | Modified UTC |
| --- | --- | --- |
| Salon START HERE | 1UWRqPRp4c_khZAPziy8g8y0gkyHhn1gBh8YznWwyAS4 | 2026-10-05T16:54:09.474Z |
| Salon portfolio receipt | 1efNgxoNGku18nCHM1M_3VbpEWcx_adqkh6Ys2mhzwtA | 2026-10-05T16:55:15.733Z |
| Wedding START HERE | 1WHETJI6Glb1aZh1e9ES2EHJOJ6RhMUeQM7vGnmNxmAs | 2026-10-05T16:59:22.651Z |

Salon: aquaviator/WVD-Salon, import/salon-foundation, open draft PR #1 at
83b1ebe2e7338535634f0ed52f01c7ac1e8a2273. Read its current-state.json and PR
handoff. Exact import d3106dc5677371db648b03f23286fd4b15c6eb04 retains original
tree 6efdbc454cbd2351cffffa06d6f5cd65d7ad0944. Local evidence is recorded;
hosted acceptance and Controller acceptance remain outstanding. Site
appgprj_6ac3bb5b197081919d34810fd6ff9ce0 exists but version count is zero and
current_live_url is null. Do not invent a preview URL or call it deployed.

Wedding: aquaviator/WVD-Wedding, master at
afdfa62fc8d3ce297a747ae2522e3318fbb44fb2. Read HANDOFF.md and
handoff/WVD-CONTINUATION.md. These reconcile the Drive continuation with an
implemented fictional prototype, superseding the earlier specification-only
observation. Sites get_site_version confirms application source
19fb8408366deecf5ac54df3fbbffd53020e0aec, version
appgprj_6ac3c826d96481919bd4218973832eb2~appgver_b1a9bc066a448191b4ad9ccb63244518,
deployment appgdep_6ac3d15eec648191b10676b6cb25dd3d. Current URL:
https://wvd-wedding-workspace.leatfield.chatgpt.site/ . Owner-only custom
audience is unchanged. Later GitHub documentation did not redeploy the app.
47 creator checks and 12 repeated independent domain checks are recorded;
all 32 complete acceptance scenarios remain NOT_RUN. No re-certification here.

## Presentation slice

Recovered WVD Site appgprj_6ac361a8bfd48191b3bde453565cf2ab at
a07157c33c4ea8f1493312028704f935118da255 through the Sites source helper.
Its src tree matched the controller checkout before editing. Reused the Astro
layout, brand and cards. New source is b30ac0e7787184772979983e93a975f029e3323d.
Reconciled only frontend changes into WVD; no old Sites backend copy replaced
current controller integration code.

Home, services, navigation and catalogue now lead to Salon and Wedding product
pages. Enquiry CTAs retain the existing reviewable draft flow. Wedding links to
its explicitly owner-only prototype. Salon states no preview is published.
Customer subscriptions/hire remain unavailable; no prices or commercial readiness
claims are invented. Older demo routes retain noindex retirement notices and
working product links, and are excluded from the sitemap. Git history preserves
their source. Existing digital products retain their lifecycle status.

Both product restrictions remain: fictional data only; financial execution,
checkout/payment links, test transactions and remote-backend workarounds stay
disabled in Sites. Wedding health/allergy collection stays disabled. Provider
credentials alone do not lift target restrictions. No public audience, product
deployment, purchase flow, message, live email test or paid resource was enabled.

Validation: Sites content validation and all 27 static routes built locally.
The validator now uses node --import tsx instead of the CLI IPC server, avoiding
the observed restricted-environment Unix-socket EPERM with unchanged validation.
Access inventory and diff whitespace checks passed. Browser/CI and publication
results are recorded in the continuation follow-up, not inferred from this build.

## Next work

Refresh branch/Drive metadata first and avoid duplicate active workers. Product
first tasks remain SALON-WVD-001 and WED-CONT-001, with distinct verification
before acceptance. Do not close either merely from this presentation slice.
Wedding's following proposed native slice is undecided-date onboarding/editor
gaps after exact requirements are frozen. Salon target/identity analysis can
proceed without deploying or transacting. Complete product-specific releases
before offering paid subscriptions/hire. Existing WVD guest-recipient, admission,
runtime activation and recovery work remains an independent integration backlog.
