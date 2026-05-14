const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  const expected = process.env.BOOTSTRAP_OWNER_CODE;
  if (!expected) {
    return { ok: false, error: 'BOOTSTRAP_OWNER_CODE env var not set on the cloud function' };
  }
  if (!event.code || event.code !== expected) {
    return { ok: false, error: 'invalid promotion code' };
  }

  const users = db.collection('users');
  const found = await users.where({ openid: OPENID }).limit(1).get();
  if (!found.data.length) {
    return { ok: false, error: 'user not found — sign in first' };
  }

  const u = found.data[0];
  if (u.role === 'owner') {
    return { ok: true, user: u };
  }

  await users.doc(u._id).update({ data: { role: 'owner' } });
  return { ok: true, user: { ...u, role: 'owner' } };
};
