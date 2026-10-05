# Controller continuation — 5 October 2026

Read this with AGENTS.md, WVD-PROJECT-AUTHORITY.md, the development checkpoint,
WVD-ACCESS-AUTOMATION.md and WVD-ACCESS-HANDOFF-2026-10-05.md. Existing authority,
personal-calendar blocking, Sites ownership and GBP 5 total hosting allowance
remain unchanged. The authorised one-message email test is complete; do not repeat.

## Isolated work and source ownership

Recovered the remote development branch at
`e0ce5cb6143f2ff28c713a839518290127847925` into a separate checkout. Its push/PR CI
runs 37331026271 and 37331035086 passed. The previous implementation's offline
container 37330368500 passed; that run does not certify these new changes.

The previous controller checkout contains unfinished booking-confirmation HTTP,
recipient and server changes last observed on 5 October. This continuation does
not adopt or overwrite that work. Check current branch activity and reconcile
that controller's handback before selecting the booking integration task. A dirty
checkout is not proof that the controller is still running or that its work is
verified. Do not commit all files from that checkout as this slice.

## Completed bounded task

Added executable CI access-receipt reconciliation, reusing accessReport and the
existing Google binding. Exact repository/owner, workflow, branch, commit,
attempt, identity, complete job list and probe outcomes are checked. Partial
access checks, workflow/job failures, stale evidence and missing steps remain
distinct. The CLI accepts no caller override of current binding/time and emits
no raw metadata. It neither sends mail nor changes permissions or registry state.

Negative tests exposed a shared-array bug in accessReport: mutating one report's
capability array changed future reports. Each report now owns its capability
arrays. Local factory suite: 56 passing, zero failures; diff whitespace check
passed. Verified CI/container evidence for this source is recorded below.

The saved receipt for source `4639ee686819922c87cd91c87546f4c61bcd8fa8`, run
37330368559 attempt 1, matched freshly retrieved GitHub run/jobs metadata at
15:30 UTC. Its original observation remains 15:09:11.742 UTC; this does not refresh
resource access or authenticate arbitrary caller-supplied JSON. Original artifact
provenance is in the access handoff. No live send or new provider probe was needed
for that reconciliation.

Next: reconcile the outstanding booking-confirmation HTTP/recipient handback and
continue the agreed integration backlog. Customer-mail activation, public
admission, Sites connection and operational backup/recovery remain outstanding;
receipt reconciliation does not complete those features.

## Verification and durable evidence

Implementation source: `b3accba8c64e1a135f86f61182ffff0f9a2287c4`.
Push CI 37333653024 and PR CI 37333661305 passed all four jobs. Google access
37333652942 passed; its downloaded artifact 11355965408 matched SHA-256
`c05de9f5492270617a248f2b98d3ff58c53bc2a09af95555e9135eac7bae3d42`.
The new reconciler matched the receipt against freshly retrieved complete
run/jobs metadata. Preserve its original observation time, 15:33:17.621 UTC;
the receipt is saved at `tools/factory/evidence/google-access-37333652942.json`.
No extra test message was sent. The existing workflow's authorised provider
checks are unchanged; this is not customer-mail activation.

Offline container 37333652922 passed. Artifact 11355466889 matched SHA-256
`abfa32a24aefe3b91d083fba60369d496858d109227701e33fb113ac7d734dac`.
Its results.json binds that exact implementation source, Node v22.23.3,
Playwright 1.62.1, demo-wvd-portal and liveAccess=false. Portal unit and Firebase
browser suites passed. Image identity:
`sha256:0e3834530b07816b051ddd631e3885bc650947265bb90ad1d6b71fcba59d9d00`.
The mobile private-management screenshot was inspected; original branding,
private-link controls and contact CTA remain present. One supplementary video
was omitted under the existing evidence cap; required screenshots were retained.

The evidence follow-up also preserves the CLI's prior executable mode (100755),
which the connector tree creation had flattened to 100644. It changes no JS
content beyond the verified implementation. Current GitHub read/write evidence
is recorded in the access registry without credentials or provider response data.

## Subsequent continuation — confirmation HTTP integration

Resumed from remote 0b355a7391f1018ff5828a80eaead048787d39a9. Fresh GitHub
inspection found push CI 37334274552 and PR CI 37334281074 successful, with no
active runs among the latest eight and no subsequent development-branch commit.
Used an isolated worktree; left both previous dirty checkouts intact. Adopted only
the unfinished booking-confirmation HTTP/resolver files and their tests from the
older checkout, then independently completed and verified them. The previous
mail-rehearsal edits were not adopted and no live test was repeated.

Completed the optional server boundary using the runtime's existing admission,
management, origin and capacity settings. Verified consent, recipient proof,
current capability, encrypted durable queue, concurrent single send, exact retries,
changed-recipient conflict and revoked-link denial through HTTP. Firebase recipient
proof reuses current-account validation and denies revoked/disabled/changed-email
identities. The generic host resolver preserves the future guest journey; no new
registration requirement or public email endpoint is activated.

