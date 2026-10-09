# Run the WVD portal yourself

This application requires Node 22.16+ and a local persistent filesystem. It has
no runtime npm packages, auth vendor account or required subscription. Use a
currently supported patched Node release. The public Astro site can be hosted
separately. The portal is development software; the controls below do not certify
it for production or replace launch acceptance.

## Local development

Run these from `tools/portal-proof`:

```sh
node cli.mjs init example-state.json
node cli.mjs invite example-owner owner@example.test
WVD_ORIGIN=http://127.0.0.1:8080 node cli.mjs serve
```

Open `http://127.0.0.1:8080`. Enter the invitation code printed by the second
command in **Set up or recover your account**, choose a password of at least
15 characters, then sign in. The example is fictional and creates no bookings
or email. It supplies no default password or authentication bypass. The code
expires after 24 hours and is consumed once. Invitation fragments can optionally
be used as `/#invite=<code>`; the UI removes the fragment on load. Do not send
invitations to anyone until a recipient and delivery action are authorised.

The operator can supply a trusted JSON state file instead of the example.
Initialization cannot overwrite an existing database. Initial identities and
business/project grants are explicit configuration; the UI cannot self-assign
membership or administrator status. A complete admin provisioning interface and
Owner colleague management are still pending.

## Portable hosting

The founder selected the existing Google infrastructure used across the WVD
portfolio as the hosting direction. See `docs/self-hosted-architecture.md` for
verified Human V1 configuration and outstanding WVD runtime/storage checks.
Do not provision another provider or reuse Human V1/PECP application data. This
runbook requires a persistent local disk; ordinary Cloud Run container storage
is not suitable for these SQLite databases.

Set `WVD_DATA_DIR` to a private directory on persistent **local** disk. Never put
it inside a static web root, a git checkout, a shared network filesystem or an
ephemeral container filesystem. The CLI sets a restrictive process umask and
directory permissions. Existing database/backup ownership and permissions must
also be checked by the operator. Keep both `portal.sqlite` and `auth.sqlite`.

For a TLS reverse proxy on the same machine, set `WVD_ORIGIN` to the exact public
HTTPS origin, keep the Node listener on loopback, and forward only that origin
to the listener. `WVD_PORT` defaults to 8080. HTTP origins and non-loopback HTTP
bindings are rejected except for local development. The application ignores
forwarded client IP headers: login throttling behind a proxy initially shares
the proxy peer limit. Do not trust arbitrary proxy headers to bypass throttles.
TLS certificate management, process supervision, firewalling and filesystem
protection are deployment responsibilities. No production deployment has run.

Sessions last up to eight hours and are kept only in browser memory; reloading
requires sign-in. Logout revokes the selected session. Password recovery uses a
fresh operator-issued invitation for the **same** actor/email and revokes all
sessions on redemption. `node cli.mjs disable <actor-id>` revokes the account's
sessions and invitation immediately. There is no public recovery email endpoint
or automated mail delivery. Verify identity before issuing a recovery code.

## Backup and recovery

For the initial single-host deployment, stop the process before copying the
entire private data directory to a protected backup. Restore both databases
together to avoid identity/state divergence. Never copy an actively written
SQLite file as a backup. Keep backups encrypted and inaccessible to the web
server, with an explicit retention schedule. A production launch requires a
successful restore rehearsal and agreed recovery targets.

## Current scope

Included: invitation redemption, login/logout, account disable/recovery, bounded
password hashing and persistent login throttles, active-session resolution,
project selection/progress, exact-version approvals, feedback, support tickets
and replies. Plain text uses DOM textContent; tokens are not stored in browser
storage or logged by the server. Pending domain notification intents are durable.

Pending: admin UI/provisioning, Owner colleague invitations/removal, actual preview
content/version binding, notification delivery, calendar/Meet website adapter,
MFA, operational audit/monitoring, production load/security/accessibility review,
retention and backup rehearsal. No production readiness claim is made.
