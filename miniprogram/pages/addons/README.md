# `pages/addons/`

The **owner-only add-ons catalog editor**. Two pages: list + edit.

## Sub-pages

| Path | Title | Audience |
| --- | --- | --- |
| `list/` | 附加服务 / Add-ons | Owner |
| `edit/` | 新建 / 编辑附加服务 | Owner |

Routed from the profile tab's owner-tools section. The catalog populates the **Add-ons** section on the booking form (parent-facing).

## What it does

Manages the `addons` collection. Each catalog row carries `{ nameZh, nameEn, descriptionZh?, descriptionEn?, unitPrice, chargeBasis: 'per_stay' | 'per_night', active }`.

- **list/** — fetches `addonList(true)` (includes inactive for owner view). Each row shows name, unit price, charge basis, active toggle chip. FAB to create. Tap → edit.
- **edit/** — form fields: bilingual names + descriptions, `unitPrice` (number, `¥`-prefixed), `chargeBasis` (picker: per-stay vs per-night), `active` switch. Submit → `addonUpsert()`. Delete → `addonDelete()` (hard delete; historical bookings keep their `BookingAddOn` snapshot copies).

## Files

| File | Purpose |
| --- | --- |
| `list/list.{ts,wxml,wxss,json}` | Catalog list + FAB. |
| `edit/edit.{ts,wxml,wxss,json}` | Edit form. |

## Data dependencies

- [`services/addon.ts`](../../services/addon.ts) — `addonList(includeInactive)`, `addonUpsert()`, `addonDelete()`.
- [`services/user.ts`](../../services/user.ts) — `isOwner()` guard.
- [`cloudfunctions/addonList/`](../../../cloudfunctions/addonList/), [`cloudfunctions/addonUpsert/`](../../../cloudfunctions/addonUpsert/), [`cloudfunctions/addonDelete/`](../../../cloudfunctions/addonDelete/).

## Behavior notes (v0.12)

See [`CLAUDE.md`](../../../CLAUDE.md) for the full decisions. Highlights:

- **Per-booking, not per-pet** — quantity multiplies the unit price by the chargeBasis multiplier (`nights` for `per_night`, `1` for `per_stay`). Per-pet scaling = "tell parents to bump quantity = pet count."
- **Frozen at booking time** — `bookingCreate` resolves each `addonId` against the live catalog and embeds the full `BookingAddOn` snapshot onto every booking row in the series. **Hard delete from the catalog is safe** — historical bookings still display correctly.
- **Active filter** — only `active: true` addons appear in the parent-facing booking form. The owner catalog UI shows both with a chip on inactive ones.
- **Recurring bookings get the same add-ons** — every instance carries the same `addOns` array; per-night cost is recomputed per instance based on that instance's `nights`.
- Only `per_stay` and `per_night` charge bases in v1.
