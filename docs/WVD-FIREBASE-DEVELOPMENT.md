# WVD Firebase development connection

Console setup verified on 2 October 2026. This is development infrastructure,
not a production release or proof of a connected application runtime.

| Binding | Verified value |
| --- | --- |
| Project | `wvd-development` (WVD Development) |
| Project number | `6616382131`, founder verified with Google CLI on 2 October 2026 |
| Console | https://console.firebase.google.com/project/wvd-development/overview |
| Billing | Spark, console states no-cost $0/month |
| Firestore | Standard edition, `(default)` database |
| Data location | `eur3` (matches the observed Human V1 database location) |
| Client rules | All reads and writes denied (`allow read, write: if false`) |
| Web app nickname | WVD Portal Development |
| WVD server namespace | `wvd_products/wvd/private/portal-state` |
| Authentication | Initialized; Google sign-in enabled and verified in console |
| Google provider support identity | `leatfield@gmail.com`, explicitly approved by founder |
| Runtime credentials | Not connected; local Google Application Default Credentials absent |

The project and database were created through the authorised Firebase console.
No billing account was attached or plan upgraded. Optional Gemini and Analytics
were disabled in initial setup. No Human V1 data, rules or deployment was changed.
The web app was registered without deploying Hosting. No service-account key,
OAuth secret or user password was collected into the repository or documents.

`tools/portal-proof/firebase.development.json` is an explicit backend binding.
Its `live` value means a real Google endpoint rather than an emulator; the project
is development-only. It is not loaded automatically and does not grant credentials,
provision identities, seed data, start a server or deploy anything. Use with
`createFirebaseBackend` only after the approved development runtime has Google
Application Default Credentials. Signing into the console does not give the
local Node application those credentials.

The existing Firebase/Firestore adapter and emulator tests remain the reusable
implementation. Human V1's `hv1-platform` is active on Blaze with existing data;
WVD uses a separate Spark project to isolate writes and keep new external spend
at zero. Existing PECP customer deployment requirements remain unchanged.

## Remaining connection work

1. Google sign-in is configured with public name `WVD Development`. Adding
   another project member or creating privileged runtime access still needs a
   concrete access review. Browser sign-in UI integration is unfinished.
2. Connect an approved development runtime credential mechanism. Prefer short
   lived identity or workload identity over downloading a long-lived JSON key.
   Credential values belong in the approved secure mechanism, not this binding.
3. Integrate browser sign-in with trusted WVD provisioning and verify the full
   live development flow. Firebase registration alone never grants WVD access.
4. File storage and scheduled backups are not provisioned. Any required billing
   upgrade needs a cost decision; Spark setup does not imply those capabilities.

Production deployment, DNS changes and production acceptance remain separately
subject to founder approval. The bounded Firestore aggregate and unfinished
operational requirements in `tools/portal-proof/FIREBASE.md` still apply.

## Proposed keyless runtime access (not granted)

Cloud Shell's embedded frame displayed `Site Unavailable` / `Unable to access
this site`, including after one reload/retry in this browser. Its credentials
were not established or transferred. Console sign-in and provider setup succeeded.

The proposed next connection is GitHub OIDC through Google Workload Identity
Federation, reusable by the authorised development pipeline:

| Access element | Proposed restriction |
| --- | --- |
| Google project | `wvd-development` only |
| Runtime service account | `wvd-portal-development@wvd-development.iam.gserviceaccount.com` |
| Firestore role | `roles/datastore.user` for development reads/writes |
| Auth role | `roles/firebaseauth.viewer` to verify user state and revoked tokens |
| GitHub repository | `aquaviator/wvd`, immutable repository ID `1347788556` |
| GitHub owner | immutable owner ID `78605956` |
| Allowed ref | `refs/heads/development/shared-factory-bootstrap` |
| Allowed event | Explicit development workflow dispatch or development branch push; no PR tokens |
| Credentials | Short-lived federated credentials; no downloaded JSON key |
| Exclusions | No Human V1 access, IAM administration, billing changes or deployment permissions |

The provider must check the immutable owner/repository claims and exact ref/event;
a repository name alone is insufficient. Bind service-account impersonation only
to that restricted identity. Google project number and actual provider resource
IDs must be inspected before writing executable bindings. Roles here are a concrete
approved scope, not proof of granted access or an activated workflow. The founder
confirmation is recorded below; activation remains blocked.

## Approved access and blocked activation

The founder approved the scoped keyless access above on 2 October 2026. Approval
is recorded; it does not need repeating. No grant has been made: the Google Cloud
IAM console also displayed `Site Unavailable` after one retry. This environment
has neither `gcloud` nor Google Application Default Credentials.

Google's deployment-pipeline federation setup guide lists enabled project billing
as a prerequisite before enabling the required APIs:
https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
The Firebase console currently reports Spark. Do not attach billing or upgrade
on the strength of the access approval. No billing exception has been verified.

From an already authenticated Google Cloud terminal, run this **read-only** check:

```sh
node tools/portal-proof/google-preflight.mjs tools/portal-proof/firebase.development.json
```

It reuses the strict Firebase binding validator and only describes the specified
project and its billing status. It prints project identifiers and prerequisite
status, never credentials. Exit 2 means billing is not enabled; exit 1 means the
check could not verify its inputs or Google access. Exit 0 still does not prove
IAM grants or application integration. Share only that non-secret result for the
next connection step. The script cannot enable APIs, modify policies, attach
billing, provision data or deploy. A federated workflow remains inactive until
these prerequisites and the actual restricted provider can be verified.

Reuse decision: keep the existing Firebase Admin adapter, strict configuration
validator and emulator verification. No new auth framework or cloud provider was
added. This missing read-only prerequisite check is isolated from provisioning.

Founder-provided Google CLI output on 2 October 2026 verifies project lifecycle
`ACTIVE`, project number `6616382131`, and `billingEnabled: false`. The local
Windows SDK works; the original Node launcher did not resolve its PowerShell
wrapper. The check now launches a fixed PowerShell command on Windows and passes
validated arguments separately as JSON, without changing execution policy.
Windows CI verifies the wrapper from a directory containing spaces. Local Google
CLI sign-in remains distinct from application ADC and does not create IAM grants.

## Automated Workspace access preparation — 3 October 2026

Founder reports billing is now active. This supersedes the earlier disabled-billing
report as user-provided context; live Google readback is still required.
`tools/google-development-access/README.md` records the prepared keyless workflow,
scoped bootstrap and Drive/Calendar preflight. Reuses the proposed service account;
no new identity, IAM/API grant, Drive/Calendar ACL or live authentication is claimed.
The setup never attaches billing or creates a long-lived key. Synthetic tests run
with the existing portal suite/container; live credentials are excluded from them.
