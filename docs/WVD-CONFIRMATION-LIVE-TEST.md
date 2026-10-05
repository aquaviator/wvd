# Authorised confirmation email test — 5 October 2026

Founder approved one clearly labelled development email to
admin@wearvalleydigital.com at 14:00 BST. No customer recipient was selected.

Google access workflow 37313700651, job 111775058265 completed successfully.
At 2026-10-05T13:02:47Z the Gmail adapter returned PROVIDER_ACCEPTED, receipt
1a10c28daac6d0c6. This confirms provider acceptance, not inbox arrival.
No appointment was created. Subject: [WVD development test] Booking confirmation.
The body explicitly states that no appointment has been booked and no action
is required.

The fixed Firestore document
wvdDevelopmentChecks/confirmation-mail-20261005-approved-130004 claims the
attempt before sending and retains the provider receipt. Existing claims deny
replay, including after an unknown transport result. Do not delete this record
or change the attempt ID to resend. The one-time workflow send step was removed
after successful acceptance. Ordinary CI continues read-only mail access checks.

The actual customer confirmation worker remains separate from this rehearsal:
public recipient collection, admission policy and deployed worker activation
are not established by this single test. Inbox receipt requires founder evidence;
no Gmail inbox-reading scope has been requested.

## Inbox delivery confirmed

At 14:25 BST on 5 October 2026, Andy confirmed the authorised test arrived in
Inbox and supplied the matching sender, subject, 14:02 timestamp and message
body. This establishes inbox arrival for this single test, in addition to the
provider receipt. No resend or further test recipient is authorised by this
confirmation. Customer booking delivery activation remains separate work.
