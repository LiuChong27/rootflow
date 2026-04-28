# RootFlow

RootFlow is a `uni-app` WeChat mini program for root-based vocabulary learning. This repository now includes:

- uniCloud-backed WeChat login scaffolding
- Cloud-backed learning progress sync
- Real local/cloud learning stats
- Data import and shard generation scripts
- Basic engineering tooling for linting, formatting, testing, and CI

## Product modules

- `pages/today`: today landing page
- `pages/downloads`: paid PDF download center and entitlement management
- `pages/roots`: interactive root mind tree
- `pages/vibes`: quarrel/comeback expression library
- `pages/my`: profile, stats, login, and cloud sync

## Real user layer

The app now supports a practical uniCloud-backed user flow:

1. Tap login on `My`
2. Exchange a WeChat login code for `openid` inside uniCloud `authLogin`
3. Optionally persist nickname and avatar with `saveUserProfile`
4. Sync learning progress with `syncProgress`
5. Pull profile, progress, activity, and stats with `getUserSnapshot`
6. Serve paid PDF download entitlements, orders, and ticketed downloads through the download center

### Cloud collections

- `rf_users`: user profile and sync timestamps
- `rf_progress`: one progress row per user and word
- `rf_learning_activity`: one row per user and active day
- `rf_download_assets`: A-Z PDF catalog metadata
- `rf_download_entitlements`: membership and remaining credits
- `rf_download_orders`: purchase orders for download products
- `rf_download_tickets`: temporary per-file download tickets

### uniCloud setup

1. Open the project in HBuilderX.
2. Bind the project to a `uniCloud` Alibaba Cloud service space.
3. Configure `uniCloud-aliyun/cloudfunctions/common/rootflow-config/index.js` with the real WeChat mini program `appId` and `appSecret`.
4. Upload the cloud functions under `uniCloud-aliyun/cloudfunctions/`.
5. Initialize `uniCloud-aliyun/database` in HBuilderX to create `rf_users`, `rf_progress`, and `rf_learning_activity`.
6. Open the mini program in WeChat DevTools and log in from `pages/my/my`.

Detailed setup steps live in `docs/unicloud-setup.md`.
Download-center specific setup notes live in `docs/download-center-setup.md`.

## Local development

```bash
npm install
npm run lint
npm run format:check
npm test
```

## Data pipeline

Useful scripts already in the repo:

- `scripts/build-download-assets-manifest.mjs`
- `scripts/validate-wordbank.mjs`
- `scripts/import-rootflow-wordbank.mjs`
- `scripts/slice-wordbank-shards.mjs`
- `scripts/wordbank-pipeline.mjs`

## Quality gates

- ESLint: `npm run lint`
- Prettier: `npm run format` / `npm run format:check`
- Tests: `npm test`
- GitHub Actions: `.github/workflows/ci.yml`

## Deployment notes

- uniCloud functions live under `uniCloud-aliyun/cloudfunctions`
- Generated build output under `unpackage/` is ignored
- Large generated data under `data/index`, `data/roots`, and `data/shards` is excluded from formatting and lint noise
