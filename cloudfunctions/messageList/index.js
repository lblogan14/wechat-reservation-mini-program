const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function isStaffOrOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  if (!res.data.length) return false;
  const role = res.data[0].role;
  return role === 'owner' || role === 'staff';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  if (!event.threadId) return { ok: false, error: 'threadId required' };

  const threadRes = await db.collection('messageThreads').doc(event.threadId).get().catch(() => null);
  if (!threadRes || !threadRes.data) return { ok: false, error: 'thread not found' };

  if (threadRes.data.parentOpenid !== OPENID && !(await isStaffOrOwner(db, OPENID))) {
    return { ok: false, error: 'not your thread' };
  }

  const msgs = await db.collection('messages')
    .where({ threadId: event.threadId })
    .orderBy('createdAt', 'asc')
    .limit(500)
    .get();

  return { ok: true, thread: threadRes.data, messages: msgs.data };
};
