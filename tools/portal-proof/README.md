# WVD portal development foundation

Build from the approved WVD brief using the existing Google/Firebase platform.
Reuse the shared domain, storage adapters and service connections; do not add a
provider or subscription as a shortcut. Local authentication and SQLite are
explicit development options, not replacements for the selected Google platform.
Supabase/Postgres material is an archived candidate, not the selected runtime.
Development pushes are authorised. Production deployment and new external spend
still need separate founder approval.

## Run and inspect

Use Node 22.16 or later:

```sh
npm ci --prefix tools/portal-proof
npm --prefix tools/portal-proof test
npm --prefix tools/portal-proof run dev:firebase
```

The Firebase demo requires Java 21 on PATH and runs isolated Auth/Firestore
emulators under `demo-wvd-portal`, with the browser on loopback port 4703. Use only
the synthetic account documented in [FIREBASE.md](FIREBASE.md). It has no live
mode or fallback credentials. Tokens stay in browser memory and sign-out clears
private views and unsent support drafts.

Prefer the unattended [development container](../development-container/README.md)
for reproducible unit, real-emulator and browser verification without the founder's
laptop. Inspect source-bound results, image identity and synthetic screenshots.
Native Windows checks remain separate. The local disk/auth proof and its limits
are described in [SELF-HOSTING.md](SELF-HOSTING.md).

## Current workflows and access

| Workflow | Client Owner | Client Member | WVD admin role |
| --- | --- | --- | --- |
| View progress, review text and histories | Granted projects | Granted projects | All WVD projects |
| Save feedback, create/read/reply to support tickets | Granted projects | Granted projects | All WVD projects |
| Approve an exact review version | Granted projects | Denied | No approval permission from admin status |
| View grouped client/project activity | Denied | Denied | Allowed |
| Inspect client accounts and change existing project grants | Denied | Denied | Allowed; roles and activation remain unchanged |
| Change an existing Member’s access to a selected project | Granted projects only | Denied | Requires separate client Owner membership |
| Issue, inspect and revoke own Member invitations in the emulator | Granted projects only | Denied | Requires separate client Owner membership |
| Update project stage and next step | Denied | Denied | Allowed |
| Publish immutable review text to an existing milestone | Denied | Denied | Allowed |
| Create a milestone with its first review | Denied | Denied | Allowed |
| Create a project for an existing client | Denied | Denied | Allowed; client grants stay unchanged |
| Create a new client and first project | Denied | Denied | Allowed; no account permissions are created |
| Assess ticket priority and agreed Care scope | Denied | Denied | Allowed; assessment is retained for clients |

Every operation checks current active identity and project scope. Firebase
verification supplies the UID; request/token role flags confer no permissions.
Owner membership supplies client approval authority. Server-computed page
capabilities control presentation, while writes independently recheck access.
Client creation, account inspection, existing project grant editing and scoped
Member invitations have working emulator interfaces. Invitation acceptance uses
a separate verified Firebase identity proof before product provisioning; normal
portal requests still require active product membership. Synthetic registration
and email verification grant no project permissions by themselves. Production
onboarding, invitation delivery, business-wide colleague removal, broader Owner
delegation and operational support policy remain unfinished.

Approval receipts bind actor, business, project, milestone, exact immutable
version/digest and server time. Review and feedback histories survive later
versions and persistence reopen. Legacy approvals explicitly lack review text.
A new version awaits fresh Owner approval; publishing does not approve for the
client. Progress edits retain scoped actor/time/text history and reject stale
value digests. Creation commits a milestone and its first review together, and
exact retries cannot overwrite existing rows or roll back a newer version.
Internal publisher/creator and operation identifiers stay out of client review
projections. UI content is rendered as plain text.

Ticket types are question, fault and change request. WVD admins manually record
priority, agreed Care assessment and a client-visible explanation. Stale edits
are refused and assessment history is retained; ticket type does not infer
entitlement, prices or a response deadline. Transition rules and notification
recipients remain separate policy. Approval,
feedback, ticket and reply writes atomically retain payload-free notification
intent; there is no dispatcher or delivery promise. Progress/publication writes
retain history without inventing notification recipients.

