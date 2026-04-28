import { STORAGE_KEYS, hasStorage, readStorage, removeStorage, writeStorage } from './storage';

const UNI_CLOUD_PROVIDER = 'uniCloud-aliyun';

function normalizeEnvId(input) {
  return String(input || '').trim();
}

function getDirectUniCloudReference() {
  if (typeof uniCloud !== 'undefined' && uniCloud) {
    return uniCloud;
  }
  return null;
}

function getUniCloudClient() {
  const directClient = getDirectUniCloudReference();
  if (directClient && typeof directClient.callFunction === 'function') {
    return directClient;
  }

  if (typeof globalThis === 'undefined') return null;

  const globalClient = globalThis.uniCloud;
  if (globalClient && typeof globalClient.callFunction === 'function') {
    return globalClient;
  }

  return null;
}

function canUseUniCloud() {
  return Boolean(getUniCloudClient());
}

function canUseWeChatLogin() {
  return Boolean(getWeChatLoginClient());
}

function getWeChatLoginClient() {
  if (typeof wx !== 'undefined' && wx && typeof wx.login === 'function') {
    return wx;
  }
  if (typeof uni !== 'undefined' && uni && typeof uni.login === 'function') {
    return uni;
  }
  return null;
}

function detectRuntimeEnvId() {
  const candidates = [
    getDirectUniCloudReference()?.spaceId,
    getDirectUniCloudReference()?.config?.spaceId,
    getDirectUniCloudReference()?.config?.spaceName,
    globalThis?.__uniConfig?.uniCloud?.spaceId,
    globalThis?.__uniConfig?.uniCloud?.[0]?.spaceId,
    globalThis?.__uniConfig?.uniCloud?.[0]?.spaceName,
    globalThis?.uniCloud?.spaceId,
    globalThis?.uniCloud?.config?.spaceId,
  ];
  return candidates.map(normalizeEnvId).find(Boolean) || '';
}

