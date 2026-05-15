# `miniprogram/pages/`

Every screen the user sees. Page routing is declared in [`miniprogram/app.json`](../app.json) under `"pages"`; the first three pages register as the three tab-bar entries.

## Layout

Each leaf page is a folder with the standard 4-file shape:

```
<page-name>/
├── <page-name>.json     # page-level config: window title, usingComponents
├── <page-name>.ts       # Page({ ... }) lifecycle + data + methods
├── <page-name>.wxml     # template
└── <page-name>.wxss     # styles
```

## Page-group READMEs

Each group folder (one level above the leaf page) has its own README with detailed notes on the pages inside:

| Group | README | Pages | Role |
| --- | --- | --- | --- |
| `index/` | [README](index/README.md) | `index` | Tab 1: landing page (daycare info + CTAs). |
| `pets/` | [README](pets/README.md) | `list`, `edit` | Tab 2: pet CRUD. |
| `profile/` | [README](profile/README.md) | `profile` | Tab 3: account + owner tools. |
| `daycare/` | [README](daycare/README.md) | `edit` | Owner: daycare config + reminder templates. |
| `services/` | [README](services/README.md) | `list`, `edit` | Owner: service tier catalog. |
| `availability/` | [README](availability/README.md) | `list`, `edit` | Owner: per-day capacity overrides. |
| `calendar/` | [README](calendar/README.md) | `calendar` | Parent: month grid with remaining-slot counts. |
| `booking/` | [README](booking/README.md) | `new` | Parent: booking form (dates + pets + recurrence + waiver + add-ons). |
| `bookings/` | [README](bookings/README.md) | `list`, `detail` | Parent: My bookings + per-booking detail (owner panel embedded). |
| `waitlist/` | [README](waitlist/README.md) | `queue` | Owner: waitlist queue with promote action. |
| `dashboard/` | [README](dashboard/README.md) | `dashboard` | Owner: today's drop-offs / pick-ups / staying. |
| `messages/` | [README](messages/README.md) | `list`, `thread` | 2-way messaging parent ↔ owner. |
| `addons/` | [README](addons/README.md) | `list`, `edit` | Owner: add-on catalog. |

## Conventions

### Lifecycle template

```ts
import { t, onLocaleChange } from '../../i18n/index';

Page({
  data: { /* every WXML binding initialized to a sensible default */ },
  unsubscribe: undefined as (() => void) | undefined,

  onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => this.refreshStrings());
  },

  onShow() {
    /* data refresh, auth gate */
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() { /* setData with t('...') values */ },
});
```

### Auth gating

Pages that require sign-in check `getOpenid()` in `onShow`. If empty, render an auth-required prompt and offer a button that does `wx.switchTab({ url: '/pages/profile/profile' })`. Trust boundary is the server — every cloud function reads `cloud.getWXContext().OPENID` and re-validates ownership / role.

### Role gating

Owner-only pages call `await refreshCurrentUser()` then `isOwner()` on entry. Render an unauthorized note if `false`. The corresponding cloud functions re-read the `users.role` field on every call — the client check is purely a UX courtesy.

### Date math

**UTC start-of-day** everywhere — `Date.UTC(y, m, d)`. Drop-off / pick-up bucketing, calendar cells, availability overrides, dashboard buckets all align on UTC. The daycare is assumed to be in 中国 (UTC+8), so UTC midnight = 08:00 CST and the calendar day matches CST through 16:00 UTC. See [`CLAUDE.md`](../../CLAUDE.md) → "Date math = UTC start-of-day" for the timezone caveat.

### Navigation

- **Tabs** (`wx.switchTab`): three pages registered in `app.json`'s `tabBar.list` — `index`, `pets/list`, `profile`.
- **Subpages** (`wx.navigateTo`): everything else. Subpages can pass route params (`?id=...`, `?serviceId=...`).
- **Back** (`wx.navigateBack`): after a successful mutate-and-toast flow (cancel, save, etc.), pages typically `setTimeout(() => wx.navigateBack(), 600)` to let the toast show.

## Adding a new page

1. Create `pages/<group>/<name>/<name>.{ts,wxml,wxss,json}`.
2. Append the route to `"pages"` in [`app.json`](../app.json). Subpages don't go in `tabBar`.
3. Drop a `README.md` in the group folder describing the new page (follow the patterns in the existing group READMEs).
4. If the page calls a new cloud function, also add a wrapper to [`services/`](../services/) and register the function under [`cloudfunctions/`](../../cloudfunctions/).
