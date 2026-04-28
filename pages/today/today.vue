<template>
  <view class="today-page" :class="currentTheme">
    <theme-toggle-fab :theme="currentTheme" />

    <view class="today-card today-card--flow">
      <view class="today-card__header">
        <text class="today-card__title">词根学习流</text>
      </view>

      <view class="today-metrics">
        <view class="today-metric">
          <text class="today-metric__value">{{ overview.doneCount }}</text>
          <text class="today-metric__label">今日掌握单词</text>
        </view>
        <view class="today-metric">
          <text class="today-metric__value">{{ overview.totalWords }}</text>
          <text class="today-metric__label">总词量</text>
        </view>
      </view>

      <view class="today-progress">
        <view class="today-progress__row">
          <text class="today-progress__label">今日进度</text>
          <text class="today-progress__value">{{ progressLabel }}</text>
        </view>
        <view class="today-progress__track">
          <view class="today-progress__fill" :style="{ width: progressWidth }"></view>
        </view>
      </view>

      <view class="today-actions">
        <view
          class="today-action today-action--primary"
          @tap="startMemorizing"
          @click="startMemorizing"
        >
          <text>进入词根流</text>
        </view>
      </view>
    </view>

    <view class="today-card today-card--review">
      <view class="today-card__header">
        <text class="today-card__title">今日复习</text>
      </view>

      <view class="today-metrics today-metrics--three">
        <view class="today-metric">
          <text class="today-metric__value">{{ overview.dueCount }}</text>
          <text class="today-metric__label">复习</text>
        </view>
        <view class="today-metric">
          <text class="today-metric__value">{{ overview.doneCount }}</text>
          <text class="today-metric__label">今日完成</text>
        </view>
        <view class="today-metric">
          <text class="today-metric__value">{{ overview.topLevelRootCount }}</text>
          <text class="today-metric__label">词根组</text>
        </view>
      </view>

      <view class="today-actions">
        <view
          class="today-action today-action--primary"
          @tap="startPractice"
          @click="startPractice"
        >
          <text>{{ overview.dueCount > 0 ? '开始复习' : '复习已清空' }}</text>
        </view>
        <view class="today-action today-action--secondary" @tap="enterRoots" @click="enterRoots">
          <text>打开 Roots 图谱</text>
        </view>
      </view>
    </view>

    <view class="today-card today-card--download">
      <view class="today-card__header">
        <text class="today-card__title">词根资料库</text>
      </view>

      <view class="today-download-copy">
        <text class="today-download-copy__line">A-Z 词根资料可下载</text>
        <text class="today-download-copy__line">全部资料现已开放免费下载</text>
        <text class="today-download-copy__line">{{ downloadCenter.benefitSummary }}</text>
      </view>

      <view class="today-metrics today-metrics--three">
        <view class="today-metric">
          <text class="today-metric__value">{{ downloadCenter.assetCount }}</text>
          <text class="today-metric__label">资料份数</text>
        </view>
        <view class="today-metric">
          <text class="today-metric__value">{{ downloadCenter.localCount }}</text>
          <text class="today-metric__label">已存本机</text>
        </view>
        <view class="today-metric">
          <text class="today-metric__value">{{ downloadCenter.creditBalanceLabel }}</text>
          <text class="today-metric__label">下载权限</text>
        </view>
      </view>

      <view class="today-actions">
        <view
          class="today-action today-action--primary"
          @tap="openDownloadsEntry"
          @click="openDownloadsEntry"
        >
          <text>下载词根资料</text>
        </view>
        <view
          class="today-action today-action--secondary"
          @tap="openDownloadsPage"
          @click="openDownloadsPage"
        >
          <text>查看目录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import authService from '../../services/authService';
import downloadService from '../../services/downloadService';
import { getProgressSyncService, getWordRepo } from '../../services/lazyServices';
import themePage from '../../mixins/themePage';

function countTopLevelRoots(wordRepo) {
  return wordRepo
    ? wordRepo
        .listRoots()
        .filter((root) => Number(root.rootLevel || 0) === 1)
        .filter((root) => Number(root.descendantWordCount || root.wordCount || 0) > 0).length
    : 0;
}

