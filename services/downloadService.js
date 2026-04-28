import authService from './authService';
import { callCloudFunction } from './cloudService';
import { STORAGE_KEYS, readStorage, writeStorage } from './storage';

const DOWNLOAD_SKUS = Object.freeze({
  lifetimeMember: 'rf_lifetime_member_990',
  pdfPack30: 'rf_pdf_30_pack_200',
});

const PDF_FILE_TYPE = 'pdf';
const DOWNLOAD_RETRY_COUNT = 3;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

const DEFAULT_DOWNLOAD_DEPS = Object.freeze({
  authService,
  callCloudFunction,
  now: () => Date.now(),
  getUni: () => (typeof uni !== 'undefined' ? uni : null),
  getWx: () => (typeof wx !== 'undefined' ? wx : null),
  getUniCloud: () => (typeof uniCloud !== 'undefined' ? uniCloud : globalThis?.uniCloud || null),
});

let downloadDeps = { ...DEFAULT_DOWNLOAD_DEPS };

function getUniApi() {
  return downloadDeps.getUni ? downloadDeps.getUni() : null;
}

function getWxApi() {
  return downloadDeps.getWx ? downloadDeps.getWx() : null;
}

function getUniCloudApi() {
  return downloadDeps.getUniCloud ? downloadDeps.getUniCloud() : null;
}

function normalizeTimestamp(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return Number(fallback || 0);
  return parsed;
}

function buildAssetKey(letter) {
  return `pdf-${String(letter || '')
    .trim()
    .toLowerCase()}`;
}

function buildFallbackAsset(letter) {
  const normalizedLetter = String(letter || '')
    .trim()
    .toLowerCase();
  return {
    assetKey: buildAssetKey(normalizedLetter),
    letter: normalizedLetter,
    label: normalizedLetter.toUpperCase(),
    coveredLetters: normalizedLetter ? [normalizedLetter] : [],
    title: `${normalizedLetter.toUpperCase()}.pdf`,
    version: '',
    size: 0,
    fileType: PDF_FILE_TYPE,
    canDownload: false,
    isAvailableLocally: false,
    localVersion: '',
    localPath: '',
    updatedAt: 0,
  };
}

function normalizeCoveredLetters(input, fallbackLetter = '') {
  const rawValues = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[^a-z]+/i)
      : [];

  const coveredLetters = Array.from(
    new Set(
      rawValues
        .map((value) =>
          String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z]/g, '')
            .slice(0, 1),
        )
        .filter(Boolean),
    ),
  );

  if (coveredLetters.length) return coveredLetters;

  const normalizedFallback = String(fallbackLetter || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, 1);
  return normalizedFallback ? [normalizedFallback] : [];
}

function buildFallbackCatalog() {
  return LETTERS.map((letter) => buildFallbackAsset(letter));
}

function normalizeLocalAssetRecord(recordInput = {}) {
  const record = recordInput && typeof recordInput === 'object' ? recordInput : {};
  const assetKey = String(record.assetKey || buildAssetKey(record.letter))
    .trim()
    .toLowerCase();
  const letter = String(record.letter || assetKey.replace(/^pdf-/, ''))
    .trim()
    .toLowerCase();
  return {
    assetKey,
    letter,
    version: String(record.version || '').trim(),
    title: String(record.title || `${letter.toUpperCase()}.pdf`).trim(),
    fileType: String(record.fileType || PDF_FILE_TYPE).trim() || PDF_FILE_TYPE,
    savedFilePath: String(record.savedFilePath || '').trim(),
    savedAt: normalizeTimestamp(record.savedAt),
    updatedAt: normalizeTimestamp(record.updatedAt),
  };
}

function normalizeLocalAssetMap(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return Object.keys(source).reduce((acc, key) => {
    const normalized = normalizeLocalAssetRecord(source[key]);
    if (!normalized.assetKey || !normalized.letter) return acc;
    acc[normalized.assetKey] = normalized;
    return acc;
  }, {});
}

function readLocalAssetMap() {
  return normalizeLocalAssetMap(readStorage(STORAGE_KEYS.downloadAssets, {}));
}

