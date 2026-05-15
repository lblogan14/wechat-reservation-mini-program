# `pages/daycare/`

The **owner-only daycare config editor**. Single subpage at `pages/daycare/edit/`.

## Sub-pages

| Path | Title | Audience |
| --- | --- | --- |
| `edit/` | 寄养信息 / Daycare config | Owner only |

Routed from the profile tab's owner-tools section.

## What it does

Edits the singleton `daycareConfig` row. Sections:

- **Identity** — `nameZh`, `nameEn`, `address`, `phone`, hero photo upload (writes to `cloud://.../daycare/...`).
- **Hours** — `hoursOpen` / `hoursClose` time pickers (`HH:mm` strings).
- **Cancel policy** — `cancelPolicyZh` / `cancelPolicyEn` (display-only; v1 does not enforce a lead-time gate).
- **Waiver / 寄养协议** — `agreementZh` / `agreementEn` + auto-bumped `agreementVersion` on edit.
- **Subscribe-message reminders** (v0.13) — paste the two 25-character template IDs:
  - `reminderDropoffTmplId` — fires 24h before drop-off.
  - `reminderPickupTmplId` — fires on the morning of pick-up.

Submit calls `daycareUpsert()` — server re-verifies owner role.

## Files

| File | Purpose |
| --- | --- |
| `edit/edit.ts` | Form state, photo upload via `wx.chooseMedia` + `wx.cloud.uploadFile`, reminder-ID input wiring. |
| `edit/edit.wxml` | Sectioned form. |
| `edit/edit.wxss` | Form styling, photo preview frame. |
| `edit/edit.json` | Page title. |

## Data dependencies

- [`services/user.ts`](../../services/user.ts) — `isOwner()` guard on entry; server re-checks too.
- [`services/daycare.ts`](../../services/daycare.ts) — `daycareGet()` to load, `daycareUpsert()` to save.
- [`cloudfunctions/daycareUpsert/`](../../../cloudfunctions/daycareUpsert/) — owner-only; writes the singleton row.

## Behavior notes

- The daycare is a **singleton** for v1 (single-home model). There is no concept of multi-tenant marketplaces.
- Saving with a non-empty waiver bumps `agreementVersion` to `Date.now()` so future bookings carry the matching version; existing bookings are not retroactively updated.
- Reminder templates must be registered in 微信公众平台 → 订阅消息 first. Without them, `sendReminders` no-ops and the booking form skips the permission prompt. See the v0.13 setup notes in [`CLAUDE.md`](../../../CLAUDE.md).
- Photo uploads use 云开发 `cloud://` file IDs and render via `<image>` directly once `wx.cloud.init()` has run.
