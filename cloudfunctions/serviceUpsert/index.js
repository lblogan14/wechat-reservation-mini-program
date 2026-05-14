const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ALLOWED_FIELDS = [
  'nameZh',
  'nameEn',
  'descriptionZh',
  'descriptionEn',
  'pricePerNight',
  'capacityPerDay',
  'sortOrder',
  'active',
];

async function assertOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  if (!(await assertOwner(db, OPENID))) {
    return { ok: false, error: 'owner role required' };
  }

  const payload = {};
  for (const k of ALLOWED_FIELDS) {
    if (event[k] !== undefined && event[k] !== null) {
      payload[k] = event[k];
    }
  }

  if (!payload.nameZh && !payload.nameEn) {
    return { ok: false, error: 'name (zh or en) required' };
  }
  if (typeof payload.pricePerNight !== 'number' || payload.pricePerNight < 0) {
    return { ok: false, error: 'pricePerNight must be a non-negative number' };
  }
  if (typeof payload.capacityPerDay !== 'number' || payload.capacityPerDay < 0 || !Number.isInteger(payload.capacityPerDay)) {
    return { ok: false, error: 'capacityPerDay must be a non-negative integer' };
  }
  if (payload.active === undefined) {
    payload.active = true;
  }

  const services = db.collection('services');
  if (event._id) {
    const existing = await services.doc(event._id).get().catch(() => null);
    if (!existing || !existing.data) {
      return { ok: false, error: 'service not found' };
    }
    await services.doc(event._id).update({ data: payload });
    return { ok: true, _id: event._id };
  }

  const now = Date.now();
  const insert = await services.add({ data: { ...payload, createdAt: now } });
  return { ok: true, _id: insert._id };
};
