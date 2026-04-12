<template>
  <view class="vibes-container">
    <view class="header">
      <text class="date">表达</text>
      <text class="quote">寻找你的情绪词库。</text>
    </view>

    <view class="vibes-waterfall">
      <view class="vibe-card bg-zen-dark" @tap="enterScene('argue')">
        <text class="big-word text-white">怼</text>
        <text class="vibe-sub">优雅地发脾气</text>
      </view>

      <view class="vibe-card bg-zen-gray" @tap="enterScene('office')">
        <text class="big-word text-blue">Not</text>
        <text class="big-word text-blue" style="margin-top: -30rpx">My Job</text>
        <text class="vibe-sub">职场甩锅艺术</text>
      </view>

      <view class="vibe-card bg-zen-black" @tap="enterScene('game')">
        <text class="big-word text-white">🔥</text>
        <text class="vibe-sub">峡谷跨服交流</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  methods: {
    enterScene(type) {
      uni.showToast({ title: `进入 ${type} 场景`, icon: 'none' });
    },
  },
};
</script>

<style lang="scss">
.vibes-container {
  min-height: 100vh;
  background-color: #0a0a0b;
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
}
.quote {
  font-size: 28rpx;
  color: #5e5e60;
}

.vibes-waterfall {
  display: flex;
  flex-direction: column;
  gap: 40rpx;
}

.vibe-card {
  position: relative;
  width: 100%;
  height: 480rpx;
  border-radius: 40rpx;
  padding: 60rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  transition: transform 0.2s;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.03);
  &:active {
    transform: scale(0.97);
  }
}

.text-white {
  color: #ffffff;
  line-height: 1;
}
.text-blue {
  color: #8ca0bc;
  line-height: 1;
}

.bg-zen-dark {
  background-color: #121212;
  .big-word {
    font-size: 180rpx;
    font-weight: 900;
    font-family: 'PingFang SC', serif;
  }
  .vibe-sub {
    position: absolute;
    bottom: 60rpx;
    left: 60rpx;
    font-size: 28rpx;
    color: #5e5e60;
  }
}

.bg-zen-gray {
  background-color: #1c1c1e;
  .big-word {
    font-size: 120rpx;
    font-weight: 800;
    font-family: 'SF Pro', sans-serif;
  }
  .vibe-sub {
    position: absolute;
    bottom: 60rpx;
    left: 60rpx;
    font-size: 28rpx;
    color: #5e5e60;
  }
}

.bg-zen-black {
  background-color: #000000;
  height: 320rpx;
  .big-word {
    font-size: 100rpx;
  }
  .vibe-sub {
    margin-top: auto;
    font-size: 28rpx;
    color: #5e5e60;
  }
}
</style>