## Reused implementation and bounds

- `domain.mjs` holds provider-free rules; raw actor IDs are trusted-adapter inputs,
  not an authentication mechanism.
- `boundary.mjs`, `http.mjs` and `server.mjs` require an injected verified session
  resolver, exact schemas, same-origin writes, streamed 32 KiB request bounds,
  no-store responses and sanitised errors. No default identity or bypass exists.
- `durable.mjs` reloads validated state in SQLite transactions across connections.
  `firestore.mjs` uses bounded aggregate transactions with no external effects
  inside retryable callbacks. Failure leaves neither partial data nor intent.
- `state.mjs` validates references, review digests, histories and operation
  uniqueness. The Firestore aggregate has a 512 KiB capacity; proof progress
  history and milestone creation are capped at 200 entries per project.
- Trusted Google provisioning, project-list updates and publication require explicit target bindings,
  revisions and operator context. Admin routes use current verified portal
  identity. Stored attribution is not an external tamper-proof audit service.
- `backup.mjs` verifies product/project/database/mode bindings and rehearses an
  aggregate restore in a fresh disposable SQLite database. It does not restore
  Firebase Auth, files, IAM, indexes/rules or the whole Google deployment.
- `firestore-rehearsal.mjs` checks the same backup in a disposable Firestore
  emulator namespace, preserving the original storage revision and audit history.
  It requires a demo project and loopback emulator hosts, creates a fresh target
  without overwrite, reopens through the existing adapter and deletes the test
  document before closing. It has no public route or live restore option.

## Deliverable-bound review development

Privileged review publication can attach one explicit deliverable manifest:
label, opaque source ID, exact source version, media type and SHA-256 of bytes.
`review.mjs` includes its canonical fields in the review digest. Text-only
fingerprints stay compatible. Current views and approval history retain the
manifest. Admin publication accepts only a registered catalogue ID; the server
resolves its source/version/digest. Raw browser-authored manifests remain rejected.

`deliverable.mjs` retrieves a pinned version through a separately supplied trusted
source adapter. Project access is checked before and after retrieval. Source ID,
version, media type, size and content digest must match. Capacity, provider
timeout and proof lifetime are mandatory configuration. Timed-out reads keep
their admission slot until the provider settles; the adapter must honour abort,
bound its own download and enforce its project/source catalogue.

Verified reads produce an in-process capability bound to actor, adapter instance,
project, milestone, review version and manifest. Transactional approval rejects
forged, expired, modified and cross-adapter proofs. Provider reads occur outside
retryable database callbacks. Exact approval retries reuse the saved receipt
without a provider dependency.

The optional development HTTP/browser composition displays UTF-8 text snapshots
using text content and static PNG previews using a typed data URI. PNG byte size,
chunk boundaries/checksums, noninterlaced single-image structure and dimensions
(at most 2048×2048) are checked before returning bytes. Decompression is bounded
to the exact expected pixel-row size and row filter values are checked; browser decoding must succeed
before approval becomes available. Approval re-verifies the source. It adds no active
HTML or external links. Without a source reader, approval of referenced content
stays paused. JPEG, PDF and ZIP manifests remain metadata only in this browser slice.
The browser source is synthetic and the application option requires isolated
Firebase emulators. No live Google file adapter, production endpoint, artifact
retention policy or live binary source integration is established by these tests.

`deliverable-catalogue.mjs` registers at most 200 explicit project/source/version
entries in trusted composition. Admin lists and selection are project scoped;
Owner/Member accounts cannot list or resolve this admin catalogue. Inputs and
returned manifests are copied. New milestone/review publication selects a
registered ID and rechecks authority inside the write transaction. Catalogue
metadata is not proof of source ownership, retention or provider access; actual
retrieval and content verification still gate approval.

## Booking evidence

