<template>
  <view class="theme-toggle-fab-wrap">
    <view
      class="theme-toggle-fab"
      :class="theme"
      @tap.stop.prevent="handleTogglePress"
      @click.stop.prevent="handleTogglePress"
    >
      <text class="theme-toggle-fab__value">{{ shortLabel }}</text>
      <text class="theme-toggle-fab__label">风格</text>
    </view>
  </view>
</template>

<script>
import { getThemeDisplayName, isNightTheme, toggleStoredTheme } from '../../services/themeService';

export default {
  props: {
    theme: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      lastToggleAt: 0,
    };
  },
  computed: {
    shortLabel() {
      return isNightTheme(this.theme) ? '夜' : '暖';
    },
    themeLabel() {
      return getThemeDisplayName(this.theme);
    },
  },
  methods: {
    handleTogglePress() {
      const now = Date.now();
      if (now - this.lastToggleAt < 280) return;
      this.lastToggleAt = now;
      const nextTheme = toggleStoredTheme();
      uni.showToast({
        title: getThemeDisplayName(nextTheme),
        icon: 'none',
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.theme-toggle-fab-wrap {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 16rpx);
  right: 24rpx;
  z-index: 120;
  pointer-events: none;
}

.theme-toggle-fab {
  width: 92rpx;
  min-height: 92rpx;
  padding: 12rpx 0;
  box-sizing: border-box;
  border-radius: 28rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  backdrop-filter: blur(14rpx);
  -webkit-backdrop-filter: blur(14rpx);
  pointer-events: auto;
}

.theme-toggle-fab__value {
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1;
}

.theme-toggle-fab__label {
  font-size: 16rpx;
  line-height: 1;
  letter-spacing: 2rpx;
}

.theme-toggle-fab.theme-dark-zen {
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  color: #f5f9ff;
}

.theme-toggle-fab.theme-clay-pastel {
  background: rgba(255, 255, 255, 0.58);
  border: 1rpx solid rgba(31, 41, 51, 0.08);
  color: #1f2933;
  box-shadow: 0 18rpx 46rpx rgba(15, 23, 42, 0.05);
}
</style>
