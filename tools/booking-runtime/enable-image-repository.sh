#!/usr/bin/env bash
# Founder/admin setup only. No deployment, public IAM, billing or key creation.
set -euo pipefail
project=wvd-development
region=europe-west2
repository=wvd-booking-runtime
account=wvd-development@wvd-development.iam.gserviceaccount.com
number="$(gcloud projects describe "$project" --format='value(projectNumber)')"
test "$number" = 6616382131 || { echo PROJECT_BINDING_MISMATCH >&2; exit 1; }
gcloud services enable run.googleapis.com artifactregistry.googleapis.com --project="$project" --quiet
# Listing must succeed; a permission/network failure is never treated as absence.
existing="$(gcloud artifacts repositories list --project="$project" --location="$region" --filter="name:/$repository" --format='value(name)')"
expected="projects/$project/locations/$region/repositories/$repository"
if test -z "$existing"; then
  gcloud artifacts repositories create "$repository" --project="$project" \
    --location="$region" --repository-format=docker --immutable-tags \
    --disable-vulnerability-scanning --description='WVD booking development runtime' --quiet
elif test "$existing" != "$expected"; then
  echo REPOSITORY_SELECTION_REQUIRES_REVIEW >&2
  exit 1
fi
format="$(gcloud artifacts repositories describe "$repository" --project="$project" --location="$region" --format='value(format)')"
test "$format" = DOCKER || { echo REPOSITORY_FORMAT_MISMATCH >&2; exit 1; }
# Repository-scoped writer includes reads/uploads; it cannot create repositories
# or administer project IAM. Existing unrelated repositories are untouched.
gcloud artifacts repositories add-iam-policy-binding "$repository" \
  --project="$project" --location="$region" --member="serviceAccount:$account" \
  --role=roles/artifactregistry.writer --condition=None --quiet --format='value(etag)'
echo IMAGE_REPOSITORY_READY_NO_SERVICE_DEPLOYED
