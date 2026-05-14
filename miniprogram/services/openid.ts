const OPENID_KEY = 'openid';

type AppLike = { globalData: { openid: string } };

function app(): AppLike | null {
  const a = getApp<AppLike>() as AppLike | undefined;
  return a ?? null;
}

export function getOpenid(): string {
  const fromApp = app()?.globalData.openid;
  if (fromApp) return fromApp;
  return (wx.getStorageSync(OPENID_KEY) as string) || '';
}

export function setOpenid(openid: string): void {
  const a = app();
  if (a) {
    a.globalData.openid = openid;
  }
  if (openid) {
    wx.setStorageSync(OPENID_KEY, openid);
  } else {
    wx.removeStorageSync(OPENID_KEY);
  }
}

export function clearOpenid(): void {
  setOpenid('');
}
