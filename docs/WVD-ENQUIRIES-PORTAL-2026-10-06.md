# WVD direct enquiries and owner Portal — prepared release

Updated 6 October 2026. **Implementation is prepared; Google administrator setup and the founder's first sign-in are still required before public activation.**

## Current state

The public WVD service website remains version 5 at https://wearvalleydigital.com/. Its existing email-draft enquiry page continues to work. Salon, Wedding and other products have not been released by this work.

The new direct-submission website is built and saved as **Sites version 7**, with no deployment attempt. It adds a Send enquiry button, a durable-receipt confirmation and matching WVD reference, retry protection, an email fallback, Portal navigation and updated privacy/storage explanations.

The separate Google service has been created, updated and verified with private transport. Its real address is https://wvd-service-v3b6mv7uka-nw.a.run.app. Private Portal and enquiry APIs reject invalid sign-in tokens. The Google login shell is available to the authenticated verifier, but real Google sign-in and the owner's inbox have not yet been exercised. No new enquiry or owner notification has been sent.

| Component | Exact prepared state |
| --- | --- |
| Controller runtime source | 5c920347d58ea3f35071fd13b9f9573db5acac0e |
| Controller complete frontend and hosting-policy source | 929342fcc7fe87a10e292a94544f3bd5130fb246 |
| Initial test corrections and earlier release receipt | e96343268c1a6f8a79465ebd36ace7e0df5a06ef; superseded runtime receipt retained in Git history |
| Corrected administrator helper | 5c920347d58ea3f35071fd13b9f9573db5acac0e; explicit WVD quota header verified |
| Hosting-policy verification source | 929342fcc7fe87a10e292a94544f3bd5130fb246; all policy-aware browser checks passed |
| Sites project | appgprj_6ac361a8bfd48191b3bde453565cf2ab |
| Saved Sites source | 1de317f95f43d11675303f2d270e2dbaed73bc78 |
| Saved Sites version ID | appgprj_6ac361a8bfd48191b3bde453565cf2ab~appgver_9054e2f3a32481918417774bf7a693ae |
| Saved archive hash | sha256:c50421284ee20e28f4f3168234b8eb1df92997142dcbcf5c3ceb2476ca1e25c7 |
| Google project, region and service | wvd-development / europe-west2 / wvd-service |
| Exact previous runtime receipt | [wvd-service-last-reviewed-release.json](evidence/wvd-service-last-reviewed-release.json) |
| Enquiry notification inbox | hello@wearvalleydigital.com |
| Delegated sender and intended owner Google account | admin@wearvalleydigital.com |
| Owner binding | null; no UID invented and no account or admin grant created |

The saved frontend archive contains 90 files and is 43,612,160 bytes. Its seven public application/configuration files were mirrored exactly to the controller and verified through GitHub blob hashes.

Version 6 was superseded before publication: the final hosting review found that its same-origin-only connect-src policy would block the Google enquiry endpoint. Version 7 adds only the actual service origin to that directive. All enquiry browser journeys now apply the real production Content Security Policy; the local static test server does not otherwise apply _headers. The other security directives are preserved.

## Verification evidence

### Current runtime and corrected administrator helper

