# `pages/index/`

The **home / landing** page. Registered as the first tab in [`app.json`](../../app.json) (`pages/index/index`, tab label 首页).

## What it does

Renders the daycare's hero card (name, address, phone, hours, optional photo) and surfaces the two primary parent CTAs:

- **立即预约 / Book now** → navigates to `/pages/calendar/calendar`.
- **我的订单 / My bookings** → navigates to `/pages/bookings/list/list`.

Tapping the phone number triggers `wx.makePhoneCall`.

## Files

| File | Purpose |
| --- | --- |
| `index.ts` | Page logic. Subscribes to locale changes, calls `daycareGet()` on `onShow`, picks the locale-appropriate `nameZh`/`nameEn`. |
| `index.wxml` | Layout: title + subtitle, optional `<image>` from `daycareConfig.photoFileIDs[0]`, info rows, two CTAs. |
| `index.wxss` | Styling for the hero card and CTAs. |
| `index.json` | Disables the navigation bar custom title (uses global). |

## Data dependencies

- [`services/daycare.ts`](../../services/daycare.ts) — `daycareGet()` returns the singleton `DaycareConfig` row (or `null` before the owner has saved it).
- [`i18n/index.ts`](../../i18n/index.ts) — `t('app_name')`, `t('greeting')`, `t('cta_book')`, `t('cta_my_bookings')`, `t('daycare_card_*')`.

## Behavior notes

- Loads on **every** `onShow`, so changes the owner makes via `pages/daycare/edit/` show up immediately on tab switch.
- Falls back to the empty state when `daycareGet()` returns `null` (no daycareConfig row yet).
- The page **does not** require sign-in — anyone can land here and see the daycare info.
