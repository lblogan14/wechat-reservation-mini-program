const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function assertOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  if (!(await assertOwner(db, OPENID))) {
    return { ok: false, error: 'owner role required' };
  }

  if (!event._id) {
    return { ok: false, error: '_id required' };
  }

  // Block hard delete if any bookings already reference this service.
  // (`bookings` collection may not exist yet — guard the error.)
  try {
    const bookingHit = await db.collection('bookings').where({ serviceId: event._id }).limit(1).get();
    if (bookingHit.data.length) {
      return { ok: false, error: 'service has bookings — mark inactive instead' };
    }
  } catch (err) {
    // collection missing — fine in v0.3, bookings haven't been built yet.
  }

  await db.collection('services').doc(event._id).remove();
  return { ok: true };
};
