#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const ROOT_ID_PATTERN = /^[a-z0-9-]+$/;

const FIELD_ALIASES = {
  rootList: ['roots', 'rootList', 'data', 'items'],
  rootId: ['rootId', 'root_id', 'rootKey', 'root'],
  words: ['words', 'wordList', 'items', 'entries'],
  id: ['id', 'wordId', 'word_id'],
  word: ['word', 'lemma', 'text'],
  translation: ['translation', 'meaningCn', 'cn', 'explain'],
  tags: ['tags', 'categories', 'levels'],
};

function getValueByAliases(obj, aliases, fallback = undefined) {
  if (!obj || typeof obj !== 'object') return fallback;
  for (const key of aliases) {
    if (
      Object.prototype.hasOwnProperty.call(obj, key) &&
      obj[key] !== undefined &&
      obj[key] !== null
    ) {
      return obj[key];
    }
  }
  return fallback;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  if (typeof value === 'string') {
    return value
      .split(/[,\s|/]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [value];
}

function normalizeId(value) {
  const source = String(value || '')
    .trim()
    .toLowerCase();
  if (!source) return '';
  return source
    .replace(/[\x27\x22]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function readInputFile(inputPath) {
  const rawContent = await fs.readFile(inputPath, 'utf8');
  const content = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent;
  const extension = path.extname(inputPath).toLowerCase();
  if (extension === '.jsonl') {
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
  return JSON.parse(content);
}

function asGroupedRoots(rawData) {
  if (Array.isArray(rawData)) {
    const first = rawData[0] || {};
    const hasWordsList = toArray(getValueByAliases(first, FIELD_ALIASES.words, [])).length > 0;
    if (hasWordsList) return rawData;
    return null;
  }

  if (rawData && typeof rawData === 'object') {
    if (Array.isArray(rawData.roots)) return rawData.roots;

    const rootsFromKey = getValueByAliases(rawData, FIELD_ALIASES.rootList, null);
    if (Array.isArray(rootsFromKey)) return rootsFromKey;

    const hasSingleRootShape =
      getValueByAliases(rawData, FIELD_ALIASES.rootId, null) &&
      Array.isArray(getValueByAliases(rawData, FIELD_ALIASES.words, null));
    if (hasSingleRootShape) return [rawData];

    const values = Object.values(rawData);
    if (values.length > 0 && values.every((entry) => entry && typeof entry === 'object')) {
      return values.map((entry, index) => ({
        rootId: entry.rootId || entry.root || Object.keys(rawData)[index],
        ...entry,
      }));
    }
  }

  return null;
}

function asFlatRows(rawData) {
  if (!Array.isArray(rawData)) return null;
  const first = rawData[0] || {};
  const hasWordsList = toArray(getValueByAliases(first, FIELD_ALIASES.words, [])).length > 0;
  if (hasWordsList) return null;
  return rawData;
}

function createIssueCollector(maxIssues) {
  const errors = [];
  return {
    errors,
    push(pathValue, message) {
      if (errors.length < maxIssues) {
        errors.push({ path: pathValue, message });
      }
    },
  };
}

function validateRootId(rawRootId, pathValue, collector) {
  const rootId = String(rawRootId || '').trim();
  if (!rootId) {
    collector.push(pathValue, 'missing rootId');
    return '';
  }

  if (!ROOT_ID_PATTERN.test(rootId)) {
    const normalized = normalizeId(rootId);
    collector.push(
      pathValue,
      `bad rootId "${rootId}". expected /^[a-z0-9-]+$/; suggested "${normalized || 'n/a'}"`,
    );
  }

  return normalizeId(rootId);
}

function validateWordRecord(rawWord, context, collector, seenWordIdsInRoot, globalWordMap) {
  const word = String(getValueByAliases(rawWord, FIELD_ALIASES.word, '')).trim();
  const translation = String(getValueByAliases(rawWord, FIELD_ALIASES.translation, '')).trim();
  const idSeed = getValueByAliases(rawWord, FIELD_ALIASES.id, word);
  const wordId = normalizeId(idSeed);
  const tags = toArray(getValueByAliases(rawWord, FIELD_ALIASES.tags, []))
    .map((tag) => normalizeId(tag))
    .filter(Boolean);

  if (!word) {
    collector.push(context, 'missing word');
  }
  if (!wordId) {
    collector.push(context, 'missing or invalid word id');
  }
  if (!translation) {
    collector.push(context, 'missing translation');
  }
  if (tags.length === 0) {
    collector.push(context, 'empty tags');
  }

  if (wordId) {
    if (seenWordIdsInRoot.has(wordId)) {
      collector.push(context, `duplicate word id in same root: "${wordId}"`);
    } else {
      seenWordIdsInRoot.add(wordId);
    }

    const previousRootId = globalWordMap.get(wordId);
    if (!previousRootId) {
      globalWordMap.set(wordId, context.rootId);
    } else if (previousRootId !== context.rootId) {
      collector.push(
        context,
        `duplicate word id across roots: "${wordId}" in "${previousRootId}" and "${context.rootId}"`,
      );
    }
  }
}

function validateGroupedRoots(groupedRoots, collector) {
  const rootIdSet = new Set();
  const globalWordMap = new Map();
  let rootCount = 0;
  let wordCount = 0;

  groupedRoots.forEach((rawRoot, rootIndex) => {
    const pathValue = `roots[${rootIndex}]`;
    const normalizedRootId = validateRootId(
      getValueByAliases(rawRoot, FIELD_ALIASES.rootId, ''),
      `${pathValue}.rootId`,
      collector,
    );
    if (!normalizedRootId) return;

    rootCount += 1;
    if (rootIdSet.has(normalizedRootId)) {
      collector.push(`${pathValue}.rootId`, `duplicate rootId "${normalizedRootId}"`);
    } else {
      rootIdSet.add(normalizedRootId);
    }

    const words = toArray(getValueByAliases(rawRoot, FIELD_ALIASES.words, []));
    if (words.length === 0) {
      collector.push(`${pathValue}.words`, 'missing words list');
      return;
    }

    const seenWordIdsInRoot = new Set();
    words.forEach((rawWord, wordIndex) => {
      wordCount += 1;
      validateWordRecord(
        rawWord,
        {
          toString: () => `${pathValue}.words[${wordIndex}]`,
          rootId: normalizedRootId,
        },
        collector,
        seenWordIdsInRoot,
        globalWordMap,
      );
    });
  });

  return { rootCount, wordCount };
}

function validateFlatRows(flatRows, collector) {
  const rootIdSet = new Set();
  const globalWordMap = new Map();
  const wordsSeenPerRoot = new Map();
  let wordCount = 0;

  flatRows.forEach((row, index) => {
    const pathValue = `rows[${index}]`;
    const normalizedRootId = validateRootId(
      getValueByAliases(row, FIELD_ALIASES.rootId, ''),
      `${pathValue}.rootId`,
      collector,
    );
    if (!normalizedRootId) return;

    rootIdSet.add(normalizedRootId);
    wordCount += 1;

    if (!wordsSeenPerRoot.has(normalizedRootId)) {
      wordsSeenPerRoot.set(normalizedRootId, new Set());
    }

    validateWordRecord(
      row,
      {
        toString: () => pathValue,
        rootId: normalizedRootId,
      },
      collector,
      wordsSeenPerRoot.get(normalizedRootId),
      globalWordMap,
    );
  });

  return { rootCount: rootIdSet.size, wordCount };
}

function printIssues(issues) {
  if (issues.length === 0) return;
  console.error('[validate] errors:');
  issues.forEach((issue) => {
    const pathValue = typeof issue.path === 'string' ? issue.path : String(issue.path);
    console.error(`  - ${pathValue}: ${issue.message}`);
  });
}

async function main() {
  const parsed = parseArgs({
    options: {
      input: { type: 'string', short: 'i' },
      maxIssues: { type: 'string', default: '200' },
    },
    allowPositionals: true,
  });

  const inputArg = parsed.values.input || parsed.positionals[0];
  if (!inputArg) {
    throw new Error('missing input file. use --input <path-to-json-or-jsonl>');
  }

  const maxIssues = Number(parsed.values.maxIssues) || 200;
  const collector = createIssueCollector(maxIssues);
  const inputPath = path.resolve(process.cwd(), inputArg);
  const rawData = await readInputFile(inputPath);

  const groupedRoots = asGroupedRoots(rawData);
  const flatRows = groupedRoots ? null : asFlatRows(rawData);
  if (!groupedRoots && !flatRows) {
    throw new Error('unsupported input structure');
  }

  const stats = groupedRoots
    ? validateGroupedRoots(groupedRoots, collector)
    : validateFlatRows(flatRows, collector);

  console.log(`[validate] roots: ${stats.rootCount}`);
  console.log(`[validate] words: ${stats.wordCount}`);
  console.log(`[validate] errors: ${collector.errors.length}`);

  if (collector.errors.length > 0) {
    printIssues(collector.errors);
    process.exitCode = 1;
    return;
  }

  console.log('[validate] success');
}

main().catch((error) => {
  console.error(`[validate] failed: ${error.message}`);
  process.exitCode = 1;
});
