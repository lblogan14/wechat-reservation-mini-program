import { call } from './cloud';

const USER_KEY = 'user';

type AppLike = { globalData: { user?: PetDaycare.User | null } };

function app(): AppLike | null {
  const a = getApp<AppLike>() as AppLike | undefined;
  return a ?? null;
}

export function getCurrentUser(): PetDaycare.User | null {
  const fromApp = app()?.globalData.user;
  if (fromApp) return fromApp;
  const stored = wx.getStorageSync(USER_KEY) as PetDaycare.User | '';
  if (!stored) return null;
  const a = app();
  if (a) a.globalData.user = stored;
  return stored;
}

export function setCurrentUser(user: PetDaycare.User | null): void {
  const a = app();
  if (a) a.globalData.user = user;
  if (user) {
    wx.setStorageSync(USER_KEY, user);
  } else {
    wx.removeStorageSync(USER_KEY);
  }
}

export function isOwner(): boolean {
  return getCurrentUser()?.role === 'owner';
}

export async function refreshCurrentUser(): Promise<PetDaycare.User | null> {
  const res = await call<{ user: PetDaycare.User | null }>('userGet');
  if (!res.ok || !res.data.user) {
    return getCurrentUser();
  }
  setCurrentUser(res.data.user);
  return res.data.user;
}

export async function promoteToOwner(code: string): Promise<{ ok: boolean; error?: string }> {
  const res = await call<{ ok: boolean; user?: PetDaycare.User; error?: string }>('userPromote', { code });
  if (!res.ok) return { ok: false, error: res.error };
  if (res.data.ok && res.data.user) {
    setCurrentUser(res.data.user);
  }
  return { ok: res.data.ok, error: res.data.error };
}
