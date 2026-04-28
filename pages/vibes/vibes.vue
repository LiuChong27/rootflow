<template>
  <view class="vibes-page" :class="currentTheme">
    <theme-toggle-fab :theme="currentTheme" />
    <view class="hero">
      <text class="hero__eyebrow">ARGUE SMART</text>
      <text class="hero__title">不要输在不会表达上</text>
      <text class="hero__subtitle"> 职场、校园、食堂、游戏、社交平台，对喷老外 </text>

      <view class="hero__rule">
        <text>ALL CONTENT IS BUILT FOR SHARP COMEBACKS, SNARK, AND QUICK SHUTDOWNS.</text>
      </view>

      <view class="hero__favorites" @tap="openFavorites">
        <text>我的收藏</text>
        <text>{{ favoriteCount }} 条</text>
      </view>
    </view>

    <view class="scene-list">
      <view
        v-for="(scene, index) in sceneCards"
        :key="scene.id"
        class="scene-card"
        :class="themeClass(scene.theme)"
        @tap="openScene(scene.id)"
      >
        <text class="scene-card__index">{{ formatIndex(index) }}</text>
        <text class="scene-card__eyebrow">{{ scene.eyebrow }}</text>
        <text class="scene-card__title">{{ scene.title }}</text>
        <text class="scene-card__statement">{{ scene.statement }}</text>
        <text class="scene-card__tagline">{{ scene.tagline }}</text>

        <view class="scene-card__meta">
          <text v-for="section in scene.sectionStats" :key="scene.id + '-' + section.id">
            {{ section.count }} {{ section.title }}
          </text>
        </view>

        <view class="scene-card__cta">
          <text>点击进入场景库</text>
          <text>→</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import themePage from '../../mixins/themePage';
import vibesEntryState from '../../services/vibesEntryState';
import vibesRepo from '../../services/vibesRepo';

export default {
  mixins: [themePage],
  data() {
    return {
      sceneCards: [],
      favoriteCount: 0,
      isNavigating: false,
    };
  },
  onLoad() {
    this.loadSceneCards();
    this.refreshFavoriteCount();
  },
  onShow() {
    this.refreshFavoriteCount();
  },
  methods: {
    loadSceneCards() {
      this.sceneCards =
        typeof vibesRepo.listSceneCardsLite === 'function'
          ? vibesRepo.listSceneCardsLite()
          : vibesRepo.listSceneCards();
    },
    refreshFavoriteCount() {
      this.favoriteCount = vibesEntryState.listFavorites().length;
    },
    formatIndex(index) {
      return String(index + 1).padStart(2, '0');
    },
    themeClass(theme) {
      return `theme--${theme || 'ash-crimson'}`;
    },
    openScene(sceneId) {
      const targetSceneId = String(sceneId || '').trim();
      if (!targetSceneId) return;
      this.navigateToPage(`/pages/vibes/scene?id=${targetSceneId}`);
    },
    openFavorites() {
      this.navigateToPage('/pages/vibes/favorites');
    },
    navigateToPage(url) {
      const targetUrl = String(url || '').trim();
      if (!targetUrl || this.isNavigating) return;

      this.isNavigating = true;
      const releaseLock = () => {
        setTimeout(() => {
          this.isNavigating = false;
        }, 120);
      };

      const navigationTask = uni.navigateTo({
        url: targetUrl,
        fail: (error) => {
          const errMsg = String(error?.errMsg || '');
          if (!errMsg || /cancel|interrupted/i.test(errMsg)) return;

          uni.showToast({
            title: '页面打开失败，请重试',
            icon: 'none',
          });
        },
        complete: releaseLock,
      });

      if (navigationTask && typeof navigationTask.catch === 'function') {
        navigationTask.catch(() => {});
      }
    },
  },
};
</script>

<style lang="scss">
.vibes-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 104rpx 28rpx 40rpx;
  background:
    radial-gradient(circle at 12% 0%, rgba(255, 124, 83, 0.2), transparent 24%),
    radial-gradient(circle at 88% 8%, rgba(255, 214, 92, 0.14), transparent 18%),
    linear-gradient(180deg, #120d0c 0%, #0e0b0d 44%, #08080a 100%);
  color: #fff4ed;
}

.hero {
  margin-bottom: 30rpx;
}

.hero__eyebrow {
  display: block;
  margin-bottom: 16rpx;
  font-size: 20rpx;
  letter-spacing: 6rpx;
  color: rgba(255, 219, 205, 0.72);
}

