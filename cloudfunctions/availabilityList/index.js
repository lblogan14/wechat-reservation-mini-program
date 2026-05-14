const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const db = cloud.database();
  const _ = db.command;

  const where = {};
  if (event && typeof event.from === 'number' && typeof event.to === 'number') {
    where.date = _.gte(event.from).and(_.lte(event.to));
  }
  if (event && event.serviceId) {
    where.serviceId = event.serviceId;
  }

  const res = await db.collection('availabilityOverrides')
    .where(where)
    .orderBy('date', 'asc')
    .limit(500)
    .get();
  return { overrides: res.data };
};
