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

Google Hosting/Auth access, DNS activation, TLS, browser sign-in at the new
domains, public Site link update and final deployment receipts remain pending.
An explicit administrator-account permission question is outstanding. No new
domain is reported live on the basis of source changes alone.
