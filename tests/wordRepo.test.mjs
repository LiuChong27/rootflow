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

function resetStorage() {
  globalThis.uni._storage = Object.create(null);
}

async function withMockedNow(now, callback) {
  const realNow = Date.now;
  Date.now = () => now;
  try {
    return await callback();
  } finally {
    Date.now = realNow;
  }
}

test('enqueueWordForReview creates a schedulable learning entry', async () => {
  resetStorage();

  await withMockedNow(1_000, async () => {
    const word = await wordRepo.enqueueWordForReview('author');
    const snapshot = wordRepo.getProgressMapSnapshot();

    assert.equal(word.id, 'author');
    assert.equal(snapshot.author.status, wordRepo.STATUS_LEARNING);
    assert.equal(snapshot.author.stage, 0);
    assert.equal(snapshot.author.introducedAt, 1_000);
    assert.equal(snapshot.author.nextReviewAt, 1_000);
    assert.equal(snapshot.author.correctCount, 0);
    assert.equal(snapshot.author.lapseCount, 0);
    assert.equal(wordRepo.getLastLearningRoot(), word.rootId);
  });
});

test('submitReviewResult advances review stages with fixed intervals', async () => {
  resetStorage();

  await withMockedNow(1_000, async () => {
    await wordRepo.enqueueWordForReview('author');
  });

  await withMockedNow(2_000, async () => {
    const word = await wordRepo.submitReviewResult('author', {
      challengeType: 'meaning_choice',
      correct: true,
    });
    assert.equal(word.stage, 1);
    assert.equal(word.status, wordRepo.STATUS_REVIEW);
    assert.equal(word.nextReviewAt, 2_000 + 24 * 60 * 60 * 1000);
  });

  await withMockedNow(3_000, async () => {
    await wordRepo.submitReviewResult('author', { challengeType: 'spelling_input', correct: true });
  });

  await withMockedNow(4_000, async () => {
    await wordRepo.submitReviewResult('author', {
      challengeType: 'listening_input',
      correct: true,
    });
  });

  await withMockedNow(5_000, async () => {
    const word = await wordRepo.submitReviewResult('author', {
      challengeType: 'meaning_choice',
      correct: true,
    });
    assert.equal(word.stage, 4);
    assert.equal(word.status, wordRepo.STATUS_MASTERED);
    assert.equal(word.nextReviewAt, 5_000 + 14 * 24 * 60 * 60 * 1000);
  });

  await withMockedNow(6_000, async () => {
    const word = await wordRepo.submitReviewResult('author', {
      challengeType: 'meaning_choice',
      correct: true,
    });
    assert.equal(word.stage, 4);
    assert.equal(word.status, wordRepo.STATUS_MASTERED);
    assert.equal(word.nextReviewAt, 6_000 + 30 * 24 * 60 * 60 * 1000);
    assert.equal(word.correctCount, 5);
  });
});

test('submitReviewResult falls back one stage and records lapses on wrong answers', async () => {
  resetStorage();

  wordRepo.replaceProgressMap(
    {
      author: {
        status: wordRepo.STATUS_REVIEW,
        stage: 2,
        introducedAt: 100,
        lastReviewedAt: 200,
        nextReviewAt: 300,
        updatedAt: 300,
        lapseCount: 0,
        correctCount: 2,
      },
    },
    { mergeByUpdatedAt: false },
  );

  await withMockedNow(500, async () => {
    const word = await wordRepo.submitReviewResult('author', {
      challengeType: 'spelling_input',
      correct: false,
    });
    assert.equal(word.stage, 1);
    assert.equal(word.status, wordRepo.STATUS_REVIEW);
    assert.equal(word.lapseCount, 1);
    assert.equal(word.nextReviewAt, 500 + 24 * 60 * 60 * 1000);
  });
});

