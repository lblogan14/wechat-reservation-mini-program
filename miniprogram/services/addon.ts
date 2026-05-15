import { call } from './cloud';

export async function addonList(includeInactive = false): Promise<PetDaycare.AddOn[]> {
  const res = await call<{ ok: boolean; addons: PetDaycare.AddOn[] }>('addonList', { includeInactive });
  if (!res.ok) return [];
  return res.data.addons;
}

export interface AddonUpsertResult {
  ok: boolean;
  _id?: string;
  error?: string;
}

export async function addonUpsert(addon: Partial<PetDaycare.AddOn>): Promise<AddonUpsertResult> {
  const res = await call<AddonUpsertResult>('addonUpsert', addon as Record<string, unknown>);
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

export async function addonDelete(_id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await call<{ ok: boolean; error?: string }>('addonDelete', { _id });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}
