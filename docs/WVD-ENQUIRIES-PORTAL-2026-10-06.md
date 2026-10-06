# WVD enquiries and owner Portal — runtime implementation

## Resumed 6 October 2026

The execution workspace reconnected and its principal code edits were recovered. The dedicated retention collection, exact Firebase project-name aliases and image-digest drift checks are now implemented. The two deployment/admin test files were reconstructed and verified.

This commit contains the complete backend/runtime/workflow slice. Independent review and the full local Portal Node suite passed: 586 tests, 585 passed, one existing skip, zero failures. Its deployment wrapper also passed all 12 synthetic Python administrator-helper regressions. Relevant syntax checks and git diff --check passed.

The private Cloud Run creation and exact-source CI are now queued by this source push. Neither the new Portal nor the direct public form is being reported live. The public Sites version remains 5. The prepared public frontend and its tests will be synchronized only after Google returns the exact service URL. No new enquiry or owner notification has been sent.

The runtime uses the dedicated path wvd_products/wvd/wvd_service_enquiries_v1 and the matching TTL collection group. The dormant administrator helper must only be used with an actual verified service release receipt; no such receipt is available at this checkpoint. Subsequent runtime updates require the verified prior release argument in both prepare and deploy.

The section below is retained as the historical disconnection/recovery handoff. Its statements about unapplied fixes and unpushed runtime source are superseded by the resume record above.

---

## Historical implementation handoff

Updated 6 October 2026. This is a blocked implementation checkpoint, not a release receipt.

## Founder request and current public state

The founder approved replacing the public email-draft enquiry process with direct submission, durable capture and an owner notification, together with his private WVD Portal login. This extends the live WVD service offering without releasing Salon or another product.

The public Site remains version 5, source e1b95d27f8691885964a4cd5579a65e10acba627, at https://wearvalleydigital.com/ and https://www.wearvalleydigital.com/. Its enquiry page still prepares an email draft. No new Portal service has been deployed. No live enquiry or notification has been sent for this work.

## Blocking execution failure

The execution workspace disconnected during final source review. Both an outstanding read and a fresh read-only `pwd` failed with:

```text
409 Conflict, environment_offline: Environment is not connected
```

The remaining implementation edits, final tests, private deployment and public cutover could not run. They are not held for another routine founder approval. The GitHub connector remained available to save this handoff.

Before any retry, verify the existing working checkouts and preserve their changes. The implementation below is in the working trees and has NOT yet been pushed. Do not assume it is recoverable from the current branch. If the workspace has been replaced, use the retained conversation/agent patches to reconstruct it against a fresh checked branch.

## Completed discovery and selected architecture

