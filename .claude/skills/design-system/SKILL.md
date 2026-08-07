---
name: design-system
description: The shared boilerplate `<head>` for every VMS mockup screen — Tailwind CDN + inline config, Google Fonts (Sora/Manrope), Font Awesome, Plotly, and the brand colour palette. Use when creating a new `.html` screen, when a screen is missing brand colours/fonts, or when the `tailwind.config` block drifts from canon.
paths: ['*.html']
---

# Design System — the canonical `<head>`

Every screen shares the same `<head>`. Paste this verbatim. Do not swap CDNs,
rename colours, or change the font families — screens must stay pixel-consistent.

## Palette (never rename these keys)

| key       | hex       | use                         |
| --------- | --------- | --------------------------- |
| navy      | `#172554` | sidebar, primary text/brand |
| blue      | `#1D4ED8` | primary actions, links      |
| purple    | `#5B2E91` | released/accent series      |
| lightgrey | `#F3F4F6` | app background              |
| success   | `#16A34A` | positive                    |
| warning   | `#F59E0B` | waiting/attention           |
| danger    | `#DC2626` | destructive/error           |

Fonts: **Sora** 600/700 for `h1`–`h6`, **Manrope** 400/500/600 for body.

## Copy-paste `<head>`

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><!-- Portal · Screen --></title>

  <!-- Tailwind (CDN) -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            navy: '#172554',
            blue: '#1D4ED8',
            purple: '#5B2E91',
            lightgrey: '#F3F4F6',
            success: '#16A34A',
            warning: '#F59E0B',
            danger: '#DC2626',
          },
          fontFamily: {
            sora: ['Sora', 'sans-serif'],
            manrope: ['Manrope', 'sans-serif'],
          },
        },
      },
    };
  </script>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Manrope:wght@400;500;600&display=swap"
    rel="stylesheet"
  />

  <!-- Font Awesome 6 -->
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
  />

  <!-- Plotly (only on screens with charts) -->
  <script src="https://cdn.plot.ly/plotly-2.30.0.min.js"></script>

  <style>
    body { font-family: 'Manrope', sans-serif; }
    h1, h2, h3, h4, h5, h6 { font-family: 'Sora', sans-serif; }
    /* hide scrollbars, keep scroll */
    ::-webkit-scrollbar { display: none; }
    * { -ms-overflow-style: none; scrollbar-width: none; }
  </style>
</head>
```

## Body element (canonical)

```html
<body class="h-full m-0 p-0 overflow-hidden antialiased text-gray-800 flex bg-[#F3F4F6]">
```

Notes:
- Drop the Plotly `<script>` on screens with no charts — it is the one optional line.
- Use palette classes (`bg-navy`, `text-blue`, `text-purple`) rather than raw hex in markup; raw hex is fine only for the `bg-[#F3F4F6]` body shorthand above.
