# Private booking management and confirmation preparation

Reuses the reservation journal, conditional cancellation/rescheduling adapters,
private JSON boundary and branded booking page from source
5ab49c5081b6707af27d4d0dfbb165e7d69dc82d. Existing portal notification preparation
assumes invited Firebase identities and portal intents; anonymous introductory
bookings have neither. The shared email shape validator is reused for preparation,
while the existing Calendar-only delegation remains unchanged.

## Management capability

After a confirmed booking, its existing private retry capability can request one
management link. The browser first generates and saves a random 256-bit issuance
secret in private tab storage. The server stores only a SHA-256 digest bound to
product, calendar, management origin and reservation, plus an explicit expiry.
An exact issuance retry returns the original expiry and cannot rotate or extend
the link. A different secret cannot silently replace an existing link. Renewal,
revocation and operator-assisted recovery of lost links require separate work.
The host must supply the lifetime (bounded to one minute through thirty days);
the synthetic browser fixture uses one day, not a production retention decision.

The link opens /book/manage with the opaque capability in its fragment. The
fragment is not part of the server request URL. On arrival, the page removes it
from the visible URL/history entry and keeps it in that tab's session storage.
There are no token query parameters, lookup by email, third-party analytics or
external scripts. Anyone holding a valid link can manage that booking: it is a
bearer capability, not proof of the holder's identity. Never place raw links in
logs, public artifacts, screenshots or support tickets. A real delivery system
must preserve fragments and avoid exposing them through tracking redirects.

The link retrieves the latest booking time and revision after rescheduling.
Cancelled bookings report cancellation without a Meet link. Expired, malformed,
unknown and foreign-scope capabilities are denied. Reads expose no journal IDs,
provider diagnostics, calendar names or stored capability digest.

Private POST endpoints support issue, read, cancel, reschedule and recovery.
Every route applies exact origin/schema checks, bounded bodies, no-store headers
and explicit admission control. The optional host remains restricted to isolated
Firebase emulators; its product/calendar must match the booking host. No production
route is enabled. Private management assets share the existing CSP and branding.

Cancellation binds the displayed time and revision inside the journal transaction,
so an intervening change cannot turn an old confirmation into a different action.
Rescheduling keeps the existing dual holds and exact-operation replay semantics.
A fresh device can inspect and resume an already-pending operation using its
stored operation ID; WRITING recovery reads Calendar without another PATCH.
Opening a link performs a read only. Recovery requires the visible status action.

Backups include capability digests/expiry and unresolved operations, never raw
link secrets. Old backups are not a production recovery authority; active provider
state and restored access must be reconciled before traffic resumes. Per-booking
revocation and renewal are not yet available.

## Confirmation preparation

createBookingConfirmationPreparation produces a plain-text draft from the current
confirmed managed booking: UK date/time, duration, Meet link, private management
link and expiry. It refuses non-confirmed or expired state, foreign links and
malformed recipients. It records the booking revision and preparation time.
It explicitly returns sent=false and recipientVerified=false. Email shape is
not evidence of ownership, consent or deliverability. No customer email is stored
in the journal by this feature; no sender, outbox acknowledgement or delivery
receipt exists, and no message is sent.

Before live delivery: bind the agreed contact/recipient policy, implement durable
version-bound delivery intents and sender acceptance, resolve ambiguous sends,
and verify an explicitly authorised test recipient. Gmail delegation was not
approved by the existing Calendar-only grant. Neither additional OAuth scopes
nor live messages were introduced here. Production hosting/admission, lifecycle
policy, live Calendar listing/move acceptance and operational backup retention
remain separate acceptance work.
