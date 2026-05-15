const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const db = cloud.database();
  const where = event && event.includeInactive ? {} : { active: true };
  try {
    const res = await db.collection('addons')
      .where(where)
      .orderBy('chargeBasis', 'asc')
      .orderBy('unitPrice', 'asc')
      .limit(100)
      .get();
    return { ok: true, addons: res.data };
  } catch (err) {
    return { ok: true, addons: [] };
  }
};
