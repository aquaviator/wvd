# Portal proof review — 2 October 2026

Independent reviewer: `/root/factory_review`.
Verdict: **VERIFIED_WITH_LIMITATIONS**. No blocking defect within the documented
trusted-fixture, synchronous in-memory scope. This is not live portal acceptance.

Reviewed SHA-256:

| File | SHA-256 |
| --- | --- |
| domain.mjs | 8993852a5c69d199f9dd5a1ec11d448ba72eeea0c1d9afef4b3380f7bb6a44a7 |
| tests/domain.test.mjs | 607925f7b1e0e054ab4dfd52a13d5ca5f360b57d6e3012e2d31c97e41c6074d8 |
| README.md | e10a5bcbade8f1b2f64609a0ba0802213df9e02a706bc40dd3bca4e7adaeffa3 |
| package.json | 73c29be12956d1211f522cc53251f42b25e9106551e0da562e855c171919ef4b |
| ../../.github/workflows/ci.yml | 46f16bc62296770e2fbd26a4b99080c19c67a899ab5181b6e314474f3794b2b8 |

Reviewer ran all 24 tests. Additional checks: old approval retry after version
replacement cannot approve replacement; cross-tenant operation collision cannot
disclose receipt or mutate state; duplicate projects/milestones rejected; returned
project objects cannot mutate state.

Reviewer limitations: identity and membership are trusted input; fixture mutators
are privileged; loaded-state integrity and receipt identifiers need durable-store
constraints; injected clock must be trusted and non-reentrant; transactions cover
only synchronous model operations. Authentication, invitations, real backend
concurrency, durability, previews, notifications and deployed security unverified.

Controller validation: 24 portal + 23 framework + 15 existing site tests pass.
Public content validation and Astro build pass (14 routes). Standard `npm run
build` encountered local `tsx` IPC `listen EPERM`. Equivalent validation/build
worked with `node --import tsx scripts/validate.ts` followed by
`ASTRO_TELEMETRY_DISABLED=1 ./node_modules/.bin/astro build`. The permission issue
was bypassed without weakening sandbox permissions or changing site scripts.

This review is transcribed by the controller from the separate reviewer report.
Production, provider choice, commercial and privacy decisions remain open for
their affected work. ChatGPT Calendar owner access is read evidence only, not
an application OAuth credential or verified live booking workflow.
