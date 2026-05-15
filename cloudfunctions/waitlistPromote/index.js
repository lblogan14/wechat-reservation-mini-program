const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_BOOKING_STATUSES = new Set(['confirmed', 'checked_in', 'checked_out']);

function normalizeDate(ts) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

async function isOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();
  const _ = db.command;

  if (!event._id) return { ok: false, error: '_id required' };
  if (!(await isOwner(db, OPENID))) {
    return { ok: false, error: 'owner role required' };
  }

  const entryRes = await db.collection('waitlistEntries').doc(event._id).get().catch(() => null);
  if (!entryRes || !entryRes.data) return { ok: false, error: 'entry not found' };
  const entry = entryRes.data;
  if (entry.status !== 'waiting' && entry.status !== 'offered') {
    return { ok: false, error: `cannot promote from status ${entry.status}` };
  }

  const serviceRes = await db.collection('services').doc(entry.serviceId).get().catch(() => null);
  if (!serviceRes || !serviceRes.data || serviceRes.data.active === false) {
    return { ok: false, error: 'service unavailable' };
  }
  const service = serviceRes.data;
  const base = service.capacityPerDay || 0;
  const slots = (entry.petIds || []).length;
  if (!slots) return { ok: false, error: 'entry has no pets' };

  const rangeFrom = normalizeDate(entry.dropoffAt);
  const rangeTo = normalizeDate(entry.pickupAt) - DAY_MS;
  if (rangeTo < rangeFrom) return { ok: false, error: 'entry pickup before dropoff day' };

  const overridesRes = await db.collection('availabilityOverrides')
    .where({ serviceId: entry.serviceId, date: _.gte(rangeFrom).and(_.lte(rangeTo)) })
    .limit(500)
    .get();
  const overrideMap = new Map();
  for (const o of overridesRes.data) {
    const k = normalizeDate(o.date);
    const item = overrideMap.get(k) || { absolute: null, delta: 0 };
    if (typeof o.capacityAbsolute === 'number') item.absolute = o.capacityAbsolute;
    else if (typeof o.capacityDelta === 'number') item.delta += o.capacityDelta;
    overrideMap.set(k, item);
  }

  let bookingsRes;
  try {
    bookingsRes = await db.collection('bookings')
      .where({ serviceId: entry.serviceId })
      .limit(1000)
      .get();
  } catch (err) {
    bookingsRes = { data: [] };
  }
  const bookedMap = new Map();
  for (const b of bookingsRes.data) {
    if (!ACTIVE_BOOKING_STATUSES.has(b.bookingStatus)) continue;
    const bStart = normalizeDate(b.dropoffAt);
    const bEnd = normalizeDate(b.pickupAt);
    if (bEnd <= rangeFrom || bStart > rangeTo) continue;
    const n = Array.isArray(b.petIds) ? b.petIds.length : 1;
    const from = Math.max(bStart, rangeFrom);
    const to = Math.min(bEnd - DAY_MS, rangeTo);
    for (let d = from; d <= to; d += DAY_MS) {
      bookedMap.set(d, (bookedMap.get(d) || 0) + n);
    }
  }

  for (let d = rangeFrom; d <= rangeTo; d += DAY_MS) {
    const ov = overrideMap.get(d) || { absolute: null, delta: 0 };
    const dayCap = ov.absolute !== null ? ov.absolute : base + ov.delta;
    const remaining = dayCap - (bookedMap.get(d) || 0);
    if (remaining < slots) {
      return { ok: false, error: 'insufficient capacity', firstBlockedDate: d, remaining, requested: slots };
    }
  }

  const now = Date.now();
  const pricePerNight = service.pricePerNight || 0;
  const nights = Math.max(1, Math.round((rangeTo - rangeFrom) / DAY_MS) + 1);
  const totalPrice = pricePerNight * nights * slots;

  const booking = {
    parentOpenid: entry.parentOpenid,
    petIds: entry.petIds,
    serviceId: entry.serviceId,
    dropoffAt: entry.dropoffAt,
    pickupAt: entry.pickupAt,
    nights,
    pricePerNight,
    totalPrice,
    paymentStatus: 'pending',
    bookingStatus: 'confirmed',
    parentNotes: entry.parentNotes || '',
    // No waiver capture on promotion — owner is acting as proxy. Mark with a sentinel.
    agreementVersion: 'promoted-from-waitlist',
    agreementAcceptedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const insert = await db.collection('bookings').add({ data: booking });
  await db.collection('waitlistEntries').doc(event._id).update({
    data: { status: 'fulfilled', updatedAt: now },
  });
  return { ok: true, bookingId: insert._id };
};
