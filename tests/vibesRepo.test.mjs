import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const { default: vibesRepo } = await import('../services/vibesRepo.js');

const repoRoot = path.resolve('.');
const rawSceneLibrary = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data', 'vibes', 'scene-library.json'), 'utf8'),
);
const expectedSceneIds = [
  'office-comeback',
  'campus-snark',
  'cafeteria-chaos',
  'gaming-rage',
  'social-platform',
  'mom-swears',
];
const expectedSectionsByScene = {
  'office-comeback': ['phrases', 'sarcasm', 'shutdown'],
  'campus-snark': ['phrases', 'sarcasm', 'shutdown'],
  'cafeteria-chaos': ['phrases', 'sarcasm', 'shutdown'],
  'gaming-rage': ['phrases', 'sarcasm', 'shutdown'],
  'social-platform': ['phrases', 'sarcasm', 'shutdown'],
  'mom-swears': ['insults'],
};
const rawSceneEntryCounts = Object.fromEntries(
  Object.entries(rawSceneLibrary.scenes).map(([sceneId, scene]) => [sceneId, scene.entries.length]),
);

function normalizeEnglishText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(leftText, rightText) {
  const left = String(leftText || '');
  const right = String(rightText || '');
  const leftLen = left.length;
  const rightLen = right.length;
  const matrix = Array.from({ length: leftLen + 1 }, () => new Array(rightLen + 1).fill(0));

  for (let i = 0; i <= leftLen; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= rightLen; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= leftLen; i += 1) {
    for (let j = 1; j <= rightLen; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[leftLen][rightLen];
}

function textSimilarity(leftText, rightText) {
  const left = normalizeEnglishText(leftText);
  const right = normalizeEnglishText(rightText);
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  const distance = levenshteinDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length, 1);
}

test('scene library provides entries for every expected scene', () => {
  expectedSceneIds.forEach((sceneId) => {
    assert.ok(rawSceneEntryCounts[sceneId] > 0);
  });
});

test('selected scenes keep half of their raw entries in scene-library', () => {
  assert.equal(rawSceneEntryCounts['office-comeback'], 50);
  assert.equal(rawSceneEntryCounts['campus-snark'], 50);
  assert.equal(rawSceneEntryCounts['cafeteria-chaos'], 50);
  assert.equal(rawSceneEntryCounts['social-platform'], 50);
});

test('vibes repo exposes scene cards backed by scene details', () => {
  const cards = vibesRepo.listSceneCards();

  assert.equal(cards.length, expectedSceneIds.length);
  assert.deepEqual(
    cards.map((item) => item.id),
    expectedSceneIds,
  );

  cards.forEach((card) => {
    assert.ok(card.title);
    assert.ok(card.tagline);
    assert.ok(card.totalCount > 0);
    assert.ok(card.totalCount <= rawSceneEntryCounts[card.id]);
    assert.equal(card.sectionStats.length, expectedSectionsByScene[card.id].length);

    const detail = vibesRepo.getSceneById(card.id);
    assert.ok(detail);
    assert.equal(detail.id, card.id);
    assert.equal(detail.sections.length, expectedSectionsByScene[card.id].length);
    assert.equal(detail.entries.length, card.totalCount);
  });
});

test('scene library dedupes semantically similar crafted entries', () => {
  const cards = vibesRepo.listSceneCards();
  const scenes = cards.map((card) => vibesRepo.getSceneById(card.id));
  const rawTotal = Object.values(rawSceneLibrary.scenes).reduce(
    (count, scene) => count + scene.entries.length,
    0,
  );
  const entries = scenes.flatMap((scene) => scene.entries);
  const craftedEntries = entries.filter((entry) => entry.sourceKind === 'crafted');
  const byType = craftedEntries.reduce((acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  }, {});

  assert.equal(
    rawTotal,
    Object.values(rawSceneLibrary.scenes).reduce((count, scene) => count + scene.entries.length, 0),
  );
  assert.ok(entries.length < rawTotal);
  assert.equal(craftedEntries.length, entries.length);
  assert.equal(byType.phrase, entries.length);

  scenes.forEach((scene) => {
    assert.ok(scene.entries.length > 0);
    assert.ok(scene.entries.length <= rawSceneEntryCounts[scene.id]);
    assert.deepEqual(
      scene.sections.map((section) => section.id),
      expectedSectionsByScene[scene.id],
    );
    scene.sectionStats.forEach((section) => {
      assert.ok(section.count > 0);
    });
  });
});

test('scene details group entries into expected sections', () => {
  const scene = vibesRepo.getSceneById('social-platform');

  assert.ok(scene);
  assert.ok(scene.title);
  assert.ok(scene.intro);
  assert.deepEqual(
    scene.sections.map((section) => section.id),
    expectedSectionsByScene['social-platform'],
  );

  scene.sections.forEach((section) => {
    section.entries.forEach((entry) => {
      assert.equal(entry.section, section.id);
      assert.ok(entry.english);
      assert.ok(entry.chinese);
      assert.ok(entry.sourceSection);
      assert.equal(entry.sourceKind, 'crafted');
    });

    for (let i = 0; i < section.entries.length; i += 1) {
      for (let j = i + 1; j < section.entries.length; j += 1) {
        const similarity = textSimilarity(section.entries[i].english, section.entries[j].english);
        assert.ok(
          similarity < 0.88,
          `${scene.id}/${section.id} keeps near-duplicate English entries: ${section.entries[i].id} vs ${section.entries[j].id}`,
        );
      }
    }
  });
});

test('tone mode configuration supports hard, medium, light and changes kept phrasing', () => {
  const toneOptions = vibesRepo.getToneModeOptions();
  const optionIds = toneOptions.map((option) => option.id);

  assert.deepEqual(optionIds, ['hard', 'medium', 'light']);
  assert.equal(vibesRepo.setToneMode('unknown-mode'), 'medium');
  assert.equal(vibesRepo.getToneMode(), 'medium');
  assert.equal(vibesRepo.setToneMode('hard'), 'hard');
  assert.equal(vibesRepo.getToneMode(), 'hard');

  const hardCards = vibesRepo.listSceneCards({ toneMode: 'hard' });
  const lightCards = vibesRepo.listSceneCards({ toneMode: 'light' });
  assert.equal(hardCards.length, lightCards.length);

  const hasDifferentSelection = hardCards.some((card) => {
    const hardIds = vibesRepo
      .getSceneById(card.id, { toneMode: 'hard' })
      .sections.flatMap((section) => section.entries.map((entry) => entry.id))
      .join(',');
    const lightIds = vibesRepo
      .getSceneById(card.id, { toneMode: 'light' })
      .sections.flatMap((section) => section.entries.map((entry) => entry.id))
      .join(',');
    return hardIds !== lightIds;
  });

  assert.equal(hasDifferentSelection, true);
  vibesRepo.setToneMode('medium');
});

test('vibes pages use independent detail routing instead of the old inline step flow', () => {
  const pagesConfigText = fs
    .readFileSync(path.join(repoRoot, 'pages.json'), 'utf8')
    .replace(/^\uFEFF/, '');
  const pagesConfig = JSON.parse(pagesConfigText);
  const pagePaths = pagesConfig.pages.map((item) => item.path);
  const vibesPageSource = fs.readFileSync(
    path.join(repoRoot, 'pages', 'vibes', 'vibes.vue'),
    'utf8',
  );
  const scenePageSource = fs.readFileSync(
    path.join(repoRoot, 'pages', 'vibes', 'scene.vue'),
    'utf8',
  );

  assert.equal(pagePaths.includes('pages/vibes/scene'), true);
  assert.equal(pagePaths.includes('pages/vibes/favorites'), true);
  assert.match(
    vibesPageSource,
    /navigateToPage\(`\/pages\/vibes\/scene\?id=\$\{targetSceneId\}`\)/,
  );
  assert.match(vibesPageSource, /openFavorites/);
  assert.match(vibesPageSource, /favoriteCount/);
  assert.equal(vibesPageSource.includes('activeSceneId'), false);
  assert.equal(vibesPageSource.includes('currentStep'), false);
  assert.match(scenePageSource, /vibesRepo\.getSceneById/);
  assert.match(scenePageSource, /isLoadingScene/);
  assert.match(scenePageSource, /getSourceKindLabel/);
  assert.match(scenePageSource, /handleEntryTap/);
  assert.match(scenePageSource, /toggleFavorite/);
  assert.match(scenePageSource, /handleEntryTouchEnd/);
  assert.match(scenePageSource, /restoreHiddenEntries/);
  assert.match(scenePageSource, /getDisplayedEntries/);
  assert.match(scenePageSource, /entry-card--promoted/);
});
