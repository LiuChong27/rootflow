const config = require('rootflow-config');

const db = uniCloud.database();
const dbCmd = db.command;

const USERS = 'rf_users';
const PROGRESS = 'rf_progress';
const ACTIVITY = 'rf_learning_activity';
const DOWNLOAD_ASSETS = 'rf_download_assets';
const DOWNLOAD_ENTITLEMENTS = 'rf_download_entitlements';
const DOWNLOAD_ORDERS = 'rf_download_orders';
const DOWNLOAD_TICKETS = 'rf_download_tickets';

const ORDER_STATUS_CREATED = 'created';
const ORDER_STATUS_PAID = 'paid';
const ORDER_STATUS_FULFILLED = 'fulfilled';
const ORDER_STATUS_PAYMENT_DISABLED = 'payment_disabled';

const ORDER_FULFILLMENT_PENDING = 'pending';
const ORDER_FULFILLMENT_PROCESSING = 'processing';
const ORDER_FULFILLMENT_FULFILLED = 'fulfilled';

const TICKET_STATUS_CREATED = 'created';
const TICKET_STATUS_CONSUMING = 'consuming';
const TICKET_STATUS_CONSUMED = 'consumed';
const TICKET_STATUS_EXPIRED = 'expired';
const V2_PHRASE_STORAGE_DIR = 'rootflow/pdfs/v2';
const V2_PHRASE_FILE_NAMES = Object.freeze({
  'pdf-phrase-a': '短语A.pdf',
  'pdf-phrase-b': '短语B.pdf',
  'pdf-phrase-cd': '短语CD.pdf',
  'pdf-phrase-eg': '短语EG.pdf',
  'pdf-phrase-fh': '短语FH.pdf',
  'pdf-phrase-i': '短语I.pdf',
  'pdf-phrase-jklm': '短语JKLM.pdf',
  'pdf-phrase-no': '短语NO.pdf',
  'pdf-phrase-p': '短语P.pdf',
  'pdf-phrase-rs': '短语RS.pdf',
  'pdf-phrase-tuvw': '短语TUVW.pdf',
  'pdf-reading': '阅读.pdf',
});

const DEFAULT_DOWNLOAD_PRODUCTS = Object.freeze({
  rf_lifetime_member_990: {
    sku: 'rf_lifetime_member_990',
    title: '永久会员',
    amountFen: 990,
    benefitType: 'lifetime_member',
    creditDelta: 0,
    isLifetimeMember: true,
  },
  rf_pdf_30_pack_200: {
    sku: 'rf_pdf_30_pack_200',
    title: '30 次 PDF 下载次数',
    amountFen: 200,
    benefitType: 'credit_pack',
    creditDelta: 30,
    isLifetimeMember: false,
  },
});

function createAppError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function toErrorResult(error) {
  return {
    ok: false,
    code: error && error.code ? error.code : 'INTERNAL_ERROR',
    message: error && error.message ? error.message : 'Unexpected uniCloud error.',
    details: error && error.details ? error.details : null,
  };
}

function getWeixinConfig() {
  const appId = String(
    (config &&
      config.wechatMiniProgram &&
      (config.wechatMiniProgram.appId || config.wechatMiniProgram.appid)) ||
      '',
  ).trim();
  const appSecret = String(
    (config &&
      config.wechatMiniProgram &&
      (config.wechatMiniProgram.appSecret || config.wechatMiniProgram.appsecret)) ||
      '',
  ).trim();

  if (
    !appId ||
    appId.startsWith('replace-with-') ||
    !appSecret ||
    appSecret.startsWith('replace-with-')
  ) {
    throw createAppError(
      'WEIXIN_CONFIG_MISSING',
      'WeChat mini program appId/appSecret are not configured in uniCloud.',
    );
  }

  return { appId, appSecret };
}

async function resolveOpenIdFromCode(authCode) {
  const code = String(authCode || '').trim();
  if (!code) {
    throw createAppError('WEIXIN_LOGIN_CODE_MISSING', 'WeChat login code is required.');
  }

  const { appId, appSecret } = getWeixinConfig();
  const response = await uniCloud.httpclient.request(
    'https://api.weixin.qq.com/sns/jscode2session',
    {
      method: 'GET',
      dataType: 'json',
      data: {
        appid: appId,
        secret: appSecret,
        js_code: code,
        grant_type: 'authorization_code',
      },
    },
  );

  const result = response && response.data ? response.data : {};
  if (result.errcode) {
    throw createAppError(
      'WEIXIN_CODE2SESSION_FAILED',
      result.errmsg || 'Failed to exchange the WeChat login code.',
      result,
    );
  }

  const openid = String(result.openid || '').trim();
  if (!openid) {
    throw createAppError('OPENID_MISSING', 'OpenID was not returned by WeChat.', result);
  }

  return {
    openid,
    sessionKey: String(result.session_key || ''),
  };
}

