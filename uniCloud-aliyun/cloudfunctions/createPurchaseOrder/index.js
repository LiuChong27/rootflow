'use strict';

const {
  createAppError,
  createDownloadOrder,
  db,
  DOWNLOAD_ORDERS,
  ensureUserRecord,
  getDownloadBenefitsSnapshot,
  getDownloadConfig,
  getDownloadProduct,
  grantDownloadEntitlementForOrder,
  listRecentDownloadOrders,
  markDownloadOrderPaid,
  requireOpenId,
  toErrorResult,
} = require('rootflow-shared');

function isIosPlatform(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .includes('ios');
}

exports.main = async (event) => {
  try {
    const openid = await requireOpenId(event);
    const now = Date.now();
    const payload = event && typeof event === 'object' ? event : {};
    const product = getDownloadProduct(payload.sku);
    if (!product) {
      throw createAppError('PURCHASE_SKU_INVALID', 'Unsupported purchase sku.');
    }

    const downloadConfig = getDownloadConfig();
    if (!downloadConfig.iosPurchaseEnabled && isIosPlatform(payload.clientPlatform)) {
      throw createAppError('PURCHASE_UNAVAILABLE', 'iPhone 端暂不开放购买，可使用已解锁权益下载。');
    }

    await ensureUserRecord(openid, now);
    const order = await createDownloadOrder(openid, product, now, {
      paymentMode: downloadConfig.paymentMode,
      source: payload.source,
      clientPlatform: payload.clientPlatform,
    });

    let message = '';
    let status = order.status;
    let downloadBenefits = await getDownloadBenefitsSnapshot(openid, { now, ensureRecord: true });

    if (downloadConfig.paymentMode === 'dev-auto-fulfill') {
      await markDownloadOrderPaid(order.orderNo, now, {
        mode: 'dev-auto-fulfill',
      });
      const fulfilled = await grantDownloadEntitlementForOrder(order.orderNo, now);
      status = fulfilled.order.status;
      downloadBenefits = fulfilled.downloadBenefits;
      message = `${product.title} 已开通`;
    } else {
      await db
        .collection(DOWNLOAD_ORDERS)
        .where({ orderNo: order.orderNo })
        .update({
          data: {
            status: 'payment_disabled',
            updatedAt: now,
          },
        });
      status = 'payment_disabled';
      message = downloadConfig.purchaseUnavailableReason;
    }

    return {
      ok: true,
      orderNo: order.orderNo,
      sku: product.sku,
      title: product.title,
      amountFen: product.amountFen,
      status,
      paymentMode: downloadConfig.paymentMode,
      paymentAction: '',
      message,
      downloadBenefits,
      recentOrders: await listRecentDownloadOrders(openid, 8),
    };
  } catch (error) {
    return toErrorResult(error);
  }
};
