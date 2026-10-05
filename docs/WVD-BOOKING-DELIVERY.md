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

## Gmail adapter and key source — 5 October 2026

`google-booking-mail.mjs` implements the trusted sender contract using one fixed
Gmail messages.send endpoint, one recipient, a fixed booking-confirmation subject,
UTF-8 MIME/base64url, and a stable Message-ID derived from the existing intent ID.
It has no automatic retry. A provider error or invalid acknowledgement is UNKNOWN,
not proof of non-delivery; Message-ID is not a Gmail idempotency guarantee.
Provider acceptance is not inbox delivery. The injected send-only auth client must
also honour the no-replay contract. Header injection is denied before requests.

`google-booking-key.mjs` implements the cipher key reader against one configured
project/secret and an explicit numeric version. It rejects latest/foreign targets,
checks a canonical 32-byte key and exposes no key/provider bodies in errors.
Neither adapter is mounted on a public route or activated in the deployed host.
Recipient ownership/consent, worker activation, approved sender authentication
and unknown-send reconciliation remain necessary integration work.

Live scope discovery in Google workflow 37289535053 received unauthorized_client
for the delegated gmail.send token request; no Gmail API call or message occurred.
The existing calendar scopes remain operational. Founder/admin preparation is
in tools/booking-runtime/enable-confirmation-services.sh: enable Gmail and Secret
Manager APIs; create the specifically labelled envelope-key secret/version only
when absent; grant the existing runtime account Accessor on that secret alone;
print the OAuth client ID and version references, never the key. It does not
change Workspace delegation, send mail or enable the public email route.

In Workspace Admin, edit the existing service account's domain-wide delegation
client and ADD https://www.googleapis.com/auth/gmail.send while preserving every
existing approved scope (including calendar.events). This is send-only authority,
not mailbox-read authority. Domain-wide delegation is a Workspace administrative
grant; the application must still constrain impersonation to the configured
organiser. It is not an account-specific ACL enforced by the scope itself.

References checked 5 October 2026:
https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send
https://developers.google.com/workspace/gmail/api/guides/sending
https://cloud.google.com/secret-manager/docs/reference/rest/v1/projects.secrets.versions/access


## Composed Google worker — 5 October 2026

Admin setup is complete. Google run 37293618815 passed explicit secret-version
access and the delegated Gmail scope. These are permission/read proofs, not a
message-delivery receipt. Do not repeat the Workspace or secret setup without
new evidence of failure.

`booking-delivery-runtime.mjs` composes the existing durable worker, Google MIME
sender and Google-backed envelope cipher. It remains a private integration module;
it is not mounted in the deployed server and adds no public email route.
The host supplies the already-bound runtime, attached signer, clock and explicit
sender/service-account/key configuration. Construction performs no network work.
`verifyAccess()` reads the active key and mints a delegated send-only token without
queueing, contacting Gmail messages.send, or changing Calendar/Firestore records.

`google-keyless-token.mjs` extracts the already-tested Calendar IAM signing and
short-lived token exchange. Calendar and Gmail adapters now reuse it with a fixed
purpose allowlist, separate caches and no downloaded key. Gmail accepts only the
messages.send endpoint with no redirects, credential overrides or automatic
request replay. A 401 invalidates the cache for a later operation, never retries
the uncertain send. The durable queue remains the send-once boundary.

The Google cipher maps envelope aliases to an explicit allowlist of secret version
numbers. Rotation can retain old aliases for decryption while selecting one active
alias for new envelopes. Unknown aliases cannot trigger a Google request. Owned
key buffers are erased after use; existing shared-key test readers retain their
previous semantics. The CI preflight only reads the configured version 1 and
prints a bounded status without key material. Gmail scope acquisition now fails
CI if revoked rather than reporting an optional setup condition.

Synthetic integration evidence covers the complete Google-backed composition,
concurrent dispatch, credential refresh, wrong-target denial and key access.
Actual inbox delivery still requires an explicitly authorised test recipient;
no test email has been sent. Public contact/admission integration and worker
activation remain separate from permission readiness.

## Optional confirmation HTTP boundary — 5 October 2026

The one authorised development email test has completed and the founder confirmed
inbox arrival; see WVD-CONFIRMATION-LIVE-TEST.md. Do not repeat it. The historical
permission and test prerequisites above describe earlier stages, not new requests.

`createBookingServer` now accepts an optional host-owned `callConfirmation` with
`delivery` and `resolveRecipient`. With neither supplied, the endpoint is absent.
The server binds management, origin, admission and request capacity to its existing
runtime. `POST /api/calls/manage/confirmation` requires exactly `token`,
`recipientProof` and `consent:true`. No caller-supplied address or target is accepted.
A current confirmed management capability and host-verified recipient are required
before queueing. The existing encrypted delivery worker rechecks the booking and
Calendar event, handles concurrency and preserves the no-resend UNKNOWN outcome.
Responses contain only bounded status, providerAccepted and delivered:false.

The optional Firebase resolver reuses the portal's fresh verified-account identity
proof, with explicit project/issuer/subject and no-tenant binding. It checks revoked
or disabled accounts and denies a token whose email no longer matches the current
account. It grants no portal access. This is an adapter for customers already
signed in; it does not introduce mandatory registration for intro bookings or
complete the anonymous customer's recipient-verification journey.

Recovered the previous controller's unfinished HTTP/resolver code into an isolated
checkout and strengthened host bindings, current-account checks and negative tests.
Reused the existing confirmation queue, encryption, admission, HTTP body reader and
identity proof rather than replacing them. No UI, deployment configuration, live
sender activation, Google scopes or provider resources changed. Live activation,
guest recipient verification, public admission, Sites integration and operational
recovery/retention remain outstanding. Tests use synthetic identities and senders.