function countTotalWords(wordRepo) {
  return wordRepo
    ? wordRepo.listRoots().reduce((sum, root) => sum + Math.max(0, Number(root.wordCount || 0)), 0)
    : 0;
}

function createStartupTask(callback) {
  const runner = () => {
    Promise.resolve()
      .then(callback)
      .catch(() => {});
  };
  if (typeof setTimeout === 'function') {
    setTimeout(runner, 0);
    return;
  }
  runner();
}

function clampRatio(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function createDownloadCenterState(input = {}) {
  const data = input && typeof input === 'object' ? input : {};
  const benefits = data.downloadBenefits || {};
  const creditBalance = Number(benefits.creditBalance || 0);
  const isLifetimeMember = Boolean(benefits.isLifetimeMember);
  const isFreeAccess = Boolean(benefits.isFreeAccess);
  const localCount = Number(benefits.availableLocalCount || 0);

  return {
    assetCount: Array.isArray(data.assets) ? data.assets.length : 26,
    localCount,
    benefitSummary: downloadService.getBenefitSummary(benefits),
    creditBalanceLabel: isFreeAccess ? '免费' : isLifetimeMember ? '会员' : `${creditBalance} 次`,
  };
}

export default {
  mixins: [themePage],
  data() {
    return {
      overview: {
        dueCount: 0,
        overdueCount: 0,
        doneCount: 0,
        totalCount: 0,
        masteredWords: 0,
        scheduledWords: 0,
        totalWords: 0,
        topLevelRootCount: 0,
      },
      downloadCenter: createDownloadCenterState(),
    };
  },

  computed: {
    progressRatio() {
      const totalCount = Number(this.overview.totalCount || 0);
      const doneCount = Number(this.overview.doneCount || 0);
      if (!totalCount) return 0;
      return clampRatio(doneCount / totalCount);
    },

    progressWidth() {
      return `${Math.round(this.progressRatio * 100)}%`;
    },

    progressLabel() {
      const totalCount = Number(this.overview.totalCount || 0);
      const doneCount = Number(this.overview.doneCount || 0);
      if (!totalCount) return '0/0';
      return `${doneCount}/${totalCount}`;
    },
  },

  onShow() {
    createStartupTask(() => Promise.all([this.refreshOverview(), this.refreshDownloadCenter()]));
  },

  methods: {
    navigateToPage(url) {
      uni.navigateTo({
        url,
        fail: () => {
          uni.showToast({ title: '页面打开失败，请重试', icon: 'none' });
        },
      });
    },

    switchTabPage(url) {
      uni.switchTab({
        url,
        fail: () => {
          uni.showToast({ title: '页面跳转失败，请重试', icon: 'none' });
        },
      });
    },

    async refreshOverview() {
      const [progressSyncService, wordRepo] = await Promise.all([
        getProgressSyncService(),
        getWordRepo(),
      ]);

      try {
        if (authService.isCloudLinked()) {
          await progressSyncService.hydrateProgressFromCloud();
        }
      } catch (error) {
        // 云端不可用时继续使用本地数据
      }

      const overview = wordRepo.getTodayReviewOverview();
      overview.totalWords = countTotalWords(wordRepo);
      overview.topLevelRootCount = countTopLevelRoots(wordRepo);
      this.overview = overview;
    },

    async refreshDownloadCenter() {
      try {
        const state = await downloadService.refreshDownloadCenterState({ includeOrders: false });
        this.downloadCenter = createDownloadCenterState(state);
      } catch (error) {
        this.downloadCenter = createDownloadCenterState(
          downloadService.getCachedDownloadOverview(),
        );
      }
    },

    startPractice() {
      if (!this.overview.dueCount) return;
      this.navigateToPage('/pages/practice/practice');
    },

    enterRoots() {
      this.switchTabPage('/pages/roots/roots');
    },

    startMemorizing() {
      this.navigateToPage('/pages/learning/learning');
    },

    openDownloadsPage() {
      this.navigateToPage('/pages/downloads/downloads');
    },

    openDownloadsEntry() {
      if (authService.isLoggedIn()) {
        this.openDownloadsPage();
        return;
      }

      const redirect = encodeURIComponent('/pages/downloads/downloads');
      this.navigateToPage(`/pages/login/login?redirect=${redirect}`);
    },
  },
};
</script>

<style lang="scss">
.today-page {
  min-height: 100vh;
  padding: 104rpx 28rpx 44rpx;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 12% 0%, rgba(255, 255, 255, 0.9), transparent 26%),
    radial-gradient(circle at 88% 10%, rgba(229, 234, 239, 0.46), transparent 22%),
    linear-gradient(180deg, #f4f6f8 0%, #eef1f4 42%, #f8f9fb 100%);
  color: #1f2933;
}

.today-card {
  border-radius: 38rpx;
  padding: 32rpx;
  box-sizing: border-box;
  box-shadow: 0 20rpx 60rpx rgba(15, 23, 42, 0.05);
}

.today-card + .today-card {
  margin-top: 24rpx;
}

.today-card--flow {
  background: var(--rf-focus-bg);
  color: var(--rf-focus-text);
}

.today-card--review,
.today-card--download {
  background: rgba(255, 255, 255, 0.64);
}

.today-card--download {
  border: 1rpx solid rgba(31, 41, 51, 0.08);
}

.today-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.today-card__title {
  font-size: 34rpx;
  line-height: 1.2;
  font-weight: 700;
}

.today-download-copy {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 24rpx;
}

.today-download-copy__line {
  font-size: 24rpx;
  line-height: 1.6;
  color: rgba(30, 36, 48, 0.72);
}

.today-metrics {
  display: flex;
  gap: 14rpx;
  margin-top: 24rpx;
}

.today-metrics--three .today-metric {
  padding: 16rpx;
}

.today-metric {
  flex: 1;
  min-width: 0;
  padding: 18rpx;
  border-radius: 24rpx;
  background: var(--rf-focus-surface);
}

.today-card--review .today-metric,
.today-card--download .today-metric {
  background: rgba(255, 255, 255, 0.8);
}

.today-metric__value {
  display: block;
  font-size: 36rpx;
  line-height: 1.1;
  font-weight: 700;
}

.today-metric__label {
  display: block;
  margin-top: 10rpx;
  font-size: 20rpx;
  color: var(--rf-focus-muted);
}

.today-card--review .today-metric__label,
.today-card--download .today-metric__label {
  color: rgba(30, 36, 48, 0.62);
}

.today-progress {
  margin-top: 24rpx;
}

.today-progress__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.today-progress__label,
.today-progress__value {
  font-size: 22rpx;
  color: var(--rf-focus-muted);
}

.today-progress__track {
  overflow: hidden;
  height: 14rpx;
  margin-top: 14rpx;
  border-radius: 999rpx;
  background: var(--rf-progress-track);
}

.today-progress__fill {
  height: 100%;
  min-width: 14rpx;
  border-radius: inherit;
  background: var(--rf-progress-fill);
}

.today-actions {
  display: flex;
  gap: 14rpx;
  margin-top: 24rpx;
}

.today-action {
  flex: 1;
  min-height: 92rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24rpx;
  box-sizing: border-box;
  font-size: 26rpx;
  font-weight: 700;
}

.today-action--primary {
  background: var(--rf-button-primary-bg);
  color: var(--rf-button-primary-text);
}

.today-action--secondary {
  border: 1rpx solid var(--rf-button-secondary-border);
  background: var(--rf-button-secondary-bg);
  color: var(--rf-button-secondary-text);
}

.today-page.theme-dark-zen {
  background: var(--rf-page-bg);
  color: var(--rf-page-text);
}

.theme-dark-zen .today-card--review,
.theme-dark-zen .today-card--review .today-metric,
.theme-dark-zen .today-card--download,
.theme-dark-zen .today-card--download .today-metric {
  background: var(--rf-surface);
  box-shadow: var(--rf-card-shadow);
}

.theme-dark-zen .today-card--review .today-card__title,
.theme-dark-zen .today-card--review .today-metric__value,
.theme-dark-zen .today-card--download .today-card__title,
.theme-dark-zen .today-card--download .today-metric__value {
  color: var(--rf-text-strong);
}

.theme-dark-zen .today-card--review .today-metric__label,
.theme-dark-zen .today-card--download .today-metric__label,
.theme-dark-zen .today-download-copy__line {
  color: var(--rf-text-muted);
}

@media (max-width: 420px) {
  .today-actions,
  .today-metrics {
    flex-direction: column;
  }
}
</style>
