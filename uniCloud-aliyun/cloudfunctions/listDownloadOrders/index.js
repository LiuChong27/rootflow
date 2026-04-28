'use strict';

const {
  getDownloadBenefitsSnapshot,
  listRecentDownloadOrders,
  requireOpenId,
  toErrorResult,
} = require('rootflow-shared');

exports.main = async (event) => {
  try {
    const openid = await requireOpenId(event);
    const now = Date.now();
    const payload = event && typeof event === 'object' ? event : {};
    const limit = Math.max(1, Math.min(20, Math.round(Number(payload.limit || 8))));

    return {
      ok: true,
      orders: await listRecentDownloadOrders(openid, limit),
      downloadBenefits: await getDownloadBenefitsSnapshot(openid, { now, ensureRecord: true }),
    };
  } catch (error) {
    return toErrorResult(error);
  }
};
