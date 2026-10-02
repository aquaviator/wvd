# Google portal adapter

WVD uses the existing Google/Firebase platform. This adapter adds product-scoped
persistence and verified Firebase sessions to the existing portal domain and HTTP
boundary. It creates no cloud projects, purchases, subscriptions or deployments.

## Reuse assessment

Human V1 Workout Studio's `src/repositories/FirebaseAuthRepository.ts`, inspected
at `1c964b2ef8cdf2438481cb94bb1fbfde4c977bad`, requires an ACTIVE trusted account
and user after Firebase login. WVD adapts this provisioned-identity requirement.
Human V1's account schema and product IDs do not fit WVD's business/project roles;
they are not copied. Firebase handles token verification, expiry and revocation.
WVD's existing domain and state validator are reused unchanged for permissions,
exact-version approvals, idempotency and atomic notification intent.

The existing local login UI remains a development option. The same portal screens
now support Firebase password sign-in against an explicitly configured loopback
emulator. Live Google browser sign-in, trusted provisioning workflow and live
Google integration remain to be completed. Human V1 hosting configuration was
inspected as a pattern; its targets are not used as WVD defaults. Human V1 access
rules remain a review candidate, not a dependency of this server-only aggregate.

## Configuration and identity

`createFirebaseBackend` requires explicit `projectId`, `productId`, `databaseId`
and `mode`. Live mode uses Google Application Default Credentials, rejects any
emulator environment, and never seeds data automatically. Do not paste credentials
into configuration or commit service-account files. The approved live project,
IAM permissions, region/database ownership and zero-new-spend constraints must be
verified before live access. Production deployment requires separate approval.

A bearer ID token must have a verified email and Google or password provider.
The Firebase UID must equal an active identity ID provisioned by a trusted WVD
operator. Client token roles and actor IDs never grant authority. Each domain
transaction rechecks current identity and business/project membership.

Data is bound to `wvd_products/{productId}/private/portal-state` in the explicit
Firestore database. No product is inferred from an HTTP request. Browser clients
must not read or write this private document. `firestore.rules` is an isolated
emulator candidate fragment; integrate carefully with the verified project's
existing rules rather than replacing other products' rules. Admin SDK bypasses
Firestore rules: server IAM and domain checks are mandatory.

## Bounded persistence proof

One transactional document holds the product aggregate, revision and atomic
notification intents. Firestore may retry callbacks; callbacks do no email or
other external side effects and use one captured server timestamp. Persisted
relationships are checked on every operation. Corruption fails closed. State is
limited to 512 KiB before writes, below Firestore's document limit. This design
is a bounded development proof, not a scalable production data model. A growing
portal will need normalized collections and a tested transactional outbox worker.
There is currently no dispatcher and no claim of email delivery.

## Verification

Requires Node 22.16+ and Java 21+. Run:

```
npm ci --prefix tools/portal-proof
npm --prefix tools/portal-proof test
npm --prefix tools/portal-proof run test:firebase
```

The emulator command fixes project `demo-wvd-portal` and loopback Auth/Firestore
ports. It uses synthetic fixtures and no live credentials. Tests exercise actual
Admin SDK verification, HTTP approval, product/tenant denial, revocation,
concurrent transactions, persistence, exact retries, rollback, capacity and
client rules denial. CI runs this separately from public browser journeys.

## Browser emulator integration

`createApplication` accepts an explicit `firebaseEmulator` backend binding and
`auth: {resolveSession: backend.resolveSession}`. It validates demo project and
both loopback emulator hosts, requires a loopback HTTP portal origin, and refuses
live mode. The client uses Firebase's documented password sign-in REST endpoint
against that loopback Auth emulator; Firebase Admin verifies the resulting token
and trusted WVD identity before any project is shown. It adds no registration or
password proxy on the WVD server. The local invitation endpoints are unavailable
in this mode. The existing portal screens and domain permissions are reused.

The browser retains only an ID token in memory. Refresh tokens are discarded;
expiry requires another sign-in. Sign-out clears this browser's session; it does
not revoke every device's token. Disabled users and revoked tokens are checked on
server requests. This bounded emulator client does not implement live Google
federation and must not be used as a production Auth client. Its fixed, restricted
connection policy permits only the explicit loopback Auth endpoint.

The real-emulator browser test signs in a synthetic user, denies an authenticated
but unprovisioned user, approves an exact milestone version, verifies no persisted
browser tokens, signs out and back in, disables the user, and proves subsequent
writes fail. Existing local mobile/desktop portal browser tests remain unchanged.
REST reference: https://firebase.google.com/docs/reference/rest/auth
Emulator reference: https://firebase.google.com/docs/emulator-suite/connect_auth

Run the synthetic browser demo (Node 22.16+ and Java 21+):

```sh
npm ci --prefix tools/portal-proof
npm --prefix tools/portal-proof run dev:firebase
```

Open `http://127.0.0.1:4703`. Sign in as `owner@example.test` with the
**synthetic development-only** password `Synthetic-demo-123!`. Review and approve
`Demo milestone`, or create a support ticket. Stop with Ctrl+C. This launcher
fixes a `demo-` project, binds the portal to loopback, initializes synthetic data
without overwriting existing state, and cannot select `wvd-development`. No Google
CLI login, billing account or live runtime credential is required. Do not enter
real account credentials or customer data. Emulator data is disposable.
