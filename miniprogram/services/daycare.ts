import { call } from './cloud';

export async function daycareGet(): Promise<PetDaycare.DaycareConfig | null> {
  const res = await call<{ config: PetDaycare.DaycareConfig | null }>('daycareGet');
  if (!res.ok) {
    console.warn('[daycare] get failed:', res.error);
    return null;
  }
  return res.data.config;
}

export interface UpsertResult {
  ok: boolean;
  _id?: string;
  error?: string;
}

export async function daycareUpsert(
  config: Partial<PetDaycare.DaycareConfig>,
): Promise<UpsertResult> {
  const res = await call<UpsertResult>('daycareUpsert', config as Record<string, unknown>);
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}
