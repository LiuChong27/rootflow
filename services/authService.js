import { callCloudFunction, getCloudCapabilityStatus } from './cloudService';
import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from './storage';

function normalizeSession(sessionInput) {
  const session = sessionInput && typeof sessionInput === 'object' ? sessionInput : {};
  const loginMode = String(
    session.loginMode || (session.cloudLinked ? 'cloud' : session.userId ? 'local' : ''),
  );
  const userId = String(session.userId || session.openid || '');
  const cloudLinked = Boolean((session.cloudLinked || loginMode === 'cloud') && userId);
  return {
    openid: cloudLinked ? String(session.openid || userId) : String(session.openid || ''),
    userId,
    nickName: String(session.nickName || ''),
    avatarUrl: String(session.avatarUrl || ''),
    lastLoginAt: Number(session.lastLoginAt || 0),
    lastSyncAt: Number(session.lastSyncAt || 0),
    cloudLinked,
    loginMode,
  };
}

function setStoredSession(sessionInput) {
  const normalized = normalizeSession(sessionInput);
  writeStorage(STORAGE_KEYS.userSession, normalized);
  return normalized;
}

function hasProfileData(sessionInput) {
  const session = normalizeSession(sessionInput);
  return Boolean(session.nickName || session.avatarUrl);
}

function runUserProfilePrompt() {
  return new Promise((resolve) => {
    const request = {
      desc: 'Used to complete the RootFlow learning profile',
      success: (res) => resolve((res && res.userInfo) || {}),
      fail: () => resolve({}),
    };

    if (typeof uni !== 'undefined' && typeof uni.getUserProfile === 'function') {
      uni.getUserProfile(request);
      return;
    }

    if (typeof wx !== 'undefined' && typeof wx.getUserProfile === 'function') {
      wx.getUserProfile(request);
      return;
    }

    resolve({});
  });
}

