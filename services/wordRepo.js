import categoriesRaw from '../data/index/categories.json';
import rootMetaRaw from '../data/index/root-meta.json';
import { ROOT_SHARD_LOADERS, ROOT_TO_SHARD } from '../data/index/root-shards';
import wordToRootRaw from '../data/index/word-to-root.json';

const WORD_PROGRESS_STORAGE_KEY = 'rf_word_progress_v1';
const LEARNING_ACTIVITY_STORAGE_KEY = 'rf_learning_activity_v1';
const LAST_LEARNING_ROOT_STORAGE_KEY = 'rf_last_learning_root_v1';
const PENDING_ROOT_FOCUS_STORAGE_KEY = 'rf_pending_root_focus_v1';
const STATUS_NEW = 'new';
const STATUS_LEARNING = 'learning';
const STATUS_REVIEW = 'review';
const STATUS_MASTERED = 'mastered';
const RAW_DATA_ERROR_CODE = 'RAW_DATA_UNAVAILABLE';
const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30];

const ROOT_TYPE_PRIORITY = {
  section: 0,
  prefix: 1,
  root: 2,
  branch: 3,
  category: 4,
};

let memoryProgressFallback = {};
let memoryLastLearningRootFallback = '';
let memoryPendingRootFocusFallback = '';
let indexCache = null;
let loadedRootCache = Object.create(null);
let loadedWordCache = Object.create(null);
let shardLoadPromises = Object.create(null);
let rootLoadPromises = Object.create(null);

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
  if (
    status === STATUS_NEW ||
    status === STATUS_LEARNING ||
    status === STATUS_REVIEW ||
    status === STATUS_MASTERED
  ) {
    return status;
  }
  return STATUS_NEW;
}

function normalizeStage(stage) {
  const parsed = Number(stage);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(4, Math.round(parsed)));
}

function normalizeTimestamp(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return Number(fallback || 0);
  return parsed;
}

function addDays(timestamp, days) {
  return normalizeTimestamp(timestamp, Date.now()) + Number(days || 0) * 24 * 60 * 60 * 1000;
}

