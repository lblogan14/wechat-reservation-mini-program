# `pages/calendar/`

The **parent-facing availability calendar** (subpage; reached from the index page's *Book now* CTA).

## What it does

Renders a 6×7 month grid where each cell shows remaining capacity for the chosen service on that day. Includes a service picker (lists active rows from `serviceList()`), prev/next-month nav, and a tap-to-pick-date interaction that wires into the booking form.

A tap on an available cell navigates to `/pages/booking/new/new?serviceId=...&dropoffDay=...`.

## Files

| File | Purpose |
| --- | --- |
| `calendar.ts` | Grid construction (UTC start-of-day cells), service-picker state, calls `capacityRange()` for the visible month. |
| `calendar.wxml` | Month header, prev/next, service picker, 7-column grid of cells with remaining-count badge. |
| `calendar.wxss` | Grid sizing + cell color states (available, low, full, past-day). |
| `calendar.json` | Sets the page title. |

## Data dependencies

- [`services/service.ts`](../../services/service.ts) — `serviceList()` (active only).
- [`services/capacity.ts`](../../services/capacity.ts) — `capacityRange({ serviceId, from, to })` returns per-day `{ base, deltaSum, absolute, capacityForDay, booked, remaining }`.
- [`cloudfunctions/capacityRange/`](../../../cloudfunctions/capacityRange/) is the single source of truth for the capacity formula.

## Behavior notes

- All date math is **UTC start-of-day** (`Date.UTC(y, m, d)`). The grid uses `getUTCDay()` / `getUTCDate()` to avoid local-timezone drift. See the project [`CLAUDE.md`](../../../CLAUDE.md) for the timezone caveat (assumes 中国 / UTC+8).
- Past days are visually disabled but not gated server-side — `bookingCreate` re-validates capacity on submit.
- Cell colors derived from `remaining / capacityForDay`: green ≥ 50%, yellow > 0, red = 0.
- The capacity formula combines `Service.capacityPerDay` + `AvailabilityOverride.capacityDelta` (or `capacityAbsolute` overrides everything) − sum of active-status bookings consuming that day.
