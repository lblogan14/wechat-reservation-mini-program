import { call } from './cloud';

export async function serviceList(includeInactive = false): Promise<PetDaycare.Service[]> {
  const res = await call<{ services: PetDaycare.Service[] }>('serviceList', { includeInactive });
  if (!res.ok) {
    console.warn('[service] list failed:', res.error);
    return [];
  }
  return res.data.services;
}

export interface ServiceUpsertResult {
  ok: boolean;
  _id?: string;
  error?: string;
}

export async function serviceUpsert(
  service: Partial<PetDaycare.Service>,
): Promise<ServiceUpsertResult> {
  const res = await call<ServiceUpsertResult>('serviceUpsert', service as Record<string, unknown>);
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

export async function serviceDelete(_id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await call<{ ok: boolean; error?: string }>('serviceDelete', { _id });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}
