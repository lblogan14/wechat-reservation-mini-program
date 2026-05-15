# `miniprogram/components/`

Reusable WeChat Mini Program custom components shared across pages. Each component is a folder with `index.ts`, `index.wxml`, `index.wxss`, `index.json` — the standard 4-file shape required by `Component({...})`.

## Components

### [`pet-card/`](pet-card/index.ts)

List-row card for a `PetDaycare.Pet`. Used by `pages/pets/list/` and the booking form's pet picker.

- **Property**: `pet: PetDaycare.Pet | null`.
- **Renders**: photo (or 🐾 fallback), name, species + breed line, weight, and a yellow **vaccine warning chip** if `vaccineCertFileID` is missing or `vaccineExpiry < now`.
- **Events**: emits `bind:tap` with `{ _id }` when the card is tapped.
- **i18n-aware**: subscribes to `onLocaleChange` in `attached`, unsubscribes in `detached`.

The vaccine chip is **warning-only** in v1 — bookings are not blocked. The owner verifies the paper cert at drop-off. See [`CLAUDE.md`](../../CLAUDE.md) → "Vaccine gating policy" for the rationale.

### [`lang-switcher/`](lang-switcher/index.ts)

Simple zh ↔ en toggle. Embedded in `pages/profile/profile.wxml`.

- **No properties**.
- Reads `getLocale()` on attach.
- `setLocale(loc)` triggers all locale listeners and persists the choice to `wx.storage` (key `locale`).
- The tab bar text updates via `wx.setTabBarItem` in [`app.ts`](../app.ts)'s `onLaunch` subscription.

## Conventions

- **Lifecycle**: subscribe in `attached`, store the unsubscriber in a module-scope `WeakMap` keyed by `this`, and clean up in `detached`. Don't lean on `this.unsub` instance fields — `Component` instance shape is stricter than `Page` and TypeScript gets cranky.
- **i18n in components**: import from `../../i18n/index` and re-render via `setData` inside an `onLocaleChange` callback.
- **No `Page({...})` here** — components are `Component({...})` only. Pages live under `miniprogram/pages/`.
- **Property typing**: WXML bindings are stringly typed (no compile-time check). Always initialize a sensible default in `data` for every WXML slot the component renders.

## Adding a new component

1. Create `components/<name>/` with `index.{ts,wxml,wxss,json}`.
2. In the consuming page's JSON, add:
   ```json
   { "usingComponents": { "<name>": "/components/<name>/index" } }
   ```
3. Use `<{name} ... />` in the page WXML.
4. If the component depends on i18n, mirror the `WeakMap` cleanup pattern from `pet-card` and `lang-switcher`.
