# WVD portal domain proof

Provider-free executable preparation for WVD-WEB-T08 slice 0, based on the
owner amendment v0.1.2, A1 review and independently reviewed T01/T02/T03 drafts.
The owner's instruction to continue development authorises this reversible
proof; it does not accept the provisional ADR or close affected live-build
dependencies. No public content, pricing, analytics or external service is changed.

Run `npm --prefix tools/portal-proof test` using Node 20 or later.

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
