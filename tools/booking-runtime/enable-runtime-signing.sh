#!/usr/bin/env bash
# Prepared for the founder's elevated approval. Not run by CI or deployment.
# Grants keyless signing to the runtime account on itself, not at project scope.
set -euo pipefail
project=wvd-development
account=wvd-development@wvd-development.iam.gserviceaccount.com
number="$(gcloud projects describe "$project" --format='value(projectNumber)')"
test "$number" = 6616382131 || { echo PROJECT_BINDING_MISMATCH >&2; exit 1; }
gcloud iam service-accounts add-iam-policy-binding "$account" \
  --project="$project" \
  --member="serviceAccount:$account" \
  --role=roles/iam.serviceAccountTokenCreator \
  --condition=None \
  --quiet --format='value(etag)'
echo RUNTIME_SELF_SIGNING_CONFIGURED
