// ---------- Slot parsing helpers ----------
// Slot IDs are saved by the client portal as "YYYY-MM-DD_h:mm AM"

// All times are displayed in EST (fixed UTC-5, no daylight saving).
// To follow real New York time (EST/EDT) instead, set DISPLAY_TZ to 'America/New_York'
// and DISPLAY_TZ_LABEL to 'ET'.
export const DISPLAY_TZ = 'Etc/GMT+5';
export const DISPLAY_TZ_LABEL = 'Eastern Standard Time - EST';

export function slotKeys(schedule) {
  if (!schedule || !schedule.slots) return [];
  const s = schedule.slots;
  if (Array.isArray(s)) return s.filter(Boolean);
  return Object.keys(s).filter((k) => s[k]);
}

export function hasSlots(schedule) {
  return slotKeys(schedule).length > 0;
}

function timeToMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim());
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + parseInt(m[2], 10);
}

export function minutesToTime(mins) {
  const total = mins % (24 * 60);
  const h24 = Math.floor(total / 60);
  const mm = String(total % 60).padStart(2, '0');
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${period}`;
}

export function toRanges(minutesList) {
  const ranges = [];
  minutesList.forEach((m) => {
    const last = ranges[ranges.length - 1];
    if (last && m === last.end) last.end = m + 30;
    else ranges.push({ start: m, end: m + 30 });
  });
  return ranges;
}

export function formatHours(slotCount) {
  const mins = slotCount * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr${h > 1 ? 's' : ''}`;
}

// ---------- Timezones ----------

// Friendly names for the fixed-offset zones the client portal saves (Etc/GMT+N = UTC-N)
const TZ_NAMES = {
  '-12': 'Baker Island Time',
  '-11': 'Samoa Standard Time',
  '-10': 'Hawaii Standard Time',
  '-9': 'Alaska Standard Time',
  '-8': 'Pacific Standard Time',
  '-7': 'Mountain Standard Time',
  '-6': 'Central Standard Time',
  '-5': 'Eastern Standard Time',
  '-4': 'Atlantic Standard Time',
  '-3': 'Brasilia Time',
  '-2': 'Mid-Atlantic Time',
  '-1': 'Azores Time',
  '0': 'Greenwich Mean Time',
  '1': 'Central European Time',
  '2': 'Eastern European Time',
  '3': 'Moscow Standard Time',
  '4': 'Gulf Standard Time',
  '5': 'Pakistan Standard Time',
  '6': 'Bangladesh Standard Time',
  '7': 'Indochina Time',
  '8': 'China Standard Time',
  '9': 'Japan Standard Time',
  '10': 'Australian Eastern Standard Time',
  '11': 'Solomon Islands Time',
  '12': 'New Zealand Standard Time',
  '13': 'Tonga Time',
  '14': 'Line Islands Time',
};

// Fixed offset (in minutes east of UTC) for Etc/GMT zones, or null if not an Etc/GMT zone
function fixedOffsetMinutes(tz) {
  if (tz === 'Etc/GMT' || tz === 'UTC' || tz === 'Etc/UTC') return 0;
  const m = /^Etc\/GMT([+-])(\d{1,2})$/.exec(tz || '');
  if (!m) return null;
  // Etc/GMT signs are inverted: Etc/GMT+5 means UTC-05:00
  return (m[1] === '+' ? -1 : 1) * parseInt(m[2], 10) * 60;
}

// Offset (minutes east of UTC) of any IANA zone at a given UTC instant; null if the zone is unknown
function zoneOffsetMinutes(tz, utcMs) {
  const fixed = fixedOffsetMinutes(tz);
  if (fixed !== null) return fixed;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(utcMs));
    const v = {};
    parts.forEach((p) => {
      v[p.type] = parseInt(p.value, 10);
    });
    const asUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
    return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
  } catch (e) {
    return null;
  }
}