function getCallFunctionErrorMessage(error) {
  return String(
    (error && (error.errMsg || error.message || error.msg)) || 'Cloud function call failed.',
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCloudEnvId() {
  const storedEnvId = normalizeEnvId(readStorage(STORAGE_KEYS.cloudEnvId, ''));
  if (storedEnvId) return storedEnvId;

  const runtimeEnvId = detectRuntimeEnvId();
  if (runtimeEnvId) return runtimeEnvId;

  return '';
}

export function isCloudConfigured() {
  return Boolean(normalizeEnvId(getCloudEnvId()));
}

export function canUseWeChatCloud() {
  return canUseWeChatLogin();
}

export function initCloud() {
  const envId = getCloudEnvId();
  if (!canUseUniCloud()) {
    return {
      ok: false,
      code: 'UNI_CLOUD_UNAVAILABLE',
      message:
        'uniCloud is not available. Build this project with HBuilderX and bind a service space.',
    };
  }

  return {
    ok: true,
    envId,
    provider: UNI_CLOUD_PROVIDER,
  };
}

export function setCloudEnvId(nextEnvId = '') {
  const envId = normalizeEnvId(nextEnvId);
  if (!envId) return getCloudEnvId();

  writeStorage(STORAGE_KEYS.cloudEnvId, envId);
  return envId;
}

export function resetCloudEnvId() {
  if (hasStorage(STORAGE_KEYS.cloudEnvId)) {
    removeStorage(STORAGE_KEYS.cloudEnvId);
  }
  return '';
}

export function getCloudCapabilityStatus() {
  const envId = getCloudEnvId();
  const uniCloudReady = canUseUniCloud();
  const weChatReady = canUseWeChatLogin();
  const initState = initCloud();

  let code = '';
  let message = '';
  if (!uniCloudReady) {
    code = initState.code || 'UNI_CLOUD_UNAVAILABLE';
    message =
      initState.message ||
      'uniCloud is not available. Build this project with HBuilderX and bind a service space.';
  } else if (!weChatReady) {
    code = 'WX_CLOUD_UNAVAILABLE';
    message = 'Please open the app inside WeChat DevTools or the WeChat client.';
  }

  return {
    configured: Boolean(envId || uniCloudReady),
    envId,
    provider: UNI_CLOUD_PROVIDER,
    canUseUniCloud: uniCloudReady,
    canUseWeChatCloud: weChatReady,
    ok: Boolean(initState.ok) && weChatReady,
    code,
    message,
  };
}

export async function probeAuthCloudFunction() {
  assertCloudReady();

  const client = getUniCloudClient();
  if (!client) {
    return {
      ok: false,
      code: 'UNI_CLOUD_UNAVAILABLE',
      message: 'uniCloud client is unavailable.',
    };
  }

  try {
    const response = await client.callFunction({
      name: 'authLogin',
      data: {
        authCode: 'rootflow-probe-invalid-code',
      },
    });

    const result = response && response.result ? response.result : {};
    if (result && result.ok === false) {
      const code = String(result.code || '').trim();
      const message = String(result.message || '').trim();

      if (code === 'WEIXIN_CODE2SESSION_FAILED') {
        return {
          ok: true,
          code,
          message: 'authLogin 云函数可调用，已进入微信会话校验。',
        };
      }
      if (code === 'WEIXIN_CONFIG_MISSING') {
        return {
          ok: false,
          code,
          message: 'authLogin 云函数可调用，但云端缺少微信 appId/appSecret 配置。',
        };
      }
      return {
        ok: true,
        code: code || 'AUTH_PROBE_RETURNED_ERROR',
        message: message || 'authLogin 云函数已响应。',
      };
    }

    return {
      ok: true,
      code: '',
      message: 'authLogin 云函数调用成功。',
    };
  } catch (error) {
    const rawMessage = getCallFunctionErrorMessage(error);
    const lower = rawMessage.toLowerCase();
    const functionMissing =
      lower.includes('function') &&
      (lower.includes('not found') || lower.includes('does not exist'));

    return {
      ok: false,
      code: functionMissing ? 'AUTH_FUNCTION_NOT_DEPLOYED' : 'AUTH_FUNCTION_CALL_FAILED',
      message: functionMissing
        ? 'authLogin 云函数未部署，请在 HBuilderX 上传云函数后重试。'
        : rawMessage || 'authLogin 云函数调用失败。',
      rawMessage,
    };
  }
}

export function assertCloudReady() {
  const state = getCloudCapabilityStatus();
  if (!state.ok) {
    const error = new Error(state.message || 'uniCloud is unavailable.');
    error.code = state.code || 'UNI_CLOUD_UNAVAILABLE';
    throw error;
  }
}

function requestWeChatLoginCode() {
  return new Promise((resolve, reject) => {
    const client = getWeChatLoginClient();
    if (!client) {
      const error = new Error('Please open the app inside WeChat DevTools or the WeChat client.');
      error.code = 'WX_CLOUD_UNAVAILABLE';
      reject(error);
      return;
    }

    client.login({
      success: (res) => {
        const code = String((res && res.code) || '').trim();
        if (!code) {
          const error = new Error('WeChat login code was not returned.');
          error.code = 'WEIXIN_LOGIN_CODE_MISSING';
          reject(error);
          return;
        }
        resolve(code);
      },
      fail: (error) => {
        const nextError = new Error(
          (error && error.errMsg) || 'Failed to request a WeChat login code.',
        );
        nextError.code = 'WEIXIN_LOGIN_FAILED';
        reject(nextError);
      },
    });
  });
}

export async function callCloudFunction(name, data = {}, options = {}) {
  assertCloudReady();

  const client = getUniCloudClient();
  const payload = { ...(data && typeof data === 'object' ? data : {}) };
  if (options.requiresAuth) {
    payload.authCode = options.authCode || (await requestWeChatLoginCode());
  }

  const response = await client.callFunction({
    name,
    data: payload,
  });

  const result = response && response.result ? response.result : {};
  if (result && result.ok === false) {
    const error = new Error(result.message || 'uniCloud function call failed.');
    error.code = result.code || 'CLOUD_FUNCTION_ERROR';
    error.details = result.details || null;
    throw error;
  }

  return result;
}

export { UNI_CLOUD_PROVIDER };
export const CLOUD_STORAGE_KEY = STORAGE_KEYS.cloudEnvId;
