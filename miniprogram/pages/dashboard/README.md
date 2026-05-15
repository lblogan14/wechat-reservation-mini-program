# `pages/dashboard/`

The **owner-only dashboard** — "today view". Subpage reached from the profile tab's owner-tools section.

## What it does

Shows three buckets, computed client-side from `bookingList({ scope: 'all' })`:

- **Drop-offs today** — `bookingStatus === 'confirmed'` AND `dropoffDay === today` (UTC start-of-day).
- **Pick-ups today** — `bookingStatus === 'checked_in'` AND `pickupDay === today`.
- **Currently staying** — `bookingStatus === 'checked_in'` AND `dropoffDay ≤ today < pickupDay`.

Each row has inline action buttons:

- `confirmed → checked_in` (Check in)
- `confirmed → no_show` (No-show; confirmed via `wx.showModal`)
- `checked_in → checked_out` (Check out)

Tapping a card navigates to `/pages/bookings/detail/detail?id=...` for the full detail + payment panel.

## Files

| File | Purpose |
| --- | --- |
| `dashboard.ts` | Owner-role guard, fetches all bookings, buckets by date+status, wires action buttons to `bookingStatusUpdate()`. |
| `dashboard.wxml` | Three sections + booking cards + action buttons. |
| `dashboard.wxss` | Card grid, button color states per transition. |
| `dashboard.json` | Page title. |

## Data dependencies

- [`services/user.ts`](../../services/user.ts) — `refreshCurrentUser()` + `isOwner()` guard on entry.
- [`services/booking.ts`](../../services/booking.ts) — `bookingList({ scope: 'all' })`, `bookingStatusUpdate()`.
- [`cloudfunctions/bookingStatusUpdate/`](../../../cloudfunctions/bookingStatusUpdate/) — server enforces the same transition graph (`confirmed → checked_in / no_show`, `checked_in → checked_out`; any other transition errors).

## Behavior notes

- All bucketing uses **UTC start-of-day**, matching the rest of the app's date convention.
- The page **does NOT** support walk-in entry (owner creating a booking on behalf of a parent) in v1 — see [`CLAUDE.md`](../../../CLAUDE.md) for the punt rationale. Workaround: insert via 云开发 console or ask the parent to book through the app.
- Payment status / note edits live on the **booking detail** page's owner panel, not here.
- Refreshes on `onShow`, so navigating back from a status update sees the new state.
- Non-owner callers are bounced — the page shows an unauthorized note and the server-side `bookingStatusUpdate` cloud function re-verifies role anyway.
