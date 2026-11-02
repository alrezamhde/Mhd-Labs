/**
 * MHD booking backend — Google Apps Script web app.
 *
 * Reads Alireza's free times from Google Calendar and books calls made on the
 * portfolio site: creates the event, adds a Google Meet link and emails the
 * visitor an invite. Setup steps are in README.md (Persian) next to this file.
 */

// ===================== Settings you can change =====================
const CONFIG = {
  calendarId: 'primary',          // the calendar bookings go into
  busyCalendarIds: [],            // extra calendars to treat as busy, e.g. ['you@gmail.com']
  timezone: 'America/Toronto',    // your working time zone
  durationMin: 30,                // call length
  stepMin: 30,                    // a new start time every N minutes
  bufferMin: 15,                  // free gap kept before and after other events
  minNoticeHours: 12,             // earliest booking = now + this
  daysAhead: 30,                  // how far ahead visitors can book
  maxPerDay: 4,                   // max booked calls per day (0 = no limit)
  // Working hours per weekday (0 = Sunday … 6 = Saturday). Several windows per day are allowed.
  hours: {
    1: [['10:00', '18:00']],
    2: [['10:00', '18:00']],
    3: [['10:00', '18:00']],
    4: [['10:00', '18:00']],
    5: [['10:00', '16:00']],
  },
  eventTitle: 'Intro call · {name} × Alireza (MHD)',
  notifyMe: true,                 // send yourself an email for each new booking
};
// ====================================================================

