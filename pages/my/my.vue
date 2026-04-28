<template>
  <view class="my-page" :class="currentTheme">
    <theme-toggle-fab :theme="currentTheme" />

    <view class="page-head">
      <text class="page-head__title">我的</text>
    </view>

    <view class="account-card" @tap="handleAccountTap">
      <image class="account-card__avatar" :src="avatarUrl" mode="aspectFill" />
      <view class="account-card__meta">
        <text class="account-card__name">{{ displayName }}</text>
        <text class="account-card__status">{{ statusText }}</text>
      </view>
      <text class="account-card__arrow">›</text>
    </view>

    <view class="stats-grid">
      <view class="stat-card">
        <text class="stat-card__value">{{ stats.todayCompleted }}</text>
        <text class="stat-card__label">今日完成</text>
      </view>
      <view class="stat-card">
        <text class="stat-card__value">{{ stats.due }}</text>
        <text class="stat-card__label">待复习</text>
      </view>
      <view class="stat-card">
        <text class="stat-card__value">{{ stats.mastered }}</text>
        <text class="stat-card__label">已掌握</text>
      </view>
      <view class="stat-card">
        <text class="stat-card__value">{{ stats.days }}</text>
        <text class="stat-card__label">连续天数</text>
      </view>
    </view>

    <view class="section-card">
      <view class="menu-row" @tap="goToday">
        <text class="menu-row__title">今日学习</text>
        <text class="menu-row__arrow">›</text>
      </view>
      <view class="menu-row" @tap="goPractice">
        <text class="menu-row__title">进入复习</text>
        <text class="menu-row__arrow">›</text>
      </view>
      <view class="menu-row" @tap="goRoots">
        <text class="menu-row__title">词根图谱</text>
        <text class="menu-row__arrow">›</text>
      </view>
      <view class="menu-row" @tap="goDownloads">
        <text class="menu-row__title">资料下载中心</text>
        <text class="menu-row__arrow">›</text>
      </view>
    </view>

    <view class="section-card">
      <view class="menu-row menu-row--danger" @tap="clearMemory">
        <text class="menu-row__title">清空学习记录</text>
        <text class="menu-row__arrow">›</text>
      </view>
      <view v-if="userInfo.isLogged" class="menu-row menu-row--danger" @tap="handleLogout">
        <text class="menu-row__title">退出登录</text>
        <text class="menu-row__arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script>
import themePage from '../../mixins/themePage';
import authService from '../../services/authService';
import { getProgressSyncService, getWordRepo } from '../../services/lazyServices';

function buildUserState(session = authService.getStoredSession()) {
  return {
    isLogged: Boolean(session.userId),
    name: session.nickName || '',
    avatar: session.avatarUrl || '',
  };
}

function createStatsState(stats = {}) {
  return {
    mastered: Number(stats.masteredWords || 0),
    days: Number(stats.streakDays || 0),
    due: Number(stats.dueWords || 0),
    todayCompleted: Number(stats.todayCompletedWords || 0),
  };
}

export default {
  mixins: [themePage],
  data() {
    return {
      userInfo: buildUserState(),
      stats: createStatsState(),
    };
  },
  computed: {
    avatarUrl() {
      return this.userInfo.avatar || '/static/logo.png';
    },
    displayName() {
      if (this.userInfo.isLogged) {
        return this.userInfo.name || '微信用户';
      }
      return '未登录';
    },
    statusText() {
      return this.userInfo.isLogged ? '已登录' : '点击登录';
    },
  },
  onShow() {
    this.userInfo = buildUserState();
    this.refreshStats();
  },
  methods: {
    async refreshStats() {
      try {
        const progressSyncService = await getProgressSyncService();
        this.stats = createStatsState(progressSyncService.getLocalProgressStats());
      } catch (error) {
        this.stats = createStatsState();
      }
    },
    handleAccountTap() {
      if (this.userInfo.isLogged) return;
      uni.navigateTo({ url: '/pages/login/login' });
    },
    goToday() {
      uni.switchTab({ url: '/pages/today/today' });
    },
    goPractice() {
      uni.navigateTo({ url: '/pages/practice/practice' });
    },
    goRoots() {
      uni.switchTab({ url: '/pages/roots/roots' });
    },
    goDownloads() {
      uni.navigateTo({ url: '/pages/downloads/downloads' });
    },
    handleLogout() {
      uni.showModal({
        title: '退出登录',
        content: '确认退出当前账号？',
        success: (res) => {
          if (!res.confirm) return;
          authService.logoutLocally();
          this.userInfo = buildUserState();
          uni.showToast({ title: '已退出', icon: 'none' });
        },
      });
    },
    clearMemory() {
      uni.showModal({
        title: '清空学习记录',
        content: '确认清空当前学习记录？',
        confirmText: '确认',
        confirmColor: '#d64545',
        success: async (res) => {
          if (!res.confirm) return;

          try {
            if (authService.isCloudLinked()) {
              const progressSyncService = await getProgressSyncService();
              await progressSyncService.clearProgressAndSync();
            } else {
              const wordRepo = await getWordRepo();
              wordRepo.clearProgress({ clearActivity: true });
            }
            await this.refreshStats();
            uni.showToast({ title: '已清空', icon: 'none' });
          } catch (error) {
            uni.showToast({ title: error.message || '清空失败', icon: 'none' });
          }
        },
      });
    },
  },
};
</script>

<style lang="scss">
.my-page {
  min-height: 100vh;
  padding: 112rpx 28rpx 44rpx;
  box-sizing: border-box;
  background: var(--rf-page-bg);
  color: var(--rf-page-text);
}

.page-head {
  margin-bottom: 24rpx;
}

.page-head__title {
  font-size: 56rpx;
  font-weight: 700;
  color: var(--rf-text-strong);
}

.account-card,
.section-card {
  background: var(--rf-surface);
  border: 1rpx solid var(--rf-border);
  box-shadow: var(--rf-card-shadow);
}

.account-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx;
  border-radius: 32rpx;
}

.account-card__avatar {
  width: 104rpx;
  height: 104rpx;
  border-radius: 28rpx;
  background: var(--rf-surface-elevated);
}

.account-card__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.account-card__name {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--rf-text-strong);
}

.account-card__status {
  font-size: 24rpx;
  color: var(--rf-text-muted);
}

.account-card__arrow,
.menu-row__arrow {
  font-size: 40rpx;
  color: var(--rf-text-soft);
}

.stats-grid {
  margin-top: 20rpx;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.stat-card {
  padding: 24rpx;
  border-radius: 28rpx;
  background: var(--rf-surface);
  border: 1rpx solid var(--rf-border);
  box-shadow: var(--rf-card-shadow);
}

.stat-card__value {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: var(--rf-text-strong);
}

.stat-card__label {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: var(--rf-text-muted);
}

.section-card {
  margin-top: 20rpx;
  border-radius: 32rpx;
  overflow: hidden;
}

.menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 28rpx;
  border-bottom: 1rpx solid var(--rf-border);
}

.menu-row:last-child {
  border-bottom: none;
}

.menu-row__title {
  font-size: 28rpx;
  color: var(--rf-text-strong);
}

.menu-row--danger .menu-row__title {
  color: var(--rf-danger-text);
}

@media (max-width: 420px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