// Client-facing name for the details panel, e.g. "Samoa Standard Time"
export function tzLabel(tz) {
  if (!tz) return 'Not set';
  const fixed = fixedOffsetMinutes(tz);
  if (fixed !== null) {
    return (
      TZ_NAMES[String(fixed / 60)] ||
      `UTC${fixed < 0 ? '-' : '+'}${String(Math.abs(fixed / 60)).padStart(2, '0')}:00`
    );
  }
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName');
    return part ? part.value : tz;
  } catch (e) {
    return tz;
  }
}

const pad = (n) => String(n).padStart(2, '0');

// Convert a wall-clock date/time in `fromTz` to the display timezone.
// Returns { dateKey: 'YYYY-MM-DD', mins: minutes since midnight } or null if fromTz is unusable.
function convertToDisplayTz(dateKey, mins, fromTz) {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, 0, mins);
  const off = zoneOffsetMinutes(fromTz, wallAsUtc);
  if (off === null) return null;
  let utc = wallAsUtc - off * 60000;
  const off2 = zoneOffsetMinutes(fromTz, utc); // settle DST edge cases
  if (off2 !== null && off2 !== off) utc = wallAsUtc - off2 * 60000;
  const dOff = zoneOffsetMinutes(DISPLAY_TZ, utc);
  const shifted = new Date(utc + dOff * 60000);
  return {
    dateKey: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    mins: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

// Today's date (YYYY-MM-DD) in the display timezone
export function todayInDisplayTz() {
  const now = Date.now();
  const s = new Date(now + zoneOffsetMinutes(DISPLAY_TZ, now) * 60000);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
}

// Every parseable slot as { id, dateKey, mins }, converted from the client's timezone into the
// display timezone. Ids that can't be parsed are left out.
export function displaySlots(schedule) {
  const out = [];
  const fromTz = schedule && schedule.timezone ? schedule.timezone : '';
  slotKeys(schedule).forEach((id) => {
    const cut = id.indexOf('_');
    if (cut < 0) return;
    let dateKey = id.slice(0, cut);
    let mins = timeToMinutes(id.slice(cut + 1));
    if (mins === null || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    // Slots are saved in the client's timezone; show them in EST
    if (fromTz) {
      const conv = convertToDisplayTz(dateKey, mins, fromTz);
      if (conv) {
        dateKey = conv.dateKey;
        mins = conv.mins;
      }
    }
    out.push({ id, dateKey, mins });
  });
  return out;
}

// Inverse of the conversion above: a slot id ("YYYY-MM-DD_h:mm AM") in the client's timezone for a
// date/time shown in the display timezone. Like displaySlots, it leaves the time as-is when the
// client has no usable timezone.
export function slotIdFromDisplay(dateKey, mins, toTz) {
  let dk = dateKey;
  let m = mins;
  if (toTz) {
    const [y, mo, d] = dateKey.split('-').map(Number);
    const wallAsUtc = Date.UTC(y, mo - 1, d, 0, mins);
    const utc = wallAsUtc - zoneOffsetMinutes(DISPLAY_TZ, wallAsUtc) * 60000;
    const off = zoneOffsetMinutes(toTz, utc);
    if (off !== null) {
      const s = new Date(utc + off * 60000);
      dk = `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
      m = s.getUTCHours() * 60 + s.getUTCMinutes();
    }
  }
  return `${dk}_${minutesToTime(m)}`;
}

// Group a schedule's slots by date, converted from the client's timezone into the display timezone.
// Returns [{ dateKey, mins: [minutes since midnight, ascending] }] sorted by date.
export function groupByDate(schedule) {
  const days = new Map();
  displaySlots(schedule).forEach(({ dateKey, mins }) => {
    if (!days.has(dateKey)) days.set(dateKey, []);
    days.get(dateKey).push(mins);
  });
  return Array.from(days.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateKey, m]) => ({
      dateKey,
      mins: Array.from(new Set(m)).sort((a, b) => a - b),
    }));
}
