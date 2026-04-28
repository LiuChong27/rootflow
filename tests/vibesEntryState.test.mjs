import test from 'node:test';
import assert from 'node:assert/strict';

const vibesEntryStateModule = await import('../services/vibesEntryState.js');
const storageModule = await import('../services/storage.js');

const vibesEntryState =
  vibesEntryStateModule.default?.default || vibesEntryStateModule.default || vibesEntryStateModule;
const storageApi = storageModule.default?.default || storageModule.default || storageModule;
const { STORAGE_KEYS, removeStorage } = storageApi;

function resetVibesEntryState() {
  removeStorage(STORAGE_KEYS.vibesFavorites);
  removeStorage(STORAGE_KEYS.vibesHiddenEntries);
}

test('vibesEntryState toggles favorites and returns lookup/list', () => {
  resetVibesEntryState();

  const scene = {
    id: 'mom-swears',
    title: '含妈脏话',
    theme: 'obsidian-alert',
  };
  const entry = {
    id: 'mom-swears-insults-01',
    sceneId: 'mom-swears',
    section: 'insults',
    english: 'High-pressure mother-insult rant line.',
    chinese: '含妈脏话测试句',
    sourceKind: 'crafted',
    sourceSection: 'High Pressure',
  };

  assert.equal(vibesEntryState.isFavorite(entry.id), false);
  assert.equal(vibesEntryState.toggleFavorite(scene, entry), true);
  assert.equal(vibesEntryState.isFavorite(entry.id), true);

  const favorites = vibesEntryState.listFavorites();
  assert.equal(favorites.length, 1);
  assert.equal(favorites[0].id, entry.id);
  assert.equal(favorites[0].sceneId, scene.id);

  const lookup = vibesEntryState.getFavoriteLookup();
  assert.equal(lookup[entry.id], true);

  assert.equal(vibesEntryState.toggleFavorite(scene, entry), false);
  assert.equal(vibesEntryState.isFavorite(entry.id), false);
  assert.equal(vibesEntryState.listFavorites().length, 0);
});

test('vibesEntryState hides entries by scene and can restore scene deletions', () => {
  resetVibesEntryState();

  assert.equal(vibesEntryState.hideEntry('mom-swears', 'mom-swears-insults-02'), true);
  assert.equal(vibesEntryState.hideEntry('mom-swears', 'mom-swears-insults-03'), true);
  assert.equal(vibesEntryState.hideEntry('mom-swears', 'mom-swears-insults-03'), false);

  const hiddenLookup = vibesEntryState.getSceneHiddenLookup('mom-swears');
  assert.equal(hiddenLookup['mom-swears-insults-02'], true);
  assert.equal(hiddenLookup['mom-swears-insults-03'], true);

  assert.equal(vibesEntryState.restoreSceneHiddenEntries('daily-clash'), 0);
  assert.equal(vibesEntryState.restoreSceneHiddenEntries('mom-swears'), 2);
  assert.deepEqual(vibesEntryState.getSceneHiddenLookup('mom-swears'), {});
});
