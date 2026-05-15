const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const CANCELLABLE_STATUSES = new Set(['confirmed']);

async function isOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();
  const _ = db.command;

  if (!event._id) return { ok: false, error: '_id required' };
  const cancelSeries = !!event.cancelSeries;

  const target = await db.collection('bookings').doc(event._id).get().catch(() => null);
  if (!target || !target.data) return { ok: false, error: 'booking not found' };

  const owner = await isOwner(db, OPENID);
  if (target.data.parentOpenid !== OPENID && !owner) {
    return { ok: false, error: 'not your booking' };
  }

  if (!CANCELLABLE_STATUSES.has(target.data.bookingStatus)) {
    return { ok: false, error: `cannot cancel from status ${target.data.bookingStatus}` };
  }

  // If cancel-series and target has siblings (or IS the template), update the whole series.
  const seriesRoot = target.data.parentBookingId || target.data._id;
  let cancelledIds = [];

  if (cancelSeries) {
    // Cancel template + all instances that are still confirmed.
    const allBookings = await db.collection('bookings')
      .where(_.or([{ _id: seriesRoot }, { parentBookingId: seriesRoot }]))
      .limit(200)
      .get();
    const now = Date.now();
    for (const b of allBookings.data) {
      if (!CANCELLABLE_STATUSES.has(b.bookingStatus)) continue;
      if (b.parentOpenid !== OPENID && !owner) continue;
      await db.collection('bookings').doc(b._id).update({
        data: { bookingStatus: 'cancelled', updatedAt: now },
      });
      cancelledIds.push(b._id);
    }
  } else {
    await db.collection('bookings').doc(event._id).update({
      data: { bookingStatus: 'cancelled', updatedAt: Date.now() },
    });
    cancelledIds.push(event._id);
  }

  return { ok: true, cancelledIds, count: cancelledIds.length };
};
