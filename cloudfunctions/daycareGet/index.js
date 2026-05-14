const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const db = cloud.database();
  const res = await db.collection('daycareConfig').limit(1).get();
  return { config: res.data[0] || null };
};
