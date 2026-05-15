const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function isOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  if (!event._id) return { ok: false, error: '_id required' };
  if (!(await isOwner(db, OPENID))) {
    return { ok: false, error: 'owner role required' };
  }

  // Safe to hard-delete: bookings embed a frozen BookingAddOn copy at booking time,
  // so removing a catalog row does not break historical bookings.
  await db.collection('addons').doc(event._id).remove();
  return { ok: true };
};
