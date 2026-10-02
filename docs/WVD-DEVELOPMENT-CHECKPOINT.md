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
