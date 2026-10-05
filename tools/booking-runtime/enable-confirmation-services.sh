#!/usr/bin/env bash
# Founder/admin preparation. Does not send mail or change Workspace delegation.
set -euo pipefail
project=wvd-development
account=wvd-development@wvd-development.iam.gserviceaccount.com
secret=wvd-booking-confirmation-key
test "$(gcloud projects describe "$project" --format='value(projectNumber)')" = 6616382131
gcloud services enable gmail.googleapis.com secretmanager.googleapis.com --project="$project" --quiet
existing="$(gcloud secrets list --project="$project" --filter="name:$secret" --format='value(name)')"
if test -z "$existing"; then
  gcloud secrets create "$secret" --project="$project" --replication-policy=automatic --labels=product=wvd,purpose=booking-confirmation --quiet
elif test "$existing" != "$secret" && test "$existing" != "projects/6616382131/secrets/$secret" && test "$existing" != "projects/$project/secrets/$secret"; then
  echo SECRET_SELECTION_REQUIRES_REVIEW >&2; exit 1
fi
test "$(gcloud secrets describe "$secret" --project="$project" --format='value(labels.product)')" = wvd
test "$(gcloud secrets describe "$secret" --project="$project" --format='value(labels.purpose)')" = booking-confirmation
versions="$(gcloud secrets versions list "$secret" --project="$project" --format='value(name)')"
if test -z "$versions"; then
  # Binary key goes directly into Secret Manager, never console output or a file.
  openssl rand 32 | gcloud secrets versions add "$secret" --project="$project" --data-file=- --quiet
fi
gcloud secrets add-iam-policy-binding "$secret" --project="$project" \
  --member="serviceAccount:$account" --role=roles/secretmanager.secretAccessor \
  --condition=None --quiet --format='value(etag)'
echo 'WORKSPACE_CLIENT_ID:'
gcloud iam service-accounts describe "$account" --project="$project" --format='value(oauth2ClientId)'
echo 'ENABLED_KEY_VERSION_REFERENCES:'
gcloud secrets versions list "$secret" --project="$project" --filter='state=ENABLED' --format='value(name)'
echo 'CONFIRMATION_SERVICES_PREPARED_NO_MESSAGE_SENT'
echo 'Workspace admin must separately ADD https://www.googleapis.com/auth/gmail.send to the existing client scopes; preserve calendar.events.'
