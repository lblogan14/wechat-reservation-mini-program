export type CallResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function call<T = unknown>(
  name: string,
  data?: Record<string, unknown>,
): Promise<CallResult<T>> {
  if (!wx.cloud) {
    return {
      ok: false,
      error: 'wx.cloud unavailable — register an AppID and configure a 云开发 env.',
    };
  }
  try {
    const res = await wx.cloud.callFunction({ name, data });
    return { ok: true, data: res.result as T };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? String(err) };
  }
}
