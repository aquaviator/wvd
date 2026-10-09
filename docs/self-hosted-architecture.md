# WVD self-hosted software decision

The shared [WVD development standard](WVD-DEVELOPMENT-STANDARD.md) now governs
Google platform reuse and product/project configuration. This file preserves
the decision history and local prototype details; local auth/SQLite is not a
mandate to replace existing Google Auth/storage capabilities.

The founder's instruction on 2 October 2026 selects WVD-built software without
additional backend vendor accounts, service subscriptions or provider tie-in. This replaces
the proposed Supabase hosted route. No Supabase project was provisioned.

## Platform direction: existing Google infrastructure

The founder subsequently instructed WVD to use the same Google infrastructure
locations as Human V1 and PECP. Google is the selected infrastructure direction;
do not introduce another hosting/backend provider by default. Reuse existing
WVD-controlled Google ownership, access and infrastructure where suitable, while
keeping WVD identities, data, deployment targets and permissions separate from
Human V1 and PECP. This does not authorise writing into either product's database
or changing its deployment. It does not authorise new billable resources.

The founder further clarified that Google is suitable for data management,
authentication and storage, including data prepared for search and AI retrieval.
The constraint is to avoid additional providers/subscriptions, not to rebuild
existing Google platform capabilities unnecessarily. Assess Firebase Auth and
Google database/file storage for the deployed portal using existing ownership
and verified costs. Keep WVD business logic, permission/version contracts and
export formats under WVD control. The local auth/SQLite implementation remains
a tested development option, not a mandate to replace Firebase Auth.

Public service/content data may support search and AI retrieval. Private client
projects, tickets, credentials and approvals must remain outside public indexes
and unauthorised AI retrieval. The particular search/AI services, data access and
retention rules require design and verification; none is enabled by this record.

Repository evidence checked on 2 October 2026:

- Human V1 Strength `.firebaserc` names Google/Firebase project `hv1-platform`.
- Its `firebase.json` configures Firestore location `eur3`, Functions and Hosting.
- Human V1 Workout Studio `.firebaserc` maps the `workout-studio` hosting target
  in `hv1-platform` to site `hv1-workout-studio`.
- Studio's hosting configuration references a Functions endpoint in
  `europe-west1`; this is configuration evidence, not a live infrastructure audit.
- PECP's current Product Constitution identifies Google AI Studio as a UI
  development tool, while retaining customer-controlled production deployment.
  A Google-hosted PECP deployment/project/region was not established by the
  inspected repository and inventory. Do not equate AI Studio with hosting.

The exact WVD Google project, runtime, persistent storage and billing capacity
must be verified against the existing Google environment before online testing.
Preserve portable application code and exports. Existing Firebase configuration
does not prove there is a VM or persistent disk available for this Node/SQLite
application. Cloud Run's ordinary container filesystem is ephemeral, so the
current database must not be deployed there on container-local storage.

Sources:
- https://github.com/aquaviator/Hv1Strength/blob/main/firebase.json
- https://github.com/aquaviator/humanv1-workout-studio/blob/main/firebase.json
- https://github.com/aquaviator/pecp/blob/master/docs/PRODUCT_CONSTITUTION.md
- https://cloud.google.com/run/docs/container-contract#file_system

## Portable application

The public site remains the existing Astro build. The portal runs as a Node
application with local SQLite persistence and WVD-owned account/session handling.
It can run on an ordinary machine or VM with persistent disk. No proprietary
hosting API is required. Hosting, electricity, domain registration, mail delivery
and operations still have costs; this decision does not claim free infrastructure.

Use established open-source runtimes and standard cryptography rather than
inventing password algorithms. Invitation tokens and sessions are opaque random
values; the database stores only their digests. Passwords use salted scrypt.
Account disablement and password recovery revoke sessions immediately. Public
registration is absent. Origin checks and bearer tokens protect mutations.

The initial single-host SQLite deployment has explicit scaling limits. Production
needs TLS, filesystem access controls, backup/restore evidence, monitoring and
deployment verification. Any later database adapter must remain portable and
must preserve current permission, transaction and exact-version approval tests.

Google Calendar/Meet remains a previously requested optional integration. SMTP
delivery can use an existing mail server. Neither is required to start or test
the core portal. Integrations must be replaceable; no new subscription is assumed.

The `supabase/` migration is retained as historical candidate work, outside the
required application path. WordPress remains a possible implementation for
future client websites; it is not a dependency of this custom WVD portal.
Production deployment still requires separate founder approval.
