# Booking cancellation development

The approved booking brief requires cancellation and rescheduling links. This
slice provides internal cancellation composition; it does not expose a customer
cancellation route/link, implement rescheduling or send email notifications.
The customer flow remains an isolated development preview.

Reuse: reservation journal, deterministic event ownership and the fixed-calendar
Google Auth bridge from source c62f1686d4cf9e21fba6dde8db12e1a8646ca7b0. Existing
rehearsal cleanup is not a customer lifecycle: it has no durable cancellation
record. A separate adapter uses the shared event inspector before deleting.

`createReservedIntroCallCancellation` reads the trusted product binding before
mutating the journal. Only a durably confirmed booking may enter CANCELLING.
The slot remains held during provider outages, changed events, failed deletes
and failed final commits. Provider calls occur outside Firestore transactions.
Only an exact deterministic event absence proof can commit CANCELLED, with its
verification timestamp. Retries preserve that timestamp and never recreate an
old booking; a different reservation may take the released time. CANCELLED
records retain their original binding and confirmation for audit and capacity
accounting; no deletion/expiry or automatic release is introduced.

The provider adapter checks the exact event binding, Meet URL and absence of
attendees. It requires a strong ETag and sends `If-Match` on deletion, preventing
deletion after an intervening edit. It does not blindly repeat a failed delete.
A subsequent read must show 404/410 or the exact cancelled tombstone before
returning EVENT_ABSENT. Permission errors and timeouts remain pending. Previously
confirmed deterministic identity is required to treat an existing tombstone or
absence as cancellation evidence; unconfirmed/uncertain writes cannot use this
path. A later explicitly requested cancellation retry rereads ownership and
version before any further delete. Public callers cannot supply confirmation
proofs or provider IDs.

Google documentation reviewed on 4 October 2026:
- https://developers.google.com/workspace/calendar/api/v3/reference/events/delete
- https://developers.google.com/workspace/calendar/api/guides/version-resources

The bridge keeps fixed calendar targeting, calendar.events credentials, bounded
responses/timeouts, no redirects/retries and `sendUpdates=none`. This slice is
restricted to the existing no-attendee booking shape. It makes no claim of
customer cancellation notification delivery or a live cancellation rehearsal.
An attendee-enabled implementation requires separately verified binding and
notification handling; it cannot silently weaken the current ownership check.

Verification covers unchanged conditional deletion, post-timeout absence,
unavailable reads, ETag conflicts, guest/header/foreign-calendar injection,
durable commit failure, cross-product denial and real emulator slot release.
Customer management capability links, confirmation delivery, cancellation UI,
rescheduling, retention/backup and hosted production admission remain unfinished.
