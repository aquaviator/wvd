# Wedding branch reconciliation — 8 October 2026

## Decision

Pause new Wedding feature changes on the older integration line until its work is
reconciled with the current staging controller. This is a concrete source/ownership
correction under WED-CONT-001, not a product acceptance or release decision.
Both product branches were left untouched. Continue independent authorised work;
do not pause the whole project or request a routine founder review.

The planned durable PREVIEW receipt change was not started. Adding it immediately
would enlarge a newly discovered split. Read the product-owned
[current state](https://github.com/aquaviator/WVD-Wedding/blob/1bcdd422756d15e77c625d669cb3ca0fa8223f93/handoff/CURRENT-STATE.md)
and [AGENTS](https://github.com/aquaviator/WVD-Wedding/blob/1bcdd422756d15e77c625d669cb3ca0fa8223f93/AGENTS.md)
before the older continuation paragraphs. They record controller takeover and
specialist ownership; `development/wvd-completion` is named there but is not an
observed remote branch. Controller liveness is not established by an unassigned PR.

## Exact source findings

| Line | Ref | Head | Commits since common ancestor |
| --- | --- | --- | --- |
| Menu/history integration | development/undecided-date-onboarding | d44ae2a24bc50a3eac87ca3d404e83a27aed88eb | 7 |
| Staging/pilot | development/cloudflare-staging | 1bcdd422756d15e77c625d669cb3ca0fa8223f93 | 19 |

Common ancestor: `75385166583a500b96c12cbf42db919886507977`. Both PR1 and PR2 are
open/draft/unassigned. Master is `95f61d8a58c17a70502510846f7863c72481f7a8`.
GitHub comparisons were read in both directions; four changed paths overlap.
The original contracts are absent from both changed-path lists.

Fresh staging run [37833061625](https://github.com/aquaviator/WVD-Wedding/actions/runs/37833061625)
and all steps of job 113503061528 are successful for exact head 1bcdd422.
This is inspection of provider CI evidence, not re-execution of tests.
WVD base e90780f push 37846693667 also passed all four jobs; PR run 37846700869
passed and container run 37846700829 was skipped. No relevant failure needed repair.

The staging record reports live application 4d89998f402034e86f1d1d249ee19cad291227f1,
Cloudflare version 130c5287-06cc-4f56-a5db-8efb373e0578, approved Wedando branding,
a two-account fictional pilot, and newer scoped verification including local
WED-AT-018. This run did not probe that provider or repeat those checks. The old
Sites ed03a2e reference is historical, not evidence that no newer hosting exists.
The staging candidate remains recorded as undeployed, with hosted usability and
recoverable checkpoint limits. Its backup-download approval issue must not be
retried through another route. Neither original NOT_RUN fields nor newer targeted
PASS records establish complete commercial acceptance.

## Reproduced integration hazards

Pinned UTF-8 files from each head and the common ancestor were compared using
`git merge-file -p integration base staging`. No repository refs were modified.
The workspace route produced two conflict blocks (exit 2); the library and two
handoff files merged textually (exit 0). Source digests and results are in
[the evidence receipt](evidence/wedding-branch-reconciliation-2026-10-08.json).

| Location | Required combined behaviour |
| --- | --- |
| workspace route: postpone | Preserve stable meal references in response history and staging's pending-only outbox transition. Do not reactivate terminal or paused jobs. |
| workspace route: withdraw | Preserve explicit review, strict invitation integrity, prior meal ID/review history, clearing current meal references, revision protection and immediate pending-audience suppression. |
| workspace route: queue/cancel | Preserve paused-RSVP queue denial, archived publication and pending-only cancellation transitions. |
| library/helper and caller | Staging sends `reviewed:true`; the integration helper accepts only `invitation` and optional `reason`. Validate review at the route, then deliberately reconcile the payload. |

A synthetic call against the conflict-free merged library reproduced `INVALID`
for `{invitation, reviewed:true}` with state unchanged. This is an expected
compatibility failure, not a passing product scenario. The staging UI callback
and route independently confirm this payload. Selecting a whole side or merely
accepting a clean library merge would lose behaviour. Also retain cleanly merged
partner-cap enforcement, DELETE_PENDING media handling and RSVP-aware outbox
review/module pause. Decide and test new-key repeat withdrawal separately from
exact-key replay: the current branches differ on already-withdrawn invitations.

A distinct read-only reviewer checked the overlapping files and confirmed these
requirements plus the payload incompatibility. That reviewer did not independently
verify ancestry, run application tests or certify either candidate. No merged
application, runtime build, deployment or full acceptance was claimed.

## Next bounded work

1. Refresh all remote branches, PR2/current-state and named ownership. Consume an
   existing handback if available; do not dispatch duplicate pilot/frontend work.
2. The owning integration controller should reconcile these two source files and
   the seven integration commits in one isolated candidate, preserving staging's
   auth/build/branding and both original histories. Keep historical handoffs and
   explicitly distinguish source-recorded provider claims from fresh probes.
3. Run both sides' focused withdrawal, menu, response/history and lifecycle suites,
   plus typecheck/build on that exact complete candidate. Add coverage for the
   reviewed payload, pending audience suppression and new-key repeated withdrawal.
   A distinct reviewer must examine the resolved candidate before release work.
4. Resume durable PREVIEW idempotency only after that reconciliation. Its existing
   gap is unchanged. If ownership remains unavailable, continue Salon's existing
   distinct research/acceptance work rather than creating another Wedding line.

No new release authority follows from this investigation. No product code, live
data, messages, access rules, binary assets or spending changed. Salon stays at
0d33503f555bb557e3b89c32c49551253762f992 with its intake/research gates open.

The factory idea plan is 51e1620a7abb7118187e4a976167f7cae2db71749561fe86348015be67411f71.
Only research evidence is complete; reconciliation blueprint/build/verify/deploy
remain incomplete. The CLI is a structural check, not delivery proof. No full
application checks were repeated for unchanged source. Usage/elapsed metrics
remain null where not measured; repair count zero for this investigation.

Drive direct-child monitoring overlapped from 2026-10-08T21:04:33.677Z and found
only the previous Wedding START record, modified 21:24:36.066Z. It did not discover
the staging changes; this demonstrates why all branch heads must also be checked.
The queue remains modified 2026-10-05T17:02:00.977Z. The START record now has a
revision-guarded correction near the top, linking the pinned staging current-state
record; text, effective link typography, one date chip and seven rich links were
verified. Keep the next monitor overlapping from 21:24:36.066Z and compare content
as well as native revisions. This was not recursive brand-asset verification.
