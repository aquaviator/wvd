# WVD automated Google development access

Status: repository configuration prepared; Google IAM, API activation, Workspace
resource grants and a live authenticated run are NOT verified. The founder reports
billing active on 3 October 2026; bootstrap verifies this from Google before writes.
This is not an always-on development agent or a production deployment.

## Reuse and scope

Uses the service-account/provider names from the interrupted Controller Cloud Shell instructions. These supersede the earlier proposal in
`docs/WVD-FIREBASE-DEVELOPMENT.md`: `wvd-development@wvd-development.iam.gserviceaccount.com`,
project `wvd-development`, number `6616382131`. Assess existing account/pool/provider
before creation. If the alternative previously proposed account/provider is present, stop for reconciliation. Existing mismatched providers fail for review rather than being
silently widened or replaced. Existing project roles are not altered.

The existing `google-preflight.mjs` verifies Firebase project/billing prerequisites,
not Workspace permissions. The new preflight deliberately does not call Firebase
Admin: it checks Drive metadata and Calendar free/busy with a narrowly scoped,
short-lived OAuth token. The existing Drive revision adapter remains the app
implementation; this probe does not replace it or prove that a deliverable
revision is retained. No Firebase live integration is claimed by this workflow.

## Trust boundary

Only repository ID `1347788556`, owner ID `78605956`, exact branch
`development/shared-factory-bootstrap`, and exact workflow
`.github/workflows/google-development-access.yml` can impersonate the service
account. Only push or workflow_dispatch events are admitted; PR/fork tokens fail.
Ordinary tests and the offline container receive no live Google credentials.
The action requests a ten-minute token with `drive.readonly` and `calendar.freebusy`
scopes; it does not write credentials files, deploy, send messages or reserve slots.
No project IAM owner/editor, billing or Workspace domain-wide delegation is granted.
GitHub repository admins able to change this trusted workflow remain trusted.

## Activation from an already authenticated Google administration terminal

1. First run `python tools/google-development-access/discover.py` from the authenticated Cloud Shell. This read-only report verifies project/billing, existing service accounts, APIs, pool/provider trust and scoped IAM bindings. It prints no keys/tokens or Workspace content. Treat pasted commands as intent, not proof they succeeded.
2. Run `python tools/google-development-access/bootstrap.py` to inspect prerequisites
   and planned commands. No credentials are printed. Then `--apply` performs
   only the scoped IAM/API operations. Existing configuration drift blocks it.
   The bootstrap verifies enabled billing, but never attaches a billing account
   or changes its settings. It enables only IAM, IAM Credentials, STS, Drive and
   Calendar APIs; it creates no paid compute/storage resources. Existing spend
   authority remains £0; billing activation alone is not authority for new spend.
3. The resource owner explicitly shares the supplied brand asset folder as
   **Viewer** with the service account. Binding:
   `14zXOECtPzSOP5OOqN1wmDtvk4dXsH6c4` (Previous Development Brand Assets).
   Inherited Viewer access supplies image reading; no Drive root grant or writer
   authority is included. Register additional exact targets only as needed.
4. Verify the intended WVD development Calendar's ownership and grant
   **See only free/busy (hide details)** to the service account. The earlier WVD
   Calendar ID is recorded in `binding.json`; it is a proposed target, not proof
   of a current ACL or complete conflict-calendar coverage. No events are read
   or written and no booking authority follows from this grant.
5. Set repository Actions variable `WVD_GOOGLE_ACCESS_ENABLED=true` only after
   those prerequisites are met. No token or JSON service-account key belongs in
   repository variables or secrets. Put the workflow on the trusted development
   branch; a workflow on another branch is denied intentionally.
6. Inspect the Google development access run. PASS means the listed targets were
   readable at that moment; BLOCKED stops subsequent live tests. Authentication
   failure before the probe appears in the auth step. Missing-target errors never
   become an empty calendar. Reports contain statuses only, no filenames, bearer
   tokens, calendar identities, busy intervals or customer data.

The bootstrap is resumable but not transactional: interrupted apply can leave
partial IAM/API setup. Re-run inspection rather than creating another identity.
It does not create Drive/Calendar ACLs or configure GitHub repository variables.
It deliberately does not grant Firestore/Firebase roles for these read-only probes;
those separately approved task permissions remain a distinct activation step.

## Verification

`node --test tools/portal-proof/tests/google-access-preflight.test.mjs` exercises
success, denied access, per-calendar failures, mismatched targets, missing tokens,
invalid bindings, oversized/malformed responses and token-safe error handling.
These tests are picked up by the existing portal suite and offline container.
Synthetic tests cannot establish real credentials, Google ACLs or IAM policy.

Sources:
- https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
- https://github.com/google-github-actions/auth
- https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
