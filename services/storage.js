const memoryStorage = Object.create(null);

export const STORAGE_KEYS = {
  cloudEnvId: 'rf_cloud_env_id',
  downloadBenefits: 'rf_download_benefits_v1',
  downloadOrders: 'rf_download_orders_v1',
  downloadAssets: 'rf_pdf_assets_v1',
  rootSeed: 'rf_root_seed',
  theme: 'user_theme',
  userSession: 'rf_user_session_v1',
  vibesProgress: 'rf_vibes_progress_v1',
  vibesGuideSeen: 'rf_vibes_guide_seen_v1',
  vibesFavorites: 'rf_vibes_favorites_v1',
  vibesHiddenEntries: 'rf_vibes_hidden_entries_v1',
};

function hasUniStorage() {
  return (
    typeof uni !== 'undefined' &&
    typeof uni.getStorageSync === 'function' &&
    typeof uni.setStorageSync === 'function' &&
    typeof uni.removeStorageSync === 'function'
  );
}

export function readStorage(key, fallbackValue = '') {
  if (!hasUniStorage()) {
    return Object.prototype.hasOwnProperty.call(memoryStorage, key)
      ? memoryStorage[key]
      : fallbackValue;
  }

  const value = uni.getStorageSync(key);
  return value === '' || typeof value === 'undefined' ? fallbackValue : value;
}

export function writeStorage(key, value) {
  if (!hasUniStorage()) {
    memoryStorage[key] = value;
    return value;
  }

  uni.setStorageSync(key, value);
  return value;
}

export function removeStorage(key) {
  if (!hasUniStorage()) {
    delete memoryStorage[key];
    return;
  }

  uni.removeStorageSync(key);
}

export function hasStorage(key) {
  if (!hasUniStorage()) {
    return Object.prototype.hasOwnProperty.call(memoryStorage, key);
  }

  const value = uni.getStorageSync(key);
  return value !== '' && typeof value !== 'undefined';
}
