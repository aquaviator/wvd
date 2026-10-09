# Booking identity decision — 4 October 2026

## Founder approval and prepared implementation

Founder approved the proposed admin@wearvalleydigital.com organiser and
Workspace delegation on 4 October 2026. The event authentication step now sets
that exact subject as a literal; no caller-supplied subject is accepted. Existing
read/free-busy/CalendarList tokens remain non-delegated. Nineteen focused event,
cleanup and writer-grant tests passed locally, and the Cloud Shell script passed
bash syntax validation.

Run tools/google-development-access/enable-booking-delegation.sh in an already
authenticated Google Cloud Shell. It verifies the project number, existing
service-account OAuth client ID, provider state/issuer/mapping, applies the exact
approved workflow trust condition and adds Token Creator on this service account
only. It prints the public OAuth client ID and sole Calendar events scope.
It does not create users, licences, keys, calendars or domain-wide delegation.

In Workspace Admin, Security → Access and data control → API controls → Manage
Domain Wide Delegation → Add new, enter the printed client ID and sole scope
https://www.googleapis.com/auth/calendar.events. Authorise using a super-admin
account. Existing client entries should be inspected rather than duplicated.
No extra OAuth scopes are authorised by this approval.

The live workflow will fail safely at delegated authentication until these
administrator grants are present. Once completed, rerun the failed Google access
job and verify Meet creation plus cleanup. Approval does not prove the organiser
has Meet capability or replace that live test.

## Observed blocker

Source 6bd87fa9e4237f81731ddca3b122f0885229e786 passed 14 focused event/cleanup
tests before live writes. Live run 37201986418 authenticated with keyless
calendar.events scope, then Google returned HTTP 400 with the exact recognised
message "Invalid conference type value." The diagnostic emitted only the fixed
code CONFERENCE_TYPE_NOT_SUPPORTED. The deterministic event was absent on the
follow-up cleanup read. No attendees or invitations were sent.

The named WVD calendar writer grant and all three free/busy calendars passed.
This does not prove ordinary non-conference event insertion or establish that
delegation alone will fix Meet. The next identity must be tested before readiness.

## Proposed identity, pending founder decision

Use the existing Workspace user admin@wearvalleydigital.com as the booking
organiser through the existing service account and GitHub keyless federation.
No new user licence, provider subscription, JSON key or refresh-token secret
is proposed. Confirm this organiser is wanted before enabling delegation.

Required changes, not applied:
1. Obtain the existing service account OAuth client ID by read-only Cloud Shell:
   gcloud iam service-accounts describe wvd-development@wvd-development.iam.gserviceaccount.com --project=wvd-development --format="value(oauth2ClientId)"
2. Restrict the existing federation provider's condition to the exact
   .github/workflows/google-development-access.yml workflow_ref on the existing
   development branch, preserving immutable repository/owner IDs and permitted
   push/workflow_dispatch events. Inspect current condition first; do not apply
   the old bootstrap blindly because it reports current condition drift.
3. Grant the existing repository principalSet Service Account Token Creator
   on this service account only, in addition to its current Workload Identity
   User grant. Do not add this role at project level.
4. A Workspace super administrator authorises that client ID for only
   https://www.googleapis.com/auth/calendar.events in domain-wide delegation.
   No Gmail, Drive, Directory or full Calendar scope is proposed.
5. The workflow validates the fixed approved subject and passes
   access_token_subject: admin@wearvalleydigital.com to the pinned auth action.
   Only the event rehearsal gets this delegated token; personal conflict probes
   retain the non-delegated service account and free/busy scope.
6. Rerun the same past synthetic create/read/delete test. Meet and cleanup must
   pass before any production readiness claim. Attendee delivery remains a
   separate implementation and verification step.

Domain-wide delegation is an additional authority boundary: its grant can allow
the service account to impersonate other Workspace users for the authorised
scope. A fixed workflow subject and calendar target constrain this application;
they do not make the Workspace delegation grant inherently user-specific.
Founder approval is needed for that expansion. An alternative is user-consented
OAuth, which requires a different durable credential arrangement and a separate
choice. No delegation or Token Creator grant has been made by this work.

References:
- https://github.com/google-github-actions/auth#inputs-generating-oauth-20-access-tokens
- https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- https://developers.google.com/workspace/calendar/api/guides/create-events
