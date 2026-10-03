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

## Trusted account provisioning

`firebase-operator.mjs` is a privileged terminal tool, not a web route. It reuses
`createFirebaseBackend`, the existing domain and the strict product binding. It
only links an existing, enabled Firebase UID with a verified email and a Google
or password provider. It does not create Firebase users, send invitations,
change credentials, set custom claims or create WVD administrators.

Before applying a grant, inspect the existing aggregate revision:

```sh
node tools/portal-proof/firebase-operator.mjs inspect /path/to/explicit-binding.json
node tools/portal-proof/firebase-operator.mjs provision /path/to/explicit-binding.json /path/to/reviewed-grant.json
```

Example reviewed grant (synthetic identifiers; supply actual verified values):

```json
{"uid":"synthetic-firebase-uid","businessId":"demo-business","role":"Member","projectIds":["Demo project"],"expectedRevision":0}
```

The operator must review the exact UID, role, business and project list. Use only
an authorised operator environment with the explicit intended product binding;
never execute these grants from an untrusted client. Live mode needs approved
Google credentials/access and is not activated by this implementation. The local
Firebase CLI login is not an application runtime credential. Normal member
runtime credentials must not be exposed as an operator capability. IAM holders
with aggregate write access are trusted operators: this bounded proof does not
claim fine-grained separation of their server-side IAM roles.

Firestore applies the grant atomically only if its current aggregate revision
matches `expectedRevision`. A project from another business, stale revision,
inactive identity, revoked membership, changed role, widened project list or
extra privilege field fails without a write. An identical existing active grant
at the current revision is a no-op. Newly provisioned identities are non-admin;
only the specified projects are visible, and Members cannot approve milestones.
Existing role changes and reactivation need a separately reviewed workflow and
are deliberately unsupported by this additive tool. No public colleague-management
endpoint or invitation delivery is claimed. This is still a bounded development
proof; a production operator audit trail and normalized membership model remain
release work.

Founder verified the local demo startup, milestone approval and support tickets
on Windows on 2 October 2026. This confirms the local emulator flow, not live
Google sign-in, cloud persistence or production readiness.

### Exact milestone review content

Trusted operators can publish bounded plain-text review packages using:

```sh
node firebase-operator.mjs publish-review binding.json reviewed-milestone.json
```

The reviewed JSON contains exactly `expectedRevision`, `projectId`, `milestoneId`,
`versionId`, `title` (up to 200 characters), and `body` (up to 10,000 characters).
Use `inspect` first and review the target and current revision. Publication uses
that revision inside the Firestore transaction; a concurrent change fails closed.
There is no client publication endpoint. A version's text is immutable: changes
need a new version ID and reset the milestone to awaiting review. Exact retries
of publication do not reset an approval or restore an old version.

The authorised project overview returns only the current review package. The UI
renders plain text, and approval binds the server-computed SHA-256 digest of the
project, milestone, version, title and body. Missing or mismatched content pauses
approval. Receipts retain the digest and historical packages remain in the bounded
aggregate. This binds approval to text; it does not prove the user read it, hash
external deliverables, or authorise a production deployment. Existing legacy
proof milestones without published text retain their old behaviour for compatibility
and must acquire a new reviewed version before production acceptance.

The synthetic Firebase demo and unattended container browser journey exercise
this content-bound approval using emulator data only. The existing domain,
persistence, authorisation and HTTP boundary are reused; no new service is added.

### Operator attribution and transactional history

Reviewed grant and review-publication JSON files now also require `operatorRef`
and `changeRef` (non-empty strings, each at most 128 characters). These must be
non-secret references to the operator and reviewed change. Both privileged
Firestore methods require this context; the synthetic demo supplies explicitly
synthetic references. There is no default live operator identity.

Every successful state-changing grant/publication appends an `operatorAudit`
entry in the same transaction: action, supplied references, server timestamp,
resulting aggregate revision and scoped target identifiers. Review entries retain
the digest rather than text; grants retain the target UID and granted scope.
Transaction retries create one entry. No-op retries, denied requests, stale
revisions and capacity failures create no entries. State validation rejects
malformed history and impossible revisions. Existing aggregates without history
remain readable; earlier operations are not retroactively attributed.

Attribution references are supplied by the privileged caller, not authenticated
Google principal claims. IAM remains the access authority. This application
history is not a tamper-proof external audit log: a privileged database writer
can alter or delete data. IAM-principal correlation, independent log retention
and production audit acceptance remain launch work. The history shares the
512 KiB aggregate capacity and is never silently pruned. It has no public route
and is omitted from customer project overviews. This slice reuses the existing
transaction/state validation rather than provisioning another logging service.

### Client approval history

