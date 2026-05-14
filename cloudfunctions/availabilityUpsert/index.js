const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function assertOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

function normalizeDate(ts) {
  // Normalize to start-of-day UTC so date-keyed comparisons are stable.
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  if (!(await assertOwner(db, OPENID))) {
    return { ok: false, error: 'owner role required' };
  }

  if (typeof event.date !== 'number' || !event.serviceId) {
    return { ok: false, error: 'date and serviceId required' };
  }

  const hasDelta = typeof event.capacityDelta === 'number';
  const hasAbsolute = typeof event.capacityAbsolute === 'number';
  if (hasDelta === hasAbsolute) {
    return { ok: false, error: 'specify exactly one of capacityDelta or capacityAbsolute' };
  }

  const payload = {
    date: normalizeDate(event.date),
    serviceId: event.serviceId,
    reason: event.reason || '',
  };
  if (hasDelta) {
    if (!Number.isInteger(event.capacityDelta)) {
      return { ok: false, error: 'capacityDelta must be an integer' };
    }
    payload.capacityDelta = event.capacityDelta;
  } else {
    if (!Number.isInteger(event.capacityAbsolute) || event.capacityAbsolute < 0) {
      return { ok: false, error: 'capacityAbsolute must be a non-negative integer' };
    }
    payload.capacityAbsolute = event.capacityAbsolute;
  }

  const overrides = db.collection('availabilityOverrides');
  if (event._id) {
    const existing = await overrides.doc(event._id).get().catch(() => null);
    if (!existing || !existing.data) {
      return { ok: false, error: 'override not found' };
    }
    await overrides.doc(event._id).update({ data: payload });
    return { ok: true, _id: event._id };
  }

  const insert = await overrides.add({ data: payload });
  return { ok: true, _id: insert._id };
};
