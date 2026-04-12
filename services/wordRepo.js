import rootsHierarchyRaw from '../data/raw/roots-hierarchy-fixed.json';
import wordsFlatRaw from '../data/raw/words-flat-fixed.json';

const WORD_PROGRESS_STORAGE_KEY = 'rf_word_progress_v1';
const LEARNING_ACTIVITY_STORAGE_KEY = 'rf_learning_activity_v1';
const STATUS_NEW = 'new';
const STATUS_MASTERED = 'mastered';
const RAW_DATA_ERROR_CODE = 'RAW_DATA_UNAVAILABLE';

const ROOT_TYPE_PRIORITY = {
  section: 0,
  prefix: 1,
  root: 2,
  branch: 3,
  category: 4,
};

let memoryProgressFallback = {};
let rawDataCache = null;

function canUseUniStorage() {
  return (
    typeof uni !== 'undefined' &&
    typeof uni.getStorageSync === 'function' &&
    typeof uni.setStorageSync === 'function'
  );
}

function normalizeWordId(input) {
  return String(input || '')
    .trim()
    .toLowerCase();
}

function normalizeStatus(status) {
  return status === STATUS_MASTERED ? STATUS_MASTERED : STATUS_NEW;
}

function getProgressMap() {
  if (!canUseUniStorage()) {
    return { ...memoryProgressFallback };
  }

  const cached = uni.getStorageSync(WORD_PROGRESS_STORAGE_KEY);
  if (!cached || typeof cached !== 'object') {
    return {};
  }
  return { ...cached };
}

function saveProgressMap(map) {
  if (!canUseUniStorage()) {
    memoryProgressFallback = { ...map };
    return;
  }
  uni.setStorageSync(WORD_PROGRESS_STORAGE_KEY, map);
}

function getLearningActivityMap() {
  if (!canUseUniStorage()) {
    return {};
  }

  const cached = uni.getStorageSync(LEARNING_ACTIVITY_STORAGE_KEY);
  if (!cached || typeof cached !== 'object') {
    return {};
  }
  return { ...cached };
}

function saveLearningActivityMap(map) {
  if (!canUseUniStorage()) {
    return;
  }
  uni.setStorageSync(LEARNING_ACTIVITY_STORAGE_KEY, map);
}

