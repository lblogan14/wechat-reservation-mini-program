const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();
  const res = await db.collection('pets')
    .where({ ownerOpenid: OPENID })
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  return { pets: res.data };
};
