---
name: components
description: Shared UI patterns as they appear across VMS mockups — KPI/stat card, data table with a status cell, filter bar, modal/drawer, and empty state. Use when adding these blocks to a screen so they match existing mockups exactly (palette classes, spacing, radii).
paths: ['*.html']
---

# Shared Components

Copy-paste blocks that live inside `<main>` (see `layout-shell`). Cards use
`bg-white border border-slate-200 rounded-xl`. Status cells use `status-badges`.

## KPI / stat card

```html
<div class="grid grid-cols-4 gap-4">
  <div class="bg-white border border-slate-200 rounded-xl p-5">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-slate-500">Open Vacancies</span>
      <span class="w-9 h-9 rounded-lg bg-blue/10 text-blue flex items-center justify-center">
        <i class="fa-solid fa-briefcase"></i>
      </span>
    </div>
    <p class="mt-3 text-3xl font-sora font-bold text-navy">42</p>
    <p class="mt-1 text-xs font-medium text-success"><i class="fa-solid fa-arrow-up"></i> 8% vs last week</p>
  </div>
</div>
```

## Data table (with status cell)

```html
<div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
  <table class="w-full text-sm">
    <thead class="bg-lightgrey text-slate-500 text-xs uppercase tracking-wide">
      <tr>
        <th class="text-left font-semibold px-5 py-3">Reference</th>
        <th class="text-left font-semibold px-5 py-3">Role</th>
        <th class="text-left font-semibold px-5 py-3">Status</th>
        <th class="px-5 py-3"></th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100">
      <tr class="hover:bg-lightgrey/60">
        <td class="px-5 py-3 font-medium text-navy">VAC-1042</td>
        <td class="px-5 py-3 text-slate-600">Staff Nurse</td>
        <td class="px-5 py-3">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Partially Filled</span>
        </td>
        <td class="px-5 py-3 text-right">
          <button aria-label="Open VAC-1042" class="text-slate-400 hover:text-blue"><i class="fa-solid fa-ellipsis"></i></button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

## Filter bar

```html
<div class="flex items-center gap-3 flex-wrap">
  <div class="relative">
    <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
    <input type="text" placeholder="Search…"
      class="pl-9 pr-3 py-2 w-64 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue/40" />
  </div>
  <select class="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
    <option>All statuses</option>
  </select>
  <button class="ml-auto px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-lightgrey">
    <i class="fa-solid fa-filter mr-1.5"></i>More filters
  </button>
</div>
```

## Modal / drawer

```html
<!-- overlay -->
<div class="fixed inset-0 bg-navy/40 flex items-center justify-center z-50">
  <div role="dialog" aria-modal="true" aria-labelledby="modal-title"
    class="bg-white rounded-xl w-full max-w-lg shadow-xl">
    <div class="flex items-center justify-between px-6 h-16 border-b border-slate-200">
      <h2 id="modal-title" class="text-base font-semibold text-navy">Release Vacancy</h2>
      <button aria-label="Close" class="text-slate-400 hover:text-slate-700"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="p-6 space-y-4 text-sm text-slate-600"><!-- body --></div>
    <div class="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
      <button class="px-4 py-2 rounded-lg border border-slate-200 text-sm">Cancel</button>
      <button class="px-4 py-2 rounded-lg bg-blue text-white text-sm font-semibold">Release</button>
    </div>
  </div>
</div>
```

## Empty state

```html
<div class="bg-white border border-slate-200 rounded-xl py-16 flex flex-col items-center text-center">
  <span class="w-14 h-14 rounded-full bg-lightgrey text-slate-400 flex items-center justify-center text-xl">
    <i class="fa-solid fa-inbox"></i>
  </span>
  <p class="mt-4 font-semibold text-navy">No vacancies yet</p>
  <p class="mt-1 text-sm text-slate-500">Released vacancies will appear here.</p>
  <button class="mt-5 px-4 py-2 rounded-lg bg-blue text-white text-sm font-semibold">Create vacancy</button>
</div>
```
