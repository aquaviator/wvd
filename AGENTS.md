# WVD engineering instructions

Read `docs/WVD-DEVELOPMENT-STANDARD.md` before architecture or implementation.

- All web-facing projects with creative content inherit the visual/video/text
  standard in `docs/WVD-WEB-CONTENT-STANDARD.md`. Every page needs a relevant CTA.
  Keep media, factual claims, sources and review dates consistent across formats.

- WVD project authority, updated 4 October 2026: continue the agreed brief and
  outstanding backlog without asking for another continue instruction. Routine
  development, configuration within existing authority, automated checks and
  completed slices are not founder approval gates. Ask only when the next action
  requires user-supplied data, elevated admin/configuration approval, or extra
  money. Continue independent authorised work while any such input is outstanding.
  Make routine implementation decisions yourself; do not broaden the brief.
  Stop when the brief is complete, the user asks to stop, or no authorised work
  remains possible. This supersedes older WVD blanket production-approval and
  generic decision gates; it does not grant new privileges, spending authority or
  permission to message third parties. See `docs/WVD-PROJECT-AUTHORITY.md`.

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
  Apply the project authority above to releases; new external spend remains £0
  without separate authority.

- Use the unattended container verification process in
  `tools/development-container/README.md` for supported development checks.
  Inspect the run and synthetic evidence, fix failures and repeat before handover.
  Founder-local pulls are optional review, not the default verification gate.
  Keep required native platform checks; do not claim a CI job is an interactive
  preview or remote control of the founder's computer.
