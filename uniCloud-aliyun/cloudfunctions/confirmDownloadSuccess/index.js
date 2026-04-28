'use strict';

const { confirmDownloadTicketSuccess, requireOpenId, toErrorResult } = require('rootflow-shared');

exports.main = async (event) => {
  try {
    const openid = await requireOpenId(event);
    const now = Date.now();
    const payload = event && typeof event === 'object' ? event : {};

    if (!payload.ticketId) {
      throw new Error('ticketId is required.');
    }

    const result = await confirmDownloadTicketSuccess(
      openid,
      String(payload.ticketId || '').trim(),
      now,
    );

    return {
      ok: true,
      alreadyConsumed: Boolean(result.alreadyConsumed),
      ticket: result.ticket,
      downloadBenefits: result.downloadBenefits,
    };
  } catch (error) {
    return toErrorResult(error);
  }
};
