# uniCloud Setup

This document covers the first-time setup for RootFlow's uniCloud user layer.

## 1. Bind a uniCloud service space

1. Open the project in HBuilderX.
2. Bind the project to a `uniCloud` Alibaba Cloud service space.
3. Keep the project running against the same space for both local debugging and deployment.

## 2. Configure WeChat mini program credentials

Edit `uniCloud-aliyun/cloudfunctions/common/rootflow-config/index.js` and replace the placeholders with:

- `appId`: the real WeChat mini program appid
- `appSecret`: the real WeChat mini program appsecret

The cloud functions use these credentials to exchange the mini-program login code for `openid`.

## 3. Upload cloud functions

Upload these functions to the bound uniCloud space:

- `authLogin`
- `saveUserProfile`
- `syncProgress`
- `getUserSnapshot`
- `getDownloadCatalog`
- `createPurchaseOrder`
- `createDownloadTickets`
- `confirmDownloadSuccess`
- `listDownloadOrders`

All functions live under `uniCloud-aliyun/cloudfunctions/`.

## 4. Initialize database collections

In HBuilderX:

1. Right-click `uniCloud-aliyun/database`
2. Choose `初始化云数据库`
3. Confirm the current Alibaba Cloud service space

This will create or update the collections, schemas, and indexes defined in the project.

The initialized collections are:

### `rf_users`

Suggested fields:

```json
{
  "openid": "",
  "nickName": "",
  "avatarUrl": "",
  "createdAt": 0,
  "updatedAt": 0,
  "lastLoginAt": 0,
  "lastSyncAt": 0
}
```

### `rf_progress`

Suggested fields:

```json
{
  "openid": "",
  "wordId": "author",
  "rootId": "author",
  "status": "mastered",
  "stage": 4,
  "introducedAt": 0,
  "lastReviewedAt": 0,
  "nextReviewAt": 0,
  "updatedAt": 0,
  "createdAt": 0,
  "lapseCount": 0,
  "correctCount": 0
}
```

### `rf_learning_activity`

Suggested fields:

```json
{
  "openid": "",
  "dateKey": "2026-04-12",
  "createdAt": 0
}
```

### `rf_download_assets`

Suggested fields:

```json
{
  "assetKey": "pdf-a",
  "letter": "a",
  "title": "A.pdf",
  "version": "2026.04",
  "size": 0,
  "fileType": "pdf",
  "fileId": "",
  "status": "active",
  "createdAt": 0,
  "updatedAt": 0
}
```

### `rf_download_entitlements`

Suggested fields:

```json
{
  "openid": "",
  "isLifetimeMember": false,
  "lifetimeActivatedAt": 0,
  "creditBalance": 0,
  "totalPurchasedCredits": 0,
  "totalConsumedCredits": 0,
  "lastOrderNo": "",
  "lastTicketId": "",
  "createdAt": 0,
  "updatedAt": 0
}
```

### `rf_download_orders`

Suggested fields:

```json
{
  "openid": "",
  "orderNo": "",
  "sku": "rf_lifetime_member_990",
  "title": "永久会员",
  "amountFen": 990,
  "benefitType": "lifetime_member",
  "creditDelta": 0,
  "isLifetimeMember": true,
  "status": "created",
  "paymentMode": "disabled",
  "source": "downloads",
  "clientPlatform": "android",
  "paymentPayload": {},
  "fulfillmentStatus": "pending",
  "paidAt": 0,
  "fulfilledAt": 0,
  "createdAt": 0,
  "updatedAt": 0
}
```

### `rf_download_tickets`

Suggested fields:

```json
{
  "ticketId": "",
  "openid": "",
  "assetKey": "pdf-a",
  "letter": "a",
  "title": "A.pdf",
  "version": "2026.04",
  "fileType": "pdf",
  "fileId": "",
  "status": "created",
  "expiresAt": 0,
  "confirmedAt": 0,
  "consumedCredit": 0,
  "createdAt": 0,
  "updatedAt": 0
}
```

## 5. Index recommendations

### `rf_users`

- `openid` ascending

### `rf_progress`

- `openid` ascending + `wordId` ascending
- `openid` ascending + `updatedAt` descending
- `openid` ascending + `status` ascending
- `openid` ascending + `rootId` ascending

### `rf_learning_activity`

- `openid` ascending + `dateKey` ascending

### `rf_download_assets`

- `assetKey` ascending
- `letter` ascending

### `rf_download_entitlements`

- `openid` ascending

### `rf_download_orders`

- `orderNo` ascending
- `openid` ascending + `updatedAt` descending

### `rf_download_tickets`

- `ticketId` ascending
- `openid` ascending + `status` ascending + `expiresAt` ascending

## 6. Smoke test checklist

After setup, verify this flow:

1. Open `My`
2. Tap login
3. Allow profile access if prompted
4. Expand a root and mark one word as mastered
5. Tap sync
6. Reopen the app and confirm progress restored
7. Check `rf_users`, `rf_progress`, `rf_learning_activity`, and the `rf_download_*` collections in uniCloud DB

## 7. Troubleshooting

### `WEIXIN_CONFIG_MISSING`

Cause:

- `uniCloud-aliyun/cloudfunctions/common/rootflow-config/index.js` still has placeholders

Fix:

- set the real WeChat mini program `appId` and `appSecret`

### `UNI_CLOUD_UNAVAILABLE`

Cause:

- the project is not running with a bound uniCloud service space

Fix:

- bind the project to a uniCloud Alibaba Cloud service space in HBuilderX

### `WX_CLOUD_UNAVAILABLE`

Cause:

- the app is not running inside WeChat DevTools or the WeChat client

Fix:

- test inside WeChat DevTools or on a real device

### Login succeeds but sync fails

Check:

1. the same uniCloud space is used for both deployment and debugging
2. all required functions are uploaded
3. collection names exactly match:
   - `rf_users`
   - `rf_progress`
   - `rf_learning_activity`
   - `rf_download_assets`
   - `rf_download_entitlements`
   - `rf_download_orders`
   - `rf_download_tickets`
4. database permissions are not blocking the functions
