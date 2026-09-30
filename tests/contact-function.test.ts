import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../functions/api/contact';
import { CONTACT_RECIPIENT, contactConfigured, MAX_CONTACT_BYTES, type ContactEnv } from '../src/lib/contact/delivery';
import { loadSite } from '../src/lib/validation/load';

const env: ContactEnv = { CONTACT_EMAIL_PROVIDER: 'resend', CONTACT_FROM_EMAIL: 'verified@example.com', RESEND_API_KEY: 'unit-test-provider-secret', TURNSTILE_SITE_KEY: 'unit-test-site-key', TURNSTILE_SECRET_KEY: 'unit-test-turnstile-secret' };
const valid = { name: ' Visitor ', email: 'visitor@example.com', message: 'A real question\nwith context', token: 'verified-token', website: '', submissionId: '8f10bfec-48b5-42f0-9cd9-a331df143144' };
const origin = 'https://preview.pages.dev';
function request(data: unknown = valid, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/contact`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
}
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const passBot = () => response({ success: true, hostname: 'preview.pages.dev', action: 'wvd_contact' });
afterEach(() => vi.unstubAllGlobals());

describe('Pages enquiry boundary', () => {
  it('waits for provider acceptance and sends only to the approved company mailbox', async () => {
    expect(CONTACT_RECIPIENT).toBe(loadSite().company_contact_email);
    let accept!: (value: Response) => void;
    const delivery = new Promise<Response>(resolve => { accept = resolve; });
    const fetcher = vi.fn().mockResolvedValueOnce(passBot()).mockImplementationOnce(() => delivery);
    vi.stubGlobal('fetch', fetcher);
    let finished = false;
    const pending = onRequest({ request: request(), env }).then(value => { finished = true; return value; });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(finished).toBe(false);
    const [destination, init] = fetcher.mock.calls[1];
    expect(destination).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe(`Bearer ${env.RESEND_API_KEY}`);
    expect(init.headers['Idempotency-Key']).toBe(`wvd-contact-${valid.submissionId}`);
    expect(JSON.parse(init.body)).toEqual({ from: env.CONTACT_FROM_EMAIL, to: [CONTACT_RECIPIENT], reply_to: valid.email, subject: 'WVD general enquiry', text: `Name: Visitor\nReply email: ${valid.email}\n\n${valid.message}` });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ secret: env.TURNSTILE_SECRET_KEY, response: valid.token });
    accept(response({ id: 'accepted-email-id' }));
    const result = await pending;
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true });
    expect(result.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([
    { name: '' }, { name: 'x'.repeat(101) }, { name: 'Name\r\nBcc: attacker@example.com' },
    { email: 'bad' }, { email: 'visitor@example.com\r\nBcc: attacker@example.com' }, { email: 'x'.repeat(255) },
    { message: '   ' }, { message: 'x'.repeat(1501) }, { message: 'null\u0000byte' },
    { token: '' }, { token: 'x'.repeat(2049) }, { submissionId: 'not-a-uuid' }, { to: 'attacker@example.com' },
  ])('rejects invalid/over-limit/header-injection input before outbound requests: %j', async overrides => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const result = await onRequest({ request: request({ ...valid, ...overrides }), env });
    expect(result.status).toBe(400); expect(fetcher).not.toHaveBeenCalled();
  });

  it('bounds streamed requests even without a truthful Content-Length', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const req = new Request(`${origin}/api/contact`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: 'x'.repeat(MAX_CONTACT_BYTES + 1) });
    expect((await onRequest({ request: req, env })).status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    { 'Content-Length': `${MAX_CONTACT_BYTES + 1}` },
    { Origin: 'https://attacker.example' }, { Origin: '' }, { 'Content-Type': 'text/plain' },
  ])('rejects oversized or cross-origin/unsupported requests: %j', async headers => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await onRequest({ request: request(valid, headers), env })).status).toBeGreaterThanOrEqual(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects bot honeypot before verification/provider', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await onRequest({ request: request({ ...valid, website: 'spam' }), env })).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([{ success: false }, { success: true, hostname: 'elsewhere.example', action: 'wvd_contact' }, { success: true, hostname: 'preview.pages.dev', action: 'login' }, { success: 'true', hostname: 'preview.pages.dev', action: 'wvd_contact' }])('enforces successful Turnstile, action and hostname: %j', async result => {
    const fetcher = vi.fn().mockResolvedValue(response(result)); vi.stubGlobal('fetch', fetcher);
    expect((await onRequest({ request: request(), env })).status).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects a reused token when Siteverify rejects its second use', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(passBot()).mockResolvedValueOnce(response({ id: 'accepted' })).mockResolvedValueOnce(response({ success: false, 'error-codes': ['timeout-or-duplicate'] }));
    vi.stubGlobal('fetch', fetcher);
    expect((await onRequest({ request: request(), env })).status).toBe(200);
    expect((await onRequest({ request: request(), env })).status).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each([response({ error: 'private upstream failure' }, 429), response({}), response({ id: 123 }), new Response('malformed')])('does not claim submission on provider rejection/malformed acknowledgement', async providerResponse => {
    const fetcher = vi.fn().mockResolvedValueOnce(passBot()).mockResolvedValueOnce(providerResponse); vi.stubGlobal('fetch', fetcher);
    const result = await onRequest({ request: request(), env });
    expect(result.status).toBe(502);
    const text = await result.text(); expect(text).not.toContain('private upstream'); expect(text).not.toContain(env.RESEND_API_KEY!); expect(JSON.parse(text).ok).toBe(false);
  });

  it('fails safely on provider timeout without exposing secrets/content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(passBot()).mockRejectedValueOnce(new Error(`timeout ${env.RESEND_API_KEY} ${valid.message}`)));
    const result = await onRequest({ request: request(), env });
    expect(result.status).toBe(502); expect(await result.json()).toEqual({ ok: false, error: 'delivery_unavailable' });
  });

  it('fails closed on Siteverify transport errors without contacting sender', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('private failure')); vi.stubGlobal('fetch', fetcher);
    expect((await onRequest({ request: request(), env })).status).toBe(502); expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('exposes only the public key and availability; rejects absent/unsupported config and test keys', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const get = new Request(`${origin}/api/contact`);
    expect(await (await onRequest({ request: get, env })).json()).toEqual({ enabled: true, siteKey: env.TURNSTILE_SITE_KEY });
    for (const overrides of [{ RESEND_API_KEY: '' }, { TURNSTILE_SECRET_KEY: '' }, { CONTACT_EMAIL_PROVIDER: 'unknown' }, { CONTACT_FROM_EMAIL: 'not-an-email' }, { TURNSTILE_SITE_KEY: '1x00000000000000000000AA' }]) {
      const configuration = { ...env, ...overrides };
      expect(contactConfigured(configuration)).toBe(false);
      expect((await onRequest({ request: request(), env: configuration })).status).toBe(503);
      expect(await (await onRequest({ request: get, env: configuration })).json()).toEqual({ enabled: false, siteKey: null });
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect((await onRequest({ request: new Request(`${origin}/api/contact`, { method: 'DELETE' }), env })).status).toBe(405);
  });
});
