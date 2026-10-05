# WVD development checkpoint

Authority: agreed founder brief and subsequent instructions in the development
conversation. The repository development standard governs implementation. This
checkpoint records progress; it does not replace product requirements or release
approval. Continue independent authorised development without founder-local pulls.

## Established direction

Build WVD's public services site and scoped client project portal. Use the
existing Google/Firebase platform, reuse Human V1/PECP/WVD code and configuration,
and introduce no new service subscription or external spend without approval.
Development pushes are authorised; production deployment requires approval of an
exact tested release. Preserve product/customer isolation.

## Implemented development foundation

- Public services/about pages and synthetic hospitality/salon demonstrations.
- Four practical guides and a public enquiry draft with required contact/need
  fields, optional timing/budget/website, explicit review and no automatic send.
- Scoped project views, Owner-only version approval, feedback, tickets and replies.
- Shared domain with local SQLite and bounded transactional Firestore adapters.
- Firebase server token checks and trusted revision-checked access provisioning.
- Admin client/project creation, progress/milestone/review management, scoped
  account/grant changes and manual ticket triage with atomic audit references.
- Owner controls for existing Member project grants, one-time Member invitations,
  private invitation history/revocation, and emulator registration/verification.
- Product-bound notification planning and fresh Firebase recipient preparation,
  preserving pending intents; message delivery is not implemented.
- Shared call rules, bounded Google free/busy evidence adaptation and optional
  provisional HTTP availability with timing preflight and explicit read capacity.
- Immutable review text and approval digest binding, with transactional operator
  attribution references (not verified IAM-principal attribution).
- Client histories preserve approved review text and saved feedback across new
  versions and persistence reopen; legacy approvals explicitly lack review text.
- Synthetic emulator sign-in and disposable offline container verification with
  commit-bound screenshots, video and results; native Windows checks retained.
- Versioned scope-bound aggregate backup verification and isolated SQLite disk
  restore rehearsal; live Google restore and retention remain unfinished.
- Standard/factory inheritance of continuous development from the agreed brief.

## Remaining development and release acceptance

Continue from unmet brief criteria, inspecting existing source before building.
Remaining work includes live Google browser authentication/server runtime access,
production persistence and migration acceptance, live invitation/onboarding
delivery and broader Owner delegation policy,
live external deliverable/binary preview binding, notification delivery, Calendar/Meet
integration, hosting/TLS, monitoring, retention and backup/restore rehearsal.
Dependency remediation and independent integrated release review remain open.
The Firestore aggregate and local authentication are development proofs; passing
emulator tests does not establish production readiness.

## Access dependencies

Scoped Google development access is now activated. Founder CLI evidence confirms
project `wvd-development`, billing enabled, the intended service account and
GitHub federation binding. Founder enabled Drive/Calendar APIs and granted brand
folder Viewer and named WVD Calendar free/busy access. Keyless workflow run
37196863698 passed authentication and both read-only probes on 4 October 2026.
This is development CI access, not a deployed app credential connection or
production readiness. Continue independent emulator/domain/UI/container work;
production release and new external spend still require separate approval.

## Verification references

Prior operator-history slice: 299352a6f061d6080e519617d9a4ce7b8959243a,
container run https://github.com/aquaviator/wvd/actions/runs/37033807179.
Continuous-development rule: 1b914c95a765cb2eec10671002ef8c9139917ca3,
all applicable CI runs passed. Client history and backup rehearsal changes are verified by the push-triggered
CI. The first history browser run found an ambiguous test selector; the next
revision scopes that selector to the approval record. Inspect exact commit runs and
bounded evidence before recording integration success. GitHub artifacts expire
after one day; run results remain the durable verification reference.

## Recovered brief bindings

Read the actual authoritative Drive control records on 2 October 2026, rather
than relying on placeholder links in the earlier handover:

- WVD-PF009-Product-Blueprint-v0.1.1; observed modification
  2026-10-01T14:15:59.315Z. The separate approval record establishes approval of
  this baseline; its original candidate wording is historical.
- WVD PF-009 Blueprint Approval Record v0.1.0; observed modification
  2026-10-01T16:14:29.521Z.
- WVD-WEB-AMENDMENT-v0.1.2; observed modification 2026-10-02T08:49:25.111Z.
  Adds the client/admin portal, booking and the Hospitality/Salon scope.
- WVD-PF010-WEBSITE-EXECUTION-v0.1.0; observed modification
  2026-10-01T16:11:19.633Z.
- WVD PF-024 Website Bounded Delivery Task Packs v0.1.0; observed modification
  2026-10-01T16:14:47.666Z.

Drive remains the business-document authority. Latest explicit founder directions
supply development-push authority and the Google/reuse/no-new-subscriptions
implementation direction. Historical preparation-only restrictions are not used
to request repeated development permission. Release gates, unsupported public
claims, external spend and independent-verification requirements remain distinct.
No source record was rewritten or promoted to a new verification state.

Buyer guides implement the B15 guidance themes and amended launch content as
non-production content: a website brief checklist and Care versus development.
They introduce no numerical promises or new entitlements. Portal history dates
use explicit Europe/London formatting. Current 22-route build, content validation
and 15 site unit tests passed locally; new route accessibility/mobile checks and
portal browser evidence are verified by CI. Prior history/backup commit
2ee4cd1ed79f6ba06d24f73bb35fbb0e26ff696c passed all four CI checks and container
run https://github.com/aquaviator/wvd/actions/runs/37045427568; downloaded evidence
was inspected and bound to that exact commit.

Introductory-call policy screening now has a pure synthetic test slice, adapted
from Salon duration/conflict checks. It covers UK daylight saving, notice, gaps,
weekends and supplied holiday/calendar coverage. No live availability or booking
endpoint exists; Calendar permissions, full conflict-calendar discovery, fresh
holiday data, reservation concurrency and Meet/delivery remain integration work.

Read-only WVD Calendar ownership and free/busy connector checks are now recorded
in WVD-CALENDAR-DEVELOPMENT.md. App credentials, all conflict calendars, holiday
freshness, Meet and reservation/delivery remain unverified. Final guide screenshot
review found an unnecessary analytics prompt; the guide routes now use the
existing analytics-disabled layout option until an actual integration is ready.
No site-wide analytics behaviour or marketing provider was changed.

## Admin overview development slice

The existing provider-free domain and SQLite/Firestore read transactions now
provide an active-WVD-admin-only client/project overview. It groups explicit
business IDs and shows stage, next step, awaiting-review, feedback and ticket
counts; it exposes no credentials, membership rows or notification payloads.
The browser derives visibility from current server-owned identity capability,
opens existing scoped project conversations, and clears the overview on logout.
Owner/Member accounts cannot request this cross-client projection, and token or
request role flags confer no privilege. Admins still cannot approve for clients.
This is a read-only workflow foundation: client creation, invitation management,
progress editing, support triage and delivery remain unmet amended-brief work.
No live resources, authentication provider or subscription was added.

The ownership/handover buyer guide extends the approved B15 theme using the
existing public layout. It asks readers to clarify account control, reusable
software licences, exports and practical transfer responsibilities; it creates
no additional contractual entitlement or claim of completed legal review.

Admin screenshot review confirmed the grouped overview and UK history times.
It also exposed unsent support form text surviving a forced sign-out. Sign-out
now resets those drafts before another account can use the page. Browser checks
cover forced and explicit sign-out; the admin overview has an explicit refresh
control so its activity counts can be reloaded after other users' writes.

## Admin progress updates

Active WVD admins can update bounded stage/next-step text through the existing
server boundary and shared persistence adapters. Each write retains actor,
project/business, server time and exact text in project progress history. A
SHA-256 binding to the previously read values prevents stale overwrites; operation
IDs bind exact retries and cannot cross approval, feedback or ticket writes.
These records remain part of the same aggregate transaction and scoped backup.
Client views show progress history without internal actor/operation identifiers.
Owner/Member accounts cannot write progress, and no milestone status or approval
receipt is changed. Progress writes create no email promise or delivery intent.
History has a bounded 200-entry proof capacity; production retention/scaling
acceptance remains open. Digests are integrity/conflict checks, not an external
tamper-proof audit service. Existing grants, review-publication configuration and
UI patterns were adapted rather than adding a new provider or workflow engine.

