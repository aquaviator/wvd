# Controller continuation — 5 October 2026

Read this with AGENTS.md, WVD-PROJECT-AUTHORITY.md, the development checkpoint,
WVD-ACCESS-AUTOMATION.md and WVD-ACCESS-HANDOFF-2026-10-05.md. Existing authority,
personal-calendar blocking, Sites ownership and GBP 5 total hosting allowance
remain unchanged. The authorised one-message email test is complete; do not repeat.

## Isolated work and source ownership

Recovered the remote development branch at
`e0ce5cb6143f2ff28c713a839518290127847925` into a separate checkout. Its push/PR CI
runs 37331026271 and 37331035086 passed. The previous implementation's offline
container 37330368500 passed; that run does not certify these new changes.

The previous controller checkout contains unfinished booking-confirmation HTTP,
recipient and server changes last observed on 5 October. This continuation does
not adopt or overwrite that work. Check current branch activity and reconcile
that controller's handback before selecting the booking integration task. A dirty
checkout is not proof that the controller is still running or that its work is
verified. Do not commit all files from that checkout as this slice.

## Completed bounded task

Added executable CI access-receipt reconciliation, reusing accessReport and the
existing Google binding. Exact repository/owner, workflow, branch, commit,
attempt, identity, complete job list and probe outcomes are checked. Partial
access checks, workflow/job failures, stale evidence and missing steps remain
distinct. The CLI accepts no caller override of current binding/time and emits
no raw metadata. It neither sends mail nor changes permissions or registry state.

Negative tests exposed a shared-array bug in accessReport: mutating one report's
capability array changed future reports. Each report now owns its capability
arrays. Local factory suite: 56 passing, zero failures; diff whitespace check
passed. Verified CI/container evidence for this source is recorded below.

The saved receipt for source `4639ee686819922c87cd91c87546f4c61bcd8fa8`, run
37330368559 attempt 1, matched freshly retrieved GitHub run/jobs metadata at
15:30 UTC. Its original observation remains 15:09:11.742 UTC; this does not refresh
resource access or authenticate arbitrary caller-supplied JSON. Original artifact
provenance is in the access handoff. No live send or new provider probe was needed
for that reconciliation.

Next: reconcile the outstanding booking-confirmation HTTP/recipient handback and
continue the agreed integration backlog. Customer-mail activation, public
admission, Sites connection and operational backup/recovery remain outstanding;
receipt reconciliation does not complete those features.

## Verification and durable evidence

Implementation source: `b3accba8c64e1a135f86f61182ffff0f9a2287c4`.
Push CI 37333653024 and PR CI 37333661305 passed all four jobs. Google access
37333652942 passed; its downloaded artifact 11355965408 matched SHA-256
`c05de9f5492270617a248f2b98d3ff58c53bc2a09af95555e9135eac7bae3d42`.
The new reconciler matched the receipt against freshly retrieved complete
run/jobs metadata. Preserve its original observation time, 15:33:17.621 UTC;
the receipt is saved at `tools/factory/evidence/google-access-37333652942.json`.
No extra test message was sent. The existing workflow's authorised provider
checks are unchanged; this is not customer-mail activation.

Offline container 37333652922 passed. Artifact 11355466889 matched SHA-256
`abfa32a24aefe3b91d083fba60369d496858d109227701e33fb113ac7d734dac`.
Its results.json binds that exact implementation source, Node v22.23.3,
Playwright 1.62.1, demo-wvd-portal and liveAccess=false. Portal unit and Firebase
browser suites passed. Image identity:
`sha256:0e3834530b07816b051ddd631e3885bc650947265bb90ad1d6b71fcba59d9d00`.
The mobile private-management screenshot was inspected; original branding,
private-link controls and contact CTA remain present. One supplementary video
was omitted under the existing evidence cap; required screenshots were retained.

The evidence follow-up also preserves the CLI's prior executable mode (100755),
which the connector tree creation had flattened to 100644. It changes no JS
content beyond the verified implementation. Current GitHub read/write evidence
is recorded in the access registry without credentials or provider response data.

## Subsequent continuation — confirmation HTTP integration

Resumed from remote 0b355a7391f1018ff5828a80eaead048787d39a9. Fresh GitHub
inspection found push CI 37334274552 and PR CI 37334281074 successful, with no
active runs among the latest eight and no subsequent development-branch commit.
Used an isolated worktree; left both previous dirty checkouts intact. Adopted only
the unfinished booking-confirmation HTTP/resolver files and their tests from the
older checkout, then independently completed and verified them. The previous
mail-rehearsal edits were not adopted and no live test was repeated.

Completed the optional server boundary using the runtime's existing admission,
management, origin and capacity settings. Verified consent, recipient proof,
current capability, encrypted durable queue, concurrent single send, exact retries,
changed-recipient conflict and revoked-link denial through HTTP. Firebase recipient
proof reuses current-account validation and denies revoked/disabled/changed-email
identities. The generic host resolver preserves the future guest journey; no new
registration requirement or public email endpoint is activated.

Local portal suite before final identity adapter refinement: 523 passed, one
Windows-only skip, zero failures. Focused current-account tests after refinement
passed; exact final-source CI/container evidence will follow. See
WVD-BOOKING-DELIVERY.md for configuration and outstanding integration boundaries.

Next bounded work: guest recipient verification and explicit host activation
configuration, preserving no-registration booking and no new live messages without
specific authority. Public admission, Sites connection and operational backup /
retention remain open. The existing composed Google worker and optional HTTP route
are available for reuse; do not rebuild them or repeat the completed email test.
