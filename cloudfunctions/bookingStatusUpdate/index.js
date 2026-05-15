const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// Owner-driven transitions. Parent cancellation goes through bookingCancel instead.
const ALLOWED_TRANSITIONS = {
  confirmed: new Set(['checked_in', 'no_show']),
  checked_in: new Set(['checked_out']),
};

async function isOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  if (!event._id) return { ok: false, error: '_id required' };
  if (!event.bookingStatus) return { ok: false, error: 'bookingStatus required' };
  if (!(await isOwner(db, OPENID))) {
    return { ok: false, error: 'owner role required' };
  }

  const target = await db.collection('bookings').doc(event._id).get().catch(() => null);
  if (!target || !target.data) return { ok: false, error: 'booking not found' };

  const current = target.data.bookingStatus;
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed || !allowed.has(event.bookingStatus)) {
    return { ok: false, error: `cannot transition ${current} → ${event.bookingStatus}` };
  }

  await db.collection('bookings').doc(event._id).update({
    data: { bookingStatus: event.bookingStatus, updatedAt: Date.now() },
  });
  return { ok: true, bookingStatus: event.bookingStatus };
};