.hero__title {
  display: block;
  max-width: 560rpx;
  font-size: 78rpx;
  line-height: 1.02;
  font-weight: 700;
  letter-spacing: -2rpx;
}

.hero__subtitle {
  display: block;
  max-width: 580rpx;
  margin-top: 18rpx;
  font-size: 28rpx;
  line-height: 1.65;
  color: rgba(255, 226, 214, 0.8);
}

.hero__rule {
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.12);
  font-size: 18rpx;
  letter-spacing: 2.4rpx;
  color: rgba(255, 210, 190, 0.55);
}

.hero__favorites {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.07);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  font-size: 22rpx;
  color: rgba(255, 238, 228, 0.92);
}

.scene-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.scene-card {
  position: relative;
  overflow: hidden;
  border-radius: 34rpx;
  padding: 28rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 22rpx 70rpx rgba(0, 0, 0, 0.24);
}

.scene-card::after {
  content: '';
  position: absolute;
  inset: auto -40rpx -40rpx auto;
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  filter: blur(12rpx);
}

.scene-card__index,
.scene-card__eyebrow,
.scene-card__title,
.scene-card__statement,
.scene-card__tagline,
.scene-card__meta,
.scene-card__cta {
  position: relative;
  z-index: 1;
}

.scene-card__index {
  display: block;
  margin-bottom: 10rpx;
  font-size: 18rpx;
  letter-spacing: 4rpx;
  color: rgba(255, 240, 230, 0.56);
}

.scene-card__eyebrow {
  display: block;
  margin-bottom: 8rpx;
  font-size: 18rpx;
  letter-spacing: 4rpx;
  color: rgba(255, 244, 238, 0.74);
}

.scene-card__title {
  display: block;
  font-size: 54rpx;
  line-height: 1.02;
  font-weight: 700;
}

.scene-card__statement {
  display: block;
  margin-top: 12rpx;
  max-width: 540rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: rgba(255, 248, 243, 0.95);
}

.scene-card__tagline {
  display: block;
  margin-top: 16rpx;
  max-width: 560rpx;
  font-size: 24rpx;
  line-height: 1.65;
  color: rgba(255, 233, 222, 0.78);
}

.scene-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
  font-size: 20rpx;
  color: rgba(255, 239, 232, 0.72);
}

.scene-card__meta text {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.16);
}

.scene-card__cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.1);
  font-size: 22rpx;
  color: rgba(255, 251, 248, 0.92);
}

.theme--ash-crimson {
  background: linear-gradient(145deg, rgba(74, 22, 20, 0.94), rgba(132, 34, 30, 0.84));
}

.theme--arcade-neon {
  background: linear-gradient(145deg, rgba(35, 17, 42, 0.94), rgba(123, 45, 98, 0.84));
}

.theme--slate-graphite {
  background: linear-gradient(145deg, rgba(24, 28, 35, 0.96), rgba(54, 66, 83, 0.9));
}

.theme--amber-concrete {
  background: linear-gradient(145deg, rgba(69, 46, 24, 0.94), rgba(154, 96, 34, 0.82));
}

.theme--rose-smoke {
  background: linear-gradient(145deg, rgba(56, 25, 34, 0.94), rgba(146, 59, 87, 0.84));
}

.theme--obsidian-alert {
  background: linear-gradient(145deg, rgba(15, 15, 18, 0.96), rgba(119, 29, 27, 0.84));
}

.vibes-page.theme-clay-pastel {
  background: var(--rf-page-bg);
  color: var(--rf-page-text);
}

.theme-clay-pastel .hero__eyebrow,
.theme-clay-pastel .scene-card__index,
.theme-clay-pastel .scene-card__eyebrow {
  color: var(--rf-text-kicker);
}

.theme-clay-pastel .hero__subtitle,
.theme-clay-pastel .hero__rule,
.theme-clay-pastel .scene-card__tagline,
.theme-clay-pastel .scene-card__meta {
  color: var(--rf-text-muted);
}

.theme-clay-pastel .hero__favorites {
  background: var(--rf-surface);
  border-color: var(--rf-border);
  color: var(--rf-text-strong);
  box-shadow: var(--rf-card-shadow);
}

.theme-clay-pastel .scene-card {
  border-color: rgba(255, 255, 255, 0.16);
}

.theme-clay-pastel .scene-card__statement,
.theme-clay-pastel .scene-card__cta,
.theme-clay-pastel .scene-card__title {
  color: #fff8f3;
}
</style>
