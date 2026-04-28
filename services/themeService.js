import { STORAGE_KEYS, readStorage, writeStorage } from './storage';

export const THEME_KEYS = {
  night: 'theme-dark-zen',
  warm: 'theme-clay-pastel',
};

const THEME_EVENT = 'rootflow:theme-change';

function canUseUniEvents() {
  return typeof uni !== 'undefined' && typeof uni.$emit === 'function';
}

export function normalizeTheme(theme) {
  return theme === THEME_KEYS.night ? THEME_KEYS.night : THEME_KEYS.warm;
}

export function getStoredTheme() {
  return normalizeTheme(readStorage(STORAGE_KEYS.theme, THEME_KEYS.night));
}

export function isNightTheme(theme) {
  return normalizeTheme(theme) === THEME_KEYS.night;
}

export function getThemeDisplayName(theme) {
  return isNightTheme(theme) ? '夜色禅意' : '暖雾奶油';
}

export function setStoredTheme(theme) {
  const nextTheme = normalizeTheme(theme);
  writeStorage(STORAGE_KEYS.theme, nextTheme);

  if (canUseUniEvents()) {
    uni.$emit(THEME_EVENT, nextTheme);
  }

  return nextTheme;
}

export function toggleStoredTheme() {
  return setStoredTheme(isNightTheme(getStoredTheme()) ? THEME_KEYS.warm : THEME_KEYS.night);
}

export function onThemeChange(handler) {
  if (!handler || typeof handler !== 'function') return;
  if (!canUseUniEvents() || typeof uni.$on !== 'function') return;
  uni.$on(THEME_EVENT, handler);
}

export function offThemeChange(handler) {
  if (!handler || typeof handler !== 'function') return;
  if (!canUseUniEvents() || typeof uni.$off !== 'function') return;
  uni.$off(THEME_EVENT, handler);
}
