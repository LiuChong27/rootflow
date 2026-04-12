<template>
  <view class="cloud-page" :class="currentTheme">
    <view class="cloud-shell">
      <view class="hero">
        <text class="hero__kicker">WECHAT CLOUD</text>
        <text class="hero__title">Cloud Env Setup</text>
        <text class="hero__desc">
          Configure the WeChat Cloud environment ID here so login, sync, and real stats can run.
        </text>
      </view>

      <view class="panel">
        <text class="panel__label">Current Env ID</text>
        <input
          v-model="draftEnvId"
          class="panel__input"
          type="text"
          placeholder="Example: rootflow-prod-1gxxxxxx"
          placeholder-class="panel__placeholder"
        />
        <text class="panel__hint">
          Copy the environment ID from WeChat DevTools Cloud Development console. Saving will
          reinitialize cloud access.
        </text>

        <view class="status-card" :class="{ 'is-ok': capability.ok }">
          <text class="status-card__title">
            {{ capability.ok ? 'Cloud Ready' : 'Cloud Not Ready' }}
          </text>
          <text class="status-card__meta">Env: {{ capability.envId || 'Not configured' }}</text>
          <text class="status-card__meta">
            {{ capability.message || 'Cloud functions can be called in the current environment.' }}
          </text>
        </view>

        <view class="action-row">
          <view class="action-button action-button--primary" @tap="saveEnvId">
            <text>Save Env</text>
          </view>
          <view class="action-button" @tap="checkCapability">
            <text>Check Status</text>
          </view>
        </view>
        <view class="action-row">
          <view class="action-button action-button--danger" @tap="clearEnvId">
            <text>Clear Env</text>
          </view>
          <view class="action-button" @tap="openCloudDoc">
            <text>Open Guide</text>
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
        uni.showToast({ title: 'Enter env ID first', icon: 'none' });
        return;
      }

      setCloudEnvId(normalized);
      this.refreshCapability();
      uni.showToast({ title: 'Env saved', icon: 'success' });
    },
    clearEnvId() {
      resetCloudEnvId();
      this.refreshCapability();
      uni.showToast({ title: 'Env cleared', icon: 'none' });
    },
    checkCapability() {
      this.refreshCapability();
      uni.showToast({
        title: this.capability.ok ? 'Cloud is ready' : 'Cloud setup required',
        icon: 'none',
      });
    },
    openCloudDoc() {
      uni.showModal({
        title: 'Deployment Guide',
        content: 'Open docs/wechat-cloud-setup.md in the repository for step-by-step setup.',
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
