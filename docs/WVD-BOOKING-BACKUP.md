# Private booking journal backup and recovery

Reuses the existing portal's exact-binding, bounded JSON backup and isolated
Firestore restore approach. The booking journal needs its own export because
portal backups do not include `wvd_calendar_schedules`. No public backup route,
production restore/overwrite, automatic scheduling or external storage is enabled.

Trusted composition explicitly supplies a backup binding: Google project,
Firestore database, product, calendar and emulator/live mode. The store refuses
export without it. Export reads one validated journal snapshot and confirms the
expected binding before serialising it. The host remains responsible for binding
the supplied Firestore client to that declared project/database; metadata alone
does not prove a deployed connection. No destination or credentials are guessed.

The versioned envelope includes the binding, export time, complete journal JSON
and SHA-256 integrity digest. Verification rejects changed scopes, damaged or
oversized envelopes, malformed ownership, duplicates, active overlaps, invalid
event/Meet bindings and missing cancellation audit data. Recomputing a digest
cannot bypass journal validation. The digest detects accidental alteration; it
is not a signature or proof of authorised origin. Backups contain private calendar
identifiers and Meet links, so they require restricted storage and a separately
reviewed encryption/retention policy before operational use. Never put them in
public artifacts, logs, analytics or a customer download route.

All phases remain intact. RESERVED, WRITING, CONFIRMED, RESCHEDULING and CANCELLING remain
active holds; RESCHEDULING also preserves its target interval and operation revision.
Verified CANCELLED and REJECTED rows do not block new reservations.
Export/rehearsal never creates an event, sends an invitation, cancels a booking
or releases an uncertain hold. Restoring a journal snapshot is not evidence of
current Calendar state; provider reconciliation and a controlled single-writer
recovery procedure are still necessary before production traffic resumes.

`rehearseBookingBackup` validates the complete export using the actual journal
codec, without SDK calls. `rehearseFirestoreBookingBackup` additionally creates
the verified journal in a random named database of a loopback/demo Firebase
emulator, reopens it with the real reservation adapter, compares every field and
deletes its own temporary document. It accepts no caller-selected restore target
and rejects live bindings before loading the SDK. The source journal stays intact.
Named emulator databases are implicitly created and have open emulator rules;
this verifies trusted backend persistence, not browser access-rule enforcement.

Primary reference checked on 4 October 2026:
https://firebase.google.com/docs/emulator-suite/connect_firestore

Tests cover all phase preservation, explicit export, immutable returned snapshots,
foreign project/database/product/calendar denial, checksum tampering, recomputed
corrupt data, capacity bounds and live-rehearsal rejection. The real emulator test
restores cancelled plus unresolved reservations into an isolated named database
and confirms the source is unchanged. Exact-source CI and downloaded evidence were verified as recorded below. Scheduled encrypted backups, retention/pruning,
operational restore and provider reconciliation acceptance remain unfinished.


## Verified development evidence — 4 October 2026

Runtime source `fdb98134d72d5e32207bbc7c8779ce6960495304` passed push CI
37207747826 and PR CI 37207750830. Offline container 37207747852 passed
437 unit tests, zero failures and one Windows-only skip, plus all four real
Firebase emulator/browser tests. The reservation emulator test exported and
restored three journal records (two active holds and one cancelled reservation)
in an isolated named database and checked that the source was unchanged.

Downloaded artifact 11305228193 matches that source in results.json and records
`liveAccess: false`. Its SHA-256 is
`d89fb4ef3ebdc1430246f347a50e2871ecfafa1595a8b2953d0c1e4a73de5767`.
Container image: `sha256:2e7c45814d2f148c672fa76c9551c05e0c41e6ea5b45c96252cfbc418323b517`.
The mobile cancellation screenshot was inspected. Required screenshots and
receipts were retained; one supplementary video was explicitly omitted to keep
the existing 5 MiB evidence budget. This verifies development recovery, not an
operational production backup service.
