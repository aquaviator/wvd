# WVD engineering instructions

Read `docs/WVD-DEVELOPMENT-STANDARD.md` before architecture or implementation.

- Continue authorised development from the agreed brief and current backlog without waiting for another continue instruction. After each verified slice, select and implement the next in-scope item; progress updates and completed slices are not permission gates. Ask the founder only when missing information, access or a decision genuinely blocks the next action, and continue independent in-scope work while awaiting an answer. Do not invent requirements or broaden the brief. Stop when the brief is complete, the founder asks to stop, or no authorised work can proceed without founder input. Production deployment and new external spend still require separate approval.

- Use the established Google/Firebase platform and existing service connections.
- Do not add another provider or service subscription as a shortcut.
- Inspect `tools/factory/reuse-catalogue.json` and the relevant existing source
  before building. Reuse or adapt proven code/configuration before writing a
  replacement; record the reason when existing code does not fit.
- Keep shared modules parameterised and versioned. New products/projects supply
  explicit targets, data namespaces, access policies and credential references.
- Preserve product constitutions and customer deployment requirements. Shared
  authentication does not confer cross-product or cross-customer access.
- Do not copy secrets, customer data or another product's deployment IDs into
  defaults. Verify Google ownership, permissions and cost before live changes.
- Run relevant shared and consumer tests; do not claim integration from a
  configuration template alone.
- Development commits/pushes to the authorised development branch are permitted.
  Production deployment still needs separate founder approval. New external
  spend remains £0 without separate authority.

- Use the unattended container verification process in
  `tools/development-container/README.md` for supported development checks.
  Inspect the run and synthetic evidence, fix failures and repeat before handover.
  Founder-local pulls are optional review, not the default verification gate.
  Keep required native platform checks; do not claim a CI job is an interactive
  preview or remote control of the founder's computer.
