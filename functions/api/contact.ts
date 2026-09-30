import { contactConfigured, CONTACT_ACTION, deliverEnquiry, enquirySchema, MAX_CONTACT_BYTES, type ContactEnv } from '../../src/lib/contact/delivery';

type Context = { request: Request; env: ContactEnv };
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

async function boundedBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get('Content-Length')) > MAX_CONTACT_BYTES || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CONTACT_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export async function onRequest({ request, env }: Context): Promise<Response> {
  if (request.method === 'GET') {
    const enabled = contactConfigured(env);
    return json(200, { enabled, siteKey: enabled ? env.TURNSTILE_SITE_KEY : null });
  }
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  const url = new URL(request.url);
  if (request.headers.get('Origin') !== url.origin) return json(403, { ok: false, error: 'invalid_origin' });
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
    return json(415, { ok: false, error: 'invalid_content_type' });
  }
  let input;
  try {
    const body = await boundedBody(request);
    if (body === null) return json(413, { ok: false, error: 'request_too_large' });
    input = enquirySchema.safeParse(JSON.parse(body));
  } catch { return json(400, { ok: false, error: 'invalid_input' }); }
  if (!input.success) return json(400, { ok: false, error: 'invalid_input' });
  if (input.data.website) return json(403, { ok: false, error: 'spam_rejected' });
  if (!contactConfigured(env)) return json(503, { ok: false, error: 'contact_unavailable' });
  try {
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: input.data.token }),
      signal: AbortSignal.timeout(8000),
    });
    if (!verification.ok) return json(503, { ok: false, error: 'verification_unavailable' });
    const result = await verification.json() as { success?: unknown; hostname?: unknown; action?: unknown };
    if (result.success !== true || result.hostname !== url.hostname || result.action !== CONTACT_ACTION) {
      return json(403, { ok: false, error: 'verification_failed' });
    }
    if (!await deliverEnquiry(input.data, env)) return json(502, { ok: false, error: 'delivery_failed' });
    return json(200, { ok: true });
  } catch {
    // Never return/log provider responses, credentials, tokens or submitted content.
    return json(502, { ok: false, error: 'delivery_unavailable' });
  }
}