Calendar reuse review found that the candidate-screening slice duplicated the
earlier single-slot availability proof. The batch now delegates to that existing
contract, adds bounded candidate input, and preserves explicit evidence freshness
and opening/closing buffer policy. Strict holiday-date and malformed-calendar
checks are shared by both consumers. No live call site depended on the replaced
synthetic batch input shape. This supersedes the earlier Salon-adaptation note.

Verified progress-editing revision:
cc73826d3e7111b9b516ed6fba7c72066db64385. All four push CI jobs passed
(run 37049577937), and the offline container passed
https://github.com/aquaviator/wvd/actions/runs/37049577883. Downloaded results
match that source commit, Node 22.23.3 and Playwright 1.62.1 with liveAccess=false.
The synthetic admin screenshot was inspected: progress update/history and UK
times display correctly, refreshed counts are visible, and support drafts are
empty after account change. Ownership guide revision
cfa495611600812e3ecd5716c3717ef328cbbc13 passed CI and its mobile screenshot
was inspected. Shared Calendar checks now pass all 203 applicable local portal
tests; native Windows-only coverage remains verified in CI.

The justified-automation buyer guide completes the four B15 guidance themes
(website scope, Care, ownership/handover and automation) using existing layouts.
It focuses on actual repeated work, existing capabilities, exceptions, whole
cost and bounded verification; it makes no quantified savings or AI capability
claims. Guide screenshots use CSS pixel scale to keep the growing route set
within the existing 5 MiB evidence cap, with no change to viewport/overflow checks.

## Admin review publication

The admin workspace can publish review text to an existing milestone using the
existing immutable review/version implementation. The server checks active WVD
admin capability and the currently read milestone version before a new write.
Exact version/content retries return the stored version without rolling back
current progress; changed text under an existing version is refused. Published
versions retain server-derived publisher identity/time in durable storage and
backups. Client projections retain exact review text/digest while omitting that
internal publisher identifier. A new version requires fresh client approval;
admins gain no client-approval permission. Trusted CLI publication remains
separate and retains its existing revision/operator-context checks.
This text-review workflow does not establish external artifact/preview binding,
new-milestone creation, notification delivery or production release acceptance.

Admin milestone creation also reuses the immutable-review publisher: a new
milestone and its first review are committed together with server-derived creator
and publisher attribution. Name/version keys provide exact retry behaviour;
existing milestones cannot be overwritten or silently adopted. Input/clock or
transaction failures leave neither a partial milestone nor a partial review.
Client views omit internal creator identifiers, and every new milestone awaits
Owner approval. Creation is capped at 200 milestones per proof project and creates
no additional project/member grants or notification-delivery claim.

Approval controls now use a server-computed per-project Owner capability. The
Member/admin browser tests check disabled controls rather than presenting an
unauthorised click as a normal workflow. Domain/HTTP tests retain direct denial
coverage, and every approval still rechecks current identity and membership,
including retries. Page capability is presentation data, not write authority.

## Project creation for existing clients

Active WVD admins can create a project under an explicitly selected existing
client reference. Creation adapts the progress-history transaction to retain
creator, server time, initial stage and next step; resource-bound retry keys
prevent duplicate projects, changed retries and silent adoption of seeded rows.
Creation and initial progress are atomic. No account, membership or project grant
is added or widened, and no new client/business reference is guessed. Client
accounts therefore cannot see a new project until access is assigned through an
appropriate trusted workflow. The UI says this explicitly and refreshes its
project selector after creation. New client onboarding and project-grant
management remain separate unmet requirements. Creation is capped at 200 proof
projects per business; aggregate capacity/release limits still apply.

Unsent support drafts are now reset when the selected project changes, including
opening a newly created project. Refreshing the same project preserves a draft.
Explicit logout and forced sign-out still clear it. Browser checks cover project
and account transitions so one client's unsent text cannot carry into another
client's ticket form. No draft is persisted to browser storage.

## Manual WVD support assessment

Active WVD admins can record bounded priority text, a Care assessment (needs
review, included in agreed Care, or separate quote required), and a client-visible
explanation on an existing scoped ticket. Ticket type never selects entitlement
or a deadline. The operator uses the client's agreed scope; no priority tiers,
prices or SLA are invented. Exact retry keys, stale-value digests and transaction
rollback preserve current assessment plus actor/time/history. Clients can read
assessment/history but cannot write it; new private actor/operation identifiers
are omitted from ticket projections, including ticket-creation retries. History
is capped at 200 proof assessments per ticket and remains in scoped backups.
No additional notification intent, recipient policy or external message is
created; notification delivery and operational support policy remain open.

## Trusted project-access updates

The existing Google provisioner/CLI now supports an explicit project-list update
for an existing business membership. Shared input validation and fresh Firebase
user checks are reused. New grants require a verified enabled account; removal
does not depend on a disabled/deleted Auth account being usable. Role, global
admin flags, business binding and activation stay unchanged. A reviewed full
desired list, aggregate revision and operator/change references prevent stale or
implicit privilege changes. Before/after project lists and audit commit together;
no-op/rejected changes create no history. Client HTTP routes expose no operator
access method. Owner invitations and an admin account UI remain unfinished.

### Scoped access inspection

Trusted Google operators can inspect one existing account/business membership
with its aggregate revision from one document read. The projection omits other
businesses and admin flags; it makes no claim about current Firebase Auth status.
There is no public endpoint or permission mutation. Stale subsequent updates
remain rejected, including after an intervening permission change.

### Admin account overview — 3 October 2026

Active WVD admins can load stored accounts for one existing client from the
client overview. The read-only projection includes account ID, existing role,
portal activation and explicit project grants, including revoked memberships.
It reuses the WVD domain, boundary and SQLite/Firestore adapters at local base
29381cd (remote ad55c46). Other business memberships and admin flags are omitted.
Owner/Member requests and disabled admins are denied; no-store reads do not
mutate aggregate state. UI clears account data with the existing sign-out flow
and ignores results after sign-out or overview replacement. Current Firebase
Auth status, invitations and access editing remain separate work.

### Admin project-access editing — 3 October 2026

The account overview now supports explicit project assignment/removal for existing
client memberships. Reused `accessGrant`, `updateAccess` and Firebase SDK verification
from local base 963f96d; no new account/provider/subscription flow is introduced.
SQLite and Firestore bind the displayed revision to the account read and commit
permission updates plus before/after audit atomically. Attribution is the current
server session actor; client-supplied actor/operator fields are rejected. Revoked
admins, stale revisions, role changes and cross-client grants are denied. Added
grants require a fresh verified enabled Firebase target; removal-only updates
remain possible for disabled/deleted Auth accounts. Browser verification assigns
a newly created project to a Member and then checks visibility after client login
without approval capability. Owner invitations and client onboarding remain open.

### New client and first project — 3 October 2026

Active WVD admins can create an unused client namespace with its first project.
This adapts the existing project/progress workflow at local base b3659c7; no new
business database, provider or account-creation default is introduced. The first
project records a validated unique new-client marker, creator and server time.
Duplicate client/project adoption is rejected; resource-bound retries retain later
progress. The aggregate proof caps client namespaces at 200 and retains the
512 KiB Firestore bound. Creating a client grants no account permissions and makes
no external notification. Local tests and real-emulator/browser coverage exercise
new-client isolation; account invitations remain independent unfinished work.

Previous admin account/editor source 97371d6 passed all four CI jobs and the offline
container (runs 37112653481/37112653484). Account accessibility/isolation coverage
also passed at the following source, in runs 37112847077/37112847025. Reviewed
synthetic account controls and source-bound container evidence; no live access used.

### Member invitation preflight — 3 October 2026

The next invitation slice reuses current `manage-colleagues` authorisation at local
base b034be6. The provider-free contract binds a Member recipient, explicit project
list and canonical expiry with a digest. Every selected project must belong to
that business and already be granted to the active Owner. WVD admin status alone
cannot confer client Owner delegation. Maximum invitation lifetime is required
caller policy, not an invented company default. Broader Owner delegation remains
unresolved; this bounded Member path does not claim it was approved.

This preflight does not issue a token, persist an invitation, send an email,
register a user or grant access. Verified-email redemption, one-time tokens,
revocation, persistence and delivery are the following integration work.

