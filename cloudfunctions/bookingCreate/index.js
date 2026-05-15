const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeDate(ts) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const ACTIVE_BOOKING_STATUSES = new Set(['confirmed', 'checked_in', 'checked_out']);

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();
  const _ = db.command;

  // 1. Validate payload
  if (!event.serviceId) return { ok: false, error: 'serviceId required' };
  if (!Array.isArray(event.petIds) || !event.petIds.length) {
    return { ok: false, error: 'at least one pet required' };
  }
  if (typeof event.dropoffAt !== 'number' || typeof event.pickupAt !== 'number') {
    return { ok: false, error: 'dropoffAt and pickupAt required' };
  }
  if (event.pickupAt <= event.dropoffAt) {
    return { ok: false, error: 'pickupAt must be after dropoffAt' };
  }
  if (!event.agreementAcceptedAt || !event.agreementVersion) {
    return { ok: false, error: 'waiver acceptance required' };
  }

  const slots = event.petIds.length;
  const dropoffDay = normalizeDate(event.dropoffAt);
  const pickupDay = normalizeDate(event.pickupAt);
  const nights = Math.max(1, Math.round((pickupDay - dropoffDay) / DAY_MS));

  // 2. Pets must belong to caller
  const petsRes = await db.collection('pets')
    .where({ ownerOpenid: OPENID, _id: _.in(event.petIds) })
    .get();
  if (petsRes.data.length !== event.petIds.length) {
    return { ok: false, error: 'one or more pets are not yours' };
  }

  // 3. Service must exist and be active
  const serviceRes = await db.collection('services').doc(event.serviceId).get().catch(() => null);
  if (!serviceRes || !serviceRes.data || serviceRes.data.active === false) {
    return { ok: false, error: 'service unavailable' };
  }
  const service = serviceRes.data;
  const base = service.capacityPerDay || 0;

  // 4. Capacity check — for each day in [dropoffDay, pickupDay), remaining >= slots
  const rangeFrom = dropoffDay;
  const rangeTo = pickupDay - DAY_MS; // last day consumed
  const overridesRes = await db.collection('availabilityOverrides')
    .where({ serviceId: event.serviceId, date: _.gte(rangeFrom).and(_.lte(rangeTo)) })
    .limit(500)
    .get();
  const overrideMap = new Map();
  for (const o of overridesRes.data) {
    const k = normalizeDate(o.date);
    const entry = overrideMap.get(k) || { absolute: null, delta: 0 };
    if (typeof o.capacityAbsolute === 'number') entry.absolute = o.capacityAbsolute;
    else if (typeof o.capacityDelta === 'number') entry.delta += o.capacityDelta;
    overrideMap.set(k, entry);
  }

  let bookingsRes;
  try {
    bookingsRes = await db.collection('bookings')
      .where({ serviceId: event.serviceId })
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
    const dayFrom = Math.max(bStart, rangeFrom);
    const dayTo = Math.min(bEnd - DAY_MS, rangeTo);
    for (let d = dayFrom; d <= dayTo; d += DAY_MS) {
      bookedMap.set(d, (bookedMap.get(d) || 0) + n);
    }
  }

  for (let d = rangeFrom; d <= rangeTo; d += DAY_MS) {
    const ov = overrideMap.get(d) || { absolute: null, delta: 0 };
    const dayCap = ov.absolute !== null ? ov.absolute : base + ov.delta;
    const booked = bookedMap.get(d) || 0;
    const remaining = dayCap - booked;
    if (remaining < slots) {
      return {
        ok: false,
        error: 'insufficient capacity',
        firstBlockedDate: d,
        remaining,
        requested: slots,
      };
    }
  }

  // 5. Insert
  const now = Date.now();
  const pricePerNight = service.pricePerNight || 0;
  const totalPrice = pricePerNight * nights * slots;
  const booking = {
    parentOpenid: OPENID,
    petIds: event.petIds,
    serviceId: event.serviceId,
    dropoffAt: event.dropoffAt,
    pickupAt: event.pickupAt,
    nights,
    pricePerNight,
    totalPrice,
    paymentStatus: 'pending',
    bookingStatus: 'confirmed',
    parentNotes: event.parentNotes || '',
    agreementVersion: event.agreementVersion,
    agreementAcceptedAt: event.agreementAcceptedAt,
    createdAt: now,
    updatedAt: now,
  };
  const insert = await db.collection('bookings').add({ data: booking });
  return { ok: true, _id: insert._id, nights, totalPrice };
};
