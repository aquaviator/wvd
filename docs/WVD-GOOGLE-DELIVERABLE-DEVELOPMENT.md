# Google Drive deliverable development

This read-only development adapter extends the portal's pinned text/PNG review
path. It does not select live client files, grant permissions, alter retention,
provision storage or activate a production endpoint.

## Reuse and scope

Inspected the factory reuse catalogue and the WVD Calendar adapter, pinned
reader, catalogue, HTTP boundary and emulator browser workflow at source
`83a8b2ed012b34e0a7a096a49553097a4fb33e86`. The existing reader owns project
access, immutable review digests and transactional approval capabilities. The
Calendar adapter supplies the explicit authenticated-client/timeout/no-retry
pattern. Neither implements file revision streaming, so this adds that missing
adapter without another provider, dependency or authentication implementation.

`google-drive-client.mjs` accepts an explicitly authenticated Google Auth client
with `request`. It constructs only the fixed Google Drive v3 revision GET URL,
metadata fields or media parameters, bounded request options and no redirects.
Credential acquisition, scopes and refresh remain the approved client's job.
No ambient credentials or connector tokens are discovered or exported.

`google-drive-deliverable.mjs` accepts that revision client and an explicit
registry of `projectId`, opaque `sourceId`/`sourceVersion`, `fileId`, `revisionId`
and `mediaType`. It copies the registry and rejects unregistered combinations
before any Google request. File IDs remain server-side configuration.

Each read checks revision identity, media type, size and `keepForever`; streams
at most the caller's bounded byte limit; then rechecks metadata/retention. It
rejects partial downloads, oversized/truncated bytes, native Workspace documents
and purgeable revisions. It never falls back to the latest file or a current
Google Doc export. Provider errors are reduced to static portal error codes.
The existing reader still independently checks SHA-256 and current access.

Timeout and external cancellation abort the Google request and destroy active
or late streams. Admission remains occupied until an uncooperative provider
actually settles. Downloads and metadata requests never run inside a retryable
database transaction. Exact saved approval retries remain provider-independent.

## Provider contract

Google documents revision metadata/media reads through `revisions.get`:
https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions/get

Blob revision downloads require retained revisions. Native Workspace exports
have a different contract and are outside this adapter:
https://developers.google.com/workspace/drive/api/guides/manage-downloads
https://developers.google.com/workspace/drive/api/guides/manage-revisions

The adapter observes `keepForever`; it never changes that setting. Retention
ownership, quota, removal and handover policy remain operational decisions.

## Verification and remaining live bindings

Focused tests cover registry isolation, immutable copies, metadata and stream
failures, cancellation, timeout/admission, fixed request URLs and composition with
Owner approval proofs. The existing real Firebase-emulator browser journey now
uses this adapter with a synthetic Drive client for text and PNG deliverables.
Source `a870a16d3fc5fa34c57b7fb8e3e5bc8197f9df81` passed all four CI jobs
and offline container run 37128147143 (365 portal tests passed, one Windows-only
skip on Linux; native Windows also passed). Downloaded results matched the source
and the PNG screenshot was inspected. This verifies the adapter contract through
the portal; it is not live Drive access.

Before a live development read:

- Supply the approved app-owned Google Auth client with file-content access to
  an explicitly authorised synthetic test file and its retained blob revision.
- Register that exact project/source/file/revision mapping and matching digest.
- Verify account/file ownership, least-required scopes, retention and quota/cost.
- Run a bounded read and access-denial test from the approved application runtime.

The current browser composition requires isolated emulators. Live endpoint
composition, native Google document exports and additional binary preview formats
remain separate work. No production deployment or additional spend is implied.
