# Rollback and recovery

## Previous deployment

In Cloudflare Pages, select the last verified deployment and use **Rollback to this deployment**. Confirm the canonical domain and smoke-test the home, catalogue, category, and product routes.

## Git rollback

Create a new branch from `main`, revert the faulty commit with `git revert`, run validation/tests/build, and merge through the normal pull-request flow. Do not rewrite shared history.

## Product removal and emergency marketing pause

Set a product or marketing asset status to `paused`, commit, and deploy. Do not delete its history. For an emergency, trigger the CI workflow after merging and verify the generated output.

## Expired regulatory product

Pause the product and every linked active marketing concept. Do not edit locked claims. Obtain human approval for replacement claim records, sources, and review dates; validate before reactivation.

## Cloudflare recovery

Deployment secrets belong in GitHub/Cloudflare settings, never the repository. DNS changes require a complete record inventory and separate authorization.
