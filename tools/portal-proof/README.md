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
Colleague invitation/removal, client creation, an admin account UI and operational support policy are still
unfinished workflows; a permission action in the domain is not a working UI.

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

The executable development foundation is not production readiness. Outstanding
work includes live browser authentication and server credentials, colleague invitation and
verified account onboarding, external artifact/preview binding,
notification delivery, booking integration, hosting/TLS, rate limits, monitoring,
retention, dependency remediation, production recovery and independent integrated
release review. Passing emulators or a configuration template does not close
those gates. Continue independent authorised development from the brief; ask the
founder only for genuinely missing information, access or decisions.
