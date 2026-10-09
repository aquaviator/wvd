import {readFileSync} from 'node:fs';
export const bookingAssets=new Map([
 ['/book',['text/html; charset=utf-8',readFileSync(new URL('./ui/booking.html',import.meta.url))]],
 ['/booking.js',['text/javascript; charset=utf-8',readFileSync(new URL('./ui/booking.js',import.meta.url))]],
 ['/booking.css',['text/css; charset=utf-8',readFileSync(new URL('./ui/booking.css',import.meta.url))]],
 ['/brand-logo.png',['image/png',readFileSync(new URL('../../src/assets/brand/horizontal-logo.png',import.meta.url))]]
]);
export function renderBookingPage({managed,booking,management,mode}){
 if(!['live','emulator'].includes(mode))throw Error('INVALID_CONFIGURATION');
 let html=bookingAssets.get('/book')[1].toString();
 for(const [key,value]of Object.entries({'cancellation-enabled':typeof booking.cancel==='function','rescheduling-enabled':typeof booking.reschedule==='function','management-enabled':Boolean(management),'link-lifecycle':typeof management?.replace==='function'&&typeof management?.revoke==='function','managed-availability':typeof management?.availability==='function','managed-mode':managed}))html=html.replace('data-'+key+'="false"','data-'+key+'="'+value+'"');
 if(mode==='live')html=html.replace('data-runtime-mode="emulator"','data-runtime-mode="live"').replace('Book an introductory call · WVD development','Book an introductory call · Wear Valley Digital').replace('Isolated development preview','Book an introductory call').replace('This preview uses synthetic availability. It does not send invitations or book a real customer call.','A confirmed booking creates your Google Meet call. Keep your private management link; email confirmations are not enabled yet.').replace('Wear Valley Digital · Development preview','Wear Valley Digital').replace('JavaScript is needed for this development preview.','JavaScript is needed to check availability and manage your booking.');
 return html;
}
