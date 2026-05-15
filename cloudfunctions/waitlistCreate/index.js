const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();
  const _ = db.command;

  if (!event.serviceId) return { ok: false, error: 'serviceId required' };
  if (!Array.isArray(event.petIds) || !event.petIds.length) {
    return { ok: false, error: 'at least one pet required' };
  }
  if (typeof event.dropoffAt !== 'number' || typeof event.pickupAt !== 'number') {
    return { ok: false, error: 'dropoffAt and pickupAt required' };
  }
  if (event.pickupAt <= event.dropoffAt) {
    return { ok: false, error: 'pickupAt must be after dropoffAt' };
  }

  // Pets must belong to caller
  const petsRes = await db.collection('pets')
    .where({ ownerOpenid: OPENID, _id: _.in(event.petIds) })
    .get();
  if (petsRes.data.length !== event.petIds.length) {
    return { ok: false, error: 'one or more pets are not yours' };
  }

  const now = Date.now();
  const entry = {
    parentOpenid: OPENID,
    petIds: event.petIds,
    serviceId: event.serviceId,
    dropoffAt: event.dropoffAt,
    pickupAt: event.pickupAt,
    status: 'waiting',
    parentNotes: event.parentNotes || '',
    createdAt: now,
    updatedAt: now,
  };
  const insert = await db.collection('waitlistEntries').add({ data: entry });
  return { ok: true, _id: insert._id };
};
