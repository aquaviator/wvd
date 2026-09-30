# WVD contact deployment configuration

The existing static Astro build remains unchanged. Cloudflare Pages discovers the root `functions/api/contact.ts`; `public/_routes.json` limits Function execution to `/api/contact`. Deploy the repository with Functions, not just the static `dist` directory through the dashboard upload UI.

The primary form uses same-origin JSON POST to `/api/contact`. The Function validates and bounds input, verifies a single-use Turnstile token (including `wvd_contact` action and the actual request hostname), and sends through the isolated Resend HTTP adapter. The recipient is fixed to `hello@wearvalleydigital.com`; submitted fields cannot choose a recipient or subject. No application persistence, CRM or request-content logging is added. Resend processes the enquiry and may retain its own provider logs according to its account policy.

## Pages environment configuration

Configure preview independently before creating a preview deployment:

| Name | Storage | Value |
| --- | --- | --- |
| `CONTACT_EMAIL_PROVIDER` | Environment variable | `resend` |
| `CONTACT_FROM_EMAIL` | Environment variable | A real sender verified in the provider account. No sender is invented or defaulted. |
| `RESEND_API_KEY` | Encrypted deployment secret | Provider key with sending access only |
| `TURNSTILE_SITE_KEY` | Environment variable | Public widget key; allow the actual preview hostname and later the production hostname |
| `TURNSTILE_SECRET_KEY` | Encrypted deployment secret | Matching server verification key |

Never put real credentials in source, public build variables, committed `.env` files or chat. `.dev.vars`, `.env` and local Wrangler state are ignored. Public Turnstile testing keys are rejected by the configured endpoint. Unconfigured/unsupported transport fails closed and the page offers the existing mail-app draft/direct-email fallback. GET `/api/contact` exposes only availability and the public site key, never server credentials or sender configuration.

The Resend adapter uses `POST https://api.resend.com/emails`, plaintext content, a fixed subject, submitted email as `reply_to`, and a provider idempotency key per submission. Only a successful provider response with an email ID produces the UI success state; that indicates accepted submission, not proven inbox receipt. Provider/verification timeouts and malformed responses show failure/fallback without clearing the message. The same submission ID is retained for retry of unchanged content; editing creates a new ID. Turnstile is reset after every attempt and checked server-side for every request.

## Checks and preview gate

Run `npm run build`, `npm test`, and `npm run test:e2e`. Compile the Function with `npx wrangler pages functions build --outdir .wrangler/functions-build`. For actual local Functions execution, use `npx wrangler pages dev dist` with local `.dev.vars` configured; public test secrets are not a preview acceptance shortcut.

Use the existing Pages project's non-production branch preview. Record the immutable preview deployment URL/ID, Pages commit hash, exact source commit, environment and bindings (names only). Do not deploy the production branch or merge before separate QA. Preview must run the real Function; a static browser fixture and mocked provider tests are necessary local evidence, not live delivery proof.

QA needs success after provider acceptance, provider rejection/timeouts with preserved fallback, invalid/oversized request rejection, failed/missing/mismatched/reused Turnstile rejection without sending, recipient, accessibility, actual CSP/widget loading, secret absence in emitted files/responses, and deployment identity. An authorised test enquiry to the approved company mailbox is needed to verify the real integration; do not claim inbox receipt without observation. Production F13 remains open until exact deployed evidence exists.

Historical Landlord order support remains separately linked to Etsy order conversations. The application does not reactivate that product.

Provider boundary: change `deliverEnquiry` and the configuration predicate to introduce another supported sender; client, validation, Turnstile and fixed recipient need not change.

References: [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/), [Pages environment/secrets](https://developers.cloudflare.com/pages/functions/bindings/), [Turnstile server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Resend send API](https://resend.com/docs/api-reference/emails/send-email).
