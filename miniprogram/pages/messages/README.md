# `pages/messages/`

The **2-way messaging** subpages. Two pages: thread list + thread view.

## Sub-pages

| Path | Title | Audience |
| --- | --- | --- |
| `list/` | 消息 / Messages | Parent (own threads only) + Owner (all threads) |
| `thread/` | (per-thread) | Parent + Owner |

Reached from the profile tab's owner-tools section (owner) or via the booking detail page's *Open chat* button (parent). One thread per booking.

## What it does

- **list/** — fetches `messageThreadList()`. Owner gets `scope: 'all'`; parent sees their own threads. Each card: parent nickname (owner view) or service name (parent view), last message preview, unread counter pill, timestamp. Tap → `/pages/messages/thread/thread?id=<threadId>`.
- **thread/** — fetches `messageList(threadId)` on `onShow` and polls every **10 seconds** while visible. Renders the conversation with right-aligned bubbles for messages the caller sent. Composer at the bottom (text-only in v0.11; image attachment rendering is supported but the composer doesn't upload yet). `messageMarkRead(threadId)` is called on open and on every poll that detected new messages.

## Files

| File | Purpose |
| --- | --- |
| `list/list.{ts,wxml,wxss,json}` | Thread cards + unread pill. |
| `thread/thread.{ts,wxml,wxss,json}` | Chat view + composer + 10s polling. Cleans up `setInterval` on `onHide` / `onUnload`. |

## Data dependencies

- [`services/message.ts`](../../services/message.ts) — `messageThreadList()`, `messageList()`, `messageSend()`, `messageMarkRead()`, `messageThreadEnsure()`, `totalUnreadFor()`.
- [`services/user.ts`](../../services/user.ts) — role-aware payload (owner vs parent).
- [`cloudfunctions/messageThreadList/`](../../../cloudfunctions/messageThreadList/), [`messageList/`](../../../cloudfunctions/messageList/), [`messageSend/`](../../../cloudfunctions/messageSend/), [`messageMarkRead/`](../../../cloudfunctions/messageMarkRead/), [`messageThreadEnsure/`](../../../cloudfunctions/messageThreadEnsure/).

## Behavior notes (v0.11)

See [`CLAUDE.md`](../../../CLAUDE.md) for the full decisions. Highlights:

- **One thread per booking** — auto-created on first send by `messageSend` (no pre-booking inquiry threads in v1).
- **Polling, not push** — `setInterval(fetch, 10_000)` while the thread page is open; cleared on `onHide` / `onUnload`. Upgrade to 云开发 实时数据推送 when conversations get long.
- **Read receipts** — per-message `readByParentAt` / `readByOwnerAt` plus thread-level `unreadForParent` / `unreadForOwner` counters.
- **Owner sees all threads, parents see own** — enforced server-side in `messageThreadList` (`scope: 'all'` is owner-only).
- **Tab bar unread badge** on the profile tab refreshes only on profile `onShow` — see the profile page README.
- **Attachments** — schema supports `attachmentFileID` and the thread view renders an `<image>` if a message has one. Image upload from the composer is ~30 lines of work whenever wanted.
