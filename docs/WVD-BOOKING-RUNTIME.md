# Standalone booking runtime

The booking runtime composes the existing transactional journal, complete
availability evidence, exact-event rescheduling, cancellation and management
capabilities. `booking-server.mjs` mounts only booking routes and branded assets;
it does not expose the proof portal's local authentication or emulator APIs.
`app.mjs` retains its isolated-development restrictions. Shared asset rendering
keeps preview notices in emulator mode and truthful live wording in live mode.
The live UI explicitly states that email confirmations are not enabled yet.

## Configuration and identity

`tools/booking-runtime/wvd-development.candidate.json` is an explicit candidate
for the existing development project and its three granted calendars. It is not
proof that a hosting service, database or domain route has been provisioned.
The proposed database is `(default)` with product namespace `wvd`; read-only CI
discovery reports whether it exists and is accessible before activation.
The candidate origin is `https://wearvalleydigital.com`; hosting/proxy routing must
match it. A separate preview URL requires its explicit origin binding.

`createFirestoreBookingRuntime` validates the selected Firebase target and
rejects emulator environment variables for live mode before loading SDKs. The
entry point requires a Cloud Run attached identity, denies credential files and
checks the attached account against the configured account. It uses the existing
Google Auth dependency (now directly pinned to the already locked 11.1.0).

`createKeylessCalendarAuthClients` uses IAM `signJwt` and the OAuth JWT grant.
Only Calendar event access delegates to `admin@wearvalleydigital.com`; free/busy
uses the service account itself. Scopes are fixed to `calendar.events` and
`calendar.freebusy`, separately cached/refreshed. Concurrent refreshes share one
mint operation per purpose. Assertions expire after five minutes; returned access
tokens are bounded to the provider's advertised lifetime of at most one hour.
No JSON service-account private key, copied user token or recurring gcloud login
is used. A 401 clears the cached token but does not replay the failed Calendar
request. Provider bodies and credentials are absent from errors/logs.

The running account needs `iam.serviceAccounts.signJwt` on its own service-account
resource. Existing GitHub impersonation authority does not automatically grant
this to the attached runtime account. The prepared one-time admin script
`tools/booking-runtime/enable-runtime-signing.sh` adds only the account-scoped
Token Creator binding. It is not run by development or deployment automation.
It preserves existing WIF conditions and Workspace scope grants.

## Bounds and operational behaviour

The runtime's read client fixes the owned Calendar event endpoint and the complete
free/busy calendar set. Listing is bounded, expanded and includes hidden invites;
it cannot be redirected to personal event listings. Writes reuse existing
conditional/no-retry adapters. Personal work-day conflicts remain authoritative.
Holiday evidence comes from the existing official GOV.UK reader.

All public booking APIs, including availability, share a transactional Firestore
request budget. The candidate is 120 admitted requests per 60 seconds across
instances and four in-flight requests per handler instance. It stores one bounded
counter document per calendar, checks product/policy ownership and denies on
missing/corrupt evidence. It does not trust forwarded headers, identify people,
prove consent, replace bot protection or impose a financial spending cap.
Changing the bound budget policy requires reconciling that counter's configuration.

The candidate management-link lifetime is 30 days, within the existing hard
limit. A still-valid link can be replaced before expiry. Expired/revoked links
require contact-assisted operator recovery; no email-only lookup is introduced.
The booking remains valid when its link expires. Long-future bookings therefore
need retained/replaced links or support; no expiry reminder sender is enabled.

`/health` reports process liveness only and explicitly sets
`providerAccessChecked:false`. It does not claim working provider permissions.
No outbox dispatcher, public email endpoint or automatic customer invitation is
mounted by this host. The encrypted delivery module is ready for a separately
configured key source, recipient policy and approved sender.

## Hosting package and remaining activation work

`tools/booking-runtime/Dockerfile` builds a non-root Node runtime with locked
production dependencies and the original brand asset. It contains configuration
references, not secrets. The configuration file can be replaced at build time for
an explicitly selected target/origin. The development CI remains isolated.

The existing Google access workflow now reports runtime permissions and database
metadata read-only. Missing permissions are a report, not a new gate on unrelated
development. No IAM changes, service enablement, deployment, database creation or
new spend occur in that report. Existing approved Calendar rehearsal/cleanup in
that workflow remains unchanged.

Activating hosting needs the real elevated permissions and any additional usage
spend authority. A resource-minimal starting configuration is zero minimum
instances, one maximum instance, request-based billing, one vCPU and 512 MiB;
these settings limit capacity but are not a hard billing cap. Artifact storage,
building, Firestore and network usage also need to fit the approved budget.
Public abuse controls, sender/key configuration, domain routing, contact-assisted
recovery and operational retention must be completed before describing the whole
customer journey as production-ready.

Primary API references used for these adapters:

- https://developers.google.com/workspace/calendar/api/v3/reference/events/list
- https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/signJwt
- https://developers.google.com/identity/protocols/oauth2/service-account
- https://docs.cloud.google.com/iam/docs/reference/rest/v1/projects.serviceAccounts/testIamPermissions
- https://cloud.google.com/run/pricing

## Observed activation requirements — 4 October 2026

Read-only Google workflow run 37222217821, source
820c7210d67f41ce99be2538a9fe8e8addf8e64c, confirmed:

- Existing `(default)` Firestore database: accessible, native mode, location `eur3`.
- Runtime self-signing: `ADMIN_GRANT_REQUIRED`.
- Cloud Run create/update/get authority: `ADMIN_GRANT_REQUIRED`.

`tools/booking-runtime/enable-runtime-access.sh` is the concrete elevated setup
prepared for founder approval. It grants Token Creator and Service Account User
to the existing service account on itself, plus Cloud Run Developer on the
existing development project. The latter permits creating/updating services in
that project; it does not grant IAM administration. The narrower signing-only
script remains available if only runtime signing is approved. Neither has run.

Image-repository access, Cloud Run/Firebase/domain configuration and any usage
spend authority are still separate from these grants. No repository, host, API,
public IAM binding, billing setting or customer message is created by the access
script. The existing WIF condition and Workspace Calendar-only delegation remain
unchanged. New Gmail authority is not included.

## Observed remaining hosting access — 5 October 2026

Runtime signing, attachment, Firestore and service-deployment permission now pass
in live workflow 37284636147. The founder authorised £5/month total additional
hosting spend. The subsequent discovery run 37285436943 confirmed:

- London registry and Cloud Run inventories: ACCESS_DENIED_OR_API_DISABLED.
  This deliberately does not claim which of API enablement or IAM caused denial.
- Project-wide repository creation/upload and service IAM changes: absent.
  Repository-scoped permissions have not yet been tested; project-level absence
  is not proof that every existing repository denies uploads.

Prepared `enable-image-repository.sh` for founder/admin execution. It enables
Cloud Run and Artifact Registry APIs, creates a dedicated private Docker repository
only if its successful lookup finds none, and grants Writer on that repository
alone to the existing development account. New repositories use immutable tags
and disable optional billable automatic scanning; existing repositories are not
reconfigured. It fails on unexpected lookup results or non-Docker format.
It creates no Cloud Run service, grants no public invocation, changes no billing
configuration, stores no key and does not grant project-wide registry admin.

The script creates an empty repository; subsequent storage/transfer usage must
fit the £5 allowance. Existing repository scan/cleanup configuration must be
inspected before uploading. Public invocation remains a distinct requirement;
the first runtime deployment can remain private. No new IAM authority is inferred
from the Sites publication.