### Owner Member-project access — 3 October 2026

Reused current `manage-colleagues`, verified Firebase access updating and the
shared transactional audit projection at local base fa1872f. An active Owner with
an explicit selected-project grant may change that project's access for an existing
Member in the same business. Other projects/memberships, roles and activation are
preserved. The scoped read/success response omits other project names and audit
lists; unsupported internal helpers have no HTTP route. Added grants require a
fresh verified target. Authority is rechecked after SDK lookup and during commit;
removal-only changes do not depend on target Auth availability. The browser slice
removes/restores a synthetic Member grant and checks Member controls remain absent.
This does not create an account, change another Owner, revoke business-wide access
or complete invitation issuance/delivery. Broader Owner delegation remains open.

### Invitation verified identity — 3 October 2026

Reused existing Firebase Admin token verification at local base d1cfa3f and added
a separate internal pre-provisioning resolver. It verifies current enabled account,
verified email equality and supported provider through the SDK. Current portal
session resolution still checks active product identity; the invitation proof
creates no membership and is not substituted for the portal resolver. Unit tests
cover email changes, disabled/unverified/unsupported users and sanitised outages;
the emulator checks identity proof without access to an inactive product. Token
issuance, one-time persistence/redemption and delivery remain integration work.

### Shared opaque invitation tokens — 3 October 2026

Extracted the existing local-auth 32-byte opaque token and SHA-256 digest primitives
at local base b70e48c into a shared module for the invitation workflow. Local
sessions/invitations retain their wire format and stored digests; Firebase identity
verification is unchanged. Hash comparisons validate encoding/length and use
constant-time comparison. The helper does not provide expiry, one-time consumption,
storage or delivery; those must be bound inside the later invitation transaction.
No plaintext token is introduced into portal state, logs or durable fixtures.

### Internal Member invitation lifecycle — 3 October 2026

Reused Owner preflight, opaque token hashing, Firebase email proof, global operation
binding and the SQLite/Firestore transactions from local base 141f6ce. The internal
Google service issues an opaque token once, stores its digest, and atomically grants
an explicit Member membership with a consumed-invitation record. Current issuer
SDK/Owner checks occur before and during commit; no network work runs in callbacks.
Creation retries cannot return a replacement token; consumed-token retries cannot
restore revoked access. Expiry, recipient mismatch, policy changes, revoked issuer
scope and conflicting/disabled memberships are denied without consumption.

Invitation policy reference/lifetime are mandatory explicit configuration, without
a company default. State validates immutable payload digest, project/identity
references, lifecycle times, operation uniqueness and token-hash uniqueness. The
aggregate retains the existing Firestore capacity bound and caps invitations at
200 records per business. Expiration is enforced on redemption, not claimed as
automatic data deletion. Real emulator coverage races two redemptions and verifies
one membership; fake transaction retries/capacity rollback test atomic consumption.
HTTP/UI registration, email verification/delivery, abuse/retention binding and
broader Owner delegation remain unfinished. No actual emails or live users created.

### Resumed account-proof validation — 3 October 2026

Resumed from source `2d22a18ac49d082f93243b82f6eaeeb97a1eb4a6`.
Adapted the existing Firebase account checks into a shared shape validator for
provisioning and invitation identity proof. Malformed provider lists now deny
proof rather than raising an unsanitised type error. Email checks reject malformed
addresses, whitespace and control characters before grants or notification
recipient preparation. Matching token/current-account email remains required;
the helper confers no product access. Regression coverage proves no grant write,
no invalid-token account lookup, and suppression without consuming an outbox intent.
Local portal suite: 321 passed, zero failed, one Windows-only skip on Linux.
CI/native and unattended container verification remain pending for this change.

### Public call availability boundary — 3 October 2026

Reconciled Firebase account-proof source `6ab2603`; its CI and unattended
development container completed successfully. Added an optional, bounded public
HTTP read adapter over the existing call screening rules and Google evidence
reader. Client input cannot replace calendar IDs, holiday evidence or policy;
explicit concurrent capacity and the shared 8 KiB body reader bound admission.
Responses project validated provisional slots only. The development application
requires explicit isolated emulator configuration to expose it. No live endpoint,
Calendar write, credential, registration or booking confirmation was added.
Actual authorised Google binding, complete conflict calendar set, holiday
coverage/freshness policy and reservation/confirmation remain unfinished.

The first availability source `5a4f913a2a6277421a7da5b4f5e1400107018965`
passed all four native CI jobs and the development container. Follow-up coverage
exercises the real HTTP application without a session, confirms private portal
authentication remains enforced, and sanitises upstream errors carrying HTTP
metadata. The dependency review was refreshed without modifying package pins;
the current development-toolchain findings remain unresolved release work.

Timing preflight now reuses the final availability assessor's shared timing
function. Ineligible candidates make no Calendar query; mixed requests query
only eligible slots plus both conflict margins. Final notice/freshness checks
still run after provider latency. No alternative slot algorithm or schedule
grid was added. Synthetic tests cover no-read rejection, narrowed queries and
loss of eligibility across the minimum-notice boundary during a slow read.

### Firestore emulator recovery rehearsal — 3 October 2026

Resumed from remote source `c84c939`. Reused the scoped backup verifier and
Firestore adapter to restore an aggregate into a random disposable emulator
namespace. The rehearsal preserves source revision, immutable reviews, receipts,
feedback, tickets, invitations and operator history, then reads through the
existing adapter and checks exact state equality. Create-only writes prevent
overwrite; cleanup removes the restored document. Demo-project and loopback
checks run before SDK loading, and there is no live restore or HTTP route.
The emulator test compares SQLite and Firestore results, verifies source state
and revision remain unchanged and checks cleanup. Local portal suite: 333 passed,
one native Windows skip. Source `da847dd08f6f62fae7b4592450de69a92e566e84` passed all four
CI jobs and container run 37123975274, including the real emulator restore.
The downloaded result report matches that exact source and the synthetic
invitation-history screenshot was inspected. This workspace has Java 17 rather
than the required Java 21, so emulator verification used the established CI. This does not
establish recovery of Auth, files, IAM, rules or a production deployment.

### Address validation consistency — 3 October 2026

Extracted the existing Firebase email shape check into `email-address.mjs` and
reused it for invitation requests/stored records, notification admin policy and
local proof authentication. Firebase retains its existing exported validator;
local auth retains its stricter 254-character bound and lower-case matching.
NUL, other ASCII controls and DEL are rejected before invitation mutation or
notification account lookup. Recomputed invitation digests do not legitimise an
unsafe address in stored state. The helper does not verify address ownership or
authorise delivery. Local portal suite: 336 passed, one Windows-only skip.
Source `db54b13e4ed7255ec859b9226d58f2758751c487` passed all four CI jobs
and container run 37124181657. The downloaded report matches the exact source;
the synthetic invitation-history screenshot was inspected.

### Pinned deliverable review development — 3 October 2026

Reused immutable review fingerprints, client projections, transactional approval,
shared persistence and the HTTP/session boundary from source `db54b13e`.
Operator publication can bind an explicit source/version/byte-digest manifest.
Existing text-only reviews retain their exact fingerprints. Trusted source reads
validate pinned metadata and bounded bytes, recheck access, and mint short-lived
in-process proofs scoped to actor and adapter instance. Approval checks the proof
inside the transaction; raw JSON flags or proofs from another adapter cannot
authorise it. Exact receipt retries do not depend on provider availability.

The optional isolated-emulator browser composition shows verified UTF-8 text via
text content and re-verifies bytes before approval. Other file types and missing
source readers stay paused. HTTP clients cannot publish arbitrary source manifests.
Unit checks cover corruption, digest/version changes, revocation, provider timeout,
capacity, expired/forged/cross-adapter proof and SQLite reopen. Emulator/browser
coverage adds the Firestore approval flow and literal script text without execution.
Live Google source binding, binary previews, artifact retention and production
integration remain open. The local portal suite passed 347 checks with one native Windows skip.
Source `01c118caa8e27b4e6dfca52913d7dfc6191d1025` passed all four CI jobs
and offline container run 37125429636. Downloaded results matched the source;
the verified Owner-preview screenshot was inspected. No credentials, live files
or new services were provisioned.


