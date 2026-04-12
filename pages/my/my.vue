<template>
  <view class="my-container" :class="currentTheme">
    <!-- 头部用户信息 -->
    <view class="profile-header" @tap="handleLogin">
      <image class="avatar" :src="userInfo.avatar || '/static/logo.png'" mode="aspectFill"></image>
      <view class="user-info">
        <text class="name">{{ userInfo.isLogged ? userInfo.name : '点击登录' }}</text>
        <text class="status">{{
          userInfo.isLogged ? sessionStatusText : '接入微信登录与云同步'
        }}</text>
      </view>
      <view class="arrow">›</view>
    </view>

    <!-- 核心数据看板 -->
    <view class="stats-area">
      <view class="stat-card">
        <text class="num">{{ stats.mastered }}</text>
        <text class="label">成熟果实</text>
      </view>
      <view class="stat-card line-divider"></view>
      <view class="stat-card">
        <text class="num">{{ stats.roots }}</text>
        <text class="label">点亮词根</text>
      </view>
      <view class="stat-card line-divider"></view>
      <view class="stat-card">
        <text class="num">{{ stats.days }}</text>
        <text class="label">静心天数</text>
      </view>
    </view>

    <!-- 功能列表 -->
    <view class="action-list">
      <view class="action-group">
        <view class="action-item" @tap="toggleTheme">
          <view class="item-left">
            <text class="icon">{{ currentTheme === 'theme-dark-zen' ? '🌙' : '🍦' }}</text>
            <text class="item-text">视觉风格</text>
          </view>
          <view class="item-right">
            <text class="item-desc">{{
              currentTheme === 'theme-dark-zen' ? '暗黑禅意' : '奶油黏土'
            }}</text>
            <text class="arrow">›</text>
          </view>
        </view>
        <view class="action-item" @tap="viewHistory">
          <view class="item-left">
            <text class="icon">📈</text>
            <text class="item-text">记忆生长曲线</text>
          </view>
          <view class="item-right"><text class="arrow">›</text></view>
        </view>
        <view class="action-item" @tap="syncNow">
          <view class="item-left">
            <text class="icon">☁️</text>
            <text class="item-text">立即同步</text>
          </view>
          <view class="item-right">
            <text class="item-desc">{{ syncStatusText }}</text>
            <text class="arrow">›</text>
          </view>
        </view>
        <view class="action-item" @tap="openCloudConfig">
          <view class="item-left">
            <text class="icon">⚙️</text>
            <text class="item-text">云环境配置</text>
          </view>
          <view class="item-right">
            <text class="item-desc">{{ cloudEnvSummary }}</text>
            <text class="arrow">›</text>
          </view>
        </view>
      </view>

      <view class="action-group" v-if="userInfo.isLogged">
        <view class="action-item" @tap="clearMemory">
          <view class="item-left">
            <text class="icon">🧹</text>
            <text class="item-text danger-text">清空画布 (重置记忆)</text>
          </view>
        </view>
      </view>
    </view>

    <view class="version-text">RootFlow v1.0.0 | 极简减法</view>
  </view>
</template>

<script>
import authService from '../../services/authService';
import { getCloudCapabilityStatus } from '../../services/cloudService';
import progressSyncService from '../../services/progressSyncService';

