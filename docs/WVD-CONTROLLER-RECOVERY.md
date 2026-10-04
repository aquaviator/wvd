# WVD Controller recovery — 4 October 2026

Founder explicitly transfers the Controller role to this working conversation
because the previous Controller cannot recover from Error in message stream.
Resume the agreed WVD website/client portal brief and unattended development
standard. GitHub is engineering authority. Drive remains business/documentation
and original-brand-asset authority. No production deployment or new external
spend is authorised by this role transfer.

## Recovered committed baseline

Main development PR #2: `development/shared-factory-bootstrap`, source
`b1a2dd665dedfe36531a7e9dfb89487da220d7ce`. Current product scope and remaining
acceptance are recorded in `WVD-DEVELOPMENT-CHECKPOINT.md`. Read that and the
standard before selecting further work; do not reconstruct a second application.

Access PR #3: `development/google-keyless-access`, original source
`258fd77b517ea2b64b40faeaecaf5b2ad350b5bd`. All CI jobs and offline container run
37130141490 passed for that source. The tests include 370 applicable portal cases;
passing synthetic/container tests does not prove live IAM or Workspace access.
This recovery changes access bindings/discovery, so those prior results alone
cannot certify the recovered version.

The failed chat's private scratch state is unavailable. Whether uncommitted work
was lost is UNKNOWN; no loss is asserted and no committed work is missing from
the observed repository. The recovered local checkout is clean before this slice.

## Reconciled intended access identity

The user-provided Controller Cloud Shell instructions name:

- Project `wvd-development`, number `6616382131`.
- Service account `wvd-development@wvd-development.iam.gserviceaccount.com`.
- Pool `wvd-github-development`, provider `github`.

PR #3 initially used different service-account/provider proposals. The prepared
binding now matches the Controller instruction names. Actual provisioned state,
provider condition and IAM bindings remain UNKNOWN until read-only discovery.
No second account/provider is created automatically to resolve the mismatch.
Existing incompatible or broader trust requires explicit reconciliation.
The bootstrap never silently overwrites a provider or grants project owner/editor.

Founder reports billing active. No authenticated gcloud is available in this
runtime; the Google console showed Site Unavailable after one reload on 3 October.
Read-only discovery from an already authenticated Cloud Shell is the next live
prerequisite. It exports no credentials and makes no IAM/API/billing changes.

## Immediate execution sequence

1. Verify this recovery slice with focused tests plus existing CI/container checks.
2. Integrate access work into the authorised development branch, preserve PR #2.
3. Inspect the read-only discovery output before IAM mutation or activation.
4. Verify explicit brand-folder Viewer and Calendar free/busy grants, then run
   the gated authenticated workflow. Do not activate it from synthetic evidence.
5. Continue independent scoped portal/UX work while live access is unresolved.

Brand originals: Drive folder `14zXOECtPzSOP5OOqN1wmDtvk4dXsH6c4`, eight assets.
No asset redesign or production branding acceptance is inferred from storage.
Controller coordination is now recorded in repository checkpoints and PR comments;
there is no direct cross-chat wake or always-running background worker.


## Recovery completed and live read access verified

The recovery/discovery sequence above is historical. Founder CLI output confirmed
the intended project/account/pool/provider, billing active and existing federation
principal binding. Drive and Calendar APIs were enabled, brand-folder Viewer and
named Calendar free/busy grants were made, and the GitHub activation variable
was set. No duplicated account/provider or service-account key was created.

On 4 October 2026, source `cfb67ada8139dd90154ece1aa0100b96f9604dbb` passed
keyless authentication, both access probes and the portal's live Calendar
adapter contract (run 37198247121). All four CI jobs passed (37198247105), as did
the offline container (37198247106); downloaded evidence matched that source.
The exact grant scope remains read-only, and these results do not activate a
hosted application, production release, calendar writes or new external spend.
Current next work and remaining booking inputs are recorded in the checkpoint.
