# WVD engineering instructions

Read `docs/WVD-DEVELOPMENT-STANDARD.md` before architecture or implementation.

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
