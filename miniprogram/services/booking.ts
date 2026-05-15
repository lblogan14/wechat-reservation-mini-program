import { call } from './cloud';

export interface BookingCreateArgs {
  serviceId: string;
  petIds: string[];
  dropoffAt: number;
  pickupAt: number;
  parentNotes?: string;
  agreementVersion: string;
  agreementAcceptedAt: number;
}

export interface BookingCreateResult {
  ok: boolean;
  _id?: string;
  nights?: number;
  totalPrice?: number;
  error?: string;
  firstBlockedDate?: number;
  remaining?: number;
  requested?: number;
}

export async function bookingCreate(args: BookingCreateArgs): Promise<BookingCreateResult> {
  const res = await call<BookingCreateResult>('bookingCreate', args as unknown as Record<string, unknown>);
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

export interface BookingListArgs {
  scope?: 'mine' | 'all';
}

export async function bookingList(args: BookingListArgs = {}): Promise<PetDaycare.Booking[]> {
  const res = await call<{ ok: boolean; bookings: PetDaycare.Booking[] }>('bookingList', args as Record<string, unknown>);
  if (!res.ok) return [];
  return res.data.bookings;
}
