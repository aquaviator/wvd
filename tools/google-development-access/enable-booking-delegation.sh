#!/usr/bin/env bash
# Founder-approved 4 October 2026. Cloud Shell only; no keys or project-wide roles.
# Reuses the bootstrap's fixed binding and trust condition. Workspace scope
# authorisation remains a super-administrator action outside gcloud.
set -euo pipefail
project=wvd-development
account=wvd-development@wvd-development.iam.gserviceaccount.com
pool=wvd-github-development
provider=github
number="$(gcloud projects describe "$project" --format='value(projectNumber)')"
test "$number" = 6616382131 || { echo PROJECT_BINDING_MISMATCH >&2; exit 1; }
client_id="$(gcloud iam service-accounts describe "$account" --project="$project" --format='value(oauth2ClientId)')"
[[ "$client_id" =~ ^[0-9]+$ ]] || { echo OAUTH_CLIENT_ID_UNAVAILABLE >&2; exit 1; }
gcloud iam workload-identity-pools providers describe "$provider" --project="$project" --location=global --workload-identity-pool="$pool" --format=json |
python3 -c 'import json,sys
p=json.load(sys.stdin)
required={"google.subject":"assertion.sub","attribute.repository_id":"assertion.repository_id"}
mapping=p.get("attributeMapping",{})
if p.get("disabled") or p.get("state")!="ACTIVE" or p.get("oidc",{}).get("issuerUri")!="https://token.actions.githubusercontent.com" or not isinstance(mapping,dict) or any(mapping.get(k)!=v for k,v in required.items()):
    sys.exit("PROVIDER_BINDING_DRIFT_REVIEW_REQUIRED")
'
condition="assertion.repository_id=='1347788556' && assertion.repository_owner_id=='78605956' && assertion.ref=='refs/heads/development/shared-factory-bootstrap' && assertion.workflow_ref=='aquaviator/wvd/.github/workflows/google-development-access.yml@refs/heads/development/shared-factory-bootstrap' && (assertion.event_name=='push' || assertion.event_name=='workflow_dispatch')"
gcloud iam workload-identity-pools providers update-oidc "$provider" --project="$project" --location=global --workload-identity-pool="$pool" --attribute-condition="$condition" --quiet
member="principalSet://iam.googleapis.com/projects/6616382131/locations/global/workloadIdentityPools/wvd-github-development/attribute.repository_id/1347788556"
gcloud iam service-accounts add-iam-policy-binding "$account" --project="$project" --member="$member" --role=roles/iam.serviceAccountTokenCreator --quiet --format='value(etag)'
printf '\nWORKSPACE_CLIENT_ID=%s\nWORKSPACE_SCOPE=https://www.googleapis.com/auth/calendar.events\nBOOKING_ORGANISER=admin@wearvalleydigital.com\n' "$client_id"
