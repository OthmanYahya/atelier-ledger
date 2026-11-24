---
name: Atelier Ledger
description: Warm Architectural Ledger for local-first task management, private tutoring, and studio finances.
colors:
  primary: "#1B4D3E"
  primary-hover: "#143B2F"
  terracotta: "#C2592B"
  paper-canvas: "#F6F4EF"
  elevated-surface: "#FFFFFF"
  rail-stone: "#EFECE4"
  subtle-fill: "#EAE5DA"
  border-hairline: "#E5E0D5"
  border-control: "#CFC7B8"
  ink-primary: "#171614"
  ink-secondary: "#57534E"
  ink-muted: "#6C655D"
  sage-paid: "#256347"
  ochre-pending: "#925B14"
  crimson-overdue: "#9E3434"
typography:
  display:
    fontFamily: "Newsreader, Georgia, Cambria, serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Newsreader, Georgia, Cambria, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Instrument Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Instrument Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Instrument Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.35
  micro:
    fontFamily: "Instrument Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.2
  subhead:
    fontFamily: "Instrument Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
  brand:
    fontFamily: "Newsreader, Georgia, Cambria, serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.2
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "7px"
  md: "10px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.elevated-surface}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.elevated-surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  ledger-sheet:
    backgroundColor: "{colors.elevated-surface}"
    rounded: "{rounded.md}"
---

# Design System: Atelier Ledger

## Overview

**Creative North Star: "The Warm Architectural Ledger"**

Atelier Ledger treats everyday prep tasks, private tutoring sessions across four billing models, and studio bookkeeping as one unified paper-and-ink workstation. Rather than generic SaaS card grids or dark neon dashboards, the surface relies on warm archival paper (`#F6F4EF`), crisp hairline-divided sheets (`#FFFFFF` over `1px` parchment borders), Deep Botanical Forest actions (`#1B4D3E`), and Terracotta highlights (`#C2592B`). An optional Ink Dark Mode (`data-theme="ink"`) shifts the same material grammar into deep warm charcoal for evening study or teaching sessions.

**Key Characteristics:**
- Daylight-first paper canvas (`#F6F4EF`) paired with a stone navigation rail (`#EFECE4`).
- Editorial serif headings (`Newsreader`) anchored over clean sans-serif controls (`Instrument Sans`) and monospace clocks (`JetBrains Mono`).
- Universal `tabular-nums` alignment across every fee, duration, balance, countdown, and table column.
- Slide-over detail drawers preserve underlying table/calendar scroll position during edits.

## Colors

A restrained architectural palette where Deep Botanical Forest marks primary actions and Terracotta surfaces warnings, unpaid balances, and live session recording.

### Primary
- **Deep Botanical Forest** (`#1B4D3E`): Primary buttons, active calendar today emphasis, active navigation icons, and earned-revenue chart series. Hover deepens to `#143B2F`.

### Secondary
- **Terracotta** (`#C2592B`): Low-credit bundle warnings, active live timer indicator, overdue balance figures, and expense bars.

### Neutral
- **Paper Canvas** (`#F6F4EF`): Application workspace background.
- **Elevated Surface** (`#FFFFFF`): Ledger sheets, tables, modals, and slide-over drawers.
- **Rail Stone** (`#EFECE4`): Persistent left navigation rail, table headers, and grouped form callouts.
- **Subtle Fill** (`#EAE5DA`): Hover fills, inactive tag pills, and progress bar tracks.
- **Hairline Border** (`#E5E0D5`) & **Control Stroke** (`#CFC7B8`): `1px` borders defining hierarchy without drop shadows.
- **Primary / Secondary / Muted Ink** (`#171614` / `#57534E` / `#6C655D`): Editorial hierarchy passing WCAG AA contrast on both white sheets and archival paper.

### Named Rules
**The One-Accent Action Rule.** Deep Botanical Forest (`#1B4D3E`) belongs to primary actions, active selections, and positive earned bars; semantic status badges use muted Sage, Ochre, and Crimson tints instead of saturated fills.

