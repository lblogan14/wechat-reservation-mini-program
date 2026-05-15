# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

v0.13 landed on 2026-05-14 (subscribe-message reminders). All 12 v1 milestones from the original backlog are now coded; v2 delighters (#13) remain.

- Project shell + bilingual zh/en i18n + locale-reactive tab bar
- Sign-in flow + cached User with `role`
- Pet profile CRUD, daycare identity, services + availability (v0.4)
- Availability calendar (v0.5)
- Booking creation flow (v0.6) + recurring bookings (v0.7)
- My bookings (v0.8) + waitlist (v0.9)
- Owner dashboard (v0.10)
- 2-way messaging (v0.11)
- Service add-ons (v0.12): `addons` catalog + booking form integration; frozen `BookingAddOn` snapshots on every booking
- **Subscribe-message reminders** (v0.13): daily timer-triggered `sendReminders` cloud function fires 24h drop-off + day-of pick-up reminders via `cloud.openapi.subscribeMessage.send`. Idempotent: each booking carries `reminderSentDropoff` / `reminderSentPickup` flags. Owner stores two template IDs (drop-off, pick-up) in `daycareConfig` via a new section on the daycare edit page. Booking submit calls `wx.requestSubscribeMessage` with the configured tmpl IDs so the parent grants permission. **Requires user setup**: register two templates in 微信公众平台 → 订阅消息 (one for 24h drop-off reminder, one for pick-up day) and paste IDs in. Without templates configured, `sendReminders` returns early and the booking form skips the permission prompt. Payment-due reminder deferred (no clear billing trigger in v1).
- Three tabs: 首页 / 我的宠物 / 我的, all bilingual-aware
- Thirty-three cloud functions (+1 from v0.12): adds `sendReminders`

Not yet implemented: walk-in manual entry, pre-booking inquiry threads, payment-due reminder, v2 delighters (#13).

## v0.6 decisions doc

Reasonable defaults baked into the booking flow — flag any that need changing:

- **Auto-confirm** on submit when capacity exists; no manual owner approval gate. Owner cancels via the (not-yet-built) dashboard if needed.
- **Slot accounting**: half-open `[dropoffDay, pickupDay)`. Drop off 6pm Wed → pick up 9am Thu = 1 night, consumes 1 slot on Wed only. Drop off Wed → pick up Fri = 2 nights, consumes 1 slot on Wed and 1 on Thu.
- **Pets per booking**: any pet may join any service tier; N pets = N slots that day. Multi-pet sibling discount is v2.
- **Waiver UX**: a checkbox once the user has read the agreement. Scroll-to-bottom enforcement deferred to v2.
- **Time pickers**: `mode="time"` with hour granularity, no constraint to daycare hours. If the chosen times fall outside `daycareConfig.hoursOpen`–`hoursClose`, the form shows a warning ("owner will verify at drop-off") but does not block submission.
- **Race condition**: `bookingCreate` reads bookings → checks capacity → inserts; no transaction. If two parents simultaneously book the last slot, one returns `ok:false, error:'insufficient capacity'`. Owner can resolve duplicates via dashboard. Revisit if volume warrants a transaction.
- **Missing agreement**: if the owner hasn't set up `agreementZh`/`agreementEn`, the waiver section shows a note and submission stores `agreementVersion: 'no-agreement-v0'` so we can later identify pre-waiver bookings.
- **Add-ons UI** is deferred to backlog #11 (the `BookingAddOn`/`AddOn` schema stubs are in place).

## v0.7 recurrence decisions

- **Eager generation**: when recurrence is set, all occurrences are computed and inserted at submit time. Each instance is a real `bookings` row with `parentBookingId` pointing at the template (the first occurrence, which carries `recurrence`). No lazy / virtual occurrences. Simpler; easier to cancel a single instance later.
- **Cap**: `MAX_OCCURRENCES = 60` server-side. Form previews the count and disables submit when over the cap. (≈ 1 year of weekly, 2 months of daily.)
- **Pattern shapes**: only `'weekly'` (with optional `daysOfWeek`) and `'daily'`. No biweekly / custom intervals in v1.
- **Day-of-week defaulting**: if pattern is `'weekly'` and no `daysOfWeek` provided, the template dropoff's weekday is used. So picking just "weekly" with no chips works as "every <same weekday>".
- **Capacity check across the series**: the server builds a `need[date] = sum(slots for every occurrence that consumes that date)` map and validates every day touched by any occurrence against `(base + overrides - existing bookings)`. Overlapping occurrences (e.g., a 3-night stay every Mon AND Wed) naturally double-count and will fail capacity when they should.
- **Cancellation**: not yet built. When #8 lands, expect two affordances — cancel single instance vs cancel series (walks `parentBookingId`).
- **Pricing**: each instance carries its own `totalPrice`; the top-level response totals the series so the form can show "createdTotal".

## v0.8/0.9 my-bookings + waitlist decisions

- **Cancellation rules**: parent (and owner) can cancel only `confirmed` bookings. `checked_in` / `checked_out` are immutable from the app; owner can adjust via 云开发 console if needed. **No cancel-policy enforcement** — `daycareConfig.cancelPolicyZh/En` is shown for expectations only; the server doesn't gate by lead time.
- **Cancel-series**: walks `_id == seriesRoot OR parentBookingId == seriesRoot` where `seriesRoot = target.parentBookingId || target._id`. Already-non-confirmed bookings are skipped. Sets each to `cancelled` (no soft-delete; the row stays so historical reports work).
- **List page status grouping**: client groups bookings into Upcoming (pickupAt >= now and not cancelled), Past (pickupAt < now and not cancelled), Cancelled. Recurring members get a small ↻ chip. Both template and instance rows show — the user sees the full series in their list.
- **Server enrichment**: `bookingList` and `waitlistList` resolve service rows (max 200) + pet rows (max 500) by id and attach `serviceNameZh`, `serviceNameEn`, `petNames`. Saves the client a round-trip but adds two DB reads server-side per call. Fine at expected volumes (single home, ≤ low hundreds of bookings).
- **Waitlist trigger**: only single-stay bookings (`!recurrence`) get the waitlist offer. Recurring series would need each instance's date range stored separately; punt for v1.
- **Promotion side-effect**: `waitlistPromote` creates a `bookings` row with `agreementVersion: 'promoted-from-waitlist'` (no waiver acceptance — owner is acting as proxy). If you later want stricter compliance, surface a one-tap waiver to the parent before promotion.
- **Status pills**: each booking + waitlist status gets a colored chip. Mapping: confirmed=green, checked_in=blue, checked_out=grey, cancelled=red, no_show=yellow, waitlist-waiting=yellow, waitlist-offered=blue.

## v0.10 dashboard decisions

- **Today bucketing** is computed client-side from `bookingList({scope:'all'})` — the returned set is bounded by `bookings` limit 200; fine for single-home scale. Buckets:
  - **Drop-offs today**: `confirmed` AND `dropoffDay === today` (UTC start-of-day).
  - **Pick-ups today**: `checked_in` AND `pickupDay === today`.
  - **Currently staying**: `checked_in` AND `dropoffDay <= today < pickupDay`.
- **Status transitions enforced server-side** in `bookingStatusUpdate`. Allowed: `confirmed → checked_in`, `confirmed → no_show`, `checked_in → checked_out`. Any other transition errors with `cannot transition X → Y`. Parents go through `bookingCancel`, not this endpoint.
- **Owner panel on booking detail**: visible only when `isOwner()` returns true (client check) AND uses `scope:'all'` to fetch (server check). Even if a non-owner manages to render the panel, the server-side `bookingStatusUpdate` / `bookingPaymentUpdate` both re-verify owner role.
- **Payment is manual**: since individual-dev blocks WeChat Pay, `bookingPaymentUpdate` just sets `paymentStatus` + `paymentNote`. The owner records "paid by 支付宝 transfer 5/14" or similar. Surfaces back on the detail page.
- **Walk-in entry deferred**: the dashboard does NOT yet support the owner creating a booking on behalf of a parent. Workaround in v1: ask the parent to use the app, or insert directly in 云开发 console. Building a real walk-in flow requires letting the owner choose any parent's pets, which is a UX rewrite of the booking form. Revisit if walk-ins become common.
- **No timezone refinement yet**: dashboard uses UTC start-of-day everywhere. For a 中国 daycare the calendar day matches CST until 16:00 UTC (00:00 CST next day), so the only practical issue would be 4pm–midnight UTC drop-offs on the previous day. Fix later by switching to a fixed +08:00 offset (already flagged in capacity / date math notes).

## v0.11 messaging decisions

- **One thread per booking**, auto-created on first send (`messageSend` accepts `{ bookingId, body }` and creates the thread). The `messageThreadEnsure` helper lets the booking detail page open the thread without sending a first message.
- **No pre-booking inquiry threads**: every thread has a `bookingId`. If you want to ask the owner a question before booking, you have to book first (or call). Revisit when there's a real product use case.
- **Polling, not push**: `setInterval(fetch, 10_000)` while the thread page is open; cleared on `onHide` / `onUnload`. Each poll calls `messageList(threadId)` which returns the full message array (limit 500). For v1 this is fine — single home, low message volume. Upgrade to 云开发 实时数据推送 (real-time DB watch) when conversations get long or chatty.
- **Read receipts**: per-message `readByParentAt` / `readByOwnerAt` timestamps + thread-level `unreadForParent` / `unreadForOwner` counters. `messageMarkRead` updates both in one call. Called on thread open AND each poll cycle that detected new messages.
- **Tab bar badge**: refreshed on profile tab `onShow` (after `refreshCurrentUser`). NOT refreshed on every tab switch — that would require global polling. So the badge can be stale until the user opens the profile tab; acceptable for MVP. Improve later by polling at App level.
- **Owner sees all threads, parents see own**: `messageThreadList` honours `scope:'all'` only for owners (server-side check). Owner total-unread is sum of `unreadForOwner` across all threads.
- **Message body**: text-only in v0.11. Schema supports `attachmentFileID` but the composer doesn't yet upload images; the thread view renders an `<image>` if a message has one. Adding image upload to the composer is ~30 lines whenever it's wanted.
- **Auto-mark-read on open**: when a parent opens a thread, all messages from the owner are marked read. Same in reverse. No "unread until visible" granularity (e.g., scrolling past).

## v0.12 add-ons decisions

- **Per-booking, not per-pet**: an addon's quantity multiplies its unit price by the chargeBasis multiplier (nights for `per_night`, 1 for `per_stay`). The same addon with quantity=2 means "I want 2 of this thing for this booking" — not "2 per pet." If the owner needs per-pet scaling, instruct the parent to set quantity = petCount.
- **Frozen at booking time**: `bookingCreate` resolves each `addonId` against the live catalog and embeds the full `BookingAddOn` snapshot (`addonId`, `nameZh`, `nameEn`, `unitPrice`, `quantity`, `chargeBasis`) onto every booking row in the series. This is why `addonDelete` is a safe hard delete — historical bookings still display correctly.
- **Active filter**: only `active: true` addons appear in the booking form. Catalog list (owner side) shows both active and inactive with a chip. Inactive addons that were embedded on past bookings keep their data — they just stop appearing as new options.
- **Recurring bookings get the same addons**: every instance in the series carries the same `addOns` array; the per-night cost is recomputed per instance based on that instance's `nights`.
- **Charge basis**: only `per_stay` and `per_night`. No "per-pet" basis. Owner expresses "per pet" needs by telling parents to bump the quantity.
- **Pricing UI**: stepper (+/−) per addon, quantity defaults to 0. Tapping − below 0 stays at 0. No cap (owner trusts parent input; server hard-cap is implicit via `Math.floor` + price field).
- **Summary section**: when add-on subtotal > 0, an extra row appears between Pets and Total showing the add-on subtotal (¥N). The grand total at the bottom always reflects stay cost + add-on cost.

## v0.13 reminders decisions + setup

**Setup steps for the owner (one-time, in 微信公众平台 → 功能 → 订阅消息):**

1. Pick two long-term subscribe message templates: one for "drop-off reminder" (24h before), one for "pick-up reminder" (day of). Each has 4–5 fields. The cloud function fills these slots: `thing1` (daycare name), `thing2` (pet names, comma-joined), `thing3` (service name), `date4` (drop-off OR pick-up date+time), `thing5` (a short hint string). You can rearrange field meanings in your template — just keep the same key names, or edit `buildData` in `cloudfunctions/sendReminders/index.js` to match your template.
2. Copy each 25-character template ID into the daycare edit page → "Subscribe-message reminders" section. Save.
3. Deploy `sendReminders` cloud function. It registers a daily timer trigger (cron `0 0 1 * * * *` = 01:00 UTC = 09:00 CST). The 公众平台 还需要把 `subscribeMessage.send` 加到 cloud function 权限列表（已写在 `cloudfunctions/sendReminders/config.json`）。
4. After the next booking, the parent will see a WeChat-native modal asking them to allow up to N reminders.

**Behavior decisions:**

- **Daily timer**: cron `0 0 1 * * * *` = once daily at 01:00 UTC (= 09:00 CST). Drop-off reminders fire ~24h ahead because they run the day before the dropoff day starts; pick-up reminders fire on the morning of pick-up. The owner can change the cadence in `cloudfunctions/sendReminders/config.json`.
- **Idempotent**: each booking carries `reminderSentDropoff` / `reminderSentPickup` flags. The trigger updates these to `true` on a successful send, so re-runs of the timer (manual + scheduled) don't double-send.
- **Permission grant**: `wx.requestSubscribeMessage` is called once per booking submit. WeChat's API is "consumable one-at-a-time" — each `subscribeMessage.send` call burns one grant. If the user runs out, the send call errors and we just log it. For a typical 1-night booking, asking for 2 grants (drop-off + pick-up) at booking time covers exactly the right number.
- **Skip when no templates**: if `daycareConfig.reminderDropoffTmplId` and `reminderPickupTmplId` are both empty, the booking form skips the permission popup and `sendReminders` no-ops with a "no template IDs configured" reason. So the app works fine without setup; reminders just don't fire.
- **Active-statuses only**: `sendReminders` only sends for bookings with status `confirmed` or `checked_in`. Cancelled / no-show / checked_out are skipped.
- **Field-mapping caveat**: WeChat enforces strict per-field length (≈ 20 chars) + character restrictions. `buildData` slices to 20 chars defensively. If the user's template fields are named differently (e.g., `time4` not `date4`), edit `buildData` rather than reshaping templates.
- **Payment-due reminder deferred**: there's no billing lifecycle in v1 (no WeChat Pay). A "your payment is overdue" reminder needs a clear trigger (e.g., 7 days after checkout with paymentStatus still 'pending'). Punted — can be added as a third arm of `sendReminders` later.
- **Timezone**: cron is UTC. CST is UTC+8. 01:00 UTC = 09:00 CST runs **once per Beijing morning**, which is the right semantic for "tomorrow" / "today" date keys (stored as UTC start-of-day).

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
5. **Create database collections** in the 云开发 console (the SDK does not auto-create them). For v0.13: `users` + `pets` + `daycareConfig` + `services` + `availabilityOverrides` + `bookings` + `waitlistEntries` + `messageThreads` + `messages` + `addons`. All v1 collections are now in place.
6. **Deploy cloud functions:** for each folder under [cloudfunctions/](cloudfunctions/), right-click in the IDE → *上传并部署：云端安装依赖（不上传 node_modules）*. The IDE handles `npm install` server-side. Current functions: `login`, `userGet`, `userPromote`, `petList`, `petUpsert`, `petDelete`, `daycareGet`, `daycareUpsert`, `serviceList`, `serviceUpsert`, `serviceDelete`, `availabilityList`, `availabilityUpsert`, `availabilityDelete`, `capacityRange`, `bookingCreate`, `bookingList`, `bookingCancel`, `bookingStatusUpdate`, `bookingPaymentUpdate`, `waitlistCreate`, `waitlistList`, `waitlistCancel`, `waitlistPromote`, `messageThreadList`, `messageList`, `messageSend`, `messageMarkRead`, `messageThreadEnsure`, `addonList`, `addonUpsert`, `addonDelete`, `sendReminders`.
   - For `userPromote`, also set a `BOOTSTRAP_OWNER_CODE` environment variable on the cloud function (cloud-function panel → 环境变量). The first parent uses that code in the profile page's "Promote to owner" form to flip their `User.role` to `'owner'`. Without the env var, the function refuses all promotions.
   - For `sendReminders`, deploy normally — the daily timer trigger is declared in its `config.json`. See **v0.13 reminders decisions + setup** above for the 微信公众平台 template setup that's required before reminders actually fire.
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
│   │   ├── booking/new/               # subpage: parent booking form (dates + pets + waiver + recurrence)
│   │   ├── bookings/list/             # subpage: parent's bookings + inline waitlist entries
│   │   ├── bookings/detail/           # subpage: single booking detail + cancel; owner panel for status/payment
│   │   ├── waitlist/queue/            # subpage: owner-only waitlist queue with promote action
│   │   ├── dashboard/                 # subpage: owner-only today view (drop-offs / pick-ups / staying)
│   │   ├── messages/list/             # subpage: list of message threads (parent own; owner all)
│   │   ├── messages/thread/           # subpage: chat view for a single thread; polls every 10s
│   │   ├── addons/list/               # subpage: owner-only addon catalog
│   │   ├── addons/edit/               # subpage: owner-only addon form
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
│   │   ├── capacity.ts                # capacityRange — per-day remaining slots for a service
│   │   ├── booking.ts                 # bookingCreate / bookingList / bookingCancel / bookingStatusUpdate / bookingPaymentUpdate
│   │   ├── waitlist.ts                # waitlistCreate / waitlistList / waitlistCancel / waitlistPromote
│   │   ├── message.ts                 # messageThreadList / messageList / messageSend / messageMarkRead / messageThreadEnsure / totalUnreadFor
│   │   └── addon.ts                   # addonList / addonUpsert / addonDelete
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
│   ├── capacityRange/                 # join services + overrides + bookings; return per-day remaining for a date window
│   ├── bookingCreate/                 # validate pets+capacity, insert booking with status 'confirmed'; supports recurrence
│   ├── bookingList/                   # list caller's bookings (or scope:'all' for owner); server-enriched with serviceName + petNames
│   ├── bookingCancel/                 # cancel a single confirmed booking or the whole series (cancelSeries:true)
│   ├── bookingStatusUpdate/           # owner-only: confirmed→checked_in/no_show, checked_in→checked_out
│   ├── bookingPaymentUpdate/          # owner-only: set paymentStatus + paymentNote (manual since no WeChat Pay)
│   ├── waitlistCreate/                # insert a waitlist entry for the caller
│   ├── waitlistList/                  # list caller's waitlist entries (or scope:'all' for owner queue) — enriched
│   ├── waitlistCancel/                # cancel a waitlist entry (parent own; owner any)
│   ├── waitlistPromote/               # owner-only: re-check capacity then convert entry → confirmed booking
│   ├── messageThreadList/             # list message threads (mine / scope:'all' for owner) — server-enriched
│   ├── messageList/                   # list all messages in a thread
│   ├── messageSend/                   # send a message; auto-creates thread for a bookingId
│   ├── messageMarkRead/               # mark all unread messages in a thread read for caller's role
│   ├── messageThreadEnsure/           # find or create thread for a booking (open chat without sending)
│   ├── addonList/                     # list addons (active by default; includeInactive for owner views)
│   ├── addonUpsert/                   # create or update an addon — owner only
│   ├── addonDelete/                   # hard-delete an addon — owner only (safe; bookings keep frozen copies)
│   └── sendReminders/                 # daily timer (01:00 UTC): fire 24h drop-off + day-of pick-up subscribe-message reminders
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
4. ~~Calendar view with per-service daily capacity counter~~ — landed in v0.5. `capacityRange` cloud function + `pages/calendar/`. Booking flow (#5) wires cell taps into the date-range picker.
5. ~~Booking creation flow~~ — landed in v0.6. `pages/booking/new/` + `bookingCreate` + `bookingList`. See "v0.6 decisions doc" above for the defaults baked in (auto-confirm, half-open slot accounting, no-transaction race window, etc.). Add-ons UI deferred to #11.
6. ~~Recurring bookings~~ — landed in v0.7. Recurrence card on `pages/booking/new/`; `bookingCreate` generates and inserts the series eagerly with `parentBookingId` linking. Cap of 60 occurrences. See "v0.7 recurrence decisions" above. Cancel-series UI ships with #8.
7. ~~Waitlist~~ — landed in v0.9. `waitlistEntries` + four cloud functions; capacity-blocked single-stay attempts get a "Join waitlist" modal; owner queue at `pages/waitlist/queue/` with Promote-to-Booking action. Series-waitlisting deferred to v2.
8. ~~My bookings (pet parent)~~ — landed in v0.8. `pages/bookings/list/` (grouped Upcoming / Past / Cancelled + inline Waitlist) + `pages/bookings/detail/` (cancel single + cancel-series). No cancel-policy lead-time enforcement in v1; the daycare's `cancelPolicyZh/En` is shown for expectations only.
9. ~~Owner dashboard~~ — landed in v0.10. Today view (`pages/dashboard/`) with inline check-in / check-out / no-show actions; owner panel on the booking detail page handles payment status + note. Walk-in manual entry deferred to v1.x (would require an owner-side variant of the booking form that lets the owner pick any parent's pets). Calendar block-out and waitlist queue already accessible from owner-tools.
10. ~~2-way messaging parent ↔ owner~~ — landed in v0.11. `messageThreads` + `messages` collections; one thread per booking auto-created on first message via `messageThreadEnsure`. 10s polling while thread is open. Tab bar badge on profile tab refreshes on profile `onShow`. Pre-booking inquiry threads deferred.
11. ~~Service add-ons catalog~~ — landed in v0.12. `addons` collection + owner CRUD pages + booking form section. `bookingCreate` freezes a `BookingAddOn` snapshot onto each booking row so deletes from the catalog don't break history.
12. ~~Subscribe-message reminders~~ — landed in v0.13. `sendReminders` daily timer + `wx.requestSubscribeMessage` permission grant at booking time + idempotency flags. Payment-due reminder deferred. **Requires one-time template setup in 微信公众平台 → 订阅消息** (see v0.13 decisions doc for steps).
13. **v2 delighters:** daily photo updates, vaccine cert OCR with expiry warnings, multi-pet sibling discount, post-stay report card, repeat-customer points, prepay credit packs (once WeChat Pay is unlocked by 企业认证).

## Constraints to remember

- **No WeChat Pay** in v1 — don't add `wx.requestPayment` or merchant-cert flows.
- **No `getPhoneNumber`** — collect phone manually.
- **Main package limit 2 MB** — once the app grows, move secondary flows into a subpackage. The current scaffold is well under.
- **ICP备案** required before submitting for review (since 2023-09). Not blocking for IDE preview.
- **Privacy popup** is enabled (`__usePrivacyCheck__: true` in [miniprogram/app.json](miniprogram/app.json)). Any new `wx.*` API that touches user info needs an entry in the privacy 协议.
- **云开发 free env ends 2026-12-31.** After that, billing kicks in at ~¥19.9/month base + usage. Watch invocation counts and DB ops as the app grows.
