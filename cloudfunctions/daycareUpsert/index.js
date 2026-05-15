const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ALLOWED_FIELDS = [
  'nameZh',
  'nameEn',
  'address',
  'phone',
  'photoFileIDs',
  'hoursOpen',
  'hoursClose',
  'cancelPolicyZh',
  'cancelPolicyEn',
  'agreementZh',
  'agreementEn',
  'agreementVersion',
  'reminderDropoffTmplId',
  'reminderPickupTmplId',
];

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  const userRes = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!userRes.data.length || userRes.data[0].role !== 'owner') {
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

  const now = Date.now();
  payload.updatedAt = now;

  const existing = await db.collection('daycareConfig').limit(1).get();
  if (existing.data.length) {
    const _id = existing.data[0]._id;
    await db.collection('daycareConfig').doc(_id).update({ data: payload });
    return { ok: true, _id };
  }

  const insert = await db.collection('daycareConfig').add({ data: payload });
  return { ok: true, _id: insert._id };
};