### Admin deliverable catalogue — 3 October 2026

Continued from the verified pinned-preview slice. Trusted composition registers
project-bound source/version/digest entries, and admins choose a catalogue ID in
milestone/review publication. Browser-authored raw manifests and foreign project
IDs are rejected. Owner/Member accounts cannot read the admin catalogue. Source
metadata is copied, publication rechecks current admin authority and immutable
version retries/stale-version protection reuse the existing domain/storage path.
The browser test now publishes a registered reference through the admin form,
then switches to the Owner to view and approve its verified synthetic content.
Local suite: 352 passed, one Windows-only skip. Source
`df5452f36878bcfd91d5ec3061b4cb1b4cd3c406` passed all four CI jobs and
offline container run 37126362514 after correcting the selector accessible name.
Source `b1bf48f79f517e483496c74d8d6ccd3f2c527289` then passed all CI jobs
and offline container run 37126520749, including Member preview with approval
denied and source changes between Owner viewing and approval. Downloaded results
matched the commit and synthetic denial evidence was inspected. The catalogue is explicit development configuration, not a live Google
source discovery service or proof of retained artifact access.

### Bounded PNG deliverable preview — 3 October 2026

Adapted the existing pinned-reader/boundary/UI path; the reuse catalogue contains
no suitable image preview module. Static PNG bytes use bounded data URIs rather
than external browser URLs. Structural/chunk checksum checks and 2048×2048
dimension bounds precede transport, then browser decoding gates the approval
button. Approval rechecks exact source bytes through the existing transaction
proof. Animated PNGs, corrupt/truncated images and other binary formats stay
unavailable. This is not a general image decoder or a live Google file binding.
Source `e1ee6222ffe4dd578149c4770bc7ff9f3209929c` passed all CI jobs and offline container run
37126914296, including admin PNG publication, browser decoding and Owner approval.
The follow-up also bounds PNG decompression to expected pixel rows and clears
stale verified content after source conflict. Local suite: 355 passed, one native
Windows skip. Follow-up source `83a8b2ed012b34e0a7a096a49553097a4fb33e86` passed all
four CI jobs and offline container run 37127287809. Downloaded results matched
the commit; the stale-preview denial screenshot was inspected.

### Google Drive retained-revision adapter — 3 October 2026

Continued into the real provider contract without exporting connector tokens or
selecting live customer files. Reused the explicit Google-client pattern and
existing pinned reader, catalogue and approval flow. Added a fixed revision-GET
bridge for an approved Google Auth client and a project-bound source adapter.
The adapter checks retained revision metadata, bounds/cancels streaming, rechecks
metadata and holds admission until stalled providers settle. Native Google Docs
are not silently exported as the latest version.

Ten focused adapter/bridge tests pass locally. The current restricted workspace
blocks local listening sockets and child CLI execution, so three existing local
HTTP/CLI checks cannot complete here; full verification uses the established CI
and offline container. Browser coverage now routes text/PNG source reads through
the Drive adapter with a synthetic provider. Source
`a870a16d3fc5fa34c57b7fb8e3e5bc8197f9df81` passed all four CI jobs and
offline container run 37128147143: 365 portal tests passed, with one native
Windows skip in Linux. The native Windows job also passed. Downloaded results
matched the commit and the PNG preview screenshot was inspected. See
WVD-GOOGLE-DELIVERABLE-DEVELOPMENT.md for exact remaining live bindings.

## Portal brand and keyboard access — 3 October 2026

Reused the unchanged `src/assets/brand/horizontal-logo.png` already used by the
public site. The portal now serves that exact asset through a fixed static route,
uses navy/blue styling and provides a keyboard skip link to the main workspace.
Disabled actions use a not-allowed cursor. No external fonts or asset services
were added. The offline image copies the same asset and its workflow tracks logo
changes. Existing desktop/mobile browser coverage now checks image decoding and
keyboard navigation before the account journey. Source
`88c14a63b56587ae47cdd90c836c21802511c315` passed all four CI jobs and
offline container run 37129110542. The container asset allowlist was corrected
after its first build rejected the logo. Downloaded results match the source;
the mobile signed-out screen was visually inspected. Evidence stayed below the
existing 5 MiB cap. The public-site palette is unchanged.

Historical status at the 3 October brand slice (superseded by the verified
4 October keyless-access result below): live Google access was unactivated.
Google's deployment-pipeline federation
guide lists enabled project billing as a prerequisite, while IAM pricing describes
Workload Identity Federation itself as no additional cost. At that earlier checkpoint the development project
was on Spark with billing disabled; the founder subsequently activated billing.
Continue independent development without claiming an app credential connection.

### Controller recovery — 4 October 2026

Founder transferred Controller execution to the working chat after the previous
chat's unrecoverable stream error. `WVD-CONTROLLER-RECOVERY.md` records the recovered
baseline, unknown uncommitted state and reconciled intended Google account/provider.
The new read-only Cloud Shell discovery reports actual IAM/API/billing setup before
any activation or duplicate creation. Prior PR #3 CI and offline container checks
passed; live access remains unverified. Continue independent work within the brief.


### Live Calendar adapter contract — 4 October 2026

Reused the existing portal `google-calendar-evidence.mjs` reader and extracted
preflight's bounded JSON transport rather than adding another SDK or credential
system. The keyless workflow now follows its access preflight with a live,
read-only provider-contract check through the portal adapter. Explicit calendar
IDs, one-hour window, 15-second timeout, 64 KiB response cap, no redirects/retries
and static results preserve its scope. Tokens and busy intervals are never logged.
The contract fixture uses clearly synthetic holiday evidence only to exercise
adaptation; no slot screening runs and output explicitly says bookingReady=false.
The complete founder conflict-calendar set and authoritative holiday policy are
still required before real slots can be offered. No event creation, Meet, customer
intake, hosting or production deployment is activated. Fourteen focused checks
passed locally; exact-source CI, live contract and offline container verification
are required before declaring this slice verified.


Verified source: `cfb67ada8139dd90154ece1aa0100b96f9604dbb`.
Live Google adapter check: https://github.com/aquaviator/wvd/actions/runs/37198247121.
All four native/build CI jobs passed in run 37198247105, including Windows.
Offline container run 37198247106 passed. Downloaded results match the exact
source, Node 22.23.3/Playwright 1.62.1, isolated `demo-wvd-portal` and liveAccess=false.
The mobile pinned-image review screenshot was inspected; preview, Owner approval
and feedback controls remain readable within the viewport. Local portal suite:
373 passed, zero failed, one Windows-only skip. Live credentials were present only
in the separate read-only Google workflow, never in the offline container.

Next booking integration prerequisites: the full explicit founder conflict-calendar
set, authoritative England/Wales holiday coverage and freshness/buffer policies,
and reservation/Meet/delivery permissions. Current successful access establishes
only the named WVD calendar, so it cannot establish whole-founder availability.
Independent portal and notification development remains available within the brief.


Dependency review refreshed on 4 October: current Firebase direct packages are
already the latest releases. Audits remain eleven overall chain entries and
two moderate runtime entries; no supported direct upgrade or braces patch was
available. See WVD-PORTAL-DEPENDENCY-REVIEW.md. No pins or lockfiles changed.

Founder selected WVD and personal calendars for conflict prevention on 4 October.
Do not offer slots using only the currently granted named WVD calendar. Connected-account calendar inventories identify the WVD primary and personal
primary calendars, plus two additional personal-account diaries. Confirm inclusion
of those diaries and service-account free/busy grants;
calendar labels or owner profile alone do not establish the complete conflict set.


### Expanded conflict-calendar access check — 4 October 2026

Founder reported the personal and WVD primary sharing steps completed. The
development binding now checks the named WVD calendar, WVD primary and personal
primary together. Missing or denied evidence from any required calendar blocks
the combined preflight. Tests cover a single omitted/denied required calendar
and diagnostics contain opaque target ordinals only, never event data.

Live run 37199371099 authenticated successfully and reported named WVD calendar
PASS, personal primary PASS, WVD primary TARGET_NOT_FOUND_OR_NOT_SHARED. Founder
was asked to repeat the free/busy grant on the WVD primary calendar. Do not remove
that required calendar or declare the combined grant set verified to bypass it.
Nine focused checks passed locally; native/container runs for the diagnostic
source remain pending at this checkpoint. Production booking remains disabled.


