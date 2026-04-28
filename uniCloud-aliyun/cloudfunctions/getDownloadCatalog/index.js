'use strict';

const {
  getDownloadBenefitsSnapshot,
  getDownloadConfig,
  listDownloadCatalogAssets,
  requireOpenId,
  toErrorResult,
} = require('rootflow-shared');

exports.main = async (event) => {
  try {
    const openid = await requireOpenId(event);
    const now = Date.now();
    const downloadConfig = getDownloadConfig();

    return {
      ok: true,
      assets: await listDownloadCatalogAssets(),
      downloadBenefits: await getDownloadBenefitsSnapshot(openid, { now, ensureRecord: true }),
      paymentMode: downloadConfig.paymentMode,
      purchaseEnabled: false,
      purchaseUnavailableReason: '',
    };
  } catch (error) {
    return toErrorResult(error);
  }
};
