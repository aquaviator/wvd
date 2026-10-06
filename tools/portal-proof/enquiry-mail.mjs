import {validEmailAddress} from './email-address.mjs';
import {exactEnquiryKeys,normaliseEnquiryFields,validEnquiryId,validEnquiryInstant} from './enquiry.mjs';

const address = value => validEmailAddress(value) && /^[\x21-\x7e]+$/.test(value) && !/[<>(),;:"\\]/.test(value);
const receipt = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const subject = 'New Wear Valley Digital service enquiry';

// The host supplies the existing keyless gmail.send-only auth client. Sender
// and owner recipient are trusted configuration, never visitor-controlled.
export function createGoogleEnquiryMailSender({authClient,senderEmail,recipientEmail,clock,requestTimeoutMs = 10000}) {
  if (typeof authClient?.request !== 'function' || typeof authClient?.verifyAccess !== 'function' || !address(senderEmail) || !address(recipientEmail) || typeof clock !== 'function' || !Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 15000) throw Error('INVALID_MAIL_CONFIGURATION');
  return {
    async verifyAccess() { return authClient.verifyAccess(); },
    async send(message) {
      if (!exactEnquiryKeys(message,['id','createdAt','fields']) || !validEnquiryId(message.id) || !validEnquiryInstant(message.createdAt)) throw Error('INVALID_ENQUIRY_MAIL');
      let fields;
      try { fields = normaliseEnquiryFields(message.fields); } catch { throw Error('INVALID_ENQUIRY_MAIL'); }
      const at = clock();
      if (!validEnquiryInstant(at)) throw Error('INVALID_MAIL_CONFIGURATION');
      const text = [
        'A service enquiry was received and saved by Wear Valley Digital.',
        `Enquiry reference: WVD-${message.id.slice(0,12).toUpperCase()}`,
        `Receipt: ${message.id}`,`Received: ${message.createdAt}`,'',
        `Name: ${fields.name}`,`Business: ${fields.business}`,`Contact email: ${fields.email}`,'',
        'Project brief:',fields.need,'',
        ...(fields.website ? [`Existing website: ${fields.website}`] : []),
        ...(fields.timing ? [`Timing: ${fields.timing}`] : []),
        ...(fields.budget ? [`Budget: ${fields.budget}`] : []),'',
        'This message is an owner notification. No acknowledgement email was sent to the visitor.'
      ].join('\n');
      const encoded = Buffer.from(text,'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');
      const mime = [`From: ${senderEmail}`,`To: ${recipientEmail}`,`Date: ${new Date(at).toUTCString()}`,`Message-ID: <enquiry-${message.id}@${senderEmail.split('@')[1]}>`,`Subject: ${subject}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',encoded,''].join('\r\n');
      const raw = Buffer.from(mime,'utf8').toString('base64url');
      if (raw.length > 32768) throw Error('INVALID_ENQUIRY_MAIL');
      // A stable Message-ID aids manual reconciliation, not provider deduping.
      // No automatic retry: a timeout may follow an actual provider acceptance.
      try {
        const {data} = await authClient.request({url:'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',method:'POST',data:{raw},timeout:requestTimeoutMs,signal:AbortSignal.timeout(requestTimeoutMs),retry:false,maxRedirects:0,maxContentLength:16384,responseType:'json'});
        if (!receipt(data?.id)) throw Error();
        return {status:'ACCEPTED',receipt:data.id};
      } catch { throw Error('MAIL_SEND_OUTCOME_UNKNOWN'); }
    }
  };
}

export function createEnquiryNotificationDispatcher({store,sender,clock}) {
  if (['read','noteNotificationFailure','claimNotification','finishNotification'].some(name => typeof store?.[name] !== 'function') || typeof sender?.verifyAccess !== 'function' || typeof sender?.send !== 'function' || typeof clock !== 'function') throw Error('INVALID_CONFIGURATION');
  return async id => {
    if (!validEnquiryId(id) || !validEnquiryInstant(clock())) throw Error('INVALID_ENQUIRY');
    const row = await store.read(id);
    if (!row) return {status:'NOT_FOUND',providerAccepted:false};
    if (row.notification.status !== 'PENDING') return {status:row.notification.status,providerAccepted:row.notification.status === 'ACCEPTED'};
    // Credential failure here is known to precede the send boundary. Keep it
    // retryable and visible, without claiming the provider received anything.
    try { await sender.verifyAccess(); }
    catch {
      await store.noteNotificationFailure(id,'CREDENTIAL_UNAVAILABLE');
      return {status:'PENDING',providerAccepted:false};
    }
    const claim = await store.claimNotification(id);
    if (!claim.claimed) return {status:claim.enquiry?.notification.status ?? 'NOT_FOUND',providerAccepted:claim.enquiry?.notification.status === 'ACCEPTED'};
    try {
      const sent = await sender.send({id:claim.enquiry.id,createdAt:claim.enquiry.createdAt,fields:claim.enquiry.fields});
      if (sent?.status !== 'ACCEPTED' || !receipt(sent.receipt)) throw Error('MAIL_SEND_OUTCOME_UNKNOWN');
      const result = await store.finishNotification({id,claimId:claim.claimId,status:'ACCEPTED',receipt:sent.receipt});
      return {status:result.changed ? 'ACCEPTED' : 'UNKNOWN',providerAccepted:result.changed};
    } catch {
      // If recording the result also fails, the durable SENDING claim is shown
      // as UNKNOWN and will not be reclaimed or resent on an ordinary retry.
      try { await store.finishNotification({id,claimId:claim.claimId,status:'UNKNOWN'}); } catch { /* Preserve the durable claim. */ }
      return {status:'UNKNOWN',providerAccepted:false};
    }
  };
}