### Combined calendar access verified — 4 October 2026

After the founder shared the WVD primary calendar, rerun 37199371099 passed
keyless authentication, Drive preflight, all three required calendars and the
portal's live Calendar adapter contract. The previously missing primary grant
is resolved. Source `38db88ae53bab3d0ea6571696a07100d2159be90` also passed all
four CI jobs (37199371147) and the offline container (37199371078). Downloaded
container results match that source, isolated demo project and liveAccess=false;
the mobile Member-approval-denied screenshot was inspected.

The verified conflict set is named WVD, WVD primary and personal primary. Busy
personal work commitments can now be read by the development integration; no
event titles or private details were requested. This resolves read-access only.
Holiday coverage/freshness and buffer-boundary policy, concurrency-safe booking,
Meet creation, delivery and hosted application composition remain unfinished.
There is still no live booking endpoint or production booking acceptance.


### Authoritative holiday evidence development — 4 October 2026

Founder selected between-appointments conflict buffers: 09:00 first call and
17:30 last 30-minute call, with the established 15-minute gap around commitments.
GOV.UK's published bank-holiday JSON feed is the authoritative England/Wales
data source. The new fixed-endpoint reader projects dates only, bounds time and
body size, rejects invalid/missing regional data, and keeps coverage within the
feed's published first/last dates rather than extending boundary years. It never
falls back to an empty holiday list. No new service subscription was introduced.

The shared screening path can explicitly require holiday evidence freshness; it
checks source/observation before Calendar reads and again after provider latency.
The HTTP availability boundary accepts a trusted dynamic holiday reader inside
its existing admission limit; clients cannot replace the feed or policy. Static
synthetic composition remains supported for offline emulator tests. Empty or
invalid candidates do not initiate a holiday read. Shared bounded JSON response
reading is reused by both Google preflight and the public holiday adapter.

The keyless Calendar integration check now uses the real official holiday feed
instead of a synthetic holiday fixture. This remains a provider-contract check,
with bookingReady=false: no reservation, event, Meet or hosted endpoint exists.
Explicit evidence-age settings are still required in a future live composition.
Focused synthetic checks passed locally; exact-source CI/container and live
provider checks must pass before this source is declared verified.


### Booking event provider contract — 4 October 2026

Prepared a trusted-server Google Calendar event writer using the existing fixed
Google Auth client pattern and no additional dependencies. Product/calendar/
reservation bindings yield a deterministic event ID; a private opaque 30-minute
event requests a unique Meet conference. Exact retries read the same event.
Ambiguous insert errors and same-reservation races recover the deterministic
event instead of issuing a blind retry or overwriting foreign/changed events.
Meet pending/failure and untrusted URLs cannot become ready confirmations.
No attendees or invitations are emitted by this adapter. Eight focused tests
passed, including timeout-after-write recovery and same-reservation collision.

This adapter is not yet wired into a booking route. Different reservations still
need a durable atomic slot lock and final complete-calendar conflict recheck;
provider event-ID uniqueness is not a slot reservation. No live Calendar write
was run, and the existing workflow token still has free/busy scope only. Live
event/Meet verification needs event-write scope and a writer grant on the named
WVD calendar, preserving free/busy-only access to personal/primary calendars.
Google's Events.insert documentation says service accounts need domain-wide
delegation to populate attendee lists. Customer invitations/delivery therefore
need a separately approved Workspace user authorisation/delivery composition;
this adapter must not claim invitations from an internal event/Meet result.
Source reference: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert


### Verified holiday/event adapter sources — 4 October 2026

Holiday source `efb4b0690a838402dbaf51c5f016f845198ee149` passed live GOV.UK
and Calendar contract run 37200297128, all four CI jobs in run 37200297127
and offline container run 37200297121. Downloaded results matched the source;
the mobile Owner pinned-image screenshot was inspected. Local portal tests:
379 passed, zero failed, one Windows-only skip.

Event adapter source `8ccbb56135ad9420cc9e29eb99d43432275c5d23` passed all four
CI jobs in run 37200579617 and offline container run 37200579584. Downloaded
results matched that source and the mobile Member approval-denied screenshot
was inspected. Synthetic event tests cover eight meaningful failure/retry/
isolation cases; live event/Meet writes remain unverified. All container evidence
is isolated demo data and liveAccess=false.

Next live prerequisite is a writer grant (Make changes to events) for the existing
service account on the named WVD calendar only. Do not widen personal/primary
calendar grants. Event-write OAuth scope and any bounded live rehearsal must
be explicitly composed after that prerequisite; the existing Google access
workflow remains read-only. Durable slot locking/final recheck, Workspace
invitation authorisation, delivery, rescheduling/cancellation and hosted runtime
remain unimplemented. No real events, invitations or production endpoints were
created by these development changes.

### Writer grant verified; live Meet blocked — 4 October 2026

Writer source c36df9ee62f59fcb1bd636c296e3da1f95abc9a6 passed keyless live
access 37201352001, CI 37201352020/37201354769 and offline container37201352144.
Grant was WRITER_VERIFIED and tagged CalendarList cleanup REMOVED. All three
selected free/busy calendars and the official holiday adapter passed again.

Bounded rehearsal source 6bd87fa9e4237f81731ddca3b122f0885229e786 passed
14 focused tests before live writes in 37201986418. Google returned HTTP400,
CONFERENCE_TYPE_NOT_SUPPORTED for the Meet event request. Cleanup found ABSENT;
no synthetic event remained and no attendees/invitations were emitted.
Ordinary non-conference insertion is still unverified. This is a provider
configuration/identity blocker, not a missing writer ACL or a production booking.

See WVD-BOOKING-IDENTITY-DECISION.md for the concrete pending choice and required
access changes. Workspace delegation and IAM Token Creator are NOT enabled by
this slice. No keys, production release or new external spend were introduced.
The local execution environment disconnected during this slice; repository
connector commits and Actions remain usable. Exact-source container/CI results
must be reconciled before complete handover; current screenshot inspection is
not claimed. Existing scratch changes match the earlier writer-probe source;
fetch/compare them before any reset when local execution reconnects.

### Exact-source automated verification reconciled

Source 6bd87fa9e4237f81731ddca3b122f0885229e786 passed all jobs in CI
37201986425/37201988858 and offline container37201986430. Logs report398
unit tests passed,0failed,1Windows-only skip;2Firebase browser tests passed.
Results JSON sourceCommit matches exactly, projectId=demo-wvd-portal and
liveAccess=false. Image identity:
sha256:692148892952dec7d94c8d3bdca395546b56027536ad8f79071f93ff5c5781f1.
Synthetic evidence artifact11303700318 was uploaded and listed, digest:
sha256:3f769abd394f316cc5a61fc3e50da569d5c75563032a6047449f57d78aec4782.
Artifact screenshots have NOT been downloaded/visually inspected in this
disconnected local runtime. Do not label the visual handover complete.
Live Calendar run37201986418 remains blocked specifically at conference
creation; the existing writer/free-busy/holiday checks and14rehearsal contract
tests passed. No delegation change has been applied.

### Approved Workspace organiser — 4 October 2026

Founder approved admin@wearvalleydigital.com with Workspace delegation. The
workflow uses a fixed event-token subject; free/busy and CalendarList remain
non-delegated. Prepared enable-booking-delegation.sh reuses the existing
bootstrap binding/trust pattern, verifies project/provider identity and returns
the OAuth client ID; it limits Token Creator to this service account and restricts
federation to the exact approved workflow. The founder must execute the Cloud
Shell script and authorise only calendar.events in Workspace Admin because this
connection has repository access but no Google administrator mutation capability.
19 focused tests passed locally; bash syntax check passed. No Google IAM or
Workspace grant was applied by this commit and live delegated auth remains
unverified. Local execution is reconnected; historical local changes were
compared against their original committed source before checkout reconciliation.

### Delegated event and Meet verified — 4 October 2026

