# Sites handoff and handback

> Direct enquiry and owner Portal update, 6 October 2026:
> [WVD-ENQUIRIES-PORTAL-2026-10-06.md](WVD-ENQUIRIES-PORTAL-2026-10-06.md)
> records the completed implementation and the remaining one-time Google setup
> and real owner sign-in. Sites version 7 is built and saved, not deployed;
> source 1de317f95f43d11675303f2d270e2dbaed73bc78. Saved version ID:
> appgprj_6ac361a8bfd48191b3bde453565cf2ab~appgver_9054e2f3a32481918417774bf7a693ae.
> Controller app/runtime source bb53eef40280ae8a575e704baceca3a98093ab2a passed
> Google and container checks. Final test source
> 929342fcc7fe87a10e292a94544f3bd5130fb246 passed all ordinary push/PR CI:
> 94 public browser and eight combined Portal browser checks. The new Google
> service is privately verified at https://wvd-service-v3b6mv7uka-nw.a.run.app.
> Version 7 includes the actual service origin in connect-src; version 6 was
> superseded before publication. Controller 929342fcc7fe87a10e292a94544f3bd5130fb246
> passed both push/PR CI with the production security policy applied: runs
> 37474782789 and 37474790790, all 94 public and eight Portal checks passed.
> Retain the live version 5 until the real owner and enquiry flow are verified,
> then deploy the already saved version 7 with the existing public audience.
> No DNS change, product publication or routine approval is required.

> Current service-launch scope and release evidence (6 October 2026):
> [WVD-SERVICE-LAUNCH-2026-10-06.md](WVD-SERVICE-LAUNCH-2026-10-06.md).
> The founder requested a public WVD service offering independently of product launch.
> Public Site: https://wearvalleydigital.com/ — version 5, public audience.
> Apex and www DNS, native ACTIVE/TLS status and anonymous HTTPS delivery were
> verified on 6 October 2026. Branded canonical/sitemap metadata is deployed.
> Sites source: e1b95d27f8691885964a4cd5579a65e10acba627.
> Controller d2780e8575b3eeeff6e7489a0093e19c142a98d4 passed push/PR CI, all four jobs.
> The linked receipt records the exact runs and reviewed source-bound screenshots.

Authority: founder instruction, 5 October 2026.

## Default routing

Route future web-facing development through the Sites workflow for capabilities
within its supported scope: branding, UX, responsive pages, navigation, creative
content and user-facing interactions. The WVD controller remains accountable for
the complete product and handles specific integrations, extended functionality,
Google/Firebase services, booking rules, identity, permissions and operational
reliability. Assess supported Sites capabilities before custom implementation;
do not assume every backend function needs moving into Sites.

Sites is a development capability, not a guarantee of a separately running agent
or access to another chat. The owning agent uses the Sites skills and tools.
A separate worker requires a concrete task and an available handoff mechanism.
Do not claim a handoff occurred until the receiving worker or workflow has
actually received it. Keep one owner for each Site checkout, publishing and
source synchronization; bounded asset/research delegation follows Sites rules.

## Handoff from controller

Supply the agreed scope and acceptance criteria; source repository and exact
revision; existing Site identity if any; original brand assets and content rules;
routes and user journeys; API request/response contracts and error states;
synthetic examples; permitted origins and authentication expectations; existing
hosting constraints; and outstanding access or cost dependencies.
Never include secrets, real customer data or live credentials in a handoff.

Preserve the existing WVD brand. Creative articles inherit the feature visual,
short contextual video and complete text standard, with optional useful
infographics, sources and review dates. Every page has a relevant CTA.
Do not claim guaranteed AI indexing, authority or factual freshness.

## Handback to controller

Return exact source revision and changed files, Site identity and preview or
published URL where actually available, completed user journeys, checks performed,
accessibility/responsive findings, integration contracts used, and unresolved
dependencies. Clearly distinguish fixtures, preview, live integrations and
published functionality. Record changes in the repository checkpoint so future
sessions can resume without relying on another chat's memory.

The controller connects and verifies the real integrations, resolves extended
functionality, and returns any required UI adjustments through the Sites workflow.
Handoff and handback are engineering work, not new founder approval gates.

## Platform and authority

This instruction authorises using Sites for development. It does not by itself
migrate the current Google runtime, approve new spend, grant permissions, or
replace existing data/authentication services. Sites-hosted runtime compatibility
and existing backend contracts must be assessed before choosing deployment.
Do not assume the Node/Firebase Admin booking runtime runs unchanged in a Sites
Worker. Preserve server-side booking validation and all security boundaries.

Continue independent authorised work. Ask the founder only for missing
user-supplied data, elevated admin/configuration approval or extra money, as
defined in WVD-PROJECT-AUTHORITY.md. Automated engineering checks are unattended.

## Initial state

This document records the operating decision; no Site has been created,
published, migrated or handed to another chat by this change. On 5 October the founder supplied successful runtime grant output and authorised
£5/month total additional hosting spend. See WVD-PROJECT-AUTHORITY.md.
The existing Astro site is being improved using Sites design guidance while
preserving its Google deployment direction; no Sites-hosted migration is claimed.


## Initial frontend handoff — historical

The private development Site is now published:
https://wear-valley-digital-development.leatfield.chatgpt.site
Identity: appgprj_6ac361a8bfd48191b3bde453565cf2ab.
Initial Sites source a07157c33c4ea8f1493312028704f935118da255 maps to controller
source 4a193dd2f24461722d95f33c17e69e7af9bfcb4a.
Use this exact Site for future frontend work. Open and synchronize its latest
source before edits, then return frontend changes and evidence to this controller.
The initial published version is a private static website, not the live Google
booking runtime. Backend contracts and secrets remain controller-owned.
