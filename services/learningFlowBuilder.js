function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeWordKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function getSectionItemKey(rootId) {
  return `section:${rootId}`;
}

function createWordItem(word, depth, sectionKeys = [], isMemorized = false) {
  return {
    type: 'word',
    key: `word:${word.id}`,
    wordId: word.id,
    rawWord: word,
    word: word.display || word.word || word.id,
    translation: String(word.translation || '').trim() || '暂无释义',
    depth,
    sectionKeys,
    isMemorized,
  };
}

function shouldHideWordFamilyTitleDuplicate(node, directWordCount, hasChildContent) {
  if (!node || !node.root || node.root.type !== 'word-family') return false;
  return hasChildContent || directWordCount > 1;
}

function collectDirectWordItems(
  node,
  depth,
  sectionKeys,
  learnedWordIds,
  memorizedWordIds,
  options = {},
) {
  const directWords = Array.isArray(node?.words) ? node.words : [];
  const normalizedTitle = normalizeWordKey(node?.root?.root || node?.root?.rootId || '');
  const hideTitleDuplicate = shouldHideWordFamilyTitleDuplicate(
    node,
    directWords.length,
    Boolean(options.hasChildContent),
  );
  const seenDisplayKeys = new Set();
  const items = [];

  directWords.forEach((word) => {
    const normalizedDisplay = normalizeWordKey(
      word.display || word.word || word.canonical || word.id,
    );
    const uniqueKey = normalizeText(word.id) || normalizedDisplay;
    if (!uniqueKey) return;
    if (hideTitleDuplicate && normalizedTitle && normalizedDisplay === normalizedTitle) {
      return;
    }
    if (seenDisplayKeys.has(uniqueKey)) {
      return;
    }

    seenDisplayKeys.add(uniqueKey);
    const isMemorized = learnedWordIds.has(word.id);
    if (isMemorized) {
      memorizedWordIds.add(word.id);
    }
    items.push(createWordItem(word, depth, sectionKeys, isMemorized));
  });

  return items;
}

function flattenLearningSnapshotNode(
  node,
  depth,
  learnedWordIds,
  memorizedWordIds,
  parentSectionKeys,
) {
  const childItems = [];
  let descendantWordCount = 0;

  (node.children || []).forEach((child) => {
    const result = flattenLearningSnapshotNode(
      child,
      depth + 1,
      learnedWordIds,
      memorizedWordIds,
      parentSectionKeys.concat(getSectionItemKey(node.root.rootId)),
    );
    if (!result.totalWords) return;
    descendantWordCount += result.totalWords;
    childItems.push(...result.items);
  });

  const sectionKey = getSectionItemKey(node.root.rootId);
  const sectionKeys = parentSectionKeys.concat(sectionKey);
  const directWordItems = collectDirectWordItems(
    node,
    depth,
    sectionKeys,
    learnedWordIds,
    memorizedWordIds,
    { hasChildContent: childItems.length > 0 },
  );
  const displayWordCount = directWordItems.length;
  const totalWords = displayWordCount + descendantWordCount;

  if (!totalWords) {
    return { items: [], totalWords: 0 };
  }

  const items = [
    {
      type: 'section',
      key: sectionKey,
      depth,
      kind: node.root.type || 'root',
      title: node.root.root || node.root.rootId,
      subtitle: String(node.root.meaning || node.root.descriptionCn || '').trim(),
      displayWordCount,
    },
    ...directWordItems,
    ...childItems,
  ];

  return { items, totalWords };
}

export function buildLearningStateFromSnapshot(snapshot, learnedWordIdsInput) {
  if (!snapshot) {
    return {
      learningItems: [],
      memorizedWordIds: new Set(),
      memorizedCount: 0,
      totalWords: 0,
    };
  }

  const learnedWordIds =
    learnedWordIdsInput instanceof Set ? learnedWordIdsInput : new Set(learnedWordIdsInput || []);
  const memorizedWordIds = new Set();
  const learningItems = [];
  const rootWords = collectDirectWordItems(snapshot, 0, [], learnedWordIds, memorizedWordIds, {
    hasChildContent: Array.isArray(snapshot.children) && snapshot.children.length > 0,
  });
  let totalWords = rootWords.length;

  learningItems.push(...rootWords);

  (snapshot.children || []).forEach((child) => {
    const result = flattenLearningSnapshotNode(child, 1, learnedWordIds, memorizedWordIds, []);
    if (!result.totalWords) return;
    totalWords += result.totalWords;
    learningItems.push(...result.items);
  });

  return {
    learningItems,
    memorizedWordIds,
    memorizedCount: memorizedWordIds.size,
    totalWords,
  };
}

export default {
  buildLearningStateFromSnapshot,
};
