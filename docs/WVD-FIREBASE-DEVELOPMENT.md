# WVD Firebase development connection

Console setup verified on 2 October 2026. This is development infrastructure,
not a production release or proof of a connected application runtime.

| Binding | Verified value |
| --- | --- |
| Project | `wvd-development` (WVD Development) |
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
proposal, not proof of granted access or an activated workflow. Founder confirmation
is needed at the browser action that creates this security-sensitive access.
