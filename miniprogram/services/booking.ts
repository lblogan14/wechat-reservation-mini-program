import { call } from './cloud';

export interface BookingCreateArgs {
  serviceId: string;
  petIds: string[];
  dropoffAt: number;
  pickupAt: number;
  parentNotes?: string;
  agreementVersion: string;
  agreementAcceptedAt: number;
  recurrence?: PetDaycare.BookingRecurrence;
  addOns?: Array<{ addonId: string; quantity: number }>;
}

export interface BookingCreateResult {
  ok: boolean;
  _id?: string;
  instanceIds?: string[];
  occurrences?: number;
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

// Server enrichment adds serviceNameZh, serviceNameEn, petNames to each row.
export type EnrichedBooking = PetDaycare.Booking & {
  serviceNameZh?: string;
  serviceNameEn?: string;
  petNames?: string[];
};

export interface BookingListArgs {
  scope?: 'mine' | 'all';
}

export async function bookingList(args: BookingListArgs = {}): Promise<EnrichedBooking[]> {
  const res = await call<{ ok: boolean; bookings: EnrichedBooking[] }>('bookingList', args as Record<string, unknown>);
  if (!res.ok) return [];
  return res.data.bookings;
}

export interface BookingCancelArgs {
  _id: string;
  cancelSeries?: boolean;
}

export interface BookingCancelResult {
  ok: boolean;
  cancelledIds?: string[];
  count?: number;
  error?: string;
}

export async function bookingCancel(args: BookingCancelArgs): Promise<BookingCancelResult> {
  const res = await call<BookingCancelResult>('bookingCancel', args as unknown as Record<string, unknown>);
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

export type OwnerBookingTransition = 'checked_in' | 'checked_out' | 'no_show';

export async function bookingStatusUpdate(args: {
  _id: string;
  bookingStatus: OwnerBookingTransition;
}): Promise<{ ok: boolean; bookingStatus?: PetDaycare.BookingStatus; error?: string }> {
  const res = await call<{ ok: boolean; bookingStatus?: PetDaycare.BookingStatus; error?: string }>(
    'bookingStatusUpdate',
    args as unknown as Record<string, unknown>,
  );
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

export async function bookingPaymentUpdate(args: {
  _id: string;
  paymentStatus: PetDaycare.PaymentStatus;
  paymentNote?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await call<{ ok: boolean; error?: string }>('bookingPaymentUpdate', args as unknown as Record<string, unknown>);
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}