`availability.mjs` assesses a single 30-minute call; `booking.mjs` batches that
same contract. Inputs supply complete conflict calendars, exact queried UTC
coverage, England/Wales holidays and an observation time. Notice, UK working
hours, both 15-minute conflict margins and evidence freshness are checked.
Opening/closing buffer treatment and maximum evidence age remain explicit
caller policy. Candidates are supplied, not generated by an invented slot grid.

Current read-only Calendar checks are recorded in
[WVD-CALENDAR-DEVELOPMENT.md](../../docs/WVD-CALENDAR-DEVELOPMENT.md). The earlier
README recorded a connector create/read/Meet/delete rehearsal with no external
attendees; connector access does not supply app credentials. Neither check proves
live app booking, a complete conflict-calendar set or a reservation. Calendar/
Meet credentials, final recheck, concurrency, cancellation/rescheduling and
confirmation delivery remain integration work. Holiday fixtures are synthetic.

## Production acceptance remains open

`call-http.mjs` optionally exposes `POST /api/calls/availability` around the
existing read-only screening composition. Its exact request contains only UTC
candidate starts. Calendar IDs, holiday evidence, policy and lookup capacity are
server bindings. The shared bounded JSON transport rejects oversized requests;
explicit concurrent admission prevents an unbounded provider queue. Responses
project only candidate start/end, London timezone and `provisional: true`.
They never imply a reservation. The development application enables this adapter
only when explicitly supplied in isolated Firebase emulator mode. No live
Calendar credentials, public site endpoint or holiday source is configured.

Screening uses the same timing rules for a cheap preflight before Calendar reads.
Past/short-notice, weekend, outside-hours, supplied holiday and uncovered dates
are removed before computing the query window. It repeats these timing checks
after the provider returns, so request delay cannot extend the notice boundary.
This reduces unnecessary reads; it is not a rate limiter or a reservation.

The executable development foundation is not production readiness. Outstanding
work includes live browser authentication and server credentials, colleague invitation and
verified account onboarding, external artifact/preview binding,
notification delivery, booking integration, hosting/TLS, rate limits, monitoring,
retention, dependency remediation, production recovery and independent integrated
release review. Passing emulators or a configuration template does not close
those gates. Continue independent authorised development from the brief; ask the
founder only for genuinely missing information, access or decisions.

The optional `invitation-http.mjs` adapter is enabled only in the isolated emulator
application. It uses the shared bounded JSON reader with an 8 KiB request limit.
Invitation lists show the issuing Owner’s own records for a currently authorised
project, never raw tokens, token digests, other grant lists or recipient UIDs.
Pending invitation revocation rechecks all included project permissions.

`notification-plan.mjs` prepares a read-only plan from a validated pending intent.
Approval/feedback select the explicit admin mailbox. Ticket/reply client audiences
must be explicitly bound to conversation participants or active project members;
no audience, mailbox, product namespace or portal origin is assumed. Plans retain
only eligible current product UIDs and an HTTPS workspace link, not ticket/reply
text, subject lines or review content. Google backend planning checks its product
binding before reading state. It does not resolve email addresses, send messages,
acknowledge an intent or promise delivery. The optional Google preparation adapter resolves minimal client email proof with
the reused Firebase verifier, suppresses disabled/deleted/unverified accounts,
requires an explicit lookup capacity and rechecks the current plan afterward. It
leaves intents pending and reports no send or acknowledgement. Recipient-policy
agreement, verification at the actual send boundary and a delivery/retry
mechanism remain separate gates.

`google-drive-client.mjs` adapts an explicit Google Auth client to fixed Drive v3
revision GET requests. `google-drive-deliverable.mjs` maps registered project
source versions to retained blob revisions, bounds and cancels streamed reads,
then rechecks revision metadata before the existing SHA-256/access proof checks.
See `docs/WVD-GOOGLE-DELIVERABLE-DEVELOPMENT.md` for the provider contract,
reuse decision, synthetic verification and remaining live credential/file bindings.
