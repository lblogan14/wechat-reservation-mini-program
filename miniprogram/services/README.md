# `miniprogram/services/`

Thin TypeScript wrappers around `wx.cloud.callFunction(...)`. Every cloud function under [`cloudfunctions/`](../../cloudfunctions/) has at least one wrapper here, so page code never reaches for `wx.cloud` directly.

## Files

| File | Surface | Backing cloud function(s) |
| --- | --- | --- |
| [`cloud.ts`](cloud.ts) | `call<T>(name, data?) → { ok, data } \| { ok, error }` | — (generic helper) |
| [`openid.ts`](openid.ts) | `getOpenid() / setOpenid() / clearOpenid()` | — (storage + `App.globalData` only) |
| [`auth.ts`](auth.ts) | `signIn()`, `signOut()` | `login` |
| [`user.ts`](user.ts) | `getCurrentUser()`, `setCurrentUser()`, `isOwner()`, `refreshCurrentUser()`, `promoteToOwner(code)` | `userGet`, `userPromote` |
| [`pet.ts`](pet.ts) | `petList()`, `petUpsert()`, `petDelete()` | `petList`, `petUpsert`, `petDelete` |
| [`daycare.ts`](daycare.ts) | `daycareGet()`, `daycareUpsert()` | `daycareGet`, `daycareUpsert` |
| [`service.ts`](service.ts) | `serviceList(includeInactive)`, `serviceUpsert()`, `serviceDelete()` | `serviceList`, `serviceUpsert`, `serviceDelete` |
| [`availability.ts`](availability.ts) | `availabilityList()`, `availabilityUpsert()`, `availabilityDelete()` | `availabilityList`, `availabilityUpsert`, `availabilityDelete` |
| [`capacity.ts`](capacity.ts) | `capacityRange({ serviceId, from, to })` | `capacityRange` (the **single source of truth** for the capacity formula) |
| [`booking.ts`](booking.ts) | `bookingCreate()`, `bookingList()`, `bookingCancel()`, `bookingStatusUpdate()`, `bookingPaymentUpdate()` | `bookingCreate`, `bookingList`, `bookingCancel`, `bookingStatusUpdate`, `bookingPaymentUpdate` |
| [`waitlist.ts`](waitlist.ts) | `waitlistCreate()`, `waitlistList()`, `waitlistCancel()`, `waitlistPromote()` | `waitlistCreate`, `waitlistList`, `waitlistCancel`, `waitlistPromote` |
| [`message.ts`](message.ts) | `messageThreadList()`, `messageList()`, `messageSend()`, `messageMarkRead()`, `messageThreadEnsure()`, `totalUnreadFor()` | `messageThreadList`, `messageList`, `messageSend`, `messageMarkRead`, `messageThreadEnsure` |
| [`addon.ts`](addon.ts) | `addonList(includeInactive)`, `addonUpsert()`, `addonDelete()` | `addonList`, `addonUpsert`, `addonDelete` |

`sendReminders` has **no client wrapper** — it's invoked only by the daily timer trigger declared in [`cloudfunctions/sendReminders/config.json`](../../cloudfunctions/sendReminders/config.json).

## The `call` helper

Every wrapper goes through [`cloud.ts`](cloud.ts):

```ts
export type CallResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function call<T = unknown>(name: string, data?: Record<string, unknown>): Promise<CallResult<T>>;
```

- Guards against `wx.cloud` being unavailable (happens when no AppID has been set yet — the simulator works but cloud calls error out).
- Captures rejections from `wx.cloud.callFunction` and converts them into `{ ok: false, error }`.
- Wrappers typically destructure the cloud function's `{ ok, ... }` reply and propagate the inner-ok shape upward, hiding the transport layer.

## Caching layers

- **openid + user** are cached in `App.globalData` AND `wx.storage` so the app survives a relaunch without an immediate cloud round-trip. Mutators (`setOpenid`, `setCurrentUser`) keep both in sync.
- **Role-gated pages** call `refreshCurrentUser()` on entry to defeat a stale `role` field. The server is the only trust boundary — pages never act on the cached role alone for write-protected actions.

## Server enrichment

Several list endpoints enrich rows server-side to save the client extra round-trips:

| Service | Enriched fields added |
| --- | --- |
| `bookingList()` → `EnrichedBooking` | `serviceNameZh`, `serviceNameEn`, `petNames` |
| `waitlistList()` → `EnrichedWaitlistEntry` | `serviceNameZh`, `serviceNameEn`, `petNames` |
| `messageThreadList()` → `EnrichedMessageThread` | `serviceNameZh`, `serviceNameEn`, `bookingDropoffAt`, `bookingPickupAt`, `parentNickname` |

Each enriched type is declared in the corresponding service file (not in `types/models.d.ts`) — they're transport-layer shapes, not persisted ones.

## Adding a new cloud function

1. Create `cloudfunctions/<name>/index.js` + `package.json` + `config.json`.
2. Add a wrapper to the appropriate `services/*.ts` file (or create a new one for an unrelated domain).
3. Cross-check that:
   - The wrapper's argument shape matches what the cloud function destructures from `event`.
   - The response shape matches the `call<T>(...)` generic parameter.
   - If the function is owner-only or otherwise role-gated, the wrapper does NOT short-circuit on the client — leave the authoritative check on the server.
4. Update [`CLAUDE.md`](../../CLAUDE.md)'s cloud-function inventory.
