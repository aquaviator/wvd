# Product #1 Media QA Handoff

Prepared: **27 August 2026**  
Product: **UK Landlord MTD-Ready Bookkeeping Ledger v1.0.1**  
Release state: **paused / noindex / checkout inactive**

## Final media files used

- Product-led website hero and product card
- Setup, Transactions, Quarterly Summary, Annual Summary and MTD Export workbook screenshots
- 60-second paced promotional video and poster
- 4:52 paced tutorial and poster
- Final paced captions, retained as SRT and delivered through WebVTT derivatives
- How It Works, What’s Included, Compatibility and Local-first graphics
- Ten Etsy listing images
- Six landscape, six square and six vertical social images

## Source locations

- Release graphics: `C:\Users\Andy Clarke\Documents\MTD\WVD-Landlord-MTD-Ledger-v1.0.1\MEDIA-RELEASE`
- Paced video, scripts, captions and thumbnail: `C:\Users\Andy Clarke\Documents\MTD\WVD-Landlord-MTD-Ledger-v1.0.1\MEDIA`
- Brand source of truth, inspected read-only: `C:\Users\Andy Clarke\Documents\MTD\WVD-Assets`
- Repository delivery paths: `public/media/products/uk-landlord-mtd-ledger/`

## Product manifest references

All public paths, alt text, dimensions, video metadata, claim mappings, Etsy assets and social variants are registered in `src/content/products/uk-landlord-mtd-ledger/media.yaml`. The reusable schema and loader validate this manifest for every product.

## Video durations and captions

| Video | Duration | Delivery | Captions | Analytics |
|---|---:|---|---|---|
| Landlord Bookkeeping Made Practical | 01:00 | Local QA fixture; deferred until play | `promo-v1.0.1.vtt` plus source SRT | `promo_video_start`, `promo_video_complete` |
| UK Landlord Ledger v1.0.1 Demonstration | 04:52 | Local QA fixture; deferred until play | `tutorial-v1.0.1.vtt` plus source SRT | `demo_video_start`, `demo_video_complete` |

Public video hosting is intentionally undecided. No permanent provider is hard-coded.

## Image dimensions

- Hero: 1280×720 AVIF delivery derivative; approved 1920×1080 PNG retained
- Product card: 1200×900
- Workbook screenshots: 946×478 WebP delivery derivatives
- Video poster: 1280×853 WebP delivery derivative; approved 1536×1024 PNG retained
- Website explainer graphics: 1280×720 WebP delivery derivatives; approved 1600×900 PNGs retained
- Etsy gallery: 2000×2000
- Social: 1920×1080 landscape, 1080×1080 square, 1080×1920 vertical

## Claims referenced

- Promotional video: MTD-UK-007, MTD-UK-008
- Tutorial: MTD-UK-007, MTD-UK-008, MTD-UK-010, MTD-UK-014
- The media claim audit’s date-sensitive August 2026 workbook wording remains governed by the existing claim review schedule.
- No approved regulatory statement was changed by this integration.

## Responsive checks

Automated overflow and interaction checks passed at 320×700, 390×844, 768×1024, 1366×768 and 1920×1080. Axe checks passed for the product route in mobile and desktop browser projects. QA should still inspect crop, legibility, keyboard focus and captions on physical devices.

## Lighthouse results

| Audit | Pre-media baseline | Initial integration | Optimized release candidate |
|---|---:|---:|---:|
| Performance | 100 | 76 | 99 |
| Accessibility | 100 | 100 | 100 |
| Best Practices | 100 | 96 | 96 |
| SEO | 66 | 69 | 69 |
| LCP | 1.5 s | 6.5 s | 1.5 s |
| CLS | 0 | 0 | 0 |
| TBT | 50 ms | 0 ms | 0 ms |
| Initial transfer | not recorded | 2,795 KiB | 161 KiB |

SEO is intentionally reduced by `noindex`. The Windows Lighthouse process produced its known post-report `EBUSY` cleanup error; both JSON reports were written successfully.

## Known limitations

- Final public video hosting and provider configuration remain a production-release decision.
- The product remains unavailable, excluded from indexing and unable to route to Etsy.
- Excel for Mac and Excel 2021 are unverified; Google Sheets is unsupported in V1.
- Automatic expansion beyond 1,000 preformatted transaction rows is unsupported.
- Independent QA and production authorization remain outstanding.

## Items QA should attempt to break

- Trigger each video repeatedly with keyboard, touch and pointer input; verify only one start and one complete event per playback.
- Decline analytics and confirm both videos still play and the inactive checkout remains safe.
- Inspect captions against narration at the beginning, midpoint and end of both videos.
- Test 320px wrapping, landscape mobile, tablet rotation, high-DPI laptop and wide desktop.
- Confirm every meaningful image has useful alternative text and decorative poster images remain silent to assistive technology.
- Attempt to reach Etsy from every CTA while the product is paused.
- Inspect all visible media for v1.0.1, approved compatibility/capacity wording and fictional-only sample data.
- Throttle the connection and confirm no MP4 request occurs before play.