Implementation source: 833ae1647d91219d09e42efd4151566a7b950f84, advanced to the
authorised development branch without force. Final focused integration suite: 56
passed. Push CI 37340543483 and PR CI 37340549739 passed all four jobs, including
native Windows, database, Firebase and browser checks. Offline container
37340543462 passed: 523 portal unit passes, one Windows-only skip, zero failures;
four Firebase/browser passes. The standalone runtime package also built and
correctly refused startup without attached identity.

Downloaded artifact 11359115239 matched SHA-256
c22f8c370e26fc5ba7894b01534ca2d99e1609f967fc7d2b8e290e79311d063d.
Its results.json binds the implementation commit above, Node v22.23.3,
Playwright 1.62.1, demo-wvd-portal and liveAccess=false. Image identity:
sha256:61e17181519026b6daee8478aaf74a14bbefd4399b2b41a2054982e653033aa1.
Inspected the mobile private-management screenshot: branding, management/link
controls and contact CTA remain intact; the synthetic no-email notice is present.
One supplementary video was omitted under the existing evidence-size cap; all
required screenshots were retained. Evidence inspected at 16:28 UTC on 5 October.
See WVD-BOOKING-DELIVERY.md for integration configuration and limitations.

The final evidence-only follow-up changes documentation and GitHub access evidence;
it does not change the tested implementation. No live provider probe, email,
deployment, permission or spending action was performed in this continuation.

Next bounded work: guest recipient verification and explicit host activation
configuration, preserving no-registration booking and no new live messages without
specific authority. Public admission, Sites connection and operational backup /
retention remain open. The existing composed Google worker and optional HTTP route
are available for reuse; do not rebuild them or repeat the completed email test.


## Product handoffs now available — 5 October 2026

Salon and Wedding are the primary commercial products. The next controller
should use the completed product entrypoints and exact observed source pins in
WVD-PROJECT-AUTHORITY.md, not the earlier waiting-for-transfer snapshot.
Start SALON-WVD-001 (existing handoff verification/acceptance) and WED-CONT-001
(baseline reconciliation/reproduction) according to current ownership and their
task contracts. Neither intake is complete merely because its documents exist.
Keep unfinished WVD booking work available for reuse rather than automatically
prioritising more development of superseded demo surfaces.

Read both Drive continuation records, Salon portfolio receipt, Wedding's updated
work queue and repository handoff files; resolved Salon head 83b1ebe and Wedding
head afdfa62 through GitHub. No product acceptance suite was rerun or claimed
complete. WVD source b13e467 had successful CI runs 37344608651 and 37344600401;
Google access run 37344608492 was skipped. This update changes no application
or hosting configuration. The existing continuation automation now consumes
these handoffs. Preserve product-specific draft/release, payment, data and
independent-verification restrictions; continue monitoring subsequent Drive
revisions without overwriting active workers.


## WVD product presentation slice

Reconciled exact Sites identities and version evidence in WVD-PRODUCT-TRANSFERS.md.
Prepared through Sites source b30ac0e7787184772979983e93a975f029e3323d; 27 routes
and content validation passed. Latest a44906f handoff update was preserved before
pushing this slice; product code and workers' Drive records remain untouched.
Browser CI and private publication evidence follow after verification.


## Verified product presentation — 5 October 2026, 17:32 UTC

WVD implementation commit: fe811bae8275defda38443ac6ab44bb4a745a2a4.
Non-forced development update preserved the concurrent a44906f handoff commit.
Push CI 37348583060 and PR CI 37348588869 passed all four jobs. Public-site
browser suite: 78 passed (mobile/desktop, accessibility, navigation, retired
routes and unavailable commerce). Site unit suite: 19 passed. Public artifact
11361162614 was downloaded; SHA-256
2bacb4163e928d2def7961a11a7fd33a6f541e49342fa9ecc0b8c46095e47dea matched.
Inspected mobile product catalogue and desktop Wedding screenshots. Existing
optional analytics consent remains visible; no new consent behaviour was added.

Offline container 37348583113 passed. Artifact 11361082847 SHA-256
d0a7125356441df93ee51d991d11cbccf4a153844d3a3686458135fdd6206aed matched.
results.json binds this exact implementation, Node v22.23.3, Playwright 1.62.1,
demo-wvd-portal and liveAccess=false; portal-unit and firebase-browser passed.
Image: sha256:10650845e7ba19f069c7e7ac5e6d0077f7ee7d515a6c9d1b43cda052d545cec5.
One supplementary video was omitted under the existing cap; screenshots retained.
No live Google access or email test was repeated.

