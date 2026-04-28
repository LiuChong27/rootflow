<template>
  <view class="agreement-page" :class="currentTheme">
    <view class="agreement-head">
      <text class="agreement-head__title">用户协议</text>
    </view>

    <view class="agreement-card">
      <text class="agreement-line">1. RootFlow 为你提供学习记录、词根学习和账号登录服务。</text>
      <text class="agreement-line"
        >2. 登录后可在当前设备保存学习进度，并在云环境可用时使用同步能力。</text
      >
      <text class="agreement-line">3. 请勿使用本应用进行违法违规操作。</text>
      <text class="agreement-line"
        >4. 因设备、网络或第三方平台原因导致的服务中断，应用会尽量保留本地数据。</text
      >
    </view>
  </view>
</template>

<script>
import themePage from '../../mixins/themePage';

export default {
  mixins: [themePage],
};
</script>

<style lang="scss">
.agreement-page {
  min-height: 100vh;
  padding: 112rpx 28rpx 44rpx;
  box-sizing: border-box;
  background: var(--rf-page-bg);
  color: var(--rf-page-text);
}

.agreement-head {
  margin-bottom: 24rpx;
}

.agreement-head__title {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--rf-text-strong);
}

.agreement-card {
  padding: 28rpx;
  border-radius: 32rpx;
  background: var(--rf-surface);
  border: 1rpx solid var(--rf-border);
  box-shadow: var(--rf-card-shadow);
}

.agreement-line {
  display: block;
  font-size: 28rpx;
  line-height: 1.8;
  color: var(--rf-text-muted);
}

.agreement-line + .agreement-line {
  margin-top: 18rpx;
}
</style>