async function requireOpenId(event) {
  const payload = event && typeof event === 'object' ? event : {};
  const loginPayload = await resolveOpenIdFromCode(payload.authCode);
  return loginPayload.openid;
}

function normalizeStatus(status) {
  if (status === 'learning' || status === 'review' || status === 'mastered' || status === 'new') {
    return status;
  }
  return 'new';
}

function normalizeStage(stage) {
  const parsed = Number(stage);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(4, Math.round(parsed)));
}

function normalizeTimestamp(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return Number(fallback || 0);
  return parsed;
}

function normalizeProgressEntry(entry, now = Date.now()) {
  const source = entry && typeof entry === 'object' ? entry : {};
  const updatedAt = normalizeTimestamp(source.updatedAt, now);
  const hasModernFields =
    Object.prototype.hasOwnProperty.call(source, 'stage') ||
    Object.prototype.hasOwnProperty.call(source, 'nextReviewAt') ||
    Object.prototype.hasOwnProperty.call(source, 'lastReviewedAt') ||
    Object.prototype.hasOwnProperty.call(source, 'introducedAt');

  if (!hasModernFields) {
    const legacyStatus = normalizeStatus(source.status);
    if (legacyStatus === 'mastered') {
      return {
        status: 'mastered',
        stage: 4,
        introducedAt: updatedAt,
        lastReviewedAt: updatedAt,
        nextReviewAt: updatedAt,
        updatedAt,
        lapseCount: 0,
        correctCount: 0,
      };
    }

    return {
      status: 'new',
      stage: 0,
      introducedAt: updatedAt || now,
      lastReviewedAt: 0,
      nextReviewAt: 0,
      updatedAt,
      lapseCount: 0,
      correctCount: 0,
    };
  }

  const stage = normalizeStage(source.stage);
  const nextReviewAt = normalizeTimestamp(source.nextReviewAt);
  let status = normalizeStatus(source.status);

  if (status === 'new' && nextReviewAt > 0) {
    status = stage >= 4 ? 'mastered' : stage > 0 ? 'review' : 'learning';
  }
  if (status === 'mastered' && stage < 4) {
    status = stage > 0 ? 'review' : 'learning';
  }

  return {
    status,
    stage,
    introducedAt: normalizeTimestamp(source.introducedAt, updatedAt || now),
    lastReviewedAt: normalizeTimestamp(source.lastReviewedAt),
    nextReviewAt,
    updatedAt,
    lapseCount: Math.max(0, Math.round(normalizeTimestamp(source.lapseCount))),
    correctCount: Math.max(0, Math.round(normalizeTimestamp(source.correctCount))),
  };
}

function buildProgressMap(items) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const wordId = String(item.wordId || '')
      .trim()
      .toLowerCase();
    if (!wordId) return acc;
    acc[wordId] = normalizeProgressEntry(item);
    return acc;
  }, {});
}