function normalizeMessage(message) {
  return String(message || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function withFriendlyCloudError(error) {
  const source = error instanceof Error ? error : new Error(String(error || '云函数调用失败'));
  const message = normalizeMessage(source.message || '');
  const lowerMessage = message.toLowerCase();
  const code = String(source.code || '').trim();

  let friendlyMessage = message || '云函数调用失败，请稍后重试。';
  if (
    code === 'WEIXIN_CONFIG_MISSING' ||
    lowerMessage.includes('appid/appsecret') ||
    lowerMessage.includes('weixin config')
  ) {
    friendlyMessage = '云函数缺少微信配置，请在 uniCloud 配置小程序 appId/appSecret 并重新部署。';
  } else if (
    lowerMessage.includes('function') &&
    (lowerMessage.includes('not found') || lowerMessage.includes('does not exist'))
  ) {
    friendlyMessage =
      '登录云函数未部署，请在 HBuilderX 上传 authLogin、getUserSnapshot、saveUserProfile、syncProgress。';
  } else if (code === 'WEIXIN_CODE2SESSION_FAILED') {
    friendlyMessage = '微信登录换取会话失败，请检查云函数里的微信小程序 appId/appSecret 是否正确。';
  } else if (code === 'WEIXIN_LOGIN_CODE_MISSING') {
    friendlyMessage = '未获取到微信登录凭证，请在微信开发者工具或微信客户端内重试。';
  } else if (code === 'UNI_CLOUD_UNAVAILABLE') {
    friendlyMessage = '当前环境无法调用 uniCloud，请在 HBuilderX 中绑定并运行 uniCloud 服务空间。';
  }

  const nextError = new Error(friendlyMessage);
  nextError.code = code || 'CLOUD_FUNCTION_ERROR';
  nextError.details = source.details || null;
  nextError.rawMessage = message;
  return nextError;
}

function shouldRetryWeChatCodeExchange(error) {
  const code = String(error && error.code ? error.code : '').trim();
  const message = normalizeMessage(error && error.message ? error.message : '').toLowerCase();
  return code === 'WEIXIN_CODE2SESSION_FAILED' || message.includes('jscode2session');
}

function buildLocalUserId(session = getStoredSession()) {
  if (session && session.loginMode === 'local' && session.userId) {
    return session.userId;
  }
  return `local-wechat-${Date.now()}`;
}

function setLocalSession(profile = {}) {
  const currentSession = getStoredSession();
  return setStoredSession({
    ...currentSession,
    userId: buildLocalUserId(currentSession),
    openid: '',
    nickName: String(profile.nickName || currentSession.nickName || ''),
    avatarUrl: String(profile.avatarUrl || currentSession.avatarUrl || ''),
    lastLoginAt: Date.now(),
    cloudLinked: false,
    loginMode: 'local',
  });
}

export function getStoredSession() {
  return normalizeSession(readStorage(STORAGE_KEYS.userSession, {}));
}

export function isLoggedIn(sessionInput = getStoredSession()) {
  const session = normalizeSession(sessionInput);
  return Boolean(session.userId);
}

export function isCloudLinked(sessionInput = getStoredSession()) {
  const session = normalizeSession(sessionInput);
  return Boolean(session.cloudLinked && session.userId);
}

export function hasCompletedProfile(sessionInput = getStoredSession()) {
  return hasProfileData(sessionInput);
}

export function canPromptWeChatProfile() {
  return (
    (typeof uni !== 'undefined' && typeof uni.getUserProfile === 'function') ||
    (typeof wx !== 'undefined' && typeof wx.getUserProfile === 'function')
  );
}

export function getAuthCapability() {
  const capability = getCloudCapabilityStatus();
  if (!capability.canUseWeChatCloud) {
    return {
      ok: false,
      code: 'WX_CLOUD_UNAVAILABLE',
      message: 'Please open the app inside WeChat DevTools or the WeChat client.',
      canUseCloud: false,
      canUseUniCloud: false,
      canUseWeChatCloud: false,
    };
  }

  if (!capability.canUseUniCloud) {
    return {
      ok: true,
      code: capability.code || 'UNI_CLOUD_UNAVAILABLE',
      message:
        'WeChat local login is available. Cloud sync will be enabled after uniCloud is configured.',
      canUseCloud: false,
      canUseUniCloud: false,
      canUseWeChatCloud: true,
    };
  }

  return {
    ok: true,
    code: '',
    message: '',
    canUseCloud: true,
    canUseUniCloud: true,
    canUseWeChatCloud: true,
  };
}

export async function completeWeChatProfile() {
  const session = getStoredSession();
  if (!isLoggedIn(session)) {
    const error = new Error('Please complete WeChat login first.');
    error.code = 'NOT_LOGGED_IN';
    throw error;
  }

  if (!canPromptWeChatProfile()) {
    const error = new Error('Current environment does not support WeChat profile authorization.');
    error.code = 'WX_PROFILE_UNAVAILABLE';
    throw error;
  }

  const profile = await runUserProfilePrompt();
  if (!profile.nickName && !profile.avatarUrl) {
    return session;
  }

  if (!isCloudLinked(session)) {
    return setLocalSession(profile);
  }

  let profileResult;
  try {
    profileResult = await callCloudFunction(
      'saveUserProfile',
      {
        nickName: profile.nickName || '',
        avatarUrl: profile.avatarUrl || '',
      },
      { requiresAuth: true },
    );
  } catch (error) {
    throw withFriendlyCloudError(error);
  }

  const currentSession = getStoredSession();
  return setStoredSession({
    ...currentSession,
    ...profileResult.user,
    cloudLinked: true,
  });
}

export async function loginWithWeChatOneTap(options = {}) {
  const { withProfile = false } = options;
  const capability = getAuthCapability();
  if (!capability.ok) {
    const error = new Error(capability.message);
    error.code = capability.code;
    throw error;
  }

  if (!capability.canUseCloud) {
    if (withProfile && canPromptWeChatProfile()) {
      const profile = await runUserProfilePrompt();
      return setLocalSession(profile);
    }
    return setLocalSession();
  }

  let loginResult;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      loginResult = await callCloudFunction('authLogin', {}, { requiresAuth: true });
      break;
    } catch (error) {
      if (attempt < 2 && shouldRetryWeChatCodeExchange(error)) {
        continue;
      }
      throw withFriendlyCloudError(error);
    }
  }

  if (!loginResult || !loginResult.user || !loginResult.session) {
    throw withFriendlyCloudError(
      Object.assign(new Error('Cloud login result is missing required session fields.'), {
        code: 'AUTH_LOGIN_RESPONSE_INVALID',
      }),
    );
  }
  const baseSession = setStoredSession({
    ...loginResult.user,
    ...loginResult.session,
    cloudLinked: true,
  });

  if (!withProfile || !canPromptWeChatProfile()) {
    return baseSession;
  }

  try {
    return await completeWeChatProfile();
  } catch (error) {
    if (error && error.code === 'NOT_LOGGED_IN') {
      throw error;
    }
    return baseSession;
  }
}

export async function loginWithWeChatProfile() {
  return loginWithWeChatOneTap({ withProfile: true });
}

export async function fetchUserSnapshot() {
  const session = getStoredSession();
  if (!session.userId || !isCloudLinked(session)) {
    return {
      user: session,
      progressMap: {},
      activityDates: [],
      stats: null,
    };
  }

  let snapshot;
  try {
    snapshot = await callCloudFunction('getUserSnapshot', {}, { requiresAuth: true });
  } catch (error) {
    throw withFriendlyCloudError(error);
  }
  const nextSession = setStoredSession({
    ...session,
    ...snapshot.user,
    cloudLinked: true,
  });
  return {
    ...snapshot,
    user: nextSession,
  };
}

export function updateSessionSyncTime(timestamp = Date.now()) {
  const current = getStoredSession();
  return setStoredSession({
    ...current,
    lastSyncAt: Number(timestamp || Date.now()),
  });
}

export function logoutLocally() {
  removeStorage(STORAGE_KEYS.userSession);
}

export default {
  canPromptWeChatProfile,
  completeWeChatProfile,
  fetchUserSnapshot,
  getAuthCapability,
  getStoredSession,
  hasCompletedProfile,
  isCloudLinked,
  isLoggedIn,
  loginWithWeChatOneTap,
  loginWithWeChatProfile,
  logoutLocally,
  updateSessionSyncTime,
};
