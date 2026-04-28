<template>
  <view class="scene-page" :class="currentTheme">
    <theme-toggle-fab :theme="currentTheme" />
    <view class="scene-back-fixed" @tap="goBack">
      <text>← 返回场景页</text>
    </view>

    <template v-if="scene">
      <view class="scene-hero" :class="themeClass(scene.theme)">
        <text class="scene-hero__eyebrow">{{ scene.eyebrow }}</text>
        <text class="scene-hero__title">{{ scene.title }}</text>
        <text class="scene-hero__tagline">{{ scene.tagline }}</text>
        <text class="scene-hero__intro">{{ scene.intro }}</text>

        <view class="scene-hero__meta">
          <text v-for="section in scene.sectionStats" :key="scene.id + '-' + section.id">
            {{ section.count }} {{ section.title }}
          </text>
        </view>
      </view>

      <view class="scene-tools">
        <view class="scene-tools__modes">
          <view
            class="mode-chip"
            :class="{ 'mode-chip--active': viewMode === 'all' }"
            @tap="setViewMode('all')"
          >
            <text>全部</text>
          </view>
          <view
            class="mode-chip"
            :class="{ 'mode-chip--active': viewMode === 'favorites' }"
            @tap="setViewMode('favorites')"
          >
            <text>收藏 {{ getFavoriteTotal() }}</text>
          </view>
        </view>

        <view v-if="getHiddenCount() > 0" class="scene-tools__restore" @tap="restoreHiddenEntries">
          <text>恢复已删 {{ getHiddenCount() }}</text>
        </view>
      </view>

      <view v-for="section in scene.sections" :key="section.id" class="library-section">
        <view class="library-section__header">
          <text class="library-section__title">{{ section.title }}</text>
          <text class="library-section__desc">{{ section.description }}</text>
        </view>

        <view v-if="getDisplayedEntries(section.id).length" class="entry-list">
          <view
            v-for="entry in getDisplayedEntries(section.id)"
            :key="entry.id"
            class="entry-card"
            :class="{ 'entry-card--promoted': isEntryPromoted(section.id, entry.id) }"
            @tap="handleEntryTap(section.id, entry.id)"
            @touchstart="handleEntryTouchStart(section.id, entry.id, $event)"
            @touchend="handleEntryTouchEnd(section.id, entry.id, $event)"
          >
            <view class="entry-card__meta">
              <text>{{ getSourceKindLabel(entry.sourceKind) }}</text>
              <text>{{ entry.sourceSection }}</text>
              <text v-if="isEntryPromoted(section.id, entry.id)">置顶</text>
            </view>

            <view class="entry-card__actions">
              <view
                class="entry-card__fav"
                :class="{ 'entry-card__fav--active': isFavorite(entry.id) }"
                @tap.stop="toggleFavorite(entry)"
              >
                <text>{{ isFavorite(entry.id) ? '已收藏' : '收藏' }}</text>
              </view>
              <text class="entry-card__swipe-hint">左滑删除</text>
            </view>

            <text class="entry-card__english">{{ entry.english }}</text>
            <text class="entry-card__chinese">{{ entry.chinese }}</text>
            <text v-if="entry.baseEntryEnglish" class="entry-card__base">
              参考底句：{{ entry.baseEntryEnglish }}
            </text>
          </view>
        </view>

        <view v-else class="empty-state">
          <text v-if="viewMode === 'favorites'">这个分区还没有收藏内容。</text>
          <text v-else>这个分区暂时没有可展示的内容。</text>
        </view>
      </view>
    </template>

    <view v-else-if="isLoadingScene" class="loading-state">
      <text class="loading-state__title">正在打开场景...</text>
      <text class="loading-state__desc">内容稍多，马上就好。</text>
    </view>

    <view v-else class="missing-state">
      <text class="missing-state__title">这个场景不存在</text>
      <text class="missing-state__desc">可能是场景 id 不正确，或页面还没生成。</text>
      <view class="missing-state__cta" @tap="goBack">
        <text>回到 Vibes</text>
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
      sceneId: '',
      scene: null,
      viewMode: 'all',
      favoriteLookup: {},
      hiddenLookup: {},
      displayedEntriesBySection: {},
      promotedEntryIdsBySection: {},
      lastTapMap: {},
      doubleTapWindowMs: 320,
      touchStartXByEntry: {},
      suppressTapUntilByEntry: {},
      isLoadingScene: true,
      loadSceneTimer: null,
    };
  },
  onLoad(options) {
    this.sceneId = String(options?.id || '').trim();
    this.reloadEntryState();
    this.loadSceneAsync();
  },
  onShow() {
    this.reloadEntryState();
    this.syncDisplayedEntries();
  },
  onUnload() {
    if (this.loadSceneTimer) {
      clearTimeout(this.loadSceneTimer);
      this.loadSceneTimer = null;
    }
  },
  methods: {
    loadSceneAsync() {
      if (this.loadSceneTimer) {
        clearTimeout(this.loadSceneTimer);
      }

      this.isLoadingScene = true;
      const targetSceneId = this.sceneId;
      this.loadSceneTimer = setTimeout(() => {
        const nextScene = vibesRepo.getSceneById(targetSceneId);
        if (targetSceneId !== this.sceneId) return;

        this.scene = nextScene;
        this.isLoadingScene = false;
        this.syncDisplayedEntries();
        this.loadSceneTimer = null;
      }, 16);
    },
    reloadEntryState() {
      this.favoriteLookup = vibesEntryState.getFavoriteLookup();
      this.hiddenLookup = vibesEntryState.getSceneHiddenLookup(this.sceneId);
    },
    syncDisplayedEntries() {
      if (!Array.isArray(this.scene?.sections)) {
        this.displayedEntriesBySection = {};
        return;
      }

      const nextDisplayedEntriesBySection = {};
      this.scene.sections.forEach((section) => {
        const entries = Array.isArray(section?.entries) ? section.entries : [];
        const visibleEntries = entries.filter((entry) => {
          if (this.hiddenLookup[entry.id]) return false;
          if (this.viewMode === 'favorites' && !this.favoriteLookup[entry.id]) return false;
          return true;
        });
        const promotedEntryIds = this.promotedEntryIdsBySection[section.id] || [];
        if (!promotedEntryIds.length) {
          nextDisplayedEntriesBySection[section.id] = visibleEntries;
          return;
        }

        const promotedSet = new Set(promotedEntryIds);
        const entryById = visibleEntries.reduce((acc, entry) => {
          acc[entry.id] = entry;
          return acc;
        }, {});
        const promotedEntries = promotedEntryIds
          .map((entryId) => entryById[entryId])
          .filter((entry) => Boolean(entry));
        const normalEntries = visibleEntries.filter((entry) => !promotedSet.has(entry.id));
        nextDisplayedEntriesBySection[section.id] = [...promotedEntries, ...normalEntries];
      });

      this.displayedEntriesBySection = nextDisplayedEntriesBySection;
    },
    themeClass(theme) {
      return `theme--${theme || 'ash-crimson'}`;
    },
    getSourceKindLabel(sourceKind) {
      if (sourceKind === 'crafted') return '场景定制';
      if (sourceKind === 'rewrite') return '场景改写';
      return '原句整理';
    },
    setViewMode(mode) {
      this.viewMode = mode === 'favorites' ? 'favorites' : 'all';
      this.syncDisplayedEntries();
    },
    getFavoriteTotal() {
      return Object.keys(this.favoriteLookup).length;
    },
    getHiddenCount() {
      return Object.keys(this.hiddenLookup).length;
    },
    isFavorite(entryId) {
      return Boolean(this.favoriteLookup[entryId]);
    },
    getDisplayedEntries(sectionId) {
      const targetSectionId =
        typeof sectionId === 'string' ? sectionId : String(sectionId?.id || '').trim();
      return Array.isArray(this.displayedEntriesBySection[targetSectionId])
        ? this.displayedEntriesBySection[targetSectionId]
        : [];
    },
    toggleFavorite(entry) {
      const isNowFavorite = vibesEntryState.toggleFavorite(this.scene, entry);
      this.reloadEntryState();
      this.syncDisplayedEntries();
      uni.showToast({
        title: isNowFavorite ? '已加入收藏' : '已取消收藏',
        icon: 'none',
      });
    },
    getTouchX(event) {
      const touchPoint =
        event?.changedTouches?.[0] || event?.touches?.[0] || event?.mp?.changedTouches?.[0];
      return Number(touchPoint?.clientX || touchPoint?.pageX || 0);
    },
    handleEntryTouchStart(sectionId, entryId, event) {
      const touchKey = `${sectionId}::${entryId}`;
      this.touchStartXByEntry = {
        ...this.touchStartXByEntry,
        [touchKey]: this.getTouchX(event),
      };
    },
    handleEntryTouchEnd(sectionId, entryId, event) {
      const touchKey = `${sectionId}::${entryId}`;
      const startX = Number(this.touchStartXByEntry[touchKey] || 0);
      const endX = this.getTouchX(event);
      if (!startX || !endX) return;

      const deltaX = startX - endX;
      if (deltaX < 48) return;

      this.deleteEntryBySwipe(entryId);
      this.suppressTapUntilByEntry = {
        ...this.suppressTapUntilByEntry,
        [touchKey]: Date.now() + 280,
      };
    },
    deleteEntryBySwipe(entryId) {
      const removed = vibesEntryState.hideEntry(this.sceneId, entryId);
      if (!removed) return;

      vibesEntryState.removeFavorite(entryId);
      this.reloadEntryState();

      const nextPromotedEntryIdsBySection = {};
      Object.keys(this.promotedEntryIdsBySection).forEach((sectionId) => {
        nextPromotedEntryIdsBySection[sectionId] = (
          this.promotedEntryIdsBySection[sectionId] || []
        ).filter((id) => !this.hiddenLookup[id]);
      });
      this.promotedEntryIdsBySection = nextPromotedEntryIdsBySection;
      this.syncDisplayedEntries();

      uni.showToast({
        title: '已删除句子',
        icon: 'none',
      });
    },
    restoreHiddenEntries() {
      const restoredCount = vibesEntryState.restoreSceneHiddenEntries(this.sceneId);
      if (!restoredCount) return;
      this.reloadEntryState();
      this.syncDisplayedEntries();
      uni.showToast({
        title: `已恢复 ${restoredCount} 条`,
        icon: 'none',
      });
    },
    isEntryPromoted(sectionId, entryId) {
      const promotedEntryIds = this.promotedEntryIdsBySection[sectionId] || [];
      return promotedEntryIds.includes(entryId);
    },
    shouldSuppressTap(sectionId, entryId) {
      const tapKey = `${sectionId}::${entryId}`;
      const suppressUntil = Number(this.suppressTapUntilByEntry[tapKey] || 0);
      return Date.now() <= suppressUntil;
    },
    handleEntryTap(sectionId, entryId) {
      if (this.shouldSuppressTap(sectionId, entryId)) return;

      const now = Date.now();
      const tapKey = `${sectionId}::${entryId}`;
      const lastTapAt = this.lastTapMap[tapKey] || 0;
      const isDoubleTap = now - lastTapAt <= this.doubleTapWindowMs;

      this.lastTapMap = {
        ...this.lastTapMap,
        [tapKey]: now,
      };

      if (!isDoubleTap) return;
      this.promoteEntry(sectionId, entryId);
      this.lastTapMap = {
        ...this.lastTapMap,
        [tapKey]: 0,
      };
    },
    promoteEntry(sectionId, entryId) {
      const promotedEntryIds = this.promotedEntryIdsBySection[sectionId] || [];
      this.promotedEntryIdsBySection = {
        ...this.promotedEntryIdsBySection,
        [sectionId]: [entryId, ...promotedEntryIds.filter((id) => id !== entryId)],
      };
      this.syncDisplayedEntries();
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
.scene-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 132rpx 24rpx 44rpx;
  background:
    radial-gradient(circle at 18% 0%, rgba(255, 133, 97, 0.18), transparent 24%),
    linear-gradient(180deg, #100d10 0%, #0a0a0c 50%, #060708 100%);
  color: #fff5ef;
}

.scene-back-fixed {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 16rpx);
  left: 24rpx;
  z-index: 80;
  display: inline-flex;
  align-items: center;
  padding: 14rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.44);
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  font-size: 22rpx;
  color: rgba(255, 247, 240, 0.96);
  backdrop-filter: blur(8rpx);
}

