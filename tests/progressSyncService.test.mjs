import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.uni = {
  _storage: Object.create(null),
  getStorageSync(key) {
    return this._storage[key];
  },
  setStorageSync(key, value) {
    this._storage[key] = value;
  },
  removeStorageSync(key) {
    delete this._storage[key];
  },
};

const progressSyncModule = await import('../services/progressSyncService.js');
const { __TEST_ONLY__, hydrateProgressFromCloud, initializeLearningSessionData } =
  progressSyncModule;

function resetStorage() {
  globalThis.uni._storage = Object.create(null);
}

test('hydrateProgressFromCloud degrades on resource exhaustion and reuses cooldown', async () => {
  resetStorage();
  __TEST_ONLY__.resetState();

  let now = 10_000;
  let fetchUserSnapshotCalls = 0;
  let replaceProgressMapCalls = 0;
  let replaceLearningActivityCalls = 0;

  __TEST_ONLY__.setDeps({
    now: () => now,
    authService: {
      isLoggedIn: () => true,
      isCloudLinked: () => true,
      fetchUserSnapshot: async () => {
        fetchUserSnapshotCalls += 1;
        const error = new Error('FC invoke failed, resource exhausted.');
        error.code = 'CLOUD_FUNCTION_ERROR';
        throw error;
      },
      updateSessionSyncTime: () => {},
    },
    wordRepo: {
      getProgressStats: () => ({ masteredWords: 3 }),
      replaceProgressMap: () => {
        replaceProgressMapCalls += 1;
      },
      replaceLearningActivity: () => {
        replaceLearningActivityCalls += 1;
      },
    },
  });

  const firstResult = await hydrateProgressFromCloud();
  assert.equal(firstResult.ok, false);
  assert.equal(firstResult.degraded, true);
  assert.equal(firstResult.code, 'CLOUD_FUNCTION_ERROR');
  assert.equal(firstResult.rawMessage, 'FC invoke failed, resource exhausted.');
  assert.equal(fetchUserSnapshotCalls, 1);
  assert.equal(replaceProgressMapCalls, 0);
  assert.equal(replaceLearningActivityCalls, 0);
  assert.ok(__TEST_ONLY__.getSnapshotHydrationState().cooldownUntil > now);

  now += 5_000;
  const secondResult = await hydrateProgressFromCloud();
  assert.equal(secondResult.ok, false);
  assert.equal(secondResult.degraded, true);
  assert.equal(fetchUserSnapshotCalls, 1);
});

test('hydrateProgressFromCloud retries when forced even during cooldown', async () => {
  resetStorage();
  __TEST_ONLY__.resetState();

  let now = 50_000;
  let fetchUserSnapshotCalls = 0;
  let lastProgressMap = null;
  let lastActivityDates = null;
  let syncUpdates = 0;

  __TEST_ONLY__.setDeps({
    now: () => now,
    authService: {
      isLoggedIn: () => true,
      isCloudLinked: () => true,
      fetchUserSnapshot: async () => {
        fetchUserSnapshotCalls += 1;
        if (fetchUserSnapshotCalls === 1) {
          const error = new Error('FC invoke failed, resource exhausted.');
          error.code = 'CLOUD_FUNCTION_ERROR';
          throw error;
        }
        return {
          user: { userId: 'cloud-user-1' },
          progressMap: {
            author: {
              status: 'mastered',
              updatedAt: 123,
            },
          },
          activityDates: ['2026-04-22'],
          stats: { masteredWords: 1 },
        };
      },
      updateSessionSyncTime: () => {
        syncUpdates += 1;
      },
    },
    wordRepo: {
      getProgressStats: () => ({ masteredWords: 0 }),
      replaceProgressMap: (progressMap) => {
        lastProgressMap = progressMap;
      },
      replaceLearningActivity: (activityDates) => {
        lastActivityDates = activityDates;
      },
    },
  });

  const degradedResult = await hydrateProgressFromCloud();
  assert.equal(degradedResult.degraded, true);
  assert.equal(fetchUserSnapshotCalls, 1);

  now += 1_000;
  const successfulResult = await hydrateProgressFromCloud({ force: true });
  assert.equal(successfulResult.ok, true);
  assert.equal(fetchUserSnapshotCalls, 2);
  assert.deepEqual(lastProgressMap, {
    author: {
      status: 'mastered',
      updatedAt: 123,
    },
  });
  assert.deepEqual(lastActivityDates, ['2026-04-22']);
  assert.equal(syncUpdates, 1);
  assert.equal(__TEST_ONLY__.getSnapshotHydrationState().cooldownUntil, 0);
});

test('initializeLearningSessionData still loads roots when cloud hydration degrades', async () => {
  resetStorage();
  __TEST_ONLY__.resetState();

  let fetchUserSnapshotCalls = 0;
  let listRootsCalls = 0;
  const roots = [{ rootId: 'author', rootLevel: 1, descendantWordCount: 2 }];

  __TEST_ONLY__.setDeps({
    now: () => 10_000,
    authService: {
      isLoggedIn: () => true,
      isCloudLinked: () => true,
      fetchUserSnapshot: async () => {
        fetchUserSnapshotCalls += 1;
        const error = new Error('FC invoke failed, resource exhausted.');
        error.code = 'CLOUD_FUNCTION_ERROR';
        throw error;
      },
      updateSessionSyncTime: () => {},
    },
    wordRepo: {
      getProgressStats: () => ({ masteredWords: 0 }),
      replaceProgressMap: () => {},
      replaceLearningActivity: () => {},
      listRoots: async () => {
        listRootsCalls += 1;
        return roots;
      },
    },
  });

  const result = await initializeLearningSessionData();
  assert.equal(fetchUserSnapshotCalls, 1);
  assert.equal(listRootsCalls, 1);
  assert.deepEqual(result.roots, roots);
  assert.equal(result.hydrationIssue.degraded, true);
  assert.equal(result.hydrationIssue.code, 'CLOUD_FUNCTION_ERROR');
});

test('initializeLearningSessionData keeps local loading errors visible', async () => {
  resetStorage();
  __TEST_ONLY__.resetState();

  const localError = new Error('Root data unavailable.');

  __TEST_ONLY__.setDeps({
    authService: {
      isCloudLinked: () => false,
    },
    wordRepo: {
      listRoots: async () => {
        throw localError;
      },
    },
  });

  await assert.rejects(() => initializeLearningSessionData(), localError);
});
