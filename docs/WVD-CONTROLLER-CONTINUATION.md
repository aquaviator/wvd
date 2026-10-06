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

## Salon baseline reproduction — 5 October 2026, 18:55 UTC

Current WVD head 59ad35a had successful push/PR CI 37357119941/37357127604;
container was skipped by its existing path filter. No failed CI required repair.
Used a clean isolated WVD worktree; previous dirty controller checkouts untouched.
Fresh product branches and PR ownership were checked: Salon 83b1ebe, draft PR #1
unassigned, no Actions runs; Wedding afdfa62, unchanged. Drive product entrypoints
and work queue were unchanged at their recorded modification times. No overlapping
product worker was identified. Wedding source and its 32 NOT_RUN scenarios remain
unchanged; WED-CONT-001 has not been executed here.

Completed a bounded Salon reproduction attempt, pushed without force to its
existing import/salon-foundation branch as 722fba535b79d905477e0f07202a28f9c94c1802.
Detailed report: handoff/wvd/results/SALON-WVD-001/change-report.json in WVD-Salon.
All 182 UTF-8 files were retrieved through the authenticated GitHub connector and
verified against their Git blob hashes at 83b1ebe2e7338535634f0ed52f01c7ac1e8a2273,
tree 04ff7b8ff20c36e72c816ef0b7483b48e7920906. Original import tree 6efdbc4 was
verified through GitHub; later changes were 14 documentation/evidence paths only.
Shell cloning lacked an applicable credential; text-only blob tools cannot retrieve
four historical PNGs. This is an exact text-source snapshot, not a full Git checkout.
Remote originals and all protected application/specification paths are preserved.

On Linux / Node v24.19.0 / npm 11.9.0: locked install (687 packages), TypeScript,
five domain tests, production build, both local Wrangler 4.92.0 D1 migrations
and database inspection passed. Persistence started absent; zero tenants and
bookings, no FK violations. Source, command/exit-code records and SHA-256-bound
logs are committed. Existing cache/registry were used; reuse/download split and
all-in cost remain UNKNOWN. No dependency or application fix was needed.

SALON-WVD-001 outcome: LOCAL_CHECKS_PASSED_HANDOFF_ACCEPTANCE_HELD. Full clean
checkout and distinct independent review remain unresolved. The controller authored
this report and did not self-certify it; verification-report.json is explicitly
NOT_RUN and hash-binds the submitted report. S4, full SALON-AT-028 and live release
remain open. No hosted/API/browser acceptance was repeated or promoted. No merge,
deployment, provider transaction, live message, real data, IAM or spending action.
The ten-item overlay and task attempt are updated without restarting other tasks.

Salon Drive continuation and portfolio receipt were updated with revision guards
and read back. New modified times: START HERE 2026-10-05T18:55:11.206Z; portfolio
receipt 2026-10-05T18:55:11.543Z. Wedding START HERE remains
2026-10-05T16:59:22.651Z; work queue remains 2026-10-05T17:02:00.977Z.
Live controller identity reads confirmed aquaviator and admin@wearvalleydigital.com;
access evidence is in the registries, never credentials.

Next: assign distinct exact-revision Salon review and use an existing supported
full-source/binary route to resolve the checkout gap. Do not request blanket GitHub
access or rerun all successful checks without a concrete cause. Independently
continue WED-CONT-001 or SALON-WVD-002/003. Preserve native stacks, original contracts,
financial/health restrictions and release boundaries. No founder input is needed
for this attempt. Keep continuation active: the agreed product work is unfinished.


## Wedding undecided-date slice — 5 October 2026

Founder requested continued building. Refreshed product heads, Drive revisions,
queue ownership and Wedding CI (no workflow runs); no named overlapping worker
was identified. Recovered the full original app/assets through the existing Sites
source helper at 19fb840, and compared GitHub afdfa62: later changes were only
docs/evidence. Native stack/lockfile retained. Original contracts unchanged.

Baseline locked install, build, TypeScript, 12 domain checks and two fresh local
D1 migrations passed. Implemented the next WED-WP-003 / WED-REQ-006 bounded slice:
blank fictional onboarding, no invented dates/location/guests, explicit sample
option, existing-workspace retry preservation, first-event selection and empty-state
controls, and DATE_UNDECIDED quote response. Nine new disposable SQLite-adapter
checks, 12 domain checks, TypeScript and production build passed. These are creator
checks, not full hosted/independent acceptance. Browser QA and original HTTP suites
were not rerun: managed Sites instructions prohibit an improvised preview server
without the supported control-browser capability, which is unavailable here.

