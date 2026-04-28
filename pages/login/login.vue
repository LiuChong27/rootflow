<template>
  <view class="login-page" :class="currentTheme">
    <theme-toggle-fab :theme="currentTheme" />

    <view class="login-card">
      <image class="login-card__logo" src="/static/logo.png" mode="aspectFill" />

      <view class="login-copy">
        <text class="login-copy__title">微信登录 RootFlow</text>
        <text class="login-copy__subtitle"
          >登录后可同步学习进度，并免费下载词根资料库中的全部 PDF。</text
        >
      </view>

      <view class="agreement-row" @tap="toggleAgreement">
        <view class="agreement-check" :class="{ 'is-active': agreed }">
          <text v-if="agreed">✓</text>
        </view>
        <view class="agreement-text">
          <text>已阅读并同意</text>
          <text class="agreement-link" @tap.stop="openUserAgreement">《用户协议》</text>
          <text>和</text>
          <text class="agreement-link" @tap.stop="openPrivacyPolicy">《隐私政策》</text>
        </view>
      </view>

      <button
        class="login-button"
        :disabled="isLoggingIn || userInfo.isLogged || !agreed"
        @tap="handleLogin"
      >
        {{ buttonText }}
      </button>

      <text v-if="redirectUrl" class="redirect-tip">登录成功后将自动返回下载中心</text>
    </view>
  </view>
</template>

<script>
import themePage from '../../mixins/themePage';
import authService from '../../services/authService';

const TAB_PAGE_PATHS = new Set([
  '/pages/today/today',
  '/pages/roots/roots',
  '/pages/vibes/vibes',
  '/pages/my/my',
]);

function buildUserState(session = authService.getStoredSession()) {
  return {
    isLogged: Boolean(session.userId),
  };
}

function decodeRedirectUrl(input) {
  const value = String(input || '').trim();
  if (!value) return '';

  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

export default {
  mixins: [themePage],
  data() {
    return {
      userInfo: buildUserState(),
      isLoggingIn: false,
      agreed: false,
      redirectUrl: '',
    };
  },
  computed: {
    buttonText() {
      if (this.userInfo.isLogged) return '已登录';
      if (this.isLoggingIn) return '登录中...';
      return '微信一键登录';
    },
  },
  onLoad(query = {}) {
    this.redirectUrl = decodeRedirectUrl(query.redirect);
  },
  onShow() {
    this.userInfo = buildUserState();
    if (this.userInfo.isLogged && this.redirectUrl) {
      this.redirectAfterLogin();
    }
  },
  methods: {
    toggleAgreement() {
      this.agreed = !this.agreed;
    },
    openUserAgreement() {
      uni.navigateTo({ url: '/pages/agreement/user-agreement' });
    },
    openPrivacyPolicy() {
      uni.navigateTo({ url: '/pages/agreement/privacy-policy' });
    },
    getResolvedRedirectUrl() {
      return this.redirectUrl || '/pages/my/my';
    },
    redirectAfterLogin() {
      const target = this.getResolvedRedirectUrl();
      const pagePath = target.split('?')[0];

      if (TAB_PAGE_PATHS.has(pagePath)) {
        uni.switchTab({
          url: pagePath,
          fail: () => {
            uni.reLaunch({ url: pagePath });
          },
        });
        return;
      }

      uni.redirectTo({
        url: target,
        fail: () => {
          uni.reLaunch({ url: target });
        },
      });
    },
    async handleLogin() {
      if (this.userInfo.isLogged || this.isLoggingIn || !this.agreed) return;

      this.isLoggingIn = true;
      uni.showLoading({ title: '登录中...' });
      try {
        await authService.loginWithWeChatOneTap();
        this.userInfo = buildUserState();
        uni.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => {
          this.redirectAfterLogin();
        }, 300);
      } catch (error) {
        uni.showToast({ title: error.message || '登录失败', icon: 'none' });
      } finally {
        this.isLoggingIn = false;
        uni.hideLoading();
      }
    },
  },
};
</script>

<style lang="scss">
.login-page {
  min-height: 100vh;
  padding: 112rpx 28rpx 44rpx;
  box-sizing: border-box;
  background: var(--rf-page-bg);
  color: var(--rf-page-text);
  display: flex;
  align-items: center;
}

.login-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 36rpx;
  padding: 52rpx 32rpx;
  border-radius: 36rpx;
  background: var(--rf-surface);
  border: 1rpx solid var(--rf-border);
  box-shadow: var(--rf-card-shadow);
}

.login-card__logo {
  width: 176rpx;
  height: 176rpx;
  border-radius: 44rpx;
  box-shadow: var(--rf-card-shadow);
}

.login-copy {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  align-items: center;
  text-align: center;
}

.login-copy__title {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--rf-text-strong);
}

.login-copy__subtitle {
  font-size: 24rpx;
  line-height: 1.7;
  color: var(--rf-text-muted);
}

.agreement-row {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}

.agreement-check {
  width: 34rpx;
  height: 34rpx;
  margin-top: 4rpx;
  border-radius: 10rpx;
  border: 1rpx solid var(--rf-border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 20rpx;
}

.agreement-check.is-active {
  background: #22c55e;
  border-color: #22c55e;
}

.agreement-text {
  flex: 1;
  font-size: 24rpx;
  line-height: 1.7;
  color: var(--rf-text-muted);
}

.agreement-link {
  color: var(--rf-text-strong);
}

.login-button {
  width: 100%;
  min-height: 96rpx;
  border-radius: 24rpx;
  background: #22c55e;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 700;
}

.login-button::after {
  border: none;
}

.login-button[disabled] {
  opacity: 0.6;
}

.redirect-tip {
  font-size: 22rpx;
  color: var(--rf-text-muted);
}
</style>