function writeLocalAssetMap(nextMap) {
  return writeStorage(STORAGE_KEYS.downloadAssets, normalizeLocalAssetMap(nextMap));
}

function removeLocalAsset(assetKey) {
  const current = readLocalAssetMap();
  if (!current[assetKey]) return current;
  const next = { ...current };
  delete next[assetKey];
  writeLocalAssetMap(next);
  return next;
}

function upsertLocalAsset(recordInput) {
  const record = normalizeLocalAssetRecord(recordInput);
  if (!record.assetKey) return readLocalAssetMap();
  const current = readLocalAssetMap();
  const next = {
    ...current,
    [record.assetKey]: record,
  };
  writeLocalAssetMap(next);
  return next;
}

function normalizeDownloadBenefits(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    isFreeAccess: true,
    isLifetimeMember: false,
    creditBalance: 0,
    latestOrderStatus: String(source.latestOrderStatus || '').trim(),
    latestOrderSku: String(source.latestOrderSku || '').trim(),
    latestOrderUpdatedAt: normalizeTimestamp(source.latestOrderUpdatedAt),
    availableLocalCount: Math.max(0, Math.round(Number(source.availableLocalCount || 0))),
  };
}

function readCachedBenefits() {
  return normalizeDownloadBenefits(readStorage(STORAGE_KEYS.downloadBenefits, {}));
}

function writeCachedBenefits(input) {
  const normalized = normalizeDownloadBenefits(input);
  writeStorage(STORAGE_KEYS.downloadBenefits, normalized);
  return normalized;
}

function normalizeRecentOrder(orderInput = {}) {
  const order = orderInput && typeof orderInput === 'object' ? orderInput : {};
  return {
    orderNo: String(order.orderNo || '').trim(),
    sku: String(order.sku || '').trim(),
    title: String(order.title || '').trim(),
    amountFen: Math.max(0, Math.round(Number(order.amountFen || 0))),
    status: String(order.status || '').trim(),
    createdAt: normalizeTimestamp(order.createdAt),
    updatedAt: normalizeTimestamp(order.updatedAt),
  };
}

function normalizeRecentOrders(input) {
  return (Array.isArray(input) ? input : [])
    .map((item) => normalizeRecentOrder(item))
    .filter((item) => item.orderNo);
}

function readCachedOrders() {
  return normalizeRecentOrders(readStorage(STORAGE_KEYS.downloadOrders, []));
}

function writeCachedOrders(input) {
  const normalized = normalizeRecentOrders(input);
  writeStorage(STORAGE_KEYS.downloadOrders, normalized);
  return normalized;
}

function normalizeCatalogAsset(assetInput = {}) {
  const asset = assetInput && typeof assetInput === 'object' ? assetInput : {};
  const inferredLetter = String(asset.letter || asset.assetKey || '')
    .trim()
    .toLowerCase()
    .replace(/^pdf-/, '')
    .slice(0, 1);
  const fallback = buildFallbackAsset(inferredLetter || 'a');
  return {
    assetKey: String(asset.assetKey || fallback.assetKey)
      .trim()
      .toLowerCase(),
    letter: String(asset.letter || fallback.letter)
      .trim()
      .toLowerCase(),
    label: String(asset.label || fallback.label).trim() || fallback.label,
    coveredLetters: normalizeCoveredLetters(asset.coveredLetters, asset.letter || fallback.letter),
    title: String(asset.title || fallback.title).trim() || fallback.title,
    version: String(asset.version || '').trim(),
    size: Math.max(0, Math.round(Number(asset.size || 0))),
    fileType: String(asset.fileType || PDF_FILE_TYPE).trim() || PDF_FILE_TYPE,
    canDownload: asset.canDownload !== false,
    updatedAt: normalizeTimestamp(asset.updatedAt),
    isAvailableLocally: Boolean(asset.isAvailableLocally),
    localVersion: String(asset.localVersion || '').trim(),
    localPath: String(asset.localPath || '').trim(),
  };
}