function getStartOfToday(now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function computeStreak(activityDates) {
  if (!activityDates.length) return 0;

  const activitySet = new Set(activityDates);
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
      cursor.getDate(),
    ).padStart(2, '0')}`;
    if (!activitySet.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function buildStats(progressItems, activityDates) {
  const now = Date.now();
  const todayStart = getStartOfToday(now);
  const masteredItems = progressItems.filter((item) => item.status === 'mastered');
  const masteredRoots = new Set(masteredItems.map((item) => item.rootId).filter(Boolean));
  const scheduledItems = progressItems.filter(
    (item) => item.status !== 'new' && item.nextReviewAt > 0,
  );
  const dueItems = scheduledItems.filter((item) => item.nextReviewAt <= now);
  const overdueItems = scheduledItems.filter((item) => item.nextReviewAt < todayStart);
  const todayCompletedItems = scheduledItems.filter((item) => {
    const lastReviewedAt = normalizeTimestamp(item.lastReviewedAt);
    return lastReviewedAt >= todayStart && lastReviewedAt < todayStart + 24 * 60 * 60 * 1000;
  });

  return {
    masteredWords: masteredItems.length,
    masteredRoots: masteredRoots.size,
    scheduledWords: scheduledItems.length,
    dueWords: dueItems.length,
    overdueWords: overdueItems.length,
    todayCompletedWords: todayCompletedItems.length,
    activityDays: activityDates.length,
    streakDays: computeStreak(activityDates),
    lastActivityDate: activityDates.length ? activityDates[activityDates.length - 1] : '',
  };
}

async function getUserByOpenId(openid) {
  const result = await db.collection(USERS).where({ openid }).limit(1).get();
  return result.data[0] || null;
}

async function upsertUserOnLogin(openid, now) {
  const collection = db.collection(USERS);
  const user = await getUserByOpenId(openid);

  if (user) {
    await collection.doc(user._id).update({
      data: {
        lastLoginAt: now,
        updatedAt: now,
      },
    });

    return {
      ...user,
      lastLoginAt: now,
      updatedAt: now,
    };
  }

  const addResult = await collection.add({
    data: {
      openid,
      nickName: '',
      avatarUrl: '',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      lastSyncAt: 0,
    },
  });

  return {
    _id: addResult.id || addResult._id,
    openid,
    nickName: '',
    avatarUrl: '',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    lastSyncAt: 0,
  };
}

async function ensureUserRecord(openid, now) {
  const collection = db.collection(USERS);
  const user = await getUserByOpenId(openid);
  if (user) {
    await collection.doc(user._id).update({
      data: {
        updatedAt: now,
      },
    });
    return {
      ...user,
      updatedAt: now,
    };
  }

  const addResult = await collection.add({
    data: {
      openid,
      nickName: '',
      avatarUrl: '',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      lastSyncAt: now,
    },
  });

  return {
    _id: addResult.id || addResult._id,
    openid,
    nickName: '',
    avatarUrl: '',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    lastSyncAt: now,
  };
}

async function updateUserProfile(openid, profile, now) {
  const collection = db.collection(USERS);
  const user = await getUserByOpenId(openid);
  if (!user) {
    throw createAppError(
      'USER_NOT_FOUND',
      'Please complete WeChat login before saving the profile.',
    );
  }

  const nickName = String((profile && profile.nickName) || '').trim();
  const avatarUrl = String((profile && profile.avatarUrl) || '').trim();

  await collection.doc(user._id).update({
    data: {
      nickName,
      avatarUrl,
      updatedAt: now,
    },
  });

  return {
    ...user,
    nickName,
    avatarUrl,
    updatedAt: now,
  };
}

function sanitizeActivityDates(activityDates) {
  return Array.from(
    new Set(
      (Array.isArray(activityDates) ? activityDates : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

async function replaceActivity(openid, activityDates, now) {
  const collection = db.collection(ACTIVITY);
  const nextDates = sanitizeActivityDates(activityDates);
  const current = await collection.where({ openid }).get();

  await Promise.all((current.data || []).map((item) => collection.doc(item._id).remove()));
  await Promise.all(
    nextDates.map((dateKey) =>
      collection.add({
        data: {
          openid,
          dateKey,
          createdAt: now,
        },
      }),
    ),
  );

  return nextDates;
}

function toSessionUser(user) {
  return {
    openid: user.openid,
    userId: user.openid,
    nickName: String(user.nickName || ''),
    avatarUrl: String(user.avatarUrl || ''),
    lastLoginAt: Number(user.lastLoginAt || 0),
    lastSyncAt: Number(user.lastSyncAt || 0),
    cloudLinked: true,
  };
}

function getDownloadConfig() {
  const downloads = (config && config.downloads) || {};
  return {
    paymentMode: String(downloads.paymentMode || 'free').trim() || 'free',
    iosPurchaseEnabled: Boolean(downloads.iosPurchaseEnabled),
    ticketExpireSeconds: Math.max(60, Math.round(Number(downloads.ticketExpireSeconds || 900))),
    purchaseUnavailableReason:
      String(
        downloads.purchaseUnavailableReason ||
          '支付能力待配置，请先在共享 uniCloud 空间完成 uni-pay 2 配置。',
      ).trim() || '支付能力待配置，请稍后重试。',
    cloudStorageDir:
      String(downloads.cloudStorageDir || 'rootflow/pdfs/v1').trim() || 'rootflow/pdfs/v1',
  };
}

function isFreeDownloadMode(downloadConfigInput = getDownloadConfig()) {
  return String(downloadConfigInput.paymentMode || '').trim() === 'free';
}

function getDownloadProducts() {
  const downloads = (config && config.downloads) || {};
  const overrides =
    downloads.products && typeof downloads.products === 'object' ? downloads.products : {};

  return Object.keys(DEFAULT_DOWNLOAD_PRODUCTS).reduce((acc, sku) => {
    const override = overrides[sku] && typeof overrides[sku] === 'object' ? overrides[sku] : {};
    const merged = {
      ...DEFAULT_DOWNLOAD_PRODUCTS[sku],
      ...override,
      sku,
    };
    acc[sku] = {
      ...merged,
      title: String(merged.title || DEFAULT_DOWNLOAD_PRODUCTS[sku].title).trim(),
      amountFen: Math.max(
        0,
        Math.round(Number(merged.amountFen || DEFAULT_DOWNLOAD_PRODUCTS[sku].amountFen)),
      ),
      creditDelta: Math.max(
        0,
        Math.round(Number(merged.creditDelta || DEFAULT_DOWNLOAD_PRODUCTS[sku].creditDelta)),
      ),
      benefitType: String(merged.benefitType || DEFAULT_DOWNLOAD_PRODUCTS[sku].benefitType).trim(),
      isLifetimeMember: Boolean(merged.isLifetimeMember),
    };
    return acc;
  }, {});
}

function getDownloadProduct(sku) {
  const normalizedSku = String(sku || '').trim();
  const products = getDownloadProducts();
  return products[normalizedSku] || null;
}

function normalizeLetter(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, 1);
}

function normalizeCoveredLetters(input, fallbackLetter = '') {
  const rawValues = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[^a-z]+/i)
      : [];

  const coveredLetters = Array.from(
    new Set(rawValues.map((value) => normalizeLetter(value)).filter(Boolean)),
  );

  if (coveredLetters.length) return coveredLetters;

  const normalizedFallback = normalizeLetter(fallbackLetter);
  return normalizedFallback ? [normalizedFallback] : [];
}

function normalizeAssetKey(input) {
  const normalized = String(input || '')
    .trim()
    .toLowerCase();
  if (normalized.startsWith('pdf-')) return normalized;
  const letter = normalizeLetter(normalized);
  return letter ? `pdf-${letter}` : '';
}

function isHttpUrl(input) {
  return /^https?:\/\//i.test(String(input || '').trim());
}

function normalizeCloudPath(input) {
  return String(input || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
}

function buildCloudPath(storageDir, fileName) {
  const normalizedDir = normalizeCloudPath(storageDir).replace(/\/+$/, '');
  const normalizedFileName = String(fileName || '')
    .trim()
    .replace(/^\/+/, '');
  if (!normalizedDir || !normalizedFileName) return '';
  return `${normalizedDir}/${normalizedFileName}`;
}

function getFallbackCloudPath(assetInput = {}) {
  const asset = assetInput && typeof assetInput === 'object' ? assetInput : {};
  const explicitPath = normalizeCloudPath(asset.cloudPath || asset.storagePath);
  if (explicitPath) return explicitPath;

  const phraseFileName = V2_PHRASE_FILE_NAMES[normalizeAssetKey(asset.assetKey)];
  if (phraseFileName) {
    return buildCloudPath(V2_PHRASE_STORAGE_DIR, phraseFileName);
  }

  return buildCloudPath(getDownloadConfig().cloudStorageDir, asset.title);
}

function normalizeDownloadAsset(itemInput = {}) {
  const item = itemInput && typeof itemInput === 'object' ? itemInput : {};
  const assetKey = normalizeAssetKey(item.assetKey || item.letter);
  const letter = normalizeLetter(item.letter || assetKey);
  const title = String(item.title || `${letter.toUpperCase()}.pdf`).trim();
  const status = String(item.status || 'active').trim() || 'active';
  const fileId = String(item.fileId || '').trim();

  return {
    _id: String(item._id || '').trim(),
    assetKey,
    letter,
    label: String(item.label || letter.toUpperCase()).trim() || letter.toUpperCase(),
    coveredLetters: normalizeCoveredLetters(item.coveredLetters, letter),
    title,
    version: String(item.version || '').trim(),
    size: Math.max(0, Math.round(Number(item.size || 0))),
    fileType: String(item.fileType || 'pdf').trim() || 'pdf',
    fileId,
    cloudPath: normalizeCloudPath(item.cloudPath || item.storagePath || ''),
    status,
    updatedAt: normalizeTimestamp(item.updatedAt),
    createdAt: normalizeTimestamp(item.createdAt),
    canDownload: status === 'active' && Boolean(fileId),
  };
}

function getUpdatedCount(result) {
  return Number(result && (result.updated || result.updatedCount || result.modifiedCount || 0));
}

async function listDownloadCatalogAssets() {
  const result = await db.collection(DOWNLOAD_ASSETS).get();
  return (result.data || [])
    .map((item) => normalizeDownloadAsset(item))
    .filter((item) => item.assetKey)
    .sort((left, right) => left.letter.localeCompare(right.letter));
}

async function getDownloadAssetsByKeys(assetKeys) {
  const normalizedKeys = Array.from(
    new Set(
      (Array.isArray(assetKeys) ? assetKeys : [])
        .map((item) => normalizeAssetKey(item))
        .filter(Boolean),
    ),
  );

  if (!normalizedKeys.length) return [];

  const result = await db
    .collection(DOWNLOAD_ASSETS)
    .where({
      assetKey: dbCmd.in(normalizedKeys),
    })
    .get();

  return (result.data || [])
    .map((item) => normalizeDownloadAsset(item))
    .filter((item) => item.assetKey)
    .sort((left, right) => left.letter.localeCompare(right.letter));
}

function normalizeLocalVersions(input) {
  return (Array.isArray(input) ? input : []).reduce((acc, item) => {
    const assetKey = normalizeAssetKey(item && item.assetKey);
    const version = String((item && item.version) || '').trim();
    if (!assetKey || !version) return acc;
    acc[assetKey] = version;
    return acc;
  }, {});
}

async function getDownloadEntitlementByOpenId(openid) {
  const result = await db.collection(DOWNLOAD_ENTITLEMENTS).where({ openid }).limit(1).get();
  return result.data[0] || null;
}

async function ensureDownloadEntitlementRecord(openid, now) {
  const collection = db.collection(DOWNLOAD_ENTITLEMENTS);
  const current = await getDownloadEntitlementByOpenId(openid);

  if (current) {
    await collection.doc(current._id).update({
      data: {
        updatedAt: now,
      },
    });
    return {
      ...current,
      updatedAt: now,
    };
  }

  const addResult = await collection.add({
    data: {
      openid,
      isLifetimeMember: false,
      lifetimeActivatedAt: 0,
      creditBalance: 0,
      totalPurchasedCredits: 0,
      totalConsumedCredits: 0,
      createdAt: now,
      updatedAt: now,
      lastOrderNo: '',
      lastTicketId: '',
    },
  });

  return {
    _id: addResult.id || addResult._id,
    openid,
    isLifetimeMember: false,
    lifetimeActivatedAt: 0,
    creditBalance: 0,
    totalPurchasedCredits: 0,
    totalConsumedCredits: 0,
    createdAt: now,
    updatedAt: now,
    lastOrderNo: '',
    lastTicketId: '',
  };
}

async function getLatestDownloadOrder(openid) {
  const result = await db
    .collection(DOWNLOAD_ORDERS)
    .where({ openid })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();
  return result.data[0] || null;
}

function buildDownloadBenefits(entitlementInput = {}, latestOrderInput = null, options = {}) {
  const latestOrder =
    latestOrderInput && typeof latestOrderInput === 'object' ? latestOrderInput : {};

  return {
    isFreeAccess: true,
    isLifetimeMember: false,
    creditBalance: 0,
    latestOrderStatus: String(latestOrder.status || '').trim(),
    latestOrderSku: String(latestOrder.sku || '').trim(),
    latestOrderUpdatedAt: normalizeTimestamp(latestOrder.updatedAt),
    availableLocalCount: 0,
  };
}

async function getDownloadBenefitsSnapshot(openid, options = {}) {
  const { now = Date.now(), ensureRecord = false } = options;
  const downloadConfig = getDownloadConfig();
  const entitlement = ensureRecord
    ? await ensureDownloadEntitlementRecord(openid, now)
    : (await getDownloadEntitlementByOpenId(openid)) || {
        openid,
        isLifetimeMember: false,
        creditBalance: 0,
      };
  const latestOrder = await getLatestDownloadOrder(openid);
  return buildDownloadBenefits(entitlement, latestOrder, {
    isFreeAccess: true,
  });
}

function createRandomId(prefix = 'rf') {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}

function normalizeLimit(limit, fallback = 8, max = 20) {
  const parsed = Math.max(1, Math.round(Number(limit || fallback)));
  return Math.min(parsed, max);
}

async function createDownloadOrder(openid, product, now, extra = {}) {
  const orderNo = createRandomId('rford');
  const record = {
    openid,
    orderNo,
    sku: product.sku,
    title: product.title,
    amountFen: product.amountFen,
    benefitType: product.benefitType,
    creditDelta: product.creditDelta,
    isLifetimeMember: Boolean(product.isLifetimeMember),
    status: ORDER_STATUS_CREATED,
    paymentMode: String(extra.paymentMode || '').trim() || 'disabled',
    source: String(extra.source || '').trim() || 'downloads',
    clientPlatform: String(extra.clientPlatform || '').trim(),
    paymentPayload:
      extra.paymentPayload && typeof extra.paymentPayload === 'object' ? extra.paymentPayload : {},
    createdAt: now,
    updatedAt: now,
    paidAt: 0,
    fulfilledAt: 0,
    fulfillmentStatus: ORDER_FULFILLMENT_PENDING,
  };

  const result = await db.collection(DOWNLOAD_ORDERS).add({
    data: record,
  });

  return {
    _id: result.id || result._id,
    ...record,
  };
}

async function getDownloadOrderByNo(orderNo) {
  const result = await db.collection(DOWNLOAD_ORDERS).where({ orderNo }).limit(1).get();
  return result.data[0] || null;
}

async function markDownloadOrderPaid(orderNo, now, paymentPayload = {}) {
  const order = await getDownloadOrderByNo(orderNo);
  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 'Purchase order not found.');
  }

  if (order.status === ORDER_STATUS_PAID || order.status === ORDER_STATUS_FULFILLED) {
    return order;
  }

  await db
    .collection(DOWNLOAD_ORDERS)
    .where({ orderNo })
    .update({
      data: {
        status: ORDER_STATUS_PAID,
        paidAt: now,
        updatedAt: now,
        paymentPayload,
      },
    });

  return (
    (await getDownloadOrderByNo(orderNo)) || {
      ...order,
      status: ORDER_STATUS_PAID,
      paidAt: now,
      updatedAt: now,
      paymentPayload,
    }
  );
}

async function grantDownloadEntitlementForOrder(orderNo, now) {
  const order = await getDownloadOrderByNo(orderNo);
  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 'Purchase order not found.');
  }

  if (
    order.fulfillmentStatus === ORDER_FULFILLMENT_FULFILLED ||
    order.status === ORDER_STATUS_FULFILLED
  ) {
    return {
      order,
      downloadBenefits: await getDownloadBenefitsSnapshot(order.openid, {
        now,
        ensureRecord: true,
      }),
    };
  }

  if (order.status !== ORDER_STATUS_PAID && order.status !== ORDER_STATUS_FULFILLED) {
    throw createAppError('ORDER_NOT_PAID', 'The purchase order has not been paid yet.');
  }

  const claimResult = await db
    .collection(DOWNLOAD_ORDERS)
    .where({
      orderNo,
      fulfillmentStatus: ORDER_FULFILLMENT_PENDING,
    })
    .update({
      data: {
        fulfillmentStatus: ORDER_FULFILLMENT_PROCESSING,
        updatedAt: now,
      },
    });

  if (!getUpdatedCount(claimResult)) {
    const latest = await getDownloadOrderByNo(orderNo);
    if (
      latest &&
      (latest.fulfillmentStatus === ORDER_FULFILLMENT_FULFILLED ||
        latest.status === ORDER_STATUS_FULFILLED)
    ) {
      return {
        order: latest,
        downloadBenefits: await getDownloadBenefitsSnapshot(order.openid, {
          now,
          ensureRecord: true,
        }),
      };
    }
    throw createAppError(
      'ORDER_FULFILLMENT_IN_PROGRESS',
      'The purchase order is already being processed.',
    );
  }

  const entitlement = await ensureDownloadEntitlementRecord(order.openid, now);
  const entitlementsCollection = db.collection(DOWNLOAD_ENTITLEMENTS);

  if (order.isLifetimeMember) {
    await entitlementsCollection.doc(entitlement._id).update({
      data: {
        isLifetimeMember: true,
        lifetimeActivatedAt: entitlement.lifetimeActivatedAt || now,
        updatedAt: now,
        lastOrderNo: orderNo,
      },
    });
  } else if (Number(order.creditDelta || 0) > 0) {
    await entitlementsCollection.doc(entitlement._id).update({
      data: {
        creditBalance: dbCmd.inc(Math.max(0, Number(order.creditDelta || 0))),
        totalPurchasedCredits: dbCmd.inc(Math.max(0, Number(order.creditDelta || 0))),
        updatedAt: now,
        lastOrderNo: orderNo,
      },
    });
  }

  await db
    .collection(DOWNLOAD_ORDERS)
    .where({ orderNo })
    .update({
      data: {
        status: ORDER_STATUS_FULFILLED,
        fulfillmentStatus: ORDER_FULFILLMENT_FULFILLED,
        paidAt: normalizeTimestamp(order.paidAt, now) || now,
        fulfilledAt: now,
        updatedAt: now,
      },
    });

  const latestOrder = await getDownloadOrderByNo(orderNo);
  return {
    order: latestOrder,
    downloadBenefits: await getDownloadBenefitsSnapshot(order.openid, { now, ensureRecord: true }),
  };
}

async function listRecentDownloadOrders(openid, limit = 8) {
  const result = await db
    .collection(DOWNLOAD_ORDERS)
    .where({ openid })
    .orderBy('updatedAt', 'desc')
    .limit(normalizeLimit(limit))
    .get();

  return (result.data || []).map((item) => ({
    orderNo: String(item.orderNo || '').trim(),
    sku: String(item.sku || '').trim(),
    title: String(item.title || '').trim(),
    amountFen: Math.max(0, Math.round(Number(item.amountFen || 0))),
    status: String(item.status || '').trim(),
    createdAt: normalizeTimestamp(item.createdAt),
    updatedAt: normalizeTimestamp(item.updatedAt),
  }));
}

async function createDownloadTickets(openid, assetKeys, localVersions, now) {
  const downloadConfig = getDownloadConfig();
  const normalizedAssetKeys = Array.from(
    new Set(
      (Array.isArray(assetKeys) ? assetKeys : [])
        .map((item) => normalizeAssetKey(item))
        .filter(Boolean),
    ),
  );
  if (!normalizedAssetKeys.length) {
    throw createAppError('DOWNLOAD_SELECTION_EMPTY', 'No download assets were selected.');
  }

  const assets = await getDownloadAssetsByKeys(normalizedAssetKeys);
  const assetMap = assets.reduce((acc, asset) => {
    acc[asset.assetKey] = asset;
    return acc;
  }, {});

  const missingAssets = normalizedAssetKeys.filter((assetKey) => !assetMap[assetKey]);
  if (missingAssets.length) {
    throw createAppError('DOWNLOAD_ASSET_MISSING', 'Some download assets are not available yet.', {
      assetKeys: missingAssets,
    });
  }

  const normalizedLocalVersions = normalizeLocalVersions(localVersions);
  const skippedAssets = [];
  const pendingAssets = [];

  normalizedAssetKeys.forEach((assetKey) => {
    const asset = assetMap[assetKey];
    if (!asset.canDownload) {
      throw createAppError(
        'DOWNLOAD_ASSET_DISABLED',
        `${asset.title || asset.assetKey} is not available for download.`,
      );
    }

    if (
      normalizedLocalVersions[asset.assetKey] &&
      normalizedLocalVersions[asset.assetKey] === asset.version
    ) {
      skippedAssets.push(asset);
    } else {
      pendingAssets.push(asset);
    }
  });

  const expiresAt = now + downloadConfig.ticketExpireSeconds * 1000;
  const ticketsCollection = db.collection(DOWNLOAD_TICKETS);
  const createdTickets = [];

  for (const asset of pendingAssets) {
    const fallbackCloudPath = getFallbackCloudPath(asset);
    if (!asset.fileId && !fallbackCloudPath) {
      throw createAppError(
        'DOWNLOAD_URL_UNAVAILABLE',
        `Unable to create a download URL for ${asset.title}.`,
      );
    }

    const ticketId = createRandomId('rfdt');
    await ticketsCollection.add({
      data: {
        ticketId,
        openid,
        assetKey: asset.assetKey,
        letter: asset.letter,
        title: asset.title,
        version: asset.version,
        fileType: asset.fileType,
        fileId: asset.fileId,
        cloudPath: fallbackCloudPath,
        status: TICKET_STATUS_CREATED,
        expiresAt,
        confirmedAt: 0,
        consumedCredit: 0,
        createdAt: now,
        updatedAt: now,
      },
    });

    createdTickets.push({
      ticketId,
      assetKey: asset.assetKey,
      letter: asset.letter,
      title: asset.title,
      version: asset.version,
      size: asset.size,
      fileType: asset.fileType,
      fileId: asset.fileId,
      cloudPath: fallbackCloudPath,
      downloadUrl: isHttpUrl(asset.fileId) ? asset.fileId : '',
      expiresAt,
    });
  }

  return {
    pendingAssets: createdTickets,
    skippedAssets,
    downloadBenefits: await getDownloadBenefitsSnapshot(openid, { now, ensureRecord: true }),
  };
}

async function getDownloadTicket(openid, ticketId) {
  const result = await db
    .collection(DOWNLOAD_TICKETS)
    .where({
      openid,
      ticketId,
    })
    .limit(1)
    .get();
  return result.data[0] || null;
}

async function confirmDownloadTicketSuccess(openid, ticketId, now) {
  const ticket = await getDownloadTicket(openid, ticketId);
  if (!ticket) {
    return {
      ticket: {
        ticketId,
        openid,
        status: TICKET_STATUS_CONSUMED,
        confirmedAt: now,
      },
      alreadyConsumed: true,
      downloadBenefits: await getDownloadBenefitsSnapshot(openid, { now, ensureRecord: true }),
    };
  }

  if (ticket.status === TICKET_STATUS_CONSUMED) {
    return {
      ticket,
      alreadyConsumed: true,
      downloadBenefits: await getDownloadBenefitsSnapshot(openid, { now, ensureRecord: true }),
    };
  }

  if (normalizeTimestamp(ticket.expiresAt) <= now || ticket.status === TICKET_STATUS_EXPIRED) {
    await db
      .collection(DOWNLOAD_TICKETS)
      .where({
        openid,
        ticketId,
      })
      .update({
        data: {
          status: TICKET_STATUS_EXPIRED,
          updatedAt: now,
        },
      });
    throw createAppError(
      'DOWNLOAD_TICKET_EXPIRED',
      'Download ticket has expired. Please request it again.',
    );
  }

  const claimResult = await db
    .collection(DOWNLOAD_TICKETS)
    .where({
      openid,
      ticketId,
      status: TICKET_STATUS_CREATED,
    })
    .update({
      data: {
        status: TICKET_STATUS_CONSUMING,
        updatedAt: now,
      },
    });

  if (!getUpdatedCount(claimResult)) {
    const latest = await getDownloadTicket(openid, ticketId);
    if (latest && latest.status === TICKET_STATUS_CONSUMED) {
      return {
        ticket: latest,
        alreadyConsumed: true,
        downloadBenefits: await getDownloadBenefitsSnapshot(openid, { now, ensureRecord: true }),
      };
    }
    throw createAppError(
      'DOWNLOAD_TICKET_IN_PROGRESS',
      'Download ticket is already being processed.',
    );
  }

  let consumedCredit = 0;

  await db
    .collection(DOWNLOAD_TICKETS)
    .where({
      openid,
      ticketId,
      status: TICKET_STATUS_CONSUMING,
    })
    .update({
      data: {
        status: TICKET_STATUS_CONSUMED,
        confirmedAt: now,
        consumedCredit,
        updatedAt: now,
      },
    });

  return {
    ticket: await getDownloadTicket(openid, ticketId),
    alreadyConsumed: false,
    downloadBenefits: await getDownloadBenefitsSnapshot(openid, { now, ensureRecord: true }),
  };
}

module.exports = {
  ACTIVITY,
  DOWNLOAD_ASSETS,
  DOWNLOAD_ENTITLEMENTS,
  DOWNLOAD_ORDERS,
  DOWNLOAD_TICKETS,
  ORDER_STATUS_CREATED,
  ORDER_STATUS_FULFILLED,
  ORDER_STATUS_PAID,
  ORDER_STATUS_PAYMENT_DISABLED,
  PROGRESS,
  TICKET_STATUS_CONSUMED,
  TICKET_STATUS_CREATED,
  TICKET_STATUS_EXPIRED,
  USERS,
  buildDownloadBenefits,
  buildProgressMap,
  buildStats,
  confirmDownloadTicketSuccess,
  createAppError,
  createDownloadOrder,
  createDownloadTickets,
  db,
  dbCmd,
  ensureDownloadEntitlementRecord,
  ensureUserRecord,
  getDownloadBenefitsSnapshot,
  getDownloadConfig,
  getDownloadOrderByNo,
  getDownloadProduct,
  getDownloadProducts,
  getDownloadTicket,
  getLatestDownloadOrder,
  getUpdatedCount,
  getUserByOpenId,
  grantDownloadEntitlementForOrder,
  listDownloadCatalogAssets,
  listRecentDownloadOrders,
  markDownloadOrderPaid,
  normalizeAssetKey,
  normalizeCoveredLetters,
  normalizeDownloadAsset,
  normalizeLocalVersions,
  normalizeProgressEntry,
  normalizeStatus,
  normalizeTimestamp,
  replaceActivity,
  requireOpenId,
  resolveOpenIdFromCode,
  toErrorResult,
  toSessionUser,
  updateUserProfile,
  upsertUserOnLogin,
};
