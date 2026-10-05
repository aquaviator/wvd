import {createGoogleBookingCipher} from './google-booking-cipher.mjs';
import {createKeylessMailAuthClient} from './google-keyless-mail-auth.mjs';
import {createGoogleBookingMailSender} from './google-booking-mail.mjs';
import {createBookingConfirmationDelivery} from './booking-confirmation-delivery.mjs';

// Private worker composition only. Constructing this never queues or sends mail.
export function composeBookingDeliveryRuntime({runtime,config,signer,clock,request=fetch}) {
 if(!config||Object.keys(config).sort().join(',')!=='activeKey,secretId,senderEmail,serviceAccount,versions'||!runtime?.binding||typeof clock!=='function')throw Error('INVALID_CONFIGURATION');
 const {firebase,calendarId,origin,requestTimeoutMs}=runtime.binding;
 const auth=createKeylessMailAuthClient({signer,serviceAccount:config.serviceAccount,subject:config.senderEmail,clock,request});
 const cipher=createGoogleBookingCipher({authClient:signer,projectId:firebase.projectId,secretId:config.secretId,activeKey:config.activeKey,versions:config.versions,requestTimeoutMs});
 const sender=createGoogleBookingMailSender({authClient:auth,senderEmail:config.senderEmail,clock,requestTimeoutMs});
 const worker=createBookingConfirmationDelivery({store:runtime.store,management:runtime.management,productId:firebase.productId,calendarId,managementOrigin:origin,clock,cipher,calendar:runtime.calendar,requestTimeoutMs,sender});
 return {...worker,async verifyAccess(){const key=await cipher.verifyAccess(),mail=await auth.verifyAccess();return {key,mail,writesPerformed:false,messageSent:false};}};
}
