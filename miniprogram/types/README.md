# `miniprogram/types/`

Ambient TypeScript declarations. Files under here are picked up via the `include` glob in [`miniprogram/tsconfig.json`](../tsconfig.json) and are visible to every page / component / service without an explicit `import`.

## Files

### [`models.d.ts`](models.d.ts)

Declares the `PetDaycare` namespace — the v1 domain model. Pages and services reference these types via the bare `PetDaycare.*` namespace (no import needed).

Contents:

| Member | Kind | Purpose |
| --- | --- | --- |
| `Locale` | `'zh' \| 'en'` | i18n locale literal. |
| `UserRole` | `'parent' \| 'owner' \| 'staff'` | Role flag on `User`. |
| `PaymentStatus` | `'pending' \| 'paid' \| 'refunded' \| 'waived'` | Manual-payment lifecycle (no WeChat Pay in v1). |
| `BookingStatus` | `'confirmed' \| 'cancelled' \| 'checked_in' \| 'checked_out' \| 'no_show'` | Server enforces the transition graph in `bookingStatusUpdate`. |
| `MessageSenderRole` | `'parent' \| 'owner' \| 'staff' \| 'system'` | `Message.fromRole`. |
| `WaitlistStatus` | `'waiting' \| 'offered' \| 'cancelled' \| 'fulfilled'` | `WaitlistEntry.status`. |
| `User` | interface | One row in the `users` collection. |
| `Pet` | interface | One row in `pets`. `ownerOpenid` is the trust boundary. |
| `Service` | interface | A service tier (owner-configurable; v1 has no fixed enum). |
| `AvailabilityOverride` | interface | Capacity tweak keyed by `(date, serviceId)`. **Exactly one** of `capacityDelta` / `capacityAbsolute`. |
| `BookingAddOn` | interface | Embedded snapshot on `Booking.addOns[]`. Frozen at booking time. |
| `AddOn` | interface | Catalog row in `addons`. |
| `BookingRecurrence` | interface | Recurrence template on a `Booking` row (eager-expanded into per-instance rows). |
| `Booking` | interface | The big one. Stay window, pricing, status, optional recurrence template, reminder idempotency flags. |
| `DaycareConfig` | interface | Singleton row. Identity, hours, waiver, reminder template IDs. |
| `MessageThread` | interface | One thread per booking (`bookingId` optional for pre-booking inquiry — not used in v1). |
| `Message` | interface | One message in a thread, with read-receipt timestamps. |
| `WaitlistEntry` | interface | Pending request for a date range that's currently at capacity. |

## How this fits

- **Cloud function ↔ type alignment**: the cloud functions in [`cloudfunctions/`](../../cloudfunctions/) read and write fields named here. Any drift is a bug — keep the type the canonical schema. Cloud functions are plain JS and don't import these types, so when you add a field, also update any cloud function that needs to read or write it.
- **Transport-layer enrichments** (`EnrichedBooking`, `EnrichedWaitlistEntry`, `EnrichedMessageThread`) are declared in the corresponding files under [`services/`](../services/), **not** here — those are response shapes, not persisted ones.
- **`agreementVersion` sentinels**: `'no-agreement-v0'` is used when the owner hasn't set up a waiver; `'promoted-from-waitlist'` when a waitlist entry is converted to a booking. Add new sentinels here if you create another path that skips waiver capture.

## Adding a new entity

1. Add the interface + any literal types to `models.d.ts` inside `declare namespace PetDaycare`.
2. Create the matching cloud function(s) under `cloudfunctions/<name>/` and a wrapper under [`services/`](../services/).
3. Cross-reference: pages reading the new entity should use `PetDaycare.<YourType>` directly.
4. Update [`CLAUDE.md`](../../CLAUDE.md)'s database-collections list so the next dev knows to create the collection in 云开发 console.
