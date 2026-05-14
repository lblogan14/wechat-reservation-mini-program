# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

v0.5 landed on 2026-05-14 (parent-facing availability calendar). The repo now provides:

- Project shell + bilingual zh/en i18n + locale-reactive tab bar
- Sign-in flow (openid via `wx.cloud.callFunction('login')`, persisted in `wx.storage`); user record (with `role`) cached in `App.globalData.user`
- Pet profile CRUD: list page (tab) + edit page with full schema (photo, vaccine cert + expiry, breed/sex/neutered/birthdate/weight, feeding/behavior/medical notes, emergency contact)
- Daycare identity: read-only card on home tab + owner-only edit page (`pages/daycare/edit/`). Owner bootstrap via `userPromote` cloud function (env-var-gated code).
- Owner services + availability (v0.4): `services` collection (owner-defined rooms/tiers with `pricePerNight`, `capacityPerDay`, `active`); `availabilityOverrides` collection (per-date×serviceId delta-or-absolute capacity tweaks for block-outs / holiday surges); owner-only list + edit pages under `pages/services/` and `pages/availability/`.
- **Availability calendar** (v0.5): parent-facing monthly grid at `pages/calendar/` reachable from the home tab Book CTA. Service picker + month nav; each cell shows remaining slots with a traffic-light fill (green = open, yellow = limited, red = full, grey = out-of-month). One cloud function `capacityRange` joins `services` + `availabilityOverrides` + `bookings` server-side; the page renders a 6×7 grid (so the leading/trailing days of adjacent months are shown muted). Tapping a cell shows a toast for now — the booking flow lands in v0.6 and will reuse the same `capacityRange` payload.
- Three tabs: 首页 / 我的宠物 / 我的, all bilingual-aware
- Fifteen cloud functions: `login`, `userGet`, `userPromote`, `petList`, `petUpsert`, `petDelete`, `daycareGet`, `daycareUpsert`, `serviceList`, `serviceUpsert`, `serviceDelete`, `availabilityList`, `availabilityUpsert`, `availabilityDelete`, `capacityRange`

Not yet implemented: booking creation flow, my-bookings, owner dashboard, messaging, subscribe-message reminders. See **v1 backlog**.

## Product goal

A WeChat Mini Program that lets pet owners book appointments at pet daycare homes — view available time slots, select services, and confirm appointments inside the WeChat client. See [README.md](README.md) for the full pitch (bilingual: English + 中文).

## Tech stack (committed 2026-05-14)

- **Frontend:** Native Mini Program + TypeScript. No Uni-app / Taro. Type definitions via the `miniprogram-api-typings` npm package (pinned in [package.json](package.json)).
- **Backend:** WeChat Cloud Development (云开发). Cloud functions live under [cloudfunctions/](cloudfunctions/); the database is the 云开发 NoSQL store, collections managed via the IDE.
- **Entity:** Individual developer (个人小程序). This **blocks WeChat Pay** and the `getPhoneNumber` button — v1 skips payment entirely and uses a plain `<input>` for phone collection. If the project ever upgrades to 企业认证, revisit the payment and phone flows.
- **v1 scope:** Single daycare home (one owner account, many pet-parent customers). No multi-tenant marketplace.
- **UI:** Bilingual zh/en, runtime switchable via [miniprogram/i18n/index.ts](miniprogram/i18n/index.ts). Locale stored in `wx.getStorageSync`; tab bar text refreshed via `wx.setTabBarItem` on locale change.

## Getting started

1. **Register a WeChat Mini Program AppID** at https://mp.weixin.qq.com (个人小程序 path). Open [project.config.json](project.config.json) and replace `"appid": "touristappid"` with your real AppID. Without a real AppID the simulator works but `wx.cloud` is disabled, so cloud functions and the database can't run.
2. **Install dev dependencies:** `npm install` at the repo root. This installs `miniprogram-api-typings` (TS types for `wx.*`) and `typescript`. Run `npm run typecheck` to type-check without emitting.
3. **Open 微信开发者工具** (download: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html). Import this repo directory; the IDE picks up [project.config.json](project.config.json) automatically and detects the TS source.
4. **Create a 云开发 environment:** in the IDE, open the 云开发 panel → 新建环境. Copy the env ID into [miniprogram/app.ts](miniprogram/app.ts) at the `// TODO: replace with your 云开发 env ID` comment.
5. **Create database collections** in the 云开发 console (the SDK does not auto-create them). For v0.5: `users` + `pets` + `daycareConfig` + `services` + `availabilityOverrides`. The `bookings` collection isn't required yet — `capacityRange` tolerates its absence (treats booked count as 0). Future milestones will add `bookings`, `messageThreads` + `messages`, `addons`, `waitlistEntries`.
6. **Deploy cloud functions:** for each folder under [cloudfunctions/](cloudfunctions/), right-click in the IDE → *上传并部署：云端安装依赖（不上传 node_modules）*. The IDE handles `npm install` server-side. Current functions: `login`, `userGet`, `userPromote`, `petList`, `petUpsert`, `petDelete`, `daycareGet`, `daycareUpsert`, `serviceList`, `serviceUpsert`, `serviceDelete`, `availabilityList`, `availabilityUpsert`, `availabilityDelete`, `capacityRange`.
   - For `userPromote`, also set a `BOOTSTRAP_OWNER_CODE` environment variable on the cloud function (cloud-function panel → 环境变量). The first parent uses that code in the profile page's "Promote to owner" form to flip their `User.role` to `'owner'`. Without the env var, the function refuses all promotions.
