'use strict';

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const USERS = 'rf_users';

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const now = Date.now();

  if (!OPENID) {
    return {
      ok: false,
      code: 'OPENID_MISSING',
      message: '未能获取微信用户标识。',
    };
  }

  const userCollection = db.collection(USERS);
  const existing = await userCollection.where({ _openid: OPENID }).limit(1).get();
  let user = existing.data[0];

  if (user) {
    await userCollection.doc(user._id).update({
      data: {
        lastLoginAt: now,
        updatedAt: now,
      },
    });
    user = {
      ...user,
      lastLoginAt: now,
      updatedAt: now,
    };
  } else {
    const addResult = await userCollection.add({
      data: {
        nickName: '',
        avatarUrl: '',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        lastSyncAt: 0,
      },
    });
    user = {
      _id: addResult._id,
      nickName: '',
      avatarUrl: '',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      lastSyncAt: 0,
    };
  }

  return {
    ok: true,
    session: {
      openid: OPENID,
      userId: OPENID,
      lastLoginAt: now,
      cloudLinked: true,
    },
    user: {
      openid: OPENID,
      userId: OPENID,
      nickName: user.nickName || '',
      avatarUrl: user.avatarUrl || '',
      lastLoginAt: now,
      lastSyncAt: Number(user.lastSyncAt || 0),
      cloudLinked: true,
    },
  };
};