The authorised project overview now includes a minimal approval history with
milestone/version, server approval time, bound digest and the exact historical
review text. Publishing a new version does not change prior entries. The browser
shows these as expandable records, including after re-sign-in; legacy approvals
explicitly say that no review text was stored. Actor UIDs, operation IDs and
operator history are omitted from this customer projection. Existing project
membership checks apply to the complete response. The screen reuses the current
overview boundary and receipts rather than adding a new database or service.

The same authorised overview also returns saved feedback with its original
milestone/version and timestamp. Feedback remains visible after approval or
replacement, and the UI refreshes it after submission. These project-shared
comments omit actor UIDs and operation IDs; they are not private messages.
Revoked membership blocks access to both histories on the next request. Domain,
durable-reopen and real emulator browser checks cover the review history loop.

### Isolated backup rehearsal

`backup.mjs` exports a bounded versioned envelope containing explicit
project/product/database/mode bindings, source revision, export time and validated
portal state. Trusted Firestore export reads state and revision from one document
snapshot. The checksum detects changed bytes; it is not a signature or proof of
backup authenticity. Verification also checks state relationships, immutable
review digests and audit revisions, and rejects scope mismatches.

`rehearsePortalBackup` verifies an envelope, restores it to a fresh internal
SQLite directory, closes/reopens it and compares the complete state, then removes
the temporary directory. There is no supplied target path, overwrite switch,
public route or live restore operation. Automated tests use synthetic data only;
the real Firestore emulator test rehearses a snapshot with approvals, feedback
and tickets. This proves aggregate data portability into the existing local
adapter, not restoration of Firebase Auth accounts, storage files, IAM, Firestore
indexes/rules or a production Google disaster recovery procedure. Backup security,
retention, authenticated provenance and live restore acceptance remain unfinished.

### Introductory-call candidate screening

`booking.mjs` batches the existing `availability.mjs` single-slot contract. It
filters bounded, explicitly supplied UTC candidates without inventing a slot grid.
The shared contract covers duration, UK working hours, notice, both conflict
margins, exact queried calendar intervals, holiday coverage and evidence age.
Buffer-at-opening/closing and maximum evidence age must be supplied explicitly
by the caller; they are not new founder policy defaults. Strict holiday dates
and bounded batch input fail closed. Synthetic evidence is not a published
holiday calendar or authenticated provider response.

This is a pure development check, not a live availability/booking endpoint.
Caller-supplied coverage is not proof of current provider data. Live integration
still needs authenticated Calendar access, an approved complete conflict-calendar
list, authoritative holiday data, snapshot freshness rules, final conflict
recheck and a concurrency-safe reservation protocol. Google Meet creation,
cancellation/rescheduling and confirmation delivery remain unfinished. No calendar
IDs, credentials, live appointments or external messages are introduced here.

### Assign or remove existing project access

`update-access` reuses the checked operator binding, reviewed JSON, explicit
revision and operator/change references of provisioning:

```sh
node firebase-operator.mjs inspect <binding.json>
node firebase-operator.mjs update-access <binding.json> <reviewed-access-change.json>
```

The reviewed change has `uid`, `businessId`, the existing `role`, the complete
desired `projectIds`, `expectedRevision`, `operatorRef` and `changeRef`. It changes
only an existing business membership's project list; new identities, business
roles, admin flags and activation are not created or changed. Empty project lists
are permitted for removal. New grants require a fresh enabled, verified Google/
password Firebase account; removal-only changes also work for disabled/deleted
Auth users. Revoked product identities or memberships are never reactivated.

Commit rejects a stale aggregate revision. Changed lists and before/after project
references are audited together; a no-op adds no audit or revision. No operator
method is exposed through a client HTTP route. This is not the Owner invitation
workflow or a finished admin account UI, and references do not verify IAM identity.
Use emulator fixtures until actual live target/access prerequisites are satisfied.

For a scoped read before preparing a change, use:

```sh
node firebase-operator.mjs inspect-access <binding.json> <account-scope.json>
```

`account-scope.json` contains exactly `uid` and `businessId`. The result contains
that membership's role, stored activation flags and project list, together with
the revision read from the same Firestore document. It omits other memberships,
admin flags and account credentials. This privileged read does not query current
Firebase Auth status or create an audit record. A subsequent change still checks
revision and required Auth state; save output only in an authorised private place.

### Admin project-access editing

The WVD administration overview now loads accounts for a selected existing client
and offers project checkboxes. It uses the same project-list contract as the
trusted operator updater, preserving the existing role, product identity status,
membership activation and WVD admin flags. Clearing all projects removes grants;
it does not delete or reactivate the account. A disabled/revoked membership can
lose access, but cannot receive new grants.

