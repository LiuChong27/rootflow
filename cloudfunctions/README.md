# Cloud Functions

These WeChat cloud functions back the real user layer for RootFlow:

- `authLogin`: get the current user's `openid` and upsert the user record
- `saveUserProfile`: persist nickname/avatar after the user authorizes profile access
- `syncProgress`: upsert learning progress and daily activity
- `getUserSnapshot`: return profile, progress map, activity dates, and aggregate stats

Collections used:

- `rf_users`
- `rf_progress`
- `rf_learning_activity`