7. **Preview:** click *预览* in the IDE to generate a QR code, scan with WeChat. Or run in the simulator.

## Project layout

```
.
├── miniprogram/                       # Mini Program frontend
│   ├── app.ts                         # global lifecycle: init cloud, init i18n, restore openid, refresh tab bar
│   ├── app.json                       # pages, 3-tab tab bar, privacy check
│   ├── app.wxss                       # global styles
│   ├── tsconfig.json
│   ├── pages/
│   │   ├── index/                     # home / landing page — daycare info card + booking CTAs
│   │   ├── pets/list/                 # tab: pet list with FAB and auth gate
│   │   ├── pets/edit/                 # subpage: new or edit pet (?id=...)
│   │   ├── daycare/edit/              # subpage: owner-only daycare config editor
│   │   ├── services/list/             # subpage: owner-only list of rooms/tiers
│   │   ├── services/edit/             # subpage: owner-only service form
│   │   ├── availability/list/         # subpage: owner-only block-out + override list
│   │   ├── availability/edit/         # subpage: owner-only override form
│   │   ├── calendar/                  # subpage: parent-facing month grid + service picker
│   │   └── profile/                   # "me" tab — sign-in + owner tools + language switcher
│   ├── components/
│   │   ├── lang-switcher/             # zh/en toggle
│   │   └── pet-card/                  # list row with vaccine warning chip
│   ├── services/                      # cloud-function client wrappers
│   │   ├── cloud.ts                   # call<T>() helper around wx.cloud.callFunction
│   │   ├── auth.ts                    # signIn() / signOut() — wires openid + user cache
│   │   ├── openid.ts                  # getOpenid / setOpenid (globalData + wx.storage)
│   │   ├── user.ts                    # getCurrentUser / isOwner / refreshCurrentUser / promoteToOwner
│   │   ├── pet.ts                     # petList / petUpsert / petDelete
│   │   ├── daycare.ts                 # daycareGet / daycareUpsert
│   │   ├── service.ts                 # serviceList / serviceUpsert / serviceDelete
│   │   ├── availability.ts            # availabilityList / availabilityUpsert / availabilityDelete
│   │   └── capacity.ts                # capacityRange — per-day remaining slots for a service
│   ├── i18n/
│   │   ├── index.ts                   # locale store + t()
│   │   ├── zh.ts                      # source-of-truth dictionary (other locales conform to its shape)
│   │   └── en.ts
│   └── types/
│       └── models.d.ts                # PetDaycare.* domain models (User, Pet, Service, Booking, …)
├── cloudfunctions/
│   ├── login/                         # resolve openid via cloud.getWXContext(), upsert user
│   ├── userGet/                       # return current user record (so client can role-gate)
│   ├── userPromote/                   # bootstrap owner role; gated by BOOTSTRAP_OWNER_CODE env var
│   ├── petList/                       # list pets owned by caller
│   ├── petUpsert/                     # create or update a pet (ownership-checked)
│   ├── petDelete/                     # delete a pet (ownership-checked)
│   ├── daycareGet/                    # return the singleton daycareConfig row
│   ├── daycareUpsert/                 # upsert daycareConfig — owner role required
│   ├── serviceList/                   # list services (defaults to active only; pass includeInactive for owner)
│   ├── serviceUpsert/                 # create or update a service — owner role required
│   ├── serviceDelete/                 # hard-delete a service — owner only; refuses if bookings reference it
│   ├── availabilityList/              # list capacity overrides, optional date-range + serviceId filter
│   ├── availabilityUpsert/            # upsert override (date+serviceId+delta-or-absolute) — owner only
│   ├── availabilityDelete/            # delete override — owner only
│   └── capacityRange/                 # join services + overrides + bookings; return per-day remaining for a date window
├── project.config.json                # IDE-level config (AppID goes here)
├── sitemap.json
└── package.json                       # dev-only: api-typings + typescript
```

