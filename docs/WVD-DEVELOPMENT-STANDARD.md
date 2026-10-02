# WVD development standard 1.0.0

Authority: founder instructions on 2 October 2026. Applies to WVD development
and new product/project onboarding. Existing product constitutions remain
authoritative for product behaviour and customer deployment.

## One platform, growing reuse

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
