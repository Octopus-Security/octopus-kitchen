'use strict';
// Calendar dates in America/New_York, as YYYY-MM-DD strings. Day arithmetic is done
// on the calendar date (UTC midnight of it), so a DST change never shifts a count.
const TZ = 'America/New_York';
const DAY = 86400000;

const todayET = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: TZ });

/** A real calendar date in YYYY-MM-DD form ("2026-02-30" is not one). */
function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const addDays = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY);

/** "Sat, Nov 28" (with the year when it is not this one). */
function label(s, today = todayET()) {
  if (!isDate(s)) return '';
  const opts = { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' };
  if (s.slice(0, 4) !== today.slice(0, 4)) opts.year = 'numeric';
  return new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', opts);
}
function ago(s, today = todayET()) {
  const n = daysBetween(s, today);
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  return n > 0 ? `${n} days ago` : `in ${-n} days`;
}

module.exports = { todayET, isDate, addDays, daysBetween, label, ago };
