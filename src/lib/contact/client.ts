type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
};

export function initialiseContactForm() {
  const form = document.querySelector<HTMLFormElement>('#contact-form');
  const link = document.querySelector<HTMLAnchorElement>('#draft-link');
  const ready = document.querySelector<HTMLElement>('#draft-ready');
  const status = document.querySelector<HTMLElement>('#contact-status');
  const submit = document.querySelector<HTMLButtonElement>('#contact-submit');
  const draft = document.querySelector<HTMLButtonElement>('#prepare-draft');
  const fallback = document.querySelector<HTMLDetailsElement>('#email-fallback');
  const widget = document.querySelector<HTMLElement>('#contact-turnstile');
  if (!form || !link || !ready || !status || !submit || !draft || !fallback || !widget) return;
  form.hidden = false;
  let token = '';
  let sending = false;
  let sent = false;
  let submissionId = crypto.randomUUID();
  let widgetId: string | undefined;
  const turnstile = () => (window as unknown as { turnstile?: Turnstile }).turnstile;
  const updateSubmit = () => { submit.disabled = !token || sending || sent; };
  const showFailure = (message: string) => {
    status.textContent = message;
    fallback.open = true;
    status.focus();
  };
  draft.addEventListener('click', () => {
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const body = `Name: ${data.get('name')}\nReply email: ${data.get('email')}\n\n${data.get('message')}`;
    link.href = `mailto:${form.dataset.recipient}?subject=${encodeURIComponent('WVD general enquiry')}&body=${encodeURIComponent(body)}`;
    ready.hidden = false;
    link.focus();
  });
  form.addEventListener('input', () => {
    ready.hidden = true;
    link.removeAttribute('href');
    submissionId = crypto.randomUUID();
    if (sent) { sent = false; status.textContent = 'Complete the bot check to send another enquiry.'; }
    updateSubmit();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || sent || !form.reportValidity()) return;
    if (!token) { showFailure('Complete the bot check, or use the email fallback.'); return; }
    const data = new FormData(form);
    sending = true;
    updateSubmit();
    form.setAttribute('aria-busy', 'true');
    // Keep the displayed fields aligned with the submitted snapshot while waiting.
    const fields = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')];
    fields.forEach(field => { field.readOnly = true; });
    status.textContent = 'Sending your enquiry…';
    try {
      const response = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.get('name'), email: data.get('email'), message: data.get('message'), website: data.get('website'), token, submissionId }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json() as { ok?: unknown; error?: unknown };
      if (response.ok && result.ok === true) {
        sent = true;
        status.textContent = 'Thank you—your enquiry has been submitted.';
        status.focus();
        ready.hidden = true;
        link.removeAttribute('href');
      } else {
        showFailure(result.error === 'invalid_input'
          ? 'Check your name, email and message, then try again or use the email fallback.'
          : result.error === 'verification_failed'
            ? 'The bot check expired or failed. Please try again or use the email fallback.'
            : 'Submission could not be confirmed. Your message is still here; try again or use the email fallback.');
      }
    } catch {
      showFailure('Submission could not be confirmed. Your message is still here; try again or use the email fallback.');
    } finally {
      sending = false;
      token = '';
      fields.forEach(field => { field.readOnly = false; });
      form.removeAttribute('aria-busy');
      if (widgetId) turnstile()?.reset(widgetId);
      updateSubmit();
    }
  });
  void (async () => {
    try {
      const response = await fetch('/api/contact', { signal: AbortSignal.timeout(8000) });
      const config = await response.json() as { enabled?: unknown; siteKey?: unknown };
      if (!response.ok || config.enabled !== true || typeof config.siteKey !== 'string') throw new Error();
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error()), 10000);
        script.onload = () => { clearTimeout(timeout); resolve(); };
        script.onerror = () => { clearTimeout(timeout); reject(new Error()); };
        document.head.append(script);
      });
      if (!turnstile()) throw new Error();
      widgetId = turnstile()!.render(widget, {
        sitekey: config.siteKey, action: 'wvd_contact', size: 'flexible',
        callback: (value: string) => { token = value; if (!sending && !sent) status.textContent = 'Ready to send.'; updateSubmit(); },
        'expired-callback': () => { token = ''; if (!sending && !sent) status.textContent = 'Complete the bot check again to send.'; updateSubmit(); },
        'error-callback': () => { token = ''; updateSubmit(); if (!sending && !sent) showFailure('The bot check is unavailable. Please use the email fallback.'); },
      });
    } catch {
      token = '';
      updateSubmit();
      showFailure('Website submission is unavailable. Please use the email fallback.');
    }
  })();
}
