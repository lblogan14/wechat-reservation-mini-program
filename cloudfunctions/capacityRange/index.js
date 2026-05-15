const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeDate(ts) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// checked_out is terminal — the pet has left, the slot is free.
const ACTIVE_STATUSES = new Set(['confirmed', 'checked_in']);

async function loadBookings(db, serviceId, from, to) {
  // bookings collection may not exist yet in v0.5 — guard the call.
  try {
    const res = await db.collection('bookings')
      .where({ serviceId })
      .limit(1000)
      .get();
    return res.data.filter((b) =>
      ACTIVE_STATUSES.has(b.bookingStatus) &&
      normalizeDate(b.dropoffAt) <= to &&
      normalizeDate(b.pickupAt) > from,
    );
  } catch (err) {
    return [];
  }
}

exports.main = async (event) => {
  if (!event.serviceId || typeof event.from !== 'number' || typeof event.to !== 'number') {
    return { ok: false, error: 'serviceId, from, to required' };
  }
  if (event.to < event.from) {
    return { ok: false, error: 'to must be >= from' };
  }

  const db = cloud.database();
  const _ = db.command;
  const from = normalizeDate(event.from);
  const to = normalizeDate(event.to);

  const serviceRes = await db.collection('services').doc(event.serviceId).get().catch(() => null);
  if (!serviceRes || !serviceRes.data) {
    return { ok: false, error: 'service not found' };
  }
  const service = serviceRes.data;
  const base = service.capacityPerDay || 0;

  const overridesRes = await db.collection('availabilityOverrides')
    .where({ serviceId: event.serviceId, date: _.gte(from).and(_.lte(to)) })
    .limit(500)
    .get();

  const overrideMap = new Map();
  for (const o of overridesRes.data) {
    const key = normalizeDate(o.date);
    const entry = overrideMap.get(key) || { absolute: null, delta: 0 };
    if (typeof o.capacityAbsolute === 'number') {
      // If multiple absolute overrides exist, the latest one wins (highest _id).
      entry.absolute = o.capacityAbsolute;
    } else if (typeof o.capacityDelta === 'number') {
      entry.delta += o.capacityDelta;
    }
    overrideMap.set(key, entry);
  }

  const bookings = await loadBookings(db, event.serviceId, from, to);
  const bookedMap = new Map();
  for (const b of bookings) {
    const slots = Array.isArray(b.petIds) ? b.petIds.length : 1;
    const start = Math.max(normalizeDate(b.dropoffAt), from);
    const stopExclusive = Math.min(normalizeDate(b.pickupAt), to + DAY_MS);
    for (let d = start; d < stopExclusive; d += DAY_MS) {
      bookedMap.set(d, (bookedMap.get(d) || 0) + slots);
    }
  }

  const days = [];
  for (let d = from; d <= to; d += DAY_MS) {
    const ov = overrideMap.get(d) || { absolute: null, delta: 0 };
    const booked = bookedMap.get(d) || 0;
    const dayCap = ov.absolute !== null ? ov.absolute : base + ov.delta;
    const remaining = Math.max(0, dayCap - booked);
    days.push({
      date: d,
      base,
      deltaSum: ov.delta,
      absolute: ov.absolute,
      capacityForDay: dayCap,
      booked,
      remaining,
    });
  }

  return {
    ok: true,
    serviceId: event.serviceId,
    nameZh: service.nameZh,
    nameEn: service.nameEn,
    base,
    days,
  };
};
