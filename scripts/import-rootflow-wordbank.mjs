#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const FIELD_ALIASES = {
  rootList: ['roots', 'rootList', 'data', 'items'],
  rootId: ['rootId', 'root_id', 'rootKey', 'root'],
  root: ['root', 'rootText', 'rootLabel'],
  meaning: ['meaning', 'mean', 'coreMeaning'],
  descriptionCn: ['descriptionCn', 'description', 'meaningCn', 'cnMeaning'],
  words: ['words', 'wordList', 'items', 'entries'],
  id: ['id', 'wordId', 'word_id'],
  word: ['word', 'lemma', 'text'],
  display: ['display', 'displayWord', 'showWord'],
  phonetic: ['phonetic', 'ipa', 'pronunciation'],
  translation: ['translation', 'meaningCn', 'cn', 'explain'],
  sentence: ['sentence', 'example', 'exampleSentence'],
  tags: ['tags', 'categories', 'levels'],
  level: ['level', 'difficulty', 'rank'],
};

const HIERARCHY_FIELD_ALIASES = {
  rootList: ['roots', 'rootList', 'data', 'items'],
  rootId: ['rootId', 'root_id', 'rootKey'],
  rootText: ['rootText', 'root', 'rootLabel', 'rootTextLabel'],
  parentRootId: ['parentRootId', 'parent_root_id', 'parentId'],
  rootLevel: ['rootLevel', 'level', 'depth'],
  rootPath: ['rootPath', 'path'],
  type: ['type', 'rootType'],
  meaningEn: ['meaningEn', 'meaning', 'coreMeaning', 'mean'],
  meaningCn: ['meaningCn', 'descriptionCn', 'cnMeaning', 'description'],
  notes: ['notes', 'note', 'remark', 'remarks'],
};

const DEFAULT_CATEGORY_LABELS = {
  junior: 'Junior 3500',
  cet4: 'CET4 5500',
  cet6: 'CET6 7500',
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

function normalizeId(value) {
  const source = String(value || '')
    .trim()
    .toLowerCase();

  if (!source) return '';

  let normalized = source
    .replace(/[\x27\x22]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) {
    normalized = source.replace(/\s+/g, '-');
  }

  return normalized;
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

function toInteger(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(1, Math.floor(num)) : fallback;
}

function sortByKey(items, key) {
  return items.sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || '')));
}

