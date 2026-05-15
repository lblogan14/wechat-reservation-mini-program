# `cloudfunctions/`

The WeChat Cloud Development (云开发) backend. Each subfolder is one cloud function with the standard shape:

```
<function-name>/
├── index.js          # exports.main = async (event) => { ... }
├── package.json      # at minimum, depends on wx-server-sdk
└── config.json       # function-level config (permissions, triggers)
```

Every function runs in the Node.js runtime provided by 云开发. The 云开发 IDE handles `npm install` server-side on deploy ("上传并部署：云端安装依赖（不上传 node_modules）"). The matching frontend wrappers live in [`../miniprogram/services/`](../miniprogram/services/).

## Function inventory (33 functions)

Grouped by domain. Each function returns `{ ok: boolean, ... }` unless noted; non-`ok` paths carry `{ error: string }` and the wrapper layer propagates it.

### Auth / users

| Function | Purpose | Auth |
| --- | --- | --- |
| [`login/`](login/) | Resolve `OPENID` via `cloud.getWXContext()` and upsert a `users` row (`role: 'parent'` for new users). | Any caller |
| [`userGet/`](userGet/) | Return the current user record (so the client can role-gate). | Any caller |
| [`userPromote/`](userPromote/) | Bootstrap an owner account. Gated by the `BOOTSTRAP_OWNER_CODE` env var (set on the function in the 云开发 console). | Any caller, code-gated |

### Pets

| Function | Purpose | Auth |
| --- | --- | --- |
| [`petList/`](petList/) | List pets where `ownerOpenid === OPENID`. | Caller-scoped |
| [`petUpsert/`](petUpsert/) | Create or update a pet. Rejects updates where `existing.ownerOpenid !== OPENID`. | Caller-scoped |
| [`petDelete/`](petDelete/) | Delete a pet (ownership-checked). | Caller-scoped |

### Daycare config

| Function | Purpose | Auth |
| --- | --- | --- |
| [`daycareGet/`](daycareGet/) | Return the singleton `daycareConfig` row (or `null`). | Any caller |
| [`daycareUpsert/`](daycareUpsert/) | Upsert the singleton. | Owner only |

### Services

| Function | Purpose | Auth |
| --- | --- | --- |
| [`serviceList/`](serviceList/) | List services. Defaults to `active: true`; `includeInactive: true` returns all. | Any caller |
| [`serviceUpsert/`](serviceUpsert/) | Create or update a service tier. | Owner only |
| [`serviceDelete/`](serviceDelete/) | Hard-delete. Refuses if any booking references the service. | Owner only |

### Availability

| Function | Purpose | Auth |
| --- | --- | --- |
| [`availabilityList/`](availabilityList/) | List `availabilityOverrides`, optional `from`/`to`/`serviceId` filter. | Any caller |
| [`availabilityUpsert/`](availabilityUpsert/) | Upsert override on `(date, serviceId)`. Normalises `date` to UTC start-of-day. | Owner only |
| [`availabilityDelete/`](availabilityDelete/) | Delete override. | Owner only |
| [`capacityRange/`](capacityRange/) | **Single source of truth** for the capacity formula. Joins services + overrides + bookings; returns per-day `{ base, deltaSum, absolute, capacityForDay, booked, remaining }` for a date window. | Any caller |

### Bookings

| Function | Purpose | Auth |
| --- | --- | --- |
| [`bookingCreate/`](bookingCreate/) | Validate pets ownership + capacity (across the recurrence series, capped at `MAX_OCCURRENCES = 60`), insert booking row(s) with `status: 'confirmed'`. Resolves add-on snapshots from the catalog. | Caller-scoped |
| [`bookingList/`](bookingList/) | List caller's bookings. `scope: 'all'` is owner-only. Server-enriched with `serviceName{Zh,En}` and `petNames`. | Caller / owner |
| [`bookingCancel/`](bookingCancel/) | Cancel a single confirmed booking or, with `cancelSeries: true`, walk the recurrence series and cancel all confirmed members. | Caller (own) / owner (any) |
| [`bookingStatusUpdate/`](bookingStatusUpdate/) | Owner-only status transitions. Allowed: `confirmed → checked_in / no_show`, `checked_in → checked_out`. Anything else errors `cannot transition X → Y`. | Owner only |
| [`bookingPaymentUpdate/`](bookingPaymentUpdate/) | Owner-only: set `paymentStatus` + `paymentNote` (manual since no WeChat Pay). | Owner only |

### Waitlist

| Function | Purpose | Auth |
| --- | --- | --- |
| [`waitlistCreate/`](waitlistCreate/) | Insert a waitlist entry for the caller. | Caller-scoped |
| [`waitlistList/`](waitlistList/) | List caller's entries. `scope: 'all'` is owner-only. Server-enriched like `bookingList`. | Caller / owner |
| [`waitlistCancel/`](waitlistCancel/) | Cancel an entry. Parent can cancel own; owner can cancel any. | Caller (own) / owner (any) |
| [`waitlistPromote/`](waitlistPromote/) | Owner-only. Re-check capacity, insert booking with `agreementVersion: 'promoted-from-waitlist'`, mark entry `fulfilled`. | Owner only |

