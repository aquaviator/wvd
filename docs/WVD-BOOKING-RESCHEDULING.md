# Booking rescheduling — internal development foundation

Reuses the Firestore booking journal, exact Calendar ownership checks, fixed
Google Auth bridge and private backup codec from source
49f9d7de52c09333217085aaf91bcf85449e952f. Separate bookings followed by cancellation
would risk losing the original time or creating two appointments. This adapter
moves the existing event and keeps its Meet link; it does not create or delete an
event, add attendees, send invitations or activate a public rescheduling route.

The journal records one current change with an explicit expected revision and
operation ID. Its RESCHEDULING phase protects the original and target intervals,
including the existing fifteen-minute gap, from other bookings. Overlap with its
own original time is permitted; overlap with another reservation is rejected.
Cancellation and another change cannot start while that change is unresolved.
Rejection before the write claim preserves the original confirmation. After a
write claim, both holds remain until exact target/event/Meet proof commits.

Only one concurrent request claims the Calendar update. Subsequent retries read
Calendar without writing again. A lost response, provider error or database
confirmation failure retains both holds; no timeout frees either. Exact latest
operation replay returns its durable result. Expected revisions reject stale
commands even after later moves return to an earlier time. The journal retains
the latest operation, not a complete historical audit of every change.

The Calendar adapter verifies the original owned event, absence of guests,
existing Meet link and strong ETag. Its bounded conditional PATCH changes only
time and private binding metadata, including the operation ID. Verification reads
the resulting event and requires the exact target, operation and original Meet
link. A changed event or unsupported state remains blocked/pending. The host must
not bypass the journal claim by repeatedly invoking the provider write adapter.

`createReservedIntroCallRescheduler` composes the journal, an explicitly supplied
screening function and provider. Screening must cover every required calendar,
personal work days, booking hours, notice, buffer and holidays. If the original
event is excluded, that exclusion must be proved against its exact event identity;
subtracting a merged free/busy range can hide another conflict and is forbidden.
The existing general free/busy screen is not yet an exclusion-aware live adapter.
Google Calendar and Firestore remain separate systems, so external calendar edits
can race a final check. One authoritative journal/writer is still required.

Backups preserve unresolved change metadata and both holds. Real emulator tests
reopen a WRITING change and restore it into an isolated database without changing
the source. Existing schema-1 records without a change remain accepted; older
code that does not recognise RESCHEDULING must fail closed and must not be used
for rollback while these records exist.

Next integration requirements: exact-event-aware live screening, private HTTP
management capabilities and revisions, customer change/recovery controls,
confirmation delivery and hosted admission. None is implied by this internal
adapter. No live rescheduling or production deployment is claimed.

Primary references checked on 4 October 2026:
- https://developers.google.com/workspace/calendar/api/guides/version-resources
- https://developers.google.com/workspace/calendar/api/v3/reference/events/patch
