'use strict';

const { createDownloadTickets, requireOpenId, toErrorResult } = require('rootflow-shared');

exports.main = async (event) => {
  try {
    const openid = await requireOpenId(event);
    const now = Date.now();
    const payload = event && typeof event === 'object' ? event : {};

    const result = await createDownloadTickets(
      openid,
      Array.isArray(payload.assetKeys) ? payload.assetKeys : [],
      Array.isArray(payload.localVersions) ? payload.localVersions : [],
      now,
    );

    return {
      ok: true,
      pendingAssets: result.pendingAssets,
      skippedAssets: result.skippedAssets,
      downloadBenefits: result.downloadBenefits,
    };
  } catch (error) {
    return toErrorResult(error);
  }
};
