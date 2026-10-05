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

Workers have supplied the product handoffs listed below. Monitor subsequent
changes and consume the current continuation records; do not overwrite in-progress documents or duplicate
active product work. Preserve product ownership of research, blueprint, backlog,
implementation and release evidence; WVD coordinates shared delivery and concise
portfolio status. Keep existing access, spending and message-send boundaries.

Verified Drive destinations:
- WVD: https://drive.google.com/drive/folders/13mG23q4WgFJJA8p_ZKS2YNi1iVc_rvuB
- Salon: https://drive.google.com/drive/folders/1FWRwktOHb35OsLnTyQr8ztdjLp3ghvAz
- Wedding: https://drive.google.com/drive/folders/1Fu8f_rmGV69m41tp-9mrP4gJfscCItdu

## Completed product handoffs received — 5 October 2026

Both workers have now supplied continuation records. This supersedes the earlier
waiting-for-transfer snapshot; receiving a handoff is not accepting its baseline.

- Salon: [Drive continuation](https://docs.google.com/document/d/1UWRqPRp4c_khZAPziy8g8y0gkyHhn1gBh8YznWwyAS4/edit),
  [portfolio receipt](https://docs.google.com/document/d/1efNgxoNGku18nCHM1M_3VbpEWcx_adqkh6Ys2mhzwtA/edit),
  [START_HERE](https://github.com/aquaviator/WVD-Salon/blob/import/salon-foundation/START_HERE.md).
  Observed branch head: `83b1ebe2e7338535634f0ed52f01c7ac1e8a2273`.
  Start with **SALON-WVD-001**, verify and accept the existing handoff, using
  `handoff/wvd/current-state.json`, `delivery-backlog.json` and its task JSON.
  The ten-item overlay supersedes historical NOT_STARTED engineering state.
  Work remains in draft PR #1; live release is not approved. Preserve the
  payment-readiness restriction, including no financial transactions in Sites.
- Wedding: [START HERE](https://docs.google.com/document/d/1WHETJI6Glb1aZh1e9ES2EHJOJ6RhMUeQM7vGnmNxmAs/edit),
  [repository continuation](https://github.com/aquaviator/WVD-Wedding/blob/master/handoff/WVD-CONTINUATION.md).
  Observed master head: `afdfa62fc8d3ce297a747ae2522e3318fbb44fb2`.
  Start with **WED-CONT-001**, reconcile and reproduce the baseline, before
  selecting a feature from the fourteen-package overlay. Read root HANDOFF.md,
  `handoff/current-backlog.json` and `handoff/wvd-context.json`.
  The fictional private prototype exists; deployed application source is
  `19fb8408366deecf5ac54df3fbbffd53020e0aec`, distinct from later handoff
  commits. All 32 full acceptance scenarios remain NOT_RUN. Preserve its native
  stack and original contracts; no commercial release or audience widening.

The Drive [current work queue](https://docs.google.com/document/d/16Q8nFXWd9u-1rtQ0m6o4Z36yioLaU2fGMx6Oj5vOHTk/edit)
records Wedding intake as context registered / next task proposed, with no named
assignees. Check current ownership before dispatch; bind independent verification
to the exact submitted revision. These intake tasks are not completed by reading
their documents. Product application changes belong in their own repositories
and existing authorised branches; WVD coordination changes belong on
development/shared-factory-bootstrap. Refresh branch heads and changed Drive
records before execution. Do not restart immutable original backlogs, duplicate
workers, or treat WVD's Google platform as authority to migrate either product.

Salon and Wedding take commercial priority over extending superseded demos.
The existing WVD booking implementation and evidence remain available for reuse.
Sites presentation replacement remains authorised, with product capabilities
described according to evidence rather than implying paid-customer readiness.
