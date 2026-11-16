/*
 * slice5-proto.js — the slice 5 prototype's shared behaviour (agency fulfilment), one copy per portal.
 *
 * BUILT for the client portal — do not edit; edit the source and rebuild.
 * SOURCE: `Design/abstract admin/scripts/slice5-proto.src.js`. Each portal's `slice5-proto.js` is BUILT from it by
 * `node scripts/build-slice5-proto.mjs` (run from the abstract admin folder): the build keeps the lines outside a fence
 * and the lines inside a fence that names the portal (`//#if abstract`, `//#if client agency`, … closed by `//#endif`),
 * and drops the other portals' blocks and the fence lines themselves. Edit the source, never a built copy.
 *
 * Load order on a page: slice3-proto.js (absent on the agency portal) → slice5-proto.js → slice4-proto.js → slice1-kit.js.
 *
 * What a copy carries (slice 4's rule): only what its portal's responses would carry. The client's copy has no pay
 * figure, no booking source, no wave number, no candidate's personal data and no agency status; the agency's copy has
 * no charge rate, no margin but its own Agency Net Margin on an invoiced week (R5-D7), no other agency, no wave, no
 * roster and no position total. The demo store (localStorage
 * `s5-demo-v1`, shared by the three portals on one origin) holds the cross-portal facts — releases with their waves,
 * proposals, the agency's candidates, the Agency-sourced bookings, absence confirmations, and each released vacancy's
 * agency-facing facts and open count. A copy's accessors never return what its party may not read, even where the
 * store holds it (a prototype simplification: the store is one blob, the reader is the gate).
 *
 * What it gives a screen:
 *   S5.on()                          true in the slice 5 mode and the full product; every slice 5 addition is gated on it
 *   S5.proposals(f) / S5.proposal(id) the proposals the portal may read (ProposalSummary / Proposal, TSD §3.3.2)
 *   S5.ui.proposalBadge(status) / S5.ui.confBadge(state) / S5.ui.sourceBadge(src)   the kernel badges as drawn here
 *   abstract: S5.waves(vid), S5.releaseOptions(vid), S5.act.release, S5.act.startReview / accept / reject, S5.agencies()
 *   client:   S5.act.startReview / accept / reject; S5.directory() (B3); S5.supplyingParty(agencyId)
 *   agency:   S5.releasedVacancies() / S5.releasedVacancy(id), S5.myCandidates(), S5.act.propose / editNotes / withdraw,
 *             S5.act.saveCandidate, S5.agencyBookings(), S5.agencyWeeks(bookingId), S5.act.justify
 *   abstract and client also: the overlay on S3 (Agency-sourced bookings in the bookings and the roster, a released
 *   vacancy's status) and the S4 seam (S5.s4.*: the seeded weeks of the Agency-sourced booking, the confirmation states).
 *
 * "Today" is slice 3's: Saturday 10 Oct 2026.
 */
