# `pages/profile/`

The **我的 / Me** tab. Third tab in [`app.json`](../../app.json) (`pages/profile/profile`).

## What it does

Catch-all for account-level actions. Layout depends on auth + role:

1. **Signed out** → "登录" button → calls `signIn()` from `services/auth.ts`.
2. **Signed in as parent** → nickname/openid line, language switcher, *Promote to owner* form (takes a `BOOTSTRAP_OWNER_CODE`), logout.
3. **Signed in as owner** → all of the above, plus the **owner tools** section: links to `daycare/edit`, `services/list`, `availability/list`, `dashboard`, `waitlist/queue`, `addons/list`, `messages/list`.

Also displays the unread message badge (sum of `unreadForParent` or `unreadForOwner` from `messageThreadList`).

## Files

| File | Purpose |
| --- | --- |
| `profile.ts` | Lifecycle, role-aware UI, `signIn` / `signOut` / `promoteToOwner` wiring, owner-tools navigation, unread-badge refresh on `onShow`. |
| `profile.wxml` | Conditional blocks for signed-out / parent / owner views. Embeds `<lang-switcher />`. |
| `profile.wxss` | Section card styling, badge chip. |
| `profile.json` | Registers the `lang-switcher` component (see [`components/lang-switcher/`](../../components/lang-switcher/index.ts)). |

## Data dependencies

- [`services/auth.ts`](../../services/auth.ts) — `signIn()`, `signOut()`.
- [`services/user.ts`](../../services/user.ts) — `getCurrentUser()`, `isOwner()`, `refreshCurrentUser()`, `promoteToOwner(code)`.
- [`services/message.ts`](../../services/message.ts) — `messageThreadList()` + `totalUnreadFor()` for the unread badge.
- [`cloudfunctions/login/`](../../../cloudfunctions/login/) and [`cloudfunctions/userPromote/`](../../../cloudfunctions/userPromote/).

## Behavior notes

- Owner promotion requires the `BOOTSTRAP_OWNER_CODE` environment variable set on the `userPromote` cloud function. Without it, the function refuses all calls — see the project [`CLAUDE.md`](../../../CLAUDE.md) for setup.
- The unread badge refreshes only on this tab's `onShow` (not globally polled). It can be slightly stale until the user opens the tab — acceptable for v1.
- Sign-in calls the `login` cloud function which upserts a `users` row by `openid`. The returned user is cached in `App.globalData.user` and `wx.storage`.
