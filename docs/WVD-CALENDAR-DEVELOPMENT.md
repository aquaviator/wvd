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


## Keyless development integration — 4 October 2026

Founder granted the dedicated WVD service account free/busy access to the named
WVD calendar. Google development access run 37196863698 passed keyless
impersonation and Drive/Calendar probes. This does not prove access to every
calendar needed for conflict prevention.

The workflow now includes `tools/google-development-access/calendar-contract.mjs`,
which supplies the existing portal evidence reader with a fixed free/busy REST
bridge and the workflow's explicit short-lived token. It queries one hour and
prints only PASS/BLOCKED, changesMade=false and bookingReady=false. The synthetic
holiday fixture is solely for adapter contract verification and never reaches
slot screening. No provider busy intervals, file content or credential is saved
in CI evidence. The common bounded transport is reused from access preflight;
no provider, SDK dependency or ambient credential discovery was introduced.
The offline container includes the same code but its tests use mocked responses
and never receive live credentials.

Verified source `cfb67ada8139dd90154ece1aa0100b96f9604dbb` passed the live
adapter workflow https://github.com/aquaviator/wvd/actions/runs/37198247121,
all four CI jobs in run 37198247105 and the offline container in run 37198247106.
Downloaded results matched that source; mobile pinned-image evidence was inspected.
These results supersede the earlier app-credential blocker for read-only CI checks;
application runtime credential composition and booking dependencies remain open.


## Founder conflict rule — 4 October 2026

Personal work commitments overlapping the booking system's operating hours must
block the affected introductory-call slots. An all-day personal work commitment
blocks every slot on that day; a timed commitment blocks overlapping slots,
including the established 15-minute conflict margins. Commitments outside the
booking hours cannot create bookable times outside those hours.

Reuse the existing busy-interval assessor; do not infer work status from event
titles or obtain event descriptions. Work commitments must be represented as
Busy in the included personal calendar so free/busy evidence can enforce the
rule. The personal calendar's service-account grant is still unverified. Missing
required-calendar evidence must fail closed rather than ignore personal work.
This rule does not independently select the two additional personal-account
diaries for conflict checks.


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
