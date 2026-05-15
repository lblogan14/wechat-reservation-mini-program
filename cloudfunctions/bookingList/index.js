const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function isOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  // Owners can request all bookings; parents only see their own.
  const wantAll = event && event.scope === 'all';
  const where = wantAll && (await isOwner(db, OPENID)) ? {} : { parentOpenid: OPENID };

  try {
    const res = await db.collection('bookings')
      .where(where)
      .orderBy('dropoffAt', 'desc')
      .limit(200)
      .get();
    return { ok: true, bookings: res.data };
  } catch (err) {
    return { ok: true, bookings: [] };
  }
};
