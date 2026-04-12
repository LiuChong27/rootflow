# RootFlow

RootFlow is a `uni-app` WeChat mini program for root-based vocabulary learning. This repository now includes:

- WeChat cloud login scaffolding
- Cloud-backed learning progress sync
- Real local/cloud learning stats
- Data import and shard generation scripts
- Basic engineering tooling for linting, formatting, testing, and CI

## Product modules

- `pages/today`: today landing page
- `pages/roots`: interactive root mind tree
- `pages/vibes`: expression scenarios
- `pages/my`: profile, stats, login, and cloud sync
- `pages/cloud-config`: in-app cloud environment setup

## Real user layer

The app now supports a practical WeChat-cloud user flow:

1. Tap login on `My`
2. Get `openid` from cloud function `authLogin`
3. Optionally persist nickname and avatar with `saveUserProfile`
4. Sync learning progress with `syncProgress`
5. Pull profile, progress, activity, and stats with `getUserSnapshot`

### Cloud collections

- `rf_users`: user profile and sync timestamps
- `rf_progress`: one progress row per user and word
- `rf_learning_activity`: one row per user and active day

### Cloud setup

1. Create a WeChat cloud environment in the WeChat DevTools console.
2. Deploy the functions under `cloudfunctions/`.
3. Set a real cloud env id in the app through `My -> Cloud Env Setup`.
4. Open the mini program in WeChat DevTools and log in from `pages/my/my`.

Note: the app expects WeChat cloud capability at runtime. In non-WeChat environments it falls back to local-only progress.

## Local development

```bash
npm install
npm run lint
npm run format:check
npm test
```

## Data pipeline

Useful scripts already in the repo:

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

- Cloud functions use `wx-server-sdk`
- Generated build output under `unpackage/` is ignored
- Large generated data under `data/index`, `data/roots`, and `data/shards` is excluded from formatting and lint noise