Source 31f2b7ee4cc86781981ec24a3a6f64a460b26865 passed Google development
access run37203097963 on its rerun after founder administrator grants. Non-
delegated Drive/three-calendar free-busy/GOV.UK/CalendarList checks passed.
The approved admin@wearvalleydigital.com event token authenticated keylessly;
the synthetic past event produced EVENT_AND_MEET_READY and cleanup REMOVED.
No attendees, invitations, customer bookings or production deployment occurred.
The private Meet URL was not emitted in the diagnostic output.
The workflow now verifies these prerequisites on authorised development runs;
routine tests do not require a founder login or a service-account key.

The earlier strict mapping comparison was corrected to verify required mappings
while preserving additional owner/ref/event mappings. Four synthetic setup
tests passed on Linux. Their fake executable assumes POSIX process launching;
Windows CI discovered them and failed. They are now explicitly Linux-only while
the existing native Windows integration checks remain in place. Exact-source
CI must verify this correction; it does not alter the live booking adapter.
Historical container37201986430 results and Member approval-denied screenshot
were downloaded and inspected after local execution reconnected: correct brand,
mobile layout, Owner-only approval disabled for Member.
Durable slot reservation, final conflict recheck, attendee delivery and hosted
booking composition remain unimplemented. Live Meet verification is not a
booking-system release.

### Durable reservation and recovery development — 4 October 2026

Initial reservation source6bca4974cdc68e0b0edba6efadf98d50f39a7a5b passed CI
37204222001/37204225824 and offline container37204222070, including the real
Firestore emulator's concurrent reserve/claim and journal reopen checks.
The separate private calendar schedule binds one product owner per calendar
in the supplied database; other products cannot create a parallel lock.
The established fifteen-minute gap, shared final screening and event adapter
are reused. No customer details or live Firestore bookings were written.

The follow-on recovery extension adds a read-only Google event reconciler. A
ready exact-owned event can commit the original claim after an interrupted
confirmation; absent/pending/foreign outcomes cannot release the uncertain hold
or create a second event. Thirteen local reservation/recovery tests passed.
Event inspection is shared with the writer, and binding field order is now
canonical. The live provider workflow runs when that shared adapter changes.
Exact-source CI/container/live results for this extension remain pending.

The server composition is internal: no public booking endpoint, attendees or
delivery, hosted runtime, reservation backup/retention or cancellation UI is
claimed. Each calendar needs one authoritative database/writer. External calendar
edits can race a free/busy check because Google and Firestore are separate systems.
See WVD-BOOKING-RESERVATIONS.md for the contract and remaining production work.

### Verified reservation/recovery slice — 4 October 2026

Exact sourcec62f1686d4cf9e21fba6dde8db12e1a8646ca7b0 passed all CI jobs in
37204456656/37204460527, including native Windows. Offline container37204456694
passed411unit tests with0failures and1Windows-only skip, plus3real emulator/
browser tests. The Firestore test proved competing reserve/claim transactions,
durable confirmation after reopening, and foreign schedule ownership denial.

Downloaded artifact11304361592 results.json matches the exact source and uses
demo-wvd-portal with liveAccess=false. Image identity:
sha256:ef6c20ee2390e4bde3a82d78ca4a9ed7dd7c1482dea0e6d21f42deb922c5f34f.
Artifact digest:
sha256:1958662479861833d0c18273728f1aaea67ef2d55faab4586ade83026e2679da.
The mobile Owner milestone-approved screenshot was inspected: original WVD
brand, readable approved review/history/feedback and scoped project controls.

Live keyless Google run37204456652 also passed: event/Meet READY, cleanup REMOVED,
no attendees or invitations. This live probe tested the refactored shared event
writer, not live Firestore reservation writes. No production endpoint or customer
booking is claimed. Next product work is the public booking request/pending/
confirmation UX and bounded server boundary, followed by delivery and hosting
acceptance. Reservation backup/retention and safe cancellation remain open.


### Customer booking and cancellation UX verified — 4 October 2026

Source 63158264fdca3b6d7d67e1fa0cba45e4c55195f6 adds the branded isolated
booking page, private retry capability HTTP boundary, pending reload recovery,
conflict/confirmed states and explicit customer cancellation confirmation.
Conditional event deletion verifies ownership and ETag, then provider absence.
The durable CANCELLING hold is released only after CANCELLED commits.
Cross-product and changed reservation bindings cannot mutate a cancellation.
No invitation delivery, customer contact collection or production route is enabled.

CI37206816671 and PR37206818911 passed all applicable jobs. Offline container
37206816643 passed 431 unit checks, zero failures, one Windows-only skip, and
four real emulator/browser tests. The mobile/desktop selection, pending,
confirmation, unavailable and cancelled screenshots were inspected. The new
browser test also simulates a lost response after creation and cancellation
outage/reload without duplicate inserts or premature slot release.
Image sha256:a4cd01f9eb510940c72f8415b488f7926236120c8ccc8c7e97e92bd5e41915ae.
Artifact11304881473 digest
sha256:0204396d90e1a6875537d826a9e746b2571fa22edcc6574f4a48a491dc11a749.
Evidence remains capped at5MiB; optional video omissions are explicit and required
screenshots/receipts cannot be silently dropped.

The earlier cancellation source d0acdd62a0d72f2a9ca74266805f3bde33d3c6a2 also
passed CI/container and Google access37206450337, including live event/Meet
creation and cleanup. This was the existing no-attendee rehearsal, not a live
customer cancellation or notification test.

Next booking work: journal backup/recovery, customer management/confirmation
delivery and rescheduling, then reviewed hosted admission/runtime integration.
Production approval and new-spend approval remain separate.

### Shared creative-content rule — founder instruction, 4 October 2026

Founder requires feature visual, short contextual video (HyperFrames) and complete
text for creative content across all web-facing projects, and a relevant CTA on
every page. Recorded in WVD-WEB-CONTENT-STANDARD.md, AGENTS.md and development
standard1.3.0. New factory plans inherit the versioned rule. Captions/transcripts,
consistent checked sources, genuine review dates, accessible media and truthful
public discovery metadata are part of it; infographics are optional where useful.
This record does not claim existing articles have completed reels or guarantee
AI indexing. Founder asked to record the rule and resume booking development;
article/media retrofit is tracked future work, not the immediate booking task.


### Booking journal backup and recovery verified — 4 October 2026

Runtime source fdb98134d72d5e32207bbc7c8779ce6960495304 adds explicit-bound,
private journal export, integrity and ownership validation, and isolated real
Firestore emulator restoration. Every journal phase and uncertain hold survives;
rehearsal does not mutate the source or contact Calendar. Live restore is refused.

Push CI 37207747826 and PR CI 37207750830 passed. Offline container 37207747852
passed 437 unit tests (zero failures, one Windows-only skip) and all four real
emulator/browser tests. Downloaded artifact 11305228193 matches the exact source,
uses demo-wvd-portal and records liveAccess=false. Artifact digest:
sha256:d89fb4ef3ebdc1430246f347a50e2871ecfafa1595a8b2953d0c1e4a73de5767.
Image sha256:2e7c45814d2f148c672fa76c9551c05e0c41e6ea5b45c96252cfbc418323b517.
Mobile cancellation evidence inspected; required screenshots and receipts remain
within the 5 MiB cap, with one supplementary video omission explicitly recorded.

See WVD-BOOKING-BACKUP.md for scope and recovery limits. Remaining booking work:
customer management/confirmation delivery and rescheduling, reviewed hosted
admission/runtime integration, and operational encrypted backup/retention and
provider reconciliation. No production deployment or new spend was performed.
The shared creative-content standard is recorded; article/video retrofit remains
separate future work. These test results apply to the runtime source above.


### Booking rescheduling — 4 October 2026

The development flow now supports changing an existing booking while preserving
its Calendar event and Meet link. A revision-bound journal operation holds both
old and target times; only one worker claims a conditional Calendar PATCH.
Uncertain results retain both holds and use read-only recovery. Cancellation and
competing changes cannot race an unresolved move. Exact-event screening excludes
only the original owned event and retains other busy events, personal work days,
all-day blockers and existing notice/hours/holiday/buffer checks.

The optional private POST boundary validates both random capabilities, original
and target time, revision, origin, admission and body size. The branded emulator
preview adds Change booking time, Keep current time, Confirm new time and Check
new time status. A lost response after a successful move survives reload without
another PATCH. Cancellation after moving uses the new time. A retained current
booking is not cancelled to attempt a replacement. There is no production route,
customer email or cross-device management link in this development slice.

