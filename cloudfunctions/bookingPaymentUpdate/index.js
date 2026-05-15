const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ALLOWED_PAYMENT = new Set(['pending', 'paid', 'refunded', 'waived']);

async function isOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  if (!event._id) return { ok: false, error: '_id required' };
  if (!event.paymentStatus || !ALLOWED_PAYMENT.has(event.paymentStatus)) {
    return { ok: false, error: 'paymentStatus invalid' };
  }
  if (!(await isOwner(db, OPENID))) {
    return { ok: false, error: 'owner role required' };
  }

  const exists = await db.collection('bookings').doc(event._id).get().catch(() => null);
  if (!exists || !exists.data) return { ok: false, error: 'booking not found' };

  const data = { paymentStatus: event.paymentStatus, updatedAt: Date.now() };
  if (typeof event.paymentNote === 'string') {
    data.paymentNote = event.paymentNote;
  }
  await db.collection('bookings').doc(event._id).update({ data });
  return { ok: true };
};