The selected Google backend performs the existing fresh Firebase Admin SDK user
check before added grants, outside transaction callbacks. Current admin capability
is checked before the Auth read and again during the commit. The account list and
revision come from one aggregate read; changes after that read cause a conflict
and require refresh. Audit attribution uses the server-verified portal actor ID
and records previous/new projects atomically. A no-op adds no audit or revision.
The local development adapter reuses domain/audit checks but does not establish
Firebase Auth verification. There is no role change, new client/account creation
or Owner invitation workflow here. Legacy trusted operator commands remain private.

### New client records

An active WVD admin can create a new client namespace and its first project from
the administration overview. The workflow reuses project creation/progress and
records the creator and server time. A client cannot adopt another business or
reuse an existing project ID. Exact retries keep later progress; changed payloads
are rejected. Client namespaces are capped at 200 in this aggregate proof, with
the existing 512 KiB Firestore limit still enforced.

Creating the client does not create Firebase users, business memberships, project
grants or notifications. The new client's account list is empty until an explicit
verified provisioning step. Invitation delivery and live onboarding remain open.

### Owner controls for existing Members

A client Owner can inspect Member accounts in their own business and grant/remove
access to the selected project, provided the Owner currently has that project.
Other project grants and business memberships stay intact. The client projection
contains only the selected-project flag; other project names and full audit lists
are not returned. Current roles, activation and WVD admin flags are preserved.
Owners cannot change other Owners or create accounts through this workflow.

The account read includes its aggregate revision. A stale write requires refresh;
a permission change and audit commit together. The selected Google backend reuses
fresh verified target checks for added grants, outside retryable transactions,
and rechecks Owner authority at commit. Removal-only changes also work when the
target Auth account is disabled/deleted. This is project-level Member management,
not business-wide account revocation or the completed invitation delivery flow.

### Invitation identity proof

The backend now exposes a separate internal invitation identity resolver. It
reuses Firebase token verification, then reads the current Firebase user and
requires an enabled, verified, matching email and supported Google/password
account. It can identify an invited user before product provisioning; this does
not grant portal access. The normal portal resolver still requires an active
product identity, and token role flags remain ignored. No invitation redemption
HTTP endpoint is connected yet; the proof must be bound to a valid, unexpired,
one-time invitation before any future membership grant.

### Internal one-time Member invitation service

The Google backend now has internal `invitations.create/redeem/revoke` operations.
Enable them only with an explicit second backend option:
`{invitationPolicy: {ref: '<reviewed-policy-reference>', maxLifetimeMs: <positive-duration>}}`.
No lifetime or company policy is supplied by default. The local/Firestore domain
adapters accept the same explicit policy for synthetic verification.

Creation requires current Owner authority for every selected project and a current
verified issuer account. It returns a 32-byte opaque token once; state stores only
its digest. An exact creation retry returns no replacement token. A new request is
needed to issue another link. Receipt fields retain issuer, recipient binding,
project list, expiry, server time and policy reference. Proof capacity is 200
invitation records per business; records are not automatically purged by expiry.

Redemption requires current Firebase identity/email proof, the matching token and
recipient email, a pending unexpired invitation, unchanged policy binding and
current issuer/Owner authority. Membership creation and consumption commit together.
Only Member permissions are provisioned; revoked/disabled/conflicting memberships
are not overwritten. A consumed-token retry by the same verified identity returns
the receipt and does not restore later-revoked permissions. Concurrent redemptions
produce one grant/consumption. An Owner can revoke their pending invitation; this
does not revoke an already provisioned membership.

An optional HTTP adapter exposes create, list, redeem and revoke operations only when
explicitly supplied to the isolated emulator application. It enforces bearer
authentication, exact input schemas, same-origin POST requests, an 8 KiB body
limit and no-store responses. Tokens in query strings and caller-supplied actors
are rejected. The emulator demo provides Owner link creation/revocation and invitation
acceptance during sign-in for an existing verified Firebase account. The link is
held in memory, copied only on request, and removed from the incoming URL
fragment immediately. No raw token is rendered or persisted in browser storage.
An invitation link also enables synthetic account registration and verification
using the development Auth emulator action code. Registration alone creates no
portal identity or project grants. Auth credentials and returned refresh tokens
are not retained. Live registration, email delivery and abuse protection remain
unconnected. They create no Firebase Auth users and send no
messages. Invitation policy, registration/email verification, abuse controls,
retention and delivery still need binding before live onboarding. Normal portal
requests continue to require the active product identity and project permissions.

Owners can reload their own invitation history for a currently authorised project
and revoke pending invitations. The list excludes other issuers, businesses,
project grant lists, recipient UIDs and all token material. Revocation checks
current Owner authority for every project in the invitation at commit.
