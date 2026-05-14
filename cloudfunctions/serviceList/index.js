const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const db = cloud.database();
  const where = event && event.includeInactive ? {} : { active: true };
  const res = await db.collection('services')
    .where(where)
    .orderBy('sortOrder', 'asc')
    .orderBy('createdAt', 'asc')
    .limit(100)
    .get();
  return { services: res.data };
};
