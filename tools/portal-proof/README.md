# WVD portal domain proof

The founder selected WVD-built self-hosted software without required vendor
subscriptions on 2 October 2026. The local authenticated application now has
an executable entry point: see [SELF-HOSTING.md](SELF-HOSTING.md). Earlier proof
notes below describe the original model and do not negate the implemented local
auth/HTTP/SQLite path. Production acceptance and unfinished integrations remain
explicit in that runbook. Supabase is an archived candidate, not a dependency.

Provider-free executable preparation for WVD-WEB-T08 slice 0, based on the
owner amendment v0.1.2, A1 review and independently reviewed T01/T02/T03 drafts.
The owner's instruction to continue development authorises this reversible
proof; it does not accept the provisional ADR or close affected live-build
dependencies. No public content, pricing, analytics or external service is changed.

Run `npm --prefix tools/portal-proof test` using Node 22.16 or later.

The model demonstrates active identity, business membership and project grants;
Owner-only approval; exact milestone version checks; membership revocation;
request retry binding; immutable approval history; and approval/outbox intent
committed together. Synthetic fixtures contain no customer data. Notification
intent contains no ticket content, email address or selected recipient policy.

This is an in-memory model, not a deployed portal or security certification.
Actor IDs and state come from a trusted test adapter; production must resolve
identity from a verified server session. `revokeMembership` and `replaceVersion`
are trusted fixture operations, not public endpoints. Synchronous copy-on-write
models a transaction only in one process. Durable database constraints,
multi-process concurrency, receipt IDs, audit storage, authentication, invitation
expiry/recovery, private previews, mail recipients and delivery require selected
providers and independent integrated tests. Do not serve this model as an API.

Calendar connection check: the WVD account and supplied secondary calendar have
been read successfully with owner access in ChatGPT. That connection does not
supply production application credentials or prove Meet creation, all conflict
calendars, external-writer handling, or booking availability. Booking remains a
separate integration slice. Provider choices, commercial/retention/licensing
decisions and exact-release production GO remain outstanding for affected work.

Extended proof: authorised project overview, exact-version feedback, ticket
creation/read/replies and payload-free pending notification intents. Ticket type
is question, fault or change request; priority, Care entitlement, transition
policy and notification recipients are not inferred. Plain text remains plain
text; a future UI must escape it. Seeded collections are trusted fixtures, not an
import API. Production requires complete schema/integrity validation, bounded
requests, durable uniqueness, approved retention and recipient policy.

`availability.mjs` assesses a single 30-minute slot from supplied UTC instants,
London working hours, 24-hour notice, England/Wales holiday coverage and busy
intervals with 15-minute separation. Buffer-at-opening/closing and evidence age
are explicit test-policy inputs; no founder decision is inferred. Complete
conflict calendar evidence is required and missing/stale evidence denies a slot.
Holiday fixtures are synthetic test inputs, not a maintained live holiday feed.
An available result means available at the observation only: there is no
reservation, external-writer protection, Calendar/Meet action or confirmation.

`boundary.mjs` is a transport-independent adapter proof with an injected server
session resolver, exact request schemas, a 32 KiB UTF-8 payload limit, explicit
methods, same-origin writes, no-store responses and sanitised errors. Request
payloads cannot select the acting identity. A real HTTP adapter must enforce
the body limit while streaming (before allocating the whole string), decode GET
parameters into this schema, and supply verified sessions. This proof supplies
neither authentication nor persistence, rate limiting or public routes.

On 2 October 2026 the founder authorised development test events on the WVD
calendar. A labelled private, transparent 30-minute test was created via the WVD
connection, read back with a successfully provisioned Google Meet link, then
deleted successfully. No external attendees were supplied. This verifies the
chat connector's create/read/Meet/delete path only. The website still needs its
own scoped credentials and calendar adapter; no production booking is implied.

`durable.mjs` adds an explicit SQLite seed, per-operation transactions and fresh
reads across connections. State and notification intents commit together;
failures roll back. The aggregate JSON store is a bounded local adapter and is
not the selected hosted production database. Filesystem permissions, backups,
retention, encryption and full imported-data validation remain separate work.

`http.mjs` and `server.mjs` expose the domain through explicit Node server
construction. Bearer tokens are resolved only by the supplied server adapter;
there is no default identity or development-auth bypass. The transport enforces
streamed body bounds, exact schemas, write origins, no-store responses and
sanitised errors. Loopback tests use synthetic identities on an isolated socket
and temporary database. Hosting must provide TLS, real token verification,
rate limits and production configuration; this code starts no public service.
