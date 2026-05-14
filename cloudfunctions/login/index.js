const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const db = cloud.database();
  const users = db.collection('users');

  const found = await users.where({ openid }).limit(1).get();
  if (found.data.length) {
    return { openid, user: found.data[0], isNewUser: false };
  }

  const now = Date.now();
  const newUser = { openid, role: 'parent', createdAt: now };
  const insert = await users.add({ data: newUser });
  return { openid, user: { ...newUser, _id: insert._id }, isNewUser: true };
};
