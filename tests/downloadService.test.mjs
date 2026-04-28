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

const downloadServiceModule = await import('../services/downloadService.js');
const {
  __TEST_ONLY__,
  applySnapshotDownloadBenefits,
  estimateSelection,
  getCachedDownloadOverview,
  getPurchaseCapability,
} = downloadServiceModule;

function resetStorage() {
  globalThis.uni._storage = Object.create(null);
}

test('normalize catalog assets always preserves the full A-Z grid', () => {
  resetStorage();
  __TEST_ONLY__.resetState();

  const assets = __TEST_ONLY__.normalizeCatalogAssets([
    {
      assetKey: 'pdf-a',
      letter: 'a',
      title: 'A.pdf',
      version: '2026.04',
      size: 1024,
      canDownload: true,
    },
  ]);

  assert.equal(assets.length, 26);
  assert.equal(assets[0].assetKey, 'pdf-a');
  assert.equal(assets[0].version, '2026.04');
  assert.equal(assets[25].assetKey, 'pdf-z');
});

test('normalize catalog assets suppresses covered-letter placeholders for grouped files', () => {
  resetStorage();
  __TEST_ONLY__.resetState();

  const assets = __TEST_ONLY__.normalizeCatalogAssets([
    {
      assetKey: 'pdf-u',
      letter: 'u',
      title: 'U.pdf',
      version: '2026.04',
      fileId: 'file-u',
    },
    {
      assetKey: 'pdf-u-w',
      letter: 'u',
      coveredLetters: ['u', 'w'],
      title: 'U&W.pdf',
      version: '2026.04',
      fileId: 'file-u-w',
    },
    {
      assetKey: 'pdf-v-y-z',
      letter: 'v',
      coveredLetters: ['v', 'y', 'z'],
      title: 'V&Y&Z.pdf',
      version: '2026.04',
      fileId: 'file-v-y-z',
    },
  ]);

  assert.equal(
    assets.some((item) => item.assetKey === 'pdf-w'),
    false,
  );
  assert.equal(
    assets.some((item) => item.assetKey === 'pdf-y'),
    false,
  );
  assert.equal(
    assets.some((item) => item.assetKey === 'pdf-z'),
    false,
  );
  assert.equal(
    assets.some((item) => item.assetKey === 'pdf-u-w'),
    true,
  );
  assert.equal(
    assets.some((item) => item.assetKey === 'pdf-v-y-z'),
    true,
  );
});

test('estimateSelection treats all downloads as free', () => {
  resetStorage();
  __TEST_ONLY__.resetState();

  const result = estimateSelection({
    assets: [
      { assetKey: 'pdf-a', letter: 'a', version: '1', isAvailableLocally: true, size: 1024 },
      { assetKey: 'pdf-b', letter: 'b', version: '1', isAvailableLocally: false, size: 2048 },
    ],
    selectedAssetKeys: ['pdf-a', 'pdf-b'],
    downloadBenefits: {
      isLifetimeMember: false,
      creditBalance: 1,
    },
  });

  assert.equal(result.selectedCount, 2);
  assert.equal(result.pendingCount, 1);
  assert.equal(result.alreadyAvailableCount, 1);
  assert.equal(result.estimatedCredits, 0);
  assert.equal(result.canProceed, true);
});

test('estimateSelection allows free access without credits', () => {
  resetStorage();
  __TEST_ONLY__.resetState();

  const result = estimateSelection({
    assets: [
      { assetKey: 'pdf-a', letter: 'a', version: '1', isAvailableLocally: false, size: 1024 },
    ],
    selectedAssetKeys: ['pdf-a'],
    downloadBenefits: {
      isFreeAccess: true,
      isLifetimeMember: false,
      creditBalance: 0,
    },
  });

  assert.equal(result.estimatedCredits, 0);
  assert.equal(result.canProceed, true);
});

test('snapshot download benefits are cached for Today and downloads pages', () => {
  resetStorage();
  __TEST_ONLY__.resetState();

  applySnapshotDownloadBenefits({
    downloadBenefits: {
      isLifetimeMember: true,
      creditBalance: 30,
      latestOrderStatus: 'fulfilled',
    },
  });

  const overview = getCachedDownloadOverview();
  assert.equal(overview.downloadBenefits.isFreeAccess, true);
  assert.equal(overview.downloadBenefits.isLifetimeMember, false);
  assert.equal(overview.downloadBenefits.creditBalance, 0);
});

test('purchase capability blocks iOS by platform inspection', () => {
  resetStorage();
  __TEST_ONLY__.resetState();

  __TEST_ONLY__.setDeps({
    getUni: () => ({
      getSystemInfoSync: () => ({
        platform: 'ios',
      }),
    }),
  });

  const capability = getPurchaseCapability();
  assert.equal(capability.canPurchase, false);
  assert.equal(capability.platform, 'ios');
});