Sites private publication succeeded at 17:31:48 UTC, source
b30ac0e7787184772979983e93a975f029e3323d, deployment
appgdep_6ac3defcf2d481918d7e164a6ce5bcb7, version
appgprj_6ac361a8bfd48191b3bde453565cf2ab~appgver_65d0d57df764819187c008bbfc7940b2.
URL: https://wear-valley-digital-development.leatfield.chatgpt.site
The audience remains owner-only. Public domain and product deployments unchanged.
Frontend source was synchronised into the controller branch; the Site checkout
contains only the frontend surface, not the latest controller backend. Reopen this
same Site before further frontend edits and preserve that separation.

Next: refresh current ownership and complete the scoped product baseline tasks
SALON-WVD-001 and WED-CONT-001 with their required distinct verifier. No acceptance
or paid-release gate was closed here. Salon has no deployed preview to link until
its own permitted deployment work completes. Wedding remains an owner-only
fictional prototype. Current Work Queue 16Q8nFXWd9u-1rtQ0m6o4Z36yioLaU2fGMx6Oj5vOHTk
was read at modification 2026-10-05T17:02:00.977Z; no named Wedding assignee there.
Do not duplicate current workers; recheck before dispatch. Existing integration
backlog remains available where product work is independently blocked.

## Product showcase and asset-led rebrand — 5 October 2026

Founder explicitly requested a WVD showcase for Human V1, PECP, Salon, Wedding,
forthcoming Hospitality and existing services, then a premium rebrand based on
existing WVD assets. This supersedes aesthetic preservation for this frontend
slice; product readiness and release gates are unchanged.

Used the existing WVD Site and recovered its current source through Sites.
Reused the original horizontal logo and the master primary-logo.png from Drive:
master folder 1POFy5eK74IanjPy_DHpqLLMPWkIlftWr, file
1Czw-SxcIq-iN3nvVkYGtcRUoLnTk4zkK, modification
2026-08-19T11:46:39.348Z. The 25,842-byte WebP is a web-optimised copy of that
artwork; the master remains unmodified. Read hero.png
1JgwnYJbPIBGP5l5wXcjbGp4oYzANlAhW as a visual reference only: its baked-in
navigation and text are not used as a functional webpage. No stock/client
photographs, testimonials or new product logos were invented.

Introduced the midnight / electric-blue / silver identity across global navigation,
typography, buttons and footer. Homepage and product directory showcase all four
products; Salon and Wedding lead the commercial cards. Hospitality has its own
honest coming-soon page. Service enquiry, case studies, private-prototype boundaries,
unavailable subscriptions/hire and retired demo surfaces remain intact.
No live email, product deployments, commerce activation, domain migration or
spending occurred. No worker Drive record was edited.

Controller implementation: dbdccc61bc67149e5d1728e644bca3ce34c30d29.
Sites frontend source: d6200202c28c9ee509021c56f649ddaa8d6a5b5e.
Content validation and 28-route Astro build passed locally.

Final verification commit (same frontend): a25aff6ad501eafee2167d51815adc726ad4025c.
Push CI 37356706671 and PR CI 37356711546 passed all four jobs. The public
browser suite passed all 82 checks, including product/CTA routes, accessibility
and narrow-screen overflow. Local link audit checked 115 internal links/anchors
on the five changed routes. The first two CI revisions passed browser checks but
exceeded the screenshot budget; PNG palette optimisation now preserves all 20
full-page captures within the unchanged 5 MiB cap. No checks were removed.
Development-container was correctly skipped by existing path filters.

Downloaded public artifact 11364009649 (2,418,512 bytes), verified SHA-256
7c06bdda2af04809276f0364f92480223f3fe72bbf73860e246415c10dde35c1.
Inspected desktop and mobile homepage renders: original brand artwork, all four
products, coming-soon Hospitality, service links and contact CTAs are present;
no clipping or horizontal overflow observed. Screenshot review deliberately
declines optional analytics; ordinary consent behaviour remains available.

Private publication succeeded at 2026-10-05T18:31:33.101812+00:00.
Deployment: appgdep_6ac3ecf54d5c8191a4f6813d80498246.
Version: appgprj_6ac361a8bfd48191b3bde453565cf2ab~appgver_aad8d4b68a1481919eaa5978542547d0.
URL: https://wear-valley-digital-development.leatfield.chatgpt.site
Owner-only audience preserved. The frontend Source helper committed/pushed and
packaged the exact deployed source above; only changed frontend files were synced
to GitHub, preserving the controller backend. No public-domain release is implied.

Next: retain this new founder-authorised brand and complete the existing
SALON-WVD-001 / WED-CONT-001 baseline handoffs under their actual current owners
and distinct verification requirements. Refresh Drive modification/ownership
evidence before product work; this showcase closes no product release gate.
Continue independent agreed integration work when those tasks are occupied.
