<template>
  <view class="cloud-page" :class="currentTheme">
    <view class="cloud-shell">
      <view class="hero">
        <text class="hero__kicker">WECHAT CLOUD</text>
        <text class="hero__title">云环境配置</text>
        <text class="hero__desc">
          把微信云开发环境 ID 配进应用后，登录、进度同步和真实统计才能跑通。
        </text>
      </view>

      <view class="panel">
        <text class="panel__label">当前环境 ID</text>
        <input
          v-model="draftEnvId"
          class="panel__input"
          type="text"
          placeholder="例如 rootflow-prod-1gxxxxxx"
          placeholder-class="panel__placeholder"
        />
        <text class="panel__hint">
          在微信开发者工具的云开发控制台复制环境 ID。保存后会重新初始化云能力。
        </text>

        <view class="status-card" :class="{ 'is-ok': capability.ok }">
          <text class="status-card__title">{{
            capability.ok ? '云能力就绪' : '云能力未就绪'
          }}</text>
          <text class="status-card__meta">环境：{{ capability.envId || '未配置' }}</text>
          <text class="status-card__meta">
            {{ capability.message || '当前已经可以调用云函数。' }}
          </text>
        </view>

        <view class="action-row">
          <view class="action-button action-button--primary" @tap="saveEnvId">
            <text>保存环境</text>
          </view>
          <view class="action-button" @tap="checkCapability">
            <text>检测状态</text>
          </view>
        </view>
        <view class="action-row">
          <view class="action-button action-button--danger" @tap="clearEnvId">
            <text>清空配置</text>
          </view>
          <view class="action-button" @tap="openCloudDoc">
            <text>查看部署文档</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import {
  getCloudCapabilityStatus,
  getCloudEnvId,
  resetCloudEnvId,
  setCloudEnvId,
} from '../../services/cloudService';
import { STORAGE_KEYS, readStorage } from '../../services/storage';

export default {
  data() {
    return {
      currentTheme: 'theme-dark-zen',
      draftEnvId: '',
      capability: {
        configured: false,
        envId: '',
        canUseWeChatCloud: false,
        ok: false,
        code: '',
        message: '',
      },
    };
  },
  onShow() {
    const savedTheme = readStorage(STORAGE_KEYS.theme, 'theme-dark-zen');
    if (savedTheme) this.currentTheme = savedTheme;
    this.refreshCapability();
  },
  methods: {
    refreshCapability() {
      this.draftEnvId = getCloudEnvId();
      this.capability = getCloudCapabilityStatus();
    },
    saveEnvId() {
      const normalized = String(this.draftEnvId || '').trim();
      if (!normalized) {
        uni.showToast({ title: '请先输入环境 ID', icon: 'none' });
        return;
      }

      setCloudEnvId(normalized);
      this.refreshCapability();
      uni.showToast({ title: '环境已保存', icon: 'success' });
    },
    clearEnvId() {
      resetCloudEnvId();
      this.refreshCapability();
      uni.showToast({ title: '已清空环境配置', icon: 'none' });
    },
    checkCapability() {
      this.refreshCapability();
      uni.showToast({
        title: this.capability.ok ? '云能力可用' : '请先完成配置',
        icon: 'none',
      });
    },
    openCloudDoc() {
      uni.showModal({
        title: '部署文档',
        content: '请查看 docs/wechat-cloud-setup.md，按文档完成集合、索引和云函数部署。',
        showCancel: false,
      });
    },
  },
};
</script>

<style lang="scss">
.cloud-page {
  min-height: 100vh;
  padding: 120rpx 36rpx 48rpx;
  box-sizing: border-box;
}

.cloud-shell {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.hero__kicker {
  font-size: 22rpx;
  letter-spacing: 6rpx;
  opacity: 0.72;
}

.hero__title {
  font-size: 58rpx;
  font-weight: 700;
}

.hero__desc {
  font-size: 28rpx;
  line-height: 1.6;
  opacity: 0.78;
}

.panel {
  border-radius: 32rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.panel__label {
  font-size: 26rpx;
  font-weight: 600;
}

.panel__input {
  min-height: 92rpx;
  border-radius: 24rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}

.panel__placeholder {
  color: rgba(140, 160, 188, 0.72);
}

.panel__hint {
  font-size: 24rpx;
  line-height: 1.6;
  opacity: 0.72;
}

.status-card {
  border-radius: 24rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.status-card__title {
  font-size: 28rpx;
  font-weight: 600;
}

.status-card__meta {
  font-size: 24rpx;
  line-height: 1.5;
}

.action-row {
  display: flex;
  gap: 20rpx;
}

.action-button {
  flex: 1;
  min-height: 88rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}

.theme-dark-zen {
  background: #0a0a0b;
  color: #ffffff;

  .panel {
    background: rgba(255, 255, 255, 0.04);
    border: 1rpx solid rgba(255, 255, 255, 0.05);
  }

  .panel__input {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
    border: 1rpx solid rgba(255, 255, 255, 0.08);
  }

  .status-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1rpx solid rgba(255, 255, 255, 0.06);
  }

  .status-card.is-ok {
    background: rgba(57, 196, 140, 0.12);
    border-color: rgba(57, 196, 140, 0.18);
  }

  .action-button {
    background: rgba(255, 255, 255, 0.06);
    border: 1rpx solid rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .action-button--primary {
    background: rgba(255, 126, 95, 0.18);
    border-color: rgba(255, 126, 95, 0.22);
  }

  .action-button--danger {
    background: rgba(255, 77, 79, 0.16);
    border-color: rgba(255, 77, 79, 0.2);
  }
}

.theme-clay-pastel {
  background: #f0f4f8;
  color: #324257;

  .panel {
    background: rgba(255, 255, 255, 0.8);
    border: 1rpx solid rgba(72, 103, 138, 0.08);
  }

  .panel__input {
    background: rgba(72, 103, 138, 0.05);
    color: #324257;
    border: 1rpx solid rgba(72, 103, 138, 0.08);
  }

  .status-card {
    background: rgba(72, 103, 138, 0.05);
    border: 1rpx solid rgba(72, 103, 138, 0.08);
  }

  .status-card.is-ok {
    background: rgba(57, 196, 140, 0.12);
    border-color: rgba(57, 196, 140, 0.16);
  }

  .action-button {
    background: rgba(72, 103, 138, 0.06);
    border: 1rpx solid rgba(72, 103, 138, 0.08);
    color: #324257;
  }

  .action-button--primary {
    background: rgba(255, 126, 95, 0.14);
    border-color: rgba(255, 126, 95, 0.16);
  }

  .action-button--danger {
    background: rgba(255, 77, 79, 0.12);
    border-color: rgba(255, 77, 79, 0.16);
  }
}
</style>
