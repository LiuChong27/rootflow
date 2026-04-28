<template>
  <view class="downloads-page" :class="currentTheme">
    <theme-toggle-fab :theme="currentTheme" />

    <view class="downloads-shell">
      <view class="page-topbar">
        <view class="page-home-button" @tap="goHome">
          <text>返回主页</text>
        </view>
      </view>

      <view class="page-head">
        <view class="page-copy">
          <text class="page-kicker">ROOTFLOW PDF HUB</text>
          <text class="page-title">词根资料下载中心</text>
          <text class="page-subtitle"
            >登录后可免费下载全部 A-Z PDF；本机已保存的最新资料不会重复下载。</text
          >
        </view>
      </view>

      <view class="hero-card">
        <view class="hero-card__row">
          <view>
            <text class="hero-card__label">下载状态</text>
            <text class="hero-card__value">{{ benefitSummary }}</text>
          </view>
          <view
            class="hero-card__badge"
            :class="{
              'is-member': downloadBenefits.isFreeAccess || downloadBenefits.isLifetimeMember,
            }"
          >
            <text>{{ accessBadgeLabel }}</text>
          </view>
        </view>

        <view class="hero-stats">
          <view class="hero-stat">
            <text class="hero-stat__value">{{ assets.length }}</text>
            <text class="hero-stat__label">云端资料</text>
          </view>
          <view class="hero-stat">
            <text class="hero-stat__value">{{ downloadBenefits.availableLocalCount || 0 }}</text>
            <text class="hero-stat__label">本机已存</text>
          </view>
          <view class="hero-stat">
            <text class="hero-stat__value">{{ accessStatValue }}</text>
            <text class="hero-stat__label">下载权限</text>
          </view>
        </view>

        <view class="hero-note">
          <text>全部资料已开放下载，本机已保存的文件不会重复下载。</text>
        </view>

        <view v-if="!isLoggedIn" class="hero-login">
          <view class="hero-login__copy">
            <text class="hero-login__title">登录后即可下载全部资料</text>
            <text class="hero-login__desc"
              >未登录时可以先浏览目录，登录后即可免费下载全部 A-Z PDF。</text
            >
          </view>
          <view class="hero-login__button" @tap="goLogin">
            <text>去登录</text>
          </view>
        </view>
      </view>

      <view class="section-card">
        <view class="section-head">
          <text class="section-title">选择资料</text>
          <text class="section-meta">{{ selectedAssetKeys.length }}/{{ assets.length }} 已选</text>
        </view>

        <view class="selection-toolbar">
          <view class="toolbar-button" @tap="toggleSelectAll">
            <text>{{ isAllSelected ? '清空全选' : '全选资料' }}</text>
          </view>
          <view class="toolbar-button toolbar-button--ghost" @tap="clearSelection">
            <text>清空</text>
          </view>
        </view>

        <view class="asset-grid">
          <view
            v-for="asset in assets"
            :key="asset.assetKey"
            class="asset-chip"
            :class="{
              'is-selected': isSelected(asset.assetKey),
              'is-local': asset.isAvailableLocally,
              'is-disabled': !asset.canDownload,
            }"
            @tap="toggleAsset(asset)"
          >
            <view class="asset-chip__head">
              <text class="asset-chip__title">{{ getAssetDisplayTitle(asset) }}</text>
              <view class="asset-chip__signals">
                <view v-if="isSelected(asset.assetKey)" class="asset-chip__check">
                  <text>✓</text>
                </view>
                <text class="asset-chip__badge">{{ getAssetBadge(asset) }}</text>
              </view>
            </view>
            <text class="asset-chip__meta">{{
              !asset.canDownload
                ? '待上架'
                : asset.isAvailableLocally
                  ? '本机已存'
                  : asset.version
                    ? '待下载'
                    : '云端可下'
            }}</text>
            <view
              v-if="asset.isAvailableLocally"
              class="asset-chip__link"
              @tap.stop="openLocalAsset(asset)"
            >
              <text>打开</text>
            </view>
          </view>
        </view>
      </view>

      <view class="section-card">
        <view class="section-head">
          <text class="section-title">本次下载</text>
          <text class="section-meta">{{ selectionEstimate.totalSizeLabel }}</text>
        </view>

        <view class="summary-grid">
          <view class="summary-card">
            <text class="summary-card__value">{{ selectionEstimate.selectedCount }}</text>
            <text class="summary-card__label">已选资料</text>
          </view>
          <view class="summary-card">
            <text class="summary-card__value">{{ selectionEstimate.pendingCount }}</text>
            <text class="summary-card__label">将新下载</text>
          </view>
          <view class="summary-card">
            <text class="summary-card__value">{{ selectionAccessValue }}</text>
            <text class="summary-card__label">下载权限</text>
          </view>
        </view>

        <text v-if="progressText" class="progress-text">{{ progressText }}</text>

        <view
          class="download-button"
          :class="{ 'is-disabled': !canStartDownload }"
          @tap="handleDownload"
        >
          <text>{{ downloadButtonText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import authService from '../../services/authService';
import downloadService, { formatAmountFen, pricingCards } from '../../services/downloadService';
import themePage from '../../mixins/themePage';

function createState(input = {}) {
  const state = input && typeof input === 'object' ? input : {};
  return {
    assets: Array.isArray(state.assets) ? state.assets : [],
    downloadBenefits: state.downloadBenefits || {
      isFreeAccess: true,
      isLifetimeMember: false,
      creditBalance: 0,
      availableLocalCount: 0,
    },
    recentOrders: Array.isArray(state.recentOrders) ? state.recentOrders : [],
    purchaseCapability: state.purchaseCapability || {
      canPurchase: true,
      reason: '',
    },
    purchaseEnabled: Boolean(state.purchaseEnabled),
    purchaseUnavailableReason: String(state.purchaseUnavailableReason || '').trim(),
  };
}

export default {
  mixins: [themePage],
  data() {
    return {
      isLoading: false,
      isSubmitting: false,
      progressText: '',
      selectedAssetKeys: [],
      assets: [],
      downloadBenefits: {
        isFreeAccess: true,
        isLifetimeMember: false,
        creditBalance: 0,
        availableLocalCount: 0,
      },
      recentOrders: [],
      purchaseCapability: {
        canPurchase: true,
        reason: '',
      },
      purchaseEnabled: false,
      purchaseUnavailableReason: '',
      pricingCards,
    };
  },
  computed: {
    isLoggedIn() {
      return authService.isLoggedIn();
    },
    benefitSummary() {
      return downloadService.getBenefitSummary(this.downloadBenefits);
    },
    selectionEstimate() {
      return downloadService.estimateSelection({
        assets: this.assets,
        selectedAssetKeys: this.selectedAssetKeys,
        downloadBenefits: this.downloadBenefits,
      });
    },
    accessBadgeLabel() {
      if (this.downloadBenefits.isFreeAccess) return 'OPEN';
      return this.downloadBenefits.isLifetimeMember ? 'MEMBER' : 'PDF PASS';
    },
    accessStatValue() {
      if (this.downloadBenefits.isFreeAccess) return 'FREE';
      return this.downloadBenefits.isLifetimeMember ? '∞' : this.downloadBenefits.creditBalance;
    },
    isAllSelected() {
      return this.assets.length > 0 && this.selectedAssetKeys.length === this.assets.length;
    },
    selectionAccessValue() {
      if (this.downloadBenefits.isFreeAccess) return 'FREE';
      return this.selectionEstimate.estimatedCredits;
    },
    canPurchase() {
      return this.purchaseCapability.canPurchase && this.purchaseEnabled;
    },
    purchaseHint() {
      if (!this.purchaseCapability.canPurchase) {
        return this.purchaseCapability.reason;
      }
      if (!this.purchaseEnabled && this.purchaseUnavailableReason) {
        return this.purchaseUnavailableReason;
      }
      return '';
    },
    canStartDownload() {
      return !this.isSubmitting && this.selectedAssetKeys.length > 0;
    },
    downloadButtonText() {
      if (this.isSubmitting) return '处理中...';
      if (!this.selectedAssetKeys.length) return '请选择资料';
      if (!this.isLoggedIn) return '登录后开始下载';
      return '开始下载';
    },
  },
  async onShow() {
    await this.refreshPage();
  },
  methods: {
    formatAmountFen,
    getAssetBadge(asset) {
      const coveredLetters =
        asset && Array.isArray(asset.coveredLetters) && asset.coveredLetters.length
          ? asset.coveredLetters
          : [asset.letter];
      return coveredLetters.map((letter) => String(letter || '').toUpperCase()).join('/');
    },
    getAssetDisplayTitle(asset) {
      return String((asset && asset.title) || '')
        .replace(/\.pdf$/i, '')
        .trim();
    },
    async refreshPage() {
      this.isLoading = true;
      try {
        const state = createState(
          await downloadService.refreshDownloadCenterState({ includeOrders: false }),
        );
        this.assets = state.assets;
        this.downloadBenefits = state.downloadBenefits;
        this.recentOrders = state.recentOrders;
        this.purchaseCapability = state.purchaseCapability;
        this.purchaseEnabled = state.purchaseEnabled;
        this.purchaseUnavailableReason = state.purchaseUnavailableReason;
      } catch (error) {
        const cached = createState(downloadService.getCachedDownloadOverview());
        this.assets = cached.assets;
        this.downloadBenefits = cached.downloadBenefits;
        this.recentOrders = cached.recentOrders;
        this.purchaseCapability = cached.purchaseCapability;
        this.purchaseEnabled = false;
        this.purchaseUnavailableReason = error.message || '云端目录暂不可用';
      } finally {
        this.isLoading = false;
      }
    },
    isSelected(assetKey) {
      return this.selectedAssetKeys.includes(assetKey);
    },
    toggleAsset(asset) {
      if (!asset.canDownload) return;
      if (this.isSelected(asset.assetKey)) {
        this.selectedAssetKeys = this.selectedAssetKeys.filter((item) => item !== asset.assetKey);
        return;
      }
      this.selectedAssetKeys = [...this.selectedAssetKeys, asset.assetKey];
    },
    toggleSelectAll() {
      if (this.isAllSelected) {
        this.selectedAssetKeys = [];
        return;
      }
      this.selectedAssetKeys = this.assets
        .filter((asset) => asset.canDownload)
        .map((asset) => asset.assetKey);
    },
    clearSelection() {
      this.selectedAssetKeys = [];
    },
    goHome() {
      uni.switchTab({
        url: '/pages/today/today',
        fail: () => {
          uni.reLaunch({
            url: '/pages/today/today',
          });
        },
      });
    },
    goLogin() {
      const redirect = encodeURIComponent('/pages/downloads/downloads');
      uni.navigateTo({
        url: `/pages/login/login?redirect=${redirect}`,
      });
    },
    async handlePurchase(sku) {
      if (!this.isLoggedIn) {
        this.goLogin();
        return;
      }

      if (!this.canPurchase) {
        uni.showToast({
          title: this.purchaseHint || '当前不可购买',
          icon: 'none',
        });
        return;
      }

      this.isSubmitting = true;
      try {
        const result = await downloadService.purchaseSku(sku, { source: 'downloads' });
        await this.refreshPage();
        uni.showToast({
          title: result.message || '权益已更新',
          icon: 'success',
        });
      } catch (error) {
        uni.showToast({
          title: error.message || '购买失败',
          icon: 'none',
        });
      } finally {
        this.isSubmitting = false;
      }
    },
    async openLocalAsset(asset) {
      try {
        await downloadService.openDownloadedAsset(asset);
      } catch (error) {
        uni.showToast({
          title: error.message || '打开失败',
          icon: 'none',
        });
        await this.refreshPage();
      }
    },
    async handleDownload() {
      if (!this.selectedAssetKeys.length || this.isSubmitting) return;

      if (!this.isLoggedIn) {
        this.goLogin();
        return;
      }

      this.isSubmitting = true;
      this.progressText = '';

      try {
        const result = await downloadService.downloadSelectedAssets({
          assets: this.assets,
          selectedAssetKeys: this.selectedAssetKeys,
          onProgress: (payload) => {
            this.progressText = `正在下载 ${payload.asset.title}（${payload.current}/${payload.total}）`;
          },
        });
        await this.refreshPage();
        this.progressText = '';
        const failureDetail = result.failures
          .map((item) => `${item.title || item.assetKey}: ${item.message}`)
          .join('\n');
        const savedDetail = result.successes
          .map((item) => `${item.title || item.assetKey}: ${item.savedFilePath || '已保存'}`)
          .join('\n');
        uni.showModal({
          title: '下载结果',
          content: [
            `成功 ${result.summary.successCount} 份，跳过 ${result.summary.skippedCount} 份，失败 ${result.summary.failureCount} 份。`,
            savedDetail ? `保存位置：\n${savedDetail}` : '',
            savedDetail ? '也可以点资料卡片上的“打开”查看。' : '',
            failureDetail,
          ]
            .filter(Boolean)
            .join('\n'),
          showCancel: false,
        });
      } catch (error) {
        this.progressText = '';
        uni.showToast({
          title: error.message || '下载失败',
          icon: 'none',
        });
      } finally {
        this.isSubmitting = false;
      }
    },
    formatOrderStatus(status) {
      const key = String(status || '').trim();
      if (key === 'fulfilled') return '已生效';
      if (key === 'paid') return '已支付';
      if (key === 'created') return '待支付';
      if (key === 'payment_disabled') return '待配置';
      return key || '处理中';
    },
    formatOrderMeta(order) {
      const date = new Date(Number(order.updatedAt || order.createdAt || 0));
      const dateText = Number.isFinite(date.getTime())
        ? `${date.getMonth() + 1}/${date.getDate()}`
        : '';
      return `¥${formatAmountFen(order.amountFen)} · ${dateText}`;
    },
  },
};
</script>

<style lang="scss">
.downloads-page {
  min-height: 100vh;
  padding: 110rpx 28rpx 44rpx;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 10% 8%, rgba(255, 241, 226, 0.9), transparent 24%),
    radial-gradient(circle at 90% 4%, rgba(218, 236, 255, 0.72), transparent 20%),
    linear-gradient(180deg, #f6f2ed 0%, #f9f6f2 44%, #f3f6fa 100%);
  color: #1f2933;
}

.downloads-shell {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.page-topbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.page-home-button {
  min-height: 64rpx;
  padding: 0 24rpx;
  border-radius: 18rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.58);
  box-shadow: 0 16rpx 42rpx rgba(15, 23, 42, 0.04);
  font-size: 22rpx;
  font-weight: 700;
  color: #1f2933;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.page-copy {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.page-kicker {
  font-size: 20rpx;
  letter-spacing: 3rpx;
  color: rgba(31, 41, 51, 0.52);
}

.page-title {
  font-size: 50rpx;
  font-weight: 700;
  color: #1f2933;
}

.page-subtitle {
  font-size: 24rpx;
  line-height: 1.7;
  color: rgba(31, 41, 51, 0.66);
}

.hero-card,
.section-card {
  border-radius: 34rpx;
  background: rgba(255, 255, 255, 0.82);
  border: 1rpx solid rgba(31, 41, 51, 0.06);
  box-shadow: 0 24rpx 64rpx rgba(15, 23, 42, 0.06);
}

.hero-card {
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.hero-card__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.hero-card__label {
  display: block;
  font-size: 22rpx;
  color: rgba(31, 41, 51, 0.6);
}

.hero-card__value {
  display: block;
  margin-top: 10rpx;
  font-size: 42rpx;
  font-weight: 700;
  color: #102030;
}

.hero-card__badge {
  min-width: 140rpx;
  padding: 14rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 153, 61, 0.12);
  text-align: center;
  font-size: 20rpx;
  font-weight: 700;
  color: #d97706;
}

.hero-card__badge.is-member {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
}

.hero-stats,
.summary-grid,
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.hero-stat,
.summary-card {
  padding: 20rpx;
  border-radius: 24rpx;
  background: rgba(243, 246, 250, 0.9);
}

.hero-stat__value,
.summary-card__value {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #102030;
}

.hero-stat__label,
.summary-card__label {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  color: rgba(31, 41, 51, 0.56);
}

.hero-note {
  font-size: 22rpx;
  line-height: 1.7;
  color: rgba(31, 41, 51, 0.72);
}

.hero-login {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(16, 32, 48, 0.06);
}

.hero-login__copy {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.hero-login__title {
  font-size: 28rpx;
  font-weight: 700;
  color: #102030;
}

.hero-login__desc {
  font-size: 22rpx;
  color: rgba(31, 41, 51, 0.62);
}

.hero-login__button,
.pricing-card__button,
.download-button,
.toolbar-button,
.asset-chip__link {
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-login__button,
.download-button,
.pricing-card__button {
  min-height: 86rpx;
  border-radius: 24rpx;
  background: #102030;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 700;
}

.hero-login__button {
  min-width: 180rpx;
  padding: 0 24rpx;
}

.section-card {
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.section-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #102030;
}

.section-meta {
  font-size: 22rpx;
  line-height: 1.6;
  color: rgba(31, 41, 51, 0.56);
  text-align: right;
}

.pricing-card {
  padding: 24rpx;
  border-radius: 26rpx;
  background: rgba(245, 247, 250, 0.96);
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.pricing-card__title {
  font-size: 28rpx;
  font-weight: 700;
  color: #102030;
}

.pricing-card__price {
  font-size: 42rpx;
  font-weight: 700;
  color: #102030;
}

.pricing-card__desc {
  min-height: 68rpx;
  font-size: 22rpx;
  line-height: 1.6;
  color: rgba(31, 41, 51, 0.64);
}

.pricing-card__button.is-disabled,
.download-button.is-disabled {
  opacity: 0.5;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.notes-list__item {
  font-size: 22rpx;
  line-height: 1.7;
  color: rgba(31, 41, 51, 0.68);
}

.selection-toolbar {
  display: flex;
  gap: 12rpx;
}

.toolbar-button {
  min-height: 74rpx;
  padding: 0 28rpx;
  border-radius: 20rpx;
  background: #102030;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
}

.toolbar-button--ghost {
  background: rgba(16, 32, 48, 0.08);
  color: #102030;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
}

.asset-chip {
  min-height: 148rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: rgba(245, 247, 250, 0.96);
  border: 2rpx solid transparent;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  justify-content: space-between;
}

.asset-chip.is-selected {
  border-color: #102030;
  box-shadow: 0 12rpx 24rpx rgba(16, 32, 48, 0.08);
}

.asset-chip.is-local {
  background: rgba(34, 197, 94, 0.08);
}

.asset-chip.is-disabled {
  opacity: 0.42;
}

.asset-chip__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10rpx;
}

.asset-chip__signals {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.asset-chip__title {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  line-height: 1.35;
  font-weight: 700;
  color: #102030;
}

.asset-chip__check {
  width: 42rpx;
  height: 42rpx;
  border-radius: 999rpx;
  background: #102030;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10rpx 20rpx rgba(16, 32, 48, 0.14);
}

.asset-chip__badge {
  flex-shrink: 0;
  min-height: 42rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: rgba(16, 32, 48, 0.08);
  color: #102030;
  font-size: 18rpx;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
}

.asset-chip__meta {
  font-size: 20rpx;
  line-height: 1.4;
  color: rgba(31, 41, 51, 0.64);
}

.asset-chip__link {
  align-self: flex-start;
  min-height: 48rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: rgba(16, 32, 48, 0.08);
  color: #102030;
  font-size: 20rpx;
  font-weight: 700;
}

.progress-text {
  font-size: 22rpx;
  line-height: 1.6;
  color: rgba(31, 41, 51, 0.72);
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.order-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: rgba(245, 247, 250, 0.96);
}

.order-row__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.order-row__title {
  font-size: 26rpx;
  font-weight: 700;
  color: #102030;
}

.order-row__meta {
  font-size: 20rpx;
  color: rgba(31, 41, 51, 0.56);
}

.order-row__status {
  font-size: 22rpx;
  font-weight: 700;
  color: #102030;
}

.theme-dark-zen.downloads-page {
  background: var(--rf-page-bg);
  color: var(--rf-page-text);
}

.theme-dark-zen .hero-card,
.theme-dark-zen .section-card,
.theme-dark-zen .hero-stat,
.theme-dark-zen .summary-card,
.theme-dark-zen .pricing-card,
.theme-dark-zen .page-home-button,
.theme-dark-zen .asset-chip,
.theme-dark-zen .order-row,
.theme-dark-zen .hero-login {
  background: var(--rf-surface);
  color: var(--rf-text-strong);
  border-color: var(--rf-border);
}

.theme-dark-zen .page-title,
.theme-dark-zen .hero-card__value,
.theme-dark-zen .section-title,
.theme-dark-zen .hero-stat__value,
.theme-dark-zen .summary-card__value,
.theme-dark-zen .pricing-card__title,
.theme-dark-zen .pricing-card__price,
.theme-dark-zen .asset-chip__title,
.theme-dark-zen .order-row__title,
.theme-dark-zen .order-row__status,
.theme-dark-zen .hero-login__title {
  color: var(--rf-text-strong);
}

.theme-dark-zen .page-kicker,
.theme-dark-zen .page-subtitle,
.theme-dark-zen .hero-card__label,
.theme-dark-zen .hero-stat__label,
.theme-dark-zen .summary-card__label,
.theme-dark-zen .notes-list__item,
.theme-dark-zen .section-meta,
.theme-dark-zen .asset-chip__meta,
.theme-dark-zen .order-row__meta,
.theme-dark-zen .hero-note,
.theme-dark-zen .progress-text,
.theme-dark-zen .hero-login__desc {
  color: var(--rf-text-muted);
}

.theme-dark-zen .asset-chip__badge {
  background: rgba(255, 255, 255, 0.08);
  color: var(--rf-text-strong);
}

.theme-dark-zen .asset-chip__check {
  background: #ffd7a8;
  color: #1b2430;
  box-shadow: none;
}

@media (max-width: 480px) {
  .hero-stats,
  .summary-grid,
  .pricing-grid {
    grid-template-columns: 1fr;
  }

  .asset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-card__row,
  .section-head,
  .hero-login {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
