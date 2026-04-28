<template>
  <view class="favorites-page" :class="currentTheme">
    <theme-toggle-fab :theme="currentTheme" />
    <view class="favorites-hero">
      <view class="favorites-hero__nav" @tap="goBack">
        <text>← 返回场景</text>
      </view>
      <text class="favorites-hero__title">我的收藏</text>
      <text class="favorites-hero__subtitle">跨场景查看你收藏过的高攻击句子。</text>
      <text class="favorites-hero__count">{{ favorites.length }} 条收藏</text>
    </view>

    <view v-if="favorites.length" class="favorites-list">
      <view v-for="entry in favorites" :key="entry.id" class="favorite-card">
        <view class="favorite-card__meta">
          <text>{{ entry.sceneTitle || entry.sceneId }}</text>
          <text>{{ entry.sourceSection }}</text>
        </view>

        <text class="favorite-card__english">{{ entry.english }}</text>
        <text class="favorite-card__chinese">{{ entry.chinese }}</text>

        <view class="favorite-card__actions">
          <view class="favorite-card__btn" @tap="openScene(entry.sceneId)">
            <text>去原场景</text>
          </view>
          <view
            class="favorite-card__btn favorite-card__btn--danger"
            @tap="removeFavorite(entry.id)"
          >
            <text>取消收藏</text>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="favorites-empty">
      <text class="favorites-empty__title">你还没有收藏句子</text>
      <text class="favorites-empty__desc">进入任意场景，点击“收藏”就会出现在这里。</text>
    </view>
  </view>
</template>

<script>
import themePage from '../../mixins/themePage';
import vibesEntryState from '../../services/vibesEntryState';

export default {
  mixins: [themePage],
  data() {
    return {
      favorites: [],
      isNavigating: false,
    };
  },
  onLoad() {
    this.refreshFavorites();
  },
  onShow() {
    this.refreshFavorites();
  },
  methods: {
    refreshFavorites() {
      this.favorites = vibesEntryState.listFavorites();
    },
    removeFavorite(entryId) {
      const removed = vibesEntryState.removeFavorite(entryId);
      if (!removed) return;
      this.refreshFavorites();
      uni.showToast({
        title: '已取消收藏',
        icon: 'none',
      });
    },
    openScene(sceneId) {
      const targetSceneId = String(sceneId || '').trim();
      if (!targetSceneId) return;
      this.navigateToPage(`/pages/vibes/scene?id=${targetSceneId}`);
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
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
        return;
      }
      uni.reLaunch({
        url: '/pages/vibes/vibes',
      });
    },
  },
};
</script>

<style lang="scss">
.favorites-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 34rpx 24rpx 44rpx;
  background:
    radial-gradient(circle at 14% 0%, rgba(255, 124, 84, 0.18), transparent 24%),
    linear-gradient(180deg, #120d10 0%, #0c0c0f 52%, #07080a 100%);
  color: #fff4ed;
}

.favorites-hero {
  margin-top: 18rpx;
  margin-bottom: 20rpx;
  border-radius: 30rpx;
  padding: 24rpx;
  background: linear-gradient(145deg, rgba(67, 21, 26, 0.94), rgba(127, 42, 49, 0.84));
}

.favorites-hero__nav {
  display: inline-flex;
  align-items: center;
  margin-bottom: 20rpx;
  padding: 12rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.16);
  font-size: 22rpx;
}

.favorites-hero__title {
  display: block;
  font-size: 58rpx;
  font-weight: 700;
  line-height: 1.04;
}

.favorites-hero__subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: rgba(255, 236, 226, 0.85);
}

.favorites-hero__count {
  display: inline-flex;
  margin-top: 18rpx;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.16);
  font-size: 20rpx;
}

.favorites-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.favorite-card {
  border-radius: 24rpx;
  padding: 20rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.favorite-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 12rpx;
  font-size: 18rpx;
  color: rgba(255, 220, 205, 0.82);
}

.favorite-card__meta text {
  padding: 8rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.14);
}

.favorite-card__english {
  display: block;
  font-size: 30rpx;
  line-height: 1.35;
  font-weight: 700;
}

.favorite-card__chinese {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.62;
  color: rgba(255, 235, 225, 0.84);
}

.favorite-card__actions {
  display: flex;
  gap: 10rpx;
  margin-top: 16rpx;
}

.favorite-card__btn {
  display: inline-flex;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  font-size: 20rpx;
}

.favorite-card__btn--danger {
  border-color: rgba(255, 170, 156, 0.5);
  background: rgba(255, 96, 76, 0.2);
}

.favorites-empty {
  margin-top: 30rpx;
  border-radius: 24rpx;
  padding: 26rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.favorites-empty__title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
}

.favorites-empty__desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.62;
  color: rgba(255, 232, 221, 0.8);
}

.favorites-page.theme-clay-pastel {
  background: var(--rf-page-bg);
  color: var(--rf-page-text);
}

.theme-clay-pastel .favorites-hero {
  background: var(--rf-focus-bg);
  box-shadow: var(--rf-shadow);
  color: var(--rf-focus-text);
}

.theme-clay-pastel .favorites-hero__subtitle,
.theme-clay-pastel .favorite-card__chinese,
.theme-clay-pastel .favorites-empty__desc {
  color: var(--rf-text-muted);
}

.theme-clay-pastel .favorites-hero__nav,
.theme-clay-pastel .favorites-hero__count,
.theme-clay-pastel .favorite-card,
.theme-clay-pastel .favorites-empty {
  background: var(--rf-surface);
  border-color: var(--rf-border);
  color: var(--rf-text-strong);
  box-shadow: var(--rf-card-shadow);
}

.theme-clay-pastel .favorite-card__meta {
  color: var(--rf-text-soft);
}

.theme-clay-pastel .favorite-card__meta text {
  background: var(--rf-button-secondary-bg);
}

.theme-clay-pastel .favorite-card__btn {
  border-color: var(--rf-border-strong);
  background: var(--rf-button-secondary-bg);
}

.theme-clay-pastel .favorite-card__btn--danger {
  border-color: var(--rf-danger-border);
  background: var(--rf-danger-bg);
  color: var(--rf-danger-text);
}
</style>