Product changes pushed non-forced to aquaviator/WVD-Wedding branch
`development/undecided-date-onboarding` at
`2c384804a4e4b62ba7bf7aac526c607ceb4279be`.
Task/evidence: `handoff/WED-WP-003-UNDECIDED-DATE.md`,
`evidence/continuation/onboarding-results.json`, and updated 14-package overlay.
Sites source `37b10d5eafcf56649e12a8a5ae2742b3a7b671df` deployed successfully to
https://wvd-wedding-workspace.leatfield.chatgpt.site at 2026-10-05T19:14:30Z,
deployment `appgdep_6ac3f70a835c8191833a555eac8f5f5c`.
Owner-private audience and existing DB/R2 preserved; no reset, schema/provider
migration, live send, real-data permission, financial operation or extra spending.
No commercial release. Original hosted source 19fb840 is now historical baseline.

Wedding Drive START HERE received a revision-guarded continuation receipt and
current-version correction. WED-CONT-001 remains partial: no distinct verifier
or complete HTTP/browser reproduction. All 32 complete scenarios remain NOT_RUN;
no package acceptance or Salon intake was closed. Existing owners retain their
workspaces, so the new starting form appears only before first bootstrap.

Next: exact-candidate independent/browser review of blank creation/reload/first
event, then remaining bounded WED-WP-003 editor gaps or independent Salon work.
Do not repeat successful local checks without changes; do not reset founder data
to expose onboarding. Product deployment is a private fictional prototype, not
commercial release. No founder input is needed for other unblocked development.

## Wedding reviewed website section order — 5 October 2026

Fresh state before work: WVD 82e23d9 passed both validation runs; the development
container correctly skipped its path-filtered documentation change. Salon remained
722fba5. Wedding branch and draft PR #1 were b2f9c36 with no new owner/worker.
Wedding Drive START HERE had only the prior controller update at
2026-10-05T19:16:20.483Z. The Site remained custom owner-only, revision 2, with
sole allowed owner 0e17b421-97f4-421a-a694-ff56bbd659fb.

Reopened exact Sites source 37b10d5 and implemented the next bounded WED-WP-003 /
WED-REQ-006 editor gap. Owners can reorder Story, Travel and FAQ before saving.
The existing reviewed publication snapshot carries that order; empty sections
stay hidden. API validation rejects missing, duplicate, unknown and surplus
section entries. New workspaces persist the default; legacy records use a stable
non-mutating fallback and normalise only on a later owner save. No database
migration, private-data surface or new dependency was introduced.

Verification passed: TypeScript, production build, eight new editor-domain checks,
nine onboarding checks and 12 existing domain checks. Historical receipts were
restored; new evidence is
`evidence/continuation/editor-section-order-results.json`. Managed browser,
hosted identity/D1 and distinct independent verification remain NOT_RUN.

Product commit `dfd3987e4a548ed61bc905305c7fe36fad9c88bd` was pushed
non-forced to `development/undecided-date-onboarding`; draft Wedding PR #1 was
updated. Exact owner-private Sites source
`7b799af9a51b8c2eae53316874b476b9abfa2d47` deployed successfully as
`appgdep_6ac3fd7555f48191b8f9b47236b212c2`. Existing D1/R2 and sole-owner audience
were retained. The Drive START HERE receipt was revision-guarded and read back.

WED-WP-003 stays PARTIAL, WED-CONT-001 stays partial, and all 14 package acceptance
states and all 32 full scenarios remain unverified/NOT_RUN. Next: exact-candidate
independent/browser review across legacy/new workspaces, followed by one remaining
bounded editor gap. No commercial release, live message, real-data permission,
schema/provider migration, audience widening or extra spending. No founder input
is needed for other unblocked work.

## Wedding brand-save compatibility and CI recovery — 5 October 2026

Fresh WVD head f8ad444 had a failed PR validation run 37365604895: quality job
111949862864 was cancelled with no steps; its log endpoint returned BlobNotFound.
The same-source push run 37365600074 had passed. Retried the cancelled job through
the discovered GitHub capability; run attempt 2 completed successfully. No code
change or speculative CI configuration change was needed for that cancellation.

Wedding branch/draft PR #1 remained dfd3987 with no assignee or changed queue;
Salon remained 722fba5. Drive modified evidence before execution: Wedding START
HERE 2026-10-05T19:43:52.406Z, Salon START HERE 18:55:11.206Z, current work queue
17:02:00.977Z. Sites owner/access read confirmed Wedding version 3, sole owner
0e17b421-97f4-421a-a694-ff56bbd659fb and no external visitors. No duplicate task
was dispatched and no other worker's checkout was overwritten.

