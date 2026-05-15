const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function isStaffOrOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  if (!res.data.length) return false;
  const role = res.data[0].role;
  return role === 'owner' || role === 'staff';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  if (!event.bookingId) return { ok: false, error: 'bookingId required' };

  const bRes = await db.collection('bookings').doc(event.bookingId).get().catch(() => null);
  if (!bRes || !bRes.data) return { ok: false, error: 'booking not found' };
  const booking = bRes.data;
  if (booking.parentOpenid !== OPENID && !(await isStaffOrOwner(db, OPENID))) {
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

  // Reconcile against concurrent inserts: if two callers raced past the existence check
  // above, both will have inserted a row. Keep the lowest-id row, remove the others.
  const all = await db.collection('messageThreads').where({ bookingId: event.bookingId }).get();
  if (all.data.length > 1) {
    const sorted = all.data.slice().sort((a, b) => (a._id < b._id ? -1 : 1));
    const keep = sorted[0];
    for (const dup of sorted.slice(1)) {
      await db.collection('messageThreads').doc(dup._id).remove().catch(() => null);
    }
    return { ok: true, threadId: keep._id };
  }
  return { ok: true, threadId: ins._id };
};