Initial runtime source 5f0bc41c9d8772aaa54a96af6462486208e746b0 passed push CI
37209409389, PR CI 37209411446 and offline container 37209409399. The container
passed 459 unit tests (zero failures, one Windows-only skip) and four real
Firebase/browser tests. Its downloaded artifact 11306095541 matched the source
and recorded liveAccess=false; rescheduled and interrupted-change mobile
screenshots were inspected. A subsequent CSS-only change adds management-control
spacing; its final evidence is recorded below after verification.

Earlier source 361a06e0e3439f277a090081b458f04f2e46d381 passed the existing live
Google access rehearsal 37208745015. That checked event/Meet creation and cleanup,
not live rescheduling, attendee delivery or live event-list screening.

Remaining: live listing/move acceptance, exclusion-aware availability discovery
in the picker, cross-device customer management and confirmation delivery,
reviewed hosted admission/runtime integration, and operational backup/retention.
The picker can conservatively omit times overlapping the original booking; the
bound change screening supports exact self-exclusion. Production and new-spend
approvals remain separate. See WVD-BOOKING-RESCHEDULING.md for the full contract.


Final runtime source 5a5f198bce0ade922a5e9642411ae5ca2977678f passed push CI
37209707694, PR CI 37209710561 and offline container 37209707711. Results remain
459 unit passes, zero failures, one Windows-only skip and four real emulator/
browser passes. Downloaded artifact 11306585336 matches the source and records
liveAccess=false. Artifact digest:
sha256:c56eed257db5e677391243d666a99f5510bd22db84ba6e9ee761dd061ff03b07.
Container image:
sha256:c35d14750c41009fe73c1f26cde99e0a63a61ce10c3ddde282c4262b80ec4365.
The final mobile rescheduled screenshot was inspected: original WVD branding,
correct confirmed UK date/time, unchanged Meet link and separated management
controls. Required screenshots/receipts were retained; one supplementary video
was explicitly omitted to retain the existing 5 MiB evidence budget.


### Cross-device booking management and confirmation preparation — 4 October 2026

Added optional isolated management-link issuance, current-state reads, cancellation,
rescheduling and pending-operation recovery. Issuance uses the original private
booking capability plus a client-generated 256-bit secret retained before the
request. The journal stores only its product/calendar/origin/reservation-bound
digest and explicit expiry. Exact issuance replay does not extend expiry or
replace another link. Raw secrets never enter journal backups.

A customer can open the private fragment link in a separate browser context,
read the latest booking, move it while preserving Meet, reload an interrupted
move without another PATCH, and cancel at the current time. The page removes
the fragment from its visible URL and uses private tab storage. Server request
URLs do not contain the capability. An authenticated pending operation can be
recovered without the original tab's change key. Expired/foreign/unknown links
are denied; reads expose no internal IDs or digests. Cancellation now checks
its expected time and revision inside the transaction, closing a read/write race.

Plain-text confirmation preparation reuses the shared email shape validator and
reads current confirmed managed state. Its output includes UK date/time, Meet,
private management link, expiry and booking revision. It explicitly marks
sent=false and recipientVerified=false. This is journal-based draft preparation,
not Calendar refresh, actual delivery, an outbox receipt or recipient verification.
No email was sent and no additional Google scopes were granted. The existing
Calendar-only delegation remains unchanged.

Initial source 7e4a390d539a1f2c3e906b8eea17e3fe12113ae2 passed push CI
37210992427, PR CI 37210995550 and offline container 37210992434: 472 unit
passes, zero failures, one Windows-only skip and four real Firebase/browser
passes. Downloaded artifact 11306772251 matched the exact source and recorded
liveAccess=false. Screenshots were inspected. A subsequent UI fix keeps the
recovered cancellation date accurate and hides the closed management form;
its final verification is recorded below.

Remaining: version-bound durable delivery intents and sender/recipient acceptance,
management-link renewal/revocation and production lifetime policy, live Calendar
listing/move acceptance, hosted admission/runtime, backup retention/reconciliation.
No production route or customer message is enabled. See WVD-BOOKING-MANAGEMENT.md.


Final runtime source 5cfa37f486d7630a860521c1ef23e680c405c734 passed push CI
37211309341, PR CI 37211312281 and offline container 37211309321. The container
passed 472 unit tests, zero failures and one Windows-only skip, plus four real
Firebase/browser tests. Downloaded artifact 11306821745 matches the exact source
and records liveAccess=false. Artifact digest:
sha256:e856ce33b6e619f7026b0c34c04401bfa2527c5bbea2b75efe85cc1c7cbf6067.
Container image:
sha256:02f3e3aa9b9171f0f7cfaf9a66b8912eba40f16381c33d1e04705e72aeb1d7d8.
The final cancelled management screenshot was inspected: the closed form and Meet
link are hidden, with clear cancelled status and the contact CTA. Cross-device
management, interrupted rescheduling/reload and cancellation at the changed time
passed in the real browser/emulator scenario. Required receipts and screenshots
were retained; one supplementary video omission is explicit within the 5 MiB cap.


## Controller authority correction — 4 October 2026

Founder explicitly narrowed stops to user-supplied data, elevated admin/configuration
approval and extra money. Persisted in AGENTS.md and WVD-PROJECT-AUTHORITY.md;
WVD override added to the shared development standard. Older blanket WVD production
approval and generic decision gates are superseded. Automated engineering checks
continue without founder review. Next active work: booking management recovery UX
when another device changes the booking or a private link expires mid-action.

### Development continued under corrected authority

- Source 3353879b917ae3df44a91f218696bb2ab7fe9df0 persists the authority override
  and adds stale-device refresh and explicit expired-link help. Push and PR build
  runs 37218806559 / 37218808235 passed; isolated container results pending at
  this checkpoint.
- Continued immediately into private management replacement-slot availability:
  batched exact-event exclusion, revision checks around the read, bounded optional
  HTTP route and picker wiring. Reuses the existing Google screening contract.
- Focused checks: 47 passing across management HTTP, transactional booking and
  Google rescheduling evidence. Browser coverage now exercises a stale device,
  read-only refresh, expired-link response and the composed availability route.
- No live customer messages, new scopes, elevated configuration or extra spend.

### Factory memory propagation

The standard is now 1.3.1. WVD project plans carry the explicit three-trigger
founder authority and remove the blanket production-approval flag. Other product
constitutions/defaults remain intact, and isolated test runners gain no live
permissions. The override participates in the standard hash and is copied into
WVD plans so a subsequent controller receives it in machine-readable form too.
All 17 focused factory-standard checks passed.

Booking picker source: df3e79ff5c7ee047dfbe2e11232ca756cd1c1145. Build runs
37219022902 and 37219025096 passed. The preceding stale-device recovery source
3353879b917ae3df44a91f218696bb2ab7fe9df0 also passed isolated container run
37218806565, including the browser scenarios for stale cancellation, read-only
refresh and expired-link help. No production deployment or actual email delivery
is claimed by these results.

## Continued controller development — confirmation queue

Implemented version-bound encrypted confirmation intents within the booking
transaction, one send claim across workers, stale-message suppression and durable
provider acceptance receipts. Unknown sends are never automatically retried.
The trusted dispatcher reuses current management preparation and exact Calendar
inspection before claiming; no provider operation runs inside a transaction.
Real AES-GCM tests cover context binding/corruption; booking tests cover reopen,
concurrent dispatch, stale cancellation, response/receipt failure and no resend.
The real emulator scenario now retains an uncertain encrypted delivery through
backup/restore alongside an uncertain booking move. See WVD-BOOKING-DELIVERY.md.
Next work proceeds directly into management-link replacement/revocation and live
runtime composition. No actual sender, live email or new permission is enabled.

### Private link lifecycle

Continued without a founder gate: transactional replacement and revocation,
optional bounded HTTP routes and explicit customer controls. Replacement/revocation
recovery details are saved before mutation; lost responses can retry after reload.
The previous token is valid only for exact replacement-response recovery, never
for reading or changing the booking. Revocation keeps the booking in place.
Stale encrypted confirmation intents are suppressed after either change.
Focused booking/HTTP/application checks: 48 passing. Real browser scenarios now
exercise interrupted replacement and revocation, and emulator backup preserves
replacement/revocation metadata and a claimed encrypted delivery intent.
Next active work: compose the live booking runtime from these existing adapters.