Found and reproduced a compatibility regression in the preceding WED-WP-003
section-order change: the original brand-save payload without sections returned
400 INVALID. Fixed the native validator/route so omission preserves the current
saved order, defaulting only for legacy records. Explicit malformed orders still
fail. Existing authority, origin, revision, replay and reviewed-publication checks
remain enforced. Original contracts, schema, dependencies and UI are unchanged.

Nine new production-route/SQLite-adapter checks passed, including legacy records,
custom-order preservation, atomic rejection, ownership/origin denial, stale
revisions, idempotency, publication and rollback. Eight editor checks, TypeScript
and production build passed. These checks use mocked platform identity and local
SQLite; they do not certify hosted identity/D1, browser rendering or independent
review. All 32 complete scenarios remain NOT_RUN; all fourteen package acceptance
gates remain open. WED-CONT-001 and WED-WP-003 remain partial.

Product fix/evidence commit fb99b6f6aa6f3f4d86888ad0b5f16b2493c1bcbc and subsequent
handoff commit 35eaf66f3d9130b21a4ed7729787a55cf747505c were pushed non-forced to
development/undecided-date-onboarding. Draft PR #1 remains unreleased. Read
handoff/WED-WP-003-BRAND-COMPAT.md and evidence/continuation/brand-compat-results.json.
Exact Sites source 35034aba9e256b9163c7d630db2c92fc95333b65 deployed successfully
as appgdep_6ac40ceb11f48191a8ddc7f06752f755 at 2026-10-05T20:47:49.267348Z.
Existing owner-only audience and D1/R2 retained. Drive START HERE current-source
paragraph and continuation receipt were revision-guarded and read back.

Next: distinct exact-candidate review, supported browser/hosted identity checks
when available, then remaining bounded editor work or independent Salon work.
Do not repeat successful checks without a source change or concrete risk. No
commercial release, audience widening, live send, real data, migration or extra
spending. No founder input is required for the remaining unblocked development.

## Inherited public-search/AI discovery — 5 October 2026

Fresh source/ownership: WVD 9387fed; Wedding development 35eaf66 and Salon 722fba5
were unchanged, both product PRs remained drafts with no named assignee. Drive
START HERE modification evidence was unchanged: Wedding 20:49:26.839Z, Salon
18:55:11.206Z; queue 17:02:00.977Z. No product worker was overwritten or dispatched.

Both WVD validation runs at 9387fed had cancelled jobs with no executed steps;
all jobs that executed passed. Retried failed/cancelled jobs through the existing
connector: runs 37372269611 and 37372265521, attempt 2, both completed successfully.
Check the new source's CI before treating the whole branch as validated. No CI
configuration was changed on the assumption that runner cancellation is a code bug.

Selected the founder's explicit direction that every developed application should
be discoverable through AI when live. Reused the existing web-content standard,
factory project planner, exact-standard hash and context assembly. Standard 1.5.0
now makes all four product flavours inherit public-discovery verification work;
Android applies it to public companion content. Plans contain seven NOT_RUN
checks with null evidence references, NOT_VERIFIED status and no audience-change
authority. Context-only packets carry the same policy. Callers cannot supply a
discovery-readiness override; returned plans cannot mutate later consumers.

Requirements cover route classification, crawlable public HTML/canonicals/links/
sitemap, crawler controls, truthful structured data, publisher/source/review dates,
private-data exclusion and deployed-URL/search observation. They preserve separate
search and model-training preferences. Current private Salon/Wedding prototypes
are not made public, and no indexing/ranking/citation result is claimed.

Primary Google Search and OpenAI crawler documentation was read fresh; exact links
and the checked date are in docs/WVD-DEVELOPMENT-STANDARD.md. Reuse decision: extend
existing inheritance rather than create a second SEO pipeline, provider or app.
This slice changes planning and worker context only, not product HTML or hosting.

Verification: all 59 factory checks passed (including three new discovery tests
and expanded packet/consumer assertions), project CLI output retained all seven
unrun checks, access inventory validated all eleven routes, and diff checks passed.
The tests cover all flavours, isolation, forbidden overrides, standard fingerprint,
context inheritance and existing budget enforcement. No new dependency or spend.

Next: apply these checks to an exact authorised public product/content surface
through Sites, using existing routing/metadata/privacy tests. Record unavailable
public indexing as NOT_RUN while a prototype remains private; do not weaken
access to obtain a search result. Continue remaining Salon/Wedding acceptance and
native backlog independently. No founder input is needed for this planning slice.


## Wedding typography and Salon recovery boundary — 5 October 2026

