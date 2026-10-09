# Customer booking development flow

The isolated application can expose `/book` when trusted composition explicitly
supplies both `callAvailability` and `callBooking`. It reuses the original WVD
logo, the existing fixed-origin JSON boundary, durable Firestore reservations,
final calendar screening, deterministic event writer and read-only recovery.
No production route or public-site navigation is enabled by this change.

Reuse reviewed against reservation source c62f1686d4cf9e21fba6dde8db12e1a8646ca7b0
and booking HTTP boundary 62e08223fed67ca68c7f874d864613c216f945bc. The existing
availability endpoint cannot create reservations; a separate bounded write
boundary is needed. Existing authenticated portal controls do not fit anonymous
call selection; the preview uses a private random retry capability instead.

The customer selects a date and UK time, then confirms. Availability is
provisional. The backend rechecks it after acquiring a durable hold. An uncertain
outcome remains pending: the same request is checked again without another
insert. Pending requests survive reload in this tab using session storage.
The UI disables changing dates while pending and never announces confirmation
on a timeout. A taken slot allows another selection. Confirmed results display
the checked date, time and Google Meet link; the preview explicitly sends no
email invitation. When the cancellation adapter is explicitly supplied, a
confirmed preview booking can be cancelled with a separate confirmation step.
An uncertain cancellation stays locked and survives reload as that same action.

`POST /api/calls/book` accepts exactly `{requestKey,start}`. The key is a
cryptographically random UUID v4 generated in the browser; possession is the
private retry capability. SHA-256 binds it to the configured product and calendar.
Keys must stay out of URLs, logs, analytics and support screenshots. Anyone
obtaining a key and its start can retry that request and obtain its confirmation.
After confirmation it remains in separate private tab storage for management;
only cancellation clears that management capability. Clearing tab storage loses
the capability; no public lookup by email, calendar
ID or reservation ID is provided. No customer details are stored in this flow.

Only trusted composition supplies product, calendar, adapters, concurrency and
shared admission control. Admission runs before body reads and writes. Raw
socket peer information is passed to that control; forwarded headers are not
trusted automatically. Production requires a reviewed host/proxy admission
implementation, explicit calendar freshness/holiday policies, customer contact
and invitation delivery, durable recovery operations and reservation retention.
The emulator test permits synthetic requests explicitly; that is not a production
rate-limit policy. Losing the retry capability does not release an ambiguous hold.

HTTP results: confirmed 200, pending 202, unavailable or changed request 409,
invalid input 400, excessive body 413, unsupported JSON media 415, origin denial
403, admission denial 429, temporary failure 503. Replies exclude internal IDs,
provider messages, calendar titles and event binding conflicts.

Verification includes request schema/origin/capacity/privacy tests, real HTTP
isolation, and an offline mobile browser scenario backed by real Firestore:
selection, pending, reload, read-only confirmation and a competing customer.
The new browser evidence is synthetic and does not verify invitation delivery
or a live hosted booking service. CI results must be checked before handover.


The isolated preview now optionally supports rescheduling, as described in
WVD-BOOKING-RESCHEDULING.md. Customer change selection, explicit confirmation,
unchanged Meet links and pending reload recovery use private tab capabilities
and expected revisions. Real customer delivery and production hosting remain
separate acceptance work.
