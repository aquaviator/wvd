# Shared factory bootstrap 0.1.0

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