test('replaceProgressMap migrates legacy entries into the new progress model', () => {
  resetStorage();

  wordRepo.replaceProgressMap(
    {
      author: {
        status: wordRepo.STATUS_MASTERED,
        updatedAt: 20,
      },
      authority: {
        status: wordRepo.STATUS_NEW,
        updatedAt: 10,
      },
    },
    { mergeByUpdatedAt: false },
  );

  const snapshot = wordRepo.getProgressMapSnapshot();
  assert.equal(snapshot.author.status, wordRepo.STATUS_MASTERED);
  assert.equal(snapshot.author.stage, 4);
  assert.equal(snapshot.author.nextReviewAt, 20);
  assert.equal(snapshot.authority.status, wordRepo.STATUS_NEW);
  assert.equal(snapshot.authority.stage, 0);
});

test('getDueReviewQueue sorts by earliest nextReviewAt and older updates first', async () => {
  resetStorage();

  wordRepo.replaceProgressMap(
    {
      author: {
        status: wordRepo.STATUS_REVIEW,
        stage: 1,
        introducedAt: 1,
        lastReviewedAt: 1,
        nextReviewAt: 50,
        updatedAt: 10,
        lapseCount: 0,
        correctCount: 1,
      },
      authority: {
        status: wordRepo.STATUS_REVIEW,
        stage: 1,
        introducedAt: 1,
        lastReviewedAt: 1,
        nextReviewAt: 50,
        updatedAt: 5,
        lapseCount: 0,
        correctCount: 1,
      },
      authorize: {
        status: wordRepo.STATUS_REVIEW,
        stage: 1,
        introducedAt: 1,
        lastReviewedAt: 1,
        nextReviewAt: 80,
        updatedAt: 1,
        lapseCount: 0,
        correctCount: 1,
      },
    },
    { mergeByUpdatedAt: false },
  );

  const queue = await withMockedNow(100, () => wordRepo.getDueReviewQueue());
  assert.deepEqual(
    queue.map((item) => item.id),
    ['authority', 'author', 'authorize'],
  );
});

test('getTodayReviewOverview reports due, overdue, completed, and scheduled counts', async () => {
  resetStorage();

  const now = new Date('2026-04-15T10:30:00.000Z').getTime();
  const todayStartDate = new Date(now);
  todayStartDate.setHours(0, 0, 0, 0);
  const todayStart = todayStartDate.getTime();

  wordRepo.replaceProgressMap(
    {
      author: {
        status: wordRepo.STATUS_REVIEW,
        stage: 1,
        introducedAt: 1,
        lastReviewedAt: 0,
        nextReviewAt: todayStart - 2 * 60 * 60 * 1000,
        updatedAt: todayStart - 2 * 60 * 60 * 1000,
        lapseCount: 0,
        correctCount: 1,
      },
      authority: {
        status: wordRepo.STATUS_MASTERED,
        stage: 4,
        introducedAt: 1,
        lastReviewedAt: todayStart + 30 * 60 * 1000,
        nextReviewAt: todayStart + 2 * 60 * 60 * 1000,
        updatedAt: todayStart + 30 * 60 * 1000,
        lapseCount: 0,
        correctCount: 4,
      },
      authorize: {
        status: wordRepo.STATUS_REVIEW,
        stage: 2,
        introducedAt: 1,
        lastReviewedAt: todayStart - 24 * 60 * 60 * 1000,
        nextReviewAt: now + 4 * 60 * 60 * 1000,
        updatedAt: todayStart - 24 * 60 * 60 * 1000,
        lapseCount: 0,
        correctCount: 2,
      },
    },
    { mergeByUpdatedAt: false },
  );

  wordRepo.setLastLearningRoot('author');

  const overview = await withMockedNow(now, () => wordRepo.getTodayReviewOverview());
  assert.equal(overview.dueCount, 2);
  assert.equal(overview.overdueCount, 1);
  assert.equal(overview.doneCount, 1);
  assert.equal(overview.totalCount, 3);
  assert.equal(overview.lastLearningRootId, 'author');
  assert.equal(overview.scheduledWords, 3);
});

test('getRootBranch returns complete direct children and words for deep root chains', async () => {
  resetStorage();

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
  resetStorage();

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