(function () {
  'use strict';
  var PORTAL = 'client';
  var TODAY = '2026-10-10';
  var KEY = 's5-demo-v1';
  var S5 = window.S5 = { PORTAL: PORTAL, TODAY: TODAY, KEY: KEY };

  // ---------- the slice mode (the kit's key; read directly when the kit has not loaded yet) ----------
  function mode() {
    if (window.S1 && S1.mode) return S1.mode();
    var m = null; try { m = window.localStorage.getItem('s1-mode'); } catch (e) { /* blocked */ }
    return m === 'on' ? 's1' : ['s2', 's3', 's4', 's5'].indexOf(m) >= 0 ? m : 'full';
  }
  function on() { var m = mode(); return m === 's5' || m === 'full'; }
  S5.mode = mode; S5.on = on;

  // ---------- storage ----------
  function read(k) { try { return JSON.parse(window.localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function write(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window: this page only */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function now() { var d = new Date(); return TODAY + 'T' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2); }
  function refuse(code, message, data) { var e = new Error(message); e.code = code; e.data = data || {}; throw e; }
  var MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(iso) { if (!iso) return '—'; var p = iso.slice(0, 10).split('-'); return Number(p[2]) + ' ' + MN[Number(p[1]) - 1] + ' ' + p[0]; }
  function fmtDateTime(iso) { return fmtDate(iso) + ', ' + iso.slice(11, 16); }
  S5.esc = esc; S5.now = now; S5.fmtDate = fmtDate; S5.fmtDateTime = fmtDateTime;
  var ABSENCES = ['Sick Leave', 'Holiday', 'No-show'];
  var PENDING = ['Submitted', 'Under Review'];

  // ---------- reference data: the agencies (slice 2's records) ----------
  var AGENCY_NAMES = { techforce: 'TechForce Recruitment', nexus: 'Nexus Talent' };
  // visibility.client_sees_agency_name resolved for this client today (TSD §3.3.5; the key is sub-slice 5.5's).
  // The client session's pages may draw the key off (their `agencyhidden` state) by setting S5.seesAgencyName = false.
  S5.seesAgencyName = true;
  function agencyName(id) { return S5.seesAgencyName ? (AGENCY_NAMES[id] || 'Agency') : 'Agency'; }
  S5.supplyingParty = agencyName;

  // ---------- the agencies' branch structures (agencyOrgNodeId → the branch a candidate belongs to) ----------

  // ---------- the agencies' candidates: what every party may read (name, compliance, licence validity) ----------
  function lic(t, e) { return { licenceType: t, expiryDate: e || null }; }
  var CANDS = [
    { id: 'ac-kofi', fullName: 'Kofi Mensah', agencyId: 'techforce', complianceStatus: 'Compliant', licences: [lic('Reach truck (RTITB)', '2028-03-31')] },
    { id: 'ac-liam', fullName: 'Liam Carter', agencyId: 'techforce', complianceStatus: 'Compliant', licences: [lic('Reach truck (RTITB)', '2027-06-30'), lic('Counterbalance (ITSSAR)', '2027-11-30')] },
    { id: 'ac-ryan', fullName: 'Ryan Hughes', agencyId: 'techforce', complianceStatus: 'Compliant', licences: [lic('Reach truck (RTITB)', '2026-08-15')] },
    { id: 'ac-chloe', fullName: 'Chloe Adams', agencyId: 'techforce', complianceStatus: 'Compliant', licences: [] },
    { id: 'ac-hannah', fullName: 'Hannah Brooks', agencyId: 'techforce', complianceStatus: 'Compliant', licences: [lic('Counterbalance (ITSSAR)', '2027-04-30')] },
    { id: 'ac-daniel', fullName: 'Daniel Osei', agencyId: 'techforce', complianceStatus: 'Pending', licences: [] },
    { id: 'ac-megan', fullName: 'Megan Price', agencyId: 'techforce', complianceStatus: 'Compliant', licences: [] },
    { id: 'ac-amira', fullName: 'Amira Hassan', agencyId: 'techforce', complianceStatus: 'Compliant', licences: [lic('Reach truck (RTITB)', '2027-09-30')] }
    , { id: 'nx-oliver', fullName: 'Oliver Grant', agencyId: 'nexus', complianceStatus: 'Pending', licences: [] },
    { id: 'nx-priya', fullName: 'Priya Kaur', agencyId: 'nexus', complianceStatus: 'Compliant', licences: [] },
    { id: 'nx-tom', fullName: 'Tom Fletcher', agencyId: 'nexus', complianceStatus: 'Compliant', licences: [lic('Counterbalance (ITSSAR)', '2026-12-31')] },
    { id: 'nx-grace', fullName: 'Grace Adebayo', agencyId: 'nexus', complianceStatus: 'Compliant', licences: [] },
    { id: 'nx-sam', fullName: 'Sam Whitfield', agencyId: 'nexus', complianceStatus: 'Compliant', licences: [] }
  ];

  // ---------- the store seed: the cross-portal facts ----------
  // Each copy seeds only the records (and the fields) its party may hold, so the agency's file has no other agency's
  // proposal and no wave number, and the client's no release row. The store is the union: on load a copy adds the seed
  // records no copy has seeded yet and fills in the fields of the ones another copy seeded with fewer (store.seeded keeps
  // the keys, so a record a write removed — an ended confirmation — never comes back).
  function rel(vid, agency, at, wave, by) { var r = { vacancyId: vid, agencyId: agency, releasedAt: at }; if (wave) { r.waveNumber = wave; r.releasedByName = by; } return r; }
  function prp(n, vid, cand, agency, status, sub, extra) {
    return Object.assign({ id: 'p' + n, reference: 'PRP-' + n, vacancyId: vid, candidateId: cand, agencyId: agency, status: status, notes: '', submittedAt: sub, updatedAt: sub, reviewStartedAt: null, decidedAt: null, decidedByParty: null, decisionReason: null, positionNumber: null, bookingId: null, bookingReference: null }, extra || {});
  }
  function abk(o) {
    return Object.assign({ extendedAt: null, startedBy: null, completedAt: null, completedBy: null, cancelledAt: null, cancelledBy: null, cancellationReason: null, updatedAt: o.createdAt }, o);
  }
  function by(x, extra) { return Object.assign({}, extra, x); }
  function seed() {
    var releases = [
    ];
    // who decided, as each party may read it: Abstract's user by name only in Abstract's copy
    var ABS_DEC = {};
    var proposals = [
      prp(1001, 'v1042', 'ac-kofi', 'techforce', 'Accepted', '2026-09-24T13:40:00', by(ABS_DEC, { notes: 'Kofi drove reach trucks for three years at a Leeds cold store and holds a current RTITB licence. He can start on the 28th and is happy on the afternoon Shift.', reviewStartedAt: '2026-09-25T09:10:00', decidedAt: '2026-09-25T16:05:00', decidedByParty: 'abstract', positionNumber: 2, bookingId: 'b2210', bookingReference: 'BK-2210', updatedAt: '2026-09-25T16:05:00' })),
      prp(1002, 'v1042', 'ac-liam', 'techforce', 'Submitted', '2026-10-09T10:30:00', { notes: 'Liam holds reach truck and counterbalance licences and has worked high-bay replenishment at two distribution centres. Available from Monday.' }),
      prp(1003, 'v1042', 'ac-ryan', 'techforce', 'Rejected', '2026-09-25T09:00:00', by(ABS_DEC, { notes: 'Ryan has six years on reach trucks in Leeds and Wakefield.', decidedAt: '2026-09-26T11:20:00', decidedByParty: 'abstract', decisionReason: 'His reach truck licence expired on 15 Aug 2026. Propose him again once it is renewed.', updatedAt: '2026-09-26T11:20:00' })),
      prp(1004, 'v1043', 'ac-chloe', 'techforce', 'Rejected (Position Filled)', '2026-10-01T10:00:00', { notes: 'Chloe has worked nights at a Birmingham parcel hub for two years.', decidedAt: '2026-10-06T16:30:00', decidedByParty: 'system', updatedAt: '2026-10-06T16:30:00' }),
      prp(1005, 'v1041', 'ac-hannah', 'techforce', 'Under Review', '2026-10-05T16:10:00', { notes: 'Hannah led a goods-in team of six at a Birmingham DC over last year’s peak and holds a counterbalance licence.', reviewStartedAt: '2026-10-06T09:05:00', updatedAt: '2026-10-06T09:05:00' }),
      prp(1006, 'v1041', 'ac-daniel', 'techforce', 'Submitted', '2026-10-06T11:45:00', { notes: 'Daniel has two seasons of picking and packing experience. His DBS check is in progress.' }),
      prp(1007, 'v1041', 'ac-megan', 'techforce', 'Withdrawn', '2026-10-05T16:30:00', { notes: 'Megan has worked peak cover at this site before.', decidedAt: '2026-10-07T12:00:00', decidedByParty: 'agency', decidedByName: 'Daniel Wright', decisionReason: 'Megan has accepted a permanent role elsewhere.', updatedAt: '2026-10-07T12:00:00' })
      , prp(1008, 'v1041', 'nx-oliver', 'nexus', 'Rejected', '2026-10-07T15:40:00', by(ABS_DEC, { notes: 'Oliver is reliable on early starts and lives ten minutes from the site.', decidedAt: '2026-10-08T10:05:00', decidedByParty: 'abstract', decisionReason: 'His right to work check is still pending, and Acme needs it before the first day.', updatedAt: '2026-10-08T10:05:00' })),
      prp(1009, 'v1041', 'nx-priya', 'nexus', 'Submitted', '2026-10-08T09:20:00', { notes: 'Priya has picked to order on scanners at two retail DCs and can do the full ten weeks.' }),
      prp(1010, 'v1041', 'nx-tom', 'nexus', 'Under Review', '2026-10-07T15:00:00', { notes: 'Tom is a counterbalance driver who also covers goods-in. He has worked for Acme before, at Leicester.', reviewStartedAt: '2026-10-08T10:10:00', updatedAt: '2026-10-08T10:10:00' }),
      prp(1011, 'v1047', 'nx-grace', 'nexus', 'Accepted', '2026-10-08T13:15:00', by(ABS_DEC, { notes: 'Grace covered days at this site in the summer and can start tomorrow.', reviewStartedAt: '2026-10-08T15:00:00', decidedAt: '2026-10-08T16:40:00', decidedByParty: 'abstract', positionNumber: 2, bookingId: 'b2211', bookingReference: 'BK-2211', updatedAt: '2026-10-08T16:40:00' })),
      prp(1012, 'v1047', 'nx-sam', 'nexus', 'Rejected (Position Filled)', '2026-10-08T13:30:00', { notes: 'Sam is available immediately for days.', decidedAt: '2026-10-08T16:40:00', decidedByParty: 'system', updatedAt: '2026-10-08T16:40:00' })
    ];
    // the Agency-sourced bookings; the names are stored with them so the agency's copy (which has no slice 3 data) reads them
    var KOFI = { id: 'b2210', reference: 'BK-2210', vacancyId: 'v1042', candidateId: 'ac-kofi', candidateName: 'Kofi Mensah', clientId: 'acme', clientName: 'Acme Logistics', orgNodeName: 'Leeds Hub', jobRoleTitle: 'Forklift Driver (Reach)', shiftName: 'Afternoon', startDate: '2026-09-28', endDate: '2026-11-27', workingTimes: 'Mon to Fri, 14:00 to 22:00', status: 'Active', startedAt: '2026-09-28T00:30:00', agencyId: 'techforce', proposalId: 'p1001', createdAt: '2026-09-25T16:05:00' };
    Object.assign(KOFI, { vacancyReference: 'VAC-1042', jobTitle: 'Reach truck drivers', positionNumber: 2, orgNodeId: 'lds', orgNodePath: ['Northern', 'Leeds Hub'], jobRoleId: 'jr-fd', shiftId: 'sh-pm' });
    var bookings = [abk(KOFI)
      , abk({ id: 'b2211', reference: 'BK-2211', vacancyId: 'v1047', vacancyReference: 'VAC-1047', jobTitle: 'Days team cover', positionNumber: 2, candidateId: 'nx-grace', candidateName: 'Grace Adebayo', clientId: 'acme', clientName: 'Acme Logistics', orgNodeId: 'bhx-d', orgNodeName: 'Days', orgNodePath: ['Midlands', 'Birmingham DC', 'Days'], jobRoleId: 'jr-wo', jobRoleTitle: 'Warehouse Operative', shiftId: 'sh-am', shiftName: 'Morning', startDate: '2026-10-09', endDate: '2026-11-06', workingTimes: 'Mon to Fri, 06:00 to 14:00', status: 'Active', startedAt: '2026-10-09T00:30:00', agencyId: 'nexus', proposalId: 'p1011', createdAt: '2026-10-08T16:40:00' })
    ];
    // Each released vacancy's agency-facing facts (ReleasedVacancy, TSD §3.3.1), its open count and first release, kept
    // current by the Abstract and client copies whenever they read the vacancy. No pay rate here: each copy has its own money.
    function facts(id, ref, title, role, node, start, end, close, shift, times, desc, req, open, status, first) { return { id: id, reference: ref, jobTitle: title, jobRoleTitle: role, clientId: 'acme', clientName: 'Acme Logistics', orgNodeName: node, startDate: start, endDate: end, closeDate: close, shiftName: shift, workingTimes: times, description: desc, requirements: req, openCount: open, status: status, firstReleasedAt: first }; }
    var vacancies = {
      v1041: facts('v1041', 'VAC-1041', 'Warehouse operatives, peak cover', 'Warehouse Operative', 'Birmingham DC', '2026-10-19', '2026-12-18', '2026-10-16', 'Morning', 'Mon to Fri, 06:00 to 14:00', 'General warehouse duties at the site: goods in, picking to order, and loading for despatch.', 'Safety boots and hi-vis provided on site. Able to lift up to 20 kg.', 3, 'Released to Agencies', '2026-10-05T14:20:00'),
      v1042: facts('v1042', 'VAC-1042', 'Reach truck drivers', 'Forklift Driver (Reach)', 'Leeds Hub', '2026-09-28', '2026-11-27', null, 'Afternoon', 'Mon to Fri, 14:00 to 22:00', 'Racking and replenishment in the high-bay aisles.', 'Current reach truck licence.', 1, 'Released to Agencies', '2026-09-24T10:15:00'),
      v1050: facts('v1050', 'VAC-1050', 'Goods-in operatives', 'Warehouse Operative', 'Leicester DC', '2026-10-26', '2026-12-18', '2026-10-23', 'Morning', 'Mon to Fri, 06:00 to 14:00', 'Unloading inbound trailers, checking deliveries against the paperwork, and putting stock away.', 'Safety boots and hi-vis provided on site. Able to lift up to 20 kg.', 3, 'Released to Agencies', '2026-10-09T11:30:00'),
      v1043: facts('v1043', 'VAC-1043', 'Night shift operatives', 'Warehouse Operative', 'Nights', '2026-10-12', '2026-11-13', null, 'Night', 'Sun to Thu, 22:00 to 06:00', null, null, 0, 'Filled', '2026-09-30T08:50:00')
      , v1047: facts('v1047', 'VAC-1047', 'Days team cover', 'Warehouse Operative', 'Days', '2026-09-14', '2026-11-06', null, 'Morning', 'Mon to Fri, 06:00 to 14:00', null, null, 0, 'Filled', '2026-10-08T11:00:00')
    };
    // Absence confirmations, keyed booking|date (glossary AbsenceConfirmationRequest; TSD §3.3.7)
    var confirmations = {
      'b2210|2026-09-30': { requestedAt: '2026-09-30T13:10:00', requestedByParty: 'policy', justification: 'Kofi called our Leeds branch at 12:40, before his shift, to say he was unwell. His self-certification is on file with us.', justifiedAt: '2026-09-30T16:20:00', justifiedByName: 'Daniel Wright' },
      'b2210|2026-10-07': { requestedAt: '2026-10-07T15:10:00', requestedByParty: 'client', justification: null, justifiedAt: null, justifiedByName: null }
    };
    confirmations['b2210|2026-10-07'].requestedByName = 'Rachel Green';
    var audit = [
    ];
    return { releases: releases, proposals: proposals, candidates: [], bookings: bookings, vacancies: vacancies, confirmations: confirmations, weeks: {}, audit: audit, seq: { prp: 1012, bk: 2300, cand: 100 } };
  }

  // ---------- store ----------
  var KEYS = { releases: function (r) { return r.vacancyId + '|' + r.agencyId; }, proposals: function (r) { return r.id; }, bookings: function (r) { return r.id; }, audit: function (r) { return r.type + '|' + r.id + '|' + r.at + '|' + r.text; } };
  function merge(store, sd) {
    var seen = store.seeded || {}, changed = false;
    Object.keys(KEYS).forEach(function (c) {
      store[c] = store[c] || [];
      sd[c].forEach(function (rec) {
        var k = c + ':' + KEYS[c](rec), cur = store[c].filter(function (x) { return c + ':' + KEYS[c](x) === k; })[0];
        if (cur) { Object.keys(rec).forEach(function (f) { if (!(f in cur)) { cur[f] = rec[f]; changed = true; } }); }
        else if (!seen[k]) { store[c].push(JSON.parse(JSON.stringify(rec))); changed = true; }
        if (!seen[k]) { seen[k] = 1; changed = true; }
      });
    });
    ['vacancies', 'confirmations'].forEach(function (c) {
      store[c] = store[c] || {};
      Object.keys(sd[c]).forEach(function (key) {
        var k = c + ':' + key, cur = store[c][key], rec = sd[c][key];
        if (cur) { Object.keys(rec).forEach(function (f) { if (!(f in cur)) { cur[f] = rec[f]; changed = true; } }); }
        else if (!seen[k]) { store[c][key] = JSON.parse(JSON.stringify(rec)); changed = true; }
        if (!seen[k]) { seen[k] = 1; changed = true; }
      });
    });
    ['candidates', 'weeks'].forEach(function (c) { if (!store[c]) { store[c] = sd[c]; changed = true; } });
    if (!store.seq) { store.seq = sd.seq; changed = true; }
    store.seeded = seen;
    return changed;
  }
  var db = read(KEY);
  if (!db) { db = { seeded: {} }; merge(db, seed()); write(KEY, db); } else if (merge(db, seed())) write(KEY, db);
  function save() { write(KEY, db); }
  S5.reset = function () { try { window.localStorage.removeItem(KEY); } catch (e) { /* nothing stored */ } db = { seeded: {} }; merge(db, seed()); save(); };
  function log(type, id, text, who) { db.audit.push({ type: type, id: id, at: now(), by: who === undefined ? S5.me : who, text: text }); }
  S5.me = 'Rachel Green'; var PARTY = 'client';

  // ---------- candidates ----------
  // The seeded record, merged with any write the agency made (store.candidates), dressed with the compliance roll-up.
  function rawCand(id) {
    var w = db.candidates.filter(function (c) { return c.id === id; })[0];
    if (w) return w;
    var p = CANDS.filter(function (c) { return c.id === id; })[0]; if (!p) return null;
    var o = JSON.parse(JSON.stringify(p));
    return o;
  }
  function dressCand(c) {
    var o = JSON.parse(JSON.stringify(c));
    o.licences = (o.licences || []).filter(function (l) { return !l.removedAt; }).map(function (l) { return Object.assign(l, { expired: !!l.expiryDate && l.expiryDate < TODAY }); });
    // a client reads a candidate's name, compliance and licence validity only (PP-006, CP-018)
    o = { id: o.id, fullName: o.fullName, complianceStatus: o.complianceStatus, licences: o.licences.map(function (l) { return { licenceType: l.licenceType, expiryDate: l.expiryDate, expired: l.expired }; }), supplyingParty: agencyName(c.agencyId) };
    return o;
  }
  function allCandIds() { var ids = CANDS.map(function (c) { return c.id; }); db.candidates.forEach(function (c) { if (ids.indexOf(c.id) < 0) ids.push(c.id); }); return ids; }

  // ---------- reads: proposals ----------
  function rawP(id) { return db.proposals.filter(function (p) { return p.id === id; })[0]; }
  function facts(vid) { return db.vacancies[vid] || null; }
  function dressP(p) {
    var c = rawCand(p.candidateId) || { fullName: '—', complianceStatus: 'Pending', licences: [] }, dc = dressCand(c), f = facts(p.vacancyId) || {};
    var o = { id: p.id, reference: p.reference, vacancyId: p.vacancyId, vacancyReference: f.reference || '', jobTitle: f.jobTitle || '', clientId: f.clientId || 'acme', clientName: f.clientName || '', orgNodeName: f.orgNodeName || '',
      candidateId: p.candidateId, candidateName: dc.fullName, candidateComplianceStatus: dc.complianceStatus, candidateLicences: (dc.licences || []).map(function (l) { return { licenceType: l.licenceType, expiryDate: l.expiryDate, expired: l.expired }; }),
      supplyingParty: agencyName(p.agencyId), status: p.status, submittedAt: p.submittedAt, updatedAt: p.updatedAt,
      notes: p.notes, reviewStartedAt: p.reviewStartedAt, decidedAt: p.decidedAt, decidedByParty: p.decidedByParty, decisionReason: p.decisionReason,
      positionNumber: p.positionNumber, bookingId: p.bookingId, bookingReference: p.bookingReference };
    // who decided reads as the party: the client sees its own user's name, Abstract as "Abstract"
    o.decidedByName = p.decidedByParty === 'client' ? p.decidedByName : p.decidedByParty === 'abstract' ? 'Abstract' : null;
    return o;
  }
  function readable(p) {
    var f = facts(p.vacancyId); return !!f && f.clientId === 'acme';
  }
  // GET /proposals: vacancyId, status (array), pending, agencyId (Abstract only), q; newest first
  S5.proposals = function (f) {
    f = f || {};
    return db.proposals.filter(readable).filter(function (p) {
      if (f.vacancyId && p.vacancyId !== f.vacancyId) return false;
      if (f.candidateId && p.candidateId !== f.candidateId) return false;
      if (f.status && f.status.length && f.status.indexOf(p.status) < 0) return false;
      if (f.pending && PENDING.indexOf(p.status) < 0) return false;
      return true;
    }).map(dressP).filter(function (x) { return !f.q || (x.reference + ' ' + x.candidateName + ' ' + x.vacancyReference).toLowerCase().indexOf(f.q.toLowerCase()) >= 0; })
      .sort(function (a, b) { return a.submittedAt < b.submittedAt ? 1 : -1; });
  };
  S5.proposal = function (id) { var p = rawP(id); return p && readable(p) ? dressP(p) : null; };
  S5.audit = function (type, id) { return db.audit.filter(function (a) { return a.type === type && a.id === id; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; }); };
  S5.PENDING = PENDING;

  // ---------- reads: releases (Abstract only — an agency never reads a wave, another release row or the history) ----------

  // ---------- writes ----------
  S5.act = S5.act || {};
  function reviewer(p, what) {
    if (PENDING.indexOf(p.status) < 0) refuse('PROPOSAL_STATUS_INVALID', 'This proposal is ' + p.status + ' now, so it can’t be ' + what + '. The page shows the latest.', { status: p.status });
  }
  // POST /proposals/:id/start-review
  S5.act.startReview = function (id, o) {
    var p = rawP(id); o = o || {};
    if (o.simulateStale || p.status !== 'Submitted') refuse('PROPOSAL_STATUS_INVALID', 'This proposal is ' + (o.simulateStale ? 'Withdrawn' : p.status) + ' now, so the review can’t start. The page shows the latest.', { status: p.status });
    p.status = 'Under Review'; p.reviewStartedAt = now(); p.updatedAt = now(); log('proposal', id, 'Status: Submitted → Under Review'); save();
  };
  // POST /proposals/:id/reject — reason 1–1,000
  S5.act.reject = function (id, reason) {
    var p = rawP(id); reviewer(p, 'rejected');
    if (!reason || !reason.trim()) refuse('VALIDATION_ERROR', 'Enter a reason.', { fields: { reason: 'Enter a reason.' } });
    if (reason.length > 1000) refuse('VALIDATION_ERROR', 'Keep the reason to 1,000 characters.', { fields: { reason: 'Keep the reason to 1,000 characters.' } });
    var was = p.status; p.status = 'Rejected'; p.decidedAt = now(); p.decidedByParty = PARTY; p.decidedByName = S5.me; p.decisionReason = reason.trim(); p.updatedAt = now();
    log('proposal', id, 'Status: ' + was + ' → Rejected. Reason: ' + reason.trim()); save();
  };
  // rejectPendingOnExhaustion (§3.3.2 rule 5): a write that leaves openCount 0 rejects every other pending proposal
  function rejectPending(vid, except, status, reason) {
    var n = 0;
    db.proposals.forEach(function (p) { if (p.vacancyId !== vid || p.id === except || PENDING.indexOf(p.status) < 0) return; var was = p.status; p.status = status; p.decidedAt = now(); p.decidedByParty = 'system'; p.decidedByName = null; p.decisionReason = reason || null; p.updatedAt = now(); n++; log('proposal', p.id, 'Status: ' + was + ' → ' + status + (reason ? '. Reason: ' + reason : ''), null); });
    return n;
  }
  S5._rejectPending = rejectPending;
  // POST /bookings/from-proposal — { proposalId, positionNumber?, startDate?, endDate?, workingTimes? }
  S5.act.accept = function (id, f, o) {
    o = o || {}; var p = rawP(id); f = f || {};
    if (o.simulate === 'stale') refuse('PROPOSAL_STATUS_INVALID', 'This proposal is Withdrawn now: the agency withdrew it while you had it open. Nothing was booked.', { status: 'Withdrawn' });
    reviewer(p, 'accepted');
    var v = window.S3 ? S3.vacancy(p.vacancyId) : null; if (!v) refuse('VACANCY_NOT_FOUND', 'We can’t find the vacancy.');
    if (['Closed', 'Cancelled', 'Draft'].indexOf(v.status) >= 0) refuse('VACANCY_STATUS_INVALID', v.reference + ' is ' + v.status + ', so nothing can be booked on it.', { status: v.status });
    if (o.simulate === 'clientinactive' || S3.CLIENTS[v.clientId].status !== 'Active') refuse('VACANCY_CLIENT_NOT_ACTIVE', v.clientName + ' is ' + (o.simulate ? 'Suspended' : S3.CLIENTS[v.clientId].status) + ', so nothing can be booked on its vacancies.');
    if (o.simulate === 'agencyinactive') refuse('PROPOSAL_AGENCY_NOT_ACTIVE', 'The supplying agency isn’t active at the moment, so this proposal can’t be accepted. It can still be rejected.');
    if (o.simulate === 'anonymised') refuse('CANDIDATE_ANONYMISED', 'This candidate’s record has been anonymised, so they can’t be booked.');
    var open = v.rosterRows.filter(function (r) { return r.status === 'Open'; });
    var n = f.positionNumber || (open[0] && open[0].n);
    var pos = v.rosterRows.filter(function (r) { return r.n === n; })[0];
    if (!pos) refuse('POSITION_NOT_FOUND', 'Position ' + n + ' doesn’t exist on this vacancy.');
    if (o.simulate === 'taken' || pos.status !== 'Open') refuse('POSITION_NOT_OPEN', 'Position ' + n + ' is no longer open: it was filled a moment ago. Choose another open position.');
    var start = f.startDate || v.startDate, end = f.endDate || v.endDate;
    if (end < start) refuse('BOOKING_DATES_INVALID', 'The end date is before the start date. Choose an end on or after ' + fmtDate(start) + '.');
    if (start < v.startDate || end > v.endDate) refuse('BOOKING_DATES_OUTSIDE_VACANCY', 'The dates must fall within the vacancy, ' + fmtDate(v.startDate) + ' to ' + fmtDate(v.endDate) + '.');
    var c = rawCand(p.candidateId), bid = 'b' + (++db.seq.bk), started = start <= TODAY;
    var b = abk({ id: bid, reference: 'BK-' + db.seq.bk, vacancyId: v.id, vacancyReference: v.reference, jobTitle: v.jobTitle, positionNumber: n, candidateId: p.candidateId, candidateName: c.fullName, clientId: v.clientId, clientName: v.clientName, orgNodeId: v.orgNodeId, orgNodeName: v.orgNodeName, orgNodePath: v.orgNodePath, jobRoleId: v.jobRoleId, jobRoleTitle: v.jobRoleTitle, shiftId: v.shiftId, shiftName: v.shiftName, startDate: start, endDate: end, workingTimes: f.workingTimes || v.workingTimes, status: started ? 'Active' : 'Pending Start', startedAt: started ? now() : null, agencyId: p.agencyId, proposalId: p.id, createdAt: now(), createdBy: S5.me });
    db.bookings.unshift(b);
    var was = p.status; p.status = 'Accepted'; p.decidedAt = now(); p.decidedByParty = PARTY; p.decidedByName = S5.me; p.positionNumber = n; p.bookingId = bid; p.bookingReference = b.reference; p.updatedAt = now();
    log('proposal', p.id, 'Status: ' + was + ' → Accepted. Position ' + n + ', booking ' + b.reference);
    log('booking', bid, 'Booking created from an accepted proposal');   // no proposal reference on a booking (ruled 2026-11-16, R5-G1)
    var left = open.length - 1, auto = left === 0 ? rejectPending(v.id, p.id, 'Rejected (Position Filled)') : 0;
    save(); if (window.S3) syncFacts(S3.vacancy(v.id));
    return { bookingId: bid, bookingReference: b.reference, positionNumber: n, autoRejected: auto };
  };

  // ---------- Agency-sourced bookings ----------
  function rawAB(id) { return db.bookings.filter(function (b) { return b.id === id; })[0]; }
  S5.isAgencyBooking = function (id) { return !!rawAB(id); };

  // ---------- the Candidate Directory (B3; TSD §3.3.3 rule 4, CandidateDirectoryRow; CP-017, CP-018, CP-019, DV-010) ----------
  // GET /candidate-directory: one row per candidate with at least one booking, in any status, at a node of the client in
  // the caller's subtree (Rachel Green's is the whole of Acme); an anonymised candidate is never a row. Every field is open:
  // no personal data, no pay, no charge, no margin, no source (CP-019, CP-022). A pool candidate's compliance and licence
  // validity are the open facts its slice 3 record rolls up to (Abstract's slice3-proto.js); this copy holds those alone.
  var POOL_FACTS = {
    'c-mo': { complianceStatus: 'Compliant', licences: [lic('Reach truck (RTITB)', '2027-08-31')] },
    'c-tw': { complianceStatus: 'Compliant', licences: [lic('Reach truck (RTITB)', '2026-09-30')] },
    'c-sa': { complianceStatus: 'Compliant', licences: [] },
    'c-lk': { complianceStatus: 'Pending', licences: [] },
    'c-ra': { complianceStatus: 'Compliant', licences: [lic('Counterbalance (ITSSAR)', '2027-02-28')] },
    'c-er': { complianceStatus: 'Expired', licences: [] },
    'c-gh': { complianceStatus: 'Compliant', licences: [] },
    'c-mo2': { complianceStatus: 'Compliant', licences: [] }
  };
  var COMPLIANCE = ['Compliant', 'Pending', 'Expired'];
  S5.COMPLIANCE = COMPLIANCE;
  function directoryRows() {
    var by = {};
    (window.S3 ? S3.bookings() : []).forEach(function (b) { if (S3.clientId && b.clientId !== S3.clientId) return; (by[b.candidateId] = by[b.candidateId] || []).push(b); });
    return Object.keys(by).map(function (id) {
      var list = by[id].slice().sort(function (a, b) { return a.startDate < b.startDate ? 1 : -1; }), latest = list[0], c = rawCand(id), facts, party;
      if (c) { if (c.anonymisedAt) return null; facts = dressCand(c); party = facts.supplyingParty; }
      else { facts = POOL_FACTS[id]; if (!facts) return null; party = 'Abstract'; }
      return { candidateId: id, fullName: c ? facts.fullName : latest.candidateName, jobRoleTitle: latest.jobRoleTitle, supplyingParty: party, complianceStatus: facts.complianceStatus,
        licences: (facts.licences || []).map(function (l) { return { licenceType: l.licenceType, expiryDate: l.expiryDate, expired: !!l.expiryDate && l.expiryDate < TODAY }; }),
        lastBookedFrom: latest.startDate, bookingCount: list.length };
    }).filter(Boolean).sort(function (a, b) { return a.fullName < b.fullName ? -1 : 1; });
  }
  // f: { q, jobRoleId, complianceStatus, supplyingParty }; a value outside the lists answers 422 VALIDATION_ERROR
  S5.directory = function (f) {
    f = f || {};
    var rows = directoryRows(), parties = S5.directoryParties(rows);
    if (f.jobRoleId && !(window.S3 && S3.JOB_ROLES[f.jobRoleId])) refuse('VALIDATION_ERROR', 'Choose a job role from the list.', { fields: { jobRoleId: 'That job role doesn’t exist. Choose one from the list.' } });
    if (f.complianceStatus && COMPLIANCE.indexOf(f.complianceStatus) < 0) refuse('VALIDATION_ERROR', 'Choose a compliance status from the list.', { fields: { complianceStatus: 'Choose Compliant, Pending or Expired.' } });
    if (f.supplyingParty && parties.indexOf(f.supplyingParty) < 0) refuse('VALIDATION_ERROR', 'Choose a supplying party from the list.', { fields: { supplyingParty: 'Choose a supplying party from the list.' } });
    if (f.q && f.q.length > 100) refuse('VALIDATION_ERROR', 'Keep the search to 100 characters.', { fields: { q: 'Keep the search to 100 characters.' } });
    return rows.filter(function (r) {
      if (f.jobRoleId && r.jobRoleTitle !== S3.JOB_ROLES[f.jobRoleId]) return false;
      if (f.complianceStatus && r.complianceStatus !== f.complianceStatus) return false;
      if (f.supplyingParty && r.supplyingParty !== f.supplyingParty) return false;
      return !f.q || r.fullName.toLowerCase().indexOf(f.q.trim().toLowerCase()) >= 0;
    });
  };
  // the supplying-party filter's options: Abstract and the agencies as this client reads them (Agency when its key is off)
  S5.directoryParties = function (rows) { var m = {}; (rows || directoryRows()).forEach(function (r) { m[r.supplyingParty] = 1; }); return Object.keys(m).sort(function (a, b) { return a === 'Abstract' ? -1 : b === 'Abstract' ? 1 : a < b ? -1 : 1; }); };

  // ---------- absence confirmation (TSD §3.3.7) ----------
  var INVOICED = [
    // Prototype stand-in for slice 6's timesheet_invoiced_periods: one booking-week counts as invoiced, so the agency's
    // pay figures (§3.3.6 rule 3) and the "can't reopen" rule have a week to show on. Slice 5 writes no such row.
    { bookingId: 'b2210', weekStart: '2026-09-28', invoicedAt: '2026-10-07T10:00:00' }
  ];
  function invoiced(bookingId, ws) { return INVOICED.filter(function (r) { return r.bookingId === bookingId && r.weekStart === ws; })[0] || null; }
  S5.invoiced = invoiced;
  function confKey(bookingId, date) { return bookingId + '|' + date; }
  function confState(bookingId, date, dayStatus) {
    if (ABSENCES.indexOf(dayStatus) < 0) return null;
    var c = db.confirmations[confKey(bookingId, date)];
    return c ? (c.justification ? 'Justified' : 'Requested (awaiting agency)') : 'Not Requested';
  }
  function confOf(bookingId, date) {
    var c = db.confirmations[confKey(bookingId, date)]; if (!c) return null;
    var o = { requestedAt: c.requestedAt, requestedByParty: c.requestedByParty, justification: c.justification, justifiedAt: c.justifiedAt };
    o.requestedByName = c.requestedByName; o.justifiedByName = c.justifiedByName;
    return o;
  }
  S5.confState = confState; S5.confirmation = confOf;

  // ---------- the overlay on slice 3 (Abstract and client): Agency-sourced bookings, a released vacancy's status ----------
  // store each released vacancy's agency-facing facts and open count, for the agency's copy
  function syncFacts(v, force) {
    if (!v) return;
    var released = db.releases.some(function (x) { return x.vacancyId === v.id; }); if (!released && !force) return;
    var st = ['Filled', 'Closed', 'Cancelled'].indexOf(v.status) >= 0 ? v.status : 'Released to Agencies';
    var cur = db.vacancies[v.id] || {}, next = { id: v.id, reference: v.reference, jobTitle: v.jobTitle, jobRoleTitle: v.jobRoleTitle, clientId: v.clientId, clientName: v.clientName, orgNodeName: v.orgNodeName, startDate: v.startDate, endDate: v.endDate, closeDate: v.closeDate, shiftName: v.shiftName, workingTimes: v.workingTimes, description: v.description, requirements: v.requirements, openCount: v.openCount, status: st, firstReleasedAt: v.firstReleasedAt || cur.firstReleasedAt || null };
    if (cur.payRate && !next.payRate) next.payRate = cur.payRate;
    if (JSON.stringify(cur) !== JSON.stringify(next)) { db.vacancies[v.id] = next; save(); }
  }
  S5.syncFacts = syncFacts;
  if (window.S3) (function () {
    var _vacs = S3.vacancies, _vac = S3.vacancy, _bks = S3.bookings, _bk = S3.booking, A = S3.act;
    function rawVacancyStatus(o, v) {
      if (v.cancelledAt) return 'Cancelled';
      if (v.closedAt && (!v.reopenedAt || v.closedAt > v.reopenedAt) && o.openCount === 0) return 'Closed';
      if (!v.publishedAt) return 'Draft';
      if (o.openCount === 0 && o.filledCount > 0) return 'Filled';
      if (o.filledCount > 0) return 'Partially Filled';
      if (o.firstReleasedAt) return 'Released to Agencies';      // the step slice 5 adds (TSD §3.3.1 rule 1)
      return 'Open (Abstract Tier)';
    }
    // the first wave's time: Abstract's copy reads the release rows, the client's the vacancy's facts (it holds no release row)
    function firstReleased(vid) { var r = db.releases.filter(function (x) { return x.vacancyId === vid && x.agencyId; }).sort(function (a, b) { return a.releasedAt < b.releasedAt ? -1 : 1; })[0]; if (r) return r.releasedAt; var f = db.vacancies[vid]; return f && f.firstReleasedAt || null; }
    function overlayV(v) {
      if (!on()) return v;
      var o = Object.assign({}, v), ab = db.bookings.filter(function (b) { return b.vacancyId === v.id && b.status !== 'Cancelled'; });
      o.rosterRows = v.rosterRows.map(function (r) {
        var x = Object.assign({}, r), b = ab.filter(function (y) { return y.positionNumber === r.n; })[0];
        if (b) Object.assign(x, { status: 'Filled', bookingId: b.id, bookingReference: b.reference, candidateName: b.candidateName, candidateId: b.candidateId, filledAt: b.createdAt, bookingStartDate: b.startDate, supplyingParty: agencyName(b.agencyId), cancelledAt: null, cancelledReason: null });
        return x;
      });
      o.openCount = o.rosterRows.filter(function (r) { return r.status === 'Open'; }).length;
      o.filledCount = o.rosterRows.filter(function (r) { return r.status === 'Filled'; }).length;
      o.cancelledCount = o.rosterRows.filter(function (r) { return r.status === 'Cancelled'; }).length;
      o.positionCount = o.openCount + o.filledCount;
      o.firstReleasedAt = firstReleased(v.id); o.fulfillmentTier = o.firstReleasedAt ? 2 : 1;
      o.status = rawVacancyStatus(o, v);
      syncFacts(o);
      return o;
    }
    function dressAB(b) {
      var v = _vac(b.vacancyId), r = S3.resolveRate(b.jobRoleId, b.clientId, b.orgNodeId, b.shiftId);
      var o = Object.assign({}, b, { clientName: S3.CLIENTS[b.clientId].name, jobRoleTitle: S3.JOB_ROLES[b.jobRoleId], orgNodeName: S3.nodeName(b.clientId, b.orgNodeId), orgNodePath: S3.nodePath(b.clientId, b.orgNodeId), shiftName: S3.shiftName(b.clientId, b.shiftId), vacancyReference: v ? v.reference : b.vacancyReference, jobTitle: v ? v.jobTitle : b.jobTitle, positionTotal: v ? overlayV(v).positionCount : 0, rate: r, chargeRate: r ? r.charge : null, supplyingParty: agencyName(b.agencyId) });
      // a client never reads the source or the agency's id (XR-001, DV-006)
      delete o.source; delete o.agencyId;
      return o;
    }
    function overlayB(b) {
      if (!b || !on()) return b;
      var o = Object.assign({}, b); o.proposalId = null;
      return o;
    }
    S3.vacancies = function () { return _vacs().map(overlayV); };
    S3.vacancy = function (id) { var v = _vac(id); return v ? overlayV(v) : v; };
    S3.bookings = function () { var r = _bks().map(overlayB); return on() ? db.bookings.filter(function (b) { return !S3.clientId || b.clientId === S3.clientId; }).map(dressAB).concat(r) : r; };
    S3.booking = function (id) { var a = rawAB(id); if (a) return on() && (!S3.clientId || a.clientId === S3.clientId) ? dressAB(a) : null; return overlayB(_bk(id)); };
    // the writes: an Agency-sourced booking's own lifecycle, and the proposals a fill, a close or a cancel rejects
    function bookingActive(b) { if (S3.CLIENTS[b.clientId].status !== 'Active') refuse('BOOKING_CLIENT_NOT_ACTIVE', 'This client is ' + S3.CLIENTS[b.clientId].status + ', so its bookings take no extension, amendment or manual start or completion. A booking can still be cancelled.'); }
    function exhausted(vid) { var v = S3.vacancy(vid); if (v && v.openCount === 0 && ['Closed', 'Cancelled'].indexOf(v.status) < 0) rejectPending(vid, null, 'Rejected (Position Filled)'); syncFacts(v); save(); }
    var wrap = {
      fill: function (orig, f) {
        if (on()) { var v = S3.vacancy(f.vacancyId), r = v && v.rosterRows.filter(function (x) { return x.n === f.positionNumber; })[0]; if (r && r.status !== 'Open') refuse('POSITION_NOT_OPEN', 'Position ' + r.n + ' is no longer open: it reads ' + r.status + '. Go back to the vacancy to see who filled it.'); }
        var id = orig(f); if (on()) exhausted(f.vacancyId); return id;
      },
      changeCount: function (orig, id, n) {
        if (on()) { var v = S3.vacancy(id); if (n < v.filledCount) refuse('VACANCY_POSITION_COUNT_BELOW_FILLED', 'The count can’t go below the ' + v.filledCount + ' filled positions. Nothing was changed.', { filledCount: v.filledCount }); }
        orig(id, n); if (on()) exhausted(id);
      },
      close: function (orig, id, reason) { orig(id, reason); if (on()) { rejectPending(id, null, 'Rejected', 'Vacancy closed'); syncFacts(S3.vacancy(id)); save(); } },
      cancel: function (orig, id, reason) { orig(id, reason); if (on()) { rejectPending(id, null, 'Rejected', 'Vacancy cancelled'); syncFacts(S3.vacancy(id)); save(); } },
      extend: function (orig, id, end) { var b = rawAB(id); if (!b) return orig(id, end); bookingActive(b); var st = b.status, was = b.endDate; b.endDate = end; if (st === 'Active' || st === 'Extended') { b.status = 'Extended'; b.extendedAt = now(); } b.updatedAt = now(); log('booking', id, 'End date: ' + fmtDate(was) + ' → ' + fmtDate(end) + (st !== b.status ? '. Status: ' + st + ' → ' + b.status : '')); save(); },
      amend: function (orig, id, end, times) { var b = rawAB(id); if (!b) return orig(id, end, times); bookingActive(b); var parts = []; if (end && end !== b.endDate) { parts.push('End date: ' + fmtDate(b.endDate) + ' → ' + fmtDate(end)); b.endDate = end; } if (times !== b.workingTimes) { parts.push('Working times: ' + (b.workingTimes || 'none') + ' → ' + (times || 'none')); b.workingTimes = times; } b.updatedAt = now(); log('booking', id, parts.join('. ') || 'No change'); save(); },
      start: function (orig, id) { var b = rawAB(id); if (!b) return orig(id); bookingActive(b); b.status = 'Active'; b.startedAt = now(); b.startedBy = S5.me; b.updatedAt = now(); log('booking', id, 'Status: Pending Start → Active'); save(); },
      complete: function (orig, id) { var b = rawAB(id); if (!b) return orig(id); bookingActive(b); var st = b.status; b.status = 'Completed'; b.completedAt = now(); b.completedBy = S5.me; b.updatedAt = now(); log('booking', id, 'Status: ' + st + ' → Completed'); save(); },
      // BK-016: an Agency-sourced booking's cancel reopens its position; the proposal stays Accepted (terminal)
      cancelBooking: function (orig, id, reason) { var b = rawAB(id); if (!b) return orig(id, reason); var st = b.status; b.status = 'Cancelled'; b.cancelledAt = now(); b.cancelledBy = S5.me; b.cancellationReason = reason; b.updatedAt = now(); log('booking', id, 'Status: ' + st + ' → Cancelled. Reason: ' + reason); save(); syncFacts(S3.vacancy(b.vacancyId)); }
    };
    Object.keys(wrap).forEach(function (k) { var orig = A[k]; if (!orig) return; A[k] = function () { return wrap[k].apply(null, [orig].concat([].slice.call(arguments))); }; });
    // S3.audit carries an Agency-sourced booking's own entries
    var _audit = S3.audit;
    S3.audit = function (type, id) { var a = _audit(type, id); if (!on()) return a; return a.concat(db.audit.filter(function (x) { return x.type === type && x.id === id; }).map(function (x) { return { type: x.type, id: x.id, at: x.at, by: x.by, label: /created/i.test(x.text) ? 'Created' : 'Updated', text: x.text }; })).sort(function (p, q) { return p.at < q.at ? 1 : -1; }); };
  })();

  // ---------- the slice 4 seam (Abstract and client): the Agency-sourced booking's weeks, the confirmation states ----------
  // BK-2210's two weeks, in slice 4's stored shape (built by slice4-proto.js's own helpers): the week of 28 Sep is
  // approved and invoiced (the prototype stand-in above), with a Justified sick day and a no-show whose pay Abstract
  // overrode; the week of 5 Oct is open, with a no-show Requested (awaiting agency) and a sick day Not Requested.
  function s4weeks(h) {
    var W3 = '2026-09-28', W4 = '2026-10-05';
    var d1 = {}; d1[W3] = h.W('8.00', 'sh-pm'); d1[h.addDays(W3, 1)] = h.W('8.00', 'sh-pm');
    d1[h.addDays(W3, 2)] = h.day('Sick Leave', null, 'sh-pm', { shiftDefaulted: true, absenceComment: 'Phoned the branch before the shift.' });
    // the client's copy holds the override's marker alone: never its reason, who or when (slice 4 DR-S6; TSD §3.3.6 rule 2)
    d1[h.addDays(W3, 3)] = h.day('No-show', null, 'sh-pm', { shiftDefaulted: true, payOverride: { value: 'Paid' } });
    d1[h.addDays(W3, 4)] = h.W('8.00', 'sh-pm'); d1[h.addDays(W3, 5)] = h.NB(); d1[h.addDays(W3, 6)] = h.NB();
    var t1 = h.ts('ts-s5-1', 'b2210', W3, 'Approved', d1, { submittedAt: '2026-10-05T09:30:00', submittedBy: 'Rachel Green', submittedLate: false, approvedAt: '2026-10-05T09:30:00', approvedBy: null, approvalMode: 'automatic', updatedAt: '2026-10-05T09:30:00' });
    t1.approvals.push(h.approved(W3, '2026-10-05T09:30:00', null, 'automatic', d1));
    t1.events.push({ at: '2026-10-05T09:30:00', by: 'Rachel Green', text: 'Submitted' }); t1.events.push({ at: '2026-10-05T09:30:00', by: null, text: 'Approved automatically at submission' });
    var d2 = {}; d2[W4] = h.W('8.00', 'sh-pm'); d2[h.addDays(W4, 1)] = h.W('8.00', 'sh-pm');
    d2[h.addDays(W4, 2)] = h.day('No-show', null, null, { absenceComment: 'Did not arrive; the site called the branch at 14:30.' });
    d2[h.addDays(W4, 3)] = h.day('Sick Leave', null, 'sh-pm', { shiftDefaulted: true, absenceComment: 'Texted the site at 12:00.' });
    d2[h.addDays(W4, 4)] = h.W('8.00', 'sh-pm');
    var t2 = h.ts('ts-s5-2', 'b2210', W4, 'Draft', d2, { updatedAt: '2026-10-09T17:00:00' });
    t2.events.push({ at: '2026-10-07T15:10:00', by: 'Rachel Green', text: 'Wed 7 Oct: No-show. Agency confirmation requested' });
    t2.events.push({ at: '2026-10-08T12:20:00', by: 'Rachel Green', text: 'Thu 8 Oct: Sick Leave' });
    return [t1, t2];
  }
  function abstractParty() { return PARTY; }
  // leave.auto_request_confirmation resolved at the client (CFG-006): Acme asks for confirmation by default
  var AUTO_REQUEST = { acme: true };
  S5.autoRequest = function (clientId) { return !!AUTO_REQUEST[clientId]; };
  function isAgency(b) { return !!b && !!rawAB(b.id); }
  function chip(state, small) { return S5.ui.confBadge(state, small); }
  S5.s4 = {
    // seed(list, helpers): add the slice 5 weeks to slice 4's store if they are missing; true when it added any
    // (a week the client's copy seeded first carries the override's marker alone; Abstract's copy fills in the rest)
    ensure: function (list, h) {
      var added = false;
      s4weeks(h).forEach(function (t) {
        var cur = list.filter(function (x) { return x.id === t.id; })[0];
        if (!cur) { list.push(t); added = true; return; }
        Object.keys(t.days).forEach(function (dt) { var a = t.days[dt] && t.days[dt].payOverride, c = cur.days[dt] && cur.days[dt].payOverride; if (a && c && a.value === c.value) Object.keys(a).forEach(function (k) { if (!(k in c)) { c[k] = a[k]; added = true; } }); });
      });
      return added;
    },
    // dress(o, booking, raw): an Agency-sourced week's source, supplying party, invoiced stand-in and confirmation states
    dress: function (o, b, t) {
      if (!on() || !isAgency(b)) return;
      var ab = rawAB(b.id), inv = invoiced(b.id, o.weekStart);
      o.supplyingParty = agencyName(ab.agencyId); o.invoicedAt = inv ? inv.invoicedAt : null; o.invoicedStandIn = !!inv;
      delete o.source; delete o.agencyId; delete o.agencyName;
      o.agencySourced = true; o.requestedDays = 0;
      o.days.forEach(function (y) { y.confirmationState = confState(b.id, y.date, y.dayStatus); y.confirmation = confOf(b.id, y.date); if (y.confirmationState === 'Requested (awaiting agency)') o.requestedDays++; });
      // the snapshot the agency's copy reads (no charge, no worker pay: the agency's projection of the week)
      var snap = { id: o.id, bookingId: b.id, weekStart: o.weekStart, status: o.status, days: o.days.map(function (y) { return { date: y.date, dayStatus: y.dayStatus, hours: y.hours, shiftName: y.shiftName || null, absenceComment: y.absenceComment || null, absencePay: y.absencePay || null, overridden: !!y.absencePayOverride, inRange: y.inRange }; }) };
      if (!o.blank && JSON.stringify(db.weeks[o.id]) !== JSON.stringify(snap)) { db.weeks[o.id] = snap; save(); }
    },
    // check(booking, inputs): refuse requestConfirmation where it is not offered (TS-067)
    check: function (b, inputs) {
      inputs.forEach(function (inp) { if (inp.requestConfirmation === true && (!on() || !isAgency(b) || ABSENCES.indexOf(inp.dayStatus) < 0)) refuse('TIMESHEET_CONFIRMATION_NOT_OFFERED', 'Agency confirmation can only be requested on an absence of an Agency-sourced booking.', { date: inp.date }); });
    },
    // written(booking, changes): §3.3.7 rules 1 and 4 after a day write; changes = [{ date, prev, next, requestConfirmation }]
    written: function (b, changes) {
      if (!on() || !isAgency(b)) return;
      changes.forEach(function (c) {
        var k = confKey(b.id, c.date), had = db.confirmations[k], nextAbs = ABSENCES.indexOf(c.next) >= 0;
        if (c.prev !== c.next) {
          if (had) { delete db.confirmations[k]; log('timesheet', b.id, fmtDate(c.date) + ': the day changed, so its agency confirmation ended' + (had.justification ? ' (the reason stays in the audit)' : '')); }
          if (nextAbs && (c.requestConfirmation === true || (c.requestConfirmation === undefined && AUTO_REQUEST[b.clientId]))) db.confirmations[k] = { requestedAt: now(), requestedByParty: c.requestConfirmation === true ? PARTY : 'policy', requestedByName: c.requestConfirmation === true ? S5.me : null, justification: null, justifiedAt: null, justifiedByName: null };
        } else if (nextAbs && c.requestConfirmation === true && !had) {
          db.confirmations[k] = { requestedAt: now(), requestedByParty: PARTY, requestedByName: S5.me, justification: null, justifiedAt: null, justifiedByName: null };
        }
      });
      save();
    },
    // POST …/days/:date/confirmation-request — the standalone request on a Not Requested absence, any week status
    request: function (b, y, o) {
      o = o || {};
      if (!isAgency(b) || ABSENCES.indexOf(y.dayStatus) < 0) refuse('TIMESHEET_CONFIRMATION_NOT_OFFERED', 'Agency confirmation can only be requested on an absence of an Agency-sourced booking.', { date: y.date });
      var k = confKey(b.id, y.date);
      if (o.simulateStale || db.confirmations[k]) refuse('TIMESHEET_CONFIRMATION_STATE_INVALID', fmtDate(y.date) + ' is ' + (o.simulateStale ? 'Justified' : confState(b.id, y.date, y.dayStatus)) + ' already: ' + agencyName(rawAB(b.id).agencyId) + ' answered while you had the week open. The week now shows the latest.', { confirmationState: o.simulateStale ? 'Justified' : confState(b.id, y.date, y.dayStatus) });
      db.confirmations[k] = { requestedAt: now(), requestedByParty: PARTY, requestedByName: S5.me, justification: null, justifiedAt: null, justifiedByName: null }; save();
    },
    // the absence modal's section (TS-020, TS-022): offered on an Agency-sourced booking's absence only
    dialogHtml: function (x, y, st) {
      if (!on() || !x.agencySourced || ABSENCES.indexOf(st) < 0) return '';
      var same = y.dayStatus === st, cs = same ? y.confirmationState : null, ag = esc(x.supplyingParty), c = same ? y.confirmation : null;
      if (cs === 'Requested (awaiting agency)') return '<div class="rounded-lg border border-amber-200 bg-amber-50/60 p-3"><p class="text-xs font-semibold text-slate-700 mb-1.5">Agency confirmation</p>' + chip(cs) + '<p class="text-xs text-slate-600 mt-1.5">Requested ' + (c.requestedByParty === 'policy' ? 'automatically (client setting)' : 'by ' + esc(c.requestedByName || (c.requestedByParty === 'abstract' ? 'Abstract' : 'the client'))) + ' on ' + fmtDateTime(c.requestedAt) + '. ' + ag + ' gives the reason; this never holds the week.</p></div>';
      if (cs === 'Justified') return '<div class="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3"><p class="text-xs font-semibold text-slate-700 mb-1.5">Agency confirmation</p>' + chip(cs) + '<p class="text-xs text-slate-700 mt-1.5"><span class="font-semibold">' + ag + '’s reason:</span> ' + esc(c.justification) + '</p><p class="text-xs text-slate-500 mt-0.5">Given on ' + fmtDateTime(c.justifiedAt) + '. Changing the day’s status ends the confirmation.</p></div>';
      var def = same ? false : !!AUTO_REQUEST[x.clientId];
      return '<label class="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:border-blue-300 cursor-pointer"><input type="checkbox" id="d-rc" class="mt-0.5"' + (def ? ' checked' : '') + '/><span class="min-w-0"><span class="block text-sm font-semibold text-slate-800">Request agency confirmation</span><span class="block text-xs text-slate-600 mt-0.5">' + ag + ' is asked to confirm the absence and give a reason. It never holds the week.' + (same ? '' : ' Ticked by default: the client’s leave policy asks for it.') + '</span></span></label>';
    },
    // a cell's marker: the requested and justified states read on the grid itself
    cellMark: function (y) {
      if (!on() || !y.confirmationState || y.confirmationState === 'Not Requested') return '';
      return y.confirmationState === 'Justified' ? '<span class="absolute bottom-1 right-1 text-emerald-700" title="' + esc('Justified: ' + y.confirmation.justification) + '"><i class="fa-solid fa-circle-check text-[10px]" aria-hidden="true"></i></span>' : '<span class="absolute bottom-1 right-1 text-amber-700" title="' + CLABEL['Requested (awaiting agency)'] + '"><i class="fa-solid fa-hourglass-half text-[10px]" aria-hidden="true"></i></span>';
    },
    ariaPart: function (y) { return on() && y.confirmationState && y.confirmationState !== 'Not Requested' ? ', ' + (CLABEL[y.confirmationState] || y.confirmationState) : ''; },
    // the day-by-day table's status cell: the state's badge, the reason, and the standalone request on a Not Requested absence.
    // Not Requested draws no badge (ruled 2026-11-16, Ujjwal Sharma): such a day shows only the request link, where it is offered.
    dayHtml: function (x, y, canRequest) {
      if (!on() || !x.agencySourced || !y.confirmationState) return '';
      if (y.confirmationState === 'Not Requested' && !canRequest) return '';
      var c = y.confirmation, h = '<div class="mt-1.5 flex flex-col gap-1">' + (y.confirmationState === 'Not Requested' ? '' : chip(y.confirmationState, true));
      if (y.confirmationState === 'Justified') h += '<p class="text-[11px] text-slate-700"><span class="font-semibold">' + esc(x.supplyingParty) + '’s reason:</span> ' + esc(c.justification) + '</p>';
      else if (y.confirmationState === 'Requested (awaiting agency)') h += '<p class="text-[11px] text-slate-600">Asked of ' + esc(x.supplyingParty) + ' on ' + fmtDateTime(c.requestedAt) + '</p>';
      else if (canRequest) h += '<button type="button" class="self-start text-[11px] font-semibold text-blue-700 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" data-s5-req="' + esc(y.date) + '">Request agency confirmation</button>';
      return h + '</div>';
    },
    legend: function () { return on() ? '<span role="listitem" class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"><i class="fa-solid fa-hourglass-half text-amber-700" aria-hidden="true"></i>' + CLABEL['Requested (awaiting agency)'] + '</span><span role="listitem" class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"><i class="fa-solid fa-circle-check text-emerald-700" aria-hidden="true"></i>Justified</span>' : ''; },
    party: abstractParty
  };

  // ---------- the look: badges as the kernel buckets them (design-tokens §5); every portal ----------
  var BUCKET = { neutral: 'bg-slate-100 text-slate-700 border border-slate-200', info: 'bg-blue-50 text-blue-700 border border-blue-200', waiting: 'bg-amber-50 text-amber-700 border border-amber-200', good: 'bg-emerald-50 text-emerald-700 border border-emerald-200', bad: 'bg-red-50 text-red-700 border border-red-200', closed: 'bg-slate-100 text-slate-600 border border-slate-200', released: 'bg-purple-50 text-purple-700 border border-purple-200' };
  // ProposalStatusBadge: Rejected (Position Filled) takes closed/archival with user-check — a system outcome, not a
  // judgement on the candidate (the pass's choice, flagged for K59). The confirmation words likewise (K59).
  var PWORD = { 'Submitted': ['info', 'fa-paper-plane'], 'Under Review': ['info', 'fa-magnifying-glass'], 'Accepted': ['good', 'fa-circle-check'], 'Rejected': ['bad', 'fa-circle-xmark'], 'Withdrawn': ['closed', 'fa-rotate-left'], 'Rejected (Position Filled)': ['closed', 'fa-user-check'] };
  var CWORD = { 'Not Requested': ['neutral', 'fa-minus'], 'Requested (awaiting agency)': ['waiting', 'fa-hourglass-half'], 'Justified': ['good', 'fa-circle-check'] };
  // the words a requested day reads on every portal's pages: design-tokens §6's pill, "Awaiting agency" (pill,
  // legend, cell mark and its aria text; ruled 2026-11-16, slice 5 TSD review R5-D6). The state's value is unchanged.
  // Every portal, the agency's included (R5-D6, widened 2026-11-16 by the coordinator's correction of the pass's brief).
  var CLABEL = { 'Requested (awaiting agency)': 'Awaiting agency' };
  function badge(map, s, small, label) { var w = map[s] || ['neutral', 'fa-circle']; return '<span class="inline-flex items-center gap-1.5 ' + (small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs') + ' rounded-full font-semibold whitespace-nowrap ' + BUCKET[w[0]] + '"><i class="fa-solid ' + w[1] + ' text-[10px]" aria-hidden="true"></i>' + esc(label || s) + '</span>'; }
  S5.ui = {
    proposalBadge: function (s, small) { return badge(PWORD, s, small); },
    confBadge: function (s, small) { return badge(CWORD, s, small, CLABEL[s]); },
    complianceBadge: function (s, small) { return badge({ Compliant: ['good', 'fa-circle-check'], Pending: ['waiting', 'fa-hourglass-half'], Expired: ['bad', 'fa-circle-xmark'] }, s, small); },
    licenceChip: function (l) { return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ' + (l.expired ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200') + '"><i class="fa-solid ' + (l.expired ? 'fa-circle-xmark' : 'fa-id-card') + ' text-[10px]" aria-hidden="true"></i>' + esc(l.licenceType) + (l.expiryDate ? ' · ' + (l.expired ? 'expired ' : 'until ') + fmtDate(l.expiryDate) : '') + '</span>'; }
  };
  S5.PROPOSAL_STATUSES = Object.keys(PWORD);
})();
