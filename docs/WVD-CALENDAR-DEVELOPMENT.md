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

`tools/portal-proof/booking.mjs` screens explicitly supplied UTC candidates using
30-minute duration, 24-hour notice, 15-minute gaps and Monday–Friday
09:00–18:00 Europe/London. It adapts the Salon demo's duration/conflict logic and
rejects missing or invalid calendar/holiday coverage. Tests cover seasonal clock
changes, notice/working-day boundaries, both sides of the gap, invalid data and
input immutability. No arbitrary appointment grid is promoted to founder policy.

## Remaining live dependencies

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
