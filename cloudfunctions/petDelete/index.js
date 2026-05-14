const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();
  const pets = db.collection('pets');

  if (!event._id) {
    return { ok: false, error: '_id required' };
  }

  const existing = await pets.doc(event._id).get().catch(() => null);
  if (!existing || !existing.data) {
    return { ok: false, error: 'pet not found' };
  }
  if (existing.data.ownerOpenid !== OPENID) {
    return { ok: false, error: 'not owner' };
  }

  await pets.doc(event._id).remove();
  return { ok: true };
};
