# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + TypeScript + Vite (`base: './'` for static/GitHub Pages subpath hosting) configured with `@tanstack/redact/vite` (synchronous React runtime), Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react`, and Vitest for domain unit tests. Local-first IndexedDB storage (`localStorage` migration cache) with optional Private GitHub Gist cross-device sync via browser `fetch`.

## Users

Independent private tutors, instructors, and solo practitioners who manage daily preparation and personal/administrative tasks alongside active tutoring engagements (hourly, flat per-session, monthly retainers, and prepaid lesson packages) and track work expenses and true net profitability.

## Product Purpose

**Atelier Ledger** combines a power-user task and prep engine with a private-tutoring studio and financial ledger in a single local-first workstation. Success means knowing immediately what needs preparation today, logging and timing lessons accurately across all four billing models, spotting unpaid receivables or expiring lesson packages at a glance, and measuring true effective hourly income after expenses.

## Positioning

Unlike generic to-do apps or bloated enterprise CRMs, Atelier Ledger treats tutoring sessions, prep tasks, expenses, and four exact billing models (hourly proration, flat per-session, monthly retainers with caps/overages/rollover, and prepaid packages) as first-class linked records with integer-cent arithmetic and zero external dependencies or cloud lock-in.

## Operating Context

- Local-first desktop and narrow-viewport web workstation used before, during, and after private lessons (including a persistent live session timer pill).
- Print-ready client statements / invoices (`@media print`) generated per student and date range.
- Full JSON backup export/import (schema-validated before overwriting) and CSV export for lessons and expenses.

## Capabilities and Constraints

- **Money Precision:** All monetary values stored internally as integer minor units (cents/fils) and formatted via `Intl.NumberFormat` with configurable currency (`USD`, `IQD`, `EUR`, `GBP`, etc., handling currency decimal places cleanly).
- **Module 1 — To-Do & Prep Engine:** Rich tasks with Markdown notes, statuses (`Inbox`, `To Do`, `In Progress`, `Waiting`, `Done`), priorities (`Urgent`, `High`, `Medium`, `Low`), tags, due date & optional time, estimated/actual duration, nested subtasks with progress bar, recurrence (`Daily`, `Weekly` with specific days, `Biweekly`, `Monthly` spawning next occurrence on completion), optional link to Student/Gig or Lesson, Smart Views (`Today & Overdue`, `Inbox`, `Upcoming`, `All Tasks` list + Kanban toggle, `Completed`), quick-add (`N` / `Ctrl+K`), multi-filter, sorting, batch actions.
- **Module 2 — Private Lessons & Tutoring Tracker:** Student/Gig directory (`Active`, `Paused`, `Archived`, `In-Person`/`Online`/`Hybrid`), four exact billing models (Hourly with minute proration + optional prep-time billing, Flat Per-Session, Monthly Retainer with cycle cap/rollover/overage/live effective hourly rate, Prepaid Package with automatic credit deduction and `<= 2` low-credit warning), Lesson Logger with live timer pill, pure TypeScript + CSS Grid interactive Weekly & Monthly Calendar showing lessons and task due dates.
- **Module 3 — Expenses & Financial Studio:** Expense tracker with categories, recurring monthly toggle, optional Student/Gig attribution; Period selector (`This Week`, `This Month`, `Last Month`, `Last 90 Days`, `All Time`, `Custom Range`); Gross Earned, Collected Cash, Unpaid Receivables with aging & one-click Mark Paid, Total Expenses, Net Profit, Hours Taught, True Effective Hourly Rate; custom SVG revenue vs expenses vs net profit comparison and billing-model / student-gig effective-rate breakdowns.
- **First-Run Experience:** Preloaded realistic demo data (4 diverse students across hourly/monthly/package/flat models, 2 weeks of lessons, expenses, and linked tasks) plus one-click "Clear Demo Data / Start Fresh".
- **Assumptions (derived from explicit autonomous brief):** No remote sync or multi-user authentication; all data remains local to the browser until exported.

## Brand Commitments

- **Product Name:** Atelier Ledger
- **Pinned Aesthetic:** "Warm Architectural Ledger" — daylight-first archival paper palette (`#F6F4EF` canvas, `#FFFFFF` elevated surfaces, `#EFECE4` rail, `#171614` primary ink, `#1B4D3E` Deep Botanical Forest primary accent, `#C2592B` Terracotta highlight, plus optional Ink Dark Mode toggle), editorial serif view titles (`Newsreader`), humanist UI sans (`Instrument Sans`), monospace timers/IDs (`JetBrains Mono`), and mandatory `tabular-nums` on every numeric column, price, duration, date, timer, and count.

## Product Principles

1. **Precision over approximation:** Integer minor-unit math everywhere; real net profit and effective hourly rate after attributed expenses.
2. **Task-to-lesson continuity:** Prep tasks, scheduled sessions, billing balances, and expenses link directly without duplicate entry.
3. **Keyboard-first clarity:** Fast entry (`Ctrl/Cmd+K`, `N`, `L`, `?`) and slide-over detail drawers preserve list context.
4. **Local ownership:** Transparent JSON backup, CSV exports, and clean printable client statements keep data portable.
