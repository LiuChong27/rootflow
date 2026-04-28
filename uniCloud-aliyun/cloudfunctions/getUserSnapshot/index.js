'use strict';

const {
  ACTIVITY,
  PROGRESS,
  USERS,
  buildProgressMap,
  getDownloadBenefitsSnapshot,
  buildStats,
  db,
  normalizeProgressEntry,
  requireOpenId,
  toErrorResult,
  toSessionUser,
} = require('rootflow-shared');

exports.main = async (event) => {
  try {
    const openid = await requireOpenId(event);

    const [userResult, progressResult, activityResult, downloadBenefits] = await Promise.all([
      db.collection(USERS).where({ openid }).limit(1).get(),
      db.collection(PROGRESS).where({ openid }).get(),
      db.collection(ACTIVITY).where({ openid }).get(),
      getDownloadBenefitsSnapshot(openid, { now: Date.now(), ensureRecord: true }),
    ]);

    const user = userResult.data[0] || {
      openid,
      nickName: '',
      avatarUrl: '',
      lastLoginAt: 0,
      lastSyncAt: 0,
    };
    const progressItems = progressResult.data || [];
    const activityDates = (activityResult.data || [])
      .map((item) => item.dateKey)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    const normalizedProgressItems = progressItems.map((item) => ({
      wordId: item.wordId,
      rootId: item.rootId,
      ...normalizeProgressEntry(item),
    }));

    return {
      ok: true,
      user: toSessionUser(user),
      progressMap: buildProgressMap(progressItems),
      activityDates,
      stats: buildStats(normalizedProgressItems, activityDates),
      downloadBenefits,
    };
  } catch (error) {
    return toErrorResult(error);
  }
};
