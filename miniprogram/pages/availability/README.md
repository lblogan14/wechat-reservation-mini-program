# `pages/availability/`

The **owner-only availability override editor**. Two pages: list + edit.

## Sub-pages

| Path | Title | Audience |
| --- | --- | --- |
| `list/` | 容量调整 / Availability overrides | Owner |
| `edit/` | 新建 / 编辑调整 | Owner |

Routed from the profile tab's owner-tools section.

## What it does

Manages `availabilityOverrides` rows — date-and-service-specific tweaks to base capacity. Each override is keyed by `(date, serviceId)` and carries **exactly one** of:

- `capacityDelta` — signed integer added to `Service.capacityPerDay` for that day.
- `capacityAbsolute` — non-negative integer that replaces the base entirely (use this for a hard block-out: `capacityAbsolute: 0`).

The list page filters by service + date range; the edit page picks one or the other mode via a picker.

## Files

| File | Purpose |
| --- | --- |
| `list/list.{ts,wxml,wxss,json}` | Date-range + service filter, list of overrides, FAB to create. |
| `edit/edit.{ts,wxml,wxss,json}` | Edit form: service picker, date picker, mode picker (delta vs absolute), value input, reason field. |

## Data dependencies

- [`services/availability.ts`](../../services/availability.ts) — `availabilityList()`, `availabilityUpsert()`, `availabilityDelete()`.
- [`services/service.ts`](../../services/service.ts) — service picker uses `serviceList(true)`.
- [`services/user.ts`](../../services/user.ts) — `isOwner()` guard.
- [`cloudfunctions/availabilityList/`](../../../cloudfunctions/availabilityList/), [`cloudfunctions/availabilityUpsert/`](../../../cloudfunctions/availabilityUpsert/), [`cloudfunctions/availabilityDelete/`](../../../cloudfunctions/availabilityDelete/).

## Behavior notes

- The server normalises `date` to **UTC start-of-day**, so the client can pass any timestamp on the desired day and trust the server to bucket it.
- The capacity formula (single source of truth: `cloudfunctions/capacityRange/`):
  - If any override on `(D, S)` has `capacityAbsolute`, that **wins** for the day.
  - Otherwise the day's capacity = `Service.capacityPerDay + Σ capacityDelta` over all overrides on `(D, S)`.
  - Booked = Σ pet count for all active-status bookings overlapping `[dropoffDay, pickupDay)` on that service.
- Block-out a holiday: create one override per day with `capacityAbsolute: 0`. Tedious for long ranges — bulk-range UI is v2.
