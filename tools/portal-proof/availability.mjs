// Pure availability proof: callers supply complete, verified provider evidence.
// It neither fetches calendars nor reserves slots or creates events.
const minute = 60000;
const zone = new Intl.DateTimeFormat('en-GB', {
  timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',
  weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});
const instant = value => {
  // Reject ambiguous local timestamps and require ISO instants.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new Error('INVALID_INSTANT');
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0,19) !== value.slice(0,19)) throw new Error('INVALID_INSTANT');
  return ms;
};
const local = ms => {
  const p = Object.fromEntries(zone.formatToParts(ms).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,weekday:p.weekday,minutes:Number(p.hour)*60+Number(p.minute)+(ms%60000)/60000};
};

export function assessCallSlot({start, now, evidence, policy}) {
  const begin=instant(start), current=instant(now), end=begin+30*minute;
  // Ambiguous founder buffer policy is an explicit input, never a hidden default.
  if (!policy || !['inside-hours','between-events'].includes(policy.bufferBoundary) || !Number.isFinite(policy.maxEvidenceAgeMs) || policy.maxEvidenceAgeMs<0) throw new Error('INVALID_POLICY');
  if (!evidence || evidence.complete!==true || !Array.isArray(evidence.calendars) || evidence.calendars.length===0 || !Array.isArray(evidence.requiredCalendarIds) || evidence.requiredCalendarIds.length===0 || !Array.isArray(evidence.bankHolidays)) return {available:false,reason:'EVIDENCE_UNAVAILABLE'};
  const observed=instant(evidence.observedAt);
  if (observed>current || current-observed>policy.maxEvidenceAgeMs) return {available:false,reason:'EVIDENCE_STALE'};
  const ids=evidence.calendars.map(x=>x.id);
  if (new Set(ids).size!==ids.length || new Set(evidence.requiredCalendarIds).size!==evidence.requiredCalendarIds.length || evidence.requiredCalendarIds.some(id=>!ids.includes(id))) return {available:false,reason:'EVIDENCE_UNAVAILABLE'};
  if (evidence.bankHolidayRegion!=='england-and-wales' || typeof evidence.coveredFrom!=='string' || typeof evidence.coveredThrough!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(evidence.coveredFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(evidence.coveredThrough) || !evidence.bankHolidays.every(x=>/^\d{4}-\d{2}-\d{2}$/.test(x))) return {available:false,reason:'EVIDENCE_UNAVAILABLE'};
  const first=local(begin), last=local(end);
  if (first.date<evidence.coveredFrom || first.date>evidence.coveredThrough) return {available:false,reason:'HOLIDAY_COVERAGE_MISSING'};
  if (begin-current<24*60*minute) return {available:false,reason:'MINIMUM_NOTICE'};
  if (['Sat','Sun'].includes(first.weekday)) return {available:false,reason:'OUTSIDE_HOURS'};
  const edge=policy.bufferBoundary==='inside-hours'?15:0;
  if (first.date!==last.date || first.minutes<9*60+edge || last.minutes>18*60-edge) return {available:false,reason:'OUTSIDE_HOURS'};
  if (evidence.bankHolidays.includes(first.date)) return {available:false,reason:'BANK_HOLIDAY'};
  for (const calendar of evidence.calendars) {
    if (calendar.status!=='ok' || !Array.isArray(calendar.busy)) return {available:false,reason:'EVIDENCE_UNAVAILABLE'};
    // Empty busy results are useful only for the exact interval actually queried.
    if (typeof calendar.coveredStart !== 'string' || typeof calendar.coveredEnd !== 'string') return {available:false,reason:'CALENDAR_COVERAGE_MISSING'};
    const coverageStart=instant(calendar.coveredStart),coverageEnd=instant(calendar.coveredEnd);
    if (coverageStart>begin-15*minute || coverageEnd<end+15*minute) return {available:false,reason:'CALENDAR_COVERAGE_MISSING'};
    for (const event of calendar.busy) {
      const busyStart=instant(event.start),busyEnd=instant(event.end);
      if (busyEnd<=busyStart) return {available:false,reason:'EVIDENCE_UNAVAILABLE'};
      if (begin<busyEnd+15*minute && end+15*minute>busyStart) return {available:false,reason:'CALENDAR_CONFLICT'};
    }
  }
  return {available:true,start:new Date(begin).toISOString(),end:new Date(end).toISOString(),timeZone:'Europe/London',reason:'AVAILABLE_AT_OBSERVATION'};
}
