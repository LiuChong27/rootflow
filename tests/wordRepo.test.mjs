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

test('getRootBranch returns complete direct children and words for deep root chains', async () => {
  const acBranch = await wordRepo.getRootBranch('ac');
  assert.equal(acBranch.children.length, acBranch.totalChildren);
  assert.equal(acBranch.words.length, acBranch.totalWords);
  assert.equal(
    acBranch.children.some((item) => item.rootId === 'acrobatics'),
    true,
  );

  const acrobaticsBranch = await wordRepo.getRootBranch('acrobatics');
  assert.equal(acrobaticsBranch.children.length, acrobaticsBranch.totalChildren);
  assert.equal(
    acrobaticsBranch.children.some((item) => item.rootId === 'acrobatic'),
    true,
  );

  const architectBranch = await wordRepo.getRootBranch('architect');
  assert.equal(architectBranch.children.length, architectBranch.totalChildren);
  assert.equal(
    architectBranch.children.some((item) => item.rootId === 'architecture'),
    true,
  );
  assert.equal(
    architectBranch.children.some((item) => item.rootId === 'architectural'),
    true,
  );
});

test('getSeedMindTree returns full branch previews without more-pagination truncation', async () => {
  const tree = await wordRepo.getSeedMindTree('a');
  const otherBranch = tree.branches.find((item) => item.rootId === 'a-other');

  assert.ok(otherBranch);
  assert.equal(otherBranch.previewChildren.length, otherBranch.totalChildren);
  assert.equal(otherBranch.previewWords.length, otherBranch.totalWords);
  assert.equal(
    otherBranch.previewChildren.some((item) => item.rootId === 'ac'),
    true,
  );
  assert.equal(
    otherBranch.previewChildren.some((item) => item.rootId === 'arch'),
    true,
  );
});
