const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OCCURRENCES = 60; // safety cap (≈ 1 year of weekly stays or 2 months of daily)

function normalizeDate(ts) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const ACTIVE_BOOKING_STATUSES = new Set(['confirmed', 'checked_in', 'checked_out']);

function generateOccurrences(dropoffAt, pickupAt, recurrence) {
  if (!recurrence) {
    return [{ dropoffAt, pickupAt }];
  }
  const { pattern, daysOfWeek, endsAt } = recurrence;
  if (!endsAt || typeof endsAt !== 'number' || endsAt < dropoffAt) {
    return null;
  }
  if (pattern !== 'daily' && pattern !== 'weekly') {
    return null;
  }

  const startDay = normalizeDate(dropoffAt);
  const endDay = normalizeDate(endsAt);
  const stayMs = pickupAt - dropoffAt;
  const dropoffTimeOffset = dropoffAt - startDay;
  const out = [];

  if (pattern === 'daily') {
    for (let d = startDay; d <= endDay && out.length < MAX_OCCURRENCES; d += DAY_MS) {
      out.push({
        dropoffAt: d + dropoffTimeOffset,
        pickupAt: d + dropoffTimeOffset + stayMs,
      });
    }
  } else {
    const daysSet = new Set(
      Array.isArray(daysOfWeek) && daysOfWeek.length ? daysOfWeek : [new Date(startDay).getUTCDay()],
    );
    for (let d = startDay; d <= endDay && out.length < MAX_OCCURRENCES; d += DAY_MS) {
      if (daysSet.has(new Date(d).getUTCDay())) {
        out.push({
          dropoffAt: d + dropoffTimeOffset,
          pickupAt: d + dropoffTimeOffset + stayMs,
        });
      }
    }
  }
  return out;
}

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

  const occurrences = generateOccurrences(event.dropoffAt, event.pickupAt, event.recurrence);
  if (!occurrences || !occurrences.length) {
    return { ok: false, error: 'invalid recurrence' };
  }
  if (occurrences.length > MAX_OCCURRENCES) {
    return { ok: false, error: `recurrence exceeds ${MAX_OCCURRENCES} occurrences` };
  }

  const slots = event.petIds.length;

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

  // 4. Build a per-day need map across all occurrences
  let rangeFrom = Infinity;
  let rangeTo = -Infinity;
  const needMap = new Map();
  for (const occ of occurrences) {
    const occFrom = normalizeDate(occ.dropoffAt);
    const occTo = normalizeDate(occ.pickupAt) - DAY_MS;
    if (occTo < occFrom) {
      return { ok: false, error: 'occurrence pickup must be after dropoff day' };
    }
    rangeFrom = Math.min(rangeFrom, occFrom);
    rangeTo = Math.max(rangeTo, occTo);
    for (let d = occFrom; d <= occTo; d += DAY_MS) {
      needMap.set(d, (needMap.get(d) || 0) + slots);
    }
  }

  // 5. Capacity check — for each day touched, the day's remaining must cover need
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

  for (const [day, need] of needMap.entries()) {
    const ov = overrideMap.get(day) || { absolute: null, delta: 0 };
    const dayCap = ov.absolute !== null ? ov.absolute : base + ov.delta;
    const remaining = dayCap - (bookedMap.get(day) || 0);
    if (remaining < need) {
      return {
        ok: false,
        error: 'insufficient capacity',
        firstBlockedDate: day,
        remaining,
        requested: need,
      };
    }
  }

  // 6. Resolve add-ons (look up active catalog rows and freeze pricing into the booking)
  let resolvedAddOns = [];
  if (Array.isArray(event.addOns) && event.addOns.length) {
    const requested = event.addOns
      .filter((a) => a && a.addonId && typeof a.quantity === 'number' && a.quantity > 0)
      .map((a) => ({ addonId: String(a.addonId), quantity: Math.floor(a.quantity) }));
    if (requested.length) {
      const ids = requested.map((a) => a.addonId);
      const aRes = await db.collection('addons').where({ _id: _.in(ids), active: true }).get();
      const aMap = new Map(aRes.data.map((a) => [a._id, a]));
      for (const req of requested) {
        const addon = aMap.get(req.addonId);
        if (!addon) return { ok: false, error: `addon ${req.addonId} unavailable` };
        resolvedAddOns.push({
          addonId: addon._id,
          nameZh: addon.nameZh,
          nameEn: addon.nameEn,
          unitPrice: addon.unitPrice,
          quantity: req.quantity,
          chargeBasis: addon.chargeBasis,
        });
      }
    }
  }

  // 7. Insert template first, then instances pointing at it
  const now = Date.now();
  const pricePerNight = service.pricePerNight || 0;

  const addonsCostFor = (nights) => {
    let total = 0;
    for (const a of resolvedAddOns) {
      const mult = a.chargeBasis === 'per_night' ? nights : 1;
      total += a.unitPrice * a.quantity * mult;
    }
    return total;
  };

  const computeStay = (occ) => {
    const a = normalizeDate(occ.dropoffAt);
    const b = normalizeDate(occ.pickupAt);
    const nights = Math.max(1, Math.round((b - a) / DAY_MS));
    const stayCost = pricePerNight * nights * slots;
    return { nights, totalPrice: stayCost + addonsCostFor(nights) };
  };

  const template = occurrences[0];
  const tStay = computeStay(template);
  const baseFields = {
    parentOpenid: OPENID,
    petIds: event.petIds,
    serviceId: event.serviceId,
    pricePerNight,
    paymentStatus: 'pending',
    bookingStatus: 'confirmed',
    parentNotes: event.parentNotes || '',
    agreementVersion: event.agreementVersion,
    agreementAcceptedAt: event.agreementAcceptedAt,
    createdAt: now,
    updatedAt: now,
  };

  const templateRow = {
    ...baseFields,
    dropoffAt: template.dropoffAt,
    pickupAt: template.pickupAt,
    nights: tStay.nights,
    totalPrice: tStay.totalPrice,
  };
  if (resolvedAddOns.length) {
    templateRow.addOns = resolvedAddOns;
  }
  if (event.recurrence) {
    templateRow.recurrence = event.recurrence;
  }

  const templateInsert = await db.collection('bookings').add({ data: templateRow });
  const templateId = templateInsert._id;
  const createdIds = [templateId];

  if (occurrences.length > 1) {
    // Sequential inserts to keep within transaction-less safety; small N (≤ MAX_OCCURRENCES).
    for (let i = 1; i < occurrences.length; i += 1) {
      const occ = occurrences[i];
      const stay = computeStay(occ);
      const row = {
        ...baseFields,
        dropoffAt: occ.dropoffAt,
        pickupAt: occ.pickupAt,
        nights: stay.nights,
        totalPrice: stay.totalPrice,
        parentBookingId: templateId,
      };
      if (resolvedAddOns.length) {
        row.addOns = resolvedAddOns;
      }
      const insert = await db.collection('bookings').add({ data: row });
      createdIds.push(insert._id);
    }
  }

  const totalPriceSeries = occurrences.reduce((sum, occ) => sum + computeStay(occ).totalPrice, 0);
  return {
    ok: true,
    _id: templateId,
    instanceIds: createdIds,
    occurrences: occurrences.length,
    nights: tStay.nights,
    totalPrice: totalPriceSeries,
  };
};
