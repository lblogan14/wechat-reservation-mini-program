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
  const _ = db.command;

  if (!event.threadId) return { ok: false, error: 'threadId required' };

  const tRes = await db.collection('messageThreads').doc(event.threadId).get().catch(() => null);
  if (!tRes || !tRes.data) return { ok: false, error: 'thread not found' };

  const isParent = tRes.data.parentOpenid === OPENID;
  const daycareSide = !isParent && (await isStaffOrOwner(db, OPENID));
  if (!isParent && !daycareSide) {
    return { ok: false, error: 'not your thread' };
  }

  const now = Date.now();

  // Mark per-message read receipts.
  const readField = isParent ? 'readByParentAt' : 'readByOwnerAt';
  await db.collection('messages')
    .where({ threadId: event.threadId, [readField]: _.exists(false) })
    .update({ data: { [readField]: now } })
    .catch(() => null); // batch update may return errors when nothing to update; ignore.

  // Reset the thread-level unread counter for the caller's side.
  const update = isParent ? { unreadForParent: 0 } : { unreadForOwner: 0 };
  await db.collection('messageThreads').doc(event.threadId).update({ data: update });

  return { ok: true };
};
