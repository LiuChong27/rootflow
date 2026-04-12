<template>
  <view class="container">
    <view class="header">
      <text class="date">4月6日</text>
      <text class="quote">今天不背单词，明天只能在峡谷发问号。</text>
    </view>

    <view class="card-area">
      <!-- 暗黑极简毛玻璃卡片 -->
      <view class="glass-card" @tap="enterRoots">
        <text class="card-title">图谱探索</text>
        <text class="card-desc">进入无限词根画布</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  methods: {
    enterRoots() {
      uni.switchTab({
        url: '/pages/roots/roots',
      });
    },
  },
};
</script>

<style lang="scss">
.container {
  min-height: 100vh;
  background-color: #0a0a0b; /* 替换为极暗的沉浸底色 */
  padding: 120rpx 40rpx;
  box-sizing: border-box;
}

.header {
  margin-bottom: 80rpx;
  display: flex;
  flex-direction: column;
}

.date {
  font-size: 60rpx;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 16rpx;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif;
}

.quote {
  font-size: 28rpx;
  color: #5e5e60; /* 深灰高级感 */
}

.card-area {
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

.glass-card {
  height: 300rpx;
  background: rgba(255, 255, 255, 0.05); /* 降低亮度，融入暗色 */
  backdrop-filter: blur(20px);
  border-radius: 40rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 60rpx;
  border: 1px solid rgba(255, 255, 255, 0.03); /* 微弱的边缘高光 */
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.4);
  transition: transform 0.2s;

  &:active {
    transform: scale(0.98);
  }

  .card-title {
    font-size: 48rpx;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 12rpx;
  }
  .card-desc {
    font-size: 24rpx;
    color: #8ca0bc; /* 暗色环境下的高雅蓝灰 */
  }
}
</style>