export default {
  data() {
    return {
      currentTheme: 'theme-dark-zen',
      userInfo: {
        isLogged: false,
        name: '',
        avatar: '',
      },
      stats: {
        mastered: '--',
        roots: '--',
        days: '--',
      },
      isSyncing: false,
      lastSyncAt: 0,
      cloudStatus: {
        configured: false,
        envId: '',
        ok: false,
        code: '',
        message: '',
      },
    };
  },
  computed: {
    sessionStatusText() {
      if (!this.userInfo.isLogged) return '';
      if (this.isSyncing) return '云端同步中...';
      if (this.lastSyncAt) {
        return `已连接云端 · ${this.formatSyncTime(this.lastSyncAt)}`;
      }
      return '已连接微信用户';
    },
    syncStatusText() {
      if (!this.userInfo.isLogged) return '未登录';
      if (this.isSyncing) return '同步中';
      return this.lastSyncAt ? this.formatSyncTime(this.lastSyncAt) : '未同步';
    },
    cloudEnvSummary() {
      if (!this.cloudStatus.configured) return '未配置';
      if (this.cloudStatus.ok) return '已就绪';
      return '待检测';
    },
  },
  async onShow() {
    // 每次显示页面(多Tab切换)均从本地存储同步主题状态，保证全局同步
    const savedTheme = uni.getStorageSync('user_theme');
    if (savedTheme) {
      this.currentTheme = savedTheme;
    }

    await this.refreshUserState();
    this.cloudStatus = getCloudCapabilityStatus();
  },
  methods: {
    async refreshUserState() {
      const session = authService.getStoredSession();
      this.lastSyncAt = Number(session.lastSyncAt || 0);
      if (!session.userId) {
        this.userInfo = { isLogged: false, name: '', avatar: '' };
        const stats = progressSyncService.getLocalProgressStats();
        this.stats = {
          mastered: stats.masteredWords || 0,
          roots: stats.masteredRoots || 0,
          days: stats.streakDays || 0,
        };
        return;
      }

      this.userInfo = {
        isLogged: true,
        name: session.nickName || 'RootFlow 用户',
        avatar: session.avatarUrl || '/static/logo.png',
      };

      try {
        const hydrated = await progressSyncService.hydrateProgressFromCloud();
        const stats =
          hydrated && hydrated.stats ? hydrated.stats : progressSyncService.getLocalProgressStats();
        this.stats = {
          mastered: stats.masteredWords || 0,
          roots: stats.masteredRoots || 0,
          days: stats.streakDays || 0,
        };
        const latestSession = authService.getStoredSession();
        this.lastSyncAt = Number(latestSession.lastSyncAt || 0);
      } catch (error) {
        const stats = progressSyncService.getLocalProgressStats();
        this.stats = {
          mastered: stats.masteredWords || 0,
          roots: stats.masteredRoots || 0,
          days: stats.streakDays || 0,
        };
        uni.showToast({ title: error.message || '同步失败', icon: 'none' });
      }
    },
    formatSyncTime(timestamp) {
      if (!timestamp) return '未同步';
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return '未同步';
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      return `${hour}:${minute}`;
    },
    async handleLogin() {
      if (this.userInfo.isLogged) {
        await this.syncNow();
        return;
      }

      uni.showLoading({ title: '登录中...' });
      try {
        const session = await authService.loginWithWeChatProfile();
        this.userInfo = {
          isLogged: true,
          name: session.nickName || 'RootFlow 用户',
          avatar: session.avatarUrl || '/static/logo.png',
        };
        await this.syncNow({ silent: true });
        uni.showToast({ title: '微信已连接', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '登录失败', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    },
    toggleTheme() {
      // 切换全局主题并本地持久化
      this.currentTheme =
        this.currentTheme === 'theme-dark-zen' ? 'theme-clay-pastel' : 'theme-dark-zen';
      uni.setStorageSync('user_theme', this.currentTheme);
      uni.vibrateShort({ type: 'light' });
    },
    viewHistory() {
      const stats = progressSyncService.getLocalProgressStats();
      uni.showToast({ title: `已连续学习 ${stats.streakDays || 0} 天`, icon: 'none' });
    },
    async syncNow(options = {}) {
      const { silent = false } = options || {};
      if (!this.userInfo.isLogged) {
        uni.showToast({ title: '请先登录微信', icon: 'none' });
        return;
      }

      this.isSyncing = true;
      if (!silent) uni.showLoading({ title: '同步中...' });
      try {
        const result = await progressSyncService.syncProgressToCloud();
        const stats =
          result && result.stats ? result.stats : progressSyncService.getLocalProgressStats();
        this.stats = {
          mastered: stats.masteredWords || 0,
          roots: stats.masteredRoots || 0,
          days: stats.streakDays || 0,
        };
        this.lastSyncAt = Number(authService.getStoredSession().lastSyncAt || Date.now());
        if (!silent) uni.showToast({ title: '同步完成', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error.message || '同步失败', icon: 'none' });
      } finally {
        this.isSyncing = false;
        if (!silent) uni.hideLoading();
      }
    },
    openCloudConfig() {
      uni.navigateTo({
        url: '/pages/cloud-config/cloud-config',
      });
    },
    async clearMemory() {
      // 呼应文档中的“清理成就感”，引入防误触高敏危险操作
      uni.showModal({
        title: '清空画布',
        content: '确定要抹除所有记忆痕迹，让一切归于空白吗？',
        confirmText: '归零',
        confirmColor: '#FF4D4F',
        cancelText: '保留',
        success: (res) => {
          if (res.confirm) {
            uni.vibrateLong();
            progressSyncService
              .clearProgressAndSync()
              .then((result) => {
                const stats =
                  result && result.stats
                    ? result.stats
                    : progressSyncService.getLocalProgressStats();
                this.stats = {
                  mastered: stats.masteredWords || 0,
                  roots: stats.masteredRoots || 0,
                  days: stats.streakDays || 0,
                };
                this.lastSyncAt = Number(authService.getStoredSession().lastSyncAt || Date.now());
                uni.showToast({ title: '已归于虚无', icon: 'none' });
              })
              .catch((error) => {
                uni.showToast({ title: error.message || '清空失败', icon: 'none' });
              });
          }
        },
      });
    },
  },
};
</script>

<style lang="scss">
/* ====== 基础共用布局 ====== */
.my-container {
  min-height: 100vh;
  padding: 120rpx 40rpx 40rpx;
  box-sizing: border-box;
  transition: background-color 0.5s ease;
}

.profile-header {
  display: flex;
  align-items: center;
  margin-bottom: 80rpx;
  padding: 20rpx;
  border-radius: 40rpx;
  transition: all 0.3s;
  &:active {
    transform: scale(0.98);
  }

  .avatar {
    width: 120rpx;
    height: 120rpx;
    border-radius: 60rpx;
    margin-right: 40rpx;
    background-color: rgba(125, 125, 125, 0.1); /* 头像占位符 */
  }
  .user-info {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .name {
    font-size: 48rpx;
    font-weight: 600;
    margin-bottom: 8rpx;
    transition: color 0.5s;
    font-family: -apple-system, sans-serif;
  }
  .status {
    font-size: 24rpx;
    transition: color 0.5s;
  }
  .arrow {
    font-size: 40rpx;
    opacity: 0.5;
    transition: color 0.5s;
  }
}

.stats-area {
  display: flex;
  align-items: center;
  margin-bottom: 80rpx;
  border-radius: 40rpx;
  padding: 40rpx 20rpx;
  transition: all 0.5s ease;
  .stat-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    .num {
      font-size: 56rpx;
      font-weight: bold;
      margin-bottom: 12rpx;
      transition: color 0.5s;
      font-family: -apple-system, sans-serif;
    }
    .label {
      font-size: 24rpx;
      transition: color 0.5s;
    }
  }
  .line-divider {
    flex: none;
    width: 2rpx;
    height: 60rpx;
    opacity: 0.2;
  }
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 40rpx;
  .action-group {
    border-radius: 40rpx;
    overflow: hidden;
    transition: all 0.5s ease;
  }
  .action-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 40rpx;
    transition: all 0.3s;
    &:active {
      opacity: 0.7;
    }

    .item-left {
      display: flex;
      align-items: center;
    }
    .icon {
      font-size: 36rpx;
      margin-right: 20rpx;
    }
    .item-text {
      font-size: 30rpx;
      font-weight: 500;
      transition: color 0.5s;
    }

    .item-right {
      display: flex;
      align-items: center;
    }
    .item-desc {
      font-size: 26rpx;
      margin-right: 16rpx;
      transition: color 0.5s;
      opacity: 0.7;
    }
    .arrow {
      font-size: 36rpx;
      opacity: 0.5;
      transition: color 0.5s;
    }
  }
}

.version-text {
  text-align: center;
  margin-top: 80rpx;
  font-size: 22rpx;
  opacity: 0.3;
  transition: color 0.5s;
}

/* ====== 主题1：暗黑禅意 (Dark Zen) ====== */
.theme-dark-zen {
  background-color: #0a0a0b;
  .profile-header {
    .name {
      color: #ffffff;
    }
    .status {
      color: #5e5e60;
    }
    .arrow {
      color: #5e5e60;
    }
  }
  .stats-area {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.02);
    box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.2);
    .num {
      color: #ffffff;
    }
    .label {
      color: #8ca0bc;
    }
    .line-divider {
      background-color: #ffffff;
    }
  }
  .action-group {
    background-color: #121212;
    border: 1px solid rgba(255, 255, 255, 0.02);
  }
  .action-item {
    border-bottom: 1px solid rgba(255, 255, 255, 0.02);
    &:last-child {
      border-bottom: none;
    }
    .item-text {
      color: #e5e5ea;
    }
    .item-desc {
      color: #8ca0bc;
    }
    .arrow {
      color: #5e5e60;
    }
    .danger-text {
      color: #ff4d4f;
    }
  }
  .version-text {
    color: #ffffff;
  }
}

