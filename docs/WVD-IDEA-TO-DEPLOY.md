# WVD idea-to-deployment operating contract

Founder direction, 8 October 2026: idea → research → blueprint → build → deploy
for ideas within the existing WVD scope. Optimise for verified customer outcomes,
elapsed time and total AI usage together. This is the connected agent's working
process, not a claim that a background autonomous service exists.

## Start from one idea

The founder supplies the idea in ordinary language. The controller creates the
bounded contract from `tools/factory/idea.example.json`; do not require the founder
to fill JSON. Infer routine choices from the agreed product brief. Ask only for
missing facts that materially affect scope, authority, cost or irreversible work.
Record assumptions explicitly. Check existing work ownership before starting.

Supported blueprints inherit the factory's existing flavours: public websites,
web applications, Android applications and enterprise platforms. Business tools,
portals and automation belong to the appropriate existing flavour. Unsupported
ideas receive a feasibility/scope decision, not an invented deployment adapter.
Salon and Wedding retain commercial priority and their own release restrictions.
PECP retains customer-controlled deployment. Never migrate a product implicitly.

## Five stages, with evidence

| Stage | Work | Exit evidence |
|---|---|---|
| Research | Define the customer problem; examine alternatives, primary sources, feasibility, risks and running cost. Date changing facts; distinguish assumptions from observations. | Bounded research record with recommendation, source links and unresolved questions. A valid result can be do not build. |
| Blueprint | Select an existing flavour; inspect current reusable code; define smallest useful scope, journeys, data, isolation, UX, acceptance criteria and release route. | Product-bound blueprint and prioritised small work items. Use existing `project` validation for bindings and reuse decisions. |
| Build | Implement the next dependency-ready slice using the product's native stack and existing connections. Use Sites where the existing handoff policy applies. | Exact source revision, reproducible checks, synthetic journey evidence and changed documentation. |
| Verify | Check acceptance, negative access, accessibility, relevant performance and rollback. Resolve findings against the exact candidate. | Test results and review linked to the candidate; explicit limits. Independent review for security/data/release-critical changes through an authorised reviewer, never self-labelled independence. |
| Deploy | Refresh identity, target, audience, cost and product release authority; use existing deployment mechanisms; verify live behaviour and recovery. | Exact deployed source/artifact, target, provider receipt, smoke checks and recovery reference. A build or successful upload alone is not completion. |

Research acceptance requires evidence quality, not an arbitrary number of pages.
Verification depth follows risk: a text correction does not need a new test suite;
tenant access changes need denial tests. Never discard required checks to save tokens.
Use reusable scripts and existing CI; inspect failures before retrying. After two
failed repair attempts, diagnose the cause and change approach rather than looping.

## Execution and recovery

The controller runs these stages using the currently available authorised tools.
The factory CLI generates plans and checks evidence structure; it does not call a
model, create accounts, deploy or authenticate supplied receipt files. Use existing
`run`, `handoff`, `assess`, access discovery and provider receipt verification for
their established purposes. Do not create a second auth, dispatch or release system.

Each stage receipt includes `stage`, `productId`, `planHash`, `predecessorHash`,
`revision`, `observedAt`, `result`, `checks`, `blockers` and `limitations`. Checks
have `id`, `result` and `evidenceRef`; their exact required IDs come from the plan.
Deploy receipts also require `targetRef`, `releaseAuthorityRef` and `rollbackRef`.
Use the prior receipt's reported SHA-256 as the next predecessorHash; research
uses planHash. Record genuine failures, skipped checks and unavailable evidence.
Never make up PASS records to satisfy the checker. Existing provider receipts
remain authoritative; link them instead of copying raw logs into this contract.

Changed ideas require a regenerated plan. Changed upstream evidence invalidates
downstream stage bindings; changed code invalidates build/verify/deploy receipts.
Refresh live permissions and volatile research at use even when hashes still match.
A structural PASS does not establish truth, consent or independent review identity.

On interruption, update the product's current-state record with the candidate
revision, completed evidence, next action, blockers and owner. Resume there after
checking for concurrent changes. Do not restart from historical chat narratives.
Continue available authorised work without routine founder approval gates. Ask
only at genuine access, consent, missing-data, spending or product-release boundaries.

## Context and token discipline

- GitHub owns code, engineering standards, product state and technical decisions.
- ChatGPT project context is a short brief and index of canonical references.
- Drive owns business/source documents and shared assets; fetch relevant changed
  sections only. Do not maintain three competing technical status narratives.
- Keep existing release records; concise Drive checkpoints can link to GitHub.
  This policy does not delete or move existing authoritative documents.
- Default to one focused worker. Delegate only when explicitly authorised and
  independent tasks justify additional context and tokens.
- Target a 24 KB initial task packet; count this as bytes, not measured tokens.
  Retrieve deeper context on demand. Never silently truncate requirements.
- Search before reading whole files. Keep tool output to findings, failures and
  referenced evidence. Avoid repeated full browser trees and unchanged polling.
- Use appropriate reasoning effort for risk; do not change the user's model
  settings silently. Save strong review effort for decisions where mistakes cost more.
- Record available input/output tokens, elapsed time, repair count and escaped
  defects per work item. Unknown metrics remain null. Compare similar tasks;
  do not promise a token-saving percentage without measurement.

## Commands

```sh
node tools/factory/cli.mjs idea tools/factory/idea.example.json
node tools/factory/cli.mjs delivery-status <plan.json> <receipts.json> <40-character-git-sha>
npm --prefix tools/factory test
```

Store real plans, private source slices and receipt working files in ignored
`.factory/` storage. Keep secrets in the existing product-scoped secret store.
`delivery-status` exits 2 for incomplete evidence, 1 for invalid input, and 0
only for structurally complete recorded delivery. No command grants deployment
authority, launches a worker or provisions resources.

## Adoption

Use this contract for the next new in-scope idea and next coherent work item in an
existing product. Preserve existing backlogs and product constitutions. Retrofit
only the current item, not every historical ticket. The first measured pilot must
report both quality and usage before optimising further. The factory's synthetic
tests verify its bookkeeping; they are not a completed live product pilot.
