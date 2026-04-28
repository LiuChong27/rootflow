'use strict';

const {
  ACTIVITY,
  PROGRESS,
  USERS,
  buildStats,
  db,
  ensureUserRecord,
  normalizeProgressEntry,
  requireOpenId,
  replaceActivity,
  toErrorResult,
} = require('rootflow-shared');

exports.main = async (event) => {
  try {
    const openid = await requireOpenId(event);
    const now = Date.now();
    const payload = event && typeof event === 'object' ? event : {};
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    const activityDates = Array.isArray(payload.activityDates) ? payload.activityDates : [];
    const resetAll = Boolean(payload.resetAll);

    await ensureUserRecord(openid, now);

    const progressCollection = db.collection(PROGRESS);
    if (resetAll) {
      const currentProgress = await progressCollection.where({ openid }).get();
      await Promise.all(
        (currentProgress.data || []).map((item) => progressCollection.doc(item._id).remove()),
      );
    }

    for (const entry of entries) {
      const wordId = String((entry && entry.wordId) || '')
        .trim()
        .toLowerCase();
      if (!wordId) continue;

      const rootId = String((entry && entry.rootId) || '')
        .trim()
        .toLowerCase();
      const normalizedEntry = normalizeProgressEntry(entry, now);
      const existing = await progressCollection
        .where({
          openid,
          wordId,
        })
        .limit(1)
        .get();

      if ((existing.data || []).length) {
        await progressCollection.doc(existing.data[0]._id).update({
          data: {
            rootId,
            ...normalizedEntry,
          },
        });
      } else {
        await progressCollection.add({
          data: {
            openid,
            wordId,
            rootId,
            ...normalizedEntry,
            createdAt: now,
          },
        });
      }
    }

    const normalizedActivityDates = await replaceActivity(openid, activityDates, now);

    const latestProgress = await progressCollection.where({ openid }).get();
    const normalizedProgressItems = (latestProgress.data || []).map((item) => ({
      wordId: item.wordId,
      rootId: item.rootId,
      ...normalizeProgressEntry(item, now),
    }));

    const userResult = await db.collection(USERS).where({ openid }).limit(1).get();
    if ((userResult.data || []).length) {
      await db
        .collection(USERS)
        .doc(userResult.data[0]._id)
        .update({
          data: {
            lastSyncAt: now,
            updatedAt: now,
          },
        });
    }

    return {
      ok: true,
      syncedCount: entries.length,
      stats: buildStats(normalizedProgressItems, normalizedActivityDates),
    };
  } catch (error) {
    return toErrorResult(error);
  }
};