function escapeUnicodeToAscii(text) {
  return text.replace(/[\u007f-\uffff]/g, (char) => {
    const code = char.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${code}`;
  });
}

function createJsonText(payload) {
  return `${escapeUnicodeToAscii(JSON.stringify(payload, null, 2))}\n`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function removeJsonFiles(dirPath) {
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }
  const deleteTargets = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(dirPath, entry.name));
  await Promise.all(deleteTargets.map((target) => fs.unlink(target)));
}

function normalizeWord(rawWord) {
  const canonicalWord = String(getValueByAliases(rawWord, FIELD_ALIASES.word, '')).trim();
  const idSeed = getValueByAliases(rawWord, FIELD_ALIASES.id, canonicalWord);
  const id = normalizeId(idSeed);
  if (!id || !canonicalWord) return null;

  const tags = toArray(getValueByAliases(rawWord, FIELD_ALIASES.tags, []))
    .map((tag) => normalizeId(tag))
    .filter(Boolean);

  return {
    id,
    word: canonicalWord.toLowerCase(),
    display: String(getValueByAliases(rawWord, FIELD_ALIASES.display, canonicalWord)).trim(),
    phonetic: String(getValueByAliases(rawWord, FIELD_ALIASES.phonetic, '')).trim(),
    translation: String(getValueByAliases(rawWord, FIELD_ALIASES.translation, '')).trim(),
    sentence: String(getValueByAliases(rawWord, FIELD_ALIASES.sentence, '')).trim(),
    tags: Array.from(new Set(tags)),
    level: toInteger(getValueByAliases(rawWord, FIELD_ALIASES.level, 1), 1),
  };
}

function normalizeHierarchyRecord(rawRoot, index) {
  const extractedRootId = getValueByAliases(
    rawRoot,
    HIERARCHY_FIELD_ALIASES.rootId,
    `root-${index + 1}`,
  );
  const rootId = normalizeId(extractedRootId);
  if (!rootId) return null;

  const rawRootPath = String(
    getValueByAliases(rawRoot, HIERARCHY_FIELD_ALIASES.rootPath, rootId),
  ).trim();
  const normalizedPath = rawRootPath
    ? rawRootPath
        .split('>')
        .map((segment) => normalizeId(segment))
        .filter(Boolean)
        .join('>')
    : rootId;

  return {
    rootId,
    rootText: String(
      getValueByAliases(rawRoot, HIERARCHY_FIELD_ALIASES.rootText, extractedRootId),
    ).trim(),
    parentRootId: normalizeId(getValueByAliases(rawRoot, HIERARCHY_FIELD_ALIASES.parentRootId, '')),
    rootLevel: toInteger(getValueByAliases(rawRoot, HIERARCHY_FIELD_ALIASES.rootLevel, 1), 1),
    rootPath: normalizedPath || rootId,
    type: String(getValueByAliases(rawRoot, HIERARCHY_FIELD_ALIASES.type, 'root')).trim() || 'root',
    meaningEn: String(getValueByAliases(rawRoot, HIERARCHY_FIELD_ALIASES.meaningEn, '')).trim(),
    meaningCn: String(getValueByAliases(rawRoot, HIERARCHY_FIELD_ALIASES.meaningCn, '')).trim(),
    notes: String(getValueByAliases(rawRoot, HIERARCHY_FIELD_ALIASES.notes, '')).trim(),
  };
}

function normalizeHierarchyData(rawData) {
  const rootsFromKey = Array.isArray(rawData)
    ? rawData
    : getValueByAliases(rawData, HIERARCHY_FIELD_ALIASES.rootList, []);

  return toArray(rootsFromKey)
    .map((item, index) => normalizeHierarchyRecord(item, index))
    .filter(Boolean);
}

function mergeHierarchyIntoRoots(roots, hierarchyRecords) {
  if (!Array.isArray(hierarchyRecords) || hierarchyRecords.length === 0) {
    return roots;
  }

  const hierarchyMap = new Map(hierarchyRecords.map((record) => [record.rootId, record]));

  const mergedRoots = roots.map((root) => {
    const hierarchy = hierarchyMap.get(root.rootId);
    if (!hierarchy) return root;

    return {
      ...root,
      root: hierarchy.rootText || root.root,
      meaning: hierarchy.meaningEn || root.meaning,
      descriptionCn: hierarchy.meaningCn || root.descriptionCn,
      parentRootId: hierarchy.parentRootId,
      rootLevel: hierarchy.rootLevel,
      rootPath: hierarchy.rootPath || root.rootId,
      type: hierarchy.type || 'root',
      notes: hierarchy.notes || '',
    };
  });

  const existingRootIds = new Set(mergedRoots.map((root) => root.rootId));
  const today = new Date().toISOString().slice(0, 10);

  hierarchyRecords.forEach((hierarchy) => {
    if (existingRootIds.has(hierarchy.rootId)) return;

    mergedRoots.push({
      version: 1,
      rootId: hierarchy.rootId,
      root: hierarchy.rootText || hierarchy.rootId,
      meaning: hierarchy.meaningEn || '',
      descriptionCn: hierarchy.meaningCn || '',
      updatedAt: today,
      words: [],
      parentRootId: hierarchy.parentRootId,
      rootLevel: hierarchy.rootLevel,
      rootPath: hierarchy.rootPath || hierarchy.rootId,
      type: hierarchy.type || 'root',
      notes: hierarchy.notes || '',
    });
  });

  return mergedRoots;
}

function normalizeGroupedRoots(rawGroupedRoots) {
  const roots = [];

  rawGroupedRoots.forEach((rawRoot, index) => {
    const fallbackRootId = `root-${index + 1}`;
    const extractedRootId = getValueByAliases(rawRoot, FIELD_ALIASES.rootId, fallbackRootId);
    const rootId = normalizeId(extractedRootId);
    if (!rootId) return;

    const wordsRaw = getValueByAliases(rawRoot, FIELD_ALIASES.words, []);
    const words = toArray(wordsRaw)
      .map((item) => normalizeWord(item))
      .filter(Boolean);

    roots.push({
      version: 1,
      rootId,
      root: String(getValueByAliases(rawRoot, FIELD_ALIASES.root, extractedRootId)).trim(),
      meaning: String(getValueByAliases(rawRoot, FIELD_ALIASES.meaning, '')).trim(),
      descriptionCn: String(getValueByAliases(rawRoot, FIELD_ALIASES.descriptionCn, '')).trim(),
      updatedAt: new Date().toISOString().slice(0, 10),
      words: sortByKey(words, 'id'),
    });
  });

  return roots;
}

function normalizeFlatRows(rawRows) {
  const grouped = new Map();

  rawRows.forEach((row, index) => {
    const extractedRootId = getValueByAliases(row, FIELD_ALIASES.rootId, `root-${index + 1}`);
    const rootId = normalizeId(extractedRootId);
    if (!rootId) return;

    if (!grouped.has(rootId)) {
      grouped.set(rootId, {
        version: 1,
        rootId,
        root: String(getValueByAliases(row, FIELD_ALIASES.root, extractedRootId)).trim(),
        meaning: String(getValueByAliases(row, FIELD_ALIASES.meaning, '')).trim(),
        descriptionCn: String(getValueByAliases(row, FIELD_ALIASES.descriptionCn, '')).trim(),
        updatedAt: new Date().toISOString().slice(0, 10),
        words: [],
      });
    }

    const normalizedWord = normalizeWord(row);
    if (!normalizedWord) return;
    grouped.get(rootId).words.push(normalizedWord);
  });

  return Array.from(grouped.values()).map((root) => ({
    ...root,
    words: sortByKey(Array.from(new Map(root.words.map((word) => [word.id, word])).values()), 'id'),
  }));
}

function autoDetectAndNormalize(rawData) {
  if (Array.isArray(rawData)) {
    const first = rawData[0] || {};
    const hasWordsList = toArray(getValueByAliases(first, FIELD_ALIASES.words, [])).length > 0;
    return hasWordsList ? normalizeGroupedRoots(rawData) : normalizeFlatRows(rawData);
  }

  if (rawData && typeof rawData === 'object') {
    const rootsFromKey = getValueByAliases(rawData, FIELD_ALIASES.rootList, null);
    if (Array.isArray(rootsFromKey)) {
      return normalizeGroupedRoots(rootsFromKey);
    }

    const values = Object.values(rawData);
    if (values.every((entry) => entry && typeof entry === 'object')) {
      const groupedRoots = values.map((entry, index) => ({
        rootId: entry.rootId || entry.root || Object.keys(rawData)[index],
        ...entry,
      }));
      return normalizeGroupedRoots(groupedRoots);
    }
  }

  throw new Error('Unsupported input structure. Use grouped roots JSON or flat rows JSON.');
}

function buildIndexes(roots) {
  const categories = {};
  const wordToRoot = {};
  const conflicts = [];

  roots.forEach((root) => {
    root.words.forEach((word) => {
      if (wordToRoot[word.id] && wordToRoot[word.id] !== root.rootId) {
        conflicts.push({
          wordId: word.id,
          firstRootId: wordToRoot[word.id],
          duplicateRootId: root.rootId,
        });
      } else {
        wordToRoot[word.id] = root.rootId;
      }

      word.tags.forEach((tag) => {
        if (!categories[tag]) {
          categories[tag] = {
            label: DEFAULT_CATEGORY_LABELS[tag] || tag.toUpperCase(),
            wordIds: new Set(),
            rootIds: new Set(),
          };
        }
        categories[tag].wordIds.add(word.id);
        categories[tag].rootIds.add(root.rootId);
      });
    });
  });

  const rootMeta = {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    roots: sortByKey(
      roots.map((root) => ({
        rootId: root.rootId,
        root: root.root || root.rootId,
        meaning: root.meaning || '',
        descriptionCn: root.descriptionCn || '',
        parentRootId: root.parentRootId || '',
        rootLevel: typeof root.rootLevel === 'number' ? root.rootLevel : 1,
        rootPath: root.rootPath || root.rootId,
        type: root.type || 'root',
        notes: root.notes || '',
        wordCount: root.words.length,
        file: root.rootId,
      })),
      'rootId',
    ),
  };

  const categoryIndex = {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    categories: Object.fromEntries(
      Object.keys(categories)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => [
          key,
          {
            label: categories[key].label,
            wordIds: Array.from(categories[key].wordIds).sort((a, b) => a.localeCompare(b)),
            rootIds: Array.from(categories[key].rootIds).sort((a, b) => a.localeCompare(b)),
          },
        ]),
    ),
  };

  const reverseIndex = {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    map: Object.fromEntries(
      Object.keys(wordToRoot)
        .sort((a, b) => a.localeCompare(b))
        .map((wordId) => [wordId, wordToRoot[wordId]]),
    ),
  };

  return { rootMeta, categoryIndex, reverseIndex, conflicts };
}

function buildRootLoadersFile(roots) {
  const entries = sortByKey([...roots], 'rootId')
    .map(
      (root) => `  ${JSON.stringify(root.rootId)}: () => import("../roots/${root.rootId}.json"),`,
    )
    .join('\n');

  return `export const ROOT_LOADERS = {\n${entries}\n};\n`;
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

async function writeOutputs(outputRoot, roots, indexes, options) {
  const rootsDir = path.join(outputRoot, 'data', 'roots');
  const indexDir = path.join(outputRoot, 'data', 'index');

  await ensureDir(rootsDir);
  await ensureDir(indexDir);

  if (options.clean) {
    await removeJsonFiles(rootsDir);
  }

  const rootWrites = roots.map((root) =>
    fs.writeFile(path.join(rootsDir, `${root.rootId}.json`), createJsonText(root), 'utf8'),
  );
  await Promise.all(rootWrites);

  await fs.writeFile(
    path.join(indexDir, 'root-meta.json'),
    createJsonText(indexes.rootMeta),
    'utf8',
  );
  await fs.writeFile(
    path.join(indexDir, 'categories.json'),
    createJsonText(indexes.categoryIndex),
    'utf8',
  );
  await fs.writeFile(
    path.join(indexDir, 'word-to-root.json'),
    createJsonText(indexes.reverseIndex),
    'utf8',
  );
  await fs.writeFile(path.join(indexDir, 'root-loaders.js'), buildRootLoadersFile(roots), 'utf8');
}

function printSummary(roots, indexes) {
  const totalWords = roots.reduce((sum, root) => sum + root.words.length, 0);
  const categoryCount = Object.keys(indexes.categoryIndex.categories).length;
  console.log(`[import] roots: ${roots.length}`);
  console.log(`[import] words: ${totalWords}`);
  console.log(`[import] categories: ${categoryCount}`);
  console.log(`[import] files generated: data/roots/*.json + data/index/*.json/js`);
}

async function main() {
  const parsed = parseArgs({
    options: {
      input: { type: 'string', short: 'i' },
      rootsHierarchy: { type: 'string' },
      dryRun: { type: 'boolean', default: false },
      clean: { type: 'boolean', default: true },
      output: { type: 'string', short: 'o' },
    },
    allowPositionals: true,
  });

  const inputArg = parsed.values.input || parsed.positionals[0];
  if (!inputArg) {
    throw new Error('Missing input file. Use --input <path-to-json-or-jsonl>.');
  }

  const cwd = process.cwd();
  const outputRoot = path.resolve(cwd, parsed.values.output || '.');
  const inputPath = path.resolve(cwd, inputArg);

  const rawData = await readInputFile(inputPath);
  let roots = autoDetectAndNormalize(rawData);

  const rootsHierarchyArg = parsed.values.rootsHierarchy || '';
  if (rootsHierarchyArg) {
    const hierarchyPath = path.resolve(cwd, rootsHierarchyArg);
    const hierarchyRawData = await readInputFile(hierarchyPath);
    const hierarchyRecords = normalizeHierarchyData(hierarchyRawData);
    roots = mergeHierarchyIntoRoots(roots, hierarchyRecords);
  }

  const indexes = buildIndexes(roots);

  if (indexes.conflicts.length > 0) {
    console.warn('[import] duplicate word id found across multiple roots:');
    indexes.conflicts.slice(0, 20).forEach((conflict) => {
      console.warn(
        `  - ${conflict.wordId}: ${conflict.firstRootId} vs ${conflict.duplicateRootId}`,
      );
    });
    if (indexes.conflicts.length > 20) {
      console.warn(`  ... and ${indexes.conflicts.length - 20} more`);
    }
  }

  if (parsed.values.dryRun) {
    printSummary(roots, indexes);
    return;
  }

  await writeOutputs(outputRoot, roots, indexes, { clean: parsed.values.clean });
  printSummary(roots, indexes);
}

main().catch((error) => {
  console.error(`[import] failed: ${error.message}`);
  process.exitCode = 1;
});
