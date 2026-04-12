'use strict';

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const USERS = 'rf_users';
const PROGRESS = 'rf_progress';
const ACTIVITY = 'rf_learning_activity';

function buildProgressMap(items) {
  return items.reduce((acc, item) => {
    const wordId = String(item.wordId || '')
      .trim()
      .toLowerCase();
    if (!wordId) return acc;
    acc[wordId] = {
      status: item.status === 'mastered' ? 'mastered' : 'new',
      updatedAt: Number(item.updatedAt || 0),
    };
    return acc;
  }, {});
}

function computeStreak(activityDates) {
  if (!activityDates.length) return 0;
  const activitySet = new Set(activityDates);
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
      cursor.getDate(),
    ).padStart(2, '0')}`;
    if (!activitySet.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return {
      ok: false,
      code: 'OPENID_MISSING',
      message: '未能获取微信用户标识。',
    };
  }

  const [userResult, progressResult, activityResult] = await Promise.all([
    db.collection(USERS).where({ _openid: OPENID }).limit(1).get(),
    db.collection(PROGRESS).where({ _openid: OPENID }).get(),
    db.collection(ACTIVITY).where({ _openid: OPENID }).get(),
  ]);

  const user = userResult.data[0] || {};
  const progressItems = progressResult.data || [];
  const activityDates = (activityResult.data || [])
    .map((item) => item.dateKey)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const masteredItems = progressItems.filter((item) => item.status === 'mastered');
  const masteredRoots = new Set(masteredItems.map((item) => item.rootId).filter(Boolean));

  return {
    ok: true,
    user: {
      openid: OPENID,
      userId: OPENID,
      nickName: String(user.nickName || ''),
      avatarUrl: String(user.avatarUrl || ''),
      lastLoginAt: Number(user.lastLoginAt || 0),
      lastSyncAt: Number(user.lastSyncAt || 0),
      cloudLinked: true,
    },
    progressMap: buildProgressMap(progressItems),
    activityDates,
    stats: {
      masteredWords: masteredItems.length,
      masteredRoots: masteredRoots.size,
      activityDays: activityDates.length,
      streakDays: computeStreak(activityDates),
      lastActivityDate: activityDates.length ? activityDates[activityDates.length - 1] : '',
    },
  };
};
