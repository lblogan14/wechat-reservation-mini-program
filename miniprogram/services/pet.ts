import { call } from './cloud';

export async function petList(): Promise<PetDaycare.Pet[]> {
  const res = await call<{ pets: PetDaycare.Pet[] }>('petList');
  if (!res.ok) {
    console.warn('[pet] list failed:', res.error);
    return [];
  }
  return res.data.pets;
}

export interface UpsertResult {
  ok: boolean;
  _id?: string;
  error?: string;
}

export async function petUpsert(pet: Partial<PetDaycare.Pet>): Promise<UpsertResult> {
  const res = await call<UpsertResult>('petUpsert', pet as Record<string, unknown>);
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}

export async function petDelete(_id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await call<{ ok: boolean; error?: string }>('petDelete', { _id });
  if (!res.ok) return { ok: false, error: res.error };
  return res.data;
}
