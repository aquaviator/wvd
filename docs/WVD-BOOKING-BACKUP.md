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

All phases remain intact. RESERVED, WRITING, CONFIRMED and CANCELLING remain
active holds; verified CANCELLED and REJECTED rows do not block new reservations.
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
and confirms the source is unchanged. Exact-source CI results must be inspected
before recording this as verified. Scheduled encrypted backups, retention/pruning,
operational restore and provider reconciliation acceptance remain unfinished.
