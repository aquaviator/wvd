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
- Scoped project views, Owner-only version approval, feedback, tickets and replies.
- Shared domain with local SQLite and bounded transactional Firestore adapters.
- Firebase server token checks and trusted revision-checked access provisioning.
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
production persistence and migration acceptance, colleague/admin workflows,
external deliverable/version binding, notification delivery, Calendar/Meet
integration, hosting/TLS, monitoring, retention and backup/restore rehearsal.
Dependency remediation and independent integrated release review remain open.
The Firestore aggregate and local authentication are development proofs; passing
emulator tests does not establish production readiness.

## Access dependencies

Scoped Google access is founder-approved but the runtime credential connection
is unactivated. Project ownership and billing-disabled status were verified by
founder CLI output. Do not require the founder's laptop for independent emulator,
domain, UI or container work. Live connection, hosting cost or production release
steps must wait for their actual access/approval prerequisites; do not invent
credentials, enable billing or mutate another product to bypass them.

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