.scene-hero {
  overflow: hidden;
  border-radius: 36rpx;
  padding: 28rpx;
  margin-top: 0;
  margin-bottom: 22rpx;
  box-shadow: 0 24rpx 74rpx rgba(0, 0, 0, 0.28);
}

.scene-hero__eyebrow {
  display: block;
  margin-bottom: 10rpx;
  font-size: 18rpx;
  letter-spacing: 4rpx;
  color: rgba(255, 241, 235, 0.72);
}

.scene-hero__title {
  display: block;
  font-size: 62rpx;
  line-height: 1.02;
  font-weight: 700;
}

.scene-hero__tagline {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.55;
  color: rgba(255, 247, 243, 0.92);
}

.scene-hero__intro {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: rgba(255, 232, 221, 0.82);
}

.scene-hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 20rpx;
  font-size: 20rpx;
}

.scene-hero__meta text {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.16);
  color: rgba(255, 247, 243, 0.9);
}

.scene-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-bottom: 20rpx;
}

.scene-tools__modes {
  display: flex;
  gap: 12rpx;
}

.mode-chip {
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  font-size: 22rpx;
  color: rgba(255, 235, 225, 0.82);
}

.mode-chip--active {
  border-color: rgba(255, 209, 186, 0.7);
  background: rgba(255, 144, 96, 0.24);
  color: #fff7f2;
}

