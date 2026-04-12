'use strict';

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const USERS = 'rf_users';

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const now = Date.now();

  if (!OPENID) {
    return {
      ok: false,
      code: 'OPENID_MISSING',
      message: '未能获取微信用户标识。',
    };
  }

  const nickName = String(event && event.nickName ? event.nickName : '').trim();
  const avatarUrl = String(event && event.avatarUrl ? event.avatarUrl : '').trim();
  const userCollection = db.collection(USERS);
  const existing = await userCollection.where({ _openid: OPENID }).limit(1).get();
  const user = existing.data[0];

  if (!user) {
    return {
      ok: false,
      code: 'USER_NOT_FOUND',
      message: '请先完成登录。',
    };
  }

  await userCollection.doc(user._id).update({
    data: {
      nickName,
      avatarUrl,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    user: {
      openid: OPENID,
      userId: OPENID,
      nickName,
      avatarUrl,
      lastLoginAt: Number(user.lastLoginAt || 0),
      lastSyncAt: Number(user.lastSyncAt || 0),
      cloudLinked: true,
    },
  };
};
