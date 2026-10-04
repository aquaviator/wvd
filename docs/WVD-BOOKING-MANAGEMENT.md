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
Opening a link in a fresh tab performs a read only. Recovery requires the visible status action.

Backups include capability digests/expiry and unresolved operations, never raw
link secrets. Old backups are not a production recovery authority; active provider
state and restored access must be reconciled before traffic resumes. Per-booking
revocation and renewal are not yet available.

## Confirmation preparation

createBookingConfirmationPreparation produces a plain-text draft from the current
confirmed managed booking: UK date/time, duration, Meet link, private management
link and expiry. It refuses non-confirmed or expired state, foreign links and
malformed recipients. It records the booking revision and preparation time. This is journal-based
preparation; it does not independently refresh Calendar. Delivery acceptance must
recheck current booking/provider state and suppress superseded drafts.
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

## Verified development evidence — 4 October 2026


Final runtime source 5cfa37f486d7630a860521c1ef23e680c405c734 passed push CI
37211309341, PR CI 37211312281 and offline container 37211309321. The container
passed 472 unit tests, zero failures and one Windows-only skip, plus four real
Firebase/browser tests. Downloaded artifact 11306821745 matches the exact source
and records liveAccess=false. Artifact digest:
sha256:e856ce33b6e619f7026b0c34c04401bfa2527c5bbea2b75efe85cc1c7cbf6067.
Container image:
sha256:02f3e3aa9b9171f0f7cfaf9a66b8912eba40f16381c33d1e04705e72aeb1d7d8.
The final cancelled management screenshot was inspected: the closed form and Meet
link are hidden, with clear cancelled status and the contact CTA. Cross-device
management, interrupted rescheduling/reload and cancellation at the changed time
passed in the real browser/emulator scenario. Required receipts and screenshots
were retained; one supplementary video omission is explicit within the 5 MiB cap.

## Current-device recovery and replacement availability

The management page offers **Refresh booking details**, a read-only refresh that
clears stale local action state and loads the authoritative booking. If a server
operation remains pending, its existing recovery identifier is offered separately;
refresh does not repeat a cancellation or reschedule. Revision conflicts explain
that another change occurred, and expired links show contact help instead of an
endless retry prompt.

Optional `screenReschedule` composition adds `management.availability` and the
POST `/api/calls/manage/availability` route. The exact request is
`{token,start,revision,starts}` (maximum 200 unique canonical minute starts,
8192-byte body). The route is absent when this capability is not composed.
The management service verifies a confirmed current revision before and after
screening, removes the unchanged time and binds the original event itself.
Only requested, unique 30-minute Europe/London slots are returned; they remain
provisional until the existing reservation/write path rechecks them.

`createGoogleRescheduleScreening` accepts either the existing single `target` or
batch `starts`, never both. A bounded batch shares the complete evidence query
and exact original-event exclusion. Personal calendars, other owned-calendar
events, holidays, notice and buffer policy remain in force. This reuses the
existing screening implementation; there is no second availability policy.
The private management picker uses this route when composed. The original
booking page retains its existing general availability route.
