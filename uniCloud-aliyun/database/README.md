# RootFlow Database Init

This directory defines the RootFlow uniCloud database structure for Alibaba Cloud.

Included files:

- `rf_users.schema.json`
- `rf_users.index.json`
- `rf_progress.schema.json`
- `rf_progress.index.json`
- `rf_learning_activity.schema.json`
- `rf_learning_activity.index.json`
- `rf_download_assets.schema.json`
- `rf_download_assets.index.json`
- `rf_download_entitlements.schema.json`
- `rf_download_entitlements.index.json`
- `rf_download_orders.schema.json`
- `rf_download_orders.index.json`
- `rf_download_tickets.schema.json`
- `rf_download_tickets.index.json`

## Recommended HBuilderX workflow

1. In HBuilderX, right-click `uniCloud-aliyun/database`.
2. Choose `初始化云数据库`.
3. Confirm the target Alibaba Cloud service space.

That initialization step will create or update the collections, schemas, and indexes from the files in this directory.

## When to use which action

- First-time setup: use `初始化云数据库` on the whole `database` directory.
- Schema-only changes later: you can right-click a specific `*.schema.json` file and upload it, or upload the whole `database` directory.
- Index changes later: run `初始化云数据库` again on the `database` directory so the `*.index.json` changes are applied.

## Notes

- The current RootFlow cloud functions use traditional `uniCloud.database()` collection APIs, so these schema files mainly serve as project-level structure docs, future JQL readiness, and repeatable environment setup.
- Because the project writes through cloud functions, all table permissions are set to `false` by default here.
- `rf_users.openid` and `rf_learning_activity(openid + dateKey)` are configured as unique indexes.
- `rf_progress(openid + wordId)` is configured as a unique composite index to support idempotent upsert behavior.
