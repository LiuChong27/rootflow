'use strict';

const {
  requireOpenId,
  toErrorResult,
  toSessionUser,
  upsertUserOnLogin,
} = require('rootflow-shared');

exports.main = async (event) => {
  try {
    const openid = await requireOpenId(event);
    const now = Date.now();
    const user = await upsertUserOnLogin(openid, now);

    return {
      ok: true,
      session: {
        openid,
        userId: openid,
        lastLoginAt: now,
        cloudLinked: true,
      },
      user: toSessionUser({
        ...user,
        lastLoginAt: now,
      }),
    };
  } catch (error) {
    return toErrorResult(error);
  }
};
