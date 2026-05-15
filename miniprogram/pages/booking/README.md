# `pages/booking/`

The **parent booking form**. Single subpage at `pages/booking/new/`.

## Sub-pages

| Path | Title | Audience |
| --- | --- | --- |
| `new/` | 新建预约 / New booking | Parent (signed-in) |

Routed via `wx.navigateTo({ url: '/pages/booking/new/new?serviceId=...&dropoffDay=...' })` from the calendar (or directly from the index CTA, with pickers exposed for picking a service).

## What it does

Collects everything `bookingCreate` needs:

1. **Service** picker (from `serviceList()` active rows).
2. **Drop-off / pick-up** date + time pickers (`mode="time"` with hour granularity). Outside-hours warning if the chosen time falls outside `daycareConfig.hoursOpen`–`hoursClose`, but submission is **not blocked**.
3. **Pets** multi-select (from `petList()`).
4. **Add-ons** stepper section (visible when active add-ons exist; quantity defaults to 0).
5. **Recurrence** card — toggle on, pick `daily` or `weekly` (+ optional `daysOfWeek` chips), end date. Preview computes occurrence count client-side; submit blocks at > 60 occurrences (server-side cap = `MAX_OCCURRENCES`).
6. **Waiver / 寄养协议** — scrollable text (from `daycareConfig.agreementZh/En`) + checkbox. If the owner hasn't set up an agreement, the section shows a note and the booking is stamped with `agreementVersion: 'no-agreement-v0'`.
7. Calls `bookingCreate()` on submit. On `wx.requestSubscribeMessage` is invoked first to request reminder permission (if the daycare has reminder template IDs configured).

## Files

| File | Purpose |
| --- | --- |
| `new/new.ts` | Form state, recurrence preview, add-on cost math, capacity error mapping (e.g., `firstBlockedDate` → toast). |
| `new/new.wxml` | Sectioned form layout: service / dates / pets / add-ons / recurrence / waiver / summary / submit. |
| `new/new.wxss` | Stepper styling, status chips, summary row layout. |
| `new/new.json` | Page title. |

## Data dependencies

- [`services/service.ts`](../../services/service.ts) — `serviceList()` (active).
- [`services/pet.ts`](../../services/pet.ts) — `petList()` for the caller's pets.
- [`services/daycare.ts`](../../services/daycare.ts) — `daycareGet()` for hours + waiver + reminder template IDs.
- [`services/addon.ts`](../../services/addon.ts) — `addonList()` for the catalog (active only).
- [`services/booking.ts`](../../services/booking.ts) — `bookingCreate()` does the actual insert.
- [`cloudfunctions/bookingCreate/`](../../../cloudfunctions/bookingCreate/) is the source of truth for capacity validation, recurrence expansion, and add-on price freezing.

## Behavior notes (v0.6 / v0.7 / v0.12 / v0.13)

See [`CLAUDE.md`](../../../CLAUDE.md) for the long-form decisions. Highlights:

- **Auto-confirm** on submit when capacity exists — no owner approval gate.
- **Half-open day accounting**: drop off Wed → pick up Thu = 1 night, consumes 1 slot on Wed only.
- **No transaction**: capacity check + insert is not atomic. A simultaneous booker can race and the loser gets `ok:false, error:'insufficient capacity'`.
- **Recurrence cap**: 60 occurrences server-side; the form preview disables submit beyond this.
- **Add-ons** are frozen onto every booking row in the series (`BookingAddOn` snapshot). Catalog deletes are safe.
- **Reminder permission**: at submit, `wx.requestSubscribeMessage` asks for both dropoff + pickup template grants. If neither template ID is configured on `daycareConfig`, the request is skipped.
