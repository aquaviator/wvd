# Shared factory bootstrap 0.1.0

Idea intake and delivery evidence now use the controller-operated
[idea-to-deploy contract](../../docs/WVD-IDEA-TO-DEPLOY.md):
`node cli.mjs idea idea.example.json` generates a bounded blueprint/stage plan;
`node cli.mjs delivery-status <plan.json> <receipts.json> <git-sha>` reports the
first incomplete stage and invalidated evidence. These commands do not dispatch
agents or deploy. Existing provider execution and verification remain required.

Workflow 1.2.0 requires the inherited public-discovery check IDs in stage receipts:
the six route/content/privacy checks belong to `verify`, and
`deployed-url-verification-and-search-observation` belongs to `deploy`.
Use the generated stage criteria rather than a hard-coded generic check list.
Each needs PASS with an evidence reference bound to the exact candidate through
the existing receipt chain. Missing, NOT_RUN or reference-free checks hold delivery.
Regenerate older plans and review their evidence bindings; do not relabel historical
receipts. Planning checks stay NOT_RUN: receipts carry the actual observations.
Search observation records what was found, including not indexed; it does not
require or guarantee indexing. Private-only scope needs evidence of that boundary,
not publication or wider access. The checker validates structure, not factual truth.

All task packets inherit the versioned [WVD development standard](../../docs/WVD-DEVELOPMENT-STANDARD.md):
existing Google platform, no new service subscriptions and reuse before build.
Run `node cli.mjs standard` to inspect the profile and revision-bound candidate
catalogue, or `node cli.mjs project product.example.json` for a fictional project
configuration check. New manifests can supply `productConfig`; its product ID
must match the manifest. Explicit targets and reuse review evidence are required,
and missing connection references stay unverified. These commands provision
nothing. Existing context-only manifests also inherit the standard.

Dependency-free Node 20+ infrastructure for any project, separate from the public
website. Implements runtime preflight and bounded source/context task execution.
This is a first implementation slice, not an autonomous agent service or a replacement
for the preserved WI-013 prototype.

```
npm --prefix tools/factory test
cd tools/factory
node cli.mjs preflight
node cli.mjs run .factory/manifest.json .factory/runs
node cli.mjs handoff <context.json> <task.json> <new-handoff-directory>
node cli.mjs assess <work.json> <review.json> <exact-output-file>
```

A schemaVersion 1 manifest supplies projectId, sources and tasks. Each source has
id, revision, relative path and SHA-256 of the exact UTF-8 snapshot. Each task has
id, adapter (`assemble-context`), sourceIds, dependencies, blockers and maxBytes.
The connected Drive tools export authoritative current sources to ignored `.factory`
snapshots; the assembler does not hunt through unrelated documents or contact Drive
with guessed credentials. Select small source slices upstream; oversized packets
stop explicitly rather than dropping requirements.

Each run verifies actual file access, checks the acyclic graph, validates source
hashes, prepares packets in dependency order and atomically checkpoints each task.
Unchanged packets are reused after verifying saved output bytes. Source/revision or
upstream changes regenerate affected packets. A blocked task leaves unrelated tasks
eligible. A project lock prevents concurrent state writers; after a crash, inspect
the recorded PID before manually removing a stale lock. Failed context tasks can be
rerun after their missing input is corrected; no model calls or semantic retries occur.

`handoff.mjs` creates immutable worker/verifier packets from exact context bytes.
For session execution the Controller dispatches the assigned specialist using the
session agent tools, then dispatches a distinct verifier with exact sources/output.
The JSON work/review records are supplied through the `assess` CLI; no API key is
needed for session agents. The CLI is a file bridge, not a background daemon.
Its assessment checks task/context/output hashes, distinct creator/reviewer IDs,
complete criterion evidence and absence of blockers. Tests use labelled synthetic
reviews; no independent live review is claimed. Identity authenticity and semantic
evidence sufficiency require the connected trusted provider/reviewer. A passing
assessment does not itself dispatch an agent, merge code or authorise release.

Private source text and context packets must stay outside Git. No raw credentials
belong in a source snapshot. Credential vault injection, agent/model dispatch,
independent verification, provisioning and production release are not implemented
by this slice. PREPARED means a context packet exists; it never means verified or DONE.
Output paths and supplied source files must reside in trusted operator-controlled
directories. Receipts are operational state, not cryptographic proof of reviewer identity.
