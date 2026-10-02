# Portal database candidate

The initial migration supplies profiles, business memberships, project grants,
milestones, immutable version approvals, bound operation receipts and an atomic
notification outbox. Authenticated reads use RLS; clients cannot write tables
directly. Approval derives its actor from `auth.uid()` and rechecks active Owner
membership and a project grant. Trusted provisioning is separate from client
operations. No live project has been created or changed.

The recommended hosted route is Supabase Auth/Postgres with the existing
Cloudflare public site. The Node/SQLite adapter in `tools/portal-proof` remains a
portable local integration proof and is not a production database selection.
The hosted migration is tested against disposable PostgreSQL 16 in GitHub CI
with a test-only `auth.uid()` context. These tests do not verify real JWTs,
Supabase invitations, API configuration, mail delivery or deployed authorisation.

Run the SQL bootstrap, migration and assertions in that order with
`psql -v ON_ERROR_STOP=1`. `tests/bootstrap.sql` belongs only in an isolated test
database: never run it in Supabase or an existing customer database.

Before live development: connect a WVD-owned Supabase project, disable public
signup, configure invitation/recovery redirects and securely provide scoped
application configuration. The `portal` schema must be exposed deliberately in
the Supabase Data API or used through a server adapter; it is not automatically
exposed. Never place administrative/service-role keys in browser code. Ordinary
client requests must preserve user identity so RLS applies. No keys or tokens
have been collected by this work.

Live invitations need a verified sender connection: default Supabase SMTP is
limited to project-team recipients. The Google Calendar chat connection does
not supply application OAuth credentials. Production hosting, backup/recovery,
retention, notification dispatch, remaining portal workflows and costs must be
verified before release; this migration is not complete portal acceptance.

Primary references:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/local-development
