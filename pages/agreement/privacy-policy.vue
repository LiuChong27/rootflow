<template>
  <view class="agreement-page" :class="currentTheme">
    <view class="agreement-head">
      <text class="agreement-head__title">隐私政策</text>
    </view>

    <view class="agreement-card">
      <text class="agreement-line">1. 登录时会使用微信登录能力完成账号识别。</text>
      <text class="agreement-line">2. 你主动授权后，应用才会使用昵称和头像信息。</text>
      <text class="agreement-line"
        >3. 学习记录会保存在本地；当云能力开启时，相关进度数据可同步到云端。</text
      >
      <text class="agreement-line"
        >4. 除实现登录、学习记录和同步功能外，不会额外使用你的信息。</text
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
