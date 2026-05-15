const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ALLOWED_FIELDS = [
  'nameZh',
  'nameEn',
  'descriptionZh',
  'descriptionEn',
  'unitPrice',
  'chargeBasis',
  'active',
];

const ALLOWED_BASIS = new Set(['per_stay', 'per_night']);

async function isOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  if (!(await isOwner(db, OPENID))) {
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
  if (typeof payload.unitPrice !== 'number' || payload.unitPrice < 0) {
    return { ok: false, error: 'unitPrice must be a non-negative number' };
  }
  if (!ALLOWED_BASIS.has(payload.chargeBasis)) {
    return { ok: false, error: 'chargeBasis must be per_stay or per_night' };
  }
  if (payload.active === undefined) payload.active = true;

  const addons = db.collection('addons');
  if (event._id) {
    const existing = await addons.doc(event._id).get().catch(() => null);
    if (!existing || !existing.data) return { ok: false, error: 'addon not found' };
    await addons.doc(event._id).update({ data: payload });
    return { ok: true, _id: event._id };
  }

  const insert = await addons.add({ data: { ...payload, createdAt: Date.now() } });
  return { ok: true, _id: insert._id };
};
