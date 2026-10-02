# Portal dependency review — 2 October 2026

The founder's Windows install and a fresh local `npm audit --json` both report
nine findings: five high and four moderate. These are not nine independent bugs;
several are dependency-chain effects of three underlying advisories.

| Root advisory | Installed dependency | Scope | Published fix |
| --- | --- | --- | --- |
| GHSA-c475-qrg2-pj4r | basic-ftp via get-uri/proxy-agent | Firebase CLI development toolchain | basic-ftp 6.2.1 |
| GHSA-8988-4f7v-96qf | @opentelemetry/core via @google-cloud/pubsub | Firebase CLI development toolchain | @opentelemetry/core 2.8.0 |
| GHSA-w5hq-g745-h8pq | uuid 9.0.1 via gaxios 6.7.1 | CLI and Firebase Admin's storage dependency chain | uuid 11.1.1 |

Sources:
https://github.com/advisories/GHSA-c475-qrg2-pj4r
https://github.com/advisories/GHSA-8988-4f7v-96qf
https://github.com/advisories/GHSA-w5hq-g745-h8pq

`npm audit --omit=dev --json` reports two moderate chain entries (gaxios and uuid),
zero high and zero critical. This is not a clean audit or proof of immunity. WVD
currently uses Firebase Admin Auth/Firestore, not its storage client, and does not
call uuid's affected v3/v5/v6 functions directly. That narrows observed exposure;
transitive paths still need review before production.

Do not run `npm audit fix --force`: npm proposes replacing pinned Firebase CLI
15.32.1 with 14.23.0, and the current upstream constraints require basic-ftp ^5,
OpenTelemetry ^1 and uuid ^9. Forcing the published major-version fixes without
compatibility evidence can break the emulator and Google tooling. No packages
were changed or audit warnings suppressed. Next remediation is a supported
upstream dependency update or a narrowly reviewed compatible patch, followed by
the actual emulator/browser and Windows checks. Keep emulator ports on loopback
and use synthetic data; the development CLI must not be packaged into a deployed
runtime. These findings remain tracked release work, not a production acceptance.
