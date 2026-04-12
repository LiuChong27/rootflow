#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { promises as fs } from 'node:fs';

function normalizeRootId(value) {
  const source = String(value || '')
    .trim()
    .toLowerCase();
  if (!source) return '';
  return source
    .replace(/[\x27\x22]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createJsonText(payload) {
  const raw = JSON.stringify(payload, null, 2);
  const ascii = raw.replace(/[\u007f-\uffff]/g, (char) => {
    const code = char.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${code}`;
  });
  return `${ascii}\n`;
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

  const targets = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(dirPath, entry.name));
  await Promise.all(targets.map((target) => fs.unlink(target)));
}

async function loadRoots(rootsDir) {
  const entries = await fs.readdir(rootsDir, { withFileTypes: true });
  const rootFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(rootsDir, entry.name))
    .sort((a, b) => a.localeCompare(b));

  const roots = [];
  for (const filePath of rootFiles) {
    const rawContent = await fs.readFile(filePath, 'utf8');
    const content = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent;
    const parsed = JSON.parse(content);
    const rootId = normalizeRootId(parsed.rootId || path.basename(filePath, '.json'));
    if (!rootId) {
      throw new Error(`invalid rootId in ${filePath}`);
    }
    roots.push({
      rootId,
      filePath,
      data: {
        ...parsed,
        rootId,
      },
      wordCount: Array.isArray(parsed.words) ? parsed.words.length : 0,
    });
  }
  return roots;
}

function groupRootsByAlpha(roots) {
  const groups = new Map();
  roots.forEach((root) => {
    const first = root.rootId[0] || '';
    const bucket = /[a-z]/.test(first) ? first : 'other';
    const shardId = `alpha-${bucket}`;
    if (!groups.has(shardId)) groups.set(shardId, []);
    groups.get(shardId).push(root);
  });

  return Array.from(groups.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((shardId) => ({ shardId, roots: groups.get(shardId) }));
}

function groupRootsByBatch(roots, batchSize) {
  const chunks = [];
  for (let i = 0; i < roots.length; i += batchSize) {
    const index = Math.floor(i / batchSize) + 1;
    const shardId = `batch-${String(index).padStart(3, '0')}`;
    chunks.push({ shardId, roots: roots.slice(i, i + batchSize) });
  }
  return chunks;
}

function buildShardPayload(strategy, shardId, roots) {
  const rootIds = roots.map((root) => root.rootId).sort((a, b) => a.localeCompare(b));
  const rootsMap = {};
  roots.forEach((root) => {
    rootsMap[root.rootId] = root.data;
  });

  return {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    strategy,
    shardId,
    rootIds,
    roots: rootsMap,
  };
}

function buildShardManifest(strategy, batchSize, shards) {
  const rootToShard = {};
  const shardList = shards.map((shard) => {
    let wordCount = 0;
    shard.roots.forEach((root) => {
      rootToShard[root.rootId] = shard.shardId;
      wordCount += root.wordCount;
    });

    return {
      shardId: shard.shardId,
      rootCount: shard.roots.length,
      wordCount,
      file: `${shard.shardId}.json`,
    };
  });

  return {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    strategy,
    batchSize: strategy === 'batch' ? batchSize : null,
    shards: shardList,
    rootToShard,
  };
}

function buildShardLoaderJs(manifest) {
  const rootToShardText = JSON.stringify(manifest.rootToShard, null, 2);
  const loaders = manifest.shards
    .map((shard) => `  "${shard.shardId}": () => import("../shards/${shard.file}"),`)
    .join('\n');

  return `export const ROOT_TO_SHARD = ${rootToShardText};\n\nexport const ROOT_SHARD_LOADERS = {\n${loaders}\n};\n`;
}

async function writeShards(outputShardsDir, strategy, shards, clean) {
  await ensureDir(outputShardsDir);
  if (clean) await removeJsonFiles(outputShardsDir);

  for (const shard of shards) {
    const payload = buildShardPayload(strategy, shard.shardId, shard.roots);
    const shardPath = path.join(outputShardsDir, `${shard.shardId}.json`);
    await fs.writeFile(shardPath, createJsonText(payload), 'utf8');
  }
}

async function main() {
  const parsed = parseArgs({
    options: {
      mode: { type: 'string', default: 'alpha' },
      batchSize: { type: 'string', default: '40' },
      rootsDir: { type: 'string', default: 'data/roots' },
      shardsDir: { type: 'string', default: 'data/shards' },
      indexDir: { type: 'string', default: 'data/index' },
      clean: { type: 'boolean', default: true },
      dryRun: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  const mode = String(parsed.values.mode || 'alpha').toLowerCase();
  if (mode !== 'alpha' && mode !== 'batch') {
    throw new Error(`unsupported mode "${mode}". use "alpha" or "batch".`);
  }

  const batchSize = Math.max(1, Number(parsed.values.batchSize) || 40);
  const cwd = process.cwd();
  const rootsDir = path.resolve(cwd, parsed.values.rootsDir);
  const shardsDir = path.resolve(cwd, parsed.values.shardsDir);
  const indexDir = path.resolve(cwd, parsed.values.indexDir);

  const roots = await loadRoots(rootsDir);
  const sortedRoots = roots.sort((a, b) => a.rootId.localeCompare(b.rootId));
  const shards =
    mode === 'alpha' ? groupRootsByAlpha(sortedRoots) : groupRootsByBatch(sortedRoots, batchSize);

  const manifest = buildShardManifest(mode, batchSize, shards);
  const totalWords = roots.reduce((sum, root) => sum + root.wordCount, 0);

  console.log(`[shard] mode: ${mode}`);
  console.log(`[shard] roots: ${roots.length}`);
  console.log(`[shard] words: ${totalWords}`);
  console.log(`[shard] shards: ${shards.length}`);

  if (parsed.values.dryRun) return;

  await writeShards(shardsDir, mode, shards, parsed.values.clean);
  await ensureDir(indexDir);
  await fs.writeFile(path.join(indexDir, 'root-shards.json'), createJsonText(manifest), 'utf8');
  await fs.writeFile(path.join(indexDir, 'root-shards.js'), buildShardLoaderJs(manifest), 'utf8');

  console.log('[shard] generated:');
  console.log('  - data/shards/*.json');
  console.log('  - data/index/root-shards.json');
  console.log('  - data/index/root-shards.js');
}

main().catch((error) => {
  console.error(`[shard] failed: ${error.message}`);
  process.exitCode = 1;
});
