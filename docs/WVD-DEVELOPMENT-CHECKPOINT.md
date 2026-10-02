# WVD development checkpoint

Authority: agreed founder brief and subsequent instructions in the development
conversation. The repository development standard governs implementation. This
checkpoint records progress; it does not replace product requirements or release
approval. Continue independent authorised development without founder-local pulls.

## Established direction

Build WVD's public services site and scoped client project portal. Use the
existing Google/Firebase platform, reuse Human V1/PECP/WVD code and configuration,
and introduce no new service subscription or external spend without approval.
Development pushes are authorised; production deployment requires approval of an
exact tested release. Preserve product/customer isolation.

## Implemented development foundation

- Public services/about pages and synthetic hospitality/salon demonstrations.
- Scoped project views, Owner-only version approval, feedback, tickets and replies.
- Shared domain with local SQLite and bounded transactional Firestore adapters.
- Firebase server token checks and trusted revision-checked access provisioning.
- Immutable review text and approval digest binding, with transactional operator
  attribution references (not verified IAM-principal attribution).
- Client histories preserve approved review text and saved feedback across new
  versions and persistence reopen; legacy approvals explicitly lack review text.
- Synthetic emulator sign-in and disposable offline container verification with
  commit-bound screenshots, video and results; native Windows checks retained.
- Versioned scope-bound aggregate backup verification and isolated SQLite disk
  restore rehearsal; live Google restore and retention remain unfinished.
- Standard/factory inheritance of continuous development from the agreed brief.

## Remaining development and release acceptance

Continue from unmet brief criteria, inspecting existing source before building.
Remaining work includes live Google browser authentication/server runtime access,
production persistence and migration acceptance, colleague/admin workflows,
external deliverable/version binding, notification delivery, Calendar/Meet
integration, hosting/TLS, monitoring, retention and backup/restore rehearsal.
Dependency remediation and independent integrated release review remain open.
The Firestore aggregate and local authentication are development proofs; passing
emulator tests does not establish production readiness.

## Access dependencies

Scoped Google access is founder-approved but the runtime credential connection
is unactivated. Project ownership and billing-disabled status were verified by
founder CLI output. Do not require the founder's laptop for independent emulator,
domain, UI or container work. Live connection, hosting cost or production release
steps must wait for their actual access/approval prerequisites; do not invent
credentials, enable billing or mutate another product to bypass them.

## Verification references

Prior operator-history slice: 299352a6f061d6080e519617d9a4ce7b8959243a,
container run https://github.com/aquaviator/wvd/actions/runs/37033807179.
Continuous-development rule: 1b914c95a765cb2eec10671002ef8c9139917ca3,
all applicable CI runs passed. Client history and backup rehearsal changes are verified by the push-triggered
CI. The first history browser run found an ambiguous test selector; the next
revision scopes that selector to the approval record. Inspect exact commit runs and
bounded evidence before recording integration success. GitHub artifacts expire
after one day; run results remain the durable verification reference.
