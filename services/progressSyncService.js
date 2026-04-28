import authService from './authService';
import { callCloudFunction } from './cloudService';
import downloadService from './downloadService';
import wordRepo from './wordRepo';

const DEFAULT_PROGRESS_SYNC_DEPS = Object.freeze({
  authService,
  callCloudFunction,
  wordRepo,
  now: () => Date.now(),
});

let progressSyncDeps = { ...DEFAULT_PROGRESS_SYNC_DEPS };
let hydrationPromise = null;
let pendingSyncTimer = null;
let pendingSyncRequested = false;
let syncInFlightPromise = null;
let snapshotHydrationCooldownUntil = 0;
let snapshotHydrationCooldownError = null;
const PENDING_SYNC_DELAY_MS = 1200;
const SNAPSHOT_HYDRATION_COOLDOWN_MS = 60 * 1000;
const SNAPSHOT_HYDRATION_DEGRADED_MESSAGE =
  'Cloud snapshot temporarily unavailable. Using local progress.';
const SNAPSHOT_HYDRATION_TRANSIENT_PATTERNS = ['resource exhausted', 'fc invoke failed'];

function getNow() {
  const candidate = Number(progressSyncDeps.now());
  return Number.isFinite(candidate) ? candidate : Date.now();
}

function buildLocalOnlyResult(message = 'Current session is local-only.') {
  return {
    ok: false,
    code: 'CLOUD_SYNC_UNAVAILABLE',
    message,
    stats: progressSyncDeps.wordRepo.getProgressStats(),
  };
}

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

function clearPendingSyncTimer() {
  if (!pendingSyncTimer) return;
  clearTimeout(pendingSyncTimer);
  pendingSyncTimer = null;
}

function clearSnapshotHydrationCooldown() {
  snapshotHydrationCooldownUntil = 0;
  snapshotHydrationCooldownError = null;
}

function buildSkippedSyncResult(message = 'No pending progress to sync.') {
  return {
    ok: true,
    skipped: true,
    message,
    stats: progressSyncDeps.wordRepo.getProgressStats(),
    syncedCount: 0,
  };
}

function getSnapshotHydrationErrorText(error) {
  return [error?.code, error?.rawMessage, error?.message].filter(Boolean).join(' ').toLowerCase();
}

function isTransientSnapshotHydrationError(error) {
  const errorText = getSnapshotHydrationErrorText(error);
  return SNAPSHOT_HYDRATION_TRANSIENT_PATTERNS.some((pattern) => errorText.includes(pattern));
}

function rememberSnapshotHydrationCooldown(error) {
  snapshotHydrationCooldownUntil = getNow() + SNAPSHOT_HYDRATION_COOLDOWN_MS;
  snapshotHydrationCooldownError = {
    code: String(error?.code || 'CLOUD_FUNCTION_ERROR').trim() || 'CLOUD_FUNCTION_ERROR',
    message: SNAPSHOT_HYDRATION_DEGRADED_MESSAGE,
    rawMessage: String(error?.rawMessage || error?.message || '').trim(),
  };
  return snapshotHydrationCooldownUntil;
}

function isSnapshotHydrationCooldownActive(now = getNow()) {
  return snapshotHydrationCooldownUntil > Number(now || 0);
}

function buildDegradedHydrationResult(error = snapshotHydrationCooldownError) {
  const source = error && typeof error === 'object' ? error : {};
  return {
    ok: false,
    degraded: true,
    code: String(source.code || 'CLOUD_FUNCTION_ERROR').trim() || 'CLOUD_FUNCTION_ERROR',
    message: String(source.message || SNAPSHOT_HYDRATION_DEGRADED_MESSAGE).trim(),
    rawMessage: String(source.rawMessage || '').trim(),
    retryAt: snapshotHydrationCooldownUntil,
    stats: progressSyncDeps.wordRepo.getProgressStats(),
  };
}

