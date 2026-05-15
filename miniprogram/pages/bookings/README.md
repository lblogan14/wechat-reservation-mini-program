# `pages/bookings/`

The **my bookings** subpages — parent's bookings list + per-booking detail. Two pages.

## Sub-pages

| Path | Title | Audience |
| --- | --- | --- |
| `list/` | 我的订单 / My bookings | Parent (also surfaces own waitlist entries inline) |
| `detail/` | 预约详情 / Booking detail | Parent (own bookings) + Owner (any booking, sees extra panel) |

Routed from the index tab's *My bookings* CTA, the profile tab, and the dashboard.

## What it does

- **list/** — fetches `bookingList()` and `waitlistList()` in parallel. Groups bookings into **Upcoming** (`pickupAt ≥ now` and not cancelled), **Past** (`pickupAt < now` and not cancelled), **Cancelled**. Active waitlist entries (`waiting` / `offered`) appear in a fourth **Waitlist** section. Recurring members carry a ↻ chip. Each card → `wx.navigateTo` to `/pages/bookings/detail/detail?id=...`.
- **detail/** — single booking detail. Shows service name, status pill, drop-off / pick-up timestamps, nights, pet names, total price, payment status, optional notes. Parent actions: **Cancel** (single, only if `confirmed`) and **Cancel series** (only if part of a recurrence). **Open chat** button → `messageThreadEnsure()` + navigate to `/pages/messages/thread/thread`. When the caller is an owner, an additional **Owner panel** appears with status transition buttons (Check in / Check out / No-show) and a payment status + note editor.

## Files

| File | Purpose |
| --- | --- |
| `list/list.{ts,wxml,wxss,json}` | Section grouping + waitlist cancel modal. |
| `detail/detail.{ts,wxml,wxss,json}` | Detail view, parent cancel actions, owner panel. Reloads on `onShow` to defeat stale status after navigation. |

## Data dependencies

- [`services/booking.ts`](../../services/booking.ts) — `bookingList()`, `bookingCancel()`, `bookingStatusUpdate()`, `bookingPaymentUpdate()`.
- [`services/waitlist.ts`](../../services/waitlist.ts) — `waitlistList()`, `waitlistCancel()`.
- [`services/message.ts`](../../services/message.ts) — `messageThreadEnsure()` opens a thread without sending.
- [`services/user.ts`](../../services/user.ts) — `isOwner()` for the owner panel; server re-verifies role on every action.

## Behavior notes (v0.8 / v0.10)

See [`CLAUDE.md`](../../../CLAUDE.md) for the full decisions. Highlights:

- **Cancellation rules**: parent (and owner) can cancel only `confirmed` bookings. `checked_in` / `checked_out` are immutable from the app.
- **Cancel-series** walks `_id == seriesRoot OR parentBookingId == seriesRoot`. Already non-confirmed bookings are skipped.
- **No cancel-policy enforcement** — the daycare's `cancelPolicyZh/En` is shown for expectations only; server doesn't gate by lead time.
- **Status transitions** are enforced server-side: `confirmed → checked_in / no_show`, `checked_in → checked_out`. Any other transition errors with `cannot transition X → Y`.
- **Server enrichment**: both list and detail data come with `serviceNameZh/En` and `petNames` pre-joined, saving the client extra DB reads.
- **Payment is manual** (no WeChat Pay in v1) — the owner records `paid by 支付宝 transfer …` in the note field.