.scene-tools__restore {
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  font-size: 22rpx;
  color: rgba(255, 232, 219, 0.86);
}

.library-section {
  margin-bottom: 20rpx;
}

.library-section__header {
  margin-bottom: 14rpx;
}

.library-section__title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
}

.library-section__desc {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.6;
  color: rgba(255, 227, 214, 0.72);
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.entry-card {
  border-radius: 28rpx;
  padding: 22rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.entry-card--promoted {
  background: rgba(255, 158, 109, 0.2);
  border-color: rgba(255, 203, 171, 0.6);
  box-shadow: 0 10rpx 28rpx rgba(255, 99, 61, 0.24);
}

.entry-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 12rpx;
  font-size: 18rpx;
  color: rgba(255, 219, 203, 0.76);
}

.entry-card__meta text {
  padding: 8rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.14);
}

.entry-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.entry-card__fav {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.12);
  font-size: 20rpx;
  color: rgba(255, 233, 223, 0.8);
}

.entry-card__fav--active {
  border-color: rgba(255, 204, 174, 0.74);
  background: rgba(255, 149, 101, 0.24);
  color: #fff8f4;
}

.entry-card__swipe-hint {
  font-size: 18rpx;
  color: rgba(255, 219, 202, 0.64);
}

.entry-card__english {
  display: block;
  font-size: 32rpx;
  line-height: 1.35;
  font-weight: 700;
  color: #fff9f5;
}

