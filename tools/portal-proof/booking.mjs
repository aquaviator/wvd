import {assessCallSlot} from './availability.mjs';

// Bounded batch adapter over the established single-slot contract. No alternate
// working-hours, conflict, holiday or freshness implementation lives here.
export function screenIntroCallCandidates({now,starts,evidence,policy}) {
  if(!Array.isArray(starts)||starts.length>200||new Set(starts).size!==starts.length||starts.some(value=>typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value))throw Error('INVALID_BOOKING_INPUT');
  if(!evidence||!Array.isArray(evidence.calendars)||evidence.calendars.length>20||!Array.isArray(evidence.requiredCalendarIds)||evidence.requiredCalendarIds.length>20||!Array.isArray(evidence.bankHolidays)||evidence.bankHolidays.length>400||evidence.calendars.some(calendar=>!calendar||!Array.isArray(calendar.busy)||calendar.busy.length>2000))throw Error('INVALID_BOOKING_INPUT');
  const slots=[];
  for(const start of [...starts].sort()) {
    const result=assessCallSlot({start,now,evidence,policy});
    if(result.available)slots.push({start:result.start,end:result.end,timeZone:result.timeZone});
  }
  return slots;
}
