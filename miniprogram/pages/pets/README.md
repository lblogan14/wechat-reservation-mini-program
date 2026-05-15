# `pages/pets/`

The **pet profile management** subpages. Two pages: list + edit.

## Sub-pages

| Path | Title | Audience |
| --- | --- | --- |
| `list/` | 我的宠物 / My pets | Parent (tab 2 in `app.json`) |
| `edit/` | 新建 / 编辑宠物档案 | Parent (signed-in) |

`list/list` is the second tab bar entry. `edit/edit` is a subpage navigated to with `?id=<petId>` (omit `id` for a new pet).

## What it does

- **list/** — fetches `petList()`, renders a `<pet-card>` per pet, FAB (+) navigates to `edit/edit`. Empty state shown when the parent has no pets yet. Auth-required prompt redirects to profile tab when `getOpenid()` is empty.
- **edit/** — form for name, species (dog/cat/other), breed, sex, neutered, birth date, weight, photo, vaccine cert + expiry, feeding schedule, behavior notes, medical conditions, emergency contact. Submit calls `petUpsert()`. Delete button (edit mode only) calls `petDelete()` after confirmation.

## Files

| File | Purpose |
| --- | --- |
| `list/list.ts`, `list/list.wxml`, `list/list.wxss`, `list/list.json` | List page + auth gate. Refreshes on `onShow`. |
| `edit/edit.ts`, `edit/edit.wxml`, `edit/edit.wxss`, `edit/edit.json` | Edit form. Photo/vaccine uploads go to `cloud://.../pets/<openid>/<field>-<ts>.jpg`. |

The list page declares `<pet-card>` in `list.json` and the component lives at [`components/pet-card/`](../../components/pet-card/index.ts).

## Data dependencies

- [`services/pet.ts`](../../services/pet.ts) — `petList()`, `petUpsert()`, `petDelete()`.
- [`services/openid.ts`](../../services/openid.ts) — `getOpenid()` for the auth gate.
- [`cloudfunctions/petList/`](../../../cloudfunctions/petList/), [`cloudfunctions/petUpsert/`](../../../cloudfunctions/petUpsert/), [`cloudfunctions/petDelete/`](../../../cloudfunctions/petDelete/) — all enforce `ownerOpenid === OPENID` on writes.

## Behavior notes

- **Ownership is the trust boundary** — the cloud functions reject `petUpsert` / `petDelete` for pets whose `ownerOpenid` differs from the caller. Client checks are advisory only.
- **Vaccine gating in v1 is warning-only.** A yellow chip on the pet card appears when `vaccineCertFileID` is missing or `vaccineExpiry < now`. Bookings are NOT blocked — the daycare owner verifies the paper cert at drop-off. To make this a hard gate later, add the check in `cloudfunctions/bookingCreate/`.
- Uploads use `wx.cloud.uploadFile` against the 云开发 default bucket. The resulting `cloud://...` file ID is stored in the pet record.
