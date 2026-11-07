/*
 * slice4-proto.js — the slice 4 prototype's shared behaviour, one copy per portal.
 *
 * Loaded after slice3-proto.js (it reads slice 3's bookings, names and kernel recipes from S3) and before
 * slice1-kit.js. The two copies come from one source; each holds only what its portal's responses would
 * carry (TSD §3.3.2): what a client may not see is not in the client's copy at all.
 *
 * What it gives a screen:
 *   S4.timesheets(filter) / S4.timesheet(id) / S4.week(clientId, weekStart)   the records, derived on read
 *   S4.act.*                      the writes, refused the way the TSD and the rulings of 2026-11-08 refuse them
 *   S4.weekGridPage(host, props)  one WeekGrid in two portals (TSD §3.3.11), with fill preview and bulk actions
 *   S4.bookingWeekPage(host, p)   one booking-week, client or Abstract controls
 *   S4.bookingPanel(bookingId)    the booking detail's Timesheets panel (TSD §5.7)
 *   S4.ui.*                       the cells, legend, badges and markers as this prototype draws them
 *
 * Writes persist in localStorage so the demo crosses pages and portals when both are served from one origin.
 * S4.reset() returns to the seed. "Today" is slice 3's: Saturday 10 Oct 2026.
 */
(function () {
  'use strict';
  var PORTAL = 'client';
  var ABS = PORTAL === 'abstract';
  var TODAY = S3.TODAY;
  var KEY = 's4-demo-v1';
  var C = S3.C, ui3 = S3.ui, esc = S3.esc;

  // ---------- dates ----------
  function d(iso) { return new Date(iso.slice(0, 10) + 'T12:00:00Z'); }
  function iso(dt) { return dt.toISOString().slice(0, 10); }
  function addDays(s, n) { var x = d(s); x.setUTCDate(x.getUTCDate() + n); return iso(x); }
  function weekday(s) { var w = d(s).getUTCDay(); return w === 0 ? 7 : w; }
  function mondayOf(s) { return addDays(s, 1 - weekday(s)); }
  var DN = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDay(s) { var x = d(s); return DN[weekday(s)] + ' ' + x.getUTCDate() + ' ' + MN[x.getUTCMonth()]; }
  function fmtWeek(ws) { var a = d(ws), b = d(addDays(ws, 6)); return a.getUTCDate() + (a.getUTCMonth() === b.getUTCMonth() ? '' : ' ' + MN[a.getUTCMonth()]) + '–' + b.getUTCDate() + ' ' + MN[b.getUTCMonth()] + ' ' + b.getUTCFullYear(); }
  function fmtDeadline(t) { var x = d(t); return DN[weekday(t)] + ' ' + x.getUTCDate() + ' ' + MN[x.getUTCMonth()] + ', ' + t.slice(11, 16); }
  function weekDates(ws) { var o = []; for (var i = 0; i < 7; i++) o.push(addDays(ws, i)); return o; }
  var NOW = function () { return S3.now(); };
  var CURRENT_WEEK = mondayOf(TODAY);

  // ---------- reference data (slice 2's records as slice 4 reads them) ----------
  var SHIFT_INFO = {
    'sh-am': { start: '06:00', end: '14:00', hours: '8.00' }, 'sh-pm': { start: '14:00', end: '22:00', hours: '8.00' }, 'sh-nt': { start: '22:00', end: '06:00', hours: '8.00' },
    'ng-d': { start: '07:00', end: '15:00', hours: '8.00' }, 'ng-l': { start: '15:00', end: '23:00', hours: '8.00' }, 'pn-d': { start: '08:00', end: '16:00', hours: '8.00' }
  };
  // The standard line of each card in force, dated. The client's copy carries the charge alone.
  // Acme's Forklift Driver Night line at the root ended on 30 Sep 2026, so a Night shift worked as a forklift driver after it waits for manual pricing.
  var RATES = [
    { role: 'jr-wo', client: 'acme', node: null, shift: 'sh-am', charge: '18.60' },
    { role: 'jr-wo', client: 'acme', node: null, shift: 'sh-pm', charge: '18.90' },
    { role: 'jr-wo', client: 'acme', node: null, shift: 'sh-nt', charge: '19.60' },
    { role: 'jr-wo', client: 'acme', node: 'bhx', shift: 'sh-am', charge: '20.10' },
    { role: 'jr-wo', client: 'acme', node: 'bhx', shift: 'sh-pm', charge: '20.50' },
    { role: 'jr-wo', client: 'acme', node: 'bhx', shift: 'sh-nt', charge: '21.30' },
    { role: 'jr-fd', client: 'acme', node: null, shift: 'sh-am', charge: '22.10' },
    { role: 'jr-fd', client: 'acme', node: null, shift: 'sh-pm', charge: '22.50' },
    { role: 'jr-fd', client: 'acme', node: null, shift: 'sh-nt', charge: '24.00', to: '2026-09-30' }
  ];
  var MULT = { standard: 1, overtime: 1.5, weekend: 1.25, bank_holiday: 2 };          // premium.<type>_multiplier (system)
  var HOUR_TYPE = { standard: 'Standard', overtime: 'Overtime', weekend: 'Weekend', bank_holiday: 'Bank holiday' };
  var OT_DAILY = 8, OT_WEEKLY = 40;                                                   // overtime.*_threshold_hours (system)
  
  var BANK_HOLIDAYS = { 'england-wales': ['2026-08-31', '2026-12-25', '2026-12-28'] };
  // The client's resolved configuration (slice 2's keys). Approval is mandatory for Acme and optional at Leeds Hub (a node override).
  var POLICY = {
    acme: { region: 'england-wales', deadline: { weekday: 2, time: '12:00' }, approval: { root: 'mandatory', lds: 'optional' }, paidSickDays: 2, sickWindow: 'rolling_year', holiday: 'rolled_up', noShow: 'Unpaid', defaultShift: 'sh-am' }
  };
  var PATTERNS = [
    { id: 'sp-wd', name: 'Weekdays, Monday to Friday', days: [1, 2, 3, 4, 5] },
    { id: 'sp-4d', name: 'Four days, Monday to Thursday', days: [1, 2, 3, 4] },
    { id: 'sp-we', name: 'Weekends, Saturday and Sunday', days: [6, 7] }
  ];
  var CHECK_LABEL = { right_to_work: 'Right to work', hs_training: 'H&S training', reach: 'Reach truck (RTITB)' };
  // candidates.complianceFacts as the engine reads them: the checks each candidate does not meet (open: the selector shows them).
  var UNMET = { 'c-mo': [], 'c-tw': ['reach'], 'c-er': ['right_to_work'], 'c-gh': ['reach'], 'c-mo2': ['reach'], 'c-ra': ['reach'] };
  // compliance.required_checks resolved at the booking's node (TSD §3.3.3 rule 7): one list for the place, whatever role is covered.
  var CHECKS_AT = { acme: { root: ['right_to_work', 'hs_training'], bhx: ['right_to_work', 'hs_training', 'reach'] } };
  function requiredChecks(c, nodeId) { var m = CHECKS_AT[c] || {}, chain = ancestors(c, nodeId); for (var i = 0; i < chain.length; i++) { var k = chain[i] === null ? 'root' : chain[i]; if (m[k]) return m[k]; } return []; }

  function ancestors(c, id) { var out = [], t = S3.TREES[c] || [], n = t.filter(function (x) { return x.id === id; })[0]; while (n) { out.push(n.root ? null : n.id); n = t.filter(function (x) { return x.id === n.parentId; })[0]; } if (out[out.length - 1] !== null) out.push(null); return out; }
  function resolveRate(role, c, nodeId, shift, on) {
    var chain = ancestors(c, nodeId);
    for (var i = 0; i < chain.length; i++) for (var j = 0; j < RATES.length; j++) { var l = RATES[j]; if (l.role === role && l.client === c && l.node === chain[i] && l.shift === shift && (!l.to || on <= l.to)) return l; }
    return null;
  }
  function approvalAt(c, nodeId) { var p = POLICY[c] || POLICY.acme, chain = ancestors(c, nodeId); for (var i = 0; i < chain.length; i++) { var k = chain[i] === null ? 'root' : chain[i]; if (p.approval[k]) return p.approval[k]; } return 'mandatory'; }
  function deadlineFor(c, ws) { var p = POLICY[c] || POLICY.acme; return addDays(ws, 6 + p.deadline.weekday) + 'T' + p.deadline.time + ':00'; }

  // ---------- money: integer pence, half-up ----------
  function P(s) { return Math.round(Number(s) * 100); }
  function H(s) { return Math.round(Number(s) * 100); }
  function mul(p, h) { return Math.round(p * h / 100); }
  function M(p) { return (p / 100).toFixed(2); }
  function hrs(h) { return (h / 100).toFixed(2); }
  var money = function (s) { return s == null ? '—' : S3.money(s); };

  // ---------- the seed ----------
  function day(st, hours, shift, extra) { return Object.assign({ dayStatus: st, hours: hours || null, shiftId: shift || null, shiftDefaulted: false, coveredJobRoleId: null, roleChangedBy: null, roleChangedAt: null, absenceComment: null, payOverride: null, manualCharge: null, manualReason: null, manualBy: null, manualAt: null, updatedAt: '2026-10-01T09:00:00' }, extra || {}); }
  function W(h, s, x) { return day('Worked', h, s, x); }
  function NB() { return day('Not Booked'); }
  function ts(id, bookingId, ws, status, days, extra) {
    return Object.assign({ id: id, bookingId: bookingId, weekStart: ws, status: status, days: days, submittedAt: null, submittedBy: null, submittedLate: null, approvedAt: null, approvedBy: null, approvalMode: null, returnedAt: null, returnedBy: null, returnReason: null, returnKind: null, enteredOnBehalf: false, approvals: [], events: [], createdAt: ws + 'T00:20:00', updatedAt: addDays(ws, 5) + 'T16:00:00' }, extra || {});
  }
  function fiveDays(ws, h, s, over) { var o = {}; for (var i = 0; i < 5; i++) o[addDays(ws, i)] = W(h, s); o[addDays(ws, 5)] = NB(); o[addDays(ws, 6)] = NB(); return Object.assign(o, over || {}); }
  function approved(ws, at, by, mode, daysMap, ver, superseded) { return { version: ver || 1, at: at, by: by, mode: mode, days: JSON.parse(JSON.stringify(daysMap)), supersededAt: superseded || null }; }
  function seed() {
    var W1 = '2026-09-14', W2 = '2026-09-21', W3 = '2026-09-28', W4 = '2026-10-05';
    var list = [];
    function add(t) { list.push(t); return t; }
    function approve(t, at, by, mode, sAt, sBy, late) { t.status = 'Approved'; t.submittedAt = sAt; t.submittedBy = sBy; t.submittedLate = !!late; t.approvedAt = at; t.approvedBy = by; t.approvalMode = mode; t.approvals.push(approved(t.weekStart, at, by, mode, t.days)); t.events.push({ at: sAt, by: sBy, text: 'Submitted' + (late ? ', after the deadline' : '') }); t.events.push({ at: at, by: by, text: mode === 'automatic' ? 'Approved automatically at submission' : 'Approved' }); return t; }
    // week of 14 Sep
    approve(add(ts('ts-101', 'b2207', W1, 'Draft', fiveDays(W1, '8.00', 'sh-am'))), '2026-09-22T10:05:00', 'Sarah Mitchell', 'abstract', '2026-09-21T16:40:00', 'Rachel Green');
    approve(add(ts('ts-102', 'b2208', W1, 'Draft', fiveDays(W1, '8.00', 'sh-am'))), '2026-09-22T10:06:00', 'Sarah Mitchell', 'abstract', '2026-09-21T16:42:00', 'Rachel Green');
    approve(add(ts('ts-103', 'b2205', W1, 'Draft', fiveDays(W1, '8.00', 'sh-am'))), '2026-09-22T10:07:00', 'Sarah Mitchell', 'abstract', '2026-09-21T17:02:00', 'Rachel Green');
    // week of 21 Sep
    var o111 = {}; o111[addDays(W2, 4)] = day('Holiday', null, null, { absenceComment: 'Booked in August.' });
    approve(add(ts('ts-111', 'b2207', W2, 'Draft', fiveDays(W2, '8.00', 'sh-am', o111))), '2026-09-29T09:30:00', 'Sarah Mitchell', 'abstract', '2026-09-28T15:10:00', 'Rachel Green');
    var t112 = add(ts('ts-112', 'b2208', W2, 'Draft', fiveDays(W2, '8.00', 'sh-am')));
    approve(t112, '2026-09-29T09:31:00', 'Sarah Mitchell', 'abstract', '2026-09-28T15:12:00', 'Rachel Green');
    t112.approvals[0].supersededAt = '2026-09-30T11:00:00';
    t112.events.push({ at: '2026-09-30T11:00:00', by: 'Sarah Mitchell', text: 'Reopened: Wednesday’s hours were 9.50, not 8.00. The site sent its gate log.' });
    t112.days[addDays(W2, 2)] = W('9.50', 'sh-am', { updatedAt: '2026-09-30T11:04:00' });
    t112.events.push({ at: '2026-09-30T11:04:00', by: 'Sarah Mitchell', text: 'Wed 23 Sep: Worked 8.00 → 9.50 h, Morning' });
    t112.events.push({ at: '2026-09-30T11:06:00', by: 'Sarah Mitchell', text: 'Approved' });
    t112.approvals.push(approved(W2, '2026-09-30T11:06:00', 'Sarah Mitchell', 'abstract', t112.days, 2));
    t112.approvedAt = '2026-09-30T11:06:00'; t112.enteredOnBehalf = true; t112.returnedAt = '2026-09-30T11:00:00'; t112.returnedBy = 'Sarah Mitchell'; t112.returnKind = 'reopen'; t112.returnReason = 'Wednesday’s hours were 9.50, not 8.00. The site sent its gate log.';
    var o113 = {}; o113[addDays(W2, 5)] = undefined; o113[addDays(W2, 6)] = undefined;
    var t113 = add(ts('ts-113', 'b2205', W2, 'Draft', fiveDays(W2, '8.00', 'sh-am')));
    delete t113.days[addDays(W2, 5)]; delete t113.days[addDays(W2, 6)];
    approve(t113, '2026-10-01T09:00:00', 'Sarah Mitchell', 'abstract', '2026-09-30T08:15:00', 'Rachel Green', true);
    // week of 28 Sep
    var o121 = {}; o121[addDays(W3, 2)] = W('8.00', 'sh-pm', { coveredJobRoleId: 'jr-wo', roleChangedBy: 'Rachel Green', roleChangedAt: '2026-10-02T15:00:00' }); o121[addDays(W3, 5)] = W('6.00', 'sh-pm');
    approve(add(ts('ts-121', 'b2201', W3, 'Draft', fiveDays(W3, '8.00', 'sh-pm', o121))), '2026-10-05T09:12:00', null, 'automatic', '2026-10-05T09:12:00', 'Rachel Green');
    var d122 = {}; for (var i = 0; i < 4; i++) d122[addDays(W3, i)] = W('8.00', 'sh-pm');
    add(ts('ts-122', 'b2202', W3, 'Draft', d122, { updatedAt: '2026-10-02T17:30:00' }));
    var d123 = {}; d123[addDays(W3, 5)] = W('8.00', 'sh-am', { coveredJobRoleId: 'jr-fd', roleChangedBy: 'Rachel Green', roleChangedAt: '2026-10-03T15:00:00' }); d123[addDays(W3, 6)] = day('Sick Leave', null, 'sh-am', { shiftDefaulted: true, absenceComment: 'Called in at 05:10 with a migraine.' });
    approve(add(ts('ts-123', 'b2206', W3, 'Draft', d123)), '2026-10-07T08:40:00', null, 'automatic', '2026-10-07T08:40:00', 'Rachel Green', true);
    var t124 = add(ts('ts-124', 'b2207', W3, 'Draft', fiveDays(W3, '8.00', 'sh-am', (function () { var o = {}; o[addDays(W3, 3)] = day('Sick Leave', null, 'sh-am', { shiftDefaulted: true, absenceComment: 'Back pain; a fit note is expected.' }); return o; })())));
    t124.status = 'Submitted'; t124.submittedAt = '2026-10-05T16:20:00'; t124.submittedBy = 'Rachel Green'; t124.submittedLate = false; t124.events.push({ at: '2026-10-05T16:20:00', by: 'Rachel Green', text: 'Submitted' });
    var t125 = add(ts('ts-125', 'b2208', W3, 'Draft', fiveDays(W3, '8.00', 'sh-am', (function () { var o = {}; o[addDays(W3, 1)] = W('8.00', 'sh-am', { coveredJobRoleId: 'jr-fd', roleChangedBy: 'Rachel Green', roleChangedAt: '2026-09-29T15:40:00' }); return o; })())));
    t125.status = 'Submitted'; t125.submittedAt = '2026-10-05T16:24:00'; t125.submittedBy = 'Rachel Green'; t125.submittedLate = false; t125.events.push({ at: '2026-09-29T15:40:00', by: 'Rachel Green', text: 'Tue 29 Sep: covered role Forklift Driver (Reach), Morning. Checks not met: Reach truck (RTITB)' }); t125.events.push({ at: '2026-10-05T16:24:00', by: 'Rachel Green', text: 'Submitted' });
    // week of 5 Oct (this week; Sat 10 Oct is today and Sun 11 Oct is in the future)
    var d131 = {}; for (i = 0; i < 5; i++) d131[addDays(W4, i)] = W('8.00', 'sh-pm');
    add(ts('ts-131', 'b2201', W4, 'Draft', d131, { updatedAt: '2026-10-09T16:10:00' }));
    var d132 = {}; for (i = 0; i < 3; i++) d132[addDays(W4, i)] = W('8.00', 'sh-pm'); d132[addDays(W4, 3)] = W('8.00', 'sh-nt'); d132[addDays(W4, 4)] = W('8.00', 'sh-nt');
    var t132 = add(ts('ts-132', 'b2202', W4, 'Draft', d132, { updatedAt: '2026-10-09T16:12:00' }));
    t132.events.push({ at: '2026-10-08T22:10:00', by: 'Rachel Green', text: 'Thu 8 Oct: Worked 8.00 h, Night. Waiting for manual pricing: no rate on the card' });
    t132.events.push({ at: '2026-10-09T16:12:00', by: 'Rachel Green', text: 'Fri 9 Oct: Worked 8.00 h, Night. Waiting for manual pricing: no rate on the card' });
    var d134 = {}; for (i = 0; i < 3; i++) d134[addDays(W4, i)] = W('8.00', 'sh-am');
    add(ts('ts-134', 'b2207', W4, 'Draft', d134, { updatedAt: '2026-10-07T16:00:00' }));
    var d135 = {}; for (i = 0; i < 5; i++) d135[addDays(W4, i)] = W('8.00', 'sh-am'); d135[addDays(W4, 1)] = W('8.00', 'sh-am', { coveredJobRoleId: 'jr-fd', roleChangedBy: 'Rachel Green', roleChangedAt: '2026-10-06T15:00:00' }); d135[addDays(W4, 2)] = W('8.00', 'sh-am', { shiftDefaulted: true });
    var t135 = add(ts('ts-135', 'b2208', W4, 'Draft', d135, { updatedAt: '2026-10-09T15:30:00', returnedAt: '2026-10-09T15:30:00', returnedBy: 'Sarah Mitchell', returnKind: 'return', returnReason: 'Tuesday’s cover as Forklift Driver: please check the hours with the site and confirm Nadia drove that day.' }));
    t135.events.push({ at: '2026-10-09T11:00:00', by: 'Rachel Green', text: 'Submitted' });
    t135.events.push({ at: '2026-10-09T15:30:00', by: 'Sarah Mitchell', text: 'Returned to Draft: Tuesday’s cover as Forklift Driver: please check the hours with the site and confirm Nadia drove that day.' });
    // Ewa Rybak's week of 5 Oct has no timesheet yet: the grid ensures it on open (4.5 TV-1).
    return { ts: list, seq: 140, notified: false };
  }

  // ---------- store ----------
  function read(k) { try { return JSON.parse(window.localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function write(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window: this page only */ } }
  var db = read(KEY) || seed();
  function save() { write(KEY, db); }
  

  var S4 = window.S4 = { PORTAL: PORTAL, TODAY: TODAY, CURRENT_WEEK: CURRENT_WEEK, PATTERNS: PATTERNS, HOUR_TYPE: HOUR_TYPE, MULT: MULT, fmtDay: fmtDay, fmtWeek: fmtWeek, fmtDeadline: fmtDeadline, addDays: addDays, mondayOf: mondayOf, weekDates: weekDates };
  S4.reset = function () { try { window.localStorage.removeItem(KEY); window.localStorage.removeItem(KEY + '-abstract'); } catch (e) { /* nothing stored */ } db = seed();  };
  S4.me = S3.me;
  function actor(n) { return !n ? 'System' : (ABS || n === 'Rachel Green' ? n : 'Abstract'); }
  S4.actor = actor;
  function refuse(code, message, data) { var e = new Error(message); e.code = code; e.data = data || {}; throw e; }

  // ---------- reads: the record, the days, derived on read ----------
  function rawT(id) { return db.ts.filter(function (t) { return t.id === id; })[0]; }
  function bookingOf(t) { return S3.booking(t.bookingId); }
  // TSD §3.3.1 rule 2: the range also ends on a cancellation's or a completion's date.
  function rangeEnd(b) { var e = b.endDate; [b.cancelledAt, b.completedAt].forEach(function (t) { if (t && t.slice(0, 10) < e) e = t.slice(0, 10); }); return e; }
  function inRange(b, date) { return b.startDate <= date && date <= rangeEnd(b); }
  function shiftDefaultFor(t, b, date, daysMap) {
    // TS-070 for a Worked day: the candidate's most recent Worked Shift earlier in the week, else shift.default.
    var best = null; weekDates(t.weekStart).forEach(function (x) { var e = daysMap[x]; if (x < date && e && e.dayStatus === 'Worked' && e.shiftId) best = e.shiftId; });
    return best || (POLICY[b.clientId] || POLICY.acme).defaultShift;
  }
  function allSick(candidateId, clientId) {
    var out = []; db.ts.forEach(function (t) { var b = bookingOf(t); if (!b || b.candidateId !== candidateId || b.clientId !== clientId) return; Object.keys(t.days).forEach(function (k) { var e = t.days[k]; if (e && e.dayStatus === 'Sick Leave') out.push({ date: k, t: t, e: e }); }); });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  function derivePay(b, date, status) {
    var p = POLICY[b.clientId] || POLICY.acme;
    if (status === 'Holiday') return { value: p.holiday === 'accrued' ? 'Paid' : 'Unpaid', why: p.holiday === 'accrued' ? 'Holiday is paid as it is taken (accrued holiday pay).' : 'Holiday pay is rolled up into the hourly rate, so the day is unpaid.' };
    if (status === 'No-show') return { value: p.noShow, why: 'A no-show is ' + p.noShow.toLowerCase() + ' under the leave policy.' };
    // Sick Leave: paid while the count of paid sick days in the window before the date is below leave.paid_sick_days.
    var from = addDays(date, -364), n = 0;
    allSick(b.candidateId, b.clientId).forEach(function (s) { if (s.date >= from && s.date < date) { var v = s.e.payOverride ? s.e.payOverride.value : derivePay(b, s.date, 'Sick Leave').value; if (v === 'Paid') n++; } });
    var paid = n < p.paidSickDays;
    return { value: paid ? 'Paid' : 'Unpaid', why: 'The first ' + p.paidSickDays + ' sick days in a rolling year are paid. ' + (paid ? 'This is paid sick day ' + (n + 1) + '.' : n + ' paid sick days are already used.') };
  }
  function dressDays(t, b, daysMap) {
    var out = [];
    weekDates(t.weekStart).forEach(function (date) {
      var e = daysMap[date] || null, r = inRange(b, date), x = { date: date, weekday: weekday(date), inRange: r, future: date > TODAY, today: date === TODAY };
      x.dayStatus = !r ? 'Not Booked' : (e ? e.dayStatus : null); x.locked = !r; x.stored = !!e && r;
      x.hours = x.dayStatus === 'Worked' ? e.hours : null;
      x.shiftId = null; x.shiftDefaulted = false; x.coveredJobRoleId = null; x.complianceException = false; x.unmetChecks = []; x.absencePay = null; x.absencePayDerived = null; x.absencePayOverride = null; x.pricingState = null; x.pricingSource = null; x.pendingReason = null; x.lines = []; x.cost = null; x.absenceComment = null;
      
      if (x.dayStatus === 'Worked') {
        x.shiftId = e.shiftId || shiftDefaultFor(t, b, date, daysMap); x.shiftDefaulted = !e.shiftId || !!e.shiftDefaulted;
        x.coveredJobRoleId = e.coveredJobRoleId; x.roleChangedBy = e.roleChangedBy; x.roleChangedAt = e.roleChangedAt;
        x.effectiveJobRoleId = e.coveredJobRoleId || b.jobRoleId;
        if (e.coveredJobRoleId) { x.unmetChecks = requiredChecks(b.clientId, b.orgNodeId).filter(function (c) { return (UNMET[b.candidateId] || []).indexOf(c) >= 0; }).map(function (c) { return CHECK_LABEL[c]; }); x.complianceException = x.unmetChecks.length > 0; }
      }
      if (['Sick Leave', 'Holiday', 'No-show'].indexOf(x.dayStatus) >= 0) {
        var dv = derivePay(b, date, x.dayStatus);
        x.absenceComment = e.absenceComment; x.absencePayDerived = dv.value; x.absenceWhy = dv.why; x.absencePayOverride = e.payOverride; x.absencePay = e.payOverride ? e.payOverride.value : dv.value;
        if (x.absencePay === 'Paid') {
          // Ruling of 2026-11-08: a Paid absence defaults to the BOOKING's Shift; a Shift picked by hand wins.
          x.shiftId = e.shiftId && !e.shiftDefaulted ? e.shiftId : b.shiftId; x.shiftDefaulted = !(e.shiftId && !e.shiftDefaulted);
          x.effectiveJobRoleId = b.jobRoleId;
          
        }
      }
      if (x.shiftId) { x.shiftName = S3.shiftName(b.clientId, x.shiftId); var si = SHIFT_INFO[x.shiftId] || {}; x.shiftStartTime = si.start; x.shiftEndTime = si.end; x.shiftStandardHours = si.hours; }
      if (x.coveredJobRoleId) x.coveredJobRoleTitle = S3.JOB_ROLES[x.coveredJobRoleId];
      x.effectiveJobRoleTitle = x.effectiveJobRoleId ? S3.JOB_ROLES[x.effectiveJobRoleId] : null;
      if (e) { x.manualCharge = e.manualCharge; x.manualReason = e.manualReason; x.manualBy = e.manualBy; x.manualAt = e.manualAt; x.updatedAt = e.updatedAt; }
      out.push(x);
    });
    return out;
  }
  // ---------- the pure engine: hour types, rates, costs (TSD §3.3.3) ----------
  function price(t, b, days) {
    var bh = BANK_HOLIDAYS[(POLICY[b.clientId] || POLICY.acme).region] || [], weeklyStd = 0;
    days.forEach(function (x) {
      var worked = x.dayStatus === 'Worked', paidAbs = x.absencePay === 'Paid';
      if (!worked && !paidAbs) return;
      var role = worked ? x.effectiveJobRoleId : b.jobRoleId, line = resolveRate(role, b.clientId, b.orgNodeId, x.shiftId, x.date), std, manual = false;
      if (line) { std = P(line.charge);  }
      else if (x.manualCharge) { manual = true; std = P(x.manualCharge);  }
      else { x.pricingState = 'pending manual pricing'; x.pendingReason = 'no_rate'; return; }
      x.pricingState = 'priced'; x.pricingSource = manual ? 'manual' : 'rate_card';
      var split = {};
      if (worked) {
        var h = H(x.hours);
        if (bh.indexOf(x.date) >= 0) split.bank_holiday = h;
        else if (x.weekday >= 6) split.weekend = h;
        else {
          var s = Math.min(h, OT_DAILY * 100), ot = h - s;
          if (weeklyStd + s > OT_WEEKLY * 100) { var over = weeklyStd + s - OT_WEEKLY * 100; s -= over; ot += over; }
          weeklyStd += s; if (s) split.standard = s; if (ot) split.overtime = ot;
        }
      } else split.standard = H(x.shiftStandardHours || '8.00');
      var cost = { clientCost: 0  };
      Object.keys(split).forEach(function (k) {
        var m = MULT[k], cr = Math.round(std * m), ln = { kind: worked ? 'worked' : 'absence', hourType: k, hours: hrs(split[k]), multiplier: m.toFixed(4), chargeRate: M(cr), clientCost: M(mul(cr, split[k])) };
        
        cost.clientCost += P(ln.clientCost);
        x.lines.push(ln);
      });
      
      x.cost = {}; Object.keys(cost).forEach(function (k) { x.cost[k] = cost[k] == null ? null : M(cost[k]); });
    });
    var pending = days.filter(function (x) { return x.pricingState === 'pending manual pricing'; }).length;
    var hb = { standard: 0, overtime: 0, weekend: 0, bank_holiday: 0 }, sum = { clientCost: 0  };
    days.forEach(function (x) { x.lines.forEach(function (l) { if (l.kind === 'worked') hb[l.hourType] += H(l.hours); }); if (x.cost) Object.keys(sum).forEach(function (k) { sum[k] += P(x.cost[k]); }); });
    var totals = { hoursByType: {} }; Object.keys(hb).forEach(function (k) { totals.hoursByType[k] = hrs(hb[k]); });
    Object.keys(sum).forEach(function (k) { totals[k] = pending ? null : M(sum[k]); });
    
    return { totals: totals, pending: pending };
  }
  function dress(t, daysOverride) {
    var b = bookingOf(t); if (!b) return null;
    var days = dressDays(t, b, daysOverride || t.days), pr = price(t, b, days);
    var o = { id: t.id, bookingId: b.id, bookingReference: b.reference, candidateId: b.candidateId, candidateName: b.candidateName, clientId: b.clientId, clientName: b.clientName, orgNodeId: b.orgNodeId, orgNodeName: b.orgNodeName, orgNodePath: b.orgNodePath, jobRoleId: b.jobRoleId, jobRoleTitle: b.jobRoleTitle, bookingShiftId: b.shiftId, bookingShiftName: b.shiftName, supplyingParty: 'Abstract', weekStart: t.weekStart, status: t.status, days: days, totals: pr.totals };
    
    o.submissionDeadline = deadlineFor(b.clientId, t.weekStart);
    o.overdue = t.status === 'Draft' && NOW() > o.submissionDeadline;
    o.submittedLate = t.submittedLate;
    o.pendingPricingDays = pr.pending; o.held = pr.pending > 0;
    o.workedHours = hrs(days.reduce(function (m, x) { return m + (x.dayStatus === 'Worked' ? H(x.hours) : 0); }, 0));
    o.absenceDays = days.filter(function (x) { return ['Sick Leave', 'Holiday', 'No-show'].indexOf(x.dayStatus) >= 0; }).length;
    o.clientCost = pr.totals.clientCost; o.mixedRate = days.some(function (x) { return x.coveredJobRoleId; });
    o.complianceExceptions = days.filter(function (x) { return x.complianceException; }).length;
    o.unsetDates = days.filter(function (x) { return x.inRange && !x.dayStatus; }).map(function (x) { return x.date; });
    o.enteredOnBehalf = t.enteredOnBehalf; o.updatedAt = t.updatedAt; o.createdAt = t.createdAt;
    ['submittedAt', 'submittedBy', 'approvedAt', 'approvedBy', 'approvalMode', 'returnedAt', 'returnedBy', 'returnReason', 'returnKind'].forEach(function (k) { o[k] = t[k]; });
    o.approvalSetting = approvalAt(b.clientId, b.orgNodeId);
    o.invoicedAt = null;
    o.events = (t.events || []).slice().sort(function (a, b2) { return a.at < b2.at ? 1 : -1; });
    o.versions = (t.approvals || []).length;
    o.currentPayStatementId = ABS && t.status === 'Approved' && t.approvals.length ? 'ps-' + t.id + '-v' + t.approvals.length : null;
    return o;
  }
  function own(b) { return !S3.clientId || b.clientId === S3.clientId; }
  S4.timesheets = function (f) {
    f = f || {};
    return db.ts.map(function (t) { var b = bookingOf(t); return b && own(b) ? dress(t) : null; }).filter(Boolean).filter(function (x) {
      if (f.weekStart && x.weekStart !== f.weekStart) return false;
      if (f.clientId && x.clientId !== f.clientId) return false;
      if (f.bookingId && x.bookingId !== f.bookingId) return false;
      return true;
    }).sort(function (a, b) { return a.weekStart === b.weekStart ? (a.candidateName < b.candidateName ? -1 : 1) : (a.weekStart < b.weekStart ? 1 : -1); });
  };
  // the empty state of one booking-week: the week as it reads before anything is entered
  S4.blankTimesheet = function (id) { var t = rawT(id); if (!t) return null; var b = bookingOf(t); if (!b || !own(b)) return null; var x = dress(Object.assign({}, t, { status: 'Draft', events: [], approvals: [], submittedAt: null, submittedLate: null, returnReason: null, approvalMode: null }), {}); x.blank = true; return x; };
  S4.timesheet = function (id) { var t = rawT(id); if (!t) return null; var b = bookingOf(t); return b && own(b) ? dress(t) : null; };
  // GET /timesheets/week: the week's timesheets in scope, and the bookings of the week with no timesheet yet.
  S4.week = function (clientId, ws) {
    var items = S4.timesheets({ weekStart: ws, clientId: clientId });
    var have = items.map(function (x) { return x.bookingId; });
    var pend = S3.bookings().filter(function (b) { return (!clientId || b.clientId === clientId) && have.indexOf(b.id) < 0 && b.startDate <= addDays(ws, 6) && rangeEnd(b) >= ws && !(b.status === 'Cancelled' && b.cancelledAt && b.cancelledAt.slice(0, 10) < b.startDate) && b.clientId in POLICY; });
    return { items: items, pendingBookings: pend.map(function (b) { return { bookingId: b.id, reference: b.reference, candidateName: b.candidateName, startDate: b.startDate, endDate: b.endDate }; }) };
  };
  S4.forBooking = function (bookingId) { return S4.timesheets({ bookingId: bookingId }); };
  S4.clientsWithWeeks = function () { var m = {}; S4.timesheets().forEach(function (x) { m[x.clientId] = x.clientName; }); return m; };
  S4.weeks = function () { var m = {}; db.ts.forEach(function (t) { m[t.weekStart] = 1; }); m[CURRENT_WEEK] = 1; return Object.keys(m).sort().reverse(); };

  // ---------- writes ----------
  function touch(t) { t.updatedAt = NOW(); if (ABS) t.enteredOnBehalf = true; save(); }
  function ev(t, text) { t.events.push({ at: NOW(), by: S4.me, text: text }); }
  function draftOnly(t, what) { if (t.status !== 'Draft') refuse('TIMESHEET_STATUS_INVALID', 'This week is ' + t.status + ', so ' + what + '. ' + (t.status === 'Submitted' ? 'Abstract approves or returns it.' : t.status === 'Approved' ? (ABS ? 'Reopen it first.' : 'Ask Abstract to reopen it.') : ''), { status: t.status }); }
  function stamp(t, s) { if (s && s !== t.updatedAt) refuse('TIMESHEET_VERSION_CONFLICT', 'This week was changed elsewhere while you had it open.'); }
  function pendingNotice(t, x, b) {
    if (!window.S1 || !S1.notify) return;
    S1.notify({ severity: 'critical', title: 'A day is waiting for manual pricing', body: b.candidateName + ', ' + b.reference + ', ' + fmtDay(x.date) + ': ' + S3.JOB_ROLES[x.effectiveJobRoleId || b.jobRoleId] + ' on the ' + x.shiftName + ' Shift has no rate on the card. The week can’t be submitted or approved until Abstract prices it.', href: ABS ? 'abstract.timesheets.pending-pricing.html' : 'client.timesheets.booking-week.html?id=' + t.id });
  }
  var STATUSES = ['Worked', 'Sick Leave', 'Holiday', 'No-show', 'Not Booked'];
  S4.STATUSES = STATUSES;
  // PUT /timesheets/:id/days
  S4.act = {};
  S4.act.setDays = function (id, inputs, o) {
    o = o || {}; var t = rawT(id), b = bookingOf(t); draftOnly(t, 'its days can’t be changed'); stamp(t, o.stamp);
    var before = dress(t), errs = {};
    inputs.forEach(function (inp) {
      var x = before.days.filter(function (y) { return y.date === inp.date; })[0];
      if (!x || !x.inRange) refuse('TIMESHEET_DAY_OUT_OF_RANGE', fmtDay(inp.date) + ' is outside the booking, so it stays Not Booked.', { date: inp.date });
      if (inp.dayStatus && inp.dayStatus !== 'Not Booked' && inp.date > TODAY) refuse('TIMESHEET_DAY_IN_FUTURE', fmtDay(inp.date) + ' is in the future. A future day can only be Not Booked.', { date: inp.date });
      if (inp.dayStatus === 'Worked') { var h = Number(inp.hours); if (!inp.hours || isNaN(h) || h <= 0 || h > 24) errs[inp.date] = 'Enter the hours worked, more than 0 and no more than 24.'; }
      if (inp.absenceComment && inp.absenceComment.length > 500) errs[inp.date] = 'Keep the comment to 500 characters.';
    });
    if (Object.keys(errs).length) refuse('VALIDATION_ERROR', 'Check the highlighted days.', { fields: errs });
    var newlyPending = [];
    inputs.forEach(function (inp) {
      var prev = t.days[inp.date], was = before.days.filter(function (y) { return y.date === inp.date; })[0];
      // TSD §3.3.1 rule 3 (R5 decision O3): re-sending the Shift the day already has keeps its default flag; only another Shift clears it
      var sameAsDefault = inp.shiftId && was && was.dayStatus === inp.dayStatus && was.shiftDefaulted && was.shiftId === inp.shiftId;
      if (!inp.dayStatus) { delete t.days[inp.date]; ev(t, fmtDay(inp.date) + ': cleared'); return; }
      var e = day(inp.dayStatus, inp.dayStatus === 'Worked' ? (Math.round(Number(inp.hours) * 4) / 4).toFixed(2) : null, null, { updatedAt: NOW() });
      if (inp.dayStatus === 'Worked') {
        e.shiftId = inp.shiftId || null; e.shiftDefaulted = !inp.shiftId || !!sameAsDefault;
        if (prev && prev.dayStatus === 'Worked' && prev.coveredJobRoleId) { e.coveredJobRoleId = prev.coveredJobRoleId; e.roleChangedBy = prev.roleChangedBy; e.roleChangedAt = prev.roleChangedAt; }
        if (!e.shiftId) e.shiftId = null;
      } else if (inp.dayStatus !== 'Not Booked') {
        e.absenceComment = inp.absenceComment || null; e.shiftId = inp.shiftId || null; e.shiftDefaulted = !inp.shiftId || !!sameAsDefault;
        if (prev && prev.dayStatus === inp.dayStatus && prev.payOverride) e.payOverride = prev.payOverride;
      }
      t.days[inp.date] = e;
      ev(t, fmtDay(inp.date) + ': ' + inp.dayStatus + (inp.dayStatus === 'Worked' ? ' ' + e.hours + ' h' + (inp.shiftId ? ', ' + S3.shiftName(b.clientId, inp.shiftId) : ', Shift by default') : ''));
    });
    var after = dress(t);
    after.days.forEach(function (x) { var was = before.days.filter(function (y) { return y.date === x.date; })[0]; if (x.pricingState === 'pending manual pricing' && (!was || was.pricingState !== 'pending manual pricing')) newlyPending.push(x); });
    touch(t);
    newlyPending.forEach(function (x) { ev(t, fmtDay(x.date) + ': waiting for manual pricing, no rate on the card'); pendingNotice(t, x, b); });
    save();
    return { timesheet: S4.timesheet(id), newlyPending: newlyPending };
  };
  // GET …/cover-options: every role × Shift priced on the date, each with the candidate's unmet checks.
  S4.coverOptions = function (id, date) {
    var t = rawT(id), b = bookingOf(t), out = [];
    (S3.CLIENT_ROLES[b.clientId] || []).forEach(function (role) {
      (S3.SHIFTS[b.clientId] || []).forEach(function (s) {
        if (!resolveRate(role, b.clientId, b.orgNodeId, s.id, date)) return;
        var unmet = requiredChecks(b.clientId, b.orgNodeId).filter(function (c) { return (UNMET[b.candidateId] || []).indexOf(c) >= 0; }).map(function (c) { return CHECK_LABEL[c]; });
        if (role === b.jobRoleId) unmet = [];   // the assigned role is not a cover, so it carries no flag
        out.push({ jobRoleId: role, jobRoleTitle: S3.JOB_ROLES[role], shiftId: s.id, shiftName: s.name, complianceException: unmet.length > 0, unmetChecks: unmet, assigned: role === b.jobRoleId });
      });
    });
    return out;
  };
  S4.act.cover = function (id, date, roleId, shiftId, o) {
    o = o || {}; var t = rawT(id), b = bookingOf(t); draftOnly(t, 'its covered role can’t be changed'); stamp(t, o.stamp);
    var e = t.days[date]; if (!e || e.dayStatus !== 'Worked') refuse('TIMESHEET_DAY_NOT_WORKED', 'Only a Worked day can carry a covered role.');
    if (roleId && !S4.coverOptions(id, date).some(function (c) { return c.jobRoleId === roleId && c.shiftId === (shiftId || e.shiftId); })) refuse('TIMESHEET_COVER_NOT_PRICED', S3.JOB_ROLES[roleId] + ' on that Shift has no rate on ' + fmtDay(date) + ', so it can’t be chosen.');
    e.coveredJobRoleId = roleId === b.jobRoleId ? null : roleId; if (shiftId) { e.shiftId = shiftId; e.shiftDefaulted = false; }
    e.roleChangedBy = e.coveredJobRoleId ? S4.me : null; e.roleChangedAt = e.coveredJobRoleId ? NOW() : null; e.updatedAt = NOW();
    var x = dress(t).days.filter(function (y) { return y.date === date; })[0];
    ev(t, fmtDay(date) + ': ' + (e.coveredJobRoleId ? 'covered role ' + S3.JOB_ROLES[e.coveredJobRoleId] + ', ' + x.shiftName + (x.complianceException ? '. Checks not met: ' + x.unmetChecks.join(', ') : '') : 'back to the assigned role'));
    touch(t); return S4.timesheet(id);
  };
  // POST /timesheets/:id/submit
  S4.act.submit = function (id, o) {
    o = o || {}; var t = rawT(id); if (t.status !== 'Draft') refuse('TIMESHEET_STATUS_INVALID', 'This week is already ' + t.status + '.', { status: t.status }); stamp(t, o.stamp);
    var x = dress(t);
    if (x.unsetDates.length) refuse('TIMESHEET_DAYS_INCOMPLETE', 'Every booked day needs a status before the week can be submitted.', { dates: x.unsetDates });
    if (x.held) refuse('TIMESHEET_WEEK_HELD', 'This week can’t be submitted while a day waits for manual pricing.', { reasons: [{ conditionId: 'pending_manual_pricing', label: 'Waiting for manual pricing', dates: x.days.filter(function (y) { return y.pricingState === 'pending manual pricing'; }).map(function (y) { return y.date; }) }] });
    var now = NOW(); t.submittedAt = now; t.submittedBy = S4.me; t.submittedLate = now > x.submissionDeadline; t.returnReason = null; t.returnedAt = null; t.returnKind = null;
    ev(t, 'Submitted' + (t.submittedLate ? ', after the deadline' : ''));
    if (x.approvalSetting === 'optional') { t.status = 'Approved'; t.approvedAt = now; t.approvedBy = null; t.approvalMode = 'automatic'; t.approvals.push({ version: t.approvals.length + 1, at: now, by: null, mode: 'automatic', days: JSON.parse(JSON.stringify(t.days)), supersededAt: null }); ev(t, 'Approved automatically at submission'); }
    else t.status = 'Submitted';
    touch(t); return S4.timesheet(id);
  };
  // Mark the rest Not Booked: every booked day still without a status, past or future.
  S4.act.markRest = function (id, o) {
    var x = S4.timesheet(id); return S4.act.setDays(id, x.unsetDates.map(function (dt) { return { date: dt, dayStatus: 'Not Booked' }; }), o);
  };
  

  // ---------- bulk: fill week / fill all days / copy previous week, PREVIEW THEN CONFIRM (rulings N1, N2) ----------
  // POST /timesheets/bulk-fill { preview: true } answers per timesheet what would be written and each one's version stamp.
  function wouldFill(t, x, req) {
    var b = bookingOf(t), w = {}, filled = [], kept = [], skipped = [];
    if (t.status !== 'Draft') return { outcome: 'refused', code: 'TIMESHEET_STATUS_INVALID', message: 'This week is ' + t.status + ', so it can’t be filled.', filled: [], kept: [], would: {} };
    var prev = null;
    if (req.mode === 'copy_previous') { prev = db.ts.filter(function (p) { return p.bookingId === t.bookingId && p.weekStart === addDays(t.weekStart, -7); })[0]; if (!prev) return { outcome: 'refused', code: 'TIMESHEET_NO_PREVIOUS_WEEK', message: 'There is no previous week on this booking to copy.', filled: [], kept: [], would: {} }; }
    var pat = PATTERNS.filter(function (p) { return p.id === req.shiftPatternId; })[0];
    x.days.forEach(function (y) {
      if (!y.inRange) return;
      var target = null;
      if (req.mode === 'pattern') target = pat.days.indexOf(y.weekday) >= 0 ? { dayStatus: 'Worked', hours: SHIFT_INFO[req.shiftId].hours, shiftId: req.shiftId } : { dayStatus: 'Not Booked' };
      else if (req.mode === 'all_days') target = { dayStatus: 'Worked', hours: SHIFT_INFO[req.shiftId].hours, shiftId: req.shiftId };
      else { var pe = prev.days[addDays(y.date, -7)]; if (pe) target = { dayStatus: pe.dayStatus, hours: pe.hours, shiftId: pe.shiftId, absenceComment: pe.absenceComment }; }
      if (!target) return;
      if (y.future && target.dayStatus !== 'Not Booked') { skipped.push(y.date); return; }
      if (y.dayStatus && !req.overwrite) { kept.push(y.date); return; }
      w[y.date] = target; filled.push(y.date);
    });
    return { outcome: filled.length ? 'filled' : 'skipped', filled: filled, kept: kept, future: skipped, would: w, message: filled.length ? null : (kept.length ? 'Every day it would fill is already entered.' : 'Nothing to fill on this booking this week.') };
  }
  S4.act.bulkFill = function (req) {
    if (!req.timesheetIds || !req.timesheetIds.length) refuse('VALIDATION_ERROR', 'Select at least one row.');
    if (req.timesheetIds.length > 100) refuse('VALIDATION_ERROR', 'Select no more than 100 rows at a time.');
    if ((req.mode === 'pattern' || req.mode === 'all_days') && !req.shiftId) refuse('VALIDATION_ERROR', 'Choose the Shift.', { fields: { shiftId: 'Choose the Shift.' } });
    if (req.mode === 'pattern' && !req.shiftPatternId) refuse('VALIDATION_ERROR', 'Choose the shift pattern.', { fields: { shiftPatternId: 'Choose the shift pattern.' } });
    return req.timesheetIds.map(function (id) {
      var t = rawT(id), x = dress(t), r = wouldFill(t, x, req); r.timesheetId = id; r.candidateName = x.candidateName; r.bookingReference = x.bookingReference; r.updatedAt = t.updatedAt;
      if (!req.preview) {
        if (req.stamps && req.stamps[id] && req.stamps[id] !== t.updatedAt) return Object.assign(r, { outcome: 'refused', code: 'TIMESHEET_CHANGED_SINCE_PREVIEW', message: 'Changed since your preview — review again.', filled: [], would: {} });
        if (r.outcome === 'filled') {
          Object.keys(r.would).forEach(function (dt) { var v = r.would[dt], e = day(v.dayStatus, v.hours, v.shiftId, { updatedAt: NOW(), absenceComment: v.absenceComment || null }); if (v.dayStatus === 'Worked' && t.days[dt] && t.days[dt].coveredJobRoleId && t.days[dt].dayStatus === 'Worked') { e.coveredJobRoleId = t.days[dt].coveredJobRoleId; e.roleChangedBy = t.days[dt].roleChangedBy; e.roleChangedAt = t.days[dt].roleChangedAt; } t.days[dt] = e; });
          ev(t, ({ pattern: 'Filled from a shift pattern', all_days: 'Filled every day', copy_previous: 'Copied the previous week' })[req.mode] + ': ' + r.filled.map(fmtDay).join(', ') + (r.kept.length ? '. Kept: ' + r.kept.map(fmtDay).join(', ') : ''));
          touch(t);
        }
        r.updatedAt = t.updatedAt;
      }
      return r;
    });
  };
  // POST /timesheets/bulk-day: one day set on every selected timesheet — previewed, then confirmed, like the fills (TSD 4.5 TV-3).
  S4.act.bulkDay = function (req) {
    if (req.dayStatus === 'Worked') { var h = Number(req.hours); if (!req.hours || isNaN(h) || h <= 0 || h > 24) refuse('VALIDATION_ERROR', 'Enter the hours worked, more than 0 and no more than 24.', { fields: { hours: 'Enter the hours worked, more than 0 and no more than 24.' } }); }
    return req.timesheetIds.map(function (id) {
      var t = rawT(id), x = dress(t), y = x.days.filter(function (d2) { return d2.date === req.date; })[0], r = { timesheetId: id, candidateName: x.candidateName, bookingReference: x.bookingReference, updatedAt: t.updatedAt, filled: [], kept: [], would: {} };
      var why = t.status !== 'Draft' ? ['TIMESHEET_STATUS_INVALID', 'This week is ' + t.status + ', so its days can’t be changed.'] : !y.inRange ? ['TIMESHEET_DAY_OUT_OF_RANGE', fmtDay(req.date) + ' is outside the booking.'] : (y.future && req.dayStatus !== 'Not Booked') ? ['TIMESHEET_DAY_IN_FUTURE', fmtDay(req.date) + ' is in the future: only Not Booked.'] : null;
      if (why) return Object.assign(r, { outcome: 'refused', code: why[0], message: why[1] });
      if (!req.preview && req.stamps && req.stamps[id] && req.stamps[id] !== t.updatedAt) return Object.assign(r, { outcome: 'refused', code: 'TIMESHEET_CHANGED_SINCE_PREVIEW', message: 'Changed since your preview — review again.' });
      r.would[req.date] = { dayStatus: req.dayStatus, hours: req.dayStatus === 'Worked' ? Number(req.hours).toFixed(2) : null, shiftId: req.shiftId || null }; r.filled = [req.date]; r.outcome = 'filled';
      if (y.dayStatus) r.replaced = [req.date];
      if (!req.preview) { S4.act.setDays(id, [{ date: req.date, dayStatus: req.dayStatus, hours: req.hours, shiftId: req.shiftId }]); r.updatedAt = rawT(id).updatedAt; }
      return r;
    });
  };
  // POST /timesheets/ensure
  S4.act.ensure = function (bookingId, ws) {
    var have = db.ts.filter(function (t) { return t.bookingId === bookingId && t.weekStart === ws; })[0]; if (have) return have.id;
    var t = ts('ts-' + (++db.seq), bookingId, ws, 'Draft', {}, { createdAt: NOW(), updatedAt: NOW() }); db.ts.push(t); save(); return t.id;
  };

  // ---------- the look ----------
  var BUCKET = { neutral: 'bg-slate-100 text-slate-700 border border-slate-200', info: 'bg-blue-50 text-blue-700 border border-blue-200', good: 'bg-emerald-50 text-emerald-700 border border-emerald-200', bad: 'bg-red-50 text-red-700 border border-red-200', closed: 'bg-slate-100 text-slate-600 border border-slate-200', waiting: 'bg-amber-50 text-amber-700 border border-amber-200' };
  var TS_WORD = { Draft: ['neutral', 'fa-file-pen'], Submitted: ['info', 'fa-paper-plane'], Approved: ['good', 'fa-circle-check'], Invoiced: ['closed', 'fa-file-invoice'], Overdue: ['bad', 'fa-clock'] };
  var ui = S4.ui = {};
  ui.badge = function (s, small) { var w = TS_WORD[s] || TS_WORD.Draft; return '<span class="inline-flex items-center gap-1.5 ' + (small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs') + ' rounded-full font-semibold whitespace-nowrap ' + BUCKET[w[0]] + '"><i class="fa-solid ' + w[1] + ' text-[10px]" aria-hidden="true"></i>' + esc(s) + '</span>'; };
  // Markers are not statuses (design-tokens §5): Overdue is the additive second pill; late, held, the compliance flag and the rest are markers.
  ui.markers = function (x, small) {
    var m = [];
    if (x.overdue) m.push(ui.badge('Overdue', small));
    if (x.submittedLate) m.push(ui3.marker('Late', 'warning'));
    if (x.held) m.push('<span title="A day waits for manual pricing, so the week can’t be submitted or approved">' + ui3.marker('Held', 'warning') + '</span>');
    if (x.complianceExceptions) m.push('<span title="A covered day has client checks the candidate doesn’t meet. This never blocks.">' + ui3.marker('Compliance exception', 'warning') + '</span>');
    if (x.approvalMode === 'automatic' && x.status === 'Approved') m.push(ui3.marker('Approved automatically'));
    return m.join(' ');
  };
  var CELL = {
    'Worked': ['bg-white text-slate-900 border-slate-200', null],
    'Sick Leave': ['bg-amber-50 text-amber-800 border-amber-200', 'fa-notes-medical'],
    'Holiday': ['bg-blue-50 text-blue-800 border-blue-200', 'fa-umbrella-beach'],
    'No-show': ['bg-red-50 text-red-800 border-red-200', 'fa-user-xmark'],
    'Not Booked': ['bg-slate-100 text-slate-500 border-slate-200', 'fa-minus']
  };
  var CHIP = { 'Worked': 'bg-emerald-50 text-emerald-700 border border-emerald-200', 'Sick Leave': 'bg-amber-50 text-amber-700 border border-amber-200', 'Holiday': 'bg-blue-50 text-blue-700 border border-blue-200', 'No-show': 'bg-red-50 text-red-700 border border-red-200', 'Not Booked': 'bg-slate-100 text-slate-500 border border-slate-200' };
  ui.chip = function (s) { var c = CELL[s]; return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ' + CHIP[s] + '">' + (c[1] ? '<i class="fa-solid ' + c[1] + ' text-[9px]" aria-hidden="true"></i>' : '<i class="fa-solid fa-check text-[9px]" aria-hidden="true"></i>') + esc(s) + '</span>'; };
  var HATCH = 'background-image:repeating-linear-gradient(135deg,rgba(148,163,184,.18) 0 4px,transparent 4px 8px)';
  ui.legend = function () {
    var items = STATUSES.map(ui.chip).join('') +
      '<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"><span class="w-4 h-4 rounded ring-2 ring-[#5B2E91] bg-white" aria-hidden="true"></span>Role changed for shift</span>' +
      '<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"><span class="w-4 h-4 rounded border-2 border-dashed border-amber-500 bg-amber-50" aria-hidden="true"></span>Pending manual pricing</span>' +
      '<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"><i class="fa-solid fa-triangle-exclamation text-amber-600" aria-hidden="true"></i>Compliance exception</span>' +
      '<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"><span class="text-slate-500 font-medium">· default</span>Shift filled in by the system</span>' +
      '<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"><i class="fa-solid fa-lock text-slate-400" aria-hidden="true"></i>Outside the booking</span>';
    return '<div class="flex flex-wrap items-center gap-x-3 gap-y-2" role="list" aria-label="Day status legend">' + items.replace(/<span class="inline-flex/g, '<span role="listitem" class="inline-flex') + '</div>';
  };
  function dayLabel(y, b) {
    var s = y.dayStatus || 'not set';
    var t = fmtDay(y.date) + ', ' + s + (y.hours ? ', ' + y.hours + ' hours' : '') + (y.shiftName ? ', ' + y.shiftName + (y.shiftDefaulted ? ' (default)' : '') : '') + (y.coveredJobRoleTitle ? ', covered as ' + y.coveredJobRoleTitle : '') + (y.absencePay ? ', ' + y.absencePay : '') + (y.pricingState === 'pending manual pricing' ? ', pending manual pricing' : '') + (y.complianceException ? ', checks not met: ' + y.unmetChecks.join(', ') : '');
    return t;
  }
  // One cell: the kernel's day-status language (design-tokens §6) and slice 4's additions.
  ui.cell = function (y, o) {
    o = o || {};
    var p = o.preview, st = p ? p.dayStatus : y.dayStatus, shown = p ? Object.assign({}, y, { dayStatus: p.dayStatus, hours: p.hours, shiftName: p.shiftId ? S3.shiftName(o.clientId, p.shiftId) : null, shiftDefaulted: false, coveredJobRoleId: null, pricingState: null, absencePay: null, complianceException: false }) : y;
    var cls = 'relative w-full h-[64px] rounded-lg border text-left px-1.5 py-1 flex flex-col justify-between text-[11px] leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 ';
    var style = '', inner = '', aria = dayLabel(shown);
    if (y.locked) {
      cls += 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'; style = HATCH;
      inner = '<span class="font-semibold flex items-center gap-1"><i class="fa-solid fa-minus text-[9px]" aria-hidden="true"></i>Not Booked</span><span class="text-[10px] text-slate-500 flex items-center gap-1"><i class="fa-solid fa-lock text-[9px]" aria-hidden="true"></i>Outside booking</span>';
      return '<div role="gridcell" aria-label="' + esc(aria + ', outside the booking, locked') + '" class="' + cls + '" style="' + style + '">' + inner + '</div>';
    }
    if (!st) {
      cls += 'bg-white border-dashed border-slate-300 text-slate-500 ' + (o.editable ? 'hover:border-blue-400 hover:bg-blue-50/40' : '');
      inner = '<span class="text-slate-400 font-semibold">—</span><span class="text-[10px]">' + (y.future ? 'Future: Not Booked only' : (o.editable ? 'Set the day' : 'Not set')) + '</span>';
    } else {
      var c = CELL[st]; cls += c[0] + ' ';
      if (st === 'Not Booked') style = HATCH;
      if (shown.coveredJobRoleId) cls += 'ring-2 ring-[#5B2E91] ';
      if (shown.pricingState === 'pending manual pricing') cls += 'border-2 border-dashed border-amber-500 bg-amber-50 ';
      var top = st === 'Worked' ? '<span class="text-sm font-bold tnum">' + esc(shown.hours) + '</span>' : '<span class="font-semibold flex items-start gap-1 leading-tight"><i class="fa-solid ' + c[1] + ' text-[9px] mt-0.5" aria-hidden="true"></i><span>' + esc(st) + '</span></span>';
      var sub = '';
      if (shown.pricingState === 'pending manual pricing') sub = '<span class="text-[10px] font-semibold text-amber-800 flex items-center gap-1"><i class="fa-solid fa-hourglass-half text-[9px]" aria-hidden="true"></i>pending manual pricing</span>';
      else if (shown.coveredJobRoleId) sub = '<span class="text-[10px] font-semibold text-[#5B2E91] truncate">' + esc(shown.coveredJobRoleTitle) + '</span>';
      else if (shown.shiftName) sub = '<span class="text-[10px] text-slate-600 truncate">' + esc(shown.shiftName) + (shown.shiftDefaulted ? ' <span class="text-slate-500">· default</span>' : '') + '</span>';
      if (st !== 'Worked' && st !== 'Not Booked' && shown.absencePay) sub = '<span class="flex items-center gap-1 flex-wrap"><span class="px-1 rounded text-[9px] font-bold ' + (shown.absencePay === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700') + '">' + shown.absencePay + '</span>' + (shown.absencePayOverride  ? '<span class="text-[9px] font-semibold text-blue-800" title="' + esc('Overridden: ' + (shown.absencePayOverride ? shown.absencePayOverride.reason : '') ) + '">overridden</span>' : '') + (shown.absencePay === 'Paid' && shown.shiftName ? '<span class="text-[9px] text-slate-600 truncate">' + esc(shown.shiftName) + (shown.shiftDefaulted ? ' · default' : '') + '</span>' : '') + '</span>';
      inner = top + sub;
      if (shown.shiftDefaulted && shown.shiftName && !shown.coveredJobRoleId && shown.pricingState !== 'pending manual pricing' && !p) inner += '<span class="absolute top-0.5 right-1 text-[9px] font-semibold text-slate-500" aria-hidden="true">default</span>';
      if (shown.coveredJobRoleId) inner += '<span class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#5B2E91] text-white flex items-center justify-center" aria-hidden="true"><i class="fa-solid fa-right-left text-[8px]"></i></span>';
      if (shown.complianceException) inner += '<span class="absolute bottom-1 right-1 text-amber-600" title="' + esc('Compliance exception: ' + shown.unmetChecks.join(', ') + '. This never blocks.') + '"><i class="fa-solid fa-triangle-exclamation text-[10px]" aria-hidden="true"></i></span>';
    }
    if (p) { cls += 'outline outline-2 outline-dashed outline-blue-500 outline-offset-1 '; inner += '<span class="absolute top-0.5 right-1 text-[9px] font-bold uppercase tracking-wide text-blue-700">unsaved</span>'; aria += ', unsaved preview'; }
    if (o.error) cls += 'border-red-500 bg-red-50 ';
    var tag = o.editable && !p ? 'button' : 'div';
    return '<' + tag + (tag === 'button' ? ' type="button" data-cell="' + esc(o.tsId) + '|' + y.date + '"' : ' role="gridcell"') + ' aria-label="' + esc(aria) + '" class="' + cls + '" style="' + style + '">' + inner + '</' + tag + '>';
  };

  // ---------- dialogs ----------
  function scrim(title, body, foot, width) {
    var last = document.activeElement, s = document.createElement('div'); s.className = 's1-scrim'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true'); s.setAttribute('aria-labelledby', 's4-dlg-t');
    s.innerHTML = '<div class="s1-dialog" style="max-width:' + (width || 520) + 'px;max-height:calc(100vh - 32px);display:flex;flex-direction:column"><div style="padding:20px 20px 8px;overflow-y:auto"><h2 id="s4-dlg-t">' + title + '</h2><div id="s4-dlg-banner" class="mt-2"></div>' + body + '</div><div class="s1-dlg-foot" style="flex-wrap:wrap">' + foot + '</div></div>';
    function close() { s.remove(); if (last && last.focus) last.focus(); }
    s.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); if (e.key === 'Tab') { var f = Array.prototype.filter.call(s.querySelectorAll('button,textarea,input,select,a[href]'), function (n) { return !n.disabled && n.offsetParent !== null; }), a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { z.focus(); e.preventDefault(); } else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault(); } } });
    s.addEventListener('click', function (e) { if (e.target === s) close(); });
    document.body.appendChild(s);
    var api = { el: s, close: close, banner: function (tone, html) { s.querySelector('#s4-dlg-banner').innerHTML = html ? ui3.banner(tone, html) : ''; }, q: function (sel) { return s.querySelector(sel); } };
    var x = s.querySelector('[data-x]'); if (x) x.onclick = close;
    setTimeout(function () { var f = s.querySelector('input:not([type=hidden]),select,textarea,[data-ok]'); if (f) f.focus(); }, 0);
    return api;
  }
  S4.scrim = scrim;
  function radio(name, v, label, checked, hint, disabled) { return '<label class="flex items-start gap-2.5 p-2.5 rounded-lg border ' + (disabled ? 'border-slate-100 opacity-50' : 'border-slate-200 hover:border-blue-300') + ' cursor-pointer"><input type="radio" name="' + name + '" value="' + esc(v) + '" class="mt-0.5"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + '/><span class="min-w-0"><span class="block text-sm font-semibold text-slate-800">' + label + '</span>' + (hint ? '<span class="block text-xs text-slate-600 mt-0.5">' + hint + '</span>' : '') + '</span></label>'; }
  function val(api, name) { var r = api.el.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }
  function shiftOptions(c, sel, withDefaultLabel) { return (S3.SHIFTS[c] || []).map(function (s) { var i = SHIFT_INFO[s.id] || {}; return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name + ' (' + i.start + ' to ' + i.end + ', ' + i.hours + ' h)') + (withDefaultLabel === s.id ? ' · ' + esc(withDefaultLabel === 'x' ? '' : 'default') : '') + '</option>'; }).join(''); }
  function errText(id, msg) { var el = document.getElementById(id); if (el) { el.textContent = msg || ''; el.style.display = msg ? '' : 'none'; } }
  // The day entry: one status per day (TS-014), the absence modal (K28: optional comment, no reason code), the role-change selector.
  S4.dayDialog = function (x, y, can, onDone, o) {
    o = o || {}; var b = S3.booking(x.bookingId), cur = y.dayStatus || (y.future ? 'Not Booked' : 'Worked'), assigned = x.jobRoleTitle;
    var opts = STATUSES.map(function (s) { var dis = y.future && s !== 'Not Booked'; return radio('d-st', s, ui.chip(s), cur === s, dis ? 'Can be entered from ' + fmtDay(y.date) + ' on.' : null, dis); }).join('');
    var dv = function (s) { return derivePay(b, y.date, s); };
    var ovBtn = '';
    
    var body = '<p class="text-sm text-slate-600 mt-1">' + esc(x.candidateName) + ' · ' + esc(x.bookingReference) + ' · ' + esc(assigned) + '</p>' + (y.future ? ui3.banner('info', fmtDay(y.date) + ' is in the future, so it can only be Not Booked.') : '') +
      '<fieldset class="mt-3"><legend class="' + C.label + '">Day status</legend><div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' + opts + '</div></fieldset>' +
      '<div id="d-worked" class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label for="d-h" class="' + C.label + '">Hours <span class="text-red-700">*</span></label><input id="d-h" type="number" inputmode="decimal" min="0.25" max="24" step="0.25" class="' + C.input + ' tnum" value="' + esc(y.hours || '') + '"/><p id="d-h-err" class="text-xs font-medium text-red-700 mt-1" style="display:none" role="alert"></p></div>' +
      '<div><label for="d-sh" class="' + C.label + '">Shift</label><select id="d-sh" class="' + C.input + '"><option value="">By default (' + esc(S3.shiftName(b.clientId, shiftDefaultFor(rawT(x.id), b, y.date, rawT(x.id).days))) + ')</option>' + shiftOptions(b.clientId, y.dayStatus === 'Worked' && !y.shiftDefaulted ? y.shiftId : null) + '</select><p class="text-xs text-slate-500 mt-1">Left by default, the Shift is the last one worked earlier this week, else the client’s default Shift.</p></div>' +
      '<div class="sm:col-span-2 rounded-lg border border-slate-200 p-3"><p class="text-xs font-semibold text-slate-700">Job role</p><div class="flex flex-wrap items-center gap-2 mt-1.5"><span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm"><i class="fa-solid fa-lock text-[10px] text-slate-400" aria-hidden="true"></i>' + esc(y.coveredJobRoleTitle ? y.coveredJobRoleTitle + ' (covered)' : assigned + ' (assigned)') + '</span>' + (can.changeRole && y.dayStatus === 'Worked' ? '<button type="button" id="d-cr" class="' + C.sec + '"><i class="fa-solid fa-right-left" aria-hidden="true"></i> Change role</button>' + (y.coveredJobRoleId ? '<button type="button" id="d-reset" class="' + C.ghost + '">Reset to ' + esc(assigned) + '</button>' : '') : '') + '</div>' + (can.changeRole && y.dayStatus !== 'Worked' ? '<p class="text-xs text-slate-500 mt-1.5">Save the day as Worked first, then change the role.</p>' : '') + '<div id="d-cover" class="mt-2"></div></div></div>' +
      '<div id="d-abs" class="mt-4 flex flex-col gap-3"><div id="d-pay"></div><div id="d-pshift"></div><div><label for="d-c" class="' + C.label + '">Comment <span class="font-normal text-slate-500">(optional)</span></label><textarea id="d-c" rows="2" maxlength="600" class="' + C.input + '" placeholder="Anything the site wants to note" aria-describedby="d-ch">' + esc(y.absenceComment || '') + '</textarea><p id="d-ch" class="text-xs text-slate-600 mt-1"><i class="fa-solid fa-circle-info text-slate-400" aria-hidden="true"></i> Don’t record medical details.</p><p class="text-xs text-slate-500 mt-0.5"><span id="d-cn">' + (y.absenceComment || '').length + '</span> / 500</p><p id="d-c-err" class="text-xs font-medium text-red-700 mt-1" style="display:none" role="alert"></p></div>' + ovBtn + '</div>';
    var foot = (y.stored && x.status === 'Draft' ? '<button type="button" class="s1-btn" id="d-clear" style="margin-right:auto">Clear the day</button>' : '') + '<button type="button" class="s1-btn" data-x>Cancel</button><button type="button" class="s1-btn s1-btn-primary" data-ok>Save day</button>';
    var api = scrim(esc(fmtDay(y.date)), body, foot, 560), coverPick = null;
    function paint() {
      var st = val(api, 'd-st');
      api.q('#d-worked').style.display = st === 'Worked' ? '' : 'none';
      var abs = ['Sick Leave', 'Holiday', 'No-show'].indexOf(st) >= 0; api.q('#d-abs').style.display = abs ? '' : 'none';
      if (abs) {
        var v = y.dayStatus === st && y.absencePayOverride ? { value: y.absencePayOverride.value, why: 'Overridden by ' + actor(y.absencePayOverride.by) + ': ' + y.absencePayOverride.reason } : dv(st);
        api.q('#d-pay').innerHTML = '<p class="' + C.label + '">Pay impact</p><div class="flex items-start gap-2"><span class="px-2 py-0.5 rounded-full text-xs font-semibold border ' + (v.value === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200') + '">' + v.value + '</span><p class="text-xs text-slate-600">' + esc(v.why) + (ABS ? '' : ' Abstract can override it.') + '</p></div>';
        api.q('#d-pshift').innerHTML = v.value === 'Paid' ? '<label for="d-ps" class="' + C.label + '">Paid hours come from</label><select id="d-ps" class="' + C.input + '"><option value="">The booking’s Shift: ' + esc(b.shiftName + ' (' + SHIFT_INFO[b.shiftId].hours + ' h)') + ' · default</option>' + shiftOptions(b.clientId, y.dayStatus === st && !y.shiftDefaulted ? y.shiftId : null) + '</select><p class="text-xs text-slate-500 mt-1">A paid day off is paid at the Shift the worker was booked for, unless you pick another.</p>' : '';
      }
    }
    api.el.querySelectorAll('input[name="d-st"]').forEach(function (r) { r.onchange = paint; }); paint();
    var c = api.q('#d-c'); c.oninput = function () { api.q('#d-cn').textContent = c.value.length; };
    var crb = api.q('#d-cr'); if (crb) crb.onclick = function () {
      var list = S4.coverOptions(x.id, y.date);
      api.q('#d-cover').innerHTML = '<p class="text-xs text-slate-600 mb-1.5">Only the job role and Shift pairs with a rate on ' + fmtDay(y.date) + '. An unmet client check is shown and never blocks.</p><div class="flex flex-col gap-1.5 max-h-56 overflow-y-auto">' + list.map(function (op, i) { return radio('d-co', op.jobRoleId + '|' + op.shiftId, esc(op.jobRoleTitle) + ' · ' + esc(op.shiftName) + (op.assigned ? ' <span class="text-xs font-normal text-slate-500">(assigned role)</span>' : ''), op.jobRoleId === (y.coveredJobRoleId || '') && op.shiftId === y.shiftId, op.complianceException ? '<span class="text-amber-800"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Not met: ' + esc(op.unmetChecks.join(', ')) + '</span>' : 'Every client check met'); }).join('') + '</div>';
      coverPick = true;
    };
    var rs = api.q('#d-reset'); if (rs) rs.onclick = function () { try { S4.act.cover(x.id, y.date, null, null); api.close(); S1.toast('Back to the assigned role.', 'success'); onDone(); } catch (e) { if (!e.code) throw e; api.banner('error', esc(e.message)); } };
    var ov = api.q('#d-ov'); if (ov) ov.onclick = function () { api.close(); S4.overrideDialog(x, y, onDone); };
    var cl = api.q('#d-clear'); if (cl) cl.onclick = function () { try { S4.act.setDays(x.id, [{ date: y.date, dayStatus: null }]); api.close(); S1.toast(fmtDay(y.date) + ' cleared.', 'success'); onDone(); } catch (e) { if (!e.code) throw e; api.banner('error', esc(e.message)); } };
    api.q('[data-ok]').onclick = function () {
      var st = val(api, 'd-st'), inp = { date: y.date, dayStatus: st };
      errText('d-h-err'); errText('d-c-err');
      if (st === 'Worked') { inp.hours = api.q('#d-h').value.trim(); inp.shiftId = api.q('#d-sh').value || undefined; if (o.forceInvalid) inp.hours = '25'; }
      if (['Sick Leave', 'Holiday', 'No-show'].indexOf(st) >= 0) { inp.absenceComment = api.q('#d-c').value.trim() || null; var ps = api.q('#d-ps'); if (ps && ps.value) inp.shiftId = ps.value; }
      try {
        var r = S4.act.setDays(x.id, [inp], { stamp: o.conflict ? 'stale' : x.updatedAt });
        var pick = coverPick && api.el.querySelector('input[name="d-co"]:checked');
        if (pick && st === 'Worked') { var pr = pick.value.split('|'); S4.act.cover(x.id, y.date, pr[0], pr[1]); }
        api.close(); S1.toast(fmtDay(y.date) + ' saved.' + (r.newlyPending.length ? ' It waits for manual pricing: no rate on the card.' : ''), r.newlyPending.length ? 'info' : 'success'); onDone();
      } catch (e) {
        if (!e.code) throw e;
        if (e.code === 'VALIDATION_ERROR' && e.data.fields) { var m = e.data.fields[y.date]; if (st === 'Worked') { errText('d-h-err', m); api.q('#d-h').classList.add('border-red-400'); api.q('#d-h').setAttribute('aria-invalid', 'true'); api.q('#d-h').focus(); } else errText('d-c-err', m); return; }
        // a 412 refetches the row and re-applies the pending edit once (TSD §4.5)
        if (e.code === 'TIMESHEET_VERSION_CONFLICT') { try { S4.act.setDays(x.id, [inp]); api.close(); onDone({ conflict: y.date }); } catch (e2) { if (!e2.code) throw e2; api.banner('error', 'This week was changed elsewhere and your edit couldn’t be re-applied: ' + esc(e2.message)); } return; }
        api.banner('error', esc(e.message));
      }
    };
    if (o.forceInvalid) setTimeout(function () { api.q('[data-ok]').click(); }, 30);
    return api;
  };
  
  // A reason, 1–1,000 characters (return, reopen).
  S4.reasonDialog = function (o) {
    var body = '<p class="text-sm text-slate-600 mt-1">' + o.body + '</p><div class="mt-3"><label for="rs-r" class="' + C.label + '">Reason <span class="text-red-700">*</span></label><textarea id="rs-r" rows="3" class="' + C.input + '"></textarea><p class="text-xs text-slate-500 mt-1"><span id="rs-n">0</span> / 1,000</p><p id="rs-r-err" class="text-xs font-medium text-red-700 mt-1" style="display:none" role="alert"></p></div>';
    var api = scrim(esc(o.title), body, '<button type="button" class="s1-btn" data-x>Cancel</button><button type="button" class="s1-btn ' + (o.danger ? 's1-btn-danger' : 's1-btn-primary') + '" data-ok>' + esc(o.cta) + '</button>', 480);
    var r = api.q('#rs-r'); r.oninput = function () { api.q('#rs-n').textContent = r.value.length.toLocaleString('en-GB'); };
    if (o.prefill) { r.value = o.prefill; r.oninput(); }
    api.q('[data-ok]').onclick = function () {
      var v = r.value.trim(); errText('rs-r-err');
      if (!v) { errText('rs-r-err', 'Enter a reason.'); r.classList.add('border-red-400'); r.setAttribute('aria-invalid', 'true'); r.focus(); return; }
      if (v.length > 1000) { errText('rs-r-err', 'Keep the reason to 1,000 characters (' + v.length.toLocaleString('en-GB') + ' now).'); r.classList.add('border-red-400'); r.setAttribute('aria-invalid', 'true'); r.focus(); return; }
      try { o.onOk(v); api.close(); } catch (e) { if (!e.code) throw e; api.banner('error', esc(e.message)); }
    };
    if (o.validate) setTimeout(function () { api.q('[data-ok]').click(); }, 30);
    return api;
  };
  // A6 as ruled: Fill → a preview, nothing saved; Save → a confirm pop-up; only the confirm writes.
  S4.fillDialog = function (ids, clientId, onPreview, o) {
    o = o || {}; var mode = o.mode || 'pattern';
    var body = '<p class="text-sm text-slate-600 mt-1">' + ids.length + ' row' + (ids.length === 1 ? '' : 's') + ' selected. Fill shows what would be written on the grid; nothing is saved until you save and confirm.</p>' +
      '<fieldset class="mt-3"><legend class="' + C.label + '">What to fill</legend><div class="grid gap-2">' + radio('f-m', 'pattern', 'Fill week from a shift pattern', mode === 'pattern', 'The pattern’s days at the Shift you choose; the other booked days Not Booked.') + radio('f-m', 'all_days', 'Fill all days', mode === 'all_days', 'Every booked day up to today at the Shift you choose.') + radio('f-m', 'copy_previous', 'Copy previous week', mode === 'copy_previous', 'Each booking’s last week, day for day.') + '</div></fieldset>' +
      '<div id="f-pat" class="mt-3"><label for="f-p" class="' + C.label + '">Shift pattern <span class="text-red-700">*</span></label><select id="f-p" class="' + C.input + '"><option value="">Choose a shift pattern</option>' + PATTERNS.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') + '</select><p id="f-p-err" class="text-xs font-medium text-red-700 mt-1" style="display:none" role="alert"></p></div>' +
      '<div id="f-sh" class="mt-3"><label for="f-s" class="' + C.label + '">Shift <span class="text-red-700">*</span></label><select id="f-s" class="' + C.input + '"><option value="">Choose the Shift</option>' + shiftOptions(clientId, null) + '</select><p id="f-s-err" class="text-xs font-medium text-red-700 mt-1" style="display:none" role="alert"></p></div>' +
      '<label class="mt-3 flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200"><input type="checkbox" id="f-ow" class="mt-0.5"/><span><span class="block text-sm font-semibold text-slate-800">Overwrite</span><span class="block text-xs text-slate-600">Also replace days already entered. Off, only empty days are filled.</span></span></label>';
    var api = scrim('Fill', body, '<button type="button" class="s1-btn" data-x>Cancel</button><button type="button" class="s1-btn s1-btn-primary" data-ok>Fill</button>', 520);
    function paint() { var m = val(api, 'f-m'); api.q('#f-pat').style.display = m === 'pattern' ? '' : 'none'; api.q('#f-sh').style.display = m === 'copy_previous' ? 'none' : ''; }
    api.el.querySelectorAll('input[name="f-m"]').forEach(function (r) { r.onchange = paint; }); paint();
    if (o.prefill) { api.q('#f-p').value = o.prefill.pattern || ''; api.q('#f-s').value = o.prefill.shift || ''; }
    api.q('[data-ok]').onclick = function () {
      var req = { timesheetIds: ids, mode: val(api, 'f-m'), shiftPatternId: api.q('#f-p').value || null, shiftId: api.q('#f-s').value || null, overwrite: api.q('#f-ow').checked, preview: true };
      errText('f-p-err'); errText('f-s-err');
      try { var res = S4.act.bulkFill(req); api.close(); onPreview(req, res); }
      catch (e) { if (!e.code) throw e; if (e.data.fields) { if (e.data.fields.shiftId) errText('f-s-err', e.data.fields.shiftId); if (e.data.fields.shiftPatternId) errText('f-p-err', e.data.fields.shiftPatternId); return; } api.banner('error', esc(e.message)); }
    };
    if (o.validate) setTimeout(function () { api.q('[data-ok]').click(); }, 30);
    return api;
  };
  S4.bulkDayDialog = function (ids, ws, clientId, onDone) {
    var body = '<p class="text-sm text-slate-600 mt-1">One day set on ' + ids.length + ' selected row' + (ids.length === 1 ? '' : 's') + '. Preview shows it on the grid; nothing is saved until you save and confirm. A row that can’t take it says why.</p><div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3"><div><label for="bd-d" class="' + C.label + '">Day</label><select id="bd-d" class="' + C.input + '">' + weekDates(ws).map(function (x) { return '<option value="' + x + '"' + (x === TODAY ? ' selected' : '') + '>' + fmtDay(x) + (x > TODAY ? ' (future)' : '') + '</option>'; }).join('') + '</select></div><div><label for="bd-s" class="' + C.label + '">Day status</label><select id="bd-s" class="' + C.input + '">' + STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div><div id="bd-w1"><label for="bd-h" class="' + C.label + '">Hours</label><input id="bd-h" type="number" step="0.25" class="' + C.input + '" value="8.00"/></div><div id="bd-w2"><label for="bd-sh" class="' + C.label + '">Shift</label><select id="bd-sh" class="' + C.input + '"><option value="">By default</option>' + shiftOptions(clientId, null) + '</select></div></div>';
    var api = scrim('Mark a day', body, '<button type="button" class="s1-btn" data-x>Cancel</button><button type="button" class="s1-btn s1-btn-primary" data-ok>Preview</button>', 480);
    var s = api.q('#bd-s'); s.onchange = function () { api.q('#bd-w1').style.display = api.q('#bd-w2').style.display = s.value === 'Worked' ? '' : 'none'; }; s.onchange();
    api.q('[data-ok]').onclick = function () { var req = { timesheetIds: ids, date: api.q('#bd-d').value, dayStatus: s.value, hours: api.q('#bd-h').value, shiftId: api.q('#bd-sh').value || undefined, preview: true }; try { var res = S4.act.bulkDay(req); api.close(); onDone(req, res); } catch (e) { if (!e.code) throw e; api.banner('error', esc(e.message)); } };
    return api;
  };

  // ---------- the financial summary (C7): what each reader may see of the week's figures ----------
  ui.summary = function (rows, o) {
    o = o || {}; var mixed = rows.some(function (x) { return x.mixedRate; }), pending = rows.some(function (x) { return x.held; });
    var hb = { standard: 0, overtime: 0, weekend: 0, bank_holiday: 0 }; rows.forEach(function (x) { Object.keys(hb).forEach(function (k) { hb[k] += H(x.totals.hoursByType[k] || '0'); }); });
    var sum = function (k) { if (pending) return null; return M(rows.reduce(function (m, x) { return m + P(x.totals[k] || '0'); }, 0)); };
    var rate = null; if (o.single && !mixed) { var r1 = rows[0].days.filter(function (y) { return y.lines.length && y.dayStatus === 'Worked'; })[0]; if (r1) { var std = r1.lines.filter(function (l) { return l.hourType === 'standard'; })[0] || r1.lines[0]; rate = Number(std.chargeRate) / Number(std.multiplier); } }
    var line = function (label, v, strong, note) { return '<div class="flex items-baseline justify-between gap-3 py-1.5' + (strong ? ' border-t border-slate-200 mt-1 pt-2' : '') + '"><dt class="text-sm ' + (strong ? 'font-semibold text-slate-900' : 'text-slate-600') + '">' + label + (note ? ' <span class="text-xs text-slate-500">' + note + '</span>' : '') + '</dt><dd class="text-sm tnum ' + (strong ? 'font-bold text-slate-900' : 'text-slate-800') + '">' + (v == null ? '—' : S3.money(v)) + '</dd></div>'; };
    var h = '<section class="' + C.card + ' p-5" aria-labelledby="fs-t"><div class="flex flex-wrap items-center justify-between gap-2"><h2 id="fs-t" class="text-sm font-bold text-slate-900">' + esc(o.title || 'Week totals') + '</h2>' + (mixed ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-purple-50 text-[#5B2E91] border-purple-200"><i class="fa-solid fa-right-left text-[9px]" aria-hidden="true"></i>Mixed · role change</span>' : '') + '</div>' +
      (pending ? '<div class="mt-3">' + ui3.banner('warning', 'Totals read “—” while a day waits for manual pricing. A total that leaves out an unpriced day would misstate the week.') + '</div>' : '') +
      '<dl class="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">' + Object.keys(hb).map(function (k) { return '<div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2"><dt class="text-[11px] font-medium text-slate-500">' + HOUR_TYPE[k] + ' hours</dt><dd class="text-base font-bold text-slate-900 tnum">' + hrs(hb[k]) + '</dd></div>'; }).join('') + '</dl>' +
      '<dl class="mt-3">' + (o.single ? '<div class="flex items-baseline justify-between gap-3 py-1.5"><dt class="text-sm text-slate-600">Charge rate</dt><dd class="text-sm text-slate-800">' + (mixed ? '<span class="font-semibold text-[#5B2E91]">Mixed · role change</span>' : rate ? '<span class="tnum">' + S3.money(rate.toFixed(2)) + '</span> per hour, standard' : '—') + '</dd></div>' : '') + line('Client cost', sum('clientCost'), !ABS || o.nobreakdown, 'at charge rates');
    
    h += '</dl>';
    
    h += '</section>';
    return h;
  };

  // ---------- the week grid page (4.5; Abstract renders it for one client, 4.6) ----------
  S4.weekGridPage = function (host, p) {
    var st = p.state, ws = p.weekStart, clientId = p.clientId, sel = {}, preview = null, conflictMsg = null, results = null, pageNo = 1;
    var can = { edit: st !== 'readonly', submit: st !== 'readonly', changeRole: st !== 'readonly' && st !== 'nochangerole', overrideAbsence: ABS && st !== 'readonly', priceManually: ABS && st !== 'nobreakdown' && st !== 'readonly', approve: ABS && st !== 'readonly' };
    var ensured = [];
    function load() {
      var wk = S4.week(clientId, ws);
      // the bookings of the week with no timesheet yet are ensured on open (4.5 TV-1)
      if (can.edit && wk.pendingBookings.length) { wk.pendingBookings.forEach(function (pb) { S4.act.ensure(pb.bookingId, ws); ensured.push(pb.candidateName); }); wk = S4.week(clientId, ws); }
      return wk.items;
    }
    function synth() {
      var src0 = S4.week(clientId, ws).items, out = [];
      var names = ['Amara Okoye', 'Ben Carter', 'Chloe Price', 'Dawid Lis', 'Elif Kaya', 'Femi Bello', 'Grace Lin', 'Harry Moss', 'Ines Silva', 'Jack Reid', 'Kasia Nowak', 'Liam Ward'];
      for (var i = 0; i < 120; i++) { var src = src0[i % src0.length]; if (!src) break; var c = JSON.parse(JSON.stringify(src)); c.id = src.id; c.synthetic = true; c.candidateName = names[i % names.length] + ' ' + (i + 1); c.bookingReference = 'BK-' + (3000 + i); out.push(c); }
      return out;
    }
    function draw() {
      if (['loading', 'error', 'denied'].indexOf(st) >= 0) { host.innerHTML = ''; return; }
      var rows = st === 'empty' ? [] : st === 'large' ? synth() : load();
      var title = (p.mode === 'abstract' ? esc(S3.CLIENTS[clientId].name) + ' · ' : '') + 'Week of ' + fmtWeek(ws);
      var weeks = []; for (var i = -3; i <= 1; i++) weeks.push(addDays(CURRENT_WEEK, i * 7));
      var picker = '<div class="flex items-center gap-2"><a class="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:border-blue-300" aria-label="Previous week" href="' + p.href(addDays(ws, -7)) + '"><i class="fa-solid fa-chevron-left text-xs" aria-hidden="true"></i></a><label class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 min-h-[38px]"><i class="fa-regular fa-calendar text-slate-400 text-xs" aria-hidden="true"></i><span class="sr-only">Week</span><select id="g-wk" class="bg-transparent text-xs font-semibold text-slate-700 outline-none">' + weeks.map(function (w) { return '<option value="' + w + '"' + (w === ws ? ' selected' : '') + '>Week of ' + fmtWeek(w) + (w === CURRENT_WEEK ? ' (this week)' : '') + '</option>'; }).join('') + '</select></label><a class="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:border-blue-300" aria-label="Next week" href="' + p.href(addDays(ws, 7)) + '"><i class="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i></a></div>';
      var selIds = Object.keys(sel).filter(function (k) { return sel[k]; }), n = selIds.length;
      var bulk = can.edit && rows.length ? '<div class="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Actions on the selected rows"><span class="text-xs font-semibold text-slate-600 mr-1">' + (n ? n + ' selected' : 'Select rows to fill or mark') + '</span><button type="button" data-bulk="pattern" class="' + C.sec + '"' + (n ? '' : ' disabled style="opacity:.5"') + '><i class="fa-solid fa-calendar-week" aria-hidden="true"></i> Fill week</button><button type="button" data-bulk="all_days" class="' + C.sec + '"' + (n ? '' : ' disabled style="opacity:.5"') + '>Fill all days</button><button type="button" data-bulk="copy_previous" class="' + C.sec + '"' + (n ? '' : ' disabled style="opacity:.5"') + '><i class="fa-regular fa-copy" aria-hidden="true"></i> Copy previous week</button><button type="button" data-bulk="day" class="' + C.sec + '"' + (n ? '' : ' disabled style="opacity:.5"') + '>Mark a day</button></div>' : '';
      var banners = '';
      if (p.mode === 'abstract') banners += ui3.banner('info', '<strong>Editing on the client’s behalf</strong> — changes are audited to you.');
      if (ensured.length) banners += ui3.banner('info', 'Opened this week for ' + esc(ensured.join(', ')) + ': the booking had no timesheet yet.');
      if (conflictMsg) banners += ui3.banner(conflictMsg.tone, conflictMsg.html);
      if (st === 'readonly') banners += ui3.banner('info', 'You can view this week. Entering days needs the permission to edit timesheets.');
      var prevBlock = '';
      if (preview) {
        var res = preview.results;
        prevBlock = '<section class="' + C.card + ' p-5 border-blue-300" aria-labelledby="pv-t" style="border-color:#93c5fd"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 id="pv-t" class="text-sm font-bold text-slate-900">Preview: ' + (preview.kind === 'day' ? 'mark ' + esc(fmtDay(preview.req.date)) + ' ' + esc(preview.req.dayStatus) : esc(({ pattern: 'fill week from a shift pattern', all_days: 'fill all days', copy_previous: 'copy previous week' })[preview.req.mode]) + (preview.req.overwrite ? ', overwriting' : ', empty days only')) + '</h2><p class="text-xs text-slate-600 mt-0.5">Nothing is saved yet. The grid shows the days that would be written, outlined and marked unsaved; the previewed rows are read-only until you save or cancel.</p></div><div class="flex gap-2"><button type="button" id="pv-x" class="' + C.sec + '">Cancel</button><button type="button" id="pv-save" class="' + C.pri + '" style="' + C.priStyle + '"' + (res.some(function (r) { return r.outcome === 'filled'; }) ? '' : ' disabled') + '>Save…</button></div></div>' + outcomeList(res) + '</section>';
      } else if (results) prevBlock = '<section class="' + C.card + ' p-5" aria-labelledby="rs-t"><div class="flex flex-wrap items-start justify-between gap-3"><h2 id="rs-t" class="text-sm font-bold text-slate-900">' + esc(results.title) + '</h2><div class="flex gap-2">' + (results.again ? '<button type="button" id="rs-again" class="' + C.sec + '"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Preview again for the changed week' + (results.again.ids.length === 1 ? '' : 's') + '</button>' : '') + '<button type="button" id="rs-x" class="' + C.ghost + '">Close</button></div></div>' + outcomeList(results.res) + '</section>';
      var PAGE = 100, pages = Math.ceil(rows.length / PAGE) || 1, view = rows.slice((pageNo - 1) * PAGE, pageNo * PAGE), rendered = view.slice(0, st === 'large' ? 50 : view.length);
      var grid = rows.length ? '<div class="' + C.card + ' overflow-hidden"><div class="relative overflow-x-auto" id="g-frame"><table role="grid" aria-label="Day statuses for the week of ' + fmtWeek(ws) + '" class="w-full text-left border-separate" style="border-spacing:0;min-width:700px;table-layout:fixed"><colgroup><col style="width:172px">' + weekDates(ws).map(function () { return '<col>'; }).join('') + '<col style="width:66px"></colgroup><thead><tr class="bg-slate-50">' +
        '<th scope="col" class="' + C.th + ' sticky left-0 z-10 bg-slate-50 border-b border-slate-200 !px-3"><span class="flex items-center gap-2">' + (can.edit ? '<input type="checkbox" id="g-all" aria-label="Select every row"' + (n && n === rows.filter(function (r) { return r.status === 'Draft'; }).length ? ' checked' : '') + '/>' : '') + 'Candidate</span></th>' +
        weekDates(ws).map(function (x) { return '<th scope="col" class="' + C.th + ' !px-1 border-b border-slate-200 text-center' + (x === TODAY ? ' text-blue-700' : '') + '">' + fmtDay(x).replace(' ', '<br>') + (x === TODAY ? '<span class="block text-[9px] normal-case tracking-normal">today</span>' : '') + '</th>'; }).join('') +
        '<th scope="col" class="' + C.th + ' !px-2 border-b border-slate-200 text-right">Total</th></tr></thead><tbody>' +
        rendered.map(function (x) { return rowHtml(x); }).join('') + '</tbody></table></div>' +
        (st === 'large' ? '<p class="px-4 py-2 text-xs text-slate-600 border-t border-slate-200 bg-slate-50">' + rendered.length + ' of ' + view.length + ' rows on this page are drawn; the grid renders the rest as you scroll (virtualised past 50 rows).</p>' + ui3.pager(rows.length, pageNo, pages, 'rows') : '') + '</div>'
        : ui3.empty('fa-calendar-xmark', 'No bookings for this week', 'Choose another week. A booking’s week appears here once its dates touch it.', picker);
      host.innerHTML = '<div class="flex flex-col gap-4">' + (p.crumbs ? ui3.crumbs(p.crumbs) : '') +
        '<div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-xl font-bold text-slate-900">' + title + '</h2><p class="text-xs text-slate-600 mt-0.5">' + (rows.length ? rows.length + ' booking' + (rows.length === 1 ? '' : 's') + ' · ' : '') + 'Deadline ' + fmtDeadline(deadlineFor(clientId, ws)) + ' · days outside a booking are locked; future days take Not Booked only</p></div>' + picker + '</div>' +
        banners + prevBlock +
        (rows.length ? '<div class="' + C.card + ' p-3 flex flex-col gap-3">' + ui.legend() + (bulk ? '<div class="border-t border-slate-100 pt-3">' + bulk + '</div>' : '') + '</div>' : '') + grid +
        (rows.length && st !== 'large' ? ui.summary(rows, { nobreakdown: st === 'nobreakdown' }) : '') + '</div>';
      wire(rows);
    }
    function outcomeList(res) {
      var word = { filled: ['Filled', 'text-emerald-700', 'fa-circle-check'], skipped: ['Kept', 'text-slate-600', 'fa-circle-minus'], refused: ['Refused', 'text-red-700', 'fa-circle-xmark'] };
      return '<ul class="mt-3 divide-y divide-slate-100 border border-slate-200 rounded-lg">' + res.map(function (r) { var w = word[r.outcome]; var parts = []; if (r.filled && r.filled.length) parts.push((preview ? 'would fill ' : 'filled ') + r.filled.map(fmtDay).join(', ')); if (r.kept && r.kept.length) parts.push('kept ' + r.kept.map(fmtDay).join(', ') + ' (already entered)'); if (r.future && r.future.length) parts.push('left ' + r.future.map(fmtDay).join(', ') + ' empty (future)'); if (r.replaced) parts.push('replaces the day already entered'); if (r.message && r.outcome !== 'filled') parts.push(r.message); return '<li class="px-3 py-2 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3"><span class="w-24 flex-shrink-0 text-xs font-bold ' + w[1] + ' flex items-center gap-1.5"><i class="fa-solid ' + w[2] + '" aria-hidden="true"></i>' + w[0] + '</span><span class="text-sm text-slate-800 font-semibold min-w-0">' + esc(r.candidateName) + '</span><span class="text-xs text-slate-600 sm:ml-auto sm:text-right">' + esc(parts.join('; ')) + '</span></li>'; }).join('') + '</ul>';
    }
    function rowHtml(x) {
      var pv = preview && preview.byId[x.id] ? preview.byId[x.id].would : null, editable = can.edit && x.status === 'Draft' && !x.synthetic && !(preview && preview.byId[x.id]);   // a previewed row is read-only until it is saved or cancelled
      var link = p.mode === 'abstract' ? 'abstract.timesheets.booking-week.html?id=' + x.id : 'client.timesheets.booking-week.html?id=' + x.id;
      var head = '<th scope="row" class="sticky left-0 z-10 bg-white border-b border-slate-100 px-3 py-2 align-top"><div class="flex items-start gap-2">' + (can.edit ? '<input type="checkbox" data-sel="' + x.id + '" aria-label="Select ' + esc(x.candidateName) + '" class="mt-1"' + (sel[x.id] ? ' checked' : '') + (x.status !== 'Draft' || x.synthetic ? ' disabled title="Only a Draft week can be filled"' : '') + '/>' : '') +
        '<div class="min-w-0"><a href="' + link + '" class="' + C.link + ' text-sm block truncate">' + esc(x.candidateName) + '</a><p class="text-[11px] text-slate-500 truncate">' + esc(x.bookingReference) + ' · ' + esc(x.jobRoleTitle) + '</p><p class="text-[11px] text-slate-500 truncate">' + esc(x.orgNodeName) + '</p><div class="flex flex-wrap gap-1 mt-1">' + ui.badge(x.status, true) + ui.markers(x, true) + '</div>' +
        (x.status === 'Draft' && can.submit && !x.synthetic ? '<div class="flex flex-col items-start gap-0.5 mt-1">' + '<button type="button" data-submit="' + x.id + '" class="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Submit</button>' + (x.unsetDates.length ? '<button type="button" data-rest="' + x.id + '" class="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Mark the rest Not Booked</button>' : '') + '</div>' : '') +
        (ABS && can.approve && x.status === 'Submitted' && !x.synthetic ? '<div class="flex flex-col items-start gap-0.5 mt-1"><button type="button" data-approve="' + x.id + '" class="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Approve</button><button type="button" data-return="' + x.id + '" class="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Return…</button></div>' : '') +
        '</div></div></th>';
      var cells = x.days.map(function (y) { return '<td class="border-b border-slate-100 px-1 py-2 align-top">' + ui.cell(y, { editable: editable, tsId: x.id, preview: pv && pv[y.date] ? pv[y.date] : null, clientId: x.clientId, error: p.errDates && p.errDates[x.id] && p.errDates[x.id].indexOf(y.date) >= 0 }) + '</td>'; }).join('');
      var tot = '<td class="border-b border-slate-100 px-2 py-2 align-top text-right whitespace-nowrap"><span class="block text-sm font-bold text-slate-900 tnum">' + x.workedHours + ' h</span><span class="block text-[11px] text-slate-600 tnum">' + money(x.clientCost) + '</span>' + (x.absenceDays ? '<span class="block text-[11px] text-slate-500">' + x.absenceDays + ' absence' + (x.absenceDays === 1 ? '' : 's') + '</span>' : '') + '</td>';
      return '<tr data-row="' + x.id + '">' + head + cells + tot + '</tr>';
    }
    function wire(rows) {
      var wk = host.querySelector('#g-wk'); if (wk) wk.onchange = function () { location.href = p.href(wk.value); };
      host.querySelectorAll('[data-sel]').forEach(function (c) { c.onchange = function () { sel[c.dataset.sel] = c.checked; draw(); }; });
      var all = host.querySelector('#g-all'); if (all) all.onchange = function () { rows.forEach(function (r) { if (r.status === 'Draft' && !r.synthetic) sel[r.id] = all.checked; }); draw(); };
      host.querySelectorAll('[data-cell]').forEach(function (btn) {
        btn.onclick = function () { var k = btn.dataset.cell.split('|'), x = S4.timesheet(k[0]), y = x.days.filter(function (d2) { return d2.date === k[1]; })[0]; S4.dayDialog(x, y, can, after, { conflict: st === 'conflict' && !p._conflicted }); };
        btn.onkeydown = function (e) {
          var td = btn.closest('td'), tr = btn.closest('tr'), idx = Array.prototype.indexOf.call(tr.children, td), go = null;
          if (e.key === 'ArrowRight') go = td.nextElementSibling; if (e.key === 'ArrowLeft') go = td.previousElementSibling;
          if (e.key === 'ArrowDown' && tr.nextElementSibling) go = tr.nextElementSibling.children[idx]; if (e.key === 'ArrowUp' && tr.previousElementSibling) go = tr.previousElementSibling.children[idx];
          if (go) { var f = go.querySelector('button,[data-cell]'); if (f) { f.focus(); e.preventDefault(); } }
          if (/^[0-9]$/.test(e.key)) { e.preventDefault(); btn.click(); setTimeout(function () { var h = document.getElementById('d-h'); if (h) { h.value = e.key; h.focus(); } }, 20); }
        };
      });
      host.querySelectorAll('[data-bulk]').forEach(function (b) { b.onclick = function () {
        var ids = Object.keys(sel).filter(function (k) { return sel[k]; }); if (!ids.length) return;
        var show = function (kind) { return function (req, res) { var by = {}; res.forEach(function (r) { by[r.timesheetId] = r; }); preview = { kind: kind, req: req, results: res, byId: by }; results = null; draw(); }; };
        if (b.dataset.bulk === 'day') { S4.bulkDayDialog(ids, ws, clientId, show('day')); return; }
        S4.fillDialog(ids, clientId, show('fill'), { mode: b.dataset.bulk });
      }; });
      var px = host.querySelector('#pv-x'); if (px) px.onclick = function () { preview = null; draw(); S1.toast('Preview discarded. Nothing was saved.', 'info'); };
      var ps = host.querySelector('#pv-save'); if (ps) ps.onclick = function () {
        var fill = preview.results.filter(function (r) { return r.outcome === 'filled'; }), nDays = fill.reduce(function (m, r) { return m + r.filled.length; }, 0);
        var isDay = preview.kind === 'day', nRep = isDay ? fill.filter(function (r) { return r.replaced; }).length : 0;
        S1.confirm({ title: isDay ? 'Save this day?' : 'Save the fill?', bodyHtml: esc(nDays + ' day' + (nDays === 1 ? '' : 's') + ' will be written on ' + fill.length + ' week' + (fill.length === 1 ? '' : 's') + '. ' + (isDay ? (nRep ? nRep + ' of them replace a day already entered.' : 'None replaces a day already entered.') : (preview.req.overwrite ? 'Days already entered are replaced.' : 'Days already entered are kept.')) + ' A week changed since your preview is refused and left as it is.'), cta: 'Confirm', onConfirm: function () {
          var stamps = {}; preview.results.forEach(function (r) { stamps[r.timesheetId] = r.updatedAt; });
          if (st === 'stale') { var victim = fill[fill.length - 1]; if (victim) stamps[victim.timesheetId] = 'changed-elsewhere'; }
          var res = (isDay ? S4.act.bulkDay : S4.act.bulkFill)(Object.assign({}, preview.req, { preview: false, stamps: stamps })), refused = res.filter(function (r) { return r.code === 'TIMESHEET_CHANGED_SINCE_PREVIEW'; });
          var again = { kind: preview.kind, req: preview.req, ids: refused.map(function (r) { return r.timesheetId; }) };
          preview = null; results = { title: (isDay ? 'Day saved' : 'Fill saved') + ': per-row outcome', res: res, again: again.ids.length ? again : null }; sel = {}; draw();
          S1.toast(refused.length ? 'Saved, except ' + refused.map(function (r) { return r.candidateName; }).join(', ') + ': changed since your preview — review again.' : 'Fill saved.', refused.length ? 'info' : 'success');
        } });
      };
      var rx = host.querySelector('#rs-x'); if (rx) rx.onclick = function () { results = null; draw(); };
      var ra = host.querySelector('#rs-again'); if (ra) ra.onclick = function () { var a = results.again, req = Object.assign({}, a.req, { timesheetIds: a.ids, preview: true, stamps: null }), res = (a.kind === 'day' ? S4.act.bulkDay : S4.act.bulkFill)(req), by = {}; res.forEach(function (r) { by[r.timesheetId] = r; }); preview = { kind: a.kind, req: req, results: res, byId: by }; results = null; draw(); };
      host.querySelectorAll('[data-submit]').forEach(function (b) { b.onclick = function () { submitFlow(S4.timesheet(b.dataset.submit), after, st); }; });
      host.querySelectorAll('[data-rest]').forEach(function (b) { b.onclick = function () { restFlow(S4.timesheet(b.dataset.rest), after); }; });
      
      host.querySelectorAll('[data-pg]').forEach(function (b) { b.onclick = function () { pageNo = Number(b.dataset.pg); draw(); }; });
    }
    function after(info) {
      if (info && info.conflict) { p._conflicted = true; conflictMsg = { tone: 'warning', html: 'This week was changed elsewhere — your edit was re-applied. Check ' + esc(fmtDay(info.conflict)) + ' and save it again if it isn’t right.' }; }
      draw();
    }
    // prototype states that open with something on screen
    draw();
    if (st === 'preview' || st === 'stale') { var drafts = load().filter(function (x) { return x.status === 'Draft'; }).map(function (x) { return x.id; }); drafts.forEach(function (i2) { sel[i2] = true; }); var req = { timesheetIds: drafts, mode: 'pattern', shiftPatternId: 'sp-wd', shiftId: 'sh-am', overwrite: false, preview: true }; var res0 = S4.act.bulkFill(req), by0 = {}; res0.forEach(function (r) { by0[r.timesheetId] = r; }); preview = { kind: 'fill', req: req, results: res0, byId: by0 }; draw(); if (st === 'stale') setTimeout(function () { var s = host.querySelector('#pv-save'); if (s) s.click(); }, 60); }
    if (st === 'validation') { var x0 = load().filter(function (x) { return x.status === 'Draft' && x.days.some(function (y) { return y.inRange && !y.future; }); })[0]; if (x0) { var y0 = x0.days.filter(function (y) { return y.inRange && !y.future; })[0]; S4.dayDialog(x0, y0, can, after, { forceInvalid: true }); } }
    if (st === 'held') { var h0 = load().filter(function (x) { return x.held && x.status === 'Draft'; })[0]; if (h0) submitFlow(h0, after, st); }
    if (st === 'incomplete') { var i0 = load().filter(function (x) { return x.status === 'Draft' && x.unsetDates.length && !x.held; })[0]; if (i0) submitFlow(i0, after, st); }
    if (st === 'conflict') conflictMsg = null;
    return { redraw: draw };
  };
  // Submit, with the refusals as the rulings word them.
  function submitFlow(x, after) {
    try {
      var r = S4.act.submit(x.id);
      S1.toast(r.status === 'Approved' ? esc(x.candidateName) + ': submitted and approved. Weeks at ' + esc(x.orgNodeName) + ' are approved automatically.' : esc(x.candidateName) + ': submitted. Abstract approves it or returns it with a reason.' + (r.submittedLate ? ' Marked late: the deadline had passed.' : ''), 'success'); after();
    } catch (e) {
      if (!e.code) throw e;
      if (e.code === 'TIMESHEET_DAYS_INCOMPLETE') {
        S1.confirm({ title: 'Every booked day needs a status', bodyHtml: esc(x.candidateName) + '’s week can’t be submitted yet. Not set: <strong>' + e.data.dates.map(fmtDay).join(', ') + '</strong>. Set them, or mark the rest Not Booked and submit again.', cta: 'Mark the rest Not Booked', cancel: 'Set them myself', tone: 'warning', icon: 'fa-calendar-xmark', onConfirm: function () { S4.act.markRest(x.id); S1.toast('The rest marked Not Booked. Submit when ready.', 'success'); after(); } });
        return;
      }
      if (e.code === 'TIMESHEET_WEEK_HELD') {
        var dates = e.data.reasons[0].dates.map(fmtDay).join(', ');
        S1.confirm({ title: 'This week is held', bodyHtml: esc(x.candidateName) + '’s week can’t be submitted while a day waits for manual pricing: <strong>' + dates + '</strong>. ' + (ABS ? 'Price it from the <a href="abstract.timesheets.pending-pricing.html" style="color:#1d4ed8;font-weight:600">Pending pricing</a> queue.' : 'Abstract has been told and prices it by hand; you’ll be able to submit once it has.'), hideCancel: false, cancel: 'Close', tone: 'warning', icon: 'fa-hourglass-half' });
        return;
      }
      S1.toast(esc(e.message), 'error');
    }
  }
  function restFlow(x, after) {
    S1.confirm({ title: 'Mark the rest Not Booked?', bodyHtml: 'These booked days have no status yet and become Not Booked: <strong>' + x.unsetDates.map(fmtDay).join(', ') + '</strong>.', cta: 'Mark Not Booked', onConfirm: function () { S4.act.markRest(x.id); S1.toast('Marked Not Booked.', 'success'); after(); } });
  }
  
  S4.submitFlow = submitFlow; S4.restFlow = restFlow;

  // ---------- one booking-week ----------
  S4.bookingWeekPage = function (host, p) {
    var st = p.state, id = p.id, conflictMsg = null;
    var can = { edit: st !== 'readonly' && st !== 'noapprove', submit: st !== 'readonly' && st !== 'noapprove', changeRole: st !== 'readonly' && st !== 'noapprove', overrideAbsence: ABS && st !== 'readonly' && st !== 'noapprove', approve: ABS && st !== 'noapprove' && st !== 'readonly' };
    if (st === 'noapprove') can = { edit: false, submit: false, changeRole: false, overrideAbsence: false, approve: false };
    function draw() {
      if (['loading', 'error', 'denied'].indexOf(st) >= 0) { host.innerHTML = ''; return; }
      var x = st === 'empty' ? S4.blankTimesheet(id) : S4.timesheet(id);
      if (!x) { host.innerHTML = ui3.empty('fa-magnifying-glass', 'We can’t find that week', 'It may belong to another client, or the link is wrong.'); return; }
      document.getElementById('page-title').textContent = x.candidateName + ' · week of ' + fmtWeek(x.weekStart);
      var editable = can.edit && x.status === 'Draft' && !x.blank;
      var act = '';
      if (x.blank) { host.innerHTML = '<div class="flex flex-col gap-4">' + ui3.crumbs(p.crumbs(x)) + ui3.banner('info', 'Nothing is entered for this week yet. Each booked day is blank until someone sets it; days outside the booking are locked as Not Booked.') + '<div class="' + C.card + ' overflow-hidden"><div class="p-3 border-b border-slate-100">' + ui.legend() + '</div><div class="relative overflow-x-auto"><table role="grid" aria-label="Days of the week" class="w-full border-separate" style="border-spacing:0;min-width:560px;table-layout:fixed"><thead><tr class="bg-slate-50">' + x.days.map(function (y) { return '<th scope="col" class="' + C.th + ' !px-1 text-center border-b border-slate-200">' + fmtDay(y.date) + '</th>'; }).join('') + '</tr></thead><tbody><tr>' + x.days.map(function (y) { return '<td class="px-1 py-2 align-top">' + ui.cell(y, {}) + '</td>'; }).join('') + '</tr></tbody></table></div></div>' + ui.summary([x], { single: true, title: 'This week' }) + '</div>'; return; }
      if (x.status === 'Draft' && can.submit) act += (x.unsetDates.length ? '<button type="button" id="w-rest" class="' + C.sec + '">Mark the rest Not Booked</button>' : '') + '<button type="button" id="w-submit" class="' + C.pri + '" style="' + C.priStyle + '">Submit</button>';
      
      var info = [];
      if (x.status === 'Draft' && x.returnReason) info.push(ui3.banner('warning', '<strong>' + (x.returnKind === 'reopen' ? 'Reopened' : 'Returned to Draft') + '</strong> by ' + esc(actor(x.returnedBy)) + ' on ' + S3.fmtDateTime(x.returnedAt) + '. Reason: ' + esc(x.returnReason)));
      if (x.status === 'Submitted') info.push(ui3.banner('info', 'Submitted by ' + esc(actor(x.submittedBy)) + ' on ' + S3.fmtDateTime(x.submittedAt) + (x.submittedLate ? ', after the deadline' : '') + '. ' + (ABS ? 'Waiting for your approval: approve it, or return it to Draft with a reason.' : 'Abstract approves it, or returns it to Draft with a reason.')));
      if (x.status === 'Approved') info.push(ui3.banner('success', (x.approvalMode === 'automatic' ? 'Approved automatically when ' + esc(actor(x.submittedBy)) + ' submitted it' : 'Approved by ' + esc(actor(x.approvedBy))) + ' on ' + S3.fmtDateTime(x.approvedAt) + '.' + (ABS ? ' It can be reopened, with a reason, until it is invoiced.' : '')));
      if (x.held) info.push(ui3.banner('warning', '<strong>Held.</strong> ' + x.days.filter(function (y) { return y.pricingState === 'pending manual pricing'; }).map(function (y) { return fmtDay(y.date); }).join(' and ') + ' wait' + (x.pendingPricingDays === 1 ? 's' : '') + ' for manual pricing: no rate on the card. The week can’t be submitted or approved until Abstract prices ' + (x.pendingPricingDays === 1 ? 'it' : 'them') + '.' + (ABS ? ' <a class="' + C.link + '" href="abstract.timesheets.pending-pricing.html">Open Pending pricing</a>' : '')));
      if (x.overdue) info.push(ui3.banner('error', 'The deadline, ' + fmtDeadline(x.submissionDeadline) + ', has passed. The week stays open: it can still be submitted, and will be marked late.'));
      if (ABS) info.unshift(ui3.banner('info', '<strong>Editing on the client’s behalf</strong> — changes are audited to you.'));
      if (st === 'readonly') info.push(ui3.banner('info', 'You can view this week. Entering days needs the permission to edit timesheets.'));
      if (conflictMsg) info.push(ui3.banner('warning', conflictMsg));
      var head = '<div class="' + C.card + ' p-5"><div class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2">' + ui.badge(x.status) + ui.markers(x) + (x.enteredOnBehalf && ABS ? ui3.marker('Entered by Abstract', 'info') : '') + '</div><h2 class="text-xl font-bold text-slate-900 mt-1.5">' + esc(x.candidateName) + '</h2><p class="text-sm text-slate-600 mt-0.5"><a class="' + C.link + ' font-medium" href="' + (ABS ? 'abstract' : 'client') + '.bookings.booking-detail.html?id=' + x.bookingId + '">' + esc(x.bookingReference) + '</a> · ' + esc(x.jobRoleTitle) + ' · ' + esc(x.clientName) + ' · ' + esc(x.orgNodePath.join(' › ')) + '</p><p class="text-sm text-slate-600 mt-0.5">Week of ' + fmtWeek(x.weekStart) + ' · deadline ' + fmtDeadline(x.submissionDeadline) + ' · ' + (x.approvalSetting === 'optional' ? 'approved automatically at submission' : 'Abstract approves') + '</p></div><div class="flex flex-wrap gap-2">' + act + '</div></div></div>';
      var row = '<div class="' + C.card + ' overflow-hidden"><div class="p-3 border-b border-slate-100">' + ui.legend() + '</div><div class="relative overflow-x-auto"><table role="grid" aria-label="Days of the week" class="w-full border-separate" style="border-spacing:0;min-width:600px;table-layout:fixed"><thead><tr class="bg-slate-50">' + x.days.map(function (y) { return '<th scope="col" class="' + C.th + ' !px-1 text-center border-b border-slate-200' + (y.date === TODAY ? ' text-blue-700' : '') + '">' + fmtDay(y.date) + '</th>'; }).join('') + '<th scope="col" class="' + C.th + ' text-right border-b border-slate-200">Total</th></tr></thead><tbody><tr data-row="' + x.id + '">' + x.days.map(function (y) { return '<td class="px-1 py-2 align-top">' + ui.cell(y, { editable: editable, tsId: x.id, error: st === 'incomplete' && x.unsetDates.indexOf(y.date) >= 0 }) + '</td>'; }).join('') + '<td class="px-3 py-2 text-right align-top"><span class="block text-sm font-bold tnum">' + x.workedHours + ' h</span><span class="block text-[11px] text-slate-600 tnum">' + money(x.clientCost) + '</span></td></tr></tbody></table></div></div>';
      host.innerHTML = '<div class="flex flex-col gap-4">' + ui3.crumbs(p.crumbs(x)) + info.join('') + head + row + '<div class="grid grid-cols-1 xl:grid-cols-3 gap-4"><div class="xl:col-span-2 flex flex-col gap-4">' + dayTable(x) + '</div><div class="flex flex-col gap-4">' + ui.summary([x], { single: true, nobreakdown: st === 'nobreakdown', title: 'This week' }) + (ABS ? activity(x) : '') + '</div></div></div>';
      wire(x);
    }
    function dayTable(x) {
      var rows = [];
      x.days.forEach(function (y) {
        var one = { y: y };
        if (y.lines.length) y.lines.forEach(function (l, i) { rows.push(Object.assign({ l: l, first: i === 0, n: y.lines.length }, one)); });
        else rows.push(Object.assign({ l: null, first: true, n: 1 }, one));
      });
      var bd = false; 
      var cell = function (r) {
        var y = r.y, notes = [];
        if (y.locked) notes.push('Outside the booking');
        if (y.coveredJobRoleId) notes.push('Covered as ' + y.coveredJobRoleTitle + ' by ' + actor(y.roleChangedBy));
        if (y.complianceException) notes.push('Compliance exception: ' + y.unmetChecks.join(', ') + ' not met');
        if (y.absencePayOverride) notes.push('Pay impact overridden by ' + actor(y.absencePayOverride.by) + ' (derived ' + y.absencePayDerived + '): ' + y.absencePayOverride.reason);
        
        if (y.absenceComment) notes.push('Comment: ' + y.absenceComment);
        if (y.pricingSource === 'manual') notes.push('Priced by hand by ' + actor(y.manualBy) + ': ' + y.manualReason);
        if (y.pricingState === 'pending manual pricing') notes.push('Waiting for manual pricing: no rate on the card');
        return notes;
      };
      var cols = '<th scope="col" class="' + C.th + '">Day</th><th scope="col" class="' + C.th + '">Status</th><th scope="col" class="' + C.th + '">Shift · role</th><th scope="col" class="' + C.th + '">Hour type</th><th scope="col" class="' + C.th + ' text-right">Hours</th><th scope="col" class="' + C.th + ' text-right">Charge rate</th><th scope="col" class="' + C.th + ' text-right">Client cost</th>';
      
      var extra = function () { return ''; };
      
      var body = rows.map(function (r) {
        var y = r.y, l = r.l, notes = r.first ? cell(r) : [];
        return '<tr class="' + (r.first ? 'border-t border-slate-200' : '') + '">' + (r.first ? '<td class="' + C.td + ' whitespace-nowrap align-top" rowspan="' + r.n + '">' + fmtDay(y.date) + '</td><td class="' + C.td + ' align-top" rowspan="' + r.n + '">' + (y.dayStatus ? ui.chip(y.dayStatus) : '<span class="text-slate-500">Not set</span>') + (y.absencePay ? ' <span class="text-xs font-semibold ' + (y.absencePay === 'Paid' ? 'text-emerald-700' : 'text-slate-600') + '">' + y.absencePay + '</span>' : '') + (notes.length ? '<ul class="mt-1 text-[11px] text-slate-600 list-disc pl-4">' + notes.map(function (n2) { return '<li>' + esc(n2) + '</li>'; }).join('') + '</ul>' : '') + '</td><td class="' + C.td + ' align-top" rowspan="' + r.n + '">' + (y.shiftName ? esc(y.shiftName) + (y.shiftDefaulted ? ' <span class="text-xs text-slate-500">· default</span>' : '') + '<span class="block text-xs text-slate-500">' + esc(y.effectiveJobRoleTitle || '') + '</span>' : '<span class="text-slate-500">—</span>') + '</td>' : '') +
          (l ? '<td class="' + C.td + '">' + HOUR_TYPE[l.hourType] + (l.kind === 'absence' ? ' <span class="text-xs text-slate-500">(paid day off)</span>' : '') + '</td><td class="' + C.td + ' text-right tnum">' + l.hours + '</td><td class="' + C.td + ' text-right tnum">' + S3.money(l.chargeRate) + '</td><td class="' + C.td + ' text-right tnum">' + S3.money(l.clientCost) + '</td>' + extra(r) : '<td class="' + C.td + ' text-slate-500" colspan="' + (bd ? 6 : 4) + '">' + (y.pricingState === 'pending manual pricing' ? '<span class="inline-flex items-center gap-1.5 text-amber-800 font-semibold"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>pending manual pricing</span>' : 'No cost') + '</td>') + '</tr>';
      }).join('');
      var cardExtra = function () { return ''; };
      
      var cards = x.days.map(function (y) { var notes = cell({ y: y }); return '<li class="' + C.card + ' p-4"><div class="flex items-start justify-between gap-2"><p class="text-sm font-semibold text-slate-900">' + fmtDay(y.date) + '</p>' + (y.dayStatus ? ui.chip(y.dayStatus) : '<span class="text-xs text-slate-500">Not set</span>') + '</div>' + (y.shiftName ? '<p class="text-xs text-slate-600 mt-1">' + esc(y.shiftName) + (y.shiftDefaulted ? ' · default' : '') + ' · ' + esc(y.effectiveJobRoleTitle || '') + '</p>' : '') + y.lines.map(function (l) { return '<p class="text-xs text-slate-700 mt-1 tnum">' + HOUR_TYPE[l.hourType] + ': ' + l.hours + ' h × ' + S3.money(l.chargeRate) + ' = ' + S3.money(l.clientCost) + cardExtra(l) + '</p>'; }).join('') + (y.pricingState === 'pending manual pricing' ? '<p class="text-xs font-semibold text-amber-800 mt-1">pending manual pricing</p>' : '') + (notes.length ? '<ul class="mt-1 text-[11px] text-slate-600 list-disc pl-4">' + notes.map(function (n2) { return '<li>' + esc(n2) + '</li>'; }).join('') + '</ul>' : '') + '</li>'; }).join('');
      return '<section aria-labelledby="dt-t"><h2 id="dt-t" class="text-sm font-bold text-slate-900 mb-3">Day by day</h2><div class="hidden md:block ' + C.card + ' overflow-hidden"><div class="relative overflow-x-auto"><table class="w-full text-left"><caption class="sr-only">Each day’s status, Shift and cost lines</caption><thead class="bg-slate-50 border-b border-slate-200"><tr>' + cols + '</tr></thead><tbody>' + body + '</tbody></table></div></div><ul class="md:hidden flex flex-col gap-3">' + cards + '</ul></section>';
    }
    function activity(x) {
      var ev2 = st === 'large' ? (function () { var a = []; for (var i = 0; i < 60; i++) a.push({ at: '2026-10-0' + (1 + (i % 9)) + 'T1' + (i % 10) + ':00:00', by: i % 2 ? 'Rachel Green' : 'Sarah Mitchell', text: 'Entry ' + (60 - i) + ': a day changed' }); return a; })() : x.events;
      var shown = ev2.slice(0, 20);
      return '<section class="' + C.card + ' p-5" aria-labelledby="ac-t"><h2 id="ac-t" class="text-sm font-bold text-slate-900 mb-3">Activity</h2>' + (shown.length ? '<ol class="flex flex-col gap-3">' + shown.map(function (a) { return '<li class="flex gap-3"><span class="mt-1.5 w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" aria-hidden="true"></span><div class="min-w-0"><p class="text-sm text-slate-800 break-words">' + esc(a.text) + '</p><p class="text-xs text-slate-500">' + esc(actor(a.by)) + (a.by && a.by !== 'Rachel Green' ? ', on the client’s behalf' : '') + ' · ' + S3.fmtDateTime(a.at) + '</p></div></li>'; }).join('') + '</ol>' + (ev2.length > 20 ? '<p class="text-xs text-slate-600 mt-3">20 of ' + ev2.length + ' entries. <a class="' + C.link + '" href="abstract.audit.audit-log.html">See them all in the Audit Log</a></p>' : '') : '<p class="text-sm text-slate-600">No activity yet.</p>') + '</section>';
    }
    function wire(x) {
      host.querySelectorAll('[data-cell]').forEach(function (btn) { btn.onclick = function () { var k = btn.dataset.cell.split('|'), xx = S4.timesheet(k[0]), y = xx.days.filter(function (d2) { return d2.date === k[1]; })[0]; S4.dayDialog(xx, y, can, after, { conflict: st === 'conflict' && !p._c }); }; });
      var on = function (i, f) { var e = host.querySelector('#' + i); if (e) e.onclick = f; };
      on('w-submit', function () { submitFlow(S4.timesheet(id), after); });
      on('w-rest', function () { restFlow(S4.timesheet(id), after); });
      
    }
    function after(info) { if (info && info.conflict) { p._c = true; conflictMsg = 'This week was changed elsewhere — your edit was re-applied. Check ' + esc(fmtDay(info.conflict)) + ' and save it again if it isn’t right.'; } draw(); }
    draw();
    var x0 = S4.timesheet(id);
    if (x0 && st === 'incomplete' && x0.status === 'Draft') submitFlow(x0, after);
    if (x0 && st === 'held' && x0.status === 'Draft') submitFlow(x0, after);
    
    if (x0 && st === 'validation') { var yc = x0.days.filter(function (y) { return y.inRange && !y.future; })[0]; if (yc && x0.status === 'Draft') S4.dayDialog(x0, yc, can, after, { forceInvalid: true }); }
    return { redraw: draw };
  };

  // ---------- the booking detail's Timesheets panel (4.7, TSD §5.7 TV-2) ----------
  S4.bookingPanel = function (bookingId, state) {
    if (state === 'notimesheets') return '';
    var weeks = S4.forBooking(bookingId), pre = ABS ? 'abstract' : 'client', b = S3.booking(bookingId);
    var href = function (x) { return pre + '.timesheets.booking-week.html?id=' + x.id; };
    var head = '<div class="flex flex-wrap items-center justify-between gap-2 mb-3"><h2 id="tp-t" class="text-sm font-bold text-slate-900">Timesheets</h2>' + (weeks.length ? '<a class="' + C.ghost + '" href="' + pre + '.timesheets.' + (ABS ? 'week-grid' : 'timesheets') + '.html?week=' + CURRENT_WEEK + (ABS ? '&client=' + b.clientId : '') + '">Open this week’s grid</a>' : '') + '</div>';
    if (state === 'panelloading') return '<section class="' + C.card + ' p-5" aria-busy="true" aria-labelledby="tp-t">' + head + '<div class="flex flex-col gap-2">' + [1, 2, 3].map(function () { return '<div class="h-9 rounded bg-slate-200 animate-pulse"></div>'; }).join('') + '</div></section>';
    if (state === 'panelerror') return '<section class="' + C.card + ' p-5" role="alert" aria-labelledby="tp-t">' + head + '<p class="text-sm text-slate-700">We couldn’t load this booking’s weeks.</p><button type="button" class="' + C.sec + ' mt-3" onclick="S1.setState(\'default\')"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Retry</button></section>';
    if (!weeks.length) return '<section class="' + C.card + ' p-5" aria-labelledby="tp-t">' + head + '<p class="text-sm text-slate-600">No weeks yet. A week’s timesheet appears once the booking’s dates reach it.</p></section>';
    var list = ui3.list({ caption: 'Weeks on this booking', rows: weeks, href: href, cols: [
      { label: 'Week', nowrap: true, cell: function (x) { return '<a class="' + C.link + '" href="' + href(x) + '">' + fmtWeek(x.weekStart) + '</a>'; } },
      { label: 'Status', cell: function (x) { return '<div class="flex flex-wrap gap-1">' + ui.badge(x.status, true) + ui.markers(x, true) + '</div>'; } },
      { label: 'Worked hours', right: true, cell: function (x) { return x.workedHours; } },
      { label: 'Absences', right: true, cell: function (x) { return String(x.absenceDays); } }
    ], card: function (x) { return ui3.mobileCard({ title: '<a class="' + C.link + '" href="' + href(x) + '">Week of ' + fmtWeek(x.weekStart) + '</a>', badge: ui.badge(x.status, true), lines: [ui.markers(x, true), x.workedHours + ' hours worked · ' + x.absenceDays + ' absence' + (x.absenceDays === 1 ? '' : 's')].filter(Boolean) }); } });
    return '<section aria-labelledby="tp-t">' + head + list + '</section>';
  };

  // ---------- the critical notice for the seeded pending days, once per viewer (ruling: Abstract's pricers and the site's timesheet viewers) ----------
  document.addEventListener('s1:ready', function () {
    var flag = 's4-notified-' + PORTAL; var done; try { done = window.localStorage.getItem(flag); } catch (e) { done = '1'; }
    if (done) return;
    S1.notify({ severity: 'critical', title: '2 days are waiting for manual pricing', body: 'Tasha Williams, BK-2202, Thu 8 Oct and Fri 9 Oct: Forklift Driver (Reach) on the Night Shift has no rate on the card. The week can’t be submitted or approved until Abstract prices them.', href: ABS ? 'abstract.timesheets.pending-pricing.html' : 'client.timesheets.booking-week.html?id=ts-132', when: 'Yesterday, 16:12' });
    try { window.localStorage.setItem(flag, '1'); } catch (e) { /* storage blocked */ }
  });
  S4.resetNotified = function () { try { window.localStorage.removeItem('s4-notified-' + PORTAL); } catch (e) { /* none */ } };
})();