function getStartOfTodayTimestamp(now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isSameDay(left, right = Date.now()) {
  if (!left) return false;
  return getStartOfTodayTimestamp(left) === getStartOfTodayTimestamp(right);
}

function isScheduledProgress(progress) {
  if (!progress) return false;
  const status = normalizeStatus(progress.status);
  return status !== STATUS_NEW && normalizeTimestamp(progress.nextReviewAt) > 0;
}

function getProgressStatusFromStage(stage) {
  if (stage >= 4) return STATUS_MASTERED;
  if (stage >= 1) return STATUS_REVIEW;
  return STATUS_LEARNING;
}

function createEmptyProgressEntry(now = Date.now()) {
  return {
    status: STATUS_NEW,
    stage: 0,
    introducedAt: normalizeTimestamp(now, Date.now()),
    lastReviewedAt: 0,
    nextReviewAt: 0,
    updatedAt: normalizeTimestamp(now, Date.now()),
    lapseCount: 0,
    correctCount: 0,
  };
}

function normalizeProgressEntry(entryInput, options = {}) {
  const { fallbackNow = Date.now() } = options;
  const entry = entryInput && typeof entryInput === 'object' ? entryInput : {};
  const legacyUpdatedAt = normalizeTimestamp(entry.updatedAt, fallbackNow);
  const hasModernFields =
    Object.prototype.hasOwnProperty.call(entry, 'stage') ||
    Object.prototype.hasOwnProperty.call(entry, 'nextReviewAt') ||
    Object.prototype.hasOwnProperty.call(entry, 'lastReviewedAt') ||
    Object.prototype.hasOwnProperty.call(entry, 'introducedAt');

  if (!hasModernFields) {
    const legacyStatus = normalizeStatus(entry.status);
    if (legacyStatus === STATUS_MASTERED) {
      return {
        status: STATUS_MASTERED,
        stage: 4,
        introducedAt: legacyUpdatedAt,
        lastReviewedAt: legacyUpdatedAt,
        nextReviewAt: legacyUpdatedAt,
        updatedAt: legacyUpdatedAt,
        lapseCount: 0,
        correctCount: 0,
      };
    }
    return {
      status: STATUS_NEW,
      stage: 0,
      introducedAt: legacyUpdatedAt || fallbackNow,
      lastReviewedAt: 0,
      nextReviewAt: 0,
      updatedAt: legacyUpdatedAt,
      lapseCount: 0,
      correctCount: 0,
    };
  }

  const stage = normalizeStage(entry.stage);
  const introducedAt = normalizeTimestamp(entry.introducedAt, legacyUpdatedAt || fallbackNow);
  const lastReviewedAt = normalizeTimestamp(entry.lastReviewedAt);
  const nextReviewAt = normalizeTimestamp(entry.nextReviewAt);
  const updatedAt = normalizeTimestamp(entry.updatedAt, legacyUpdatedAt || fallbackNow);
  const lapseCount = Math.max(0, Math.round(normalizeTimestamp(entry.lapseCount)));
  const correctCount = Math.max(0, Math.round(normalizeTimestamp(entry.correctCount)));
  const normalizedStatus = normalizeStatus(entry.status);

  let status = normalizedStatus;
  if (status === STATUS_NEW && isScheduledProgress({ status, nextReviewAt })) {
    status = getProgressStatusFromStage(stage);
  }
  if (status !== STATUS_NEW && !nextReviewAt) {
    status = stage >= 4 ? STATUS_MASTERED : stage > 0 ? STATUS_REVIEW : STATUS_LEARNING;
  }
  if (status === STATUS_NEW && stage > 0) {
    status = getProgressStatusFromStage(stage);
  }
  if (status === STATUS_MASTERED && stage < 4) {
    status = getProgressStatusFromStage(stage);
  }

  return {
    status,
    stage,
    introducedAt,
    lastReviewedAt,
    nextReviewAt,
    updatedAt,
    lapseCount,
    correctCount,
  };
}

function mergeProgressIntoWord(word, progressInput) {
  const progress = progressInput ? normalizeProgressEntry(progressInput) : null;
  if (!progress) {
    return {
      ...word,
      status: STATUS_NEW,
      stage: 0,
      introducedAt: 0,
      lastReviewedAt: 0,
      nextReviewAt: 0,
      updatedAt: 0,
      lapseCount: 0,
      correctCount: 0,
      isInReview: false,
      progress: null,
    };
  }

  return {
    ...word,
    status: progress.status,
    stage: progress.stage,
    introducedAt: progress.introducedAt,
    lastReviewedAt: progress.lastReviewedAt,
    nextReviewAt: progress.nextReviewAt,
    updatedAt: progress.updatedAt,
    lapseCount: progress.lapseCount,
    correctCount: progress.correctCount,
    isInReview: isScheduledProgress(progress),
    progress: { ...progress },
  };
}

function getScheduledReviewState(progressInput, now = Date.now()) {
  const progress = normalizeProgressEntry(progressInput);
  if (!isScheduledProgress(progress)) return STATUS_NEW;
  if (progress.nextReviewAt <= now) {
    return progress.nextReviewAt < getStartOfTodayTimestamp(now) ? 'overdue' : 'due';
  }
  if (progress.status === STATUS_MASTERED || progress.stage >= 4) return STATUS_MASTERED;
  return STATUS_REVIEW;
}

function canStoreRawValue() {
  return (
    typeof uni !== 'undefined' &&
    typeof uni.getStorageSync === 'function' &&
    typeof uni.setStorageSync === 'function' &&
    typeof uni.removeStorageSync === 'function'
  );
}

function getProgressMap() {
  if (!canUseUniStorage()) {
    return Object.keys(memoryProgressFallback).reduce((acc, wordId) => {
      acc[wordId] = normalizeProgressEntry(memoryProgressFallback[wordId]);
      return acc;
    }, {});
  }

  const cached = uni.getStorageSync(WORD_PROGRESS_STORAGE_KEY);
  if (!cached || typeof cached !== 'object') {
    return {};
  }
  return Object.keys(cached).reduce((acc, rawWordId) => {
    const wordId = normalizeWordId(rawWordId);
    if (!wordId) return acc;
    acc[wordId] = normalizeProgressEntry(cached[rawWordId]);
    return acc;
  }, {});
}

function saveProgressMap(map) {
  if (!canUseUniStorage()) {
    memoryProgressFallback = Object.keys(map || {}).reduce((acc, wordId) => {
      const normalizedWordId = normalizeWordId(wordId);
      if (!normalizedWordId) return acc;
      acc[normalizedWordId] = normalizeProgressEntry(map[wordId]);
      return acc;
    }, {});
    return;
  }
  uni.setStorageSync(
    WORD_PROGRESS_STORAGE_KEY,
    Object.keys(map || {}).reduce((acc, wordId) => {
      const normalizedWordId = normalizeWordId(wordId);
      if (!normalizedWordId) return acc;
      acc[normalizedWordId] = normalizeProgressEntry(map[wordId]);
      return acc;
    }, {}),
  );
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

function readSimpleStorageValue(storageKey, fallbackValue = '') {
  if (!canStoreRawValue()) {
    return fallbackValue;
  }
  const value = uni.getStorageSync(storageKey);
  return typeof value === 'undefined' ? fallbackValue : value;
}

function writeSimpleStorageValue(storageKey, value) {
  if (!canStoreRawValue()) return value;
  uni.setStorageSync(storageKey, value);
  return value;
}

function removeSimpleStorageValue(storageKey) {
  if (!canStoreRawValue()) return;
  uni.removeStorageSync(storageKey);
}

function setLastLearningRoot(rootId) {
  const normalizedRootId = normalizeWordId(rootId);
  memoryLastLearningRootFallback = normalizedRootId;
  if (!normalizedRootId) {
    removeSimpleStorageValue(LAST_LEARNING_ROOT_STORAGE_KEY);
    return '';
  }
  writeSimpleStorageValue(LAST_LEARNING_ROOT_STORAGE_KEY, normalizedRootId);
  return normalizedRootId;
}

function getLastLearningRoot() {
  const rawValue = canStoreRawValue()
    ? readSimpleStorageValue(LAST_LEARNING_ROOT_STORAGE_KEY, '')
    : memoryLastLearningRootFallback;
  return normalizeWordId(rawValue);
}

function setPendingRootFocus(rootId) {
  const normalizedRootId = normalizeWordId(rootId);
  memoryPendingRootFocusFallback = normalizedRootId;
  if (!normalizedRootId) {
    removeSimpleStorageValue(PENDING_ROOT_FOCUS_STORAGE_KEY);
    return '';
  }
  writeSimpleStorageValue(PENDING_ROOT_FOCUS_STORAGE_KEY, normalizedRootId);
  return normalizedRootId;
}

function consumePendingRootFocus() {
  const pending = normalizeWordId(
    canStoreRawValue()
      ? readSimpleStorageValue(PENDING_ROOT_FOCUS_STORAGE_KEY, '')
      : memoryPendingRootFocusFallback,
  );
  memoryPendingRootFocusFallback = '';
  removeSimpleStorageValue(PENDING_ROOT_FOCUS_STORAGE_KEY);
  return pending;
}

function replaceProgressMap(nextMapInput, options = {}) {
  const { mergeByUpdatedAt = true } = options;
  const currentMap = getProgressMap();
  const nextMap = {};
  const sourceMap = nextMapInput && typeof nextMapInput === 'object' ? nextMapInput : {};

  Object.keys(sourceMap).forEach((rawWordId) => {
    const wordId = normalizeWordId(rawWordId);
    if (!wordId) return;
    const currentEntry = currentMap[wordId] ? normalizeProgressEntry(currentMap[wordId]) : null;
    const incomingEntry = sourceMap[rawWordId] || {};
    const normalizedIncoming = normalizeProgressEntry(incomingEntry);

    if (!mergeByUpdatedAt || !currentEntry) {
      nextMap[wordId] = normalizedIncoming;
      return;
    }

    const currentUpdatedAt = normalizeTimestamp(currentEntry.updatedAt);
    nextMap[wordId] =
      normalizedIncoming.updatedAt >= currentUpdatedAt
        ? normalizedIncoming
        : normalizeProgressEntry(currentEntry);
  });

  if (mergeByUpdatedAt) {
    Object.keys(currentMap).forEach((wordId) => {
      if (nextMap[wordId]) return;
      nextMap[wordId] = normalizeProgressEntry(currentMap[wordId]);
    });
  }

  saveProgressMap(nextMap);
  return { ...nextMap };
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

  const sourceDiff =
    Number(a?.sourceIndex || Number.MAX_SAFE_INTEGER) -
    Number(b?.sourceIndex || Number.MAX_SAFE_INTEGER);
  if (sourceDiff !== 0) return sourceDiff;

  return normalizeWordId(a?.rootId).localeCompare(normalizeWordId(b?.rootId));
}

function normalizeRootMetaRecord(rootData, sourceIndex = Number.MAX_SAFE_INTEGER) {
  return {
    rootId: normalizeWordId(rootData.rootId || rootData.file || rootData.root),
    root: rootData.root || rootData.rootId || '',
    meaning: rootData.meaning || '',
    descriptionCn: rootData.descriptionCn || '',
    parentRootId: normalizeWordId(rootData.parentRootId || ''),
    rootLevel: typeof rootData.rootLevel === 'number' ? rootData.rootLevel : 1,
    rootPath: rootData.rootPath || normalizeWordId(rootData.rootId || rootData.file || ''),
    type: rootData.type || 'root',
    notes: rootData.notes || '',
    sourceLabel: rootData.sourceLabel || '',
    tags: Array.isArray(rootData.tags) ? rootData.tags : [],
    sourceIndex,
    sideHint: rootData.sideHint || getRootSideHint(rootData.type),
    wordCount: Math.max(0, Number(rootData.wordCount || 0)),
    childCount: 0,
    descendantWordCount: Math.max(0, Number(rootData.wordCount || 0)),
    hasChildren: false,
    sampleWords: Array.isArray(rootData.sampleWords) ? [...rootData.sampleWords] : [],
    file: rootData.file || normalizeWordId(rootData.rootId || rootData.file || ''),
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

function getPathSegments(rootPath, fallbackRootId = '') {
  const segments = String(rootPath || '')
    .split('>')
    .map((segment) => normalizeWordId(segment))
    .filter(Boolean);
  if (segments.length) return segments;
  const fallback = normalizeWordId(fallbackRootId);
  return fallback ? [fallback] : [];
}

function createRawDataUnavailableError(reason) {
  const error = new Error(`Raw data unavailable: ${reason}`);
  error.code = RAW_DATA_ERROR_CODE;
  return error;
}

function ensureIndexCache() {
  if (indexCache) return indexCache;

  const sourceRoots = Array.isArray(rootMetaRaw?.roots) ? rootMetaRaw.roots : [];
  const sourceOrderedRoots = sourceRoots
    .map((item, sourceIndex) => normalizeRootMetaRecord(item, sourceIndex))
    .filter((item) => item.rootId);

  const childRootIdsByParent = Object.create(null);
  const sourceOrderedChildRootIdsByParent = Object.create(null);
  const draftMetaMap = Object.create(null);

  sourceOrderedRoots.forEach((root) => {
    draftMetaMap[root.rootId] = root;
    childRootIdsByParent[root.rootId] = [];
    sourceOrderedChildRootIdsByParent[root.rootId] = [];
  });

  sourceOrderedRoots.forEach((root) => {
    const parentId = normalizeWordId(root.parentRootId);
    if (!parentId || !sourceOrderedChildRootIdsByParent[parentId]) return;
    sourceOrderedChildRootIdsByParent[parentId].push(root.rootId);
  });

  const descendantWordCountMemo = Object.create(null);
  function getDescendantWordCount(rootId, chain = new Set()) {
    const normalizedRootId = normalizeWordId(rootId);
    if (!normalizedRootId || !draftMetaMap[normalizedRootId]) return 0;
    if (typeof descendantWordCountMemo[normalizedRootId] === 'number') {
      return descendantWordCountMemo[normalizedRootId];
    }
    if (chain.has(normalizedRootId)) {
      return Number(draftMetaMap[normalizedRootId].wordCount || 0);
    }

    const nextChain = new Set(chain);
    nextChain.add(normalizedRootId);

    const ownCount = Number(draftMetaMap[normalizedRootId].wordCount || 0);
    const childIds = sourceOrderedChildRootIdsByParent[normalizedRootId] || [];
    const childCount = childIds.reduce(
      (sum, childId) => sum + getDescendantWordCount(childId, nextChain),
      0,
    );
    const total = ownCount + childCount;
    descendantWordCountMemo[normalizedRootId] = total;
    return total;
  }

  const sourceOrderedRootMeta = sourceOrderedRoots.map((root) => {
    const childIds = sourceOrderedChildRootIdsByParent[root.rootId] || [];
    return {
      ...root,
      childCount: childIds.length,
      descendantWordCount: getDescendantWordCount(root.rootId),
      hasChildren: childIds.length > 0,
    };
  });

  const rootMetaMap = Object.create(null);
  sourceOrderedRootMeta.forEach((root) => {
    rootMetaMap[root.rootId] = root;
  });

  Object.keys(sourceOrderedChildRootIdsByParent).forEach((parentId) => {
    childRootIdsByParent[parentId] = [...(sourceOrderedChildRootIdsByParent[parentId] || [])].sort(
      (leftId, rightId) => compareGraphRoots(rootMetaMap[leftId], rootMetaMap[rightId]),
    );
  });

  const graphRootMeta = [...sourceOrderedRootMeta].sort(compareGraphRoots);
  const categoryIndex =
    categoriesRaw && categoriesRaw.categories && typeof categoriesRaw.categories === 'object'
      ? categoriesRaw
      : { version: 1, updatedAt: '', categories: {} };
  const wordToRootIndex =
    wordToRootRaw && wordToRootRaw.map && typeof wordToRootRaw.map === 'object'
      ? wordToRootRaw
      : { version: 1, updatedAt: '', map: {} };

  indexCache = {
    rootMeta: {
      version: Number(rootMetaRaw?.version || 1),
      updatedAt: rootMetaRaw?.updatedAt || '',
      roots: graphRootMeta,
    },
    rootMetaMap,
    rootMetaSourceOrdered: sourceOrderedRootMeta,
    childRootIdsByParent,
    sourceOrderedChildRootIdsByParent,
    categoryIndex,
    wordToRootIndex,
  };

  return indexCache;
}

function getProgressEntriesForSync() {
  const progressMap = getProgressMap();
  const wordToRootMap = ensureIndexCache().wordToRootIndex.map || {};
  const entries = Object.keys(progressMap)
    .map((wordId) => ({
      wordId,
      ...normalizeProgressEntry(progressMap[wordId]),
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
  const wordToRootMap = ensureIndexCache().wordToRootIndex.map || {};
  const now = Date.now();
  const todayStart = getStartOfTodayTimestamp(now);
  const masteredWordIds = Object.keys(progressMap).filter(
    (wordId) => normalizeStatus(progressMap[wordId].status) === STATUS_MASTERED,
  );
  const scheduledWordIds = Object.keys(progressMap).filter((wordId) =>
    isScheduledProgress(progressMap[wordId]),
  );
  const dueWordIds = scheduledWordIds.filter(
    (wordId) => normalizeTimestamp(progressMap[wordId].nextReviewAt) <= now,
  );
  const overdueWordIds = scheduledWordIds.filter(
    (wordId) => normalizeTimestamp(progressMap[wordId].nextReviewAt) < todayStart,
  );
  const todayCompletedWordIds = scheduledWordIds.filter((wordId) =>
    isSameDay(progressMap[wordId].lastReviewedAt, now),
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
    scheduledWords: scheduledWordIds.length,
    dueWords: dueWordIds.length,
    overdueWords: overdueWordIds.length,
    todayCompletedWords: todayCompletedWordIds.length,
    activityDays: activityDates.length,
    streakDays,
    lastActivityDate: activityDates.length ? activityDates[activityDates.length - 1] : '',
  };
}

function normalizeWord(rawWord) {
  const id = normalizeWordId(rawWord?.id || rawWord?.wordId || rawWord?.word);
  return {
    id,
    word: rawWord?.display || rawWord?.word || id,
    canonical: rawWord?.word || id,
    phonetic: rawWord?.phonetic || '',
    translation: rawWord?.translation || '',
    sentence: rawWord?.sentence || rawWord?.example || '',
    tags: Array.isArray(rawWord?.tags) ? rawWord.tags : [],
    sourceLabel: rawWord?.sourceLabel || '',
    rootId: normalizeWordId(rawWord?.rootId || ''),
    rootPath: rawWord?.rootPath || '',
    level: typeof rawWord?.level === 'number' ? rawWord.level : 1,
    sourceIndex:
      typeof rawWord?.sourceIndex === 'number' ? rawWord.sourceIndex : Number.MAX_SAFE_INTEGER,
    status: STATUS_NEW,
  };
}

function extractModuleDefault(moduleValue) {
  if (
    moduleValue &&
    typeof moduleValue === 'object' &&
    Object.prototype.hasOwnProperty.call(moduleValue, 'default')
  ) {
    return moduleValue.default;
  }
  return moduleValue;
}

function buildRootSummary(rootId) {
  return cloneRootSummary(ensureIndexCache().rootMetaMap[normalizeWordId(rootId)]);
}

function normalizeLoadedRootRecord(rootInput, fallbackRootId = '') {
  const rawRoot = rootInput && typeof rootInput === 'object' ? rootInput : {};
  const summary =
    buildRootSummary(rawRoot.rootId || fallbackRootId) ||
    normalizeRootMetaRecord({ rootId: rawRoot.rootId || fallbackRootId || rawRoot.root });
  const rootId = normalizeWordId(rawRoot.rootId || summary.rootId);
  const rootPath = rawRoot.rootPath || summary.rootPath || rootId;
  const sourceLabel = rawRoot.sourceLabel || summary.sourceLabel || '';
  const words = Array.isArray(rawRoot.words)
    ? rawRoot.words
        .map((word, sourceIndex) =>
          normalizeWord({
            ...word,
            rootId,
            rootPath,
            sourceLabel,
            sourceIndex: typeof word?.sourceIndex === 'number' ? word.sourceIndex : sourceIndex,
          }),
        )
        .filter((word) => word.id)
    : [];

  return {
    version: Number(rawRoot.version || 1),
    rootId,
    root: rawRoot.root || summary.root || rootId,
    meaning: rawRoot.meaning || summary.meaning || '',
    descriptionCn: rawRoot.descriptionCn || summary.descriptionCn || '',
    updatedAt: rawRoot.updatedAt || '',
    words,
    parentRootId: normalizeWordId(rawRoot.parentRootId || summary.parentRootId || ''),
    rootLevel:
      typeof rawRoot.rootLevel === 'number'
        ? rawRoot.rootLevel
        : typeof summary.rootLevel === 'number'
          ? summary.rootLevel
          : 1,
    rootPath,
    type: rawRoot.type || summary.type || 'root',
    notes: rawRoot.notes || summary.notes || '',
    sourceLabel,
    tags: Array.isArray(rawRoot.tags)
      ? rawRoot.tags
      : Array.isArray(summary.tags)
        ? summary.tags
        : [],
    sourceIndex:
      typeof summary.sourceIndex === 'number' ? summary.sourceIndex : Number.MAX_SAFE_INTEGER,
    sideHint: rawRoot.sideHint || summary.sideHint || getRootSideHint(rawRoot.type || summary.type),
  };
}

function cacheLoadedRoot(rootInput, fallbackRootId = '') {
  const normalizedRoot = normalizeLoadedRootRecord(rootInput, fallbackRootId);
  if (!normalizedRoot.rootId) {
    throw createRawDataUnavailableError('rootId missing in loaded root payload');
  }
  loadedRootCache[normalizedRoot.rootId] = normalizedRoot;
  normalizedRoot.words.forEach((word) => {
    loadedWordCache[word.id] = { ...word };
  });
  return loadedRootCache[normalizedRoot.rootId];
}

async function loadShard(shardId) {
  const normalizedShardId = String(shardId || '').trim();
  if (!normalizedShardId) return null;
  if (shardLoadPromises[normalizedShardId]) {
    return shardLoadPromises[normalizedShardId];
  }

  const loader = ROOT_SHARD_LOADERS[normalizedShardId];
  if (!loader) {
    return null;
  }

  shardLoadPromises[normalizedShardId] = Promise.resolve(loader())
    .then(extractModuleDefault)
    .then((payload) => {
      const roots = payload && typeof payload.roots === 'object' ? payload.roots : {};
      Object.keys(roots).forEach((rootId) => {
        cacheLoadedRoot(roots[rootId], rootId);
      });
      return true;
    })
    .catch((error) => {
      delete shardLoadPromises[normalizedShardId];
      throw error;
    });

  return shardLoadPromises[normalizedShardId];
}

async function loadRootData(rootId) {
  const normalizedRootId = normalizeWordId(rootId);
  if (!normalizedRootId) {
    throw new Error('No rootId provided');
  }
  if (loadedRootCache[normalizedRootId]) {
    return loadedRootCache[normalizedRootId];
  }
  if (rootLoadPromises[normalizedRootId]) {
    return rootLoadPromises[normalizedRootId];
  }

  rootLoadPromises[normalizedRootId] = (async () => {
    const shardId = ROOT_TO_SHARD[normalizedRootId];
    if (shardId) {
      await loadShard(shardId);
    }

    const loaded = loadedRootCache[normalizedRootId];
    if (!loaded) {
      throw createRawDataUnavailableError(`No raw root data found for "${normalizedRootId}"`);
    }
    return loaded;
  })().catch((error) => {
    delete rootLoadPromises[normalizedRootId];
    throw error;
  });

  return rootLoadPromises[normalizedRootId];
}

async function preloadAllRoots() {
  const cache = ensureIndexCache();
  const shardIds = Object.keys(ROOT_SHARD_LOADERS || {});
  if (shardIds.length) {
    await Promise.all(shardIds.map((shardId) => loadShard(shardId)));
  }

  const missingRootIds = Object.keys(cache.rootMetaMap).filter(
    (rootId) => !loadedRootCache[rootId],
  );
  if (missingRootIds.length) {
    await Promise.all(missingRootIds.map((rootId) => loadRootData(rootId)));
  }

  return loadedRootCache;
}

function applyProgress(words, progressMap) {
  return words.map((word) => mergeProgressIntoWord(word, progressMap[word.id]));
}

function getDataSourceHealth() {
  const cache = ensureIndexCache();
  const rootCount = Object.keys(cache.rootMetaMap || {}).length;
  const wordCount = Object.keys(cache.wordToRootIndex?.map || {}).length;
  const categories = Object.keys(cache.categoryIndex?.categories || {}).length;
  const ok = rootCount > 0 && wordCount > 0;

  return {
    ok,
    mode: 'indexed-lazy',
    roots: rootCount,
    words: wordCount,
    categories,
    code: ok ? '' : RAW_DATA_ERROR_CODE,
    message: ok ? '' : 'Indexed word data is incomplete.',
  };
}

function getRootMeta(rootId) {
  return buildRootSummary(rootId);
}

async function getRoot(rootId, options = {}) {
  const { withProgress = true } = options;
  const rootData = await loadRootData(rootId);
  const words = rootData.words.map((word) => normalizeWord(word));

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
  const cache = ensureIndexCache();
  const categories = cache.categoryIndex.categories || {};
  const category = categories[normalizedCategoryKey];
  if (!category) return [];

  const sourceWordIds = Array.isArray(category.wordIds) ? category.wordIds : [];
  const end = limit > 0 ? offset + limit : undefined;
  const pageWordIds = sourceWordIds.slice(offset, end).map(normalizeWordId);
  if (!pageWordIds.length) return [];

  const wordToRootMap = cache.wordToRootIndex.map || {};
  const requiredRootIds = [
    ...new Set(pageWordIds.map((wordId) => normalizeWordId(wordToRootMap[wordId])).filter(Boolean)),
  ];

  const roots = await Promise.all(
    requiredRootIds.map((nextRootId) => getRoot(nextRootId, { withProgress })),
  );

  const flattenedWordMap = {};
  roots.forEach((rootData) => {
    rootData.words.forEach((word) => {
      flattenedWordMap[word.id] = word;
    });
  });

  return pageWordIds.map((wordId) => flattenedWordMap[wordId]).filter(Boolean);
}

async function getWordById(wordId, options = {}) {
  const { withProgress = true } = options;
  const normalizedWordId = normalizeWordId(wordId);
  if (!normalizedWordId) return null;

  const cachedWord = loadedWordCache[normalizedWordId];
  if (cachedWord) {
    const normalizedWord = normalizeWord(cachedWord);
    if (!withProgress) return normalizedWord;
    return mergeProgressIntoWord(normalizedWord, getProgressMap()[normalizedWordId]);
  }

  const rootId = normalizeWordId(ensureIndexCache().wordToRootIndex.map?.[normalizedWordId] || '');
  if (!rootId) return null;

  const rootData = await loadRootData(rootId);
  const matchedWord = Array.isArray(rootData.words)
    ? rootData.words.find((item) => item.id === normalizedWordId)
    : null;
  if (!matchedWord) return null;

  const normalizedWord = normalizeWord(matchedWord);
  loadedWordCache[normalizedWord.id] = { ...normalizedWord };
  if (!withProgress) return normalizedWord;
  return mergeProgressIntoWord(normalizedWord, getProgressMap()[normalizedWordId]);
}

function getReviewIntervalDays(stage) {
  return REVIEW_INTERVAL_DAYS[normalizeStage(stage)] || REVIEW_INTERVAL_DAYS[0];
}

function getTodayReviewOverview(now = Date.now()) {
  const stats = getProgressStats();
  const lastLearningRootId = getLastLearningRoot();
  const lastLearningRoot = lastLearningRootId ? getRootMeta(lastLearningRootId) : null;
  return {
    dateKey: toDayKey(now),
    dueCount: stats.dueWords || 0,
    overdueCount: stats.overdueWords || 0,
    doneCount: stats.todayCompletedWords || 0,
    totalCount: Number(stats.dueWords || 0) + Number(stats.todayCompletedWords || 0),
    streakDays: stats.streakDays || 0,
    masteredWords: stats.masteredWords || 0,
    scheduledWords: stats.scheduledWords || 0,
    lastLearningRootId,
    lastLearningRoot,
  };
}

async function getDueReviewQueue(options = {}) {
  const { limit = 0 } = options;
  const now = Date.now();
  const progressMap = getProgressMap();
  const dueEntries = Object.keys(progressMap)
    .map((wordId) => ({
      wordId,
      progress: normalizeProgressEntry(progressMap[wordId]),
    }))
    .filter((item) => isScheduledProgress(item.progress) && item.progress.nextReviewAt <= now)
    .sort((left, right) => {
      const dueDiff = left.progress.nextReviewAt - right.progress.nextReviewAt;
      if (dueDiff !== 0) return dueDiff;
      return left.progress.updatedAt - right.progress.updatedAt;
    });

  const queue = (
    await Promise.all(
      dueEntries.map(async (item) => {
        const rawWord = await getWordById(item.wordId, { withProgress: false });
        return rawWord ? mergeProgressIntoWord(rawWord, item.progress) : null;
      }),
    )
  ).filter(Boolean);

  if (Number(limit) > 0) {
    return queue.slice(0, Number(limit));
  }
  return queue;
}

async function enqueueWordForReview(wordId, options = {}) {
  const normalizedWordId = normalizeWordId(wordId);
  if (!normalizedWordId) return null;

  const baseWord = options.word
    ? normalizeWord(options.word)
    : await getWordById(normalizedWordId, { withProgress: false });
  if (!baseWord) return null;

  const now = Date.now();
  const progressMap = getProgressMap();
  const currentEntry = progressMap[normalizedWordId]
    ? normalizeProgressEntry(progressMap[normalizedWordId], { fallbackNow: now })
    : null;

  if (currentEntry && isScheduledProgress(currentEntry)) {
    return mergeProgressIntoWord(baseWord, currentEntry);
  }

  const nextEntry = {
    ...(currentEntry || createEmptyProgressEntry(now)),
    status: STATUS_LEARNING,
    stage: 0,
    introducedAt: currentEntry?.introducedAt || now,
    lastReviewedAt: 0,
    nextReviewAt: now,
    updatedAt: now,
    lapseCount: currentEntry?.lapseCount || 0,
    correctCount: currentEntry?.correctCount || 0,
  };

  progressMap[normalizedWordId] = normalizeProgressEntry(nextEntry);
  saveProgressMap(progressMap);
  recordLearningActivity(now);
  setLastLearningRoot(baseWord.rootId);
  return mergeProgressIntoWord(baseWord, nextEntry);
}

async function submitReviewResult(wordId, result = {}) {
  const normalizedWordId = normalizeWordId(wordId);
  if (!normalizedWordId) return null;

  const baseWord = result.word
    ? normalizeWord(result.word)
    : await getWordById(normalizedWordId, { withProgress: false });
  if (!baseWord) return null;

  const now = Date.now();
  const progressMap = getProgressMap();
  const currentEntry = progressMap[normalizedWordId]
    ? normalizeProgressEntry(progressMap[normalizedWordId], { fallbackNow: now })
    : normalizeProgressEntry(
        {
          ...createEmptyProgressEntry(now),
          status: STATUS_LEARNING,
          nextReviewAt: now,
        },
        { fallbackNow: now },
      );
  const correct = Boolean(result && result.correct);

  let nextStage = currentEntry.stage;
  let nextStatus = currentEntry.status;
  let nextReviewAt = currentEntry.nextReviewAt;
  let nextLapseCount = currentEntry.lapseCount;
  let nextCorrectCount = currentEntry.correctCount;

  if (correct) {
    nextStage = Math.min(4, currentEntry.stage + 1);
    nextStatus = getProgressStatusFromStage(nextStage);
    nextReviewAt = addDays(now, getReviewIntervalDays(currentEntry.stage));
    nextCorrectCount += 1;
  } else {
    nextStage = Math.max(0, currentEntry.stage - 1);
    nextStatus = getProgressStatusFromStage(nextStage);
    nextReviewAt = addDays(now, 1);
    nextLapseCount += 1;
  }

  const nextEntry = normalizeProgressEntry(
    {
      ...currentEntry,
      status: nextStatus,
      stage: nextStage,
      introducedAt: currentEntry.introducedAt || now,
      lastReviewedAt: now,
      nextReviewAt,
      updatedAt: now,
      lapseCount: nextLapseCount,
      correctCount: nextCorrectCount,
    },
    { fallbackNow: now },
  );

  progressMap[normalizedWordId] = nextEntry;
  saveProgressMap(progressMap);
  recordLearningActivity(now);
  setLastLearningRoot(baseWord.rootId);
  return mergeProgressIntoWord(baseWord, nextEntry);
}

function setWordStatus(wordId, status) {
  const normalizedWordId = normalizeWordId(wordId);
  if (!normalizedWordId) return;

  const rootId = normalizeWordId(ensureIndexCache().wordToRootIndex.map?.[normalizedWordId] || '');
  if (!rootId) return;

  const now = Date.now();
  const progressMap = getProgressMap();
  const normalizedStatus = normalizeStatus(status);
  progressMap[normalizedWordId] = normalizeProgressEntry(
    normalizedStatus === STATUS_MASTERED
      ? {
          status: STATUS_MASTERED,
          stage: 4,
          introducedAt: now,
          lastReviewedAt: now,
          nextReviewAt: addDays(now, getReviewIntervalDays(4)),
          updatedAt: now,
          lapseCount: 0,
          correctCount: 1,
        }
      : {
          status: STATUS_NEW,
          stage: 0,
          introducedAt: now,
          lastReviewedAt: 0,
          nextReviewAt: 0,
          updatedAt: now,
          lapseCount: 0,
          correctCount: 0,
        },
    { fallbackNow: now },
  );
  saveProgressMap(progressMap);
  recordLearningActivity(now);
  setLastLearningRoot(rootId);
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
  setLastLearningRoot('');
  setPendingRootFocus('');
}

function listRoots() {
  return (ensureIndexCache().rootMeta.roots || []).map((root) => cloneRootSummary(root));
}

async function listAllWords(options = {}) {
  const { withProgress = true } = options;
  await preloadAllRoots();
  const words = Object.values(loadedWordCache).map((word) => normalizeWord(word));
  return withProgress ? applyProgress(words, getProgressMap()) : words;
}

function listCategories() {
  const categories = ensureIndexCache().categoryIndex.categories || {};
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
    counter[seed].wordCount += Number(item.descendantWordCount || item.wordCount || 0);
  });

  return Object.keys(counter)
    .sort((a, b) => a.localeCompare(b))
    .map((seed) => counter[seed]);
}

function getDirectChildIds(rootId) {
  const normalizedRootId = normalizeWordId(rootId);
  const cache = ensureIndexCache();
  return Array.isArray(cache.childRootIdsByParent[normalizedRootId])
    ? [...cache.childRootIdsByParent[normalizedRootId]]
    : [];
}

function getSourceOrderedChildIds(rootId) {
  const normalizedRootId = normalizeWordId(rootId);
  const cache = ensureIndexCache();
  return Array.isArray(cache.sourceOrderedChildRootIdsByParent[normalizedRootId])
    ? [...cache.sourceOrderedChildRootIdsByParent[normalizedRootId]]
    : [];
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
    words: Array.isArray(rootData?.words) ? [...rootData.words] : [],
  };
}

function buildLearningSnapshotRoot(rootData, summary) {
  if (!rootData && !summary) return null;
  const baseSummary = summary || buildRootSummary(rootData?.rootId);
  return {
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
    parentRootId: rootData?.parentRootId || baseSummary?.parentRootId || '',
    rootLevel:
      typeof rootData?.rootLevel === 'number'
        ? rootData.rootLevel
        : typeof baseSummary?.rootLevel === 'number'
          ? baseSummary.rootLevel
          : 1,
    rootPath: rootData?.rootPath || baseSummary?.rootPath || '',
    type: rootData?.type || baseSummary?.type || 'root',
    sourceIndex:
      typeof baseSummary?.sourceIndex === 'number'
        ? baseSummary.sourceIndex
        : Number.MAX_SAFE_INTEGER,
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
  const { withProgress = true } = options;
  const normalizedSeed = normalizeWordId(seed);
  if (!normalizedSeed) {
    return {
      seed: '',
      baseRoot: null,
      branches: [],
      totalBranches: 0,
    };
  }

  let baseRoot = null;
  try {
    baseRoot = await getRoot(normalizedSeed, { withProgress });
  } catch (error) {
    baseRoot = buildRootSummary(normalizedSeed);
  }
  const directChildIds = getSourceOrderedChildIds(normalizedSeed);
  const branches = await Promise.all(
    directChildIds.map(async (rootId) => {
      const summary = buildRootSummary(rootId);
      if (!summary) return null;
      let branch = null;
      try {
        branch = await getRootBranch(rootId, {
          withProgress,
        });
      } catch (error) {
        branch = {
          children: getSourceOrderedChildIds(rootId)
            .map((item) => buildRootSummary(item))
            .filter(Boolean),
          words: [],
          totalChildren: Number(summary.childCount || 0),
          totalWords: Number(summary.wordCount || 0),
        };
      }

      return {
        ...summary,
        previewChildren: branch.children,
        previewWords: branch.words,
        totalChildren: branch.totalChildren,
        totalWords: branch.totalWords,
      };
    }),
  );

  const filteredBranches = branches.filter(Boolean);

  return {
    seed: normalizedSeed,
    baseRoot: buildRootDetail(baseRoot, buildRootSummary(normalizedSeed)),
    branches: filteredBranches,
    totalBranches: filteredBranches.length,
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
    throw createRawDataUnavailableError(`No raw root data found for "${normalizedRootId}"`);
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
  const { withProgress = true } = options;
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
    };
  }

  const focusRoot = await getRoot(normalizedRootId, { withProgress });
  const focusSummary = buildRootSummary(normalizedRootId);
  if (!focusSummary) {
    throw createRawDataUnavailableError(`No raw root data found for "${normalizedRootId}"`);
  }

  const path = getPathSegments(focusRoot.rootPath || focusSummary.rootPath, normalizedRootId)
    .map((segment) => buildRootSummary(segment))
    .filter(Boolean);
  const parent = focusSummary.parentRootId ? buildRootSummary(focusSummary.parentRootId) : null;
  const siblingIds = parent ? getSourceOrderedChildIds(parent.rootId) : [];
  const siblings = siblingIds.map((item) => buildRootSummary(item)).filter(Boolean);

  const allChildren = getSourceOrderedChildIds(normalizedRootId)
    .map((item) => buildRootSummary(item))
    .filter(Boolean);
  const sourceWords = Array.isArray(focusRoot.words) ? focusRoot.words : [];

  return {
    root: buildRootDetail(focusRoot, focusSummary),
    path,
    parent,
    siblings,
    children: allChildren,
    words: sourceWords,
    totalSiblings: siblings.length,
    totalChildren: allChildren.length,
    totalWords: sourceWords.length,
  };
}

async function buildLearningRootSnapshotNode(rootId, options = {}) {
  const { withProgress = false, progressMap = null } = options;
  const normalizedRootId = normalizeWordId(rootId);
  if (!normalizedRootId) return null;

  const [rootData, summary] = await Promise.all([
    loadRootData(normalizedRootId),
    Promise.resolve(buildRootSummary(normalizedRootId)),
  ]);

  if (!summary) {
    throw createRawDataUnavailableError(`No raw root data found for "${normalizedRootId}"`);
  }

  const sourceWords = Array.isArray(rootData.words)
    ? rootData.words.map((word) => normalizeWord(word))
    : [];
  const words = withProgress
    ? applyProgress(sourceWords, progressMap || getProgressMap())
    : sourceWords;
  const childIds = getSourceOrderedChildIds(normalizedRootId);
  const children = (
    await Promise.all(
      childIds.map((childId) =>
        buildLearningRootSnapshotNode(childId, {
          withProgress,
          progressMap,
        }),
      ),
    )
  ).filter(Boolean);
  const totalWords =
    words.length + children.reduce((sum, child) => sum + Number(child.totalWords || 0), 0);

  return {
    root: buildLearningSnapshotRoot(rootData, summary),
    words,
    children,
    totalWords,
  };
}

async function getLearningRootSnapshot(rootId, options = {}) {
  const { withProgress = false } = options;
  const progressMap = withProgress ? getProgressMap() : null;
  const snapshot = await buildLearningRootSnapshotNode(rootId, {
    withProgress,
    progressMap,
  });

  if (!snapshot) {
    return {
      root: null,
      words: [],
      children: [],
      totalWords: 0,
    };
  }

  return snapshot;
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
      const sourceDiff =
        Number(a.sourceIndex || Number.MAX_SAFE_INTEGER) -
        Number(b.sourceIndex || Number.MAX_SAFE_INTEGER);
      if (sourceDiff !== 0) return sourceDiff;
      return normalizeWordId(a.rootId).localeCompare(normalizeWordId(b.rootId));
    })
    .slice(0, maxBranches);
  if (!candidates.length) {
    throw createRawDataUnavailableError(`No raw family data found for "${normalizedBase}"`);
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
  STATUS_LEARNING,
  STATUS_REVIEW,
  STATUS_MASTERED,
  consumePendingRootFocus,
  clearProgress,
  clearLearningActivity,
  enqueueWordForReview,
  getDueReviewQueue,
  getLearningActivityDates,
  getLastLearningRoot,
  getLearningRootSnapshot,
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
  getTodayReviewOverview,
  getWordById,
  getWordPronunciationUrl,
  getWordReviewState: getScheduledReviewState,
  getWordStatus,
  getWordsByCategory,
  getWordsByRoot,
  getRootFamily,
  listRootSeeds,
  listCategories,
  listAllWords,
  listRoots,
  replaceLearningActivity,
  replaceProgressMap,
  setLastLearningRoot,
  setPendingRootFocus,
  setWordStatus,
  submitReviewResult,
  getDataSourceHealth,
  RAW_DATA_ERROR_CODE,
};
