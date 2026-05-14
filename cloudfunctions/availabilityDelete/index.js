const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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

  if (!event._id) {
    return { ok: false, error: '_id required' };
  }

  await db.collection('availabilityOverrides').doc(event._id).remove();
  return { ok: true };
};
