// Pure candidate screening, adapted from the Salon demo's duration/overlap check.
// It neither discovers calendar IDs nor reserves a slot or creates an event.
const minute=60*1000,duration=30*minute,gap=15*minute;
const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const instant=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)throw Error('INVALID_BOOKING_INPUT');return Date.parse(value);};
const local=value=>{const p=Object.fromEntries(parts.formatToParts(new Date(value)).map(x=>[x.type,x.value]));return{date:`${p.year}-${p.month}-${p.day}`,weekday:p.weekday,minutes:Number(p.hour)*60+Number(p.minute)};};
export function screenIntroCallCandidates({now,starts,requiredCalendarIds,calendars,holidays}) {
  const current=instant(now);
  if(!Array.isArray(starts)||starts.length>200||new Set(starts).size!==starts.length)throw Error('INVALID_BOOKING_INPUT');
  if(!Array.isArray(requiredCalendarIds)||!requiredCalendarIds.length||requiredCalendarIds.length>20||requiredCalendarIds.some(x=>typeof x!=='string'||!x.trim()||x.length>256)||new Set(requiredCalendarIds).size!==requiredCalendarIds.length||!Array.isArray(calendars)||calendars.length!==requiredCalendarIds.length)throw Error('CALENDAR_COVERAGE_REQUIRED');
  const busy=[],seen=new Set();
  for(const calendar of calendars) {
    if(!calendar||!requiredCalendarIds.includes(calendar.id)||seen.has(calendar.id)||calendar.error||!date(calendar.coverageStart)||!date(calendar.coverageEnd)||calendar.coverageStart>calendar.coverageEnd||!Array.isArray(calendar.busy)||calendar.busy.length>2000)throw Error('CALENDAR_COVERAGE_REQUIRED');
    seen.add(calendar.id);
    for(const interval of calendar.busy){const start=instant(interval?.start),end=instant(interval?.end);if(start>=end)throw Error('INVALID_BOOKING_INPUT');busy.push({start,end});}
  }
  if(!holidays||holidays.division!=='england-and-wales'||!date(holidays.coverageStart)||!date(holidays.coverageEnd)||holidays.coverageStart>holidays.coverageEnd||!Array.isArray(holidays.dates)||holidays.dates.length>400||holidays.dates.some(x=>!date(x)||x<holidays.coverageStart||x>holidays.coverageEnd)||new Set(holidays.dates).size!==holidays.dates.length)throw Error('HOLIDAY_COVERAGE_REQUIRED');
  return starts.map(instant).sort((a,b)=>a-b).filter(start=>{
    const end=start+duration,a=local(start),b=local(end);
    // Coverage includes buffer days, so a neighbouring-day conflict is not lost.
    const from=local(start-gap).date,to=local(end+gap).date;
    if(calendars.some(x=>from<x.coverageStart||to>x.coverageEnd))throw Error('CALENDAR_COVERAGE_REQUIRED');
    if(a.date<holidays.coverageStart||a.date>holidays.coverageEnd)throw Error('HOLIDAY_COVERAGE_REQUIRED');
    return start-current>=24*60*minute && start%minute===0 && ['Mon','Tue','Wed','Thu','Fri'].includes(a.weekday)&&a.date===b.date&&a.minutes>=540&&b.minutes<=1080&&!holidays.dates.includes(a.date)&&!busy.some(x=>start-gap<x.end&&end+gap>x.start);
  }).map(start=>({start:new Date(start).toISOString(),end:new Date(start+duration).toISOString(),timeZone:'Europe/London'}));
}