function normalizeCatalogAssetList(input) {
  return (Array.isArray(input) ? input : [])
    .map((item) => normalizeCatalogAsset(item))
    .filter((item) => item.assetKey)
    .sort((left, right) => left.letter.localeCompare(right.letter));
}

function normalizeCatalogAssets(input) {
  const source = normalizeCatalogAssetList(input);
  if (!source.length) {
    return buildFallbackCatalog();
  }

  const coveredLetters = new Set(
    source.flatMap((asset) =>
      Array.isArray(asset.coveredLetters) && asset.coveredLetters.length
        ? asset.coveredLetters
        : [asset.letter],
    ),
  );
  const assetMap = {};

  source.forEach((normalized) => {
    assetMap[normalized.assetKey] = {
      ...assetMap[normalized.assetKey],
      ...normalized,
    };
  });

  LETTERS.forEach((letter) => {
    if (coveredLetters.has(letter)) return;
    const fallbackAsset = buildFallbackAsset(letter);
    assetMap[fallbackAsset.assetKey] = fallbackAsset;
  });

  return Object.values(assetMap).sort((left, right) => {
    const letterDiff = left.letter.localeCompare(right.letter);
    if (letterDiff !== 0) return letterDiff;
    return left.title.localeCompare(right.title, 'zh-Hans-CN');
  });
}

function countLocalAssets(assets) {
  return assets.reduce((sum, asset) => sum + (asset.isAvailableLocally ? 1 : 0), 0);
}

