/* Portal config for slice1-kit.js — client portal. */
window.S1_CONFIG = {
  portal: 'client',
  signIn: 'client.identity-access.sign-in.html',
  dashboard: 'client.shell.dashboard.html',
  slice1Dashboard: 'client.shell.dashboard-slice-1.html',
  hub: 'client.design.slice-1-index.html',
  notificationsPage: 'client.notifications.notification-centre-slice-1.html',
  idleMinutes: 30,
  bellDrawer: true,
  navSelector: 'aside nav',
  groupSelector: 'nav > p, nav > div',
  // in slice 1 mode these full-product links point at their slice 1 counterparts
  slice1Swap: { 'client.notifications.notification-centre.html': 'client.notifications.notification-centre-slice-1.html' },
  slice1Screens: [
    'client.identity-access.sign-in.html', 'client.identity-access.users.html',
    'client.identity-access.activate-account.html', 'client.identity-access.permission-matrix.html',
    'client.shell.error-pages.html', 'client.identity-access.profile.html',
    'client.notifications.notification-centre-slice-1.html', 'client.shell.dashboard-slice-1.html',
    'client.design.slice-1-index.html'
  ],
  // slice 1 raises no notification for client users; the centre starts empty
  notifications: []
};
/*
 * slice1-kit.js — shared prototype behaviour for the slice 1 screens.
 *
 * One copy per portal repo; only the S1_CONFIG block at the top differs.
 * Everything is namespaced under window.S1 so it never collides with the
 * per-page toast()/openConfirm()/openNotifDrawer() helpers older screens carry.
 *
 * What it gives a screen:
 *   S1.toast(msg, tone)            kernel Toast: role=status, ~4 s, max 3 stacked
 *   S1.confirm({...})              ConfirmDialog, neutral or destructive, optional required reason
 *   S1.openModal(id)/closeModal(id) show/hide a page-authored [data-s1-modal] overlay
 *   S1.openDrawer()/closeDrawer()  notification Drawer (portals with bellDrawer: true)
 *   S1.notify({...})               push a notification into the drawer + unread count
 *   S1.runJob(chip, {...})         background-job chip: queued → running → completed | failed
 *   S1.sessionWarning()            idle-timeout warning dialog (NFR-009)
 *   S1.setState(name)              prototype state switcher (loading, empty, error, …)
 *   S1.slice1Mode(on)              hide every sidebar link that is not a slice 1 screen, and every
 *                                  element marked data-s1-later (a later slice's affordance);
 *                                  links marked data-s1-home point at the slice 1 dashboard
 *
 * State switcher contract (declare on <body>):
 *   data-s1-states="default loading empty error validation denied large"
 *   elements carry data-s1-show="loading empty" (visible only in those states) or
 *   data-s1-hide="loading" (hidden in those states). A 's1:state' event fires on
 *   document with detail.state for anything a page wants to do in JS.
 *   ?state=<name> in the URL selects the initial state.
 */