function normalizeHydrationIssue(input) {
  if (!input || input.ok === true) return null;

  if (input.degraded) {
    return { ...input };
  }

  if (input instanceof Error) {
    return {
      ok: false,
      degraded: true,
      code: String(input.code || 'CLOUD_FUNCTION_ERROR').trim() || 'CLOUD_FUNCTION_ERROR',
      message: String(input.message || SNAPSHOT_HYDRATION_DEGRADED_MESSAGE).trim(),
      rawMessage: String(input.rawMessage || '').trim(),
    };
  }

  return {
    ok: false,
    degraded: true,
    code: String(input.code || 'CLOUD_FUNCTION_ERROR').trim() || 'CLOUD_FUNCTION_ERROR',
    message: String(input.message || SNAPSHOT_HYDRATION_DEGRADED_MESSAGE).trim(),
    rawMessage: String(input.rawMessage || '').trim(),
  };
}

async function performSyncProgressToCloud(options = {}) {
  const { resetAll = false } = options;
  if (!progressSyncDeps.authService.isLoggedIn()) {
    return buildLocalOnlyResult('No logged-in user.');
  }

  if (!progressSyncDeps.authService.isCloudLinked()) {
    return buildLocalOnlyResult(
      'Current session is using local WeChat login. Cloud sync will be available after uniCloud is configured.',
    );
  }

  const payload = progressSyncDeps.wordRepo.getProgressEntriesForSync();
  const syncResult = await progressSyncDeps.callCloudFunction(
    'syncProgress',
    {
      resetAll,
      entries: payload.entries,
      activityDates: payload.activityDates,
    },
    { requiresAuth: true },
  );

  progressSyncDeps.authService.updateSessionSyncTime(getNow());
  return {
    ok: true,
    stats: syncResult.stats || progressSyncDeps.wordRepo.getProgressStats(),
    syncedCount: Number(syncResult.syncedCount || payload.entries.length),
  };
}

export async function hydrateProgressFromCloud(options = {}) {
  const { force = false } = options;
  if (!progressSyncDeps.authService.isLoggedIn()) {
    return buildLocalOnlyResult('No logged-in user.');
  }

  if (!progressSyncDeps.authService.isCloudLinked()) {
    return buildLocalOnlyResult(
      'Current session is using local WeChat login. Cloud sync will be available after uniCloud is configured.',
    );
  }

  if (hydrationPromise) {
    return hydrationPromise;
  }

  if (!force && isSnapshotHydrationCooldownActive()) {
    return buildDegradedHydrationResult();
  }

  hydrationPromise = progressSyncDeps.authService
    .fetchUserSnapshot()
    .then((snapshot) => {
      const normalized = normalizeSnapshot(snapshot);
      progressSyncDeps.wordRepo.replaceProgressMap(normalized.progressMap, {
        mergeByUpdatedAt: true,
      });
      progressSyncDeps.wordRepo.replaceLearningActivity(normalized.activityDates);
      downloadService.applySnapshotDownloadBenefits(snapshot);
      clearSnapshotHydrationCooldown();
      const stats = normalized.stats || progressSyncDeps.wordRepo.getProgressStats();
      progressSyncDeps.authService.updateSessionSyncTime(getNow());
      return {
        ok: true,
        stats,
        user: snapshot.user,
        downloadBenefits: snapshot.downloadBenefits || null,
      };
    })
    .catch((error) => {
      if (isTransientSnapshotHydrationError(error)) {
        rememberSnapshotHydrationCooldown(error);
        return buildDegradedHydrationResult();
      }

      clearSnapshotHydrationCooldown();
      throw error;
    })
    .finally(() => {
      hydrationPromise = null;
    });

  return hydrationPromise;
}

export async function initializeLearningSessionData() {
  let hydrationIssue = null;

  if (progressSyncDeps.authService.isCloudLinked()) {
    try {
      const hydrationResult = await hydrateProgressFromCloud();
      hydrationIssue = normalizeHydrationIssue(hydrationResult);
    } catch (error) {
      hydrationIssue = normalizeHydrationIssue(error);
    }
  }

  const roots = await progressSyncDeps.wordRepo.listRoots();
  return {
    roots,
    hydrationIssue,
  };
}

