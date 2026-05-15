import { call } from './cloud';

export type EnrichedMessageThread = PetDaycare.MessageThread & {
  serviceNameZh?: string;
  serviceNameEn?: string;
  bookingDropoffAt?: number;
  bookingPickupAt?: number;
  parentNickname?: string;
};

export interface MessageThreadListArgs {
  scope?: 'mine' | 'all';
}

export async function messageThreadList(args: MessageThreadListArgs = {}): Promise<EnrichedMessageThread[]> {
  const res = await call<{ ok: boolean; threads: EnrichedMessageThread[] }>(
    'messageThreadList',
    args as Record<string, unknown>,
  );
  if (!res.ok) return [];
  return res.data.threads;
}

export interface MessageListResult {
  ok: boolean;
  thread?: PetDaycare.MessageThread;
  messages?: PetDaycare.Message[];
  error?: string;
}

export async function messageList(threadId: string): Promise<MessageListResult> {
  const res = await call<MessageListResult>('messageList', { threadId });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

export interface MessageSendArgs {
  threadId?: string;
  bookingId?: string;
  body: string;
  attachmentFileID?: string;
}

export interface MessageSendResult {
  ok: boolean;
  threadId?: string;
  messageId?: string;
  error?: string;
}

export async function messageSend(args: MessageSendArgs): Promise<MessageSendResult> {
  const res = await call<MessageSendResult>('messageSend', args as unknown as Record<string, unknown>);
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

export async function messageMarkRead(threadId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await call<{ ok: boolean; error?: string }>('messageMarkRead', { threadId });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

export async function messageThreadEnsure(bookingId: string): Promise<{ ok: boolean; threadId?: string; error?: string }> {
  const res = await call<{ ok: boolean; threadId?: string; error?: string }>('messageThreadEnsure', { bookingId });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

// Total unread for the current user across all their threads.
// `myOpenid` is the caller's openid; we look at unreadForParent if this is the parent of the
// thread, otherwise unreadForOwner (owner sees an aggregate over every parent's thread).
export function totalUnreadFor(threads: EnrichedMessageThread[], myOpenid: string, asOwner: boolean): number {
  let n = 0;
  for (const t of threads) {
    if (asOwner) {
      n += t.unreadForOwner || 0;
    } else if (t.parentOpenid === myOpenid) {
      n += t.unreadForParent || 0;
    }
  }
  return n;
}