## Architecture notes

- **Auth:** `wx.cloud.callFunction({ name: 'login' })`. The cloud function reads `cloud.getWXContext().OPENID` (injected by the 云开发 runtime) and upserts a `users` record. The client stashes the openid in `App.globalData.openid` + `wx.storage` and the full `User` (with `role`) in `App.globalData.user` + `wx.storage`. Pet pages check `getOpenid()` on `onShow`; if empty, they render an auth-required prompt that switches to the profile tab.
- **Owner role gating:** `User.role` is `'parent' | 'owner' | 'staff'`. Role-gated pages call `isOwner()` from [services/user.ts](miniprogram/services/user.ts); on first entry they also `await refreshCurrentUser()` to defeat stale cache. Bootstrap path: a parent signs in, types the `BOOTSTRAP_OWNER_CODE` value into the profile page's "Promote to owner" form, which calls `userPromote` → flips their `users` row to `role: 'owner'`. Server is the only trust boundary (`daycareUpsert` re-reads role on every call).
- **Pet ownership:** every pet stores `ownerOpenid`. `petList` filters by it; `petUpsert` / `petDelete` reject calls where `existing.data.ownerOpenid !== OPENID`. The cloud function — not the client — is the trust boundary.
- **Vaccine gating policy (v1):** **warning only.** The pet card and edit page surface a yellow chip if `vaccineCertFileID` or `vaccineExpiry` is missing, or `vaccineExpiry < now`. Bookings will still be allowed; the daycare owner verifies the paper cert at drop-off. To make this a hard gate later, add the check in the `bookingCreate` cloud function (not yet built).
- **Service model is owner-configurable (decided 2026-05-14):** there is no fixed `ServiceTier` enum. Each row in the `services` collection is its own tier — the owner creates rooms/tiers with `{ nameZh, nameEn, pricePerNight, capacityPerDay, active, sortOrder }` from [pages/services/edit/](miniprogram/pages/services/edit/). `AvailabilityOverride` and `Booking` reference a service by `serviceId: string` (Service._id), not an enum. `serviceList` returns active rows only unless `includeInactive: true` is passed (owner UI does so).
- **Pricing:** stored as `number` (allows decimals); v0.4 UI uses `type="digit"` and assumes whole-yuan input but accepts decimal. Currency symbol `¥` and "/ 晚" hint are baked into the field labels.
- **Capacity overrides:** an `AvailabilityOverride` is keyed by `(date, serviceId)`. Set **exactly one** of `capacityDelta` (integer, signed; added to base) or `capacityAbsolute` (non-negative integer; replaces base for that day). Server normalises `date` to start-of-day UTC, so client should pass any timestamp on the desired day and trust the server to bucket it. Owner UI lets you pick between the two modes via a picker.
- **Capacity formula:** `Service.capacityPerDay` is the base. `AvailabilityOverride` adjusts a specific date×serviceId. `Booking` consumes capacity across `dropoffAt → pickupAt` for its serviceId. See [miniprogram/types/models.d.ts](miniprogram/types/models.d.ts). A booking with N pets in service S from day D1 to day D2 consumes N slots on each day in `[D1, D2)`. Calendar query for "remaining slots on day D in service S": if an `AvailabilityOverride` for (D, S) has `capacityAbsolute`, that wins; else `Service.capacityPerDay + sum(capacityDelta for D, S) - sum(Booking slots overlapping D in S)`. **The `capacityRange` cloud function is the single source of truth** for this computation — both the calendar (#4) and the upcoming booking flow (#5) should call it; do not re-implement the math client-side.
- **Date math = UTC start-of-day.** Anywhere a date (not a full timestamp) is needed — `availabilityOverrides.date`, calendar cells, the booking flow's drop-off/pick-up day buckets — store and compare `Date.UTC(y, m, d)`. The calendar page constructs its 6×7 grid using `getUTCDay`/`getUTCDate`. **TZ caveat:** the daycare is assumed to be in 中国 (UTC+8). UTC midnight = 08:00 CST, same calendar day, so this works for now. If a daycare ever operates such that the calendar day matters before 08:00 CST (e.g., overnight admissions where the date label flips at midnight CST), switch to a fixed `+08:00` offset constant.
- **Payments:** intentionally absent in v1 (individual-dev blocks WeChat Pay). `Booking.paymentStatus` defaults to `'pending'`. The owner dashboard (not yet built) will expose a manual *mark paid* toggle with a `paymentNote` field for reconciliation.
- **Phone collection:** use a plain `<input type="number">` in the booking flow. `<button open-type="getPhoneNumber">` is unavailable to individual developers.
- **i18n pattern:** `zh.ts` is the source-of-truth dictionary. `en.ts` imports `type Dict = typeof zh` so adding a Chinese key without an English translation is a TS error. Pages subscribe to `onLocaleChange` in `onLoad` and re-render their string slots; the global tab bar text refreshes via `wx.setTabBarItem` in [miniprogram/app.ts](miniprogram/app.ts).
- **Cloud file URLs:** the pet photo and vaccine cert are stored as 云开发 `cloud://` file IDs. `<image src>` renders them directly once `wx.cloud.init()` has run. Pictures uploaded via [pages/pets/edit/edit.ts](miniprogram/pages/pets/edit/edit.ts) go to `pets/<openid>/<field>-<ts>.jpg`.
- **WXML is not TS-typed.** Template bindings are stringly typed. Keep page `data` shapes simple and make sure every binding has a corresponding key in `data` (initialized to an empty string / sensible default) so first-render doesn't show literal `{{key}}`.

## Commands

- `npm install` — install TS + api-typings (root, dev-only).
- `npm run typecheck` — type-check the Mini Program without emitting (`tsc --noEmit` against [miniprogram/tsconfig.json](miniprogram/tsconfig.json)).
- No test runner is set up yet — add one (recommendation: Vitest for cloud functions, plus `miniprogram-simulate` for components) when test coverage matters.

## v1 backlog (priority order)

1. ~~Pet profile CRUD~~ — landed in v0.2.
2. ~~Daycare home identity page~~ — landed in v0.3 (single hero photo for now; multi-photo carousel deferred to v2 polish).
3. ~~Owner service/availability editor~~ — landed in v0.4. `services` + `availabilityOverrides` collections; owner-only list + edit pages reachable from the profile tab's owner-tools section.
4. ~~Calendar view with per-service daily capacity counter~~ — landed in v0.5. `capacityRange` cloud function + `pages/calendar/`. Booking flow (#5) will wire cell taps into the date-range picker.
5. **Booking creation flow** — date-range picker with hour-granularity drop-off/pick-up times, pet multi-select, service picker (rows from `services`), optional add-ons (rows from `addons`), waiver e-sign capturing `agreementAcceptedAt` + `agreementVersion`, confirmation screen showing cancel/refund policy and 寄养协议.
6. **Recurring bookings** — `Booking.recurrence` describes the template; per-instance bookings carry `parentBookingId`. Generation happens server-side on confirm.
7. **Waitlist** — `waitlistEntries` collection. When a parent's desired service+date range is over capacity, offer to join the waitlist; owner can promote an entry into a real booking when capacity opens.
8. **My bookings (pet parent)** — list + detail + cancel (respecting cancel policy from `daycareConfig`).
9. **Owner dashboard** — today's drop-offs/pick-ups, calendar block-out, manual walk-in entry, payment paid/unpaid toggle + note, waitlist queue.
10. **2-way messaging parent ↔ owner** — `messageThreads` + `messages` collections, one thread per booking (or pre-booking inquiry). MVP can poll every 10s when the thread is open; upgrade to 云开发 实时数据推送 later. Plumb a red-dot badge on the home + profile tabs.
11. **Service add-ons catalog** — `addons` collection (grooming, extra walks, medication admin). Embedded into `Booking.addOns` at booking time so historical pricing is preserved.
12. **Subscribe-message reminders** — 24h before drop-off, day-of pick-up, payment due. Requires the user to grant `wx.requestSubscribeMessage` permission at booking time.
13. **v2 delighters:** daily photo updates, vaccine cert OCR with expiry warnings, multi-pet sibling discount, post-stay report card, repeat-customer points, prepay credit packs (once WeChat Pay is unlocked by 企业认证).

## Constraints to remember

- **No WeChat Pay** in v1 — don't add `wx.requestPayment` or merchant-cert flows.
- **No `getPhoneNumber`** — collect phone manually.
- **Main package limit 2 MB** — once the app grows, move secondary flows into a subpackage. The current scaffold is well under.
- **ICP备案** required before submitting for review (since 2023-09). Not blocking for IDE preview.
- **Privacy popup** is enabled (`__usePrivacyCheck__: true` in [miniprogram/app.json](miniprogram/app.json)). Any new `wx.*` API that touches user info needs an entry in the privacy 协议.
- **云开发 free env ends 2026-12-31.** After that, billing kicks in at ~¥19.9/month base + usage. Watch invocation counts and DB ops as the app grows.
