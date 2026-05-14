import { call } from './cloud';

export interface CapacityDay {
  date: number; // UTC start-of-day timestamp
  base: number;
  deltaSum: number;
  absolute: number | null;
  capacityForDay: number;
  booked: number;
  remaining: number;
}

export interface CapacityRangeResult {
  ok: boolean;
  serviceId?: string;
  nameZh?: string;
  nameEn?: string;
  base?: number;
  days: CapacityDay[];
  error?: string;
}

export async function capacityRange(args: {
  serviceId: string;
  from: number;
  to: number;
}): Promise<CapacityRangeResult> {
  const res = await call<CapacityRangeResult>('capacityRange', args as Record<string, unknown>);
  if (!res.ok) {
    return { ok: false, days: [], error: res.error };
  }
  return res.data;
}
