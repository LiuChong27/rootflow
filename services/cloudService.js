import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from './storage';

const DEFAULT_CLOUD_ENV_ID = 'replace-with-your-wx-cloud-env-id';

let cloudInitialized = false;

export function getCloudEnvId() {
  const storedValue = String(readStorage(STORAGE_KEYS.cloudEnvId, '') || '').trim();
  return storedValue || DEFAULT_CLOUD_ENV_ID;
}

export function isCloudConfigured() {
  const envId = getCloudEnvId();
  return Boolean(envId) && envId !== DEFAULT_CLOUD_ENV_ID;
}

export function canUseWeChatCloud() {
  return typeof wx !== 'undefined' && wx && typeof wx.cloud !== 'undefined';
}

export function initCloud() {
  if (!canUseWeChatCloud()) {
    return {
      ok: false,
      code: 'WX_CLOUD_UNAVAILABLE',
      message: 'The current environment does not support WeChat Cloud.',
    };
  }

  if (!isCloudConfigured()) {
    return {
      ok: false,
      code: 'WX_CLOUD_ENV_MISSING',
      message: 'Please configure the WeChat Cloud environment ID first.',
    };
  }

  if (cloudInitialized) {
    return { ok: true, envId: getCloudEnvId() };
  }

  wx.cloud.init({
    env: getCloudEnvId(),
    traceUser: true,
  });
  cloudInitialized = true;
  return { ok: true, envId: getCloudEnvId() };
}

export function setCloudEnvId(envId) {
  const normalized = String(envId || '').trim();
  if (!normalized) {
    removeStorage(STORAGE_KEYS.cloudEnvId);
    cloudInitialized = false;
    return '';
  }

  writeStorage(STORAGE_KEYS.cloudEnvId, normalized);
  cloudInitialized = false;
  return normalized;
}

export function resetCloudEnvId() {
  removeStorage(STORAGE_KEYS.cloudEnvId);
  cloudInitialized = false;
}

export function getCloudCapabilityStatus() {
  const initState = initCloud();
  return {
    configured: isCloudConfigured(),
    envId: getCloudEnvId(),
    canUseWeChatCloud: canUseWeChatCloud(),
    ok: Boolean(initState.ok),
    code: initState.code || '',
    message: initState.message || '',
  };
}

export function assertCloudReady() {
  const state = initCloud();
  if (!state.ok) {
    const error = new Error(state.message);
    error.code = state.code;
    throw error;
  }
}

export async function callCloudFunction(name, data = {}) {
  assertCloudReady();
  const response = await wx.cloud.callFunction({
    name,
    data,
  });

  const result = response && response.result ? response.result : {};
  if (result && result.ok === false) {
    const error = new Error(result.message || 'Cloud function failed');
    error.code = result.code || 'CLOUD_FUNCTION_ERROR';
    error.details = result.details || null;
    throw error;
  }

  return result;
}
