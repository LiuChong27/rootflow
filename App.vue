<script>
import { initCloud } from './services/cloudService';
import { getProgressSyncService } from './services/lazyServices';

export default {
  onLaunch: function () {
    initCloud();
    console.log('App Launch');
  },
  onShow: function () {
    console.log('App Show');
  },
  onHide: function () {
    getProgressSyncService()
      .then((progressSyncService) =>
        progressSyncService.flushPendingProgressSync({ reason: 'app-hide' }),
      )
      .catch((error) => {
        console.error('Failed to flush progress sync on app hide:', error);
      });
    console.log('App Hide');
  },
};
</script>

<style>
/* 每个页面公共 css */
.theme-dark-zen {
  --rf-page-bg:
    radial-gradient(circle at 14% 6%, rgba(76, 147, 255, 0.16), transparent 32%),
    radial-gradient(circle at 84% 4%, rgba(255, 149, 117, 0.14), transparent 22%),
    linear-gradient(180deg, #07111f 0%, #09121a 54%, #050910 100%);
  --rf-page-text: #eef5ff;
  --rf-text-strong: #eef5ff;
  --rf-text-muted: rgba(225, 237, 255, 0.72);
  --rf-text-soft: rgba(225, 237, 255, 0.62);
  --rf-text-kicker: rgba(225, 237, 255, 0.42);
  --rf-surface: rgba(255, 255, 255, 0.06);
  --rf-surface-strong: rgba(255, 255, 255, 0.08);
  --rf-surface-elevated: rgba(255, 255, 255, 0.1);
  --rf-surface-solid: rgba(10, 17, 31, 0.88);
  --rf-border: rgba(255, 255, 255, 0.08);
  --rf-border-strong: rgba(255, 255, 255, 0.14);
  --rf-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.24);
  --rf-card-shadow: 0 18rpx 52rpx rgba(0, 0, 0, 0.18);
  --rf-focus-bg:
    radial-gradient(circle at 92% 10%, rgba(255, 194, 138, 0.22), transparent 24%),
    linear-gradient(145deg, #152738 0%, #18354a 42%, #215040 100%);
  --rf-focus-text: #f8fbff;
  --rf-focus-muted: rgba(248, 251, 255, 0.74);
  --rf-focus-kicker: rgba(248, 251, 255, 0.62);
  --rf-focus-surface: rgba(255, 255, 255, 0.1);
  --rf-focus-flag: rgba(255, 238, 223, 0.18);
  --rf-list-bg: rgba(255, 255, 255, 0.05);
  --rf-list-bg-strong: rgba(255, 255, 255, 0.08);
  --rf-list-border: rgba(255, 255, 255, 0.08);
  --rf-button-primary-bg: rgba(255, 245, 233, 0.94);
  --rf-button-primary-text: #244c62;
  --rf-button-secondary-bg: rgba(255, 255, 255, 0.08);
  --rf-button-secondary-border: rgba(255, 255, 255, 0.14);
  --rf-button-secondary-text: #f5f9ff;
  --rf-progress-track: rgba(255, 255, 255, 0.16);
  --rf-progress-fill: linear-gradient(90deg, #ffd7a8 0%, #fff4e4 100%);
  --rf-input-bg: rgba(255, 255, 255, 0.08);
  --rf-input-border: rgba(255, 255, 255, 0.14);
  --rf-input-text: #f8fbff;
  --rf-placeholder: rgba(248, 251, 255, 0.4);
  --rf-accent: #ffd7a8;
  --rf-accent-strong: #6a70c9;
  --rf-success: rgba(112, 193, 145, 0.94);
  --rf-danger-bg: rgba(255, 77, 79, 0.16);
  --rf-danger-border: rgba(255, 77, 79, 0.22);
  --rf-danger-text: #ffd8da;
}

.theme-clay-pastel {
  --rf-page-bg:
    radial-gradient(circle at 12% 2%, rgba(255, 255, 255, 0.92), transparent 24%),
    radial-gradient(circle at 88% 10%, rgba(232, 236, 241, 0.46), transparent 24%),
    linear-gradient(180deg, #f4f5f7 0%, #eef1f4 48%, #f8f9fb 100%);
  --rf-page-text: #1f2933;
  --rf-text-strong: #1f2933;
  --rf-text-muted: rgba(31, 41, 51, 0.66);
  --rf-text-soft: rgba(31, 41, 51, 0.52);
  --rf-text-kicker: rgba(31, 41, 51, 0.38);
  --rf-surface: rgba(255, 255, 255, 0.56);
  --rf-surface-strong: rgba(255, 255, 255, 0.68);
  --rf-surface-elevated: rgba(255, 255, 255, 0.76);
  --rf-surface-solid: #ffffff;
  --rf-border: rgba(31, 41, 51, 0.08);
  --rf-border-strong: rgba(31, 41, 51, 0.12);
  --rf-shadow: 0 24rpx 64rpx rgba(15, 23, 42, 0.05);
  --rf-card-shadow: 0 18rpx 52rpx rgba(15, 23, 42, 0.045);
  --rf-focus-bg:
    radial-gradient(circle at 8% 0%, rgba(255, 255, 255, 0.92), transparent 32%),
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.8) 0%,
      rgba(245, 247, 250, 0.82) 48%,
      rgba(235, 239, 244, 0.86) 100%
    );
  --rf-focus-text: #1f2933;
  --rf-focus-muted: rgba(31, 41, 51, 0.68);
  --rf-focus-kicker: rgba(31, 41, 51, 0.46);
  --rf-focus-surface: rgba(255, 255, 255, 0.34);
  --rf-focus-flag: rgba(255, 255, 255, 0.42);
  --rf-list-bg: #ffffff;
  --rf-list-bg-strong: rgba(255, 255, 255, 0.74);
  --rf-list-border: rgba(31, 41, 51, 0.06);
  --rf-button-primary-bg: rgba(255, 255, 255, 0.78);
  --rf-button-primary-text: #1f2933;
  --rf-button-secondary-bg: rgba(255, 255, 255, 0.4);
  --rf-button-secondary-border: rgba(31, 41, 51, 0.08);
  --rf-button-secondary-text: #394550;
  --rf-progress-track: rgba(255, 255, 255, 0.4);
  --rf-progress-fill: linear-gradient(90deg, #d7dde4 0%, #f7f9fb 100%);
  --rf-input-bg: rgba(255, 255, 255, 0.44);
  --rf-input-border: rgba(31, 41, 51, 0.08);
  --rf-input-text: #25313d;
  --rf-placeholder: rgba(37, 49, 61, 0.38);
  --rf-accent: #697684;
  --rf-accent-strong: #4b5967;
  --rf-success: rgba(92, 148, 118, 0.94);
  --rf-danger-bg: rgba(255, 77, 79, 0.12);
  --rf-danger-border: rgba(255, 77, 79, 0.16);
  --rf-danger-text: #a33e46;
}
</style>
