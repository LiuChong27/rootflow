'use strict';

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
const USERS = 'rf_users';
const PROGRESS = 'rf_progress';
const ACTIVITY = 'rf_learning_activity';

async function upsertUser(openid, now) {
  const userCollection = db.collection(USERS);
  const existing = await userCollection.where({ _openid: openid }).limit(1).get();
  const user = existing.data[0];

  if (user) {
    await userCollection.doc(user._id).update({
      data: {
        lastSyncAt: now,
        updatedAt: now,
      },
    });
    return user;
  }

  await userCollection.add({
    data: {
      nickName: '',
      avatarUrl: '',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      lastSyncAt: now,
    },
  });

  return null;
}

async function replaceActivity(openid, activityDates) {
  const activityCollection = db.collection(ACTIVITY);
  const current = await activityCollection.where({ _openid: openid }).get();
  await Promise.all(current.data.map((item) => activityCollection.doc(item._id).remove()));
  await Promise.all(
    activityDates.map((dateKey) =>
      activityCollection.add({
        data: {
          dateKey,
          createdAt: Date.now(),
        },
      }),
    ),
  );
}

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

  const entries = Array.isArray(event && event.entries) ? event.entries : [];
  const activityDates = Array.isArray(event && event.activityDates)
    ? event.activityDates.filter(Boolean)
    : [];
  const resetAll = Boolean(event && event.resetAll);

  await upsertUser(OPENID, now);

  const progressCollection = db.collection(PROGRESS);
  if (resetAll) {
    const currentProgress = await progressCollection.where({ _openid: OPENID }).get();
    await Promise.all(
      currentProgress.data.map((item) => progressCollection.doc(item._id).remove()),
    );
  }

  for (const entry of entries) {
    const wordId = String(entry && entry.wordId ? entry.wordId : '')
      .trim()
      .toLowerCase();
    if (!wordId) continue;

    const rootId = String(entry && entry.rootId ? entry.rootId : '')
      .trim()
      .toLowerCase();
    const status = entry && entry.status === 'mastered' ? 'mastered' : 'new';
    const updatedAt = Number(entry && entry.updatedAt ? entry.updatedAt : now);
    const existing = await progressCollection
      .where({
        _openid: OPENID,
        wordId,
      })
      .limit(1)
      .get();

    if (existing.data.length) {
      await progressCollection.doc(existing.data[0]._id).update({
        data: {
          rootId,
          status,
          updatedAt,
        },
      });
    } else {
      await progressCollection.add({
        data: {
          wordId,
          rootId,
          status,
          updatedAt,
          createdAt: now,
        },
      });
    }
  }

  await replaceActivity(OPENID, activityDates);

  const latestProgress = await progressCollection.where({ _openid: OPENID }).get();
  const mastered = latestProgress.data.filter((item) => item.status === 'mastered');
  const masteredRoots = new Set(mastered.map((item) => item.rootId).filter(Boolean));

  await db
    .collection(USERS)
    .where({ _openid: OPENID })
    .update({
      data: {
        lastSyncAt: now,
        updatedAt: now,
      },
    });

  return {
    ok: true,
    syncedCount: entries.length,
    stats: {
      masteredWords: mastered.length,
      masteredRoots: masteredRoots.size,
      activityDays: activityDates.length,
    },
  };
};