[Google development access run 37479343393](https://github.com/aquaviator/wvd/actions/runs/37479343393) succeeded for **5c920347d58ea3f35071fd13b9f9573db5acac0e**. Its actual service transport/private API verification succeeded at **2026-10-06T14:31:12.467Z**, with status PRIVATE_SERVICE_HTTP_VERIFIED. Google login shell availability, anonymous transport denial and both private API denials passed. Owner remains null; actual Google sign-in, owner bootstrap, enquiry capture and notification delivery remain unverified. Existing booking hosting was unchanged.

The current runtime image is `europe-west2-docker.pkg.dev/wvd-development/wvd-booking-runtime/service@sha256:5944548d81d2bfe349d4110537e59c19e1f2200d516446d8e0fc7472d276954f`. Configuration SHA-256 remains `ee7b1046f1d8d620536f09731478a5e1b2ab79427a0074c8b14a2d2796a053f7`; the URL remains https://wvd-service-v3b6mv7uka-nw.a.run.app. The exact receipt was downloaded from artifact **11419634176**, ZIP SHA-256 **843c04a29135b03c6716ad227aabf985b1335ce9c6b42fc53fa5eea4b13f22bf**, and matched against the successful verification log before updating the checked-in receipt.

The focused deployment wrapper passed 14/14, including all **13 Python administrator-helper checks**. The new regression covers the WVD quota header on all fixed authenticated reads, updates and operation polling, and proves public probes do not receive the administrator token or quota header. [Ordinary CI push run 37479343311](https://github.com/aquaviator/wvd/actions/runs/37479343311) succeeded on the same exact source: all four jobs passed, with 592 Portal Node passes and one existing skip, 25 site unit passes, 94 public browser passes, eight Portal browser passes and five real Firestore emulator checks.

[Development container run 37479343292](https://github.com/aquaviator/wvd/actions/runs/37479343292) also succeeded on that exact source, completing at **14:33:14Z**. Both packages, identity checks and isolated offline checks passed. It reported 592 Portal Node passes with one existing skip, all five Google emulator checks and the administrator wrapper covering all 13 Python cases. The new quota-header regression was therefore exercised in the existing unattended container as well as ordinary CI.

Fresh service discovery at **2026-10-06T14:29:27.437Z** still found owner absent, domain not authorised and no automation access to the enquiry TTL policy. These automation limits remain distinct from the founder's successful permission tests. The correction updates the setup helper; its live administrator changes have not yet been run. The current service receipt replaces the earlier bb53 receipt. Public Sites version 5 and saved version 7 are unchanged.

### Earlier application and hosting validation

[Google development access run 37472003263](https://github.com/aquaviator/wvd/actions/runs/37472003263) succeeded for bb53eef. The new service was verified at **2026-10-06T13:37:20.466Z** and the run completed at 13:37:27Z. The liveness response, public auth configuration, login shell and bundled Firebase client were checked through private IAM transport. Anonymous transport and invalid Firebase bearer requests to both private APIs were denied. Owner bootstrap steps correctly skipped while owner was null. The existing private booking service remained unchanged and its verification passed.

The runtime image is:
`europe-west2-docker.pkg.dev/wvd-development/wvd-booking-runtime/service@sha256:3a38768e4f53466d53f5f2c59fc82ad8c0a55cac86b37448c93e6ea51ae0a06d`.

Its configuration SHA-256 is `ee7b1046f1d8d620536f09731478a5e1b2ab79427a0074c8b14a2d2796a053f7`. The exact release artifact 11417840225 was downloaded and its ZIP SHA-256 verified as `460edd146c187bd9f26b90a3c137c5b6dd3f73f87cc2e756fed0d13668923da9`.

[Development container run 37472003100](https://github.com/aquaviator/wvd/actions/runs/37472003100) succeeded for the same runtime source. It built both standalone packages, verified refusal to start without the attached service identity, and passed the offline checks: 592 Node tests passed, one existing skip, and five database/browser checks passed.

The complete public Sites build passed and generated 28 routes. The public unit suite passed 25/25; the Portal suite passed 592 tests with one existing skip. Real Firestore emulator checks passed 5/5, including atomic enquiry capture, notification claim, native expiry timestamps, private rules and collection isolation. Fourteen deployment checks include twelve synthetic Python administrator-helper regressions.

The first integrated browser run passed all actual submission, receipt and uncertain-retry journeys. The only failing journey was the no-JavaScript fallback, with two Playwright matcher incompatibilities exposed in succession: FIELDSET is not a disabled control for its matcher, and NOSCRIPT wrappers are excluded from its text matcher. The tests now check the disabled attribute, actual disabled email/submit controls and visible noscript paragraph. Initial-deployment fixtures also remain independent of the later real owner binding. No application changes were needed for these assertion corrections.

**Ordinary verification before the hosting-policy correction passed:** [push run 37473087318](https://github.com/aquaviator/wvd/actions/runs/37473087318) completed at 13:45:47Z and [PR run 37473094781](https://github.com/aquaviator/wvd/actions/runs/37473094781) completed at 13:46:01Z. All four jobs succeeded in each run. The push tested exact source 10c93e49a3c3f14742679b45588065dae4868a0a; the PR tested merge source 5e5cb2fa1fc9d1d351c81c016851ef45f90ac74c. Both quality logs report 94/94 public browser tests, 8/8 combined legacy/live Portal browser tests, 25/25 site unit tests, 592 Portal Node passes with one existing skip, and 59 factory tests. The final push Firebase job 112301383343 passed all five checks. The existing Portal sign-out regression is resolved.

The public artifact metadata from that passing run is 11418360301, 2,444,733 bytes, ZIP SHA-256 5a069e1a0ca88e627defb846803d720fd88e4a5f5380cd10db7da51c73888e59. Its unchanged frontend was already reviewed visually from the previous downloaded artifact below. Owner Portal artifact from that passing run 11417762245 was downloaded, hash-verified and all six PNGs reviewed: desktop/mobile login, inbox/detail and owner-setup-pending states. Its ZIP is 1,353,944 bytes with SHA-256 e8597a69d3098d96e82fd517ac05bd66410e38d2c2de4adfd05c9a5caad9f446. Controls and content fit, full references wrap, and synthetic HTML remains literal text. This proves the synthetic UI and access behaviors exercised by the tests, not a real Google popup, owner bootstrap or inbox delivery.

**Final hosting-policy verification passed:** [push run 37474782789](https://github.com/aquaviator/wvd/actions/runs/37474782789) succeeded at 13:58:54Z and [PR run 37474790790](https://github.com/aquaviator/wvd/actions/runs/37474790790) succeeded at 13:58:46Z. All four jobs passed in each. Both logs show 94/94 public browser checks with the actual hosting policy applied, 8/8 combined Portal browser checks, 25/25 site unit checks and 592 Portal Node passes with one existing skip. Push Firebase job 112307238875 passed all five enquiry/database checks. The push tested exact source 929342fcc7fe87a10e292a94544f3bd5130fb246; the PR tested merge source 8eeeda7fa43809647408c2ac84e8978c95143fbb.

Fresh public artifact metadata: 11418507085, ZIP 2,444,733 bytes, SHA-256 1327286b2704ccfa1b5673c310d607ebd096d2c8cd29aff822e7fd3241201e52. Fresh owner artifact metadata: 11419021862, ZIP 1,353,944 bytes, SHA-256 bd64764bd3eeac2d9d8704b0d2d3ca78107245e49ebfa5ce43a6f7e9c39d671e. The policy correction does not change the public layout or Portal source; their inspected screenshots above remain applicable. No repeat artifact download was required.

The unchanged public receipt screenshots from bb53eef were inspected at desktop 1280 × 2006 and mobile 390 × 2156: confirmation/reference are readable, navigation and buttons wrap without overlap, and no content is clipped. Artifact 11417866131 has ZIP SHA-256 `8e07868823992ee5465fe1051a82d56fd0ac3dfadb331e29336407cfac78c259`. These are synthetic UI fixtures, not proof of live delivery.

## The founder's two remaining steps

### 1. One-time Google administrator setup

Fresh discovery at **2026-10-06T13:35:44.362Z** confirmed that the current automation identity still lacks `run.services.setIamPolicy`, `firebaseauth.configs.update` and `datastore.indexes.get/update`. The real run.app hostname is not in Firebase's authorised domains, and no Firebase account exists for admin@wearvalleydigital.com.

The prepared [administrator helper](../tools/portal-runtime/enable-service-access.py) uses the administrator's existing gcloud login. It first validates the live service's exact source, image, configuration, identity, capacity and receipt, then makes only these changes:

1. Append the actual service hostname to Firebase authorised domains, preserving the existing entries.
2. Enable TTL for `projects/wvd-development/databases/(default)/collectionGroups/wvd_service_enquiries_v1/fields/deleteAt`.
3. Enable public HTTP transport on this one service, then recheck health, auth configuration and denial of both private APIs.

This is an initial owner-null setup. No permanent role is granted; the helper does not alter booking, create accounts, submit enquiries or send messages. TTL enablement can report CREATING or ENABLEMENT_PENDING before ACTIVE; it does not promise immediate deletion.

The initial helper at e96343268c1a6f8a79465ebd36ace7e0df5a06ef returned `GOOGLE_HTTP_403` in the founder's Cloud Shell. The paired diagnostic returned on **6 October at 14:26:15Z** established the cause: Firebase's Google-provider and authorised-domains reads were attributed to implicit consumer project 618104708054, where Identity Toolkit was disabled. Both exact requests succeeded when supplied with `X-Goog-User-Project: wvd-development`. All requested project and service permissions were returned in both modes. No role changes are indicated.

The corrected helper at **5c920347d58ea3f35071fd13b9f9573db5acac0e** adds that header only to the fixed authenticated Google API requests. Anonymous health checks and private denial probes preserve their own separate headers. Helper SHA-256: `b8d85e1be6d5af43ee0a033512888170a6eea94e7699030652f453cd32ae945b`.

The old e963 setup command is superseded. Use the corrected helper together with the exact current [reviewed release receipt](evidence/wvd-service-last-reviewed-release.json) from the same checked-out revision:

```bash
python3 tools/portal-runtime/enable-service-access.py docs/evidence/wvd-service-last-reviewed-release.json
```

The Cloud Shell handoff downloads both files from one immutable commit that contains the verified receipt. A later runtime update invalidates that pinned command until its receipt is refreshed. The diagnostic confirmed that the service domain, TTL activation and public transport are still pending; neither the diagnostic nor this header correction claims they have been enabled.

#### Read-only diagnosis of the Cloud Shell 403

[service-access.py](../tools/operator-diagnostics/service-access.py) reads the effective gcloud account, selected project, impersonation and quota-project context. Token/file overrides are reported as presence booleans only. It then repeats the same six named metadata reads. Each denied read is compared once with `X-Goog-User-Project: wvd-development`. Two bounded `testIamPermissions` requests check the exact project and Cloud Run service, using both quota modes. Those POST operations read permissions; they do not update IAM or resources.

This adapts the existing administrator helper's fixed targets, no-redirect HTTP client and token-in-memory pattern. It is separate because diagnosis must not invoke setup or trigger a privileged runtime deployment. It needs no arguments, dependencies, credential files or administrator role grants. It prints only selected context, HTTP status, bounded structured Google ErrorInfo fields, safe state booleans and scoped permission results. It omits raw provider messages, service configuration, access tokens and credential paths.

Google documents that a raw request using `gcloud auth print-access-token` can require an explicit quota-project header; the caller then needs `serviceusage.services.use` on that project. The founder's paired responses establish this cause for the two failed Firebase reads. The diagnostic also confirmed the expected founder account, selected project, absent impersonation/credential overrides, and the quota permission. Earlier gcloud CLI successes and CI service access were not used to infer these current user-session facts.

A request recovered by the explicit header is reported by name under `quotaHeaderRecovered`. Failed permission requests remain INCONCLUSIVE; a successful test reports only granted and notReturned permissions at the tested scope. Project-scope results may not capture conditional grants on descendant resources. The diagnostic never claims that permission tests guarantee a later setup PATCH will succeed.

The [sanitised diagnostic evidence](evidence/wvd-service-admin-quota-diagnostic-2026-10-06.json) records the founder-reported results without the personal account address or credentials. The diagnostic source and its synthetic tests are outside the Google deployment trigger paths. All 18 diagnostic tests passed locally and in both ordinary CI runs for source 2c448007cb471d4f0b99fd04563f49cbae787cc9; runs 37478592277 and 37478599688 subsequently completed successfully. That diagnostic addition made no runtime or configuration changes. The later corrected setup helper follows the ordinary Google deployment workflow and therefore requires a fresh reviewed service receipt.

Primary API references checked 6 October 2026:

- https://docs.cloud.google.com/sdk/gcloud/reference/auth/print-access-token
- https://docs.cloud.google.com/docs/quotas/set-quota-project
- https://docs.cloud.google.com/resource-manager/reference/rest/v3/projects/testIamPermissions
- https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.services/testIamPermissions
- https://docs.cloud.google.com/identity-platform/docs/access-control
- https://docs.cloud.google.com/firestore/native/docs/ttl
- https://docs.cloud.google.com/run/docs/authenticating/public

### 2. First Google sign-in

After setup succeeds, open https://wvd-service-v3b6mv7uka-nw.a.run.app and sign in with **admin@wearvalleydigital.com**. This creates the real Firebase identity. An owner-setup-pending screen is expected at this stage; private data remains closed until the controller binds the verified owner.

The controller then performs a fresh exact-account lookup, verifies the real UID and Google provider, and supplies that explicit binding in the runtime candidate. The prepared owner bootstrap workflow uses temporary WIF application-default credentials for the established service account, rechecks the real enabled and verified Google account, creates only an absent WVD state and preserves existing Portal data. It does not promote a first visitor or overwrite an existing state. Operator attribution is retained without credential or UID output.

The first sign-in is necessary user input. Routine implementation, verification, development pushes and the later public cutover are already authorised under [project authority](WVD-PROJECT-AUTHORITY.md).

## Controller continuation after those steps

1. Verify the actual administrator changes through the existing read-only discovery and public HTTP checks. Record native TTL state accurately.
2. Verify the real Google owner UID, bind it explicitly and run the prepared owner bootstrap through the trusted Google workflow. Keep the existing source/image/configuration receipt as the expected previous release for both prepare and deploy.
3. Verify the real owner session and one bounded synthetic enquiry/owner notification. A Gmail provider receipt is not proof of inbox arrival. Never automatically repeat an uncertain send.
4. Deploy the already saved Sites version 7 through native Sites publication once the service is usable. Preserve its current public audience and branded domains; no DNS change is needed for this update.
5. Record the actual runtime receipt, website deployment, successful owner access and live enquiry result. Do not merge the draft PR or release Salon/Wedding as part of this work.

## Runtime and data boundaries

The new service reuses the existing Google/Firebase platform, attached identity, Firestore database and delegated Gmail scope. It scales from zero to one instance, with request-based CPU, one vCPU, 512 MiB, concurrency four and a 60-second request timeout. The existing allowance is £5/month **total additional WVD hosting**, not per service and not a technical hard cost cap.

POST /api/enquiries accepts only the two branded website origins and a bounded request schema. A transaction persists the enquiry, admission increment and notification intent before returning a receipt. Identical retries reuse one receipt. Capture survives notification failure; ambiguous mail outcomes are retained without automatic resend. Admission limits are ten per minute and fifty per day, with two concurrent handlers and a 16 KiB body limit.

Enquiries use `wvd_products/wvd/wvd_service_enquiries_v1/{receiptId}`. Records expire after 90 days, are hidden from the Portal after expiry, and have a native deleteAt timestamp for the dedicated TTL policy. Mail notifications and correspondence remain separate business records. The frontend stores enquiry fields only in the current page, never in persistent browser storage.

Private endpoints require the explicitly configured verified Google owner, a current unrevoked Firebase token and the stored WVD admin grant. Google browser authentication uses in-memory persistence. No customer accounts, first-user admin, cross-product access, demo clients or live product release are implied.

## History and references

The execution outage and reconstruction checkpoint are preserved in Git history at 5f21cbf2994277c2347347d349ffacbdb304ead3. The first implementation/source commit was 22d5002bc6930a04dbbb3a8a04f803ce2721ac5b. Their pending/blocked statements are superseded by this prepared-release record.

- [WVD public service launch](WVD-SERVICE-LAUNCH-2026-10-06.md)
- [Sites handoff](WVD-SITES-HANDOFF.md)
- [Access automation](WVD-ACCESS-AUTOMATION.md)
- [Access registry](../tools/factory/access-registry.json)