Read-only discovery was committed as e4fdaebada17e55d2f7988ac5b544c6b1a3ea751. [Google development access run 37461395448](https://github.com/aquaviator/wvd/actions/runs/37461395448) succeeded at 2026-10-06T12:11:16Z; the new checks were observed at 2026-10-06T12:10:52.874Z.

The new service `wvd-service` was absent in the complete `wvd-development` / `europe-west2` inventory. Firebase Google sign-in is enabled and its actual web-app configuration was retrieved. An exact lookup found no Firebase account for admin@wearvalleydigital.com.

Selected backend: one new Cloud Run service combining enquiry capture and the owner Portal. Use the existing attached wvd-development service account, existing Firestore `(default)`, existing Artifact Registry repository and existing delegated Gmail send scope. Keep the booking service unchanged. The actual service URL must come from Google's creation response; no hostname has been guessed.

Bounds: zero minimum and one maximum instance, request-based CPU, one vCPU, 512 MiB, concurrency four, 60-second request timeout and an image no larger than 400 MiB. The founder's existing additional-hosting allowance remains £5/month TOTAL across WVD, not per service and not a technical hard cost cap.

The current automation identity can create/update the service, read Firebase configuration and exact users, use Firestore server access and obtain the existing delegated send scope. It lacks run.services.setIamPolicy, firebaseauth.configs.update and datastore.indexes.get/update. A narrowly scoped Google administrator setup is needed AFTER the service is concretely prepared and verified privately. Do not request a broad permanent role grant.

## Implementation already written in the working trees

### Public Sites frontend

Project appgprj_6ac361a8bfd48191b3bde453565cf2ab was opened through the official Sites source helper at source e1b95d27f8691885964a4cd5579a65e10acba627.

- `src/pages/enquire.astro`: direct JSON submission, saved-receipt confirmation, short WVD reference, no persistent browser storage, duplicate-click prevention, email fallback and same-request retry after an uncertain response.
- `src/lib/contact/enquiry.ts`: extracted shared normalization while retaining the draft helper.
- `src/lib/contact/submission.ts`: strict request/receipt contract and display reference.
- `src/layouts/BaseLayout.astro`: prepared Portal navigation.
- `src/pages/legal/[page].astro`: prepared direct-submission, Google/Firebase sign-in and retention wording.

`src/lib/contact/service.ts` is intentionally missing until the provider returns the actual service origin. The prepared frontend cannot build or be published yet. No new Sites version/source has been saved or deployed. In the retry handler, an unsuccessful retry must retain prior uncertainty and the original UUID even if the later response is a 4xx; root fixed this before the outage.

### Controller backend and tests

New enquiry modules: `enquiry.mjs`, `enquiry-firestore.mjs`, `enquiry-http.mjs`, `enquiry-mail.mjs` under tools/portal-proof, with focused Node and Firestore emulator tests. A transaction stores the enquiry, admission increment and notification intent before confirmation. Exact retries return one receipt. Notification failure cannot undo capture; ambiguous sends are not automatically retried.

Public endpoint remains POST /api/enquiries. Private owner endpoints remain GET /api/admin/enquiries and GET /api/admin/enquiries/{id}. Exact apex/www origins, 16 KiB body limit, handler concurrency and persistent acceptance limits of 10/minute and 50/day are present. These are bounded abuse controls, not proof against bots.

Mail uses trusted delegated account/sender admin@wearvalleydigital.com and fixed recipient hello@wearvalleydigital.com. The same short WVD reference is shown to the visitor, in the notification and in the owner inbox. No visitor email is sent. The Gmail grant was verified without sending; inbox delivery and the hello alias have not been proven by this task.

New live Portal modules: `live-config.mjs`, `live-auth.mjs`, `live-app.mjs`, `live-main.mjs`, `owner-bootstrap.mjs`, separate live Google browser auth and owner enquiry UI. Existing emulator/local authentication restrictions remain. The exact verified owner UID/email and current stored WVD admin grant are required on every private request. `owner: null` permits only the setup/sign-in shell and denies all private APIs. No account, first-user grant, demo client or guessed UID is created.

Firebase client 12.19.0 and esbuild 0.28.2 were pinned in the Portal package/lock; root package/lock were unchanged. The browser bundle built at 135,553 bytes, SHA-256 7bd056ba01a7f025935c623fbde479befadbdb10451d2e8632460a05b8826050.

The Portal agent's complete Node run passed 570 of 571 tests, with one existing skip and no failures. This preceded the unfinished deployment/retention fixes. Focused enquiry and owner-auth/config/client tests also passed. These are local source checks, not a final integrated CI or live-provider receipt.

Added synthetic desktop/mobile Portal browser cases for the Google login shell, owner inbox, empty owner setup, accessibility, plain-text rendering, refreshed tokens, storage and sign-out cleanup. Public browser tests now cover direct submission and uncertain retries. New browser and real Firestore emulator checks have NOT run for this feature.

Root prepared CI, development-container and existing trusted Google-workflow updates. The latter uses a fresh short-lived access token, builds the bounded image, prepares/creates privately, binds the actual returned origin, then verifies private HTTP using a separate IAM transport token. None of these uncommitted workflow edits has executed.

### Runtime files requiring completion

Authored before the outage: tools/portal-runtime/deployment.mjs, enable-service-access.py, Dockerfile, build-browser.mjs, firebase-auth-sdk-entry.js and wvd-development.candidate.json; tests/service-deployment.test.mjs and tests/service-access-setup.test.py under tools/portal-proof. The candidate uses the actual public Firebase web config, owner:null and non-sending startup with fixed mail configuration.

The deployment CLI and dormant administrator helper received independent source review. Focused deployment/admin tests did NOT run. Do NOT execute the administrator helper in its current unfinished state.

## Required fixes before the first runtime push

1. Finish the dedicated retention namespace. Firestore TTL applies to a collection group, so the generic `enquiries` ID could affect another product. The agreed source-only change is an `enquiryCollectionId(productId)` helper returning `${productId}_service_enquiries_v1`, with this service path `wvd_products/wvd/wvd_service_enquiries_v1`. Change store/emulator fixtures and add the focused cross-product/generic-collection cleanup-isolation test. This patch did NOT apply before disconnection.

2. Change the administrator helper and discovery/test TTL target to `projects/wvd-development/databases/(default)/collectionGroups/wvd_service_enquiries_v1/fields/deleteAt`. The helper still has the old generic target. Keep the public/private HTTP routes unchanged. No live data migration exists.

3. Allow only the two already verified Firebase project aliases, wvd-development and numeric 6616382131, in helper configuration/provider response names. Reuse the provider-returned configuration name in the narrow authorizedDomains patch. This final compatibility fix has NOT applied.

4. Add a managed image-digest annotation and compare it to the actual container image in deployment inspection and the helper. This prevents a manual image edit from being accepted as an unchanged source release. Add its focused drift test. This final guard has NOT applied.

5. Run `node --check tools/portal-runtime/deployment.mjs`, then `node --test tools/portal-proof/tests/service-deployment.test.mjs tools/portal-proof/tests/service-discovery.test.mjs tools/portal-proof/tests/enquiry.test.mjs` and diff validation. The Node deployment test invokes the Python tests with their required synthetic JSON fixture; do not run that Python file directly without the fixture. Then push only the complete runtime/backend/workflow slice initially; defer new public frontend tests until the real service URL exists.

## Remaining release sequence

1. Reconnect/verify the working workspace, finish the above fixes and run exact-source CI, container startup, Firebase emulator and synthetic browser checks. Inspect the actual evidence artifacts.
2. Create and verify the new service privately through the existing trusted Google workflow. Its CLI saves the exact source/image/configuration/URL receipt as wvd-service-release.json. Use that receipt as the explicit expected prior release for subsequent changes; do not adopt manual drift or blindly recreate/push an immutable source image.
3. Fill the actual provider-returned service origin into the Sites module, mirror exact frontend files and prepared tests to the controller, and build/test the complete public candidate without publishing an unavailable form.
4. Finish and pin the concrete one-time administrator helper plus the exact verified receipt. Only then request the genuinely missing Google setup: append that hostname to Firebase authorized domains, enable the dedicated enquiry TTL and enable HTTP transport on this one service. Preserve unrelated settings and report TTL CREATING separately from ACTIVE. No broad IAM grants or messages.
5. The founder signs in with admin@wearvalleydigital.com to establish a real Firebase UID. Verify that exact identity, run the explicit attributed owner bootstrap and bind it in the runtime. Keep private data closed until then.
6. Verify one bounded synthetic enquiry/owner notification without automatic uncertain-send retries, the real owner login and public/private access boundaries. Publish the prepared public Site version through the official helper and verify the actual form and Portal link. Record exact source, image, Sites version, evidence and remaining limitations.

## References

- [Live WVD service-launch receipt](WVD-SERVICE-LAUNCH-2026-10-06.md)
- [Project authority](WVD-PROJECT-AUTHORITY.md)
- [Access automation](WVD-ACCESS-AUTOMATION.md)
- [Google Firestore TTL scope and delayed deletion](https://firebase.google.com/docs/firestore/ttl)

Current status: implementation prepared in working trees; runtime/deployment corrections and verification blocked by disconnected execution environment; public form and Portal release pending.
