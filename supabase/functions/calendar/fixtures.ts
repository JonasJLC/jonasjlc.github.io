// iCal fixtures for the calendar tests, shaped like Google, Outlook and iCloud feeds. Kept as strings so the tests need no
// read permission. Today in these tests is Thursday 2026-11-26 unless a test says otherwise.

const CPH_TZ = `BEGIN:VTIMEZONE
TZID:Europe/Copenhagen
X-LIC-LOCATION:Europe/Copenhagen
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;

const cal = (body: string, tz = CPH_TZ) =>
  `BEGIN:VCALENDAR\r\nPRODID:-//Google Inc//Google Calendar 70.9054//EN\r\nVERSION:2.0\r\nCALSCALE:GREGORIAN\r\n${tz}\r\n${body}\r\nEND:VCALENDAR\r\n`.replace(/\r?\n/g, '\r\n');

/** Tandlæge today 09:30–10:00, plus a two-year-old event the pre-filter drops. */
export const single = cal(`BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20261126T093000
DTEND;TZID=Europe/Copenhagen:20261126T100000
UID:single-1@google.com
SUMMARY:Tandlæge
LOCATION:Hemmelig adresse 1
DESCRIPTION:Ikke til widgetten
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20241126T093000
DTEND;TZID=Europe/Copenhagen:20241126T100000
UID:old-1@google.com
SUMMARY:Gammel aftale
END:VEVENT`);

/** Weekly on Thursdays and Fridays at 17:00 since September, with Friday 27 November cancelled by EXDATE. */
export const weeklyWithExdate = cal(`BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20260903T170000
DTEND;TZID=Europe/Copenhagen:20260903T180000
RRULE:FREQ=WEEKLY;BYDAY=TH,FR
EXDATE;TZID=Europe/Copenhagen:20261127T170000
UID:weekly-1@google.com
SUMMARY:Svømning
END:VEVENT`);

/** Weekly on Fridays at 08:00; this Friday's occurrence is moved to 12:00 and renamed. */
export const movedOccurrence = cal(`BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20261009T080000
DTEND;TZID=Europe/Copenhagen:20261009T090000
RRULE:FREQ=WEEKLY;BYDAY=FR
UID:moved-1@google.com
SUMMARY:Morgenmøde
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20261127T120000
DTEND;TZID=Europe/Copenhagen:20261127T130000
RECURRENCE-ID;TZID=Europe/Copenhagen:20261127T080000
UID:moved-1@google.com
SUMMARY:Morgenmøde (flyttet)
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20261127T080000
DTEND;TZID=Europe/Copenhagen:20261127T090000
RECURRENCE-ID;TZID=Europe/Copenhagen:20261127T080000
UID:another-series@google.com
SUMMARY:Andet møde
END:VEVENT`);

/** Fødselsdag all day tomorrow, and a three-day trip from yesterday that covers today. */
export const allDay = cal(`BEGIN:VEVENT
DTSTART;VALUE=DATE:20261127
DTEND;VALUE=DATE:20261128
UID:allday-1@google.com
SUMMARY:Mormors fødselsdag
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261125
DTEND;VALUE=DATE:20261128
UID:allday-2@google.com
SUMMARY:Kursus
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261129
DTEND;VALUE=DATE:20261130
UID:allday-3@google.com
SUMMARY:Efter vinduet
END:VEVENT`);

/** Fest from yesterday 22:00 to today 02:00, and Nattevagt from tomorrow 23:00 to the day after at 07:00. */
export const crossingMidnight = cal(`BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20261125T220000
DTEND;TZID=Europe/Copenhagen:20261126T020000
UID:midnight-1@icloud.com
SUMMARY:Fest
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20261127T230000
DTEND;TZID=Europe/Copenhagen:20261128T070000
UID:midnight-2@icloud.com
SUMMARY:Nattevagt
END:VEVENT`);

/** UTC times and no VTIMEZONE (as Outlook and many tools publish): 08:00Z is 09:00 in Copenhagen in November. */
export const utcFeed = cal(`BEGIN:VEVENT
DTSTART:20261126T080000Z
DTEND:20261126T083000Z
UID:utc-1@outlook.com
SUMMARY:Standup
END:VEVENT`, 'X-WR-TIMEZONE:UTC');

/** An Outlook-style Windows zone name defined in the feed itself (+01:00 / +02:00, same rules as Copenhagen). */
export const windowsZone = cal(`BEGIN:VEVENT
DTSTART;TZID=Romance Standard Time:20261126T140000
DTEND;TZID=Romance Standard Time:20261126T150000
UID:win-1@outlook.com
SUMMARY:Frisør
END:VEVENT`, CPH_TZ.replaceAll('Europe/Copenhagen', 'Romance Standard Time'));

/** Daily at 09:00 Copenhagen time across the end of summer time (Sunday 25 October 2026, 03:00 → 02:00). */
export const dstEnd = cal(`BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20261020T090000
DTEND;TZID=Europe/Copenhagen:20261020T093000
RRULE:FREQ=DAILY;COUNT=10
UID:dst-1@google.com
SUMMARY:Gåtur
END:VEVENT`);

/** A cancelled one-off and a moved occurrence that was cancelled. */
export const cancelled = cal(`BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20261126T120000
DTEND;TZID=Europe/Copenhagen:20261126T130000
STATUS:CANCELLED
UID:cancel-1@google.com
SUMMARY:Aflyst frokost
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20261101T100000
DTEND;TZID=Europe/Copenhagen:20261101T110000
RRULE:FREQ=DAILY
UID:cancel-2@google.com
SUMMARY:Daglig
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20261127T100000
DTEND;TZID=Europe/Copenhagen:20261127T110000
RECURRENCE-ID;TZID=Europe/Copenhagen:20261127T100000
STATUS:CANCELLED
UID:cancel-2@google.com
SUMMARY:Daglig
END:VEVENT`);

export const notCalendar = '<!doctype html><html><head><title>Log ind</title></head><body>Log ind for at se kalenderen</body></html>';

/** Series running since 2016: daily at 07:00 (tomorrow excluded), and two fortnightly Thursday series a week apart. */
export const longSeries = cal(`BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20160101T070000
DTEND;TZID=Europe/Copenhagen:20160101T071500
RRULE:FREQ=DAILY
EXDATE;TZID=Europe/Copenhagen:20261127T070000
UID:long-daily@google.com
SUMMARY:Medicin
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20160107T190000
DTEND;TZID=Europe/Copenhagen:20160107T200000
RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TH
UID:long-even@google.com
SUMMARY:Kor
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Europe/Copenhagen:20160114T190000
DTEND;TZID=Europe/Copenhagen:20160114T200000
RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TH
UID:long-odd@google.com
SUMMARY:Ulige uger
END:VEVENT`);
