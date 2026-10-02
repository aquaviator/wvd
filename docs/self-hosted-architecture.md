# WVD self-hosted software decision

The founder's instruction on 2 October 2026 selects WVD-built software without
required vendor accounts, service subscriptions or provider tie-in. This replaces
the proposed Supabase hosted route. No Supabase project was provisioned.

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