/* ====== 主题2：奶油黏土 (Clay Pastel) ====== */
.theme-clay-pastel {
  background-color: #f0f4f8;
  .profile-header {
    .name {
      color: #4a5a70;
    }
    .status {
      color: #a0b0c4;
    }
    .arrow {
      color: #a0b0c4;
    }
  }
  .stats-area {
    background-color: #f0f4f8;
    border-radius: 40rpx;
    box-shadow:
      20rpx 20rpx 40rpx #d9e2ec,
      -20rpx -20rpx 40rpx #ffffff;
    .num {
      color: #7b8cde;
    }
    .label {
      color: #a0b0c4;
    }
    .line-divider {
      background-color: #a0b0c4;
    }
  }
  .action-group {
    background-color: #f0f4f8;
    box-shadow:
      16rpx 16rpx 32rpx #d9e2ec,
      -16rpx -16rpx 32rpx #ffffff;
  }
  .action-item {
    border-bottom: 1px solid rgba(217, 226, 236, 0.4);
    &:last-child {
      border-bottom: none;
    }
    .item-text {
      color: #4a5a70;
    }
    .item-desc {
      color: #7b8cde;
    }
    .arrow {
      color: #a0b0c4;
    }
    .danger-text {
      color: #f28c8c;
    }
  }
  .version-text {
    color: #4a5a70;
  }
}
</style>
