const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function getUser(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data[0] || null;
}

async function findOrCreateThread(db, caller, callerRole, opts) {
  if (opts.threadId) {
    const tr = await db.collection('messageThreads').doc(opts.threadId).get().catch(() => null);
    if (!tr || !tr.data) return { error: 'thread not found' };
    if (tr.data.parentOpenid !== caller && callerRole !== 'owner') {
      return { error: 'not your thread' };
    }
    return { thread: tr.data };
  }
  if (!opts.bookingId) return { error: 'threadId or bookingId required' };

  const bRes = await db.collection('bookings').doc(opts.bookingId).get().catch(() => null);
  if (!bRes || !bRes.data) return { error: 'booking not found' };
  const booking = bRes.data;
  if (booking.parentOpenid !== caller && callerRole !== 'owner') {
    return { error: 'not your booking' };
  }

  const existing = await db.collection('messageThreads')
    .where({ bookingId: opts.bookingId })
    .limit(1)
    .get();
  if (existing.data.length) return { thread: existing.data[0] };

  const now = Date.now();
  const newThread = {
    bookingId: opts.bookingId,
    parentOpenid: booking.parentOpenid,
    lastMessageAt: now,
    lastMessagePreview: '',
    unreadForParent: 0,
    unreadForOwner: 0,
    createdAt: now,
  };
  const ins = await db.collection('messageThreads').add({ data: newThread });
  return { thread: { ...newThread, _id: ins._id } };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();
  const _ = db.command;

  if (!event.body || typeof event.body !== 'string' || !event.body.trim()) {
    return { ok: false, error: 'body required' };
  }
  const body = event.body.slice(0, 2000); // hard cap on a single message

  const user = await getUser(db, OPENID);
  const callerRole = user?.role === 'owner' ? 'owner' : user?.role === 'staff' ? 'staff' : 'parent';

  const tr = await findOrCreateThread(db, OPENID, callerRole, {
    threadId: event.threadId,
    bookingId: event.bookingId,
  });
  if (tr.error) return { ok: false, error: tr.error };

  const thread = tr.thread;
  const now = Date.now();

  // Insert message
  const msg = {
    threadId: thread._id,
    fromOpenid: OPENID,
    fromRole: callerRole,
    body,
    createdAt: now,
  };
  if (event.attachmentFileID) msg.attachmentFileID = event.attachmentFileID;
  const ins = await db.collection('messages').add({ data: msg });

  // Update thread: lastMessage, increment unread for the OTHER side
  const preview = body.slice(0, 80);
  const data = {
    lastMessageAt: now,
    lastMessagePreview: preview,
  };
  if (callerRole === 'owner' || callerRole === 'staff') {
    data.unreadForParent = _.inc(1);
  } else {
    data.unreadForOwner = _.inc(1);
  }
  await db.collection('messageThreads').doc(thread._id).update({ data });

  return { ok: true, threadId: thread._id, messageId: ins._id };
};
