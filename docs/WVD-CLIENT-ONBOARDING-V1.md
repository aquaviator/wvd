# WVD Client Onboarding and Client Portal v1

## Scope and authority

Requested 7 October 2026: extend the existing WVD Portal with owner invitations,
secure client sign-in, explicit project scoping and a small client workspace.
Preserve the owner Portal, enquiries, Google mail, branded domain and product
isolation. Add the public Client Portal entry point only after live verification.

Development review: https://github.com/aquaviator/wvd/pull/4
Branch: `development/client-onboarding-v1`, based on shared development
`4e7c18465c8199ef2793b2dba8c97b1df1765f01`.

## Implementation

- The configured WVD owner creates a private invitation link for a named Google
  email and explicit project set. The UI selects one project. Maximum lifetime
  is seven days. Invitations are listed and may be revoked before redemption.
- The existing opaque-token/digest mechanism stores no invitation bearer token.
  The fragment is removed from the browser address immediately; sign-in tokens
  remain in memory. No automatic invitation email is sent.
- Redemption checks a current verified Google account, exact recipient email,
  invitation expiry/revocation and the issuer's current authority. A transaction
  grants client Owner approval rights only to the named projects; this is not
  WVD administration. A later invitation can add explicitly named projects.
- The live owner resolver remains separate and explicitly UID/email bound.
  Client sessions cannot substitute another stored administrator. There is no
  first-user bootstrap, token-role trust or browser-selected identity mapping.
- Clients receive only Overview, Progress, Deliverables, Feedback and Support.
  Server-side action and response allowlists exclude enquiries, accounts,
  colleague administration, internal fields and other projects. Domain checks
  run on every project operation, including mutations and retries.
- Existing owner project creation, progress updates, review publication,
  client account project assignment and enquiry inbox remain in place.

## Reuse decision

Adapted existing `firebase-auth.mjs`, `firebase-invitations.mjs`, invitation
state/digest contracts, `FirestorePortal`, transactional `PortalProof`, live
Google browser client and Cloud Run composition. Existing Member invitations
remain Member-only; a distinct trusted client-invitation entry point permits
the bound WVD owner to grant client approval rights. No provider, account,
hosting target, database or service subscription is introduced.

Development Standard 1.5.0, reuse catalogue and access registry were read.
Private routes retain no-store/noindex, origin checks, bounded bodies and
concurrency limits. Google guidance checked:
https://firebase.google.com/docs/auth/admin/verify-id-tokens and
https://firebase.google.com/docs/auth/admin/manage-sessions.

## Baseline and live gate

Authenticated Google metadata confirmed live revision `wvd-service-00005-4xb`,
source `e82753a43c5b39253d17a2920784be4fa10b220e`, image digest
`d23240922b2a6c33c6d7b5d8f739af48b668e1834b7dac44715e8dbc5887c1a3`.
The live configuration hash was recomputed and matched. Owner binding is set;
the same service account, one-instance cap, concurrency four and 512 MiB remain.
See `evidence/wvd-client-onboarding-live-baseline.json`.

Native Sites read confirmed the public WVD Site remains version 7 at
https://wearvalleydigital.com. Its existing source was recovered through the
supported helper at `1de317f95f43d11675303f2d270e2dbaed73bc78`. Existing links say
Portal/Portal sign-in; no Client Portal label or publication has been made.

The user supplied leatfield@gmail.com for the synthetic client sign-in check.
No live synthetic client/project or invitation has been created yet.

## Verification status

Focused local authentication, invitation, HTTP and boundary regressions passed
(128 checks at b64d154). Six current onboarding/projection tests pass, covering
cross-client and same-client/unassigned-project denial, wrong email, disabled or
unverified account, wrong provider, expiry, revocation, replay, missing identity,
forged administrator, internal-field exclusion and additional project grants.

CI at `58271952be60960e5fd32e0f23473d01afcca020` passed Validate and build run
37595165027. An earlier new-browser fixture failed because a fragment navigation
does not rerun its synthetic account initialization; the fixture was corrected
without changing production identity checks. Current candidate verification
and isolated container evidence must be reconciled before release.

The deployment verifier now expects the invitation capability exposed by the
live composition. Its previous-release guard uses the authenticated baseline
above, preserving the owner-bound configuration and rejecting unexpected drift.
Local onboarding and deployment checks passed 19 cases; the twentieth needs
the missing local Python alias and remains covered by Linux CI.

The broad local suite also exposed three host-environment failures: POSIX-only
CLI fixture paths/permissions on Windows, multiple installed gcloud wrappers,
and missing `python3`. CI's Linux and Windows jobs are the authoritative
cross-platform checks; local failures were not reported as passes.

## Remaining work and limits

- Complete current-source CI and isolated Firebase container verification.
- Obtain the approval required by automatic review for the shared-branch push;
  the direct push was rejected for possible shared CI/deployment side effects.
  The isolated development branch and draft PR are allowed and do not deploy.
- Deploy through the existing reviewed-source Google workflow, using the fresh
  live baseline rather than the stale owner-null receipt in the older record.
- Exercise the actual owner invitation and client Google sign-in, project
  views, feedback/support and negative API cases. Isolate or clean up the
  synthetic records and revoke their project access after verification.
- Only then update the public entry point and publish via the existing Site.
- Invitations are copy/share links. Google sign-in is the only live provider.
  File-backed deliverable previews are not connected in this live composition;
  their approvals remain disabled. Published text reviews can be approved.
- The existing bounded aggregate has a 512 KiB state cap and 200 invitation
  records per client; archival/large-scale onboarding is outside this v1.

This receipt records an implementation candidate, not a completed live release.
