import authService from './authService';
import { callCloudFunction } from './cloudService';
import wordRepo from './wordRepo';

let hydrationPromise = null;

function normalizeSnapshot(snapshot) {
  const safeSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
  return {
    progressMap:
      safeSnapshot.progressMap && typeof safeSnapshot.progressMap === 'object'
        ? safeSnapshot.progressMap
        : {},
    activityDates: Array.isArray(safeSnapshot.activityDates) ? safeSnapshot.activityDates : [],
    stats: safeSnapshot.stats || null,
  };
}

export async function hydrateProgressFromCloud(options = {}) {
  const { force = false } = options;
  if (!authService.isLoggedIn()) {
    return {
      ok: false,
      code: 'NOT_LOGGED_IN',
      message: 'No logged-in user.',
      stats: wordRepo.getProgressStats(),
    };
  }

  if (hydrationPromise && !force) {
    return hydrationPromise;
  }

  hydrationPromise = authService
    .fetchUserSnapshot()
    .then((snapshot) => {
      const normalized = normalizeSnapshot(snapshot);
      wordRepo.replaceProgressMap(normalized.progressMap, { mergeByUpdatedAt: true });
      wordRepo.replaceLearningActivity(normalized.activityDates);
      const stats = normalized.stats || wordRepo.getProgressStats();
      authService.updateSessionSyncTime(Date.now());
      return {
        ok: true,
        stats,
        user: snapshot.user,
      };
    })
    .finally(() => {
      hydrationPromise = null;
    });

  return hydrationPromise;
}

export async function syncProgressToCloud(options = {}) {
  const { resetAll = false } = options;
  if (!authService.isLoggedIn()) {
    return {
      ok: false,
      code: 'NOT_LOGGED_IN',
      message: 'No logged-in user.',
      stats: wordRepo.getProgressStats(),
    };
  }

  const payload = wordRepo.getProgressEntriesForSync();
  const syncResult = await callCloudFunction('syncProgress', {
    resetAll,
    entries: payload.entries,
    activityDates: payload.activityDates,
  });

  authService.updateSessionSyncTime(Date.now());
  return {
    ok: true,
    stats: syncResult.stats || wordRepo.getProgressStats(),
    syncedCount: Number(syncResult.syncedCount || payload.entries.length),
  };
}

export async function markWordStatusAndSync(wordId, status) {
  wordRepo.setWordStatus(wordId, status);
  return syncProgressToCloud();
}

export async function clearProgressAndSync() {
  wordRepo.clearProgress({ clearActivity: true });
  return syncProgressToCloud({ resetAll: true });
}

export function getLocalProgressStats() {
  return wordRepo.getProgressStats();
}

export default {
  clearProgressAndSync,
  getLocalProgressStats,
  hydrateProgressFromCloud,
  markWordStatusAndSync,
  syncProgressToCloud,
};