function toDayKey(input) {
  const date = input instanceof Date ? input : new Date(input || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function recordLearningActivity(timestamp = Date.now()) {
  const dayKey = toDayKey(timestamp);
  if (!dayKey) return;

  const activityMap = getLearningActivityMap();
  activityMap[dayKey] = Number(activityMap[dayKey] || 0) + 1;
  saveLearningActivityMap(activityMap);
}

function replaceLearningActivity(activityInput) {
  const nextMap = {};
  if (Array.isArray(activityInput)) {
    activityInput.forEach((item) => {
      const dayKey = toDayKey(item);
      if (!dayKey) return;
      nextMap[dayKey] = Number(nextMap[dayKey] || 0) + 1;
    });
  } else if (activityInput && typeof activityInput === 'object') {
    Object.keys(activityInput).forEach((key) => {
      const dayKey = toDayKey(key);
      if (!dayKey) return;
      nextMap[dayKey] = Math.max(1, Number(activityInput[key] || 0));
    });
  }
  saveLearningActivityMap(nextMap);
  return { ...nextMap };
}

function clearLearningActivity() {
  saveLearningActivityMap({});
}

function getLearningActivityDates() {
  return Object.keys(getLearningActivityMap()).sort((a, b) => a.localeCompare(b));
}

function getProgressMapSnapshot() {
  return getProgressMap();
}

function replaceProgressMap(nextMapInput, options = {}) {
  const { mergeByUpdatedAt = true } = options;
  const currentMap = getProgressMap();
  const nextMap = {};
  const sourceMap = nextMapInput && typeof nextMapInput === 'object' ? nextMapInput : {};

  Object.keys(sourceMap).forEach((rawWordId) => {
    const wordId = normalizeWordId(rawWordId);
    if (!wordId) return;
    const currentEntry = currentMap[wordId];
    const incomingEntry = sourceMap[rawWordId] || {};
    const normalizedIncoming = {
      status: normalizeStatus(incomingEntry.status),
      updatedAt: Number(incomingEntry.updatedAt || 0),
    };

    if (!mergeByUpdatedAt || !currentEntry) {
      nextMap[wordId] = normalizedIncoming;
      return;
    }

    const currentUpdatedAt = Number(currentEntry.updatedAt || 0);
    nextMap[wordId] =
      normalizedIncoming.updatedAt >= currentUpdatedAt
        ? normalizedIncoming
        : {
            status: normalizeStatus(currentEntry.status),
            updatedAt: currentUpdatedAt,
          };
  });

  if (mergeByUpdatedAt) {
    Object.keys(currentMap).forEach((wordId) => {
      if (nextMap[wordId]) return;
      nextMap[wordId] = {
        status: normalizeStatus(currentMap[wordId].status),
        updatedAt: Number(currentMap[wordId].updatedAt || 0),
      };
    });
  }

  saveProgressMap(nextMap);
  return { ...nextMap };
}

function getProgressEntriesForSync() {
  const progressMap = getProgressMap();
  const wordToRootMap = ensureRawDataCache().wordToRootIndex.map || {};
  const entries = Object.keys(progressMap)
    .map((wordId) => ({
      wordId,
      status: normalizeStatus(progressMap[wordId].status),
      updatedAt: Number(progressMap[wordId].updatedAt || 0),
      rootId: normalizeWordId(wordToRootMap[wordId] || ''),
    }))
    .filter((item) => item.wordId);

  return {
    entries,
    activityDates: getLearningActivityDates(),
  };
}

function getProgressStats() {
  const progressMap = getProgressMap();
  const wordToRootMap = ensureRawDataCache().wordToRootIndex.map || {};
  const masteredWordIds = Object.keys(progressMap).filter(
    (wordId) => normalizeStatus(progressMap[wordId].status) === STATUS_MASTERED,
  );
  const masteredRootIds = new Set(
    masteredWordIds.map((wordId) => normalizeWordId(wordToRootMap[wordId])).filter(Boolean),
  );
  const activityDates = getLearningActivityDates();
  const today = new Date();
  let streakDays = 0;
  const activitySet = new Set(activityDates);
  for (let cursor = new Date(today); ; cursor.setDate(cursor.getDate() - 1)) {
    const dayKey = toDayKey(cursor);
    if (!activitySet.has(dayKey)) break;
    streakDays += 1;
  }

  return {
    masteredWords: masteredWordIds.length,
    masteredRoots: masteredRootIds.size,
    activityDays: activityDates.length,
    streakDays,
    lastActivityDate: activityDates.length ? activityDates[activityDates.length - 1] : '',
  };
}

function normalizeWord(rawWord) {
  const id = normalizeWordId(rawWord.id || rawWord.wordId || rawWord.word);
  return {
    id,
    word: rawWord.display || rawWord.word || id,
    canonical: rawWord.word || id,
    phonetic: rawWord.phonetic || '',
    translation: rawWord.translation || '',
    sentence: rawWord.sentence || rawWord.example || '',
    tags: Array.isArray(rawWord.tags) ? rawWord.tags : [],
    sourceLabel: rawWord.sourceLabel || '',
    rootId: normalizeWordId(rawWord.rootId || ''),
    rootPath: rawWord.rootPath || '',
    level: typeof rawWord.level === 'number' ? rawWord.level : 1,
    sourceIndex:
      typeof rawWord.sourceIndex === 'number' ? rawWord.sourceIndex : Number.MAX_SAFE_INTEGER,
    status: STATUS_NEW,
  };
}

function getPathSegments(rootPath, fallbackRootId = '') {
  const segments = String(rootPath || '')
    .split('>')
    .map((segment) => normalizeWordId(segment))
    .filter(Boolean);
  if (segments.length) return segments;
  const fallback = normalizeWordId(fallbackRootId);
  return fallback ? [fallback] : [];
}

function getRootTypePriority(type) {
  const normalized = normalizeWordId(type);
  if (Object.prototype.hasOwnProperty.call(ROOT_TYPE_PRIORITY, normalized)) {
    return ROOT_TYPE_PRIORITY[normalized];
  }
  return 99;
}

function getRootSideHint(type) {
  const normalized = normalizeWordId(type);
  if (normalized === 'section' || normalized === 'prefix') {
    return 'right';
  }
  return 'left';
}

function compareGraphRoots(a, b) {
  const typeDiff = getRootTypePriority(a?.type) - getRootTypePriority(b?.type);
  if (typeDiff !== 0) return typeDiff;

  const descendantDiff =
    Number(b?.descendantWordCount || b?.wordCount || 0) -
    Number(a?.descendantWordCount || a?.wordCount || 0);
  if (descendantDiff !== 0) return descendantDiff;

  const levelDiff = Number(a?.rootLevel || 1) - Number(b?.rootLevel || 1);
  if (levelDiff !== 0) return levelDiff;

  return normalizeWordId(a?.rootId).localeCompare(normalizeWordId(b?.rootId));
}

function normalizeRootMetaRecord(rootData) {
  const words = Array.isArray(rootData.words) ? rootData.words : [];
  return {
    rootId: rootData.rootId,
    root: rootData.root || rootData.rootId,
    meaning: rootData.meaning || '',
    descriptionCn: rootData.descriptionCn || '',
    parentRootId: rootData.parentRootId || '',
    rootLevel: typeof rootData.rootLevel === 'number' ? rootData.rootLevel : 1,
    rootPath: rootData.rootPath || rootData.rootId,
    type: rootData.type || 'root',
    notes: rootData.notes || '',
    sourceLabel: rootData.sourceLabel || '',
    tags: Array.isArray(rootData.tags) ? rootData.tags : [],
    sourceIndex:
      typeof rootData.sourceIndex === 'number' ? rootData.sourceIndex : Number.MAX_SAFE_INTEGER,
    sideHint: rootData.sideHint || getRootSideHint(rootData.type),
    wordCount: words.length,
    childCount: 0,
    descendantWordCount: words.length,
    hasChildren: false,
    sampleWords: words
      .slice(0, 3)
      .map((word) => word.word || word.display || word.id)
      .filter(Boolean),
    file: rootData.rootId,
  };
}

function createRawDataUnavailableError(reason) {
  const error = new Error(`Raw data unavailable: ${reason}`);
  error.code = RAW_DATA_ERROR_CODE;
  return error;
}

function assertRawDataHealth(cache) {
  const rootCount = Object.keys(cache.rootMap || {}).length;
  const wordCount = Object.values(cache.rootMap || {}).reduce((sum, root) => {
    const words = Array.isArray(root.words) ? root.words.length : 0;
    return sum + words;
  }, 0);

  if (rootCount === 0) {
    throw createRawDataUnavailableError('rootMap is empty');
  }
  if (wordCount === 0) {
    throw createRawDataUnavailableError('word entries are empty');
  }

  return {
    rootCount,
    wordCount,
  };
}

function cloneRootSummary(meta) {
  if (!meta) return null;
  return {
    rootId: meta.rootId,
    root: meta.root || meta.rootId,
    meaning: meta.meaning || '',
    descriptionCn: meta.descriptionCn || '',
    parentRootId: meta.parentRootId || '',
    rootLevel: typeof meta.rootLevel === 'number' ? meta.rootLevel : 1,
    rootPath: meta.rootPath || meta.rootId,
    type: meta.type || 'root',
    notes: meta.notes || '',
    sourceLabel: meta.sourceLabel || '',
    tags: Array.isArray(meta.tags) ? [...meta.tags] : [],
    sourceIndex: typeof meta.sourceIndex === 'number' ? meta.sourceIndex : Number.MAX_SAFE_INTEGER,
    sideHint: meta.sideHint || getRootSideHint(meta.type),
    wordCount: Number(meta.wordCount || 0),
    childCount: Number(meta.childCount || 0),
    descendantWordCount: Number(meta.descendantWordCount || meta.wordCount || 0),
    hasChildren: Boolean(meta.hasChildren),
    sampleWords: Array.isArray(meta.sampleWords) ? [...meta.sampleWords] : [],
    file: meta.file || meta.rootId,
  };
}

function ensureRawDataCache() {
  if (rawDataCache) return rawDataCache;

  const hierarchyList = Array.isArray(rootsHierarchyRaw?.roots) ? rootsHierarchyRaw.roots : [];
  const wordsList = Array.isArray(wordsFlatRaw) ? wordsFlatRaw : [];

  const rootMap = {};
  hierarchyList.forEach((rawRoot, sourceIndex) => {
    const rootId = normalizeWordId(rawRoot.rootId || rawRoot.rootText || rawRoot.root);
    if (!rootId) return;
    rootMap[rootId] = {
      version: 1,
      rootId,
      root: rawRoot.rootText || rawRoot.root || rawRoot.rootId || rootId,
      meaning: rawRoot.meaningEn || rawRoot.meaning || '',
      descriptionCn: rawRoot.meaningCn || rawRoot.descriptionCn || '',
      updatedAt: '',
      words: [],
      parentRootId: normalizeWordId(rawRoot.parentRootId || ''),
      rootLevel: typeof rawRoot.rootLevel === 'number' ? rawRoot.rootLevel : 1,
      rootPath: rawRoot.rootPath || rootId,
      type: rawRoot.type || 'root',
      notes: rawRoot.notes || '',
      sourceLabel: rawRoot.sourceLabel || '',
      tags: Array.isArray(rawRoot.tags) ? rawRoot.tags : [],
      sourceIndex,
      sideHint: getRootSideHint(rawRoot.type),
    };
  });

  wordsList.forEach((rawWord, sourceIndex) => {
    const rootId = normalizeWordId(rawWord.rootId);
    if (!rootId) return;

    if (!rootMap[rootId]) {
      rootMap[rootId] = {
        version: 1,
        rootId,
        root: rootId,
        meaning: '',
        descriptionCn: '',
        updatedAt: '',
        words: [],
        parentRootId: '',
        rootLevel: 1,
        rootPath: rootId,
        type: 'root',
        notes: '',
        sourceLabel: '',
        tags: [],
        sourceIndex: Number.MAX_SAFE_INTEGER,
        sideHint: getRootSideHint('root'),
      };
    }

    const normalized = normalizeWord({
      ...rawWord,
      sourceIndex,
    });
    if (!normalized.id) return;
    if (!normalized.rootId) {
      normalized.rootId = rootId;
    }
    if (!normalized.rootPath) {
      normalized.rootPath = rootMap[rootId].rootPath || rootId;
    }
    if (!normalized.sourceLabel) {
      normalized.sourceLabel = rootMap[rootId].sourceLabel || '';
    }
    rootMap[rootId].words.push(normalized);
  });

  Object.values(rootMap).forEach((rootData) => {
    rootData.words = rootData.words.sort(
      (a, b) =>
        Number(a.sourceIndex || Number.MAX_SAFE_INTEGER) -
        Number(b.sourceIndex || Number.MAX_SAFE_INTEGER),
    );
  });

  const childRootIdsByParent = {};
  Object.keys(rootMap).forEach((rootId) => {
    childRootIdsByParent[rootId] = [];
  });

  Object.values(rootMap).forEach((rootData) => {
    const parentId = normalizeWordId(rootData.parentRootId);
    if (parentId && childRootIdsByParent[parentId]) {
      childRootIdsByParent[parentId].push(rootData.rootId);
    }
  });

  const descendantWordCountMemo = {};
  function getDescendantWordCount(rootId, chain = new Set()) {
    const normalizedRootId = normalizeWordId(rootId);
    if (!normalizedRootId) return 0;
    if (typeof descendantWordCountMemo[normalizedRootId] === 'number') {
      return descendantWordCountMemo[normalizedRootId];
    }
    if (chain.has(normalizedRootId)) {
      return Number(rootMap[normalizedRootId]?.words?.length || 0);
    }

    const nextChain = new Set(chain);
    nextChain.add(normalizedRootId);

    const ownCount = Number(rootMap[normalizedRootId]?.words?.length || 0);
    const childIds = childRootIdsByParent[normalizedRootId] || [];
    const childCount = childIds.reduce(
      (sum, childId) => sum + getDescendantWordCount(childId, nextChain),
      0,
    );
    const total = ownCount + childCount;
    descendantWordCountMemo[normalizedRootId] = total;
    return total;
  }

  let rootMetaRoots = Object.values(rootMap).map((rootData) => {
    const rootId = normalizeWordId(rootData.rootId);
    const childIds = childRootIdsByParent[rootId] || [];
    const meta = normalizeRootMetaRecord(rootData);
    return {
      ...meta,
      childCount: childIds.length,
      descendantWordCount: getDescendantWordCount(rootId),
      hasChildren: childIds.length > 0,
    };
  });

  const rootMetaMap = {};
  rootMetaRoots.forEach((meta) => {
    rootMetaMap[meta.rootId] = meta;
  });

  const sourceOrderedChildRootIdsByParent = Object.fromEntries(
    Object.keys(childRootIdsByParent).map((parentId) => [
      parentId,
      [...childRootIdsByParent[parentId]],
    ]),
  );

  Object.keys(childRootIdsByParent).forEach((parentId) => {
    childRootIdsByParent[parentId] = childRootIdsByParent[parentId].sort((leftId, rightId) =>
      compareGraphRoots(rootMetaMap[leftId], rootMetaMap[rightId]),
    );
  });

  const rootMetaSourceOrdered = [...rootMetaRoots].sort(
    (left, right) =>
      Number(left.sourceIndex || Number.MAX_SAFE_INTEGER) -
      Number(right.sourceIndex || Number.MAX_SAFE_INTEGER),
  );
  rootMetaRoots = rootMetaRoots.sort(compareGraphRoots);

  const rootMeta = {
    version: 1,
    updatedAt: '',
    roots: rootMetaRoots,
  };

  const categories = {};
  const wordToRoot = {};
  Object.values(rootMap).forEach((rootData) => {
    rootData.words.forEach((word) => {
      wordToRoot[word.id] = rootData.rootId;
      const tags = Array.isArray(word.tags) ? word.tags : [];
      tags.forEach((tag) => {
        const key = normalizeWordId(tag);
        if (!key) return;
        if (!categories[key]) {
          categories[key] = {
            label: key,
            wordIds: new Set(),
            rootIds: new Set(),
          };
        }
        categories[key].wordIds.add(word.id);
        categories[key].rootIds.add(rootData.rootId);
      });
    });
  });

  const categoryFromRaw = {
    version: 1,
    updatedAt: '',
    categories: Object.fromEntries(
      Object.keys(categories)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => [
          key,
          {
            label: categories[key].label,
            wordIds: Array.from(categories[key].wordIds).sort((a, b) => a.localeCompare(b)),
            rootIds: Array.from(categories[key].rootIds).sort((a, b) => a.localeCompare(b)),
          },
        ]),
    ),
  };

  const cache = {
    rootMap,
    rootMeta,
    rootMetaMap,
    childRootIdsByParent,
    sourceOrderedChildRootIdsByParent,
    rootMetaSourceOrdered,
    categoryIndex: categoryFromRaw,
    wordToRootIndex: {
      version: 1,
      updatedAt: '',
      map: wordToRoot,
    },
  };
  assertRawDataHealth(cache);
  rawDataCache = cache;
  return rawDataCache;
}

function getDataSourceHealth() {
  try {
    const cache = ensureRawDataCache();
    const stats = assertRawDataHealth(cache);
    return {
      ok: true,
      mode: 'raw-strict',
      roots: stats.rootCount,
      words: stats.wordCount,
      categories: Object.keys(cache.categoryIndex?.categories || {}).length,
      code: '',
      message: '',
    };
  } catch (error) {
    return {
      ok: false,
      mode: 'raw-strict',
      roots: 0,
      words: 0,
      categories: 0,
      code: error?.code || 'UNKNOWN',
      message: error?.message || 'Unknown raw data error',
    };
  }
}

function applyProgress(words, progressMap) {
  return words.map((word) => {
    const progress = progressMap[word.id];
    if (!progress) return word;
    return {
      ...word,
      status: normalizeStatus(progress.status),
    };
  });
}

async function loadRootData(rootId) {
  const normalizedRootId = normalizeWordId(rootId);
  if (!normalizedRootId) {
    throw new Error('No rootId provided');
  }

  const rawRoot = ensureRawDataCache().rootMap[normalizedRootId];
  if (rawRoot) {
    return rawRoot;
  }
  throw new Error(`No raw root data found for "${normalizedRootId}"`);
}

function getRootMeta(rootId) {
  const normalizedRootId = normalizeWordId(rootId);
  return cloneRootSummary(ensureRawDataCache().rootMetaMap[normalizedRootId]);
}

async function getRoot(rootId, options = {}) {
  const { withProgress = true } = options;
  const rootData = await loadRootData(rootId);
  const words = Array.isArray(rootData.words) ? rootData.words.map(normalizeWord) : [];

  return {
    ...rootData,
    words: withProgress ? applyProgress(words, getProgressMap()) : words,
  };
}

async function getWordsByRoot(rootId, options = {}) {
  const rootData = await getRoot(rootId, options);
  return rootData.words;
}

async function getWordsByCategory(categoryKey, options = {}) {
  const { offset = 0, limit = 50, withProgress = true } = options;
  const normalizedCategoryKey = normalizeWordId(categoryKey);
  const cache = ensureRawDataCache();
  const categories = cache.categoryIndex.categories || {};
  const category = categories[normalizedCategoryKey];
  if (!category) return [];

  const sourceWordIds = Array.isArray(category.wordIds) ? category.wordIds : [];
  const end = limit > 0 ? offset + limit : undefined;
  const pageWordIds = sourceWordIds.slice(offset, end).map(normalizeWordId);
  if (!pageWordIds.length) return [];

  const wordToRootMap = cache.wordToRootIndex.map || {};
  const requiredRootIds = [
    ...new Set(pageWordIds.map((wordId) => wordToRootMap[wordId]).filter(Boolean)),
  ];

  const roots = await Promise.all(
    requiredRootIds.map((rootId) => getRoot(rootId, { withProgress })),
  );

  const flattenedWordMap = {};
  roots.forEach((rootData) => {
    rootData.words.forEach((word) => {
      flattenedWordMap[word.id] = word;
    });
  });

  return pageWordIds.map((wordId) => flattenedWordMap[wordId]).filter(Boolean);
}

function setWordStatus(wordId, status) {
  const normalizedWordId = normalizeWordId(wordId);
  if (!normalizedWordId) return;

  const progressMap = getProgressMap();
  progressMap[normalizedWordId] = {
    status: normalizeStatus(status),
    updatedAt: Date.now(),
  };
  saveProgressMap(progressMap);
  recordLearningActivity();
}

function getWordStatus(wordId) {
  const normalizedWordId = normalizeWordId(wordId);
  if (!normalizedWordId) return STATUS_NEW;

  const progress = getProgressMap()[normalizedWordId];
  return progress ? normalizeStatus(progress.status) : STATUS_NEW;
}

function clearProgress(options = {}) {
  const { clearActivity = true } = options;
  saveProgressMap({});
  if (clearActivity) clearLearningActivity();
}

function listRoots() {
  const roots = ensureRawDataCache().rootMeta.roots || [];
  return roots.map((root) => cloneRootSummary(root));
}

function listCategories() {
  const categories = ensureRawDataCache().categoryIndex.categories || {};
  return Object.keys(categories).map((key) => ({
    key,
    label: categories[key].label || key,
    wordCount: Array.isArray(categories[key].wordIds) ? categories[key].wordIds.length : 0,
    rootCount: Array.isArray(categories[key].rootIds) ? categories[key].rootIds.length : 0,
  }));
}

function listRootSeeds() {
  const counter = {};
  listRoots().forEach((item) => {
    const rootId = normalizeWordId(item.rootId);
    const seed = rootId.slice(0, 1);
    if (!seed || !/^[a-z]$/.test(seed)) return;
    if (!counter[seed]) {
      counter[seed] = {
        seed,
        rootCount: 0,
        wordCount: 0,
      };
    }
    counter[seed].rootCount += 1;
    counter[seed].wordCount += Number(item.wordCount || 0);
  });

  return Object.keys(counter)
    .sort((a, b) => a.localeCompare(b))
    .map((seed) => counter[seed]);
}

function getDirectChildIds(rootId) {
  const normalizedRootId = normalizeWordId(rootId);
  const cache = ensureRawDataCache();
  return Array.isArray(cache.childRootIdsByParent[normalizedRootId])
    ? [...cache.childRootIdsByParent[normalizedRootId]]
    : [];
}

function getSourceOrderedChildIds(rootId) {
  const normalizedRootId = normalizeWordId(rootId);
  const cache = ensureRawDataCache();
  return Array.isArray(cache.sourceOrderedChildRootIdsByParent[normalizedRootId])
    ? [...cache.sourceOrderedChildRootIdsByParent[normalizedRootId]]
    : [];
}

function buildRootSummary(rootId) {
  return cloneRootSummary(ensureRawDataCache().rootMetaMap[normalizeWordId(rootId)]);
}

function buildRootDetail(rootData, summary) {
  if (!rootData && !summary) return null;
  const baseSummary = summary || buildRootSummary(rootData?.rootId);
  return {
    ...(baseSummary || {}),
    rootId: rootData?.rootId || baseSummary?.rootId || '',
    root: rootData?.root || baseSummary?.root || '',
    meaning: rootData?.meaning || baseSummary?.meaning || '',
    descriptionCn: rootData?.descriptionCn || baseSummary?.descriptionCn || '',
    notes: rootData?.notes || baseSummary?.notes || '',
    sourceLabel: rootData?.sourceLabel || baseSummary?.sourceLabel || '',
    tags: Array.isArray(rootData?.tags)
      ? [...rootData.tags]
      : Array.isArray(baseSummary?.tags)
        ? [...baseSummary.tags]
        : [],
    words: Array.isArray(rootData?.words) ? rootData.words : [],
  };
}

async function getSeedOverview(seed, options = {}) {
  const { withProgress = true } = options;
  const normalizedSeed = normalizeWordId(seed);
  if (!normalizedSeed) {
    return {
      seed: '',
      baseRoot: null,
      roots: [],
      totalRoots: 0,
    };
  }

  const baseRoot = await getRoot(normalizedSeed, { withProgress });
  const directChildIds = getDirectChildIds(normalizedSeed);
  const roots = directChildIds.map((rootId) => buildRootSummary(rootId)).filter(Boolean);

  return {
    seed: normalizedSeed,
    baseRoot: buildRootDetail(baseRoot, buildRootSummary(normalizedSeed)),
    roots,
    totalRoots: roots.length,
  };
}

async function getSeedMindTree(seed, options = {}) {
  const { withProgress = true, childLimit = 6, wordLimit = 5 } = options;
  const normalizedSeed = normalizeWordId(seed);
  if (!normalizedSeed) {
    return {
      seed: '',
      baseRoot: null,
      branches: [],
      totalBranches: 0,
    };
  }

  const baseRoot = await getRoot(normalizedSeed, { withProgress });
  const directChildIds = getSourceOrderedChildIds(normalizedSeed);
  const branches = await Promise.all(
    directChildIds.map(async (rootId) => {
      const summary = buildRootSummary(rootId);
      if (!summary) return null;
      const branch = await getRootBranch(rootId, {
        withProgress,
        childOffset: 0,
        childLimit,
        wordOffset: 0,
        wordLimit,
      });

      return {
        ...summary,
        previewChildren: branch.children,
        previewWords: branch.words,
        totalChildren: branch.totalChildren,
        totalWords: branch.totalWords,
        hasMoreChildren: branch.hasMoreChildren,
        hasMoreWords: branch.hasMoreWords,
      };
    }),
  );

  return {
    seed: normalizedSeed,
    baseRoot: buildRootDetail(baseRoot, buildRootSummary(normalizedSeed)),
    branches: branches.filter(Boolean),
    totalBranches: branches.filter(Boolean).length,
  };
}

async function getRootFocus(rootId, options = {}) {
  const { withProgress = true } = options;
  const normalizedRootId = normalizeWordId(rootId);
  if (!normalizedRootId) {
    return {
      root: null,
      path: [],
      parent: null,
      siblings: [],
      children: [],
      totalSiblings: 0,
      totalChildren: 0,
    };
  }

  const focusRoot = await getRoot(normalizedRootId, { withProgress });
  const focusSummary = buildRootSummary(normalizedRootId);
  if (!focusSummary) {
    throw new Error(`No raw root data found for "${normalizedRootId}"`);
  }

  const path = getPathSegments(focusRoot.rootPath || focusSummary.rootPath, normalizedRootId)
    .map((segment) => buildRootSummary(segment))
    .filter(Boolean);
  const parent = focusSummary.parentRootId ? buildRootSummary(focusSummary.parentRootId) : null;
  const siblings = parent
    ? getDirectChildIds(parent.rootId)
        .map((item) => buildRootSummary(item))
        .filter(Boolean)
    : [];
  const children = getDirectChildIds(normalizedRootId)
    .map((item) => buildRootSummary(item))
    .filter(Boolean);

  return {
    root: buildRootDetail(focusRoot, focusSummary),
    path,
    parent,
    siblings,
    children,
    totalSiblings: siblings.length,
    totalChildren: children.length,
  };
}

async function getRootBranch(rootId, options = {}) {
  const {
    withProgress = true,
    childOffset = 0,
    childLimit = 6,
    wordOffset = 0,
    wordLimit = 5,
  } = options;
  const normalizedRootId = normalizeWordId(rootId);
  if (!normalizedRootId) {
    return {
      root: null,
      path: [],
      parent: null,
      siblings: [],
      children: [],
      words: [],
      totalSiblings: 0,
      totalChildren: 0,
      totalWords: 0,
      hasMoreChildren: false,
      hasMoreWords: false,
    };
  }

  const focusRoot = await getRoot(normalizedRootId, { withProgress });
  const focusSummary = buildRootSummary(normalizedRootId);
  if (!focusSummary) {
    throw new Error(`No raw root data found for "${normalizedRootId}"`);
  }

  const safeChildOffset = Math.max(0, Number(childOffset || 0));
  const safeChildLimit = Math.max(0, Number(childLimit || 0));
  const safeWordOffset = Math.max(0, Number(wordOffset || 0));
  const safeWordLimit = Math.max(0, Number(wordLimit || 0));

  const path = getPathSegments(focusRoot.rootPath || focusSummary.rootPath, normalizedRootId)
    .map((segment) => buildRootSummary(segment))
    .filter(Boolean);
  const parent = focusSummary.parentRootId ? buildRootSummary(focusSummary.parentRootId) : null;
  const siblingIds = parent ? getSourceOrderedChildIds(parent.rootId) : [];
  const siblings = siblingIds.map((item) => buildRootSummary(item)).filter(Boolean);

  const allChildren = getSourceOrderedChildIds(normalizedRootId)
    .map((item) => buildRootSummary(item))
    .filter(Boolean);
  const children =
    safeChildLimit > 0 ? allChildren.slice(safeChildOffset, safeChildOffset + safeChildLimit) : [];

  const sourceWords = Array.isArray(focusRoot.words) ? focusRoot.words : [];
  const words =
    safeWordLimit > 0 ? sourceWords.slice(safeWordOffset, safeWordOffset + safeWordLimit) : [];

  return {
    root: buildRootDetail(focusRoot, focusSummary),
    path,
    parent,
    siblings,
    children,
    words,
    totalSiblings: siblings.length,
    totalChildren: allChildren.length,
    totalWords: sourceWords.length,
    childOffset: safeChildOffset,
    childLimit: safeChildLimit,
    wordOffset: safeWordOffset,
    wordLimit: safeWordLimit,
    hasMoreChildren: safeChildOffset + children.length < allChildren.length,
    hasMoreWords: safeWordOffset + words.length < sourceWords.length,
  };
}

async function getRootWords(rootId, options = {}) {
  const { offset = 0, limit = 12, withProgress = true } = options;

  const rootData = await getRoot(rootId, { withProgress });
  const sourceWords = Array.isArray(rootData.words) ? rootData.words : [];
  const safeOffset = Math.max(0, Number(offset || 0));
  const safeLimit = Math.max(0, Number(limit || 0));
  const items = safeLimit > 0 ? sourceWords.slice(safeOffset, safeOffset + safeLimit) : [];

  return {
    rootId: normalizeWordId(rootData.rootId),
    items,
    offset: safeOffset,
    limit: safeLimit,
    total: sourceWords.length,
    hasMore: safeOffset + items.length < sourceWords.length,
  };
}

function getWordPronunciationUrl(wordInput) {
  const source =
    typeof wordInput === 'string'
      ? wordInput
      : wordInput?.canonical || wordInput?.word || wordInput?.id || '';
  const normalized = String(source || '').trim();
  if (!normalized) return '';
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(normalized)}&type=2`;
}

function isFamilyMatch(meta, normalizedBase) {
  const rootId = normalizeWordId(meta.rootId);
  if (!rootId || !normalizedBase) return false;

  if (normalizedBase.length <= 1) {
    return rootId.startsWith(normalizedBase);
  }

  if (rootId === normalizedBase || rootId.startsWith(normalizedBase)) {
    return true;
  }

  const pathSegments = getPathSegments(meta.rootPath || '', meta.rootId);
  return pathSegments.includes(normalizedBase);
}

async function getRootFamily(baseRootId, options = {}) {
  const { withProgress = true, includeEmpty = true, maxBranches = 120 } = options;

  const normalizedBase = normalizeWordId(baseRootId);
  if (!normalizedBase) {
    return {
      baseRootId: '',
      baseRoot: null,
      baseWords: [],
      branches: [],
    };
  }

  const allRoots = listRoots();
  const candidates = allRoots
    .filter((meta) => isFamilyMatch(meta, normalizedBase))
    .sort((a, b) => {
      const levelDiff = Number(a.rootLevel || 1) - Number(b.rootLevel || 1);
      if (levelDiff !== 0) return levelDiff;
      return normalizeWordId(a.rootId).localeCompare(normalizeWordId(b.rootId));
    })
    .slice(0, maxBranches);
  if (!candidates.length) {
    throw new Error(`No raw family data found for "${normalizedBase}"`);
  }

  const exactMeta =
    candidates.find((item) => normalizeWordId(item.rootId) === normalizedBase) ||
    allRoots.find((item) => normalizeWordId(item.rootId) === normalizedBase) ||
    null;

  const normalizedBaseRootId = normalizeWordId(exactMeta?.rootId || normalizedBase);

  const loaded = await Promise.all(
    candidates.map(async (meta) => {
      const rootData = await getRoot(meta.rootId, { withProgress });
      const words = Array.isArray(rootData.words) ? rootData.words : [];
      return {
        rootId: normalizeWordId(rootData.rootId || meta.rootId),
        root: rootData.root || meta.root || meta.rootId,
        meaning: rootData.meaning || meta.meaning || '',
        descriptionCn: rootData.descriptionCn || meta.descriptionCn || '',
        type: rootData.type || meta.type || 'root',
        rootLevel:
          typeof rootData.rootLevel === 'number' ? rootData.rootLevel : meta.rootLevel || 1,
        rootPath: rootData.rootPath || meta.rootPath || meta.rootId,
        parentRootId: rootData.parentRootId || meta.parentRootId || '',
        sourceLabel: rootData.sourceLabel || meta.sourceLabel || '',
        tags: Array.isArray(rootData.tags)
          ? rootData.tags
          : Array.isArray(meta.tags)
            ? meta.tags
            : [],
        words,
        wordCount: words.length,
      };
    }),
  );

  const baseLoaded =
    loaded.find((item) => item.rootId === normalizedBaseRootId) ||
    (exactMeta && normalizedBaseRootId
      ? await getRoot(normalizedBaseRootId, { withProgress })
      : null);

  const baseWords = Array.isArray(baseLoaded?.words) ? baseLoaded.words : [];
  const branches = loaded.filter((item) => {
    if (!item || !item.rootId) return false;
    if (item.rootId === normalizedBaseRootId) return false;
    if (!includeEmpty && (!Array.isArray(item.words) || item.words.length === 0)) return false;
    return true;
  });

  const baseRoot = baseLoaded
    ? {
        rootId: baseLoaded.rootId || normalizedBaseRootId,
        root: baseLoaded.root || exactMeta?.root || normalizedBaseRootId,
        meaning: baseLoaded.meaning || exactMeta?.meaning || '',
        descriptionCn: baseLoaded.descriptionCn || exactMeta?.descriptionCn || '',
        type: baseLoaded.type || exactMeta?.type || 'root',
        rootLevel: baseLoaded.rootLevel || exactMeta?.rootLevel || 1,
        rootPath: baseLoaded.rootPath || exactMeta?.rootPath || normalizedBaseRootId,
        parentRootId: baseLoaded.parentRootId || exactMeta?.parentRootId || '',
        sourceLabel: baseLoaded.sourceLabel || exactMeta?.sourceLabel || '',
        tags: Array.isArray(baseLoaded.tags)
          ? baseLoaded.tags
          : Array.isArray(exactMeta?.tags)
            ? exactMeta.tags
            : [],
      }
    : exactMeta;

  return {
    baseRootId: normalizedBaseRootId,
    baseRoot,
    baseWords,
    branches,
  };
}

export default {
  STATUS_NEW,
  STATUS_MASTERED,
  clearProgress,
  clearLearningActivity,
  getLearningActivityDates,
  getProgressEntriesForSync,
  getProgressMapSnapshot,
  getProgressStats,
  getRoot,
  getRootMeta,
  getRootBranch,
  getRootFocus,
  getRootWords,
  getSeedMindTree,
  getSeedOverview,
  getWordPronunciationUrl,
  getWordStatus,
  getWordsByCategory,
  getWordsByRoot,
  getRootFamily,
  listRootSeeds,
  listCategories,
  listRoots,
  replaceLearningActivity,
  replaceProgressMap,
  setWordStatus,
  getDataSourceHealth,
  RAW_DATA_ERROR_CODE,
};
