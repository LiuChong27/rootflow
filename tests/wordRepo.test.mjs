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

const { default: wordRepo } = await import('../services/wordRepo.js');

test('setWordStatus updates mastered stats and learning streak', () => {
  wordRepo.clearProgress({ clearActivity: true });

  wordRepo.setWordStatus('author', wordRepo.STATUS_MASTERED);
  wordRepo.setWordStatus('authority', wordRepo.STATUS_MASTERED);

  const stats = wordRepo.getProgressStats();
  assert.equal(stats.masteredWords, 2);
  assert.equal(stats.masteredRoots >= 1, true);
  assert.equal(stats.streakDays >= 1, true);
});

test('replaceProgressMap keeps the latest updatedAt when merging', () => {
  wordRepo.clearProgress({ clearActivity: true });

  wordRepo.replaceProgressMap({
    author: {
      status: wordRepo.STATUS_NEW,
      updatedAt: 10,
    },
  });

  wordRepo.replaceProgressMap({
    author: {
      status: wordRepo.STATUS_MASTERED,
      updatedAt: 20,
    },
  });

  const snapshot = wordRepo.getProgressMapSnapshot();
  assert.equal(snapshot.author.status, wordRepo.STATUS_MASTERED);
  assert.equal(snapshot.author.updatedAt, 20);
});
