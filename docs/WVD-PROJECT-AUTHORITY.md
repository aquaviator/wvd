# WVD project authority

Updated 4 October 2026 from the founder's explicit instruction. This file is
persistent project memory and must be carried into future controller handoffs.

Continue development against the agreed brief and outstanding work. Do not stop
for routine approval, review, verification, completed slices or a new “continue”.
Select the next in-scope task and make ordinary implementation decisions.

Request specific authorisation only when:

- The user must supply missing data.
- The action needs elevated admin or configuration approval.
- The action costs extra money beyond existing authority.

Complete available preparation first so any request concerns a concrete action.
Continue independent authorised work while input is outstanding. Automated tests
and engineering checks run unattended; they are not requests for founder review.
Report failures honestly and fix them rather than requesting routine permission.

This WVD-specific correction supersedes older blanket production-release and
“decision required” gates in checkpoints and shared factory defaults. It does not
change another product's constitution, grant missing account permissions, approve
new spending, or authorise unsolicited messages to third parties. Existing
isolated test environments remain isolated; production authority does not turn a
test runner into a live deployment environment.

Stop only when the brief is complete, the user asks to stop, or every remaining
in-scope action depends on one of the three requirements above. Maintain a current
checkpoint for interrupted sessions. A saved instruction is not an always-running
background worker.

## Sites workflow — 5 October 2026

The founder selected Sites for future supported web-facing development, with
handoff and handback to this controller for integrations and extended
functionality. Follow `WVD-SITES-HANDOFF.md`. Keep existing platform, access and
spending boundaries; no new founder review gate is introduced.

## Hosting budget and access — 5 October 2026

The founder explicitly authorised £5 per month in additional hosting spending
for WVD. This is the total additional hosting allowance, not £5 per service or
product. Include associated hosting costs and applicable taxes when assessing
fit. This supersedes the previous £0 allowance only for this scope; unrelated
subscriptions and spending remain unauthorised. No repeat approval is needed
for work within this allowance and existing access.

Before activating paid resources, assess current pricing and expected usage,
configure available cost controls, and account for storage, build and network
charges. Do not represent a budget alert or instance limit as a guaranteed
billing cap. Escalate before exceeding the allowance or committing to a plan
whose minimum charges exceed it. Recording this authority does not configure a
provider budget, create hosting, or claim a technical £5 hard cap exists.

The founder supplied successful Cloud Shell output from the pinned
enable-runtime-access.sh script: all three IAM policy updates completed and
RUNTIME_ACCESS_CONFIGURED_NO_HOST_OR_SPEND_CREATED was printed. Record these
grants as applied by the founder; effective runtime access still requires the
normal unattended integration check. Do not ask the founder to repeat the script
without evidence of a remaining permission issue.

## Primary commercial products and demo replacement — 5 October 2026

Founder direction at 17:54 BST: Salon and Wedding are the primary sellable
products. The reusable automated development flow remains the shared delivery
system supporting the products and WVD; the older demos are not the commercial
product baseline.

The founder authorises replacing the current WVD and Hospitality site demos with
the sites they have built. Use the completed product handoffs to identify the
exact replacement Sites, source and verified capability before updating WVD's
product presentation, navigation and CTAs through Sites. Retire the superseded
demo surfaces while preserving source/history. This does not request deletion of
repositories or the WVD organisation, or assert commercial release readiness.

Workers are actively updating the WVD Drive records. Monitor changes and consume
their completed handoffs; do not overwrite in-progress documents or duplicate
active product work. Preserve product ownership of research, blueprint, backlog,
implementation and release evidence; WVD coordinates shared delivery and concise
portfolio status. Keep existing access, spending and message-send boundaries.

Verified Drive destinations:
- WVD: https://drive.google.com/drive/folders/13mG23q4WgFJJA8p_ZKS2YNi1iVc_rvuB
- Salon: https://drive.google.com/drive/folders/1FWRwktOHb35OsLnTyQr8ztdjLp3ghvAz
- Wedding: https://drive.google.com/drive/folders/1Fu8f_rmGV69m41tp-9mrP4gJfscCItdu

Salon source transfer: https://github.com/aquaviator/WVD-Salon/pull/1, observed open
at 16a5d89be65650e0159ec13f617fc2c992105545. Refresh before use. Its historical
Drive backlog still says NOT_STARTED; do not treat that as current engineering
state. Wedding's current pack records specified/not implemented work; discover
its actual build/repository from the workers' handoff. Do not assume one exists.