(function () {
  'use strict';
  var C = window.S1_CONFIG || {};

  // ---------- storage (per-viewer convenience only; always optional) ----------
  function sget(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private window */ } }

  // ---------- styles (plain CSS, so the Tailwind CDN JIT cannot drop them) ----------
  var css = [
    '.s1-scrim{position:fixed;inset:0;background:rgba(15,26,62,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:60;display:flex;align-items:center;justify-content:center;padding:16px}',
    '.s1-dialog{background:#fff;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,.35);width:100%;max-width:440px;font-family:Inter,sans-serif;color:#0f172a;overflow:hidden}',
    '.s1-dialog h2{font-size:16px;font-weight:700;margin:0}',
    '.s1-dialog p{font-size:14px;line-height:1.6;color:#475569;margin:0}',
    '.s1-dlg-body{padding:20px 20px 8px;display:flex;gap:14px}',
    '.s1-dlg-icon{width:40px;height:40px;border-radius:9999px;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.s1-dlg-foot{display:flex;justify-content:flex-end;gap:8px;padding:16px 20px 20px}',
    '.s1-btn{font:600 14px/1 Inter,sans-serif;border-radius:8px;padding:10px 16px;border:1px solid #e2e8f0;background:#fff;color:#334155;cursor:pointer;min-height:38px}',
    '.s1-btn:hover{background:#f8fafc}',
    '.s1-btn:focus-visible,.s1-sw button:focus-visible{outline:2px solid #1D4ED8;outline-offset:2px}',
    '.s1-btn-primary{border:0;color:#fff;background:linear-gradient(135deg,#1D4ED8,#5B2E91)}',
    '.s1-btn-primary:hover{filter:brightness(1.08);background:linear-gradient(135deg,#1D4ED8,#5B2E91)}',
    '.s1-btn-danger{border:0;color:#fff;background:#dc2626}.s1-btn-danger:hover{background:#b91c1c}',
    '.s1-btn[disabled]{opacity:.5;cursor:not-allowed}',
    '.s1-field{display:block;margin:12px 0 0}.s1-field span{display:block;font-size:12px;font-weight:600;color:#334155;margin-bottom:6px}',
    '.s1-field textarea{width:100%;box-sizing:border-box;border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:10px 12px;font:14px Inter,sans-serif;min-height:76px;resize:vertical}',
    '.s1-field textarea:focus{outline:none;border-color:#1D4ED8;box-shadow:0 0 0 3px rgba(29,78,216,.15);background:#fff}',
    '.s1-toasts{position:fixed;right:16px;bottom:16px;z-index:70;display:flex;flex-direction:column;gap:8px;max-width:calc(100vw - 32px);width:380px}',
    '.s1-toast{display:flex;align-items:flex-start;gap:10px;background:#0f172a;color:#fff;border-radius:12px;padding:12px 14px;box-shadow:0 10px 25px rgba(0,0,0,.25);font:500 14px/1.45 Inter,sans-serif;animation:s1in .18s ease-out}',
    '.s1-toast a{color:#93c5fd;font-weight:600}.s1-toast button{margin-left:auto;background:none;border:0;color:#94a3b8;cursor:pointer;font-size:14px;padding:0 2px}',
    '@keyframes s1in{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}',
    '@media (prefers-reduced-motion:reduce){.s1-toast,.s1-drawer{animation:none!important;transition:none!important}}',
    '.s1-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:9999px;font:600 12px/1.2 Inter,sans-serif;border:1px solid}',
    '.s1-b-neutral{background:#f1f5f9;color:#334155;border-color:#e2e8f0}',
    '.s1-b-info{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}',
    '.s1-b-good{background:#ecfdf5;color:#047857;border-color:#a7f3d0}',
    '.s1-b-bad{background:#fef2f2;color:#b91c1c;border-color:#fecaca}',
    '.s1-drawer-scrim{position:fixed;inset:0;background:rgba(15,26,62,.35);z-index:55;opacity:0;pointer-events:none;transition:opacity .2s}',
    '.s1-drawer-scrim.open{opacity:1;pointer-events:auto}',
    '.s1-drawer{position:fixed;top:0;right:0;height:100%;width:400px;max-width:100vw;background:#fff;z-index:56;box-shadow:0 25px 50px -12px rgba(0,0,0,.35);transform:translateX(100%);transition:transform .22s ease-out;display:flex;flex-direction:column;font-family:Inter,sans-serif}',
    '.s1-drawer.open{transform:none}',
    '@media (max-width:640px){.s1-drawer{top:auto;bottom:0;height:85%;width:100%;border-radius:16px 16px 0 0;transform:translateY(100%)}.s1-drawer.open{transform:none}}',
    '.s1-dr-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #e2e8f0}',
    '.s1-dr-list{flex:1;overflow-y:auto}',
    '.s1-dr-foot{border-top:1px solid #e2e8f0;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}',
    '.s1-ni{display:flex;gap:12px;padding:14px 20px;border-bottom:1px solid #f1f5f9;text-decoration:none;color:inherit}',
    '.s1-ni:hover{background:#f8fafc}.s1-ni.unread{background:#f8fbff}',
    '.s1-ni-t{font-size:14px;color:#0f172a;margin:0;line-height:1.35}.s1-ni.unread .s1-ni-t{font-weight:700}',
    '.s1-ni-b{font-size:12px;color:#475569;margin:3px 0 0;line-height:1.5}.s1-ni-m{font-size:12px;color:#64748b;margin:4px 0 0}',
    '.s1-sev{width:30px;height:30px;border-radius:9999px;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;font-size:12px}',
    '.s1-sev::after{content:"";position:absolute;top:-1px;right:-1px;width:9px;height:9px;border-radius:9999px;border:2px solid #fff}',
    '.s1-sev-info{background:#f1f5f9;color:#475569}.s1-sev-info::after{background:#64748b}',
    '.s1-sev-warning{background:#fffbeb;color:#b45309}.s1-sev-warning::after{background:#f59e0b}',
    '.s1-sev-critical{background:#fef2f2;color:#b91c1c}.s1-sev-critical::after{background:#dc2626}',
    '.s1-bell-count{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9999px;background:#dc2626;color:#fff;font:700 10px/18px Inter,sans-serif;text-align:center;border:2px solid #fff;box-sizing:content-box}',
    '.s1-sw{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:50;font-family:Inter,sans-serif}',
    '.s1-sw>button{display:flex;align-items:center;gap:8px;background:#0f172a;color:#fff;border:0;border-radius:9999px;padding:8px 14px;font:600 12px Inter,sans-serif;cursor:pointer;box-shadow:0 10px 25px rgba(0,0,0,.25)}',
    '.s1-sw-panel{position:absolute;left:50%;transform:translateX(-50%);bottom:44px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 25px 50px -12px rgba(0,0,0,.3);padding:8px;width:240px;display:none}',
    '.s1-sw.open .s1-sw-panel{display:block}',
    '.s1-sw-panel p{font:600 11px Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:8px 8px 4px}',
    '.s1-sw-panel button{display:flex;width:100%;text-align:left;align-items:center;gap:8px;background:none;border:0;border-radius:8px;padding:8px;font:500 13px Inter,sans-serif;color:#334155;cursor:pointer}',
    '.s1-sw-panel button:hover{background:#f1f5f9}.s1-sw-panel button[aria-pressed="true"]{background:#eff6ff;color:#1d4ed8;font-weight:600}',
    '[data-s1-show]{display:none!important}',
    '@media print{.s1-sw,.s1-toasts{display:none}}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 's1-kit-css'; st.textContent = css;
  document.head.appendChild(st);

  var S1 = window.S1 = {};
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  S1.esc = esc;

  // ---------- Toast ----------
  var region;
  S1.toast = function (msg, tone, opts) {
    opts = opts || {};
    if (!region) { region = el('div', { 'class': 's1-toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(region); }
    var icon = { success: 'fa-circle-check" style="color:#34d399', error: 'fa-circle-exclamation" style="color:#f87171', info: 'fa-circle-info" style="color:#93c5fd', busy: 'fa-spinner fa-spin" style="color:#93c5fd' }[tone || 'success'];
    var t = el('div', { 'class': 's1-toast' }, '<i class="fa-solid ' + icon + ';margin-top:3px"></i><div>' + msg + '</div><button aria-label="Dismiss">&times;</button>');
    t.querySelector('button').onclick = function () { t.remove(); };
    region.appendChild(t);
    while (region.children.length > 3) region.firstChild.remove();
    setTimeout(function () { t.remove(); }, opts.ms || 4200);
    return t;
  };

  // ---------- ConfirmDialog ----------
  var lastFocus;
  function trap(scrim, onClose) {
    lastFocus = document.activeElement;
    scrim.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { onClose(); }
      if (e.key === 'Tab') {
        var f = scrim.querySelectorAll('button,textarea,input,select,a[href]');
        if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { z.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault(); }
      }
    });
  }
  S1.confirm = function (o) {
    var danger = o.tone === 'danger';
    var scrim = el('div', { 'class': 's1-scrim', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 's1-dlg-t' });
    var iconBg = danger ? 'background:#fef2f2;color:#dc2626' : (o.tone === 'warning' ? 'background:#fffbeb;color:#b45309' : 'background:#eff6ff;color:#1d4ed8');
    var icon = o.icon || (danger ? 'fa-triangle-exclamation' : 'fa-circle-question');
    scrim.innerHTML = '<div class="s1-dialog"><div class="s1-dlg-body"><div class="s1-dlg-icon" style="' + iconBg + '"><i class="fa-solid ' + icon + '"></i></div><div style="flex:1;min-width:0"><h2 id="s1-dlg-t">' + esc(o.title) + '</h2><p style="margin-top:6px">' + (o.bodyHtml || esc(o.body || '')) + '</p>' +
      (o.reason ? '<label class="s1-field"><span>' + esc(o.reasonLabel || 'Reason (required)') + '</span><textarea id="s1-dlg-reason" placeholder="' + esc(o.reasonPlaceholder || '') + '"></textarea></label>' : '') +
      '</div></div><div class="s1-dlg-foot">' + (o.hideCancel ? '' : '<button class="s1-btn" data-x>' + esc(o.cancel || 'Cancel') + '</button>') +
      (o.cta ? '<button class="s1-btn ' + (danger ? 's1-btn-danger' : 's1-btn-primary') + '" data-ok>' + esc(o.cta) + '</button>' : '') + '</div></div>';
    function close() { scrim.remove(); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
    trap(scrim, close);
    document.body.appendChild(scrim);
    var ok = scrim.querySelector('[data-ok]'), x = scrim.querySelector('[data-x]'), r = scrim.querySelector('#s1-dlg-reason');
    if (x) x.onclick = close;
    scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
    if (r && ok) { ok.disabled = true; r.addEventListener('input', function () { ok.disabled = !r.value.trim(); }); }
    if (ok) ok.onclick = function () {
      ok.disabled = true; ok.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + esc(o.busy || o.cta);
      setTimeout(function () { close(); if (o.onConfirm) o.onConfirm(r ? r.value.trim() : undefined); }, o.delay == null ? 500 : o.delay);
    };
    (r || ok || x).focus();
    return { close: close };
  };

  // ---------- page-authored modals: <div data-s1-modal id="x" class="hidden ..."> ----------
  S1.openModal = function (id) {
    var m = document.getElementById(id); if (!m) return;
    lastFocus = document.activeElement;
    m.classList.remove('hidden'); m.style.display = '';
    var f = m.querySelector('input,textarea,select,button'); if (f) f.focus();
    if (!m._s1) { m._s1 = 1; m.addEventListener('keydown', function (e) { if (e.key === 'Escape') S1.closeModal(id); }); }
  };
  S1.closeModal = function (id) {
    var m = document.getElementById(id); if (!m) return;
    m.classList.add('hidden'); if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  // ---------- Notification drawer (A3) ----------
  var NKEY = 's1-notifs-' + (C.portal || 'x');
  var seed = C.notifications || [];
  var notifs;
  try { notifs = JSON.parse(sget(NKEY) || 'null'); } catch (e) { notifs = null; }
  if (!Array.isArray(notifs)) notifs = seed.slice();
  function saveN() { sset(NKEY, JSON.stringify(notifs.slice(0, 40))); }
  S1.notifications = function () { return notifs; };
  S1.unread = function () { return notifs.filter(function (n) { return !n.read; }).length; };
  var sevIcon = { info: 'fa-circle-info', warning: 'fa-triangle-exclamation', critical: 'fa-circle-exclamation' };
  S1.renderNotif = function (n, i) {
    var sev = n.severity || 'info';
    return '<a class="s1-ni' + (n.read ? '' : ' unread') + '" href="' + esc(n.href || '#') + '" data-i="' + i + '">' +
      '<span class="s1-sev s1-sev-' + sev + '" title="Severity: ' + sev + '"><i class="fa-solid ' + sevIcon[sev] + '" aria-hidden="true"></i><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">' + sev + ' notification</span></span>' +
      '<span style="flex:1;min-width:0;display:block"><p class="s1-ni-t">' + esc(n.title) + '</p><p class="s1-ni-b">' + esc(n.body || '') + '</p><p class="s1-ni-m">' + esc(n.when || 'Just now') + (n.read ? '' : ' · <span style="color:#1d4ed8;font-weight:600">Unread</span>') + '</p></span></a>';
  };
  var drawer, dscrim;
  function paintBells() {
    var u = S1.unread();
    document.querySelectorAll('[data-s1-bell]').forEach(function (b) {
      var c = b.querySelector('.s1-bell-count');
      if (!c) { c = el('span', { 'class': 's1-bell-count', 'aria-hidden': 'true' }); b.appendChild(c); }
      c.textContent = u > 99 ? '99+' : u; c.style.display = u ? '' : 'none';
      b.setAttribute('aria-label', 'Notifications, ' + u + ' unread');
    });
    document.dispatchEvent(new CustomEvent('s1:notifs'));
  }
  function paintDrawer() {
    if (!drawer) return;
    var list = drawer.querySelector('.s1-dr-list'), u = S1.unread();
    drawer.querySelector('.s1-dr-count').textContent = u ? u + ' unread' : '';
    drawer.querySelector('.s1-dr-count').style.display = u ? '' : 'none';
    list.innerHTML = notifs.length ? notifs.slice(0, 8).map(S1.renderNotif).join('') :
      '<div style="padding:56px 24px;text-align:center"><div style="width:48px;height:48px;margin:0 auto 12px;border-radius:9999px;background:#ecfdf5;color:#047857;display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-check"></i></div><p style="font-weight:700;font-size:14px;margin:0;color:#0f172a">You\'re all caught up</p><p style="font-size:13px;color:#64748b;margin:6px 0 0">New notifications appear here.</p></div>';
    list.querySelectorAll('.s1-ni').forEach(function (a) { a.addEventListener('click', function () { var n = notifs[+a.dataset.i]; if (n) { n.read = true; saveN(); } }); });
  }
  S1.markAllRead = function () { notifs.forEach(function (n) { n.read = true; }); saveN(); paintDrawer(); paintBells(); };
  S1.markRead = function (i) { if (notifs[i]) { notifs[i].read = true; saveN(); paintDrawer(); paintBells(); } };
  S1.notify = function (n) { notifs.unshift(Object.assign({ when: 'Just now', read: false, severity: 'info' }, n)); saveN(); paintDrawer(); paintBells(); };
  S1.resetNotifications = function (empty) { notifs = empty ? [] : seed.slice(); saveN(); paintDrawer(); paintBells(); };
  function buildDrawer() {
    dscrim = el('div', { 'class': 's1-drawer-scrim' });
    drawer = el('aside', { 'class': 's1-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Notifications' },
      '<div class="s1-dr-head"><div style="display:flex;align-items:center;gap:10px"><h2 style="font-size:16px;font-weight:700;margin:0;color:#0f172a">Notifications</h2><span class="s1-dr-count s1-badge s1-b-info"></span></div>' +
      '<button class="s1-btn" style="border:0;padding:8px 10px" aria-label="Close notifications" data-close><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="s1-dr-list"></div>' +
      '<div class="s1-dr-foot"><button class="s1-btn" style="border:0;padding:8px 0;color:#1d4ed8" data-all>Mark all as read</button>' +
      (C.notificationsPage ? '<a class="s1-btn" style="text-decoration:none" href="' + esc(C.notificationsPage) + '">View all</a>' : '') + '</div>');
    document.body.appendChild(dscrim); document.body.appendChild(drawer);
    dscrim.onclick = S1.closeDrawer;
    drawer.querySelector('[data-close]').onclick = S1.closeDrawer;
    drawer.querySelector('[data-all]').onclick = S1.markAllRead;
    drawer.addEventListener('keydown', function (e) { if (e.key === 'Escape') S1.closeDrawer(); });
  }
  S1.openDrawer = function () {
    if (!drawer) buildDrawer();
    paintDrawer(); lastFocus = document.activeElement;
    dscrim.classList.add('open'); drawer.classList.add('open');
    drawer.querySelector('[data-close]').focus();
  };
  S1.closeDrawer = function () {
    if (!drawer) return;
    dscrim.classList.remove('open'); drawer.classList.remove('open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  // ---------- Background job chip (A6) ----------
  var jobBadge = { queued: 's1-b-neutral', running: 's1-b-info', completed: 's1-b-good', failed: 's1-b-bad' };
  var jobIcon = { queued: 'fa-clock', running: 'fa-spinner fa-spin', completed: 'fa-check', failed: 'fa-xmark' };
  S1.jobChip = function (state) {
    return '<span class="s1-badge ' + jobBadge[state] + '"><i class="fa-solid ' + jobIcon[state] + '" style="font-size:10px" aria-hidden="true"></i>' + state + '</span>';
  };
  S1.runJob = function (host, o) {
    o = o || {};
    host = typeof host === 'string' ? document.querySelector(host) : host;
    if (!host) return;
    var label = o.label || 'export';
    S1.toast('Preparing your ' + esc(label) + '… We\'ll notify you when it\'s ready.', 'busy');
    host.innerHTML = S1.jobChip('queued');
    setTimeout(function () { host.innerHTML = S1.jobChip('running'); }, o.t1 || 900);
    setTimeout(function () {
      if (o.fail) {
        host.innerHTML = S1.jobChip('failed') + ' <button class="s1-btn" style="padding:6px 10px;min-height:0;font-size:12px;margin-left:6px" data-retry><i class="fa-solid fa-rotate-right"></i> Try again</button>';
        host.querySelector('[data-retry]').onclick = function () { S1.runJob(host, Object.assign({}, o, { fail: false })); };
        S1.toast('Your ' + esc(label) + ' failed. Nothing was downloaded — try again.', 'error');
        return;
      }
      var file = o.file || (label.replace(/\W+/g, '-').toLowerCase() + '.csv');
      host.innerHTML = S1.jobChip('completed') + ' <a href="#" class="s1-dl" style="margin-left:6px;font:600 12px Inter,sans-serif;color:#1d4ed8"><i class="fa-solid fa-download"></i> ' + esc(file) + '</a>';
      host.querySelector('.s1-dl').onclick = function (e) { e.preventDefault(); S1.toast('Downloading ' + esc(file) + '.', 'success'); };
      if (o.notify !== false) S1.notify({ severity: 'info', title: o.doneTitle || ('Your ' + label + ' is ready'), body: o.doneBody || (file + ' is ready to download.'), href: o.href || location.pathname.split('/').pop() });
      S1.toast((o.doneTitle || ('Your ' + esc(label) + ' is ready')) + '. <a href="#" onclick="event.preventDefault()">Download</a>', 'success');
    }, o.t2 || 3200);
  };

  // ---------- Session timeout warning (A4) ----------
  S1.sessionWarning = function (opts) {
    opts = opts || {};
    var secs = opts.seconds || 120, mins = C.idleMinutes || 30;
    var scrim = el('div', { 'class': 's1-scrim', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 's1-to-t', 'aria-describedby': 's1-to-d' });
    scrim.innerHTML = '<div class="s1-dialog"><div class="s1-dlg-body"><div class="s1-dlg-icon" style="background:#fffbeb;color:#b45309"><i class="fa-solid fa-hourglass-half"></i></div><div><h2 id="s1-to-t">You\'re about to be signed out</h2>' +
      '<p id="s1-to-d" style="margin-top:6px">You\'ll be signed out in <strong class="s1-cd" style="color:#0f172a;font-variant-numeric:tabular-nums">2:00</strong> because you\'ve been inactive for a while. Anything you haven\'t saved on this page will be lost.</p></div></div>' +
      '<div class="s1-dlg-foot"><a class="s1-btn" style="text-decoration:none" href="' + esc(C.signIn + '?reason=signed-out') + '">Sign out</a><button class="s1-btn s1-btn-primary" data-stay>Stay signed in</button></div></div>';
    document.body.appendChild(scrim);
    var cd = scrim.querySelector('.s1-cd'), left = secs;
    var timer = setInterval(function () {
      left--; cd.textContent = Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2);
      if (left <= 0) { clearInterval(timer); location.href = C.signIn + '?reason=idle&minutes=' + mins; }
    }, 1000);
    trap(scrim, function () { });
    scrim.querySelector('[data-stay]').onclick = function () { clearInterval(timer); scrim.remove(); S1.toast('You\'re still signed in.', 'success'); };
    scrim.querySelector('[data-stay]').focus();
  };

  // ---------- Signed-out banner on the sign-in page (A4) ----------
  S1.signedOutBanner = function (host) {
    host = typeof host === 'string' ? document.querySelector(host) : host;
    if (!host) return;
    var q = new URLSearchParams(location.search), r = q.get('reason');
    var mins = q.get('minutes') || C.idleMinutes || 30, msg;
    if (r === 'idle') msg = 'You were signed out after ' + mins + ' minutes of inactivity. Sign in again to continue.';
    else if (r === 'absolute') msg = 'You were signed out because your session reached its 12-hour limit. Sign in again to continue.';
    else if (r === 'signed-out') msg = 'You have signed out.';
    else if (r === 'access-not-enabled') msg = 'Your organisation\'s access to Abstract VMS hasn\'t been enabled yet. Abstract will let your administrator know when it is.';
    else if (r === 'org-not-active') msg = 'Your organisation\'s account isn\'t active at the moment, so you can\'t sign in. Contact Abstract if you think this is wrong.';
    if (!msg) { host.style.display = 'none'; return; }
    var warn = r === 'access-not-enabled' || r === 'org-not-active';
    host.style.display = '';
    host.setAttribute('role', 'status');
    host.innerHTML = '<div style="display:flex;gap:10px;align-items:flex-start;border:1px solid ' + (warn ? '#fde68a' : '#bfdbfe') + ';background:' + (warn ? '#fffbeb' : '#eff6ff') + ';color:' + (warn ? '#92400e' : '#1e40af') + ';border-radius:8px;padding:10px 12px;font:500 13px/1.5 Inter,sans-serif;text-align:left"><i class="fa-solid ' + (warn ? 'fa-circle-exclamation' : 'fa-circle-info') + '" style="margin-top:3px"></i><span>' + esc(msg) + '</span></div>';
  };

  // ---------- Prototype state switcher ----------
  var LABELS = { 'default': 'Default', loading: 'Loading', empty: 'Empty', error: 'Error', validation: 'Validation failure', denied: 'Permission denied', large: 'Large data' };
  S1.setState = function (name) {
    document.body.setAttribute('data-s1-state', name);
    document.querySelectorAll('[data-s1-show]').forEach(function (e) {
      var on = e.getAttribute('data-s1-show').split(/\s+/).indexOf(name) >= 0;
      e.style.setProperty('display', on ? (e.getAttribute('data-s1-display') || 'block') : 'none', 'important');
    });
    document.querySelectorAll('[data-s1-hide]').forEach(function (e) {
      var off = e.getAttribute('data-s1-hide').split(/\s+/).indexOf(name) >= 0;
      if (off) e.style.setProperty('display', 'none', 'important'); else e.style.removeProperty('display');
    });
    document.querySelectorAll('.s1-sw-panel [data-state]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.state === name)); });
    document.dispatchEvent(new CustomEvent('s1:state', { detail: { state: name } }));
  };
  function buildSwitcher(states) {
    var wrap = el('div', { 'class': 's1-sw' });
    var extra = (C.signIn ? '<button data-act="timeout"><i class="fa-solid fa-hourglass-half" style="width:14px"></i> Session timeout warning</button>' : '') +
      '<button data-act="mode"><i class="fa-solid fa-filter" style="width:14px"></i> <span class="s1-mode-l"></span></button>' +
      (C.hub ? '<a href="' + esc(C.hub) + '" style="display:flex;gap:8px;align-items:center;padding:8px;border-radius:8px;font:500 13px Inter,sans-serif;color:#334155;text-decoration:none"><i class="fa-solid fa-table-list" style="width:14px"></i> Slice 1 screen index</a>' : '');
    wrap.innerHTML = '<div class="s1-sw-panel" role="menu">' +
      (states.length > 1 ? '<p>Screen state</p>' + states.map(function (s) { return '<button data-state="' + s + '" aria-pressed="false">' + (LABELS[s] || s) + '</button>'; }).join('') : '') +
      '<p>Prototype</p>' + extra + '</div><button aria-haspopup="true" aria-label="Prototype controls"><i class="fa-solid fa-layer-group"></i> <span class="s1-sw-cur">Prototype</span></button>';
    document.body.appendChild(wrap);
    var toggle = wrap.lastChild;
    toggle.onclick = function () { wrap.classList.toggle('open'); };
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) wrap.classList.remove('open'); });
    wrap.querySelectorAll('[data-state]').forEach(function (b) { b.onclick = function () { S1.setState(b.dataset.state); wrap.querySelector('.s1-sw-cur').textContent = LABELS[b.dataset.state] || b.dataset.state; wrap.classList.remove('open'); }; });
    var t = wrap.querySelector('[data-act="timeout"]'); if (t) t.onclick = function () { wrap.classList.remove('open'); S1.sessionWarning(); };
    var m = wrap.querySelector('[data-act="mode"]');
    function lab() { wrap.querySelector('.s1-mode-l').textContent = S1.isSlice1Mode() ? 'Show full-product nav' : 'Show slice 1 nav only'; }
    m.onclick = function () { S1.slice1Mode(!S1.isSlice1Mode()); lab(); };
    lab();
  }

  // ---------- Slice 1 mode: nav shows only what slice 1 ships ----------
  var MKEY = 's1-mode';
  S1.isSlice1Mode = function () { return sget(MKEY) === 'on'; };
  function base(h) { try { return decodeURIComponent((h || '').split(/[?#]/)[0].split('/').pop()); } catch (e) { return h; } }
  S1.slice1Mode = function (on) {
    sset(MKEY, on ? 'on' : 'off');
    applyMode();
  };
  function applyMode() {
    var on = S1.isSlice1Mode(), keep = C.slice1Screens || [];
    var nav = document.querySelectorAll(C.navSelector || '#sidebar-nav, aside nav');
    nav.forEach(function (n) {
      n.querySelectorAll('a[href]').forEach(function (a) {
        var f = base(a.getAttribute('href'));
        if (!a.dataset.s1Orig) a.dataset.s1Orig = a.getAttribute('href');
        var swap = (C.slice1Swap || {})[f];
        if (on && C.dashboard && f === C.dashboard && C.slice1Dashboard) a.setAttribute('href', C.slice1Dashboard);
        else if (on && swap) a.setAttribute('href', swap);
        else a.setAttribute('href', a.dataset.s1Orig);
        var ok = !on || keep.indexOf(f) >= 0 || f === C.dashboard || !!swap;
        a.style.display = ok ? '' : 'none';
      });
      // group headers: hide when no visible link follows before the next header
      n.querySelectorAll(C.groupSelector || 'p').forEach(function (p) {
        var s = p.nextElementSibling, any = false;
        while (s && !(s.matches && s.matches(C.groupSelector || 'p'))) {
          if (s.tagName === 'A' && s.style.display !== 'none') any = true;
          if (s.querySelectorAll) s.querySelectorAll('a').forEach(function (x) { if (x.style.display !== 'none') any = true; });
          s = s.nextElementSibling;
        }
        p.style.display = (!on || any) ? '' : 'none';
      });
    });
    // affordances that belong to a later slice: present in the full-product view, absent in slice 1 mode
    document.querySelectorAll('[data-s1-later]').forEach(function (e) {
      if (on) e.style.setProperty('display', 'none', 'important'); else e.style.removeProperty('display');
    });
    document.querySelectorAll('[data-s1-home]').forEach(function (a) {
      if (!a.dataset.s1Orig) a.dataset.s1Orig = a.getAttribute('href');
      a.setAttribute('href', on && C.slice1Dashboard ? C.slice1Dashboard : a.dataset.s1Orig);
    });
  }
  S1.home = function () { return S1.isSlice1Mode() && C.slice1Dashboard ? C.slice1Dashboard : (C.dashboard || '#'); };

  // ---------- boot ----------
  function boot() {
    var q = new URLSearchParams(location.search);
    if (q.get('s1') === '1') sset(MKEY, 'on');
    if (q.get('s1') === '0') sset(MKEY, 'off');
    if (document.body.hasAttribute('data-s1-page') && sget(MKEY) == null) sset(MKEY, 'on');
    applyMode();

    // wire bells: explicit [data-s1-bell], or (bellDrawer portals) any unwired bell button
    if (C.bellDrawer) {
      document.querySelectorAll('button').forEach(function (b) {
        if (b.hasAttribute('data-s1-bell')) return;
        if (b.querySelector('.fa-bell') && !b.getAttribute('onclick')) b.setAttribute('data-s1-bell', '');
      });
      document.querySelectorAll('[data-s1-bell]').forEach(function (b) {
        b.style.position = b.style.position || 'relative';
        // drop the static red dot the old exports carried; the count replaces it
        b.querySelectorAll('span.rounded-full.bg-red-500').forEach(function (d) { d.remove(); });
        b.addEventListener('click', function (e) { e.preventDefault(); S1.openDrawer(); });
      });
      paintBells();
    }

    var states = (document.body.getAttribute('data-s1-states') || '').split(/\s+/).filter(Boolean);
    if (!C.noSwitcher) buildSwitcher(states.length ? states : ['default']);
    var init = q.get('state');
    if (states.length) S1.setState(init && states.indexOf(init) >= 0 ? init : states[0]);
    if (init && init !== 'default' && states.indexOf(init) >= 0) {
      var cur = document.querySelector('.s1-sw-cur'); if (cur) cur.textContent = LABELS[init] || init;
    }
    var b = document.getElementById('s1-signout-banner'); if (b) S1.signedOutBanner(b);
    document.dispatchEvent(new CustomEvent('s1:ready'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
