# 宠物寄养预约 / Pet Daycare Reservation Mini Program

A WeChat Mini Program that lets pet owners book stays at a single pet daycare home. Bilingual (zh / en), built on WeChat Cloud Development (云开发) — no separate backend server.

**Status:** v0.13 (2026-05-14). All 12 v1 milestones in [`CLAUDE.md`](CLAUDE.md) → "v1 backlog" are coded. v2 delighters (item #13) are deferred.

> 中文：本项目是一个面向单家宠物寄养工作室的微信小程序，覆盖宠物档案、服务管理、容量调整、日历、单次/重复预约、候补队列、店主仪表板、双向消息、附加服务以及订阅消息提醒等完整流程。后端使用微信云开发（云函数 + 云数据库），前端为原生小程序 + TypeScript。

---

## Features

### Parent (pet owner)

- **Sign in** with WeChat openid; cached locally for quick relaunch.
- **Pet profiles** — name, species, breed, sex, neutered, birthdate, weight, photo, vaccine cert + expiry, feeding schedule, behavior notes, medical conditions, emergency contact. Yellow chip warns when the vaccine cert is missing or expired (warning-only in v1).
- **Daycare info card** on the home tab — name, address, phone, hours, hero photo.
- **Availability calendar** — month grid with per-day remaining slots, color-coded by load. Service picker switches between rooms / tiers.
- **Booking form** — date + time pickers, multi-pet select, add-on stepper, recurrence card (daily / weekly + days-of-week, up to 60 occurrences), waiver acceptance. Auto-confirm on submit when capacity exists.
- **My bookings** — Upcoming / Past / Cancelled buckets, plus active waitlist entries inline. Per-booking detail with cancel (single + cancel-series).
- **Waitlist** — when a single stay is blocked by capacity, parents can join the queue. Owner promotes entries back to bookings when capacity opens up.
- **Messaging** — one chat thread per booking, 10s polling, per-message read receipts, unread badge on the profile tab.
- **Subscribe-message reminders** — opt-in at booking submit; the daily timer-triggered cloud function fires drop-off (24h ahead) and pick-up (day-of) reminders.
- **Bilingual** — runtime zh ↔ en toggle; tab bar text re-renders on switch.

### Owner

Same parent surface, plus the **owner tools** section on the profile tab:

- **Daycare config editor** — identity, hours, cancel policy, waiver text, subscribe-message template IDs.
- **Service tier editor** — owner-configurable rooms/tiers with bilingual names, price per night, capacity per day, active toggle.
- **Availability override editor** — per-day capacity tweaks keyed by `(date, serviceId)`, with `capacityDelta` (relative) or `capacityAbsolute` (replaces base) modes.
- **Today dashboard** — drop-offs / pick-ups / currently-staying buckets with inline `Check in` / `Check out` / `No-show` actions.
- **Booking detail owner panel** — status transitions + manual payment status & note (no WeChat Pay in v1).
- **Waitlist queue** — promote-to-booking action that re-checks capacity.
- **Add-on catalog** — per-stay or per-night add-ons; pricing is frozen onto each booking, so deletes are safe.
- **All threads** — owner-side messaging view across every parent.

---

## Tech stack

- **Frontend:** Native WeChat Mini Program + TypeScript (`miniprogram-api-typings`). No Uni-app / Taro / cross-platform shim.
- **Backend:** WeChat Cloud Development (云开发) cloud functions + NoSQL collections.
- **Entity:** Individual developer (个人小程序). This **blocks WeChat Pay** and the `<button open-type="getPhoneNumber">` flow — v1 records payments manually and collects phone via plain input.
- **v1 scope:** Single daycare home (one owner account, many pet-parent customers). Multi-tenant marketplace is explicitly out of scope.

---

## Repository layout

```
.
├── miniprogram/              ← Mini Program frontend (TypeScript + WXML + WXSS)
│   ├── app.{ts,json,wxss}
│   ├── tsconfig.json
│   ├── pages/                ← 19 pages across 13 page-groups
│   ├── components/           ← pet-card, lang-switcher
│   ├── services/             ← TypeScript wrappers around wx.cloud.callFunction
│   ├── i18n/                 ← zh + en dictionaries
│   └── types/                ← PetDaycare namespace (domain model)
├── cloudfunctions/           ← 33 cloud functions (1 timer-triggered: sendReminders)
├── project.config.json       ← IDE-level config (AppID goes here)
├── sitemap.json
├── package.json              ← dev-only: typescript + miniprogram-api-typings
├── CLAUDE.md                 ← architecture notes + decision log + setup recipes
└── README.md                 ← this file
```

Each major folder has its own README:

- [`miniprogram/README.md`](miniprogram/README.md) — frontend overview + domain model + architectural anchors.
  - [`miniprogram/pages/README.md`](miniprogram/pages/README.md) — page registration conventions + per-page-group breakdown.
  - [`miniprogram/components/README.md`](miniprogram/components/README.md) — component conventions.
  - [`miniprogram/services/README.md`](miniprogram/services/README.md) — service-wrapper inventory.
  - [`miniprogram/i18n/README.md`](miniprogram/i18n/README.md) — locale store + `Dict = typeof zh` enforcement.
  - [`miniprogram/types/README.md`](miniprogram/types/README.md) — `PetDaycare.*` domain types.
  - Plus a README in every page-group folder (`pages/<group>/README.md`).
- [`cloudfunctions/README.md`](cloudfunctions/README.md) — backend overview + function-by-function inventory grouped by domain.

For deeper architectural rationale, decisions, and version history, see [`CLAUDE.md`](CLAUDE.md).

---

## Getting started

> Read this section if you're setting up the project from scratch. The TL;DR is at the bottom.

### 1. Register a WeChat Mini Program AppID

At https://mp.weixin.qq.com (individual developer / 个人小程序 path). Open [`project.config.json`](project.config.json) and replace `"appid": "touristappid"` with your real AppID. Without a real AppID, the simulator works but `wx.cloud` is disabled, so cloud functions and the database can't run.

### 2. Install dev dependencies

This repo uses **pnpm**, not npm. If you don't have it: `npm install -g pnpm` (once), then:

```bash
pnpm install
pnpm typecheck
```

`pnpm install` installs `miniprogram-api-typings` (TS types for `wx.*`) and `typescript`. `pnpm typecheck` runs `tsc --noEmit` against [`miniprogram/tsconfig.json`](miniprogram/tsconfig.json).

### 3. Open 微信开发者工具

Download from https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html. Import this directory; the IDE picks up [`project.config.json`](project.config.json) automatically.

### 4. Create a 云开发 environment

In the IDE: 云开发 panel → 新建环境. Copy the env ID into [`miniprogram/app.ts`](miniprogram/app.ts) at the `// TODO: replace with your 云开发 env ID` comment.

### 5. Create database collections

In the 云开发 console (the SDK does not auto-create them). v0.13 needs:

`users`, `pets`, `daycareConfig`, `services`, `availabilityOverrides`, `bookings`, `waitlistEntries`, `messageThreads`, `messages`, `addons`.

### 6. Deploy cloud functions

For each folder under [`cloudfunctions/`](cloudfunctions/), right-click in the IDE → *上传并部署：云端安装依赖（不上传 node_modules）*. The IDE handles `npm install` server-side.

Special setup:

- **`userPromote`** — set a `BOOTSTRAP_OWNER_CODE` environment variable on the cloud function (云开发 → 云函数 → 配置 → 环境变量). The first parent uses that code in the profile page's *Promote to owner* form to become the owner.
- **`sendReminders`** — the daily timer trigger is declared in [`sendReminders/config.json`](cloudfunctions/sendReminders/config.json), so it activates automatically on deploy. Reminders won't fire until the owner has registered two subscribe-message templates in 微信公众平台 → 订阅消息 and pasted the IDs into the daycare edit page.

### 7. Preview

Click *预览* in the IDE to generate a QR code; scan with WeChat. Or run in the simulator.

### TL;DR

```bash
# Once
git clone <this-repo>
cd wechat-reservation-mini-program
pnpm install
# Edit project.config.json — replace appid
# Edit miniprogram/app.ts — paste your 云开发 env ID

# Each session
pnpm typecheck          # type-check the Mini Program
# Open 微信开发者工具 → import this directory → 预览 / 真机调试
```

---

## Commands

This repo uses **pnpm**. The `pnpm-lock.yaml` is the source of truth — do not mix in `npm install` or `yarn`.

- `pnpm install` — install TS + api-typings (root, dev-only).
- `pnpm typecheck` — type-check the Mini Program without emitting (`tsc --noEmit`).
- No test runner is set up yet. Recommendation when test coverage matters: Vitest for cloud functions + `miniprogram-simulate` for components.

---

## Constraints worth remembering

- **No WeChat Pay** in v1 — don't add `wx.requestPayment` or merchant-cert flows.
- **No `<button open-type="getPhoneNumber">`** — collect phone manually.
- **Main package limit 2 MB.** Move secondary flows into a subpackage once the app grows.
- **ICP备案** required before submitting for review (since 2023-09). Not blocking for IDE preview.
- **Privacy popup** is enabled (`__usePrivacyCheck__: true` in [`miniprogram/app.json`](miniprogram/app.json)). New `wx.*` APIs that touch user info need a privacy 协议 entry.
- **云开发 free env ends 2026-12-31.** After that, billing kicks in at ~¥19.9/month base + usage.

---

## License

Not yet specified — add a `LICENSE` file before sharing publicly.

---

## Background: WeChat Mini Programs

WeChat Mini Programs are "sub-applications" inside WeChat — accessible by scanning QR codes, searching, or sharing, requiring no installation. They're built with web-like technologies (WXML for structure, WXSS for styles, JavaScript or TypeScript for logic) but run inside the WeChat container, so there's no DOM — components and APIs are WeChat-provided (`<view>`, `<button>`, `wx.*`).

For this project the choice was **native Mini Program + TypeScript** (over Uni-app / Taro) because the scope is narrow enough that a cross-platform abstraction wouldn't pay off, and a v1 timeline benefits from staying close to the platform.

> 中文：微信小程序使用 WXML 描述结构、WXSS 描述样式、JS / TS 处理逻辑。运行于微信容器中，没有 DOM。后端可任选 Node.js / PHP / Java / Python，或直接使用微信云开发的云函数（Serverless）——本项目选用云开发，降低了独立服务器、备案与运维负担。
