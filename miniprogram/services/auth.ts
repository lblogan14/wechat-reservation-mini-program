import { call } from './cloud';
import { setOpenid, clearOpenid } from './openid';

export interface LoginResult {
  openid: string;
  user: PetDaycare.User;
  isNewUser: boolean;
}

export async function signIn(): Promise<LoginResult | null> {
  const res = await call<LoginResult>('login');
  if (!res.ok) {
    console.warn('[auth] signIn failed:', res.error);
    return null;
  }
  setOpenid(res.data.openid);
  return res.data;
}

export function signOut(): void {
  clearOpenid();
}
