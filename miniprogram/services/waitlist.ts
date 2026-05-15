import { call } from './cloud';

export type EnrichedWaitlistEntry = PetDaycare.WaitlistEntry & {
  serviceNameZh?: string;
  serviceNameEn?: string;
  petNames?: string[];
};

export interface WaitlistCreateArgs {
  serviceId: string;
  petIds: string[];
  dropoffAt: number;
  pickupAt: number;
  parentNotes?: string;
}

export interface WaitlistCreateResult {
  ok: boolean;
  _id?: string;
  error?: string;
}

export async function waitlistCreate(args: WaitlistCreateArgs): Promise<WaitlistCreateResult> {
  const res = await call<WaitlistCreateResult>('waitlistCreate', args as unknown as Record<string, unknown>);
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

export interface WaitlistListArgs {
  scope?: 'mine' | 'all';
}

export async function waitlistList(args: WaitlistListArgs = {}): Promise<EnrichedWaitlistEntry[]> {
  const res = await call<{ ok: boolean; entries: EnrichedWaitlistEntry[] }>('waitlistList', args as Record<string, unknown>);
  if (!res.ok) return [];
  return res.data.entries;
}

export async function waitlistCancel(_id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await call<{ ok: boolean; error?: string }>('waitlistCancel', { _id });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

export interface WaitlistPromoteResult {
  ok: boolean;
  bookingId?: string;
  error?: string;
  firstBlockedDate?: number;
  remaining?: number;
  requested?: number;
}

export async function waitlistPromote(_id: string): Promise<WaitlistPromoteResult> {
  const res = await call<WaitlistPromoteResult>('waitlistPromote', { _id });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}
