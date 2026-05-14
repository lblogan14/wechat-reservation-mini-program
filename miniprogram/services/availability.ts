import { call } from './cloud';

export interface AvailabilityListArgs {
  from?: number;
  to?: number;
  serviceId?: string;
}

export async function availabilityList(args: AvailabilityListArgs = {}): Promise<PetDaycare.AvailabilityOverride[]> {
  const res = await call<{ overrides: PetDaycare.AvailabilityOverride[] }>('availabilityList', args as Record<string, unknown>);
  if (!res.ok) {
    console.warn('[availability] list failed:', res.error);
    return [];
  }
  return res.data.overrides;
}

export interface AvailabilityUpsertResult {
  ok: boolean;
  _id?: string;
  error?: string;
}

export async function availabilityUpsert(
  override: Partial<PetDaycare.AvailabilityOverride>,
): Promise<AvailabilityUpsertResult> {
  const res = await call<AvailabilityUpsertResult>('availabilityUpsert', override as Record<string, unknown>);
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

export async function availabilityDelete(_id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await call<{ ok: boolean; error?: string }>('availabilityDelete', { _id });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}
