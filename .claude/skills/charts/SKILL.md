---
name: charts
description: Plotly charts for VMS mockups — the responsive/no-toolbar config, brand series colours (navy/blue/purple), and where the `<div>` + `<script>` go. Use when a screen needs a chart, or when an existing chart shows a toolbar, wrong colours, or fixed sizing.
paths: ['*.html']
---

# Charts (Plotly)

Charts render with Plotly (loaded in the `design-system` `<head>`). Keep them
brand-coloured, toolbar-free, and responsive. Charts live inside a white card
in `<main>`; the `<script>` goes at the end of `<body>`.

## Brand series colours (use in order)

```js
const BRAND = ['#172554', '#1D4ED8', '#5B2E91']; // navy, blue, purple
// status accents when needed: success #16A34A, warning #F59E0B, danger #DC2626
```

## Shared config (responsive, no toolbar)

```js
const CHART_CONFIG = { displayModeBar: false, responsive: true };

const CHART_LAYOUT = {
  font: { family: 'Manrope, sans-serif', color: '#334155', size: 12 },
  margin: { t: 16, r: 16, b: 40, l: 44 },
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  xaxis: { gridcolor: '#E2E8F0', zeroline: false },
  yaxis: { gridcolor: '#E2E8F0', zeroline: false },
  legend: { orientation: 'h', y: -0.2 },
};
```

## The card + div

```html
<div class="bg-white border border-slate-200 rounded-xl p-5">
  <h3 class="text-sm font-semibold text-navy mb-4">Fill rate by week</h3>
  <div id="fillRateChart" class="w-full h-64"></div>
</div>
```

## The script (end of `<body>`)

```html
<script>
  Plotly.newPlot(
    'fillRateChart',
    [
      { x: ['W1', 'W2', 'W3', 'W4'], y: [12, 18, 15, 22], type: 'bar',
        name: 'Filled', marker: { color: '#1D4ED8' } },
      { x: ['W1', 'W2', 'W3', 'W4'], y: [4, 3, 6, 2], type: 'bar',
        name: 'Unfilled', marker: { color: '#5B2E91' } },
    ],
    { ...CHART_LAYOUT, barmode: 'stack' },
    CHART_CONFIG
  );
</script>
```

## Rules
- Always pass `CHART_CONFIG` so there is no mode bar and the chart resizes.
- Series colours come from `BRAND` in order — never rainbow defaults.
- Size the chart via the `<div>` (`w-full h-64`), not Plotly `width`/`height`, so it stays responsive.
- Transparent backgrounds so the white card shows through.
- Add the Plotly `<script>` in the `<head>` only on screens that actually chart.
