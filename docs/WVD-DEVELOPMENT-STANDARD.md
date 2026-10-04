# WVD development standard 1.3.0

Authority: founder instructions on 2 October 2026. Applies to WVD development
and new product/project onboarding. Existing product constitutions remain
authoritative for product behaviour and customer deployment.

## One platform, growing reuse

Founder instructions on 4 October 2026 establish the shared web creative-content
standard in `WVD-WEB-CONTENT-STANDARD.md`: feature visual, short contextual video,
complete written content, and a relevant CTA on every page. Accuracy, sources,
review dates, accessibility and public search discovery belong to the same
versioned content bundle. This applies across web-facing projects with creative
content; private content stays outside public search. Recording the standard
does not claim existing articles have completed videos or verified indexing.

Use the existing Google/Firebase platform for hosting, authentication, data and
file storage where its capabilities fit. Do not introduce another provider or
service subscription to replace an available capability. New external spend
remains £0 unless separately authorised; Google usage is not assumed to be free.

Before building, inspect the existing product repositories and shared modules.
Prefer reuse, then adaptation; build only the missing capability. Record the
source revision, fit, gaps and decision. Do not rebuild authentication, service
connections or deployment configuration without first assessing the existing
implementation. The custom local portal authentication is a development option;
it is not the default replacement for established Firebase Auth.

Keep repeatable code in shared, versioned modules with consumer contract tests.
Reuse configuration templates while parameterising product/project IDs, hosting
targets, origins, paths, permissions and credential references. A product adds
bindings and workflows to the established platform; it does not start another
unrelated technology estate. “Reuse” is not an unchecked copy of customer data,
secrets or another product's deployment targets.

## Consistent flavours

| Flavour | Existing foundation to inspect | Product-specific additions |
| --- | --- | --- |
| Public website | WVD Astro components/content and Human V1 Google hosting configuration | Branding, content, domain, hosting target |
| Web application | Human V1 Firebase auth/connection/access patterns and WVD portal contracts | Workflows, scoped permissions, data entities |
| Android application | Human V1 Kotlin/Compose/Room and Firebase integration | Product UI, offline/sync rules, scoped access |
| Enterprise platform | PECP provider/contract and portable deployment model; WVD factory | Product domain, integrations, customer infrastructure bindings |

Consistency means shared service and implementation patterns, not forcing a
website, Android app and enterprise platform into one programming framework.
PECP's customer-controlled production deployment remains intact; Google is the
company development/reference infrastructure direction.

## Isolation and ownership

Authentication infrastructure may be shared, but each product/project enforces
its own authorisation. Use explicit data namespaces, storage paths, roles and
deployment targets. Prove cross-product and cross-customer denial in tests.
Do not reuse Human V1's `hv1-platform` project as an automatic WVD write target.
Verify its intended resource ownership and configuration first.

Keep credentials in the approved Google/CI secret mechanisms, referenced by
product-scoped identifiers. Keep software, schema contracts and data exports
under WVD control. Public search and AI retrieval must exclude private customer
data unless an explicitly authorised private retrieval workflow is designed.

## Factory inheritance

`tools/factory/development-standard.json` holds the versioned machine-readable
standard. `reuse-catalogue.json` records candidate source revisions and their
required review. Candidate presence is not proof that a module fits a new use.

Every context packet includes the standard and its hash. Packet/cache bindings
include the standard, reuse catalogue and optional project configuration, so
changes regenerate affected contexts. The full packet still counts against its
context budget; the standard is never silently truncated.

New products supply `productConfig` with a named flavour, explicit bindings and
reuse decisions for every baseline candidate. `node cli.mjs project <config>`
checks the plan before onboarding. Unknown providers, subscription overrides,
raw credential fields and mismatched product namespaces are rejected. Missing
Google target/access references are listed for discovery; they are never guessed.
The plan does not provision, deploy, connect accounts or verify billing/access.
Legacy context-only manifests inherit the standard even without productConfig;
their packets do not claim deployment readiness.

## Release and exceptions

Run relevant shared-module and consumer checks after changes. Reuse source must
be inspected and bound to exact revisions before integration. A different
technology/provider or a new subscription requires an explicit founder decision,
not a worker preference. Production release still requires separate approval.
The factory checks structure and hashes, not the truth of human fit assessments
or Google access. Review must verify the recorded evidence before release.

## Unattended development verification

Founder instruction on 2 October 2026: bake agent-controlled, visible testing
into the development process. Prefer reproducible disposable containers in the
existing CI connection. Development workers push authorised branch changes, read
results, fix failures and repeat without requiring founder-local pulls as the
default gate. Record the tested source commit and image identity; show results
and bounded synthetic browser evidence before handover. Keep native Windows or
Android checks on an appropriate runner when a Linux container cannot verify them.

The first consumer is the WVD Firebase portal container described in
`tools/development-container/README.md`. It reuses existing tests and runs offline
with synthetic emulator data. Containerisation is verification infrastructure,
not a replacement hosting or authentication provider. No live credentials, host
Docker socket, customer data or production deployment permissions enter tests.

A CI job is not an always-on interactive browser preview, and control of that
job does not imply remote control of the founder's Windows machine. A shared
interactive runtime must be separately connected and cost-verified before it is
claimed available. Existing £0 spend and separate production approval remain.

## Continuous development from the brief

Founder instruction on 2 October 2026: Continue authorised development from the agreed brief and current backlog without waiting for another continue instruction. After each verified slice, select and implement the next in-scope item; progress updates and completed slices are not permission gates. Ask the founder only when missing information, access or a decision genuinely blocks the next action, and continue independent in-scope work while awaiting an answer. Do not invent requirements or broaden the brief. Stop when the brief is complete, the founder asks to stop, or no authorised work can proceed without founder input. Production deployment and new external spend still require separate approval.

Use the agreed brief and latest founder corrections as scope authority. Consult
existing project records and code to select the next unmet acceptance criterion.
Keep a current checkpoint of completed work, verification and remaining work so
execution can resume from the brief after a session interruption. Do not claim
that a chat turn creates an always-running background worker.
