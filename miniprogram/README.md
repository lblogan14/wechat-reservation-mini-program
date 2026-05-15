# `miniprogram/`

The WeChat Mini Program frontend. Native Mini Program + TypeScript — no Uni-app, no Taro.

Anything user-facing lives here. The matching backend (cloud functions + 云开发 database) is under [`../cloudfunctions/`](../cloudfunctions/).

## Top-level files

| File | Purpose |
| --- | --- |
| [`app.ts`](app.ts) | Global lifecycle: `wx.cloud.init`, restore cached openid + user, init i18n, subscribe to locale changes and refresh tab bar text via `wx.setTabBarItem`. |
| [`app.json`](app.json) | Pages list (19 pages as of v0.13), 3-tab tab bar (首页 / 我的宠物 / 我的), window config, `__usePrivacyCheck__: true`. |
| [`app.wxss`](app.wxss) | Global styles. Page-specific styles live in `<page>.wxss`. |
| [`tsconfig.json`](tsconfig.json) | `strict: true`, target ES2017, types: `miniprogram-api-typings`. `npm run typecheck` at the repo root drives `tsc --noEmit` against this. |

## Layout

```
miniprogram/
├── app.{ts,json,wxss}
├── tsconfig.json
├── pages/          ← every screen — one folder per page-group (see pages/README.md)
├── components/     ← reusable custom components: pet-card, lang-switcher
├── services/       ← TypeScript wrappers around wx.cloud.callFunction
├── i18n/           ← zh + en dictionaries + locale store + t() helper
└── types/          ← ambient .d.ts declarations (PetDaycare domain model)
```

Each subfolder has its own README:

- [`pages/README.md`](pages/README.md) — page registration conventions, lifecycle template, per-page-group breakdown.
- [`components/README.md`](components/README.md) — pet-card, lang-switcher, and conventions for adding more.
- [`services/README.md`](services/README.md) — every cloud function call goes through here.
- [`i18n/README.md`](i18n/README.md) — locale store, the `Dict = typeof zh` enforcement, propagation patterns.
- [`types/README.md`](types/README.md) — `PetDaycare` namespace contents.

## Domain model (1-page version)

See [`types/models.d.ts`](types/models.d.ts) for the full declarations and [`CLAUDE.md`](../CLAUDE.md) for the deeper architectural notes.

```
User { openid, role: 'parent'|'owner'|'staff', nickname?, phone? }
  └── owns ──> Pet { ownerOpenid, name, species, breed, vaccineCertFileID, ... }

DaycareConfig (singleton) {
  nameZh, nameEn, address, phone, hours, agreement,
  reminderDropoffTmplId, reminderPickupTmplId
}

Service { nameZh, nameEn, pricePerNight, capacityPerDay, active }
  ↑
  └─ AvailabilityOverride { date, serviceId, capacityDelta | capacityAbsolute }

AddOn { nameZh, nameEn, unitPrice, chargeBasis: 'per_stay'|'per_night', active }

Booking { parentOpenid, petIds[], serviceId, dropoffAt, pickupAt,
          bookingStatus, paymentStatus, addOns[] (frozen snapshot),
          recurrence?, parentBookingId?,
          reminderSentDropoff?, reminderSentPickup? }

WaitlistEntry { parentOpenid, petIds[], serviceId, dropoffAt, pickupAt, status }

MessageThread { bookingId, parentOpenid, unreadForParent, unreadForOwner }
  └── Message { threadId, fromOpenid, fromRole, body, readByParentAt?, readByOwnerAt? }
```

## Architectural anchors

- **Auth**: cloud function `login` resolves `cloud.getWXContext().OPENID` and upserts a `users` row. Client caches the openid + user in `App.globalData` and `wx.storage`.
- **Role gating**: owner-only flows guard client-side with `isOwner()` AND server-side with a re-read of `users.role`. Server is the only trust boundary.
- **Date math**: UTC start-of-day across the app — calendar cells, availability overrides, dashboard buckets, capacity formula, reminder cron. The daycare is assumed UTC+8 (中国); UTC midnight = 08:00 CST so the calendar day matches CST through 16:00 UTC.
- **Capacity**: `cloudfunctions/capacityRange/` is the **single source of truth** for the formula `base + Σ delta` (or `absolute` override) − Σ active-status bookings overlapping the day. Both the calendar and the booking form go through it; do not re-implement client-side.
- **No WeChat Pay** in v1 (individual-dev block). Payment status + note are recorded manually by the owner on the booking detail page.
- **Bilingual UI**: `zh` is the source of truth (`type Dict = typeof zh`). Pages and components subscribe to `onLocaleChange` in `onLoad` / `attached` and clean up in `onUnload` / `detached`.
- **`wx.cloud` availability**: pages tolerate `wx.cloud` being unavailable (no AppID set yet) — the `services/cloud.ts` helper returns `{ ok: false, error: '...' }` rather than throwing.

## Running locally

From the repo root:

```bash
npm install
npm run typecheck
```

Then open 微信开发者工具 and point it at this repository root (the IDE auto-detects `project.config.json`). See the root [`README.md`](../README.md) and [`CLAUDE.md`](../CLAUDE.md) for AppID, 云开发 env setup, and the cloud function deployment dance.
