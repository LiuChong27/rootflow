#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { promises as fs } from 'node:fs';

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

function toTitleCase(word) {
  const source = String(word || '').trim();
  if (!source) return '';
  return source.charAt(0).toUpperCase() + source.slice(1);
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

function decodeHtmlEntities(input) {
  return String(input || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanupText(input) {
  return decodeHtmlEntities(String(input || '').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMojibake(text) {
  const source = String(text || '');
  let score = 0;
  const replacementCount = (source.match(/\uFFFD/g) || []).length;
  score += replacementCount * 10;
  const suspiciousTokens = ['鍙', '鐨', '鎴', '锛', '銆', '馃', '璇', '瀛', '鎬'];
  suspiciousTokens.forEach((token) => {
    score += (source.split(token).length - 1) * 2;
  });
  return score;
}

function decodeByStrategy(buffer, strategy) {
  if (strategy === 'utf8') {
    return { text: new TextDecoder('utf-8').decode(buffer), encoding: 'utf8' };
  }
  if (strategy === 'gb18030') {
    return { text: new TextDecoder('gb18030').decode(buffer), encoding: 'gb18030' };
  }

  const utf8Text = new TextDecoder('utf-8').decode(buffer);
  const gbText = new TextDecoder('gb18030').decode(buffer);
  const utfScore = scoreMojibake(utf8Text);
  const gbScore = scoreMojibake(gbText);
  if (gbScore < utfScore) {
    return { text: gbText, encoding: 'gb18030' };
  }
  return { text: utf8Text, encoding: 'utf8' };
}

function parseRootPattern(patternText) {
  const text = cleanupText(patternText);
  const latinLead = (text.match(/^[A-Za-z0-9\s=\-]+/) || [''])[0].trim();
  const leadParts = latinLead
    .split('=')
    .map((item) => item.trim())
    .filter(Boolean);
  const mainRootToken = (leadParts[0] || '').split(/\s+/).find(Boolean) || '';
  const aliasTokens = leadParts
    .slice(1)
    .map((part) => part.split(/\s+/).find(Boolean) || '')
    .filter(Boolean);
  const meaningCn = text
    .replace(latinLead, '')
    .replace(/^[=\s\-:：]+/, '')
    .trim();

  return {
    rawPattern: text,
    mainRoot: normalizeId(mainRootToken),
    aliases: aliasTokens.map((item) => normalizeId(item)).filter(Boolean),
    meaningCn,
  };
}

function guessDomainTag(meaningCn = '') {
  const text = String(meaningCn);
  if (!text) return 'other';
  if (/[爱友敌恨情]/.test(text)) return 'emotion';
  if (/[空气水鸟轴星锚弯高原子角]/.test(text)) return 'physical';
  if (/[年命做听统治前反向增适]/.test(text)) return 'abstract';
  return 'other';
}

function guessType(rootId, meaningCn) {
  const prefixRootSet = new Set(['a', 'ab', 'ad', 'ante', 'anti', 'amphi', 'apo', 'auto', 'an']);
  if (prefixRootSet.has(rootId)) return 'prefix';
  if (/[前反向无不非离自]/.test(String(meaningCn || '')) && rootId.length <= 5) return 'prefix';
  return 'root';
}

function guessRootMeta(rootId, meaningCn, metaPolicy) {
  if (metaPolicy === 'minimal') {
    return {
      type: 'root',
      tags: ['root'],
      sourceLabel: 'other',
    };
  }

  const type = guessType(rootId, meaningCn);
  const domain = guessDomainTag(meaningCn);
  return {
    type,
    tags: Array.from(new Set([type, domain])),
    sourceLabel: domain,
  };
}

function parseWordsFromBlock(blockHtml) {
  const words = [];
  const itemRegex = /<div class="word-item">([\s\S]*?)<\/div>/g;
  for (const match of blockHtml.matchAll(itemRegex)) {
    const itemHtml = match[1];
    const wordEn = cleanupText(
      (itemHtml.match(/<span class="word-en">([\s\S]*?)<\/span>/) || ['', ''])[1],
    );
    const wordCn = cleanupText(
      (itemHtml.match(/<span class="word-cn">([\s\S]*?)(?:<\/span>|$)/) || ['', ''])[1],
    );
    const normalizedWord = String(wordEn || '').trim();
    if (!normalizedWord) continue;
    words.push({
      word: normalizedWord.toLowerCase(),
      display: toTitleCase(normalizedWord),
      translation: String(wordCn || '').trim(),
    });
  }
  return words;
}

function parseHtmlToGroups(htmlText) {
  const groups = [];
  const rootPatternRegex = /<div class="root-pattern">([\s\S]*?)<\/div>/g;
  const matches = Array.from(htmlText.matchAll(rootPatternRegex));
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const patternRaw = current[1];
    const blockStart = current.index + current[0].length;
    const blockEnd = next ? next.index : htmlText.length;
    const sectionHtml = htmlText.slice(blockStart, blockEnd);
    const words = parseWordsFromBlock(sectionHtml);
    const rootPattern = parseRootPattern(patternRaw);
    if (!rootPattern.mainRoot) continue;
    groups.push({
      ...rootPattern,
      words,
    });
  }
  return groups;
}

function loadExistingMetaForReuse(existingHierarchyData) {
  const rootList = Array.isArray(existingHierarchyData?.roots) ? existingHierarchyData.roots : [];
  const map = new Map();
  rootList.forEach((item) => {
    const rootId = normalizeId(item.rootId || item.root);
    if (!rootId) return;
    map.set(rootId, item);
  });
  return map;
}

function buildOutputs(groups, options) {
  const today = new Date().toISOString().slice(0, 10);
  const roots = [];
  const wordsFlat = [];
  const globalWordSeen = new Set();

  groups.forEach((group) => {
    const rootId = group.mainRoot;
    const reusedMeta = options.reuseMap.get(rootId) || null;
    const guessed = guessRootMeta(rootId, group.meaningCn, options.metaPolicy);

    let rootType = guessed.type;
    let rootTags = [...guessed.tags];
    let sourceLabel = guessed.sourceLabel;
    let meaningEn = '';
    let descriptionCn = group.meaningCn;
    if (options.metaPolicy === 'reuse-old' && reusedMeta) {
      rootType = String(reusedMeta.type || rootType);
      const reusedTags = Array.isArray(reusedMeta.tags)
        ? reusedMeta.tags.map((item) => normalizeId(item)).filter(Boolean)
        : [];
      rootTags = reusedTags.length ? reusedTags : rootTags;
      sourceLabel = reusedMeta.sourceLabel || sourceLabel;
      meaningEn = reusedMeta.meaning || reusedMeta.meaningEn || '';
      descriptionCn = group.meaningCn || reusedMeta.descriptionCn || reusedMeta.meaningCn || '';
    }

    const localWordSeen = new Set();
    const rootWords = [];

    group.words.forEach((rawWord) => {
      const id = normalizeId(rawWord.word);
      if (!id) return;
      if (localWordSeen.has(id)) return;
      if (options.duplicatePolicy === 'drop-cross-root' && globalWordSeen.has(id)) return;
      localWordSeen.add(id);
      globalWordSeen.add(id);

      const tags = Array.from(new Set(['root-family', rootType, sourceLabel]));
      const normalizedWord = {
        id,
        word: rawWord.word,
        display: rawWord.display || toTitleCase(rawWord.word),
        phonetic: '',
        translation: rawWord.translation || '',
        sentence: '',
        tags,
        level: 1,
      };
      rootWords.push(normalizedWord);

      wordsFlat.push({
        ...normalizedWord,
        rootId,
        rootPath: rootId,
        sourceLabel,
      });
    });

    roots.push({
      rootId,
      root: rootId,
      meaning: String(meaningEn || '').trim(),
      descriptionCn: String(descriptionCn || '').trim(),
      type: rootType,
      parentRootId: '',
      rootLevel: 1,
      rootPath: rootId,
      notes: `from ${options.inputLabel}`,
      sourceLabel,
      tags: rootTags,
      wordCount: rootWords.length,
    });
  });

  roots.sort((a, b) => a.rootId.localeCompare(b.rootId));
  wordsFlat.sort((a, b) => a.id.localeCompare(b.id));

  return {
    hierarchy: {
      version: 1,
      updatedAt: today,
      roots,
    },
    wordsFlat,
  };
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const content = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function main() {
  const parsed = parseArgs({
    options: {
      input: { type: 'string', default: 'a.html' },
      outWords: { type: 'string', default: 'data/raw/words-flat-fixed.json' },
      outHierarchy: { type: 'string', default: 'data/raw/roots-hierarchy-fixed.json' },
      encodingStrategy: { type: 'string', default: 'smart' },
      duplicatePolicy: { type: 'string', default: 'keep-cross-root' },
      metaPolicy: { type: 'string', default: 'guess' },
      dryRun: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  const encodingStrategy = String(parsed.values.encodingStrategy || 'smart').toLowerCase();
  if (!['smart', 'utf8', 'gb18030'].includes(encodingStrategy)) {
    throw new Error(`unsupported encodingStrategy "${encodingStrategy}"`);
  }

  const duplicatePolicy = String(parsed.values.duplicatePolicy || 'keep-cross-root').toLowerCase();
  if (!['keep-cross-root', 'drop-cross-root'].includes(duplicatePolicy)) {
    throw new Error(`unsupported duplicatePolicy "${duplicatePolicy}"`);
  }

  const metaPolicy = String(parsed.values.metaPolicy || 'guess').toLowerCase();
  if (!['guess', 'minimal', 'reuse-old'].includes(metaPolicy)) {
    throw new Error(`unsupported metaPolicy "${metaPolicy}"`);
  }

  const cwd = process.cwd();
  const inputPath = path.resolve(cwd, parsed.values.input);
  const outWordsPath = path.resolve(cwd, parsed.values.outWords);
  const outHierarchyPath = path.resolve(cwd, parsed.values.outHierarchy);

  const rawBytes = await fs.readFile(inputPath);
  const decoded = decodeByStrategy(rawBytes, encodingStrategy);
  const groups = parseHtmlToGroups(decoded.text);
  if (groups.length === 0) {
    throw new Error('no root-pattern groups found in input html');
  }

  const existingHierarchyData = await readJsonIfExists(outHierarchyPath);
  const reuseMap =
    metaPolicy === 'reuse-old' ? loadExistingMetaForReuse(existingHierarchyData) : new Map();

  const outputs = buildOutputs(groups, {
    duplicatePolicy,
    metaPolicy,
    reuseMap,
    inputLabel: path.basename(inputPath),
  });

  const rootCount = outputs.hierarchy.roots.length;
  const wordCount = outputs.wordsFlat.length;

  console.log(`[convert] input: ${inputPath}`);
  console.log(`[convert] encoding used: ${decoded.encoding}`);
  console.log(`[convert] roots parsed: ${rootCount}`);
  console.log(`[convert] words parsed: ${wordCount}`);

  if (parsed.values.dryRun) return;

  await fs.mkdir(path.dirname(outWordsPath), { recursive: true });
  await fs.mkdir(path.dirname(outHierarchyPath), { recursive: true });
  await fs.writeFile(outWordsPath, createJsonText(outputs.wordsFlat), 'utf8');
  await fs.writeFile(outHierarchyPath, createJsonText(outputs.hierarchy), 'utf8');

  console.log(`[convert] wrote: ${outWordsPath}`);
  console.log(`[convert] wrote: ${outHierarchyPath}`);
}

main().catch((error) => {
  console.error(`[convert] failed: ${error.message}`);
  process.exitCode = 1;
});