Fresh heads were WVD 6dc1dac, Salon 722fba5 and Wedding 35eaf66. Both product PRs
remained drafts and unassigned; Salon/Wedding entrypoint and queue modification
values were unchanged before work. WVD validation at 6dc1dac passed in both runs
37377660492 (push) and 37377667628 (PR); container 37377667607 skipped by path filter.
No repeated checks or CI changes were needed for that source.

Salon SALON-WVD-001 remains HOLD. Current repository tree confirms the same four
historical PNGs. GitHub fetch and fetch_blob reject their binary bytes. Existing
Salon Sites identity appgprj_6ac3bb5b197081919d34810fd6ff9ce0 was verified as version 0,
no live URL, sole-owner custom audience. Source helper opening, with an existing
repo-scoped credential, returned exit 1: Unable to prepare the Site. No source was
changed or published. The error does not establish that the source repository is
empty. Do not retry this same boundary without new evidence or request blanket
GitHub access. Drive engineering folders retain the original 86,649-byte handoff
ZIP, modified 15:15:57.298Z; it was located, not downloaded or proven to contain
application images. Full binary checkout and distinct Salon verification remain
open; local setup successes were not rerun or relabelled as full acceptance.

Continued independent native Wedding work from WED-WP-003 / WED-REQ-006 / typography
and draft/publication portions of WED-AT-011. Frozen task and evidence:
WVD-Wedding handoff/WED-WP-003-TYPOGRAPHY.md. Reused native brand validation, editor,
public renderer and actual-route disposable SQLite harness. Three bounded system
font presets now persist in drafts and immutable reviewed publication. Legacy
records retain original styling; older clients preserve omitted typography.
Invalid tokens fail atomically. No external font service, schema or dependency.

Fourteen route/SQLite checks passed, including five new typography and local React
HTML checks; ten editor-domain checks passed, including two new typography checks.
TypeScript and production build passed. Tests prove operational/publication
preservation, malformed input rejection, review-hash binding, draft exclusion from
rendered HTML and legacy rollback. Platform identity is mocked. Browser CSS/layout,
accessibility, hosted identity/D1 and distinct verification remain NOT_RUN.

Application/evidence commit 7ba295e3ab5fe5733f0f4cbedce38c569037365b and handoff commit
4495c4e8f8f0dab867123865c442a12872acf970 were pushed non-forced to the existing
Wedding development/undecided-date-onboarding branch. Draft PR #1 remains unreleased.
Exact Sites source 3add146935cd2d1628b6c96d193e88f04ae423dc deployed successfully as
appgdep_6ac4211a39fc8191a3ed2e592e347799 at 2026-10-05T22:14:07.468074Z. Sole-owner
access and existing DB/R2 retained. Drive START HERE current source and continuation
receipt were revision-guarded and read back. No workers were overwritten/dispatched.

Next: distinct exact-candidate review and supported browser verification, then one
remaining bounded social/logo/hero/crop editor gap; Salon target/identity and
research tasks remain independently actionable. Both product intake tasks remain
partial/HOLD; all fourteen Wedding package gates and 32 full scenarios remain open.
No commercial release, wider audience, live send, real data, migration or extra
spending. No founder input is needed for remaining unblocked work.


## WVD public service launch — 6 October 2026

Latest founder direction: get WVD live as a service offering for promotion and
social profiles, independently of Salon/Wedding/other product availability.
The service Site is now PUBLIC at https://wear-valley-digital.leatfield.chatgpt.site.
Native audience revision 2 was applied at 2026-10-06T10:27:00.860717+00:00 and read
back as public/active, version 4. Sites source 5ee9b94a7556476b7c3130f31a075612c441e090
was mirrored to controller 705592e48444fb78d2694d48906d79603a4b346e; both push/PR CI passed all
four jobs, including 82 public browser and 19 site unit checks. Home/Enquiry
mobile/desktop evidence was inspected. Final handback and exact DNS records:
[WVD-SERVICE-LAUNCH-2026-10-06.md](WVD-SERVICE-LAUNCH-2026-10-06.md).

The public offer is websites, bespoke software and automation. Enquiry is a
reviewable browser-local email draft to hello@wearvalleydigital.com, sent only
by the visitor. Optional analytics are disabled. Products remain labelled in
development/private/paused with no product audience change or commercial release.
No new subscription, customer mail, social post or repeated email test occurred.

Next launch action: connect wearvalleydigital.com and www through the existing
Cloudflare DNS zone using the exact Sites records, then verify active TLS and
update canonical/sitemap origin in the same Site. DNS write access is not exposed
in the current controller session. The public Site URL can be used meanwhile.
Keep all mail-related DNS intact. Do not rebuild booking, portals or products
as a prerequisite for promoting this service offering; continue their separately
authorised backlog under current ownership and acceptance rules.
