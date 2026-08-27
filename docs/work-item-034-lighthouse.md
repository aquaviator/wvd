# Work Item 034 — Lighthouse evidence

Audited locally on 27 August 2026 against the production Astro build using Lighthouse's default mobile profile.

| Route | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 100 | 100 | 100 | 100 | 1.0 s | 0 | 50 ms |
| `/products/` | 100 | 100 | 100 | 100 | 0.9 s | 0 | 30 ms |
| `/products/property/uk-landlord-mtd-ledger/` | 100 | 100 | 100 | 66 | 1.5 s | 0 | 50 ms |

INP is a field metric and was not available in the local lab run; TBT is recorded as its lab equivalent.

The product route's SEO score is intentionally reduced solely by its `noindex` state. This is the required product safety control while approved regulatory claims are pending and must not be removed to improve a synthetic score.

## Correction made

Added the missing SVG favicon. This removed the only console error and raised Best Practices from 96 to 100 on all audited routes.

## Environment note

All JSON reports were written successfully. On Windows, Lighthouse subsequently returned `EBUSY` while cleaning its temporary Chrome profile. This post-report cleanup error does not affect the recorded audit results.
