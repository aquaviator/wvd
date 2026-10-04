# Durable introductory-call reservation development

## Reuse and boundary

Source baseline 3eaac6aa743492c676a2e7d87ad5fc44998dc84d supplies the shared
candidate/timing/screening rules, Google event identity/writer, and Firestore
transaction pattern. This slice reuses them. The existing portal aggregate stores
client projects and reviews; it has no calendar-wide reservation entity. A
separate bounded private schedule journal is therefore added rather than mixing
anonymous call reservations into client memberships or rebuilding availability.

FirestoreBookingReservations requires an explicitly supplied trusted database,
product ID and calendar ID. Calendar IDs derive private document paths under
wvd_calendar_schedules. The document binds the owner product and calendar;
another product targeting that same calendar in the same database is rejected.
It cannot create its own independent schedule lock. The host must designate one
authoritative database/booking writer for the calendar; separate databases cannot
provide a distributed lock across one another.

Existing Firestore rules deny client access by default to this new collection.
Only a trusted backend may use this adapter. No route, attendee address, name,
phone number, token or credential is stored or accepted by it.

## State and concurrency

RESERVED holds a fixed product/reservation/start/end binding. Transactional
overlap checking includes the established fifteen-minute gap. Exact retries read
the same row; changed bindings cannot reuse an ID. Rejected-before-write rows
remain as idempotency history but no longer occupy the time.

WRITING records a unique claim before any provider call. Only one competing
request can claim a reservation. Claims are created outside transaction retry
callbacks and provider calls never occur inside those callbacks.

CONFIRMED is committed only after the provider returns the exact deterministic
event ID, a ready Meet conference and a validated Meet URL. A reply becomes
CONFIRMED only after that durable commit. It is not an invitation-delivery receipt.

Provider ambiguity, pending/failed Meet, process interruption and confirmation
commit failure retain WRITING. There is no TTL or automatic release: the event
may already exist. These cases require an ownership-checked read/reconciliation
implementation before an operator can safely resolve them. Evidence outages
retain RESERVED and allow a later final recheck.

The journal is bounded to 400 records and 128 KiB. No implicit archive/deletion
policy or capacity increase is applied. Existing portal backup exports do not
include this separate collection; reservation backup/restore and retention are
additional production prerequisites.

## Final conflict check

createReservedIntroCallBooking composes the store with the existing server
screening and event writer. The host wraps createIntroCallScreening with fresh
trusted holiday evidence, for example:

    screen: async ({starts}) => screening({
      starts, holidayEvidence: await readHolidayEvidence()
    })

The host supplies the complete explicit calendar set and evidence-age policy,
including fresh GOV.UK holiday evidence. The coordinator screens after obtaining
the reservation, checks the exact returned slot and then claims the provider write.
An empty valid screening result rejects before event creation. Malformed or
unavailable screening cannot write or release an uncertain reservation.

The Firestore reservation prevents competing requests through this booking
backend. An external calendar editor can still change events between the final
free/busy read and insertion; Google Calendar does not offer an atomic operation
combining those two systems. Do not promise absolute prevention of external edits.

## Verification and remaining work

Nine synthetic contract tests cover competing reservations, exact retries,
restart persistence, final busy conflicts, provider/evidence/commit failures,
buffer edges, foreign ownership and corrupt state. A real Firestore emulator
test covers concurrent reserve/claim transactions and reopening the journal.
No live Firestore journal or customer booking is created by these tests.

This is an internal development composition. Hosted/public request controls,
customer-facing pending/retry UX, reconciliation, attendee delivery, schedule
backup/retention and production deployment remain required. CI/container results
must verify this exact source before the slice is described as verified.
