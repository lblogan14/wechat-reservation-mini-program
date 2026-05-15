# `pages/services/`

The **owner-only service tier editor**. Two pages: list + edit.

## Sub-pages

| Path | Title | Audience |
| --- | --- | --- |
| `list/` | 寄养服务 / Services | Owner |
| `edit/` | 新建 / 编辑服务 | Owner |

Both routed from the profile tab's owner-tools section. The list page also offers an FAB to create a new service.

## What it does

In v1 there is **no fixed `ServiceTier` enum** — every row in the `services` collection is its own tier. The owner creates rooms / tiers with `{ nameZh, nameEn, descriptionZh?, descriptionEn?, pricePerNight, capacityPerDay, sortOrder?, active }`.

- **list/** — fetches `serviceList(true)` (i.e., includes inactive rows for owner UI). Each row shows name, price, capacity, and an `active` toggle chip. Tap → navigate to edit. Inactive services are still shown but display a chip.
- **edit/** — form including bilingual names + descriptions, `pricePerNight` (number; `¥` and "/ 晚" baked into the label), `capacityPerDay` (integer), `sortOrder` (for stable list order), `active` switch. Submit → `serviceUpsert()`. Delete (edit mode only) → `serviceDelete()`. Server refuses delete if any booking references the service.

## Files

| File | Purpose |
| --- | --- |
| `list/list.{ts,wxml,wxss,json}` | List + FAB. |
| `edit/edit.{ts,wxml,wxss,json}` | Edit form. |

## Data dependencies

- [`services/service.ts`](../../services/service.ts) — `serviceList(includeInactive)`, `serviceUpsert()`, `serviceDelete()`.
- [`services/user.ts`](../../services/user.ts) — `isOwner()` guard.
- [`cloudfunctions/serviceList/`](../../../cloudfunctions/serviceList/), [`cloudfunctions/serviceUpsert/`](../../../cloudfunctions/serviceUpsert/), [`cloudfunctions/serviceDelete/`](../../../cloudfunctions/serviceDelete/).

## Behavior notes

- `Booking.serviceId` is a string (Service `_id`), not an enum. AvailabilityOverride and Booking both reference services by id.
- The parent-facing booking flow and calendar pull from `serviceList(false)` (active only); the owner UI passes `includeInactive: true`.
- Hard-delete of a service is blocked when any booking references it — set `active: false` instead.
- Pricing uses `number` (decimals allowed). The form's `<input type="digit">` assumes whole-yuan but accepts decimals.
