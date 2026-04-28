'use strict';

const db = uniCloud.database();
const ASSETS_COLLECTION = 'rf_download_assets';
const CONFIRM_TOKEN = 'IMPORT_V2_PHRASES';

const ASSETS = [
  {
    assetKey: 'pdf-phrase-a',
    letter: 'a',
    label: '短语 A',
    coveredLetters: ['a'],
    title: '短语A.pdf',
    version: '2026.04-v2',
    size: 385229,
    fileType: 'pdf',
    fileId: '1e28de84-ad5b-4a7f-8bff-2c735515b2f0',
    status: 'active',
  },
  {
    assetKey: 'pdf-phrase-b',
    letter: 'b',
    label: '短语 B',
    coveredLetters: ['b'],
    title: '短语B.pdf',
    version: '2026.04-v2',
    size: 355635,
    fileType: 'pdf',
    fileId: 'fc0785b1-50b5-4056-9508-0e746c73f06b',
    status: 'active',
  },
  {
    assetKey: 'pdf-phrase-cd',
    letter: 'c',
    label: '短语 C/D',
    coveredLetters: ['c', 'd'],
    title: '短语CD.pdf',
    version: '2026.04-v2',
    size: 383181,
    fileType: 'pdf',
    fileId: 'ff10ff80-f85b-4805-8a8e-8a35f03ead3a',
    status: 'active',
  },
  {
    assetKey: 'pdf-phrase-eg',
    letter: 'e',
    label: '短语 E/G',
    coveredLetters: ['e', 'g'],
    title: '短语EG.pdf',
    version: '2026.04-v2',
    size: 365670,
    fileType: 'pdf',
    fileId: '88d6a40b-0e1b-4dae-84ea-88dee92a8597',
    status: 'active',
  },
  {
    assetKey: 'pdf-phrase-fh',
    letter: 'f',
    label: '短语 F/H',
    coveredLetters: ['f', 'h'],
    title: '短语FH.pdf',
    version: '2026.04-v2',
    size: 364339,
    fileType: 'pdf',
    fileId: 'cae180a1-90e8-410b-91ed-c9a2a8b12d64',
    status: 'active',
  },
  {
    assetKey: 'pdf-phrase-i',
    letter: 'i',
    label: '短语 I',
    coveredLetters: ['i'],
    title: '短语I.pdf',
    version: '2026.04-v2',
    size: 338125,
    fileType: 'pdf',
    fileId: '45ce0125-ae13-4947-ac19-cd8b1b971a6b',
    status: 'active',
  },
  {
    assetKey: 'pdf-phrase-jklm',
    letter: 'j',
    label: '短语 J/K/L/M',
    coveredLetters: ['j', 'k', 'l', 'm'],
    title: '短语JKLM.pdf',
    version: '2026.04-v2',
    size: 412979,
    fileType: 'pdf',
    fileId: '19e14e07-1612-4316-a689-db030faf4b10',
    status: 'active',
  },
  {
    assetKey: 'pdf-phrase-no',
    letter: 'n',
    label: '短语 N/O',
    coveredLetters: ['n', 'o'],
    title: '短语NO.pdf',
    version: '2026.04-v2',
    size: 337408,
    fileType: 'pdf',
    fileId: '26c62ce1-55c4-4606-8a30-a664693581a4',
    status: 'active',
  },
  {
    assetKey: 'pdf-phrase-p',
    letter: 'p',
    label: '短语 P',
    coveredLetters: ['p'],
    title: '短语P.pdf',
    version: '2026.04-v2',
    size: 360858,
    fileType: 'pdf',
    fileId: '0911aaa2-fc53-42e0-80b7-b11d84720163',
    status: 'active',
  },
  {
    assetKey: 'pdf-phrase-rs',
    letter: 'r',
    label: '短语 R/S',
    coveredLetters: ['r', 's'],
    title: '短语RS.pdf',
    version: '2026.04-v2',
    size: 420454,
    fileType: 'pdf',
    fileId: '18e386ac-6d57-418e-a421-5b48ea5a888e',
    status: 'active',
  },
  {
    assetKey: 'pdf-phrase-tuvw',
    letter: 't',
    label: '短语 T/U/V/W',
    coveredLetters: ['t', 'u', 'v', 'w'],
    title: '短语TUVW.pdf',
    version: '2026.04-v2',
    size: 397926,
    fileType: 'pdf',
    fileId: '5ca145a7-799b-49e8-b2d7-0326e9e66506',
    status: 'active',
  },
  {
    assetKey: 'pdf-reading',
    letter: 'r',
    label: '阅读',
    coveredLetters: ['r'],
    title: '阅读.pdf',
    version: '2026.04-v2',
    size: 343142,
    fileType: 'pdf',
    fileId: '28fa2e5e-fe98-4a7b-bc3c-372b5d9aad58',
    status: 'active',
  },
];

function getUpdatedCount(result) {
  return Number(result && (result.updated || result.updatedCount || result.modifiedCount || 0));
}

async function upsertAsset(asset, now) {
  const record = {
    ...asset,
    updatedAt: now,
  };
  const updateResult = await db
    .collection(ASSETS_COLLECTION)
    .where({ assetKey: asset.assetKey })
    .update(record);
  if (getUpdatedCount(updateResult) > 0) {
    return { assetKey: asset.assetKey, action: 'updated' };
  }

  try {
    await db.collection(ASSETS_COLLECTION).add({
      ...record,
      createdAt: now,
    });
    return { assetKey: asset.assetKey, action: 'created' };
  } catch (error) {
    await db.collection(ASSETS_COLLECTION).where({ assetKey: asset.assetKey }).update(record);
    return {
      assetKey: asset.assetKey,
      action: 'updated-after-duplicate',
    };
  }
}

exports.main = async (event = {}) => {
  if (!event || event.confirm !== CONFIRM_TOKEN) {
    return {
      ok: false,
      code: 'CONFIRM_REQUIRED',
      message: `Call this function with { "confirm": "${CONFIRM_TOKEN}" }.`,
    };
  }

  const now = Date.now();
  const results = [];
  for (const asset of ASSETS) {
    results.push(await upsertAsset(asset, now));
  }

  return {
    ok: true,
    collection: ASSETS_COLLECTION,
    count: results.length,
    created: results.filter((item) => item.action === 'created').length,
    updated: results.filter((item) => item.action !== 'created').length,
    results,
  };
};
