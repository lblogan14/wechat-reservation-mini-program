const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function isOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  if (!event._id) return { ok: false, error: '_id required' };
  const target = await db.collection('waitlistEntries').doc(event._id).get().catch(() => null);
  if (!target || !target.data) return { ok: false, error: 'entry not found' };

  if (target.data.parentOpenid !== OPENID && !(await isOwner(db, OPENID))) {
    return { ok: false, error: 'not your entry' };
  }
  if (target.data.status !== 'waiting' && target.data.status !== 'offered') {
    return { ok: false, error: `cannot cancel from status ${target.data.status}` };
  }

  await db.collection('waitlistEntries').doc(event._id).update({
    data: { status: 'cancelled', updatedAt: Date.now() },
  });
  return { ok: true };
};
