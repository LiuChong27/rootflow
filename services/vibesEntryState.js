import { STORAGE_KEYS, readStorage, writeStorage } from './storage';

function normalizeText(input) {
  return String(input || '').trim();
}

function ensureObject(input) {
  return input && typeof input === 'object' && !Array.isArray(input) ? input : {};
}

function readFavoritesMap() {
  return ensureObject(readStorage(STORAGE_KEYS.vibesFavorites, {}));
}

function writeFavoritesMap(favoritesMap) {
  const safeMap = ensureObject(favoritesMap);
  writeStorage(STORAGE_KEYS.vibesFavorites, safeMap);
  return safeMap;
}

function readHiddenEntriesMap() {
  return ensureObject(readStorage(STORAGE_KEYS.vibesHiddenEntries, {}));
}

function writeHiddenEntriesMap(hiddenEntriesMap) {
  const safeMap = ensureObject(hiddenEntriesMap);
  writeStorage(STORAGE_KEYS.vibesHiddenEntries, safeMap);
  return safeMap;
}

function buildFavoriteRecord(scene, entry) {
  return {
    id: normalizeText(entry?.id),
    sceneId: normalizeText(scene?.id || entry?.sceneId),
    sceneTitle: normalizeText(scene?.title),
    sceneTheme: normalizeText(scene?.theme),
    section: normalizeText(entry?.section),
    english: normalizeText(entry?.english),
    chinese: normalizeText(entry?.chinese),
    sourceKind: normalizeText(entry?.sourceKind),
    sourceSection: normalizeText(entry?.sourceSection),
    createdAt: Date.now(),
  };
}

function toIdLookup(list) {
  return (Array.isArray(list) ? list : []).reduce((acc, entryId) => {
    const normalizedId = normalizeText(entryId);
    if (normalizedId) acc[normalizedId] = true;
    return acc;
  }, {});
}

export default {
  listFavorites() {
    return Object.values(readFavoritesMap()).sort(
      (left, right) => Number(right?.createdAt || 0) - Number(left?.createdAt || 0),
    );
  },
  getFavoriteLookup() {
    return toIdLookup(Object.keys(readFavoritesMap()));
  },
  isFavorite(entryId) {
    const targetId = normalizeText(entryId);
    return Boolean(targetId && readFavoritesMap()[targetId]);
  },
  toggleFavorite(scene, entry) {
    const record = buildFavoriteRecord(scene, entry);
    if (!record.id) return false;

    const favoritesMap = readFavoritesMap();
    if (favoritesMap[record.id]) {
      delete favoritesMap[record.id];
      writeFavoritesMap(favoritesMap);
      return false;
    }

    favoritesMap[record.id] = record;
    writeFavoritesMap(favoritesMap);
    return true;
  },
  removeFavorite(entryId) {
    const targetId = normalizeText(entryId);
    if (!targetId) return false;

    const favoritesMap = readFavoritesMap();
    if (!favoritesMap[targetId]) return false;

    delete favoritesMap[targetId];
    writeFavoritesMap(favoritesMap);
    return true;
  },
  getSceneHiddenLookup(sceneId) {
    const targetSceneId = normalizeText(sceneId);
    if (!targetSceneId) return {};
    const hiddenEntriesMap = readHiddenEntriesMap();
    return toIdLookup(hiddenEntriesMap[targetSceneId]);
  },
  hideEntry(sceneId, entryId) {
    const targetSceneId = normalizeText(sceneId);
    const targetEntryId = normalizeText(entryId);
    if (!targetSceneId || !targetEntryId) return false;

    const hiddenEntriesMap = readHiddenEntriesMap();
    const currentList = Array.isArray(hiddenEntriesMap[targetSceneId])
      ? hiddenEntriesMap[targetSceneId]
      : [];
    if (currentList.includes(targetEntryId)) return false;

    hiddenEntriesMap[targetSceneId] = [...currentList, targetEntryId];
    writeHiddenEntriesMap(hiddenEntriesMap);
    return true;
  },
  restoreSceneHiddenEntries(sceneId) {
    const targetSceneId = normalizeText(sceneId);
    if (!targetSceneId) return 0;

    const hiddenEntriesMap = readHiddenEntriesMap();
    const currentList = Array.isArray(hiddenEntriesMap[targetSceneId])
      ? hiddenEntriesMap[targetSceneId]
      : [];
    if (!currentList.length) return 0;

    delete hiddenEntriesMap[targetSceneId];
    writeHiddenEntriesMap(hiddenEntriesMap);
    return currentList.length;
  },
};
