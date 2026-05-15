const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function isOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  if (!event.bookingId) return { ok: false, error: 'bookingId required' };

  const bRes = await db.collection('bookings').doc(event.bookingId).get().catch(() => null);
  if (!bRes || !bRes.data) return { ok: false, error: 'booking not found' };
  const booking = bRes.data;
  if (booking.parentOpenid !== OPENID && !(await isOwner(db, OPENID))) {
    return { ok: false, error: 'not your booking' };
  }

  const existing = await db.collection('messageThreads').where({ bookingId: event.bookingId }).limit(1).get();
  if (existing.data.length) {
    return { ok: true, threadId: existing.data[0]._id };
  }

  const now = Date.now();
  const ins = await db.collection('messageThreads').add({
    data: {
      bookingId: event.bookingId,
      parentOpenid: booking.parentOpenid,
      lastMessageAt: now,
      lastMessagePreview: '',
      unreadForParent: 0,
      unreadForOwner: 0,
      createdAt: now,
    },
  });
  return { ok: true, threadId: ins._id };
};
