# Automated development access

The reusable development flow is the primary product. The website is its first
consumer, not the boundary of the automation work (founder, 5 October 2026).

## Mandatory access discovery

1. Read tools/factory/access-registry.json and the exact referenced binding.
2. Discover current controller tools and load the relevant connector skill.
3. Verify the connected identity and target through a minimal authorised read.
4. Prefer an already-authorised route. Controller, CI and deployed-service
   permissions are distinct; none implies the others.
5. Update the registry's evidence, observation time, scope and limitations after
   grants, revocations, connection changes or verified failures.
6. Ask the founder only for genuinely missing data, elevated access/configuration,
   extra cost or an external action requiring explicit authority. Include the
   attempted route and observed failure. Continue independent authorised work.

For example: confirming receipt of an authorised test email should first use the
controller Gmail connector, scoped to that exact subject/recipient/time. The
booking service's send-only permission does not prevent the controller reading
through its separately connected account. Do not ask for inbox-reading scope for
the runtime simply to perform a controller check.

## Executable inventory and evidence

`node tools/factory/cli.mjs access email.read controller` locates the recorded
route; substituting `service` finds no inbox-read grant. Unknown capabilities
require current-tool discovery before escalating. All results explicitly remain
unverified until live evidence is refreshed; an inventory entry is not a grant.

`node tools/factory/cli.mjs access-check` validates the inventory in every CI run.
The factory standard and generated project plans include access-discovery rules.
Existing Google access CI performs actual Drive, Calendar, IAM, secret and private
runtime probes. It does not send routine test emails. Controller connectors are
session-scoped: CI cannot enumerate or authenticate them. The controller must
refresh their evidence at use, and must report unavailable tools truthfully.
This is not a claim of unattended synchronisation with ChatGPT account settings.

## Store references, not secrets

Capture account/resource identifiers, authentication mechanism, capabilities,
permission limits, verification route, observed outcomes, authoritative source,
cost authority and required human intervention. Keep tokens, private keys,
passwords, signed URLs, raw mailbox contents and secret values out of the registry.
Existing canonical resource details stay in their referenced binding/configuration
files to avoid conflicting duplicates. New products instantiate their own registry;
WVD's identities and grants are never inherited as defaults.

Known coverage is twelve routes in the WVD registry. Additional discovered access
must be added with evidence; this inventory does not assert knowledge of unseen
accounts or every permission in the Google organisation. Observed tool presence,
verified token issuance, resource access and inbox delivery are different evidence.

## Task handoff integration

Tasks may declare `accessRequirements`, for example
`[{"capability":"email.read","plane":"controller"}]`. WVD tasks use the WVD
registry; other products must supply an explicitly product-bound `accessRegistry`
in their manifest. Registry/product mismatch is rejected. Requirements without
an existing candidate remain discovery work, not an automatic founder gate.

Task packets include only matching routes and a hash of the inventory. Inventory
changes invalidate cached packets. Access information counts against the existing
context budget; it is never silently omitted. The freshness assessor distinguishes
missing session discovery, stale/future-dated evidence, prior failures and recent
evidence requiring a target check. No category grants authority or implies live
access. Check freshness at execution time, not while caching a context packet.

Every Google access run now records `access-evidence.json` with its source commit,
run/attempt, observation time and bounded outcomes for resource reads, writer
grant inspection, confirmation key/signing, private runtime and mail scope.
Failed, cancelled and skipped steps never become PASS. The artifact is retained
for one day; controllers must persist important non-secret outcomes in the
registry/checkpoint before expiry. CI cannot capture controller-session settings.
Retrieve receipts from the trusted GitHub run; a caller-supplied JSON file is not
independent proof. This report does not send messages or change permissions.

## Receipt reconciliation

Before using a saved CI receipt, fetch its run and the complete jobs response
through the current GitHub connector. Use the same run attempt; reject incomplete
pagination. Retrieve the receipt from that run's artifact, or use an already
preserved receipt whose artifact provenance is recorded in the handoff.

`node tools/factory/cli.mjs access-receipt <receipt.json> <github-evidence.json>`
checks a bundle containing `run`, `jobs` and the explicitly selected
`sourceCommit`. The CLI uses the repository's current Google binding and current
time, not caller-supplied account bindings or observation time. The WVD adapter
reuses the version-one report producer; it rejects foreign repository/owner/ref,
workflow, source, attempt, identity, missing/duplicate steps and changed capability
claims. Successful access checks and the overall workflow/job outcomes remain
separate, so a later job failure cannot be hidden by a passing probe.

`RECEIPT_MATCHED` means the JSON agrees with the supplied GitHub evidence. It
does not authenticate arbitrary local JSON, prove the current service revision,
refresh old observations, grant access, or write the registry. Freshness is
computed at execution. Connector retrieval remains the trusted boundary; do not
feed worker-supplied metadata into this command as independent verification.
This adapter covers the existing WVD receipt format; other products need their
own explicit binding and report adapter rather than inheriting WVD's principal.
