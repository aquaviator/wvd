# WVD Calendar development evidence

Founder policy comes from the Website Decision Amendment v0.1.2 and subsequent
Google/reuse/no-new-spend instructions. This is an integration checkpoint, not
production booking acceptance.

## Read-only connector checks — 2 October 2026

- Connected WVD Calendar profile matches `admin@wearvalleydigital.com`.
- The named Wear Valley Digital calendar from the founder's brief is visible
  with owner access. The WVD primary calendar is also visible with owner access.
- A bounded free/busy query for both calendars succeeded without per-calendar
  errors. No event titles or private descriptions were requested or retained here.
- A generic UK holidays calendar is visible; that label alone does not establish
  complete, current England/Wales bank-holiday coverage for the booking policy.
- No calendar event, invitation, conference or account permission was changed.
  Successful connector access does not connect OAuth credentials to the app.

## Verified synthetic code

`tools/portal-proof/booking.mjs` now batches the established `availability.mjs`
single-slot checks rather than maintaining another duration/conflict algorithm.
It screens bounded, explicitly supplied minute-aligned UTC candidates. The shared
contract checks 30-minute calls, 24-hour notice, 15-minute gaps, Monday–Friday
09:00–18:00 Europe/London, exact queried calendar intervals and England/Wales
holiday coverage. Snapshot age and buffer-at-opening/closing behaviour are
explicit caller policy inputs; no founder choice is inferred for those details.
Missing, errored, stale or future evidence never offers a slot.

Tests bind batch results to the shared single-slot behaviour for both boundary
policies, seasonal time changes, notice, conflicts and incomplete coverage.
Strict holiday dates reject impossible, duplicate, reversed or out-of-coverage
values. Test data is synthetic, not a published holiday calendar. Supplied
evidence is still not proof of provider authenticity or slot reservation.

## Remaining live dependencies

The optional `call-http.mjs` development boundary reuses the shared body reader,
candidate normaliser and screening composition. It accepts candidate starts only,
keeps conflict calendars/holiday evidence on the server, bounds concurrent reads
with explicit capacity, and validates/projects provisional slot output. Synthetic
tests compose the HTTP handler through Google-shaped free/busy evidence and the
actual shared availability rules; errors and private calendar details are omitted.
The emulator application can opt in explicitly. No live endpoint is enabled.

- Connect app-owned, appropriately scoped Calendar credentials through the
  approved secret mechanism; no connector token is exported into code or logs.
- Establish the full set of calendars that must prevent founder conflicts. The
  two WVD calendars being readable does not establish that personal or other
  calendars can be omitted.
- Verify authoritative England/Wales holiday data and coverage/freshness rules.
- Implement final conflict recheck, concurrency-safe reservation and idempotent
  event creation. A free/busy read does not reserve a slot.
- Verify Google Meet creation and conference response, cancellation/rescheduling
  links and confirmed client delivery with correct access and failure handling.
- Bind retention, privacy and recovery checks before real personal-data intake.

Production release still needs exact-release approval. Unknown cost is not zero;
no billing or additional provider spend was enabled by these checks.
