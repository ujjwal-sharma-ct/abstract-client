#!/usr/bin/env node
/**
 * UX-flow integrity for this HTML mockup portal. The whole point of this repo
 * is to demonstrate the app's screen-to-screen flow, so the thing worth
 * checking mechanically is that the flow actually holds together:
 *
 *   - DEAD LINK   a screen links (href="…​.html") to a file that doesn't exist
 *   - ORPHAN      a screen nothing links to (unreachable in the flow), excluding
 *                 declared entry points (index.html, sign-in / login screens)
 *
 * It also (re)generates FLOWS.md — the navigation map — so the documented flow
 * never drifts from the actual links.
 *
 * Usage:
 *   node scripts/check-flow.mjs            # write FLOWS.md + print summary
 *   node scripts/check-flow.mjs --check    # exit 1 if any DEAD LINK (for a hook)
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const check = process.argv.includes('--check')

const files = readdirSync('.').filter((f) => f.endsWith('.html'))
const fileSet = new Set(files)

const ENTRY_RE = /^(index|.*sign.?in.*|.*log.?in.*)\.html$/i
const isEntry = (f) => ENTRY_RE.test(f)

function titleOf(body, fallback) {
  const m = body.match(/<title>([^<]*)<\/title>/i)
  return m && m[1].trim() ? m[1].trim() : fallback
}

// Extract local .html link targets from a screen.
function linksOf(body) {
  const out = new Set()
  for (const m of body.matchAll(/href\s*=\s*["']([^"'#?]+)["']/gi)) {
    let target = m[1].trim()
    if (!target.toLowerCase().endsWith('.html')) continue
    if (/^https?:\/\//i.test(target)) continue
    target = decodeURIComponent(target).split('/').pop() // basename, decode %20
    out.add(target)
  }
  return [...out]
}

const screens = []
const incoming = new Map(files.map((f) => [f, 0]))
const deadLinks = []

for (const file of files.sort(byScreenNumber)) {
  const body = readFileSync(file, 'utf8')
  const links = linksOf(body)
  for (const t of links) {
    if (fileSet.has(t)) incoming.set(t, (incoming.get(t) ?? 0) + 1)
    else deadLinks.push({ from: file, to: t })
  }
  screens.push({ file, title: titleOf(body, file), links })
}

const orphans = files.filter((f) => !isEntry(f) && (incoming.get(f) ?? 0) === 0).sort(byScreenNumber)

function byScreenNumber(a, b) {
  const na = +(a.match(/^(\d+)/)?.[1] ?? 1e9)
  const nb = +(b.match(/^(\d+)/)?.[1] ?? 1e9)
  return na - nb || a.localeCompare(b)
}

// ── Write FLOWS.md ──────────────────────────────────────────────────────────
if (!check) {
  const rows = screens.map((s) => {
    const targets =
      s.links.filter((t) => fileSet.has(t)).map((t) => `\`${t}\``).join(', ') || '—'
    const entry = isEntry(s.file) ? ' ⟵ entry' : ''
    return `| ${s.title}${entry} | \`${s.file}\` | ${targets} |`
  })
  const out =
    `# UX Flow Map\n\n` +
    `> How this portal's screens connect. Auto-generated from the \`href\` links in each\n` +
    `> screen — regenerate with \`node scripts/check-flow.mjs\`. Annotate freely below the table;\n` +
    `> only the table between the markers is regenerated.\n\n` +
    `Screens: ${files.length} · Entry points: ${files.filter(isEntry).map((f) => `\`${f}\``).join(', ') || 'none'}\n\n` +
    `<!-- FLOW-TABLE:START -->\n` +
    `| screen | file | links to |\n| ------ | ---- | -------- |\n` +
    rows.join('\n') +
    `\n<!-- FLOW-TABLE:END -->\n\n` +
    `## Flow issues\n\n` +
    (deadLinks.length
      ? deadLinks.map((d) => `- ❌ **dead link**: \`${d.from}\` → \`${d.to}\` (no such screen)`).join('\n')
      : '- ✅ no dead links') +
    `\n` +
    (orphans.length
      ? '\n' + orphans.map((o) => `- ⚠️ **orphan**: \`${o}\` (no screen links here — unreachable in the flow)`).join('\n') + '\n'
      : '\n- ✅ every screen is reachable\n')
  writeFileSync('FLOWS.md', out)
  process.stdout.write(`Wrote FLOWS.md · ${files.length} screens · ${deadLinks.length} dead link(s) · ${orphans.length} orphan(s)\n`)
}

// ── Summary + exit ──────────────────────────────────────────────────────────
if (deadLinks.length) {
  process.stdout.write(`\nDead links (${deadLinks.length}):\n`)
  for (const d of deadLinks) process.stdout.write(`  ❌ ${d.from} → ${d.to}\n`)
}
if (orphans.length) {
  process.stdout.write(`\nOrphan screens (${orphans.length}) — nothing links to them:\n`)
  for (const o of orphans) process.stdout.write(`  ⚠️  ${o}\n`)
}
if (!deadLinks.length && !orphans.length) process.stdout.write('Flow OK: no dead links, no orphans.\n')

// Dead links break the demonstrable flow → hard fail in --check. Orphans warn only.
process.exit(check && deadLinks.length ? 1 : 0)
