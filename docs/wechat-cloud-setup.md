# WeChat Cloud Setup

This document covers the first-time setup for RootFlow's real user layer on WeChat Cloud.

## 1. Create a cloud environment

1. Open WeChat DevTools.
2. Open the project's Cloud Development panel.
3. Create a new environment.
4. Copy the environment ID.
5. In the mini program, open `我的 -> 云环境配置` and paste the environment ID.

Recommended naming:

- `rootflow-dev`
- `rootflow-staging`
- `rootflow-prod`

## 2. Deploy cloud functions

Functions in this repo:

- `authLogin`
- `saveUserProfile`
- `syncProgress`
- `getUserSnapshot`

Recommended deployment steps:

1. Open the `cloudfunctions/` folder in WeChat DevTools.
2. Install dependencies for each function if DevTools asks.
3. Upload and deploy all functions to the selected environment.

## 3. Create database collections

Create these collections in Cloud Database:

### `rf_users`

Purpose:

- one document per WeChat user
- nickname, avatar, login time, sync time

Suggested fields:

```json
{
  "nickName": "",
  "avatarUrl": "",
  "createdAt": 0,
  "updatedAt": 0,
  "lastLoginAt": 0,
  "lastSyncAt": 0
}
```

### `rf_progress`

Purpose:

- one document per user-word progress state

Suggested fields:

```json
{
  "wordId": "author",
  "rootId": "author",
  "status": "mastered",
  "updatedAt": 0,
  "createdAt": 0
}
```

### `rf_learning_activity`

Purpose:

- one document per user-day learning activity

Suggested fields:

```json
{
  "dateKey": "2026-04-12",
  "createdAt": 0
}
```

## 4. Index recommendations

These indexes are the minimum useful set for production behavior.

### `rf_users`

Index suggestions:

1. `_openid` ascending

Why:

- every login and snapshot lookup starts from `_openid`

### `rf_progress`

Index suggestions:

1. `_openid` ascending + `wordId` ascending
2. `_openid` ascending + `updatedAt` descending
3. `_openid` ascending + `status` ascending
4. `_openid` ascending + `rootId` ascending

Why:

- upsert by user + word
- fetch latest progress efficiently
- aggregate mastered items
- aggregate mastered roots

### `rf_learning_activity`

Index suggestions:

1. `_openid` ascending + `dateKey` ascending

Why:

- fetch learning calendar and streaks quickly

## 5. Permissions

Recommended production permissions:

- keep writes limited to authenticated cloud function context
- do not rely on client direct writes
- expose database only through cloud functions where possible

For this repo's current implementation:

- client -> cloud function
- cloud function -> database

This is the right direction for enterprise safety.

## 6. Data lifecycle suggestions

For production readiness, consider:

1. Add a user deletion workflow that wipes `rf_users`, `rf_progress`, and `rf_learning_activity`.
2. Add a scheduled backup/export process.
3. Add retention policy notes in your privacy policy.
4. Record app version during sync for migration debugging.

## 7. Smoke test checklist

After setup, verify this flow:

1. Open `我的`
2. Configure env id
3. Tap login
4. Expand a root and mark one word as mastered
5. Tap sync
6. Reopen the app and confirm progress restored
7. Check `rf_users`, `rf_progress`, and `rf_learning_activity` in Cloud Database

## 8. Troubleshooting

### `WX_CLOUD_ENV_MISSING`

Cause:

- env id not configured yet

Fix:

- open `我的 -> 云环境配置`
- save the correct env id

### `WX_CLOUD_UNAVAILABLE`

Cause:

- not running inside a WeChat environment with cloud capability

Fix:

- test inside WeChat DevTools or real WeChat

### Login succeeds but sync fails

Check:

1. functions deployed to the same env
2. function dependencies installed
3. collection names exactly match:
   - `rf_users`
   - `rf_progress`
   - `rf_learning_activity`
4. database permissions are not blocking cloud functions
