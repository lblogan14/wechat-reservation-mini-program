# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

v0.3 landed on 2026-05-14 (daycare home identity). The repo now provides:

- Project shell + bilingual zh/en i18n + locale-reactive tab bar
- Sign-in flow (openid via `wx.cloud.callFunction('login')`, persisted in `wx.storage`); user record (with `role`) cached in `App.globalData.user`
- Pet profile CRUD: list page (tab) + edit page with full schema (photo, vaccine cert + expiry, breed/sex/neutered/birthdate/weight, feeding/behavior/medical notes, emergency contact)
- Daycare identity: read-only card on home tab + owner-only edit page (`pages/daycare/edit/`). Owner bootstrap via `userPromote` cloud function (env-var-gated code).
- Three tabs: 首页 / 我的宠物 / 我的, all bilingual-aware
- Eight cloud functions: `login`, `petList`, `petUpsert`, `petDelete`, `daycareGet`, `daycareUpsert`, `userGet`, `userPromote`

Not yet implemented: owner service/availability editor, calendar with capacity counter, booking flow, owner dashboard, subscribe-message reminders. See **v1 backlog**.

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
5. **Create database collections** in the 云开发 console (the SDK does not auto-create them). For v0.3: `users` + `pets` + `daycareConfig`. Future milestones will add `services`, `availabilityOverrides`, `bookings`.
6. **Deploy cloud functions:** for each folder under [cloudfunctions/](cloudfunctions/), right-click in the IDE → *上传并部署：云端安装依赖（不上传 node_modules）*. The IDE handles `npm install` server-side. Current functions: `login`, `petList`, `petUpsert`, `petDelete`, `daycareGet`, `daycareUpsert`, `userGet`, `userPromote`.
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
│   │   └── daycare.ts                 # daycareGet / daycareUpsert
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
│   └── daycareUpsert/                 # upsert daycareConfig — owner role required
├── project.config.json                # IDE-level config (AppID goes here)
├── sitemap.json
└── package.json                       # dev-only: api-typings + typescript
```

## Architecture notes

- **Auth:** `wx.cloud.callFunction({ name: 'login' })`. The cloud function reads `cloud.getWXContext().OPENID` (injected by the 云开发 runtime) and upserts a `users` record. The client stashes the openid in `App.globalData.openid` + `wx.storage` and the full `User` (with `role`) in `App.globalData.user` + `wx.storage`. Pet pages check `getOpenid()` on `onShow`; if empty, they render an auth-required prompt that switches to the profile tab.
- **Owner role gating:** `User.role` is `'parent' | 'owner' | 'staff'`. Role-gated pages call `isOwner()` from [services/user.ts](miniprogram/services/user.ts); on first entry they also `await refreshCurrentUser()` to defeat stale cache. Bootstrap path: a parent signs in, types the `BOOTSTRAP_OWNER_CODE` value into the profile page's "Promote to owner" form, which calls `userPromote` → flips their `users` row to `role: 'owner'`. Server is the only trust boundary (`daycareUpsert` re-reads role on every call).
- **Pet ownership:** every pet stores `ownerOpenid`. `petList` filters by it; `petUpsert` / `petDelete` reject calls where `existing.data.ownerOpenid !== OPENID`. The cloud function — not the client — is the trust boundary.
- **Vaccine gating policy (v1):** **warning only.** The pet card and edit page surface a yellow chip if `vaccineCertFileID` or `vaccineExpiry` is missing, or `vaccineExpiry < now`. Bookings will still be allowed; the daycare owner verifies the paper cert at drop-off. To make this a hard gate later, add the check in the `bookingCreate` cloud function (not yet built).
- **Service model is owner-configurable (decided 2026-05-14):** there is no fixed `ServiceTier` enum. Each row in the `services` collection is its own tier — the owner creates rooms/tiers with `{ nameZh, nameEn, pricePerNight, capacityPerDay }` from the (not-yet-built) owner editor. `AvailabilityOverride` and `Booking` reference a service by `serviceId: string` (Service._id), not an enum.
- **Capacity model:** `Service.capacityPerDay` is the base. `AvailabilityOverride` adjusts a specific date×serviceId (block-outs, holiday surges). `Booking` consumes capacity across `dropoffAt → pickupAt` for its serviceId. See [miniprogram/types/models.d.ts](miniprogram/types/models.d.ts). A booking with N pets in service S from day D1 to day D2 consumes N slots on each day in `[D1, D2)`. Calendar query for "remaining slots on day D in service S": `Service.capacityPerDay + sum(AvailabilityOverride deltas for D,S) - sum(Booking slots overlapping D in S)`.
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
3. **Owner service/availability editor** — `services` (owner-defined rows; no fixed tier enum) + `availabilityOverrides` collections + an owner-only page gated by `User.role === 'owner'`. Bootstrap path for owner role is already in place via `userPromote`.
4. **Calendar view with per-service daily capacity counter** — uses the capacity formula above; reads `services`, `availabilityOverrides`, and the booked-slot rollup for a date range.
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
