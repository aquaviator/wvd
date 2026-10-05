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
passed. CI/container evidence for this source is pending until appended below.

The saved receipt for source `4639ee686819922c87cd91c87546f4c61bcd8fa8`, run
37330368559 attempt 1, matched freshly retrieved GitHub run/jobs metadata at
15:30 UTC. Its original observation remains 15:09:11.742 UTC; this does not refresh
resource access or authenticate arbitrary caller-supplied JSON. Original artifact
provenance is in the access handoff. No live send or new provider probe was needed
for that reconciliation.

Next: inspect this change's CI and isolated container; fix any relevant failure.
Then reconcile the outstanding booking-confirmation HTTP/recipient handback and
continue the agreed integration backlog. Customer-mail activation, public
admission, Sites connection and operational backup/recovery remain outstanding;
receipt reconciliation does not complete those features.