### Messaging

| Function | Purpose | Auth |
| --- | --- | --- |
| [`messageThreadList/`](messageThreadList/) | List threads. Owner sees all (`scope: 'all'`); parent sees own. Server-enriched with service name + booking window + parent nickname. | Caller / owner |
| [`messageList/`](messageList/) | List all messages in a thread (limit 500). | Thread participant |
| [`messageSend/`](messageSend/) | Send a message. Accepts `threadId` (existing thread) or `bookingId` (auto-creates a thread). Increments unread for the opposite side. | Thread participant / owner |
| [`messageMarkRead/`](messageMarkRead/) | Mark all unread messages in a thread read for the caller's role. | Thread participant |
| [`messageThreadEnsure/`](messageThreadEnsure/) | Find-or-create the thread for a booking (open the chat without sending a first message). | Thread participant / owner |

### Add-ons

| Function | Purpose | Auth |
| --- | --- | --- |
| [`addonList/`](addonList/) | List addons. `active: true` by default; `includeInactive: true` for owner views. | Any caller |
| [`addonUpsert/`](addonUpsert/) | Create or update a catalog row. | Owner only |
| [`addonDelete/`](addonDelete/) | Hard-delete. Safe — `bookingCreate` froze a snapshot onto every historical booking. | Owner only |

### Reminders

| Function | Purpose | Trigger |
| --- | --- | --- |
| [`sendReminders/`](sendReminders/) | Daily cron: fire 24h drop-off + day-of pick-up subscribe-message reminders. Idempotent via `Booking.reminderSentDropoff` / `reminderSentPickup` flags. Skips if neither template ID is configured on `daycareConfig`. | Timer: `0 0 1 * * * *` = 01:00 UTC (= 09:00 CST) daily. Permissions: `subscribeMessage.send`. |

## Conventions

### Identity & role

```js
const { OPENID } = cloud.getWXContext();
```

is the **only** trustworthy identifier server-side. Don't trust anything caller-supplied as identity. Owner-gated functions then read `users` to verify `role === 'owner'`:

```js
async function isOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}
```

### Date math

UTC start-of-day. Most date-keyed code normalises with:

```js
function normalizeDate(ts) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
```

Half-open day accounting for stays: drop off Wed → pick up Thu consumes Wed only (1 night).

### Response shape

`{ ok: true, ...payload }` or `{ ok: false, error: 'message' }`. The frontend's `services/cloud.ts` `call<T>()` helper wraps `{ ok: false, error }` for transport failures; functions own the application-level `{ ok }` flag.

### Race conditions

`bookingCreate` (and `waitlistPromote`) read bookings, check capacity, then insert — no transaction. The losing caller in a race for the last slot gets `ok: false, error: 'insufficient capacity'`. Revisit if volume warrants atomicity. See [`CLAUDE.md`](../CLAUDE.md) → "v0.6 decisions doc".

### Server enrichment

Several list endpoints (`bookingList`, `waitlistList`, `messageThreadList`) join with `services` / `pets` / `users` server-side and attach denormalised display fields (`serviceNameZh/En`, `petNames`, `parentNickname`). This costs an extra DB read per call but saves the client a round-trip. Fine at single-home volumes.

## Deploying

Each function deploys independently from the 微信开发者工具 IDE:

1. Right-click the function folder → *上传并部署：云端安装依赖（不上传 node_modules）*.
2. The IDE handles `npm install` server-side. Local `node_modules/` is not uploaded.
3. For functions with env vars (`userPromote` → `BOOTSTRAP_OWNER_CODE`), set them in 云开发 → 云函数 → 配置 → 环境变量.
4. For `sendReminders`, the daily timer trigger is declared in [`sendReminders/config.json`](sendReminders/config.json) — no extra setup beyond deploying. The subscribe-message template IDs must be set on `daycareConfig` from the daycare edit page before reminders actually fire.

See [`CLAUDE.md`](../CLAUDE.md) → "Getting started" for end-to-end setup (AppID, 云开发 env, collections, deploys).

## Adding a new cloud function

1. Create `cloudfunctions/<name>/index.js`, `package.json` (depend on `"wx-server-sdk"`), `config.json` (`{ "permissions": { "openapi": [] } }` at minimum).
2. Implement `exports.main = async (event) => { ... }`. Pull identity via `cloud.getWXContext().OPENID`.
3. Add a wrapper to [`../miniprogram/services/<domain>.ts`](../miniprogram/services/).
4. Update [`CLAUDE.md`](../CLAUDE.md)'s function inventory.
5. Deploy via the IDE — the function won't be callable until then.