## Typography

**Display Font:** Newsreader (self-hosted WOFF2) with Georgia serif fallback.
**Body Font:** Instrument Sans (self-hosted WOFF2) with platform sans fallback.
**Label/Mono Font:** JetBrains Mono (self-hosted WOFF2) for session timers, clock times, and keyboard hints.

**Character:** Calm editorial legibility paired with crisp operational precision; numeric columns always carry `font-variant-numeric: tabular-nums`.

### Hierarchy
- **Display** (600, `1.875rem`, `1.2` line-height, `-0.02em`): Top-of-page view titles (`Atelier Overview`, `Tasks & Prep Engine`).
- **Title** (600, `1.25rem`, `1.25` line-height): Ledger section titles and slide-over drawer headers.
- **Body** (400, `0.875rem`, `1.5` line-height): Table cells, task titles, form inputs, and markdown notes.
- **Label** (500, `0.75rem`, `1.4` line-height): Table headers, metric captions, and status chips.
- **Mono** (500, `0.8125rem`, `1.4` line-height): Live session timer readout, lesson start times, and keyboard shortcut badges.

### Named Rules
**The Tabular Ledger Rule.** Every monetary amount, duration, date, count, and timer uses `tabular-nums` so columns align vertically like an accounting sheet.

## Layout

Persistent `256px` (`w-64`) left rail on desktop (`>=1024px`) housing navigation, quick command search, the live Session Timer pill, and theme/shortcut controls; collapses into a sticky top bar + slide-over rail on narrower viewports. Workspace content caps at `max-w-6xl` with `16px–24px` vertical rhythm and hairline-divided metric strips (`gap-px` over `--border`).

## Elevation & Depth

Static surfaces stay flat at rest, bounded solely by `1px` hairline borders (`#E5E0D5`). Depth is reserved exclusively for floating layers (slide-over detail drawers, command palette, and printable statement dialog) using a single soft shadow (`0 18px 40px -12px rgba(23, 22, 20, 0.16)`).

### Named Rules
**The Flat-Sheet Rule.** Never combine a `1px` card border with a diffuse drop shadow on resting workspace panels.

## Shapes

Controlled architectural corners: `10px` (`rounded-md`/`ledger-sheet`) for ledger containers, `7px` for buttons and form inputs, and full pill radii strictly for compact status badges and count chips.

## Components

### Buttons
- **Shape:** `7px` radius (`rounded-sm`).
- **Primary:** Deep Botanical Forest fill (`#1B4D3E`), white ink, `6px 14px` padding; shifts to `#143B2F` on hover.
- **Secondary:** Crisp white fill with `1px` `#CFC7B8` border, darkening slightly (`#EAE5DA`) on hover.

### Inputs / Fields
- **Style:** `1px solid #CFC7B8`, white background, `7px` radius, `border-color` transitions to `#1B4D3E` on focus with `2px` visible focus ring.

### Ledger Sheets & Tables
- **Style:** `10px` radius container with `1px solid #E5E0D5`, `Rail Stone` (`#EFECE4`) table header band, and `1px` horizontal row hairlines.

### Slide-Over Drawers
- **Style:** Right-docked sheet (`max-w-xl` or `max-w-2xl`) with sticky header and action footer, preserving underlying list scroll context.

## Do's and Don'ts

### Do:
- **Do** format every price, duration, date, and metric with `tabular-nums`.
- **Do** use `1px` hairline grid dividers (`gap-px` over `#E5E0D5`) for multi-column summary strips.
- **Do** keep Ink Dark Mode (`#151412`) warm and restrained, matching the paper register.

### Don't:
- **Don't** add gradient backgrounds, glassmorphism blur, or neon borders.
- **Don't** place kickers/eyebrows above headings or decorative emojis inside UI labels.
- **Don't** place one-sided vertical accent bars on rounded containers.
