# Booking confirmation delivery

The trusted worker now has a durable, version-bound confirmation queue. It reuses
booking confirmation preparation, the booking Firestore transaction and exact
Google event inspection. The portal notification planner is not reused directly:
its recipients are authenticated project members, whereas intro bookings do not
require registration.

## Queue and dispatch

`createBookingConfirmationDelivery` requires an explicit store, management
service, product/calendar/origin, clock, cipher, Calendar client and sender.
`queue({recipientEmail,managementUrl})` prepares the current confirmation and
creates one immutable intent per booking revision and management capability. Exact retries retain the same
intent and encrypted payload. A different recipient or message at that revision/capability
is rejected, rather than silently replacing the original recipient.

The transaction stores AES-256-GCM ciphertext, a content digest, management-token
digest, booking version, timestamps and dispatch status. The cipher authenticates
the product/calendar/booking/intent context. No plaintext address, message or raw
management link is stored in the journal. Runtime keys are supplied through an
explicit `readKey(keyRef)` dependency; no key is generated or embedded by default.
Old referenced keys must remain readable for retained queued records and backups.
There is a maximum of 16 intents per booking and the existing total journal size
limit remains in force. Capacity errors do not release reservations.

`dispatch({reservationId,intentId})` decrypts and re-prepares the confirmation,
checks its content/version, and reads the bound Calendar event before claiming.
The transaction then checks the current booking revision, phase, management hash
and expiry again. Stale queued messages become `SUPERSEDED` without sending.
Only one claimant invokes the sender, outside the database transaction, with
`retry:false`. The sender must disable its own automatic retry too.

- `QUEUED`: eligible for an attempted dispatch.
- `RETRYABLE`: preparation, key or Calendar evidence unavailable; no send claimed.
- `UNKNOWN`: a send was claimed; acceptance is not durably established. Never
  automatically resend, even after a crash before the actual network request.
- `ACCEPTED`: a provider acceptance receipt is durable. This does not assert
  delivery, inbox placement, opening or attendance.
- `SUPERSEDED`: queued confirmation no longer matches its booking or capability.

A booking may change after a send claim while the provider request is in flight;
this implementation does not freeze booking actions during delivery or guarantee
that a sent message cannot become outdated. Its management link loads the current
booking. Resolving `UNKNOWN` requires provider evidence; blind resend is forbidden.

## Integration boundary

No public email endpoint or live sender is enabled. The sender, approved runtime
key reference, contact collection/admission and recipient policy must be composed
by the host. Address syntax alone does not prove ownership or consent. Existing
Calendar delegation does not confer Gmail permission. Do not add Gmail scopes or
send messages during a test run. Synthetic tests exercise real encryption and
Firestore durability without customer data or provider delivery.

Backup export/rehearsal includes the ciphertext and receipt state, using the same
journal codec. Backups do not contain encryption keys and are not evidence of
provider delivery. Restoring an old queue into a live writer still requires the
operational reconciliation process; it must not automatically replay old sends.
