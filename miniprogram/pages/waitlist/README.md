# `pages/waitlist/`

The **owner-only waitlist queue**. Single subpage at `pages/waitlist/queue/`.

## Sub-pages

| Path | Title | Audience |
| --- | --- | --- |
| `queue/` | 候补队列 / Waitlist queue | Owner only (parent waitlist entries appear inline on `pages/bookings/list/`) |

Routed from the profile tab's owner-tools section.

## What it does

Lists every `waitlistEntries` row whose status is `'waiting'` or `'offered'`, sorted by `createdAt`. Each row shows:

- Parent nickname (if available), pet names, service name, requested date range.
- Status chip (waiting = yellow, offered = blue).
- **Promote** button → calls `waitlistPromote()`.
- **Cancel** button → calls `waitlistCancel()`.

Promotion re-checks capacity server-side; on success the entry is marked `fulfilled` and a new `bookings` row is inserted with `agreementVersion: 'promoted-from-waitlist'`.

## Files

| File | Purpose |
| --- | --- |
| `queue/queue.ts` | Owner-role guard, fetches entries, action wiring, capacity-error toasts. |
| `queue/queue.wxml` | List of entry cards with action buttons. |
| `queue/queue.wxss` | Card + chip styling. |
| `queue/queue.json` | Page title. |

## Data dependencies

- [`services/user.ts`](../../services/user.ts) — `isOwner()` guard.
- [`services/waitlist.ts`](../../services/waitlist.ts) — `waitlistList({ scope: 'all' })`, `waitlistPromote()`, `waitlistCancel()`.
- [`cloudfunctions/waitlistPromote/`](../../../cloudfunctions/waitlistPromote/) re-validates capacity and creates the booking.

## Behavior notes

- **Single-stay only**: only single-stay bookings (not recurring series) get a waitlist offer in the parent-facing flow. Recurring series would need each instance's date range stored separately — punted for v1.
- **Promotion side-effect**: no waiver re-acceptance (owner acts as proxy). The new booking carries the `'promoted-from-waitlist'` sentinel in `agreementVersion` so historical reports can identify these.
- If capacity has filled since the entry was created, promotion fails with `ok: false, error: 'insufficient capacity'` and a `firstBlockedDate` payload.
- Cancelled / fulfilled entries are filtered out client-side — only `waiting` and `offered` appear in the queue.
