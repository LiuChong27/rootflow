const memoryStorage = Object.create(null);

export const STORAGE_KEYS = {
  cloudEnvId: 'rf_cloud_env_id',
  rootSeed: 'rf_root_seed',
  theme: 'user_theme',
  userSession: 'rf_user_session_v1',
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