function formatBytes(size) {
  const normalized = Math.max(0, Number(size || 0));
  if (!normalized) return '0 KB';
  if (normalized >= 1024 * 1024) {
    return `${(normalized / (1024 * 1024)).toFixed(normalized >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  return `${Math.max(1, Math.round(normalized / 1024))} KB`;
}

function formatAmountFen(amountFen) {
  return (Math.max(0, Number(amountFen || 0)) / 100).toFixed(2);
}

function getNow() {
  return normalizeTimestamp(downloadDeps.now ? downloadDeps.now() : Date.now(), Date.now());
}

function getSystemInfoSafe() {
  const uniApi = getUniApi();
  if (!uniApi || typeof uniApi.getSystemInfoSync !== 'function') {
    return {};
  }
  try {
    return uniApi.getSystemInfoSync() || {};
  } catch (error) {
    return {};
  }
}

export function getPurchaseCapability() {
  const systemInfo = getSystemInfoSafe();
  const platformText = [
    systemInfo.platform,
    systemInfo.system,
    systemInfo.osName,
    systemInfo.deviceBrand,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const isIos =
    platformText.includes('ios') ||
    platformText.includes('iphone') ||
    platformText.includes('ipad');

  if (isIos) {
    return {
      canPurchase: false,
      reason: 'iPhone 端暂不开放购买，可使用已解锁权益下载。',
      platform: 'ios',
    };
  }

  return {
    canPurchase: true,
    reason: '',
    platform: String(systemInfo.platform || 'unknown').trim() || 'unknown',
  };
}

function hasDownloadApi() {
  const uniApi = getUniApi();
  return Boolean(uniApi && typeof uniApi.downloadFile === 'function');
}

function hasDocumentApi() {
  const uniApi = getUniApi();
  return Boolean(
    uniApi &&
    typeof uniApi.saveFile === 'function' &&
    typeof uniApi.openDocument === 'function' &&
    typeof uniApi.getSavedFileInfo === 'function',
  );
}

function callUniMethod(methodName, options = {}) {
  const uniApi = getUniApi();
  if (!uniApi || typeof uniApi[methodName] !== 'function') {
    return Promise.reject(new Error(`${methodName} is unavailable in the current environment.`));
  }

  return new Promise((resolve, reject) => {
    uniApi[methodName]({
      ...options,
      success: (result) => resolve(result || {}),
      fail: (error) => {
        const nextError =
          error instanceof Error
            ? error
            : new Error(String(error?.errMsg || error || 'Operation failed.'));
        nextError.details = error;
        reject(nextError);
      },
    });
  });
}

async function verifySavedFile(savedFilePath) {
  if (!savedFilePath || !hasDocumentApi()) return false;
  try {
    await callUniMethod('getSavedFileInfo', { filePath: savedFilePath });
    return true;
  } catch (error) {
    return false;
  }
}

async function removeSavedFileQuietly(savedFilePath) {
  const uniApi = getUniApi();
  if (!savedFilePath || !uniApi || typeof uniApi.removeSavedFile !== 'function') return;
  try {
    await callUniMethod('removeSavedFile', { filePath: savedFilePath });
  } catch (error) {
    // Best effort cleanup only.
  }
}

async function enrichAssetsWithLocalState(assetsInput) {
  const assets = normalizeCatalogAssets(assetsInput);
  const localMap = readLocalAssetMap();
  const nextAssets = [];

  for (const asset of assets) {
    const localRecord = localMap[asset.assetKey];
    let isAvailableLocally = false;
    let localPath = '';
    let localVersion = '';

    if (
      localRecord &&
      localRecord.version &&
      localRecord.savedFilePath &&
      localRecord.version === asset.version
    ) {
      isAvailableLocally = await verifySavedFile(localRecord.savedFilePath);
      if (isAvailableLocally) {
        localPath = localRecord.savedFilePath;
        localVersion = localRecord.version;
      } else {
        removeLocalAsset(asset.assetKey);
      }
    }

    nextAssets.push({
      ...asset,
      isAvailableLocally,
      localPath,
      localVersion,
    });
  }

  return nextAssets;
}

function buildBenefitSummary(benefitsInput = {}) {
  const benefits = normalizeDownloadBenefits(benefitsInput);
  if (benefits.isFreeAccess) {
    return '全部 PDF 已开放免费下载';
  }
  if (benefits.isLifetimeMember) {
    return '永久会员 · 无限下载';
  }
  if (benefits.creditBalance > 0) {
    return `剩余 ${benefits.creditBalance} 次下载`;
  }
  return '未开通下载权益';
}

function ensureCloudLinked() {
  if (!downloadDeps.authService.isLoggedIn()) {
    const error = new Error('请先登录后再使用下载功能。');
    error.code = 'NOT_LOGGED_IN';
    throw error;
  }

  if (!downloadDeps.authService.isCloudLinked()) {
    const error = new Error('当前账号还没有连接云端，请在 uniCloud 可用环境中登录后再试。');
    error.code = 'CLOUD_SYNC_UNAVAILABLE';
    throw error;
  }
}

export function getAlphabetAssetKeys() {
  return LETTERS.map((letter) => buildAssetKey(letter));
}

export function getCachedDownloadOverview() {
  const assets = normalizeCatalogAssets(buildFallbackCatalog());
  const benefits = normalizeDownloadBenefits(readCachedBenefits());
  return {
    assets,
    downloadBenefits: benefits,
    recentOrders: readCachedOrders(),
    benefitSummary: buildBenefitSummary(benefits),
    purchaseCapability: getPurchaseCapability(),
  };
}

export function applySnapshotDownloadBenefits(snapshotInput = {}) {
  const snapshot = snapshotInput && typeof snapshotInput === 'object' ? snapshotInput : {};
  if (!snapshot.downloadBenefits) return readCachedBenefits();
  return writeCachedBenefits(snapshot.downloadBenefits);
}

export async function refreshDownloadCenterState(options = {}) {
  const { includeOrders = true } = options;
  let assets = buildFallbackCatalog();
  let downloadBenefits = readCachedBenefits();
  let recentOrders = includeOrders ? readCachedOrders() : [];
  let paymentMode = 'disabled';
  let purchaseUnavailableReason = '';
  let purchaseEnabled = false;

  if (downloadDeps.authService.isCloudLinked()) {
    const [catalogResult, orderResult] = await Promise.all([
      downloadDeps.callCloudFunction('getDownloadCatalog', {}, { requiresAuth: true }),
      includeOrders
        ? downloadDeps.callCloudFunction('listDownloadOrders', { limit: 8 }, { requiresAuth: true })
        : Promise.resolve({ ok: true, orders: recentOrders }),
    ]);

    assets = normalizeCatalogAssets(catalogResult.assets);
    downloadBenefits = normalizeDownloadBenefits(catalogResult.downloadBenefits);
    paymentMode = String(catalogResult.paymentMode || '').trim() || 'disabled';
    if (paymentMode === 'free') {
      downloadBenefits = normalizeDownloadBenefits({
        ...downloadBenefits,
        isFreeAccess: true,
        isLifetimeMember: false,
        creditBalance: 0,
      });
    }
    purchaseUnavailableReason = String(catalogResult.purchaseUnavailableReason || '').trim();
    purchaseEnabled = Boolean(catalogResult.purchaseEnabled);
    recentOrders = normalizeRecentOrders(orderResult.orders);

    writeCachedBenefits(downloadBenefits);
    if (includeOrders) {
      writeCachedOrders(recentOrders);
    }
  }

  const enrichedAssets = await enrichAssetsWithLocalState(assets);
  const nextBenefits = writeCachedBenefits({
    ...downloadBenefits,
    availableLocalCount: countLocalAssets(enrichedAssets),
  });

  return {
    assets: enrichedAssets,
    downloadBenefits: nextBenefits,
    recentOrders,
    benefitSummary: buildBenefitSummary(nextBenefits),
    paymentMode,
    purchaseEnabled,
    purchaseUnavailableReason,
    purchaseCapability: getPurchaseCapability(),
  };
}

export function estimateSelection(input = {}) {
  const assets = normalizeCatalogAssets(input.assets);
  const selectedAssetKeys = Array.isArray(input.selectedAssetKeys) ? input.selectedAssetKeys : [];
  const selectedSet = new Set(selectedAssetKeys);

  const selectedAssets = assets.filter((asset) => selectedSet.has(asset.assetKey));
  const pendingAssets = selectedAssets.filter((asset) => !asset.isAvailableLocally);
  const estimatedCredits = 0;
  const canProceed = true;

  return {
    selectedCount: selectedAssets.length,
    pendingCount: pendingAssets.length,
    alreadyAvailableCount: selectedAssets.length - pendingAssets.length,
    estimatedCredits,
    totalSizeLabel: formatBytes(
      selectedAssets.reduce((sum, asset) => sum + Math.max(0, Number(asset.size || 0)), 0),
    ),
    canProceed,
  };
}

function normalizeTicketAsset(assetInput = {}) {
  const asset = assetInput && typeof assetInput === 'object' ? assetInput : {};
  return {
    ticketId: String(asset.ticketId || '').trim(),
    assetKey: String(asset.assetKey || '')
      .trim()
      .toLowerCase(),
    letter: String(asset.letter || '')
      .trim()
      .toLowerCase(),
    title: String(asset.title || '').trim(),
    version: String(asset.version || '').trim(),
    size: Math.max(0, Math.round(Number(asset.size || 0))),
    fileType: String(asset.fileType || PDF_FILE_TYPE).trim() || PDF_FILE_TYPE,
    fileId: String(asset.fileId || '').trim(),
    cloudPath: String(asset.cloudPath || asset.storagePath || '').trim(),
    downloadUrl: String(asset.downloadUrl || '').trim(),
    expiresAt: normalizeTimestamp(asset.expiresAt),
  };
}

function buildSelectionClientVersions(assets, selectedAssetKeys) {
  const assetMap = normalizeCatalogAssets(assets).reduce((acc, asset) => {
    acc[asset.assetKey] = asset;
    return acc;
  }, {});

  return selectedAssetKeys.reduce((acc, assetKey) => {
    const asset = assetMap[assetKey];
    if (asset && asset.isAvailableLocally && asset.localVersion) {
      acc.push({
        assetKey: asset.assetKey,
        version: asset.localVersion,
      });
    }
    return acc;
  }, []);
}

function isHttpUrl(input) {
  return /^https?:\/\//i.test(String(input || '').trim());
}

async function resolveTicketDownloadUrl(asset) {
  const existingUrl = String(asset.downloadUrl || '').trim();
  if (existingUrl) return existingUrl;

  const fileId = String(asset.fileId || '').trim();
  if (isHttpUrl(fileId)) return fileId;

  const cloudPath = String(asset.cloudPath || '').trim();
  const fileList = Array.from(new Set([fileId, cloudPath].filter(Boolean)));
  if (!fileList.length) {
    throw new Error('PDF 下载链接缺少文件标识，请检查下载目录配置。');
  }

  const uniCloudApi = getUniCloudApi();
  if (!uniCloudApi || typeof uniCloudApi.getTempFileURL !== 'function') {
    throw new Error(
      '当前环境无法生成 PDF 下载链接，请在绑定 uniCloud 的微信开发者工具或真机中重试。',
    );
  }

  const result = await uniCloudApi.getTempFileURL({
    fileList,
  });
  const fileItems = Array.isArray(result && result.fileList) ? result.fileList : [];
  const matchedItem =
    fileItems.find((item) => {
      const itemFileId = String(item.fileID || item.fileId || '').trim();
      return itemFileId && fileList.includes(itemFileId);
    }) || fileItems.find((item) => String(item.tempFileURL || item.tempFileUrl || '').trim());
  const tempFileURL = String(
    (matchedItem && (matchedItem.tempFileURL || matchedItem.tempFileUrl)) || '',
  ).trim();
  if (!tempFileURL) {
    const failedMessage = fileItems
      .map((item) => String(item.errMsg || item.message || item.code || '').trim())
      .filter(Boolean)
      .join('; ');
    throw new Error(
      `无法生成 ${asset.title || 'PDF'} 的下载链接${failedMessage ? `：${failedMessage}` : '，请确认云存储文件路径和权限。'}`,
    );
  }

  return tempFileURL;
}

function getErrorMessage(error, fallback) {
  return String(
    (error && (error.message || error.errMsg || error.msg)) ||
      (error && error.details && (error.details.errMsg || error.details.message)) ||
      fallback ||
      '下载失败',
  )
    .replace(/\s+/g, ' ')
    .trim();
}

async function downloadRemoteAsset(asset, attempt = 1) {
  let tempFilePath = '';
  let savedFilePath = '';

  try {
    const downloadUrl = await resolveTicketDownloadUrl(asset);
    let downloadResult = {};
    try {
      downloadResult = await callUniMethod('downloadFile', {
        url: downloadUrl,
      });
    } catch (error) {
      throw new Error(`PDF 下载请求失败：${getErrorMessage(error, 'downloadFile failed')}`);
    }
    if (Number(downloadResult.statusCode || 200) >= 400) {
      throw new Error(`PDF 下载链接请求失败，状态码 ${downloadResult.statusCode}。`);
    }
    tempFilePath = String(downloadResult.tempFilePath || '').trim();
    if (!tempFilePath) {
      throw new Error(
        `PDF 下载没有返回临时文件路径，状态码 ${downloadResult.statusCode || '未知'}。`,
      );
    }

    let saveResult = {};
    try {
      saveResult = await callUniMethod('saveFile', {
        tempFilePath,
      });
    } catch (error) {
      throw new Error(`PDF 保存失败：${getErrorMessage(error, 'saveFile failed')}`);
    }
    savedFilePath = String(saveResult.savedFilePath || '').trim();
    if (!savedFilePath) {
      throw new Error('PDF 保存失败，请检查存储权限。');
    }

    upsertLocalAsset({
      assetKey: asset.assetKey,
      letter: asset.letter,
      title: asset.title,
      version: asset.version,
      fileType: asset.fileType,
      savedFilePath,
      savedAt: getNow(),
      updatedAt: getNow(),
    });

    let confirmResult = { downloadBenefits: readCachedBenefits() };
    try {
      confirmResult = await downloadDeps.callCloudFunction(
        'confirmDownloadSuccess',
        {
          ticketId: asset.ticketId,
        },
        { requiresAuth: true },
      );
    } catch (error) {
      confirmResult = { downloadBenefits: readCachedBenefits() };
    }

    return {
      ok: true,
      assetKey: asset.assetKey,
      title: asset.title,
      savedFilePath,
      downloadBenefits: normalizeDownloadBenefits(confirmResult.downloadBenefits),
      attempt,
    };
  } catch (error) {
    if (savedFilePath) {
      await removeSavedFileQuietly(savedFilePath);
    }
    if (attempt < DOWNLOAD_RETRY_COUNT) {
      return downloadRemoteAsset(asset, attempt + 1);
    }
    throw error;
  }
}

export async function downloadSelectedAssets(input = {}) {
  ensureCloudLinked();

  if (!hasDownloadApi() || !hasDocumentApi()) {
    const error = new Error('当前环境不支持文件下载，请在微信开发者工具或真机中重试。');
    error.code = 'DOWNLOAD_API_UNAVAILABLE';
    throw error;
  }

  const assets = normalizeCatalogAssets(input.assets);
  const selectedAssetKeys = Array.isArray(input.selectedAssetKeys) ? input.selectedAssetKeys : [];
  const onProgress = typeof input.onProgress === 'function' ? input.onProgress : null;

  if (!selectedAssetKeys.length) {
    const error = new Error('请先选择要下载的词根资料。');
    error.code = 'DOWNLOAD_SELECTION_EMPTY';
    throw error;
  }

  const ticketResult = await downloadDeps.callCloudFunction(
    'createDownloadTickets',
    {
      assetKeys: selectedAssetKeys,
      localVersions: buildSelectionClientVersions(assets, selectedAssetKeys),
    },
    { requiresAuth: true },
  );

  let latestBenefits = normalizeDownloadBenefits(ticketResult.downloadBenefits);
  const pendingAssets = (
    Array.isArray(ticketResult.pendingAssets) ? ticketResult.pendingAssets : []
  ).map((item) => normalizeTicketAsset(item));
  const skippedAssets = normalizeCatalogAssetList(ticketResult.skippedAssets);
  const successes = [];
  const failures = [];

  for (let index = 0; index < pendingAssets.length; index += 1) {
    const asset = pendingAssets[index];
    if (onProgress) {
      onProgress({
        phase: 'downloading',
        current: index + 1,
        total: pendingAssets.length,
        asset,
      });
    }

    try {
      const result = await downloadRemoteAsset(asset, 1);
      latestBenefits = normalizeDownloadBenefits(result.downloadBenefits || latestBenefits);
      writeCachedBenefits({
        ...latestBenefits,
      });
      successes.push(result);
    } catch (error) {
      failures.push({
        assetKey: asset.assetKey,
        title: asset.title,
        message: error.message || '下载失败',
      });
    }
  }

  const enrichedAssets = await enrichAssetsWithLocalState(assets);
  const finalBenefits = writeCachedBenefits({
    ...latestBenefits,
    availableLocalCount: countLocalAssets(enrichedAssets),
  });

  return {
    ok: failures.length === 0,
    successes,
    failures,
    skippedAssets,
    downloadBenefits: finalBenefits,
    summary: {
      successCount: successes.length,
      failureCount: failures.length,
      skippedCount: skippedAssets.length,
    },
  };
}

export async function openDownloadedAsset(assetInput = {}) {
  const asset = normalizeCatalogAsset(assetInput);
  const localMap = readLocalAssetMap();
  const localRecord = localMap[asset.assetKey];
  if (!localRecord || !localRecord.savedFilePath) {
    const error = new Error('本机还没有这份 PDF，请先下载。');
    error.code = 'LOCAL_ASSET_MISSING';
    throw error;
  }

  const isValid = await verifySavedFile(localRecord.savedFilePath);
  if (!isValid) {
    removeLocalAsset(asset.assetKey);
    const error = new Error('本地文件已失效，请重新下载。');
    error.code = 'LOCAL_ASSET_STALE';
    throw error;
  }

  await callUniMethod('openDocument', {
    filePath: localRecord.savedFilePath,
    fileType: asset.fileType || PDF_FILE_TYPE,
    showMenu: true,
  });

  return {
    ok: true,
    filePath: localRecord.savedFilePath,
  };
}

export function getLocalAssetRecord(assetKey) {
  const normalizedAssetKey = String(assetKey || '')
    .trim()
    .toLowerCase();
  if (!normalizedAssetKey) return null;
  return readLocalAssetMap()[normalizedAssetKey] || null;
}

function requestVirtualPayment(paymentParams = {}) {
  const wxApi = getWxApi();
  if (!wxApi || typeof wxApi.requestVirtualPayment !== 'function') {
    return Promise.reject(new Error('当前环境不支持微信虚拟支付。'));
  }

  return new Promise((resolve, reject) => {
    wxApi.requestVirtualPayment({
      ...paymentParams,
      success: (result) => resolve(result || {}),
      fail: (error) =>
        reject(
          error instanceof Error
            ? error
            : new Error(String(error?.errMsg || error || '虚拟支付失败。')),
        ),
    });
  });
}

export async function purchaseSku(sku, options = {}) {
  ensureCloudLinked();

  const capability = getPurchaseCapability();
  if (!capability.canPurchase) {
    const error = new Error(capability.reason || '当前设备暂不支持购买。');
    error.code = 'PURCHASE_UNAVAILABLE';
    throw error;
  }

  const orderResult = await downloadDeps.callCloudFunction(
    'createPurchaseOrder',
    {
      sku,
      source: String(options.source || 'downloads').trim() || 'downloads',
      clientPlatform: capability.platform,
    },
    { requiresAuth: true },
  );

  if (orderResult.paymentAction === 'wechat_virtual_payment' && orderResult.paymentParams) {
    await requestVirtualPayment(orderResult.paymentParams);
  }

  const nextBenefits = normalizeDownloadBenefits(
    orderResult.downloadBenefits || readCachedBenefits(),
  );
  writeCachedBenefits(nextBenefits);

  if (Array.isArray(orderResult.recentOrders)) {
    writeCachedOrders(orderResult.recentOrders);
  }

  return {
    ...orderResult,
    downloadBenefits: nextBenefits,
    amountLabel: formatAmountFen(orderResult.amountFen),
  };
}

export function getBenefitSummary(input = {}) {
  return buildBenefitSummary(input);
}

export const pricingCards = Object.freeze([
  {
    sku: DOWNLOAD_SKUS.lifetimeMember,
    title: '永久会员',
    description: '9.9 元成为永久会员，无限下载全部词根资料',
    amountFen: 990,
  },
  {
    sku: DOWNLOAD_SKUS.pdfPack30,
    title: '30 次次卡',
    description: '2 元购买 30 次 PDF 下载次数',
    amountFen: 200,
  },
]);

export const __TEST_ONLY__ = {
  buildFallbackCatalog,
  buildAssetKey,
  normalizeCatalogAssets,
  normalizeDownloadBenefits,
  normalizeLocalAssetMap,
  readLocalAssetMap,
  removeLocalAsset,
  upsertLocalAsset,
  resetState() {
    downloadDeps = { ...DEFAULT_DOWNLOAD_DEPS };
    writeStorage(STORAGE_KEYS.downloadAssets, {});
    writeStorage(STORAGE_KEYS.downloadBenefits, {});
    writeStorage(STORAGE_KEYS.downloadOrders, []);
  },
  setDeps(overrides = {}) {
    downloadDeps = {
      ...downloadDeps,
      ...(overrides && typeof overrides === 'object' ? overrides : {}),
    };
  },
};

export { DOWNLOAD_SKUS, formatAmountFen, formatBytes };

export default {
  __TEST_ONLY__,
  DOWNLOAD_SKUS,
  applySnapshotDownloadBenefits,
  downloadSelectedAssets,
  estimateSelection,
  formatAmountFen,
  formatBytes,
  getAlphabetAssetKeys,
  getBenefitSummary,
  getCachedDownloadOverview,
  getPurchaseCapability,
  openDownloadedAsset,
  pricingCards,
  purchaseSku,
  refreshDownloadCenterState,
};
