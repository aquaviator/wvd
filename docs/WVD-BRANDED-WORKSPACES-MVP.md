# WVD branded workspaces MVP — 7 October 2026

Requested scope: retain the public website, expose the client workspace at
`portal.wearvalleydigital.com` and the owner workspace at
`admin.wearvalleydigital.com`, with WVD branding and a return link to the website.

## Implementation and reuse

Reuse the existing Cloud Run service, Firebase Google identity, owner binding,
client scopes, invitation contracts and no-store/noindex policy. Explicit
workspace origins select the UI and restrict API access: the admin workspace
requires the bound owner; client workspace APIs accept only client sessions and
exclude the enquiry inbox and invitation administration. Host headers never
grant a role. Existing direct service access remains compatible and protected.
Invitation links created in the owner workspace target the client hostname.

Use Firebase Hosting rewrites to the existing `wvd-service` in `europe-west2`.
This region supports Hosting rewrites; direct Cloud Run domain mapping is not
the chosen route. Do not create another service, load balancer or provider.
Cloudflare DNS handles only the two new names and the exact required validation
records. Existing public website and mail records are preserved.

## Cost assessment

Google's Hosting documentation checked on 7 October 2026 describes no fixed
Hosting subscription charge, 10 GB Hosting storage and 10 GB/month transfer
without charge; Blaze excess transfer is $0.15/GB and excess storage $0.026/GB.
The planned rewrite-only deployment stores no application assets. MVP test traffic
is expected to remain within the allowance. Existing Cloud Run capacity remains
zero-to-one instance. Neither an instance limit nor this estimate is a hard bill
cap; preserve the existing total £5/month additional WVD hosting authority.

Sources:
- https://firebase.google.com/docs/hosting/cloud-run
- https://firebase.google.com/docs/hosting/usage-quotas-pricing
- https://firebase.google.com/docs/hosting/custom-domain

## Verification and release status

Prepared on an isolated branch. Local role/host and origin-denial tests pass;
existing client-onboarding and live-shell regressions pass. Windows local
deployment helper tests still require the existing missing python3 alias; CI is
the authoritative Linux check. Automated desktop/mobile checks cover branded
invitation routing, the website return link and client denial at the admin host.

Google Hosting/Auth access, DNS ownership and deployment are now verified below.
HTTPS certificate issuance, branded browser sign-in and the public Site link
switch remain pending. No new domain is reported usable before TLS verification.

## Activation checkpoint — 7 October 2026

Founder explicitly approved using the existing Google Cloud administrator login
for WVD domain and Firebase sign-in configuration. Account permission is resolved.

- PR #6 merged at `8889a268654bae73d047427f7245c066bd5f37d0` after successful
  validation 37602411851 and offline container 37602411881.
- Existing default Hosting site `wvd-development` had no releases or custom
  domains. Reused it without adding compute or changing the public Site.
- Hosting version `8aaa9f7f809dcaa4`, release `1791369428848000`, rewrites all
  paths to existing `wvd-service` in `europe-west2`.
- Added `portal.wearvalleydigital.com` and `admin.wearvalleydigital.com` to
  Firebase authorized domains, preserving all four prior entries.
- Added only two DNS-only CNAME records to `wvd-development.web.app` and two
  Google-issued ACME TXT verification records. Existing 13 DNS records,
  including public website, Google mail, SPF and DKIM, were preserved.
- Service deployment workflow: 37608563844. Certificate activation and live
  branded sign-in are still pending at this checkpoint. No TLS bypass is used.
- Public website remains on verified Sites version 10, source
  `bfe60ff67afd81c7913f2052bcf74b69da8480ce`, with the requested About biography
  and user-supplied unlinked Client and Consultancies strips. Portal navigation
  still uses the verified direct service until branded acceptance completes.

## Verified service rollout

Workflow [37608563844](https://github.com/aquaviator/wvd/actions/runs/37608563844)
completed successfully. Live service revision `wvd-service-00007-tm6` runs the
merged source, with the original zero-to-one instance limit. Exact image and
configuration hashes are in `evidence/wvd-service-last-reviewed-release.json`.
The release receipt artifact is 11475976564; its archive digest is
`33bf08f4b6f9c1fea6ac84f13249e92aa77ac0a22787f43884fc378ff79fe8e7`.

The direct service serves the new workspace configuration. Browser verification
confirmed WVD branding and that Back to website opens the live public homepage.
The existing Firebase Hosting default domain successfully routes to Cloud Run.
Both custom domains report HOST_ACTIVE and OWNERSHIP_ACTIVE; Google has read
both ACME TXT records but certificates remain CERT_VALIDATING with no reported
issues. Normal HTTPS probes fail at the certificate stage. No certificate
verification bypass was used; branded host routing and authenticated acceptance
are NOT_RUN until certificates are ready.

Resume without another account permission request: check Google custom-domain
certificate state, verify normal HTTPS and exact client/admin workspace routing,
complete owner/client sign-in and negative access checks, keep synthetic grants
revoked after verification, then update only public Client Portal navigation to
https://portal.wearvalleydigital.com through the Sites source workflow. Preserve
the public enquiry service endpoint, About version 10 content and all mail DNS.
Do not redeploy the already-successful service unless source/configuration changes.
