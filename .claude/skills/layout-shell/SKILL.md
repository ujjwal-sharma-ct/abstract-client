---
name: layout-shell
description: The standard VMS page skeleton — fixed navy sidebar (logo + nav links with active state), top header bar, and a scrollable content area. Use when creating a new screen or when a screen's chrome (sidebar/header) is missing or inconsistent with other mockups.
paths: ['*.html']
---

# Layout Shell — sidebar + header + content

Every screen uses the same three-part shell inside the canonical `<body>` (see
`design-system`). Fixed `w-64` navy sidebar, `h-16` header, scrollable main.

## Copy-paste skeleton

```html
<body class="h-full m-0 p-0 overflow-hidden antialiased text-gray-800 flex bg-[#F3F4F6]">
  <!-- SIDEBAR -->
  <aside class="w-64 bg-navy h-screen flex flex-col text-white shrink-0">
    <!-- logo block -->
    <div class="h-16 flex items-center gap-3 px-6 border-b border-white/10">
      <i class="fa-solid fa-cubes-stacked text-xl text-blue"></i>
      <span class="font-sora font-bold text-lg tracking-tight">VMS</span>
    </div>

    <!-- nav -->
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      <!-- ACTIVE link -->
      <a href="#" aria-current="page"
         class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-white/10 text-white">
        <i class="fa-solid fa-gauge-high w-5 text-center"></i>
        <span>Dashboard</span>
      </a>
      <!-- INACTIVE link -->
      <a href="#"
         class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors">
        <i class="fa-solid fa-briefcase w-5 text-center"></i>
        <span>Vacancies</span>
      </a>
      <a href="#"
         class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors">
        <i class="fa-solid fa-users w-5 text-center"></i>
        <span>Candidates</span>
      </a>
    </nav>

    <!-- user footer -->
    <div class="h-16 flex items-center gap-3 px-4 border-t border-white/10 text-sm">
      <span class="w-8 h-8 rounded-full bg-purple flex items-center justify-center font-semibold">JD</span>
      <span class="text-white/80">Jane Doe</span>
    </div>
  </aside>

  <!-- MAIN COLUMN -->
  <div class="flex-1 flex flex-col h-screen overflow-hidden">
    <!-- HEADER -->
    <header class="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <h1 class="text-lg font-semibold text-navy">Dashboard</h1>
      <div class="flex items-center gap-3">
        <button aria-label="Search" class="w-9 h-9 rounded-lg hover:bg-lightgrey flex items-center justify-center text-slate-500">
          <i class="fa-solid fa-magnifying-glass"></i>
        </button>
        <button aria-label="Notifications" class="w-9 h-9 rounded-lg hover:bg-lightgrey flex items-center justify-center text-slate-500">
          <i class="fa-regular fa-bell"></i>
        </button>
        <button class="px-4 py-2 rounded-lg bg-blue text-white text-sm font-semibold hover:bg-blue/90">
          <i class="fa-solid fa-plus mr-1.5"></i>New
        </button>
      </div>
    </header>

    <!-- SCROLLABLE CONTENT -->
    <main class="flex-1 overflow-y-auto p-6 space-y-6">
      <!-- page content goes here -->
    </main>
  </div>
</body>
```

## Rules
- Active nav link: `bg-white/10 text-white` + `aria-current="page"`. Inactive: `text-white/70` + hover states.
- Only ONE `<h1>` per screen — it lives in the header and matches `<title>`.
- Content spacing: `p-6 space-y-6`; cards/tables are the children of `<main>`.
- Icons use `w-5 text-center` so labels align regardless of glyph width.
