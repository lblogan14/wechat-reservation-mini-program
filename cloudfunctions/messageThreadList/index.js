const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function isOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

async function enrich(db, threads) {
  if (!threads.length) return threads;
  const _ = db.command;
  const bookingIds = Array.from(new Set(threads.map((t) => t.bookingId).filter(Boolean)));
  const openids = Array.from(new Set(threads.map((t) => t.parentOpenid).filter(Boolean)));

  const [bRes, uRes] = await Promise.all([
    bookingIds.length
      ? db.collection('bookings').where({ _id: _.in(bookingIds) }).limit(200).get()
      : Promise.resolve({ data: [] }),
    openids.length
      ? db.collection('users').where({ openid: _.in(openids) }).limit(200).get()
      : Promise.resolve({ data: [] }),
  ]);

  // Fetch service names for the bookings we just loaded.
  const serviceIds = Array.from(new Set(bRes.data.map((b) => b.serviceId).filter(Boolean)));
  const sRes = serviceIds.length
    ? await db.collection('services').where({ _id: _.in(serviceIds) }).limit(200).get()
    : { data: [] };
  const sMap = new Map(sRes.data.map((s) => [s._id, s]));
  const bMap = new Map(bRes.data.map((b) => [b._id, b]));
  const uMap = new Map(uRes.data.map((u) => [u.openid, u]));

  return threads.map((t) => {
    const booking = t.bookingId ? bMap.get(t.bookingId) : null;
    const svc = booking ? sMap.get(booking.serviceId) : null;
    const parent = uMap.get(t.parentOpenid);
    return {
      ...t,
      serviceNameZh: svc ? svc.nameZh : '',
      serviceNameEn: svc ? svc.nameEn : '',
      bookingDropoffAt: booking ? booking.dropoffAt : undefined,
      bookingPickupAt: booking ? booking.pickupAt : undefined,
      parentNickname: parent ? parent.nickname || '' : '',
    };
  });
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  const wantAll = event && event.scope === 'all';
  const where = wantAll && (await isOwner(db, OPENID)) ? {} : { parentOpenid: OPENID };

  try {
    const res = await db.collection('messageThreads')
      .where(where)
      .orderBy('lastMessageAt', 'desc')
      .limit(100)
      .get();
    const enriched = await enrich(db, res.data);
    return { ok: true, threads: enriched };
  } catch (err) {
    return { ok: true, threads: [] };
  }
};
