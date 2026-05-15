const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function isOwner(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data.length > 0 && res.data[0].role === 'owner';
}

async function enrich(db, entries) {
  if (!entries.length) return entries;
  const _ = db.command;
  const serviceIds = Array.from(new Set(entries.map((e) => e.serviceId).filter(Boolean)));
  const petIds = Array.from(new Set(entries.flatMap((e) => e.petIds || [])));
  const [svcRes, petRes] = await Promise.all([
    serviceIds.length
      ? db.collection('services').where({ _id: _.in(serviceIds) }).limit(200).get()
      : Promise.resolve({ data: [] }),
    petIds.length
      ? db.collection('pets').where({ _id: _.in(petIds) }).limit(500).get()
      : Promise.resolve({ data: [] }),
  ]);
  const sMap = new Map(svcRes.data.map((s) => [s._id, s]));
  const pMap = new Map(petRes.data.map((p) => [p._id, p]));
  return entries.map((entry) => {
    const svc = sMap.get(entry.serviceId);
    const petNames = (entry.petIds || []).map((id) => {
      const p = pMap.get(id);
      return p ? p.name : null;
    }).filter(Boolean);
    return {
      ...entry,
      serviceNameZh: svc ? svc.nameZh : '',
      serviceNameEn: svc ? svc.nameEn : '',
      petNames,
    };
  });
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();

  const wantAll = event && event.scope === 'all';
  const where = wantAll && (await isOwner(db, OPENID)) ? {} : { parentOpenid: OPENID };

  try {
    const res = await db.collection('waitlistEntries')
      .where(where)
      .orderBy('createdAt', 'asc')
      .limit(200)
      .get();
    const enriched = await enrich(db, res.data);
    return { ok: true, entries: enriched };
  } catch (err) {
    return { ok: true, entries: [] };
  }
};
