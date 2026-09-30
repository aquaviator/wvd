import { z } from 'zod';

export const CONTACT_RECIPIENT = 'hello@wearvalleydigital.com';
export const CONTACT_ACTION = 'wvd_contact';
export const MAX_CONTACT_BYTES = 16_384;

export const enquirySchema = z.object({
  name: z.string().trim().min(1).max(100).refine(value => !/[\u0000-\u001f\u007f]/.test(value)),
  email: z.string().trim().max(254).email(),
  message: z.string().trim().min(1).max(1500).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)),
  token: z.string().min(1).max(2048),
  website: z.string().max(200).default(''),
  submissionId: z.string().uuid(),
}).strict();

export type ContactEnv = {
  CONTACT_EMAIL_PROVIDER?: string;
  CONTACT_FROM_EMAIL?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
};

export function contactConfigured(env: ContactEnv): boolean {
  return env.CONTACT_EMAIL_PROVIDER === 'resend'
    && z.string().email().safeParse(env.CONTACT_FROM_EMAIL).success
    && !!env.RESEND_API_KEY?.trim()
    && !!env.TURNSTILE_SITE_KEY?.trim()
    && !!env.TURNSTILE_SECRET_KEY?.trim()
    // Public testing keys must never enable a deployed enquiry endpoint.
    && !/^[123]x00000000000000000000/.test(env.TURNSTILE_SITE_KEY!)
    && !/^[123]x0000000000000000000000000000000/.test(env.TURNSTILE_SECRET_KEY!);
}

// Provider-specific payload/authentication stays behind this boundary.
// No customer message is persisted or logged by the application.
export async function deliverEnquiry(
  enquiry: z.infer<typeof enquirySchema>, env: ContactEnv, send: typeof fetch = fetch,
): Promise<boolean> {
  if (env.CONTACT_EMAIL_PROVIDER !== 'resend') return false;
  const response = await send('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `wvd-contact-${enquiry.submissionId}`,
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM_EMAIL,
      to: [CONTACT_RECIPIENT],
      reply_to: enquiry.email,
      subject: 'WVD general enquiry',
      text: `Name: ${enquiry.name}\nReply email: ${enquiry.email}\n\n${enquiry.message}`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return false;
  const result = await response.json() as { id?: unknown };
  return typeof result.id === 'string' && result.id.trim().length > 0;
}