const TAG = 'mhd-booking';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'slots';
  try {
    if (action === 'slots') {
      const cache = CacheService.getScriptCache();
      const hit = cache.get('slots');
      if (hit) return json_(JSON.parse(hit));
      const out = { ok: true, duration: CONFIG.durationMin, timezone: CONFIG.timezone, slots: computeSlots_().map((d) => d.toISOString()) };
      cache.put('slots', JSON.stringify(out), 60);
      return json_(out);
    }
    return json_({ ok: true, service: 'mhd-booking' });
  } catch (err) {
    return json_({ ok: false, error: 'Could not read the calendar.' });
  }
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Bad request.' }); }
  if (body.action !== 'book') return json_({ ok: false, error: 'Unknown action.' });
  if (body.website) return json_({ ok: true }); // honeypot: silently ignore bots

  const name = String(body.name || '').trim().slice(0, 80);
  const email = String(body.email || '').trim().slice(0, 120);
  const kind = String(body.kind || '').trim().slice(0, 40);
  const note = String(body.note || '').trim().slice(0, 1500);
  const visitorTz = String(body.tz || '').slice(0, 60);
  const start = new Date(body.start);
  if (!name) return json_({ ok: false, error: 'Add your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json_({ ok: false, error: 'That email doesn’t look right.' });
  if (isNaN(start.getTime())) return json_({ ok: false, error: 'Pick a time first.' });

  const cache = CacheService.getScriptCache();
  const rateKey = 'rate_' + email.toLowerCase();
  if (cache.get(rateKey)) return json_({ ok: false, error: 'You just booked a call. Check your inbox for the invite.' });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return json_({ ok: false, error: 'The calendar is busy. Try again in a moment.' });
  try {
    // Re-check against the live calendar so two people can't take the same slot.
    const free = computeSlots_().some((d) => d.getTime() === start.getTime());
    if (!free) return json_({ ok: false, error: 'That time was just taken. Pick another one.' });

    const end = new Date(start.getTime() + CONFIG.durationMin * 60000);
    const title = CONFIG.eventTitle.replace('{name}', name);
    const description = [
      'Booked from the MHD portfolio site.',
      '',
      'Name: ' + name,
      'Email: ' + email,
      kind ? 'About: ' + kind : '',
      visitorTz ? 'Their time zone: ' + visitorTz : '',
      note ? '\n' + note : '',
    ].filter(Boolean).join('\n');

    let meet = '';
    try {
      // Needs the "Google Calendar API" advanced service (Services → +). Adds a Meet link and emails the invite.
      const created = Calendar.Events.insert({
        summary: title,
        description: description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: [{ email: email, displayName: name }],
        conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        extendedProperties: { private: { source: TAG } },
        reminders: { useDefault: true },
      }, CONFIG.calendarId, { conferenceDataVersion: 1, sendUpdates: 'all' });
      meet = created.hangoutLink || '';
    } catch (err) {
      // Fallback without the advanced service: plain event + email invite, no Meet link.
      const cal = CONFIG.calendarId === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(CONFIG.calendarId);
      const ev = cal.createEvent(title, start, end, { description: description, guests: email, sendInvites: true });
      ev.setTag('source', TAG);
    }

    if (CONFIG.notifyMe) {
      const when = Utilities.formatDate(start, CONFIG.timezone, "EEEE, MMMM d 'at' h:mm a z");
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'New call booked: ' + name + ' — ' + when, description + (meet ? '\n\nMeet: ' + meet : ''));
    }
    cache.remove('slots');
    cache.put(rateKey, '1', 600);
    return json_({ ok: true, start: start.toISOString(), end: end.toISOString(), meet: meet });
  } catch (err) {
    return json_({ ok: false, error: 'Couldn’t book that time. Try again or pick another.' });
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- availability ---------------- */
function computeSlots_() {
  const tz = CONFIG.timezone;
  const now = new Date();
  const earliest = now.getTime() + CONFIG.minNoticeHours * 3600000;
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd').split('-').map(Number);
  const rangeStart = new Date(now.getTime() - 86400000);
  const rangeEnd = new Date(now.getTime() + (CONFIG.daysAhead + 2) * 86400000);

  // Busy times from every calendar we watch.
  const busy = [];
  const perDay = {};
  const ids = [CONFIG.calendarId].concat(CONFIG.busyCalendarIds || []);
  ids.forEach((id) => {
    const cal = id === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(id);
    if (!cal) return;
    cal.getEvents(rangeStart, rangeEnd).forEach((ev) => {
      if (ev.isAllDayEvent()) return;                                   // all-day notes don't block time
      if (ev.getMyStatus && ev.getMyStatus() === CalendarApp.GuestStatus.NO) return; // declined
      busy.push([ev.getStartTime().getTime() - CONFIG.bufferMin * 60000, ev.getEndTime().getTime() + CONFIG.bufferMin * 60000]);
      if (ev.getTag('source') === TAG || isTaggedAdvanced_(ev)) {
        const k = Utilities.formatDate(ev.getStartTime(), tz, 'yyyy-MM-dd');
        perDay[k] = (perDay[k] || 0) + 1;
      }
    });
  });

  const slots = [];
  for (let i = 0; i <= CONFIG.daysAhead; i++) {
    const day = new Date(Date.UTC(today[0], today[1] - 1, today[2] + i));
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate();
    const key = y + '-' + pad_(m) + '-' + pad_(d);
    if (CONFIG.maxPerDay && (perDay[key] || 0) >= CONFIG.maxPerDay) continue;
    const windows = CONFIG.hours[day.getUTCDay()] || [];
    windows.forEach((w) => {
      const a = toMin_(w[0]), b = toMin_(w[1]);
      for (let t = a; t + CONFIG.durationMin <= b; t += CONFIG.stepMin) {
        const s = zoned_(y, m, d, Math.floor(t / 60), t % 60, tz);
        const st = s.getTime(), en = st + CONFIG.durationMin * 60000;
        if (st < earliest) continue;
        if (busy.some((r) => st < r[1] && en > r[0])) continue;
        slots.push(s);
      }
    });
  }
  return slots;
}

// Events made through the advanced service carry a private extended property instead of a CalendarApp tag.
function isTaggedAdvanced_(ev) {
  return /Booked from the MHD portfolio site/.test(ev.getDescription() || '');
}

// Wall-clock time in a time zone → real Date.
function zoned_(y, m, d, h, min, tz) {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  const off = Utilities.formatDate(guess, tz, 'Z'); // e.g. "-0400"
  const sign = off[0] === '-' ? -1 : 1;
  const offMin = sign * (parseInt(off.slice(1, 3), 10) * 60 + parseInt(off.slice(3, 5), 10));
  let real = new Date(guess.getTime() - offMin * 60000);
  // correct once more around DST switches
  const off2 = Utilities.formatDate(real, tz, 'Z');
  if (off2 !== off) {
    const s2 = off2[0] === '-' ? -1 : 1;
    const m2 = s2 * (parseInt(off2.slice(1, 3), 10) * 60 + parseInt(off2.slice(3, 5), 10));
    real = new Date(guess.getTime() - m2 * 60000);
  }
  return real;
}
function toMin_(hhmm) { const p = hhmm.split(':'); return +p[0] * 60 + +p[1]; }
function pad_(n) { return (n < 10 ? '0' : '') + n; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Run this once from the editor to grant permissions and see your next free slots in the log. */
function testSetup() {
  const s = computeSlots_();
  Logger.log('Open slots found: ' + s.length);
  s.slice(0, 5).forEach((d) => Logger.log(Utilities.formatDate(d, CONFIG.timezone, 'EEE MMM d, h:mm a z')));
}