### Standalone runtime and unattended authentication

Composed the existing booking modules into a standalone HTTP runtime; preview
portal restrictions remain intact. Added shared Firestore admission for every
public booking route, fixed-purpose Google list/freebusy clients, keyless IAM
signing/OAuth refresh and a non-root hosting package with explicit candidate
configuration. Synthetic HTTP coverage books, self-overlap reschedules and cancels
while preserving personal-work-day blocking. Auth coverage checks concurrent
refresh, scope separation, target denial and no request replay. The real emulator
scenario checks admission across workers in addition to lifecycle/queue durability.

Read-only runtime permission/database discovery is now part of the existing
Google access workflow; it grants no permissions and makes no hosting changes.
The prepared self-signing admin script is not executed. The runtime contains no
customer email sender or new Workspace scope. See WVD-BOOKING-RUNTIME.md.

Fixed an existing factory cache test's undersized fixture budget after the fuller
1.3.1 standard was added. Only that product-plan fixture has a 16 KiB allocation;
runtime budgets and refusal to truncate remain unchanged. All 14 cache/factory
checks pass locally. Earlier source 469f302 and b2c382 passed their isolated booking
containers, but their general CI exposed this fixture failure; the fix is included
with the runtime source, not hidden as a successful earlier general CI result.

### Exact runtime result and genuine activation boundary

Runtime source 820c7210d67f41ce99be2538a9fe8e8addf8e64c passed push CI
37222217810, PR CI 37222219944 and isolated container 37222217830.
The container built the standalone production package and confirmed it refuses
startup without an attached runtime identity. It passed 489 unit tests, zero
failures, one Windows-only skip, and four real Firebase/browser tests.
Artifact 11309809869 matched the source and liveAccess=false; digest:
sha256:95f2fca8e63545bb51af6b34d62fe6920ce82bde801ac65984ef44ce7da9d679.
Isolated image: sha256:a8af8b056f847e66517f014852908350b3cb8a56df37d03cde28555a311c4d89.
The mobile management screenshot was inspected with original WVD branding,
change/cancel controls, link-security controls and the contact CTA. A subsequent
CSS-only adjustment spaces the adjacent security buttons and bounds the replacement
URL input; it does not change booking behaviour.

Read-only Google workflow 37222217821 succeeded and established the actual gap:
Firestore `(default)` is accessible/native in `eur3`; runtime self-signing and
Cloud Run deployment permissions both report ADMIN_GRANT_REQUIRED. The prepared
`tools/booking-runtime/enable-runtime-access.sh` grants the two account-scoped
roles plus Cloud Run Developer on the existing project. It has not run and does
not enable APIs, create hosting, change billing or send messages. Hosting usage
still needs an explicit extra-spend allowance before resources are activated.
This is a genuine elevated-access/spending boundary, not a request to approve a
completed development slice. After those inputs, continue activation and the
remaining sender/contact, abuse-control, operator recovery and retention work.


## 5 October: Sites workflow, hosting authority and guide UX

Founder applied all three runtime IAM grants and authorised £5/month total
additional hosting spending. Project authority is current; earlier £0/access
blocker entries above are historical. No paid runtime has been activated.

Using Sites guidance on the existing Astro frontend, removed duplicate guide
cards and added keyboard-accessible section navigation to all four buyer guides.
Preserved existing brand, copy, dates and CTAs. Video/visual retrofit remains
explicitly incomplete; no fictional assets or freshness claims were introduced.

Expanded read-only runtime discovery to check iam.serviceAccounts.actAs as well
as signing and deployment. A negative test proves that signing/deployment access
does not mask missing attachment authority. Both focused tests passed locally.
The source change triggers the existing keyless Google workflow for live evidence.

Cost discovery: Cloud Run is usage-priced after shared billing-account free tier;
budget notifications do not impose a hard cap. Source checks 5 October 2026:
https://cloud.google.com/run/pricing and
https://cloud.google.com/billing/docs/how-to/budgets. The £5 authority is recorded,
not represented as a configured provider cap. No paid service was created.


### Sites handback completed — 5 October 2026

Private Site: https://wear-valley-digital-development.leatfield.chatgpt.site
Site identity: appgprj_6ac361a8bfd48191b3bde453565cf2ab
Sites source: a07157c33c4ea8f1493312028704f935118da255
Deployment: appgdep_6ac3620754748191b3542b61cc56c3a2 (succeeded).
Controller source: 4a193dd2f24461722d95f33c17e69e7af9bfcb4a.

The existing Astro frontend was copied with its original source, brand assets,
content and lockfile into the private Sites source repository and rebuilt there.
All 25 routes built. No public domain change, backend port, new Google host or
live booking connection is implied. Sites owns this private frontend checkout;
controller GitHub owns backend and integration work. Before subsequent frontend
edits, open this exact Site through the Sites workflow and reconcile changed
source back into GitHub; do not edit both copies independently or overwrite a
newer Site version with an old controller copy. Preserve the Google canonical
URLs for the eventual public domain. Do not put backend secrets into the Site.

Push CI 37284636207 and PR CI 37284642129 passed. Google workflow 37284636147
passed, with all four runtime probes PASS and overall ACCESS_PRESENT, including
signing, attachment, native Firestore and Cloud Run deployment permission.
The isolated development container was still running at this handback checkpoint.

### Hosting continuation

Container 37284636202 completed successfully after the preceding handback.
Added bounded read-only London inventory discovery with negative tests for
incomplete lists and cross-project results. Both focused tests pass.
Live Google run 37285436943 succeeded and reports registry/service inventory
ACCESS_DENIED_OR_API_DISABLED, with no project-wide registry create/upload or
service IAM policy authority. No resources or permissions changed in that run.
Prepared tools/booking-runtime/enable-image-repository.sh for the narrow required
founder/admin API and repository setup; bash syntax check passed. This script
has not been executed. See WVD-BOOKING-RUNTIME.md for exact scope and limitations.

## Private booking runtime deployed — 5 October 2026

Founder supplied IMAGE_REPOSITORY_READY_NO_SERVICE_DEPLOYED after enabling APIs,
creating the empty private Docker repository and granting its scoped Writer role.
Source 1812c0a7c1b13cd83bb74b46a5076952a2f60d75 then passed live Google workflow
37286620142, including exact repository access/configuration checks and creation.
Service: projects/wvd-development/locations/europe-west2/services/wvd-booking-development.
Image digest: sha256:82b3020bdb98e789c72e4be0823a09dd733ecd3c3cca099548d4cce0b94baebe.
Result: PRIVATE_RUNTIME_READY. Managed startup /health succeeded; ingress is
internal-only, IAM invocation checks remain enabled, zero minimum and one maximum
instance. First image passed the 400 MiB uncompressed limit. No customer booking,
email or public IAM grant occurred. The £5/month authority now covers an actual
private Google runtime/image, not merely a prepared deployment.

Six focused deployment/discovery tests and six composed runtime/auth tests passed
locally. Push CI 37286620219 and PR CI 37286625344 passed. Container 37286619953
failed because its file allowlist omitted the new pure deployment module imported
by the test. The Dockerfile now includes that module; the container remains
offline and receives no credentials. A new run must verify this packaging fix.

Next integration work: verify the attached runtime's actual Calendar read path;
provide an authenticated/private end-to-end test path; implement explicit origin
routing between the website and booking UI; complete admission/abuse controls
before public invocation; configure approved delivery/key storage and retention.
The static private Sites frontend remains separate. Do not add public invocation
or claim a complete customer booking journey from startup readiness. Subsequent
runtime updates need a revision-aware deployment path; first-creation automation
intentionally skips existing services, including after uncertain responses.


Final packaging-fix source ab47a992cfba467f6e2745f92edce0297b52c640 passed
push CI 37286922121, PR CI 37286930018 and offline container 37286922146.
Container results: 496 unit passes, zero failures, one Windows-only skip, plus
four real Firebase/browser passes. This verifies the offline packaging fix;
the deployed runtime remains image-bound to source 1812c0a above.
