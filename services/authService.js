import { callCloudFunction, canUseWeChatCloud, initCloud, isCloudConfigured } from './cloudService';
import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from './storage';

function normalizeSession(sessionInput) {
  const session = sessionInput && typeof sessionInput === 'object' ? sessionInput : {};
  return {
    openid: String(session.openid || session.userId || ''),
    userId: String(session.userId || session.openid || ''),
    nickName: String(session.nickName || ''),
    avatarUrl: String(session.avatarUrl || ''),
    lastLoginAt: Number(session.lastLoginAt || 0),
    lastSyncAt: Number(session.lastSyncAt || 0),
    cloudLinked: Boolean(session.cloudLinked || session.openid || session.userId),
  };
}

function setStoredSession(sessionInput) {
  const normalized = normalizeSession(sessionInput);
  writeStorage(STORAGE_KEYS.userSession, normalized);
  return normalized;
}

function runUserProfilePrompt() {
  return new Promise((resolve) => {
    const request = {
      desc: 'Complete your RootFlow learning profile',
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

export function getStoredSession() {
  return normalizeSession(readStorage(STORAGE_KEYS.userSession, {}));
}

export function isLoggedIn() {
  const session = getStoredSession();
  return Boolean(session.cloudLinked && session.userId);
}

export function getAuthCapability() {
  const cloudInitState = initCloud();
  if (!canUseWeChatCloud()) {
    return {
      ok: false,
      code: 'WX_CLOUD_UNAVAILABLE',
      message: 'Please use real login inside the WeChat mini program environment.',
    };
  }

  if (!isCloudConfigured()) {
    return {
      ok: false,
      code: 'WX_CLOUD_ENV_MISSING',
      message: 'Please configure local storage key rf_cloud_env_id first.',
    };
  }

  if (!cloudInitState.ok) {
    return cloudInitState;
  }

  return {
    ok: true,
    code: '',
    message: '',
  };
}

export async function loginWithWeChatProfile() {
  const capability = getAuthCapability();
  if (!capability.ok) {
    const error = new Error(capability.message);
    error.code = capability.code;
    throw error;
  }

  const loginResult = await callCloudFunction('authLogin');
  const baseSession = setStoredSession({
    ...loginResult.user,
    ...loginResult.session,
    cloudLinked: true,
  });

  const profile = await runUserProfilePrompt();
  if (!profile.nickName && !profile.avatarUrl) {
    return baseSession;
  }

  const profileResult = await callCloudFunction('saveUserProfile', {
    nickName: profile.nickName || '',
    avatarUrl: profile.avatarUrl || '',
  });

  return setStoredSession({
    ...baseSession,
    ...profileResult.user,
    cloudLinked: true,
  });
}

export async function fetchUserSnapshot() {
  const session = getStoredSession();
  if (!session.userId) {
    return {
      user: session,
      progressMap: {},
      activityDates: [],
      stats: null,
    };
  }

  const snapshot = await callCloudFunction('getUserSnapshot');
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
  fetchUserSnapshot,
  getAuthCapability,
  getStoredSession,
  isLoggedIn,
  loginWithWeChatProfile,
  logoutLocally,
  updateSessionSyncTime,
};