.entry-card__chinese {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.65;
  color: rgba(255, 235, 225, 0.82);
}

.entry-card__base {
  display: block;
  margin-top: 12rpx;
  font-size: 20rpx;
  line-height: 1.6;
  color: rgba(255, 211, 188, 0.74);
}

.empty-state,
.loading-state,
.missing-state {
  border-radius: 28rpx;
  padding: 28rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.loading-state,
.missing-state {
  margin-top: 120rpx;
}

.loading-state__title,
.missing-state__title {
  display: block;
  font-size: 42rpx;
  font-weight: 700;
}

.loading-state__desc,
.missing-state__desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: rgba(255, 229, 218, 0.8);
}

.missing-state__cta {
  display: inline-flex;
  margin-top: 20rpx;
  padding: 16rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 140, 96, 0.16);
  font-size: 22rpx;
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

.scene-page.theme-clay-pastel {
  background: var(--rf-page-bg);
  color: var(--rf-page-text);
}

.theme-clay-pastel .scene-back-fixed,
.theme-clay-pastel .mode-chip,
.theme-clay-pastel .scene-tools__restore,
.theme-clay-pastel .entry-card,
.theme-clay-pastel .loading-state,
.theme-clay-pastel .empty-state,
.theme-clay-pastel .missing-state {
  background: var(--rf-surface);
  border-color: var(--rf-border);
  color: var(--rf-text-strong);
  box-shadow: var(--rf-card-shadow);
}

.theme-clay-pastel .mode-chip--active,
.theme-clay-pastel .entry-card__fav--active,
.theme-clay-pastel .missing-state__cta {
  background: rgba(255, 255, 255, 0.78);
  border-color: rgba(31, 41, 51, 0.08);
  color: #1f2933;
}

.theme-clay-pastel .library-section__desc,
.theme-clay-pastel .entry-card__chinese,
.theme-clay-pastel .entry-card__base,
.theme-clay-pastel .loading-state__desc,
.theme-clay-pastel .missing-state__desc,
.theme-clay-pastel .entry-card__swipe-hint {
  color: var(--rf-text-muted);
}

.theme-clay-pastel .entry-card__meta {
  color: var(--rf-text-soft);
}

.theme-clay-pastel .entry-card__meta text {
  background: var(--rf-button-secondary-bg);
}

.theme-clay-pastel .entry-card__fav {
  border-color: var(--rf-border-strong);
  background: var(--rf-button-secondary-bg);
  color: var(--rf-text-strong);
}

.theme-clay-pastel .entry-card--promoted {
  background: rgba(255, 255, 255, 0.82);
  border-color: rgba(31, 41, 51, 0.08);
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.04);
}
</style>
