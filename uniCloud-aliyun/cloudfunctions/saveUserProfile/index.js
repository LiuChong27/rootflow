'use strict';

const {
  requireOpenId,
  toErrorResult,
  toSessionUser,
  updateUserProfile,
} = require('rootflow-shared');

exports.main = async (event) => {
  try {
    const openid = await requireOpenId(event);
    const now = Date.now();
    const user = await updateUserProfile(openid, event, now);

    return {
      ok: true,
      user: toSessionUser(user),
    };
  } catch (error) {
    return toErrorResult(error);
  }
};