export function schedulePendingProgressSync(options = {}) {
  const { delayMs = PENDING_SYNC_DELAY_MS } = options;
  if (!progressSyncDeps.authService.isCloudLinked()) {
    return buildLocalOnlyResult(
      'Current session is using local WeChat login. Progress has been saved locally.',
    );
  }

  pendingSyncRequested = true;
  clearPendingSyncTimer();
  pendingSyncTimer = setTimeout(
    () => {
      flushPendingProgressSync({ reason: 'debounced' }).catch((error) => {
        console.error('Failed to flush pending progress sync:', error);
      });
    },
    Math.max(0, Number(delayMs || 0)),
  );

  return {
    ok: true,
    scheduled: true,
    stats: progressSyncDeps.wordRepo.getProgressStats(),
  };
}

export async function flushPendingProgressSync(options = {}) {
  const { reason = '', resetAll = false } = options;
  clearPendingSyncTimer();

  if (resetAll) {
    pendingSyncRequested = false;
    return syncProgressToCloud({ resetAll: true, reason });
  }

  if (syncInFlightPromise) {
    await syncInFlightPromise.catch(() => null);
  }

  if (!pendingSyncRequested) {
    return buildSkippedSyncResult(
      reason ? `No pending progress to sync for ${reason}.` : 'No pending progress to sync.',
    );
  }

  pendingSyncRequested = false;
  syncInFlightPromise = performSyncProgressToCloud()
    .catch((error) => {
      pendingSyncRequested = true;
      throw error;
    })
    .finally(() => {
      syncInFlightPromise = null;
    });

  return syncInFlightPromise;
}

export async function syncProgressToCloud(options = {}) {
  const { resetAll = false } = options;
  clearPendingSyncTimer();
  pendingSyncRequested = false;

  if (syncInFlightPromise) {
    await syncInFlightPromise.catch(() => null);
  }

  syncInFlightPromise = performSyncProgressToCloud({ resetAll }).finally(() => {
    syncInFlightPromise = null;
  });
  return syncInFlightPromise;
}

export async function enqueueWordForReviewAndSync(wordId, options = {}) {
  const word = await progressSyncDeps.wordRepo.enqueueWordForReview(wordId, options);
  if (word && progressSyncDeps.authService.isCloudLinked()) {
    schedulePendingProgressSync();
  }
  return word;
}

export async function submitReviewResultAndSync(wordId, result) {
  const word = await progressSyncDeps.wordRepo.submitReviewResult(wordId, result);
  if (word && progressSyncDeps.authService.isCloudLinked()) {
    await syncProgressToCloud();
  }
  return word;
}

export async function markWordStatusAndSync(wordId, status) {
  progressSyncDeps.wordRepo.setWordStatus(wordId, status);
  if (!progressSyncDeps.authService.isCloudLinked()) {
    return buildLocalOnlyResult(
      'Current session is using local WeChat login. Progress has been saved locally.',
    );
  }
  return syncProgressToCloud();
}

export async function clearProgressAndSync() {
  progressSyncDeps.wordRepo.clearProgress({ clearActivity: true });
  if (!progressSyncDeps.authService.isCloudLinked()) {
    return buildLocalOnlyResult(
      'Current session is using local WeChat login. Progress has been cleared locally.',
    );
  }
  return syncProgressToCloud({ resetAll: true });
}

export function getLocalProgressStats() {
  return progressSyncDeps.wordRepo.getProgressStats();
}

export const __TEST_ONLY__ = {
  getSnapshotHydrationState() {
    return {
      cooldownUntil: snapshotHydrationCooldownUntil,
      error: snapshotHydrationCooldownError ? { ...snapshotHydrationCooldownError } : null,
    };
  },
  isTransientSnapshotHydrationError,
  resetState() {
    hydrationPromise = null;
    clearPendingSyncTimer();
    pendingSyncRequested = false;
    syncInFlightPromise = null;
    clearSnapshotHydrationCooldown();
    progressSyncDeps = { ...DEFAULT_PROGRESS_SYNC_DEPS };
  },
  setDeps(overrides = {}) {
    progressSyncDeps = {
      ...progressSyncDeps,
      ...(overrides && typeof overrides === 'object' ? overrides : {}),
    };
  },
};

export default {
  __TEST_ONLY__,
  clearProgressAndSync,
  enqueueWordForReviewAndSync,
  flushPendingProgressSync,
  getLocalProgressStats,
  hydrateProgressFromCloud,
  initializeLearningSessionData,
  markWordStatusAndSync,
  schedulePendingProgressSync,
  submitReviewResultAndSync,
  syncProgressToCloud,
};
