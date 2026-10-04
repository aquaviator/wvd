#!/usr/bin/env bash
# One-time elevated setup, prepared for explicit founder approval.
# This does not create a host/repository, change billing, enable APIs or deploy.
set -euo pipefail
project=wvd-development
account=wvd-development@wvd-development.iam.gserviceaccount.com
number="$(gcloud projects describe "$project" --format='value(projectNumber)')"
test "$number" = 6616382131 || { echo PROJECT_BINDING_MISMATCH >&2; exit 1; }
# The attached runtime needs to sign its own short-lived Calendar assertions.
gcloud iam service-accounts add-iam-policy-binding "$account" \
  --project="$project" --member="serviceAccount:$account" \
  --role=roles/iam.serviceAccountTokenCreator --condition=None --quiet --format='value(etag)'
# The authorised CI account may attach this specific account to a managed host.
gcloud iam service-accounts add-iam-policy-binding "$account" \
  --project="$project" --member="serviceAccount:$account" \
  --role=roles/iam.serviceAccountUser --condition=None --quiet --format='value(etag)'
# Creation needs project scope. This grants service development, not IAM admin.
gcloud projects add-iam-policy-binding "$project" \
  --member="serviceAccount:$account" --role=roles/run.developer \
  --condition=None --quiet --format='value(etag)'
echo RUNTIME_ACCESS_CONFIGURED_NO_HOST_OR_SPEND_CREATED
