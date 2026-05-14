const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();
  const res = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  return { user: res.data[0] || null };
};
