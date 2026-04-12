# Rootflow Word Data Layout

This directory is split into `roots` as the source of truth and `index` as lookup accelerators.

## Directory map

- `roots/*.json`: one root family per file, includes full word records.
- `index/root-meta.json`: root catalog for list pages and quick metadata.
- `index/categories.json`: category to `wordIds` and `rootIds` mapping (`junior`, `cet4`, `cet6`, etc).
- `index/word-to-root.json`: reverse mapping from word id to root id.
- `index/root-loaders.js`: lazy loaders used by `services/wordRepo.js`.
- `schema/*.schema.json`: JSON schema definitions for all data files.

## Design principles

1. Keep each word as a single source record under exactly one root file.
2. Put all classification logic in index files; do not duplicate full word entries.
3. Persist learner progress separately (`rf_word_progress_v1`) instead of mutating data files.
4. Add new roots by:
   - creating `roots/<rootId>.json`
   - registering a loader in `index/root-loaders.js`
   - appending root metadata in `index/root-meta.json`
   - updating `categories.json` and `word-to-root.json`

## Runtime source policy (Roots page)

- `data/raw/roots-hierarchy-fixed.json` and `data/raw/words-flat-fixed.json` are the runtime source of truth for the roots page.
- The roots page runs in **raw strict mode**: if raw data is unavailable or invalid, it must show an error instead of silently falling back to stale index/root files.
- `data/index/*` and `data/shards/*` are still generated artifacts for lookup/performance and compatibility, but not fallback data for roots-page runtime correctness.

## Bulk import script

Use `scripts/import-rootflow-wordbank.mjs` to generate all root and index files from one source file.

Example:

```bash
node scripts/import-rootflow-wordbank.mjs --input data/raw/roots-source.sample.json
```

Dry run:

```bash
node scripts/import-rootflow-wordbank.mjs --input data/raw/roots-source.sample.json --dryRun
```

Input supports:

1. Grouped roots JSON (`{ "roots": [{ "rootId": "...", "words": [...] }] }`)
2. Flat rows JSON (`[{ "rootId": "...", "word": "...", "tags": [...] }]`)
3. JSONL flat rows (`.jsonl`)

## Pre-import validation

Run strict validation before import:

```bash
node scripts/validate-wordbank.mjs --input data/raw/roots-source.sample.json
```

Checks include:

1. Missing required fields (`rootId`, `word`, `translation`)
2. Duplicate `rootId`
3. Duplicate `wordId` (same root or cross root)
4. Empty tags
5. Bad `rootId` format (must match `^[a-z0-9-]+$`)

## Shard slicer

Generate shard files for lazy loading.

By first letter:

```bash
node scripts/slice-wordbank-shards.mjs --mode alpha
```

By root batches:

```bash
node scripts/slice-wordbank-shards.mjs --mode batch --batchSize 40
```

Generated files:

- `data/shards/*.json`
- `data/index/root-shards.json`
- `data/index/root-shards.js`

## One-click pipeline

Run full pipeline with stop-on-failure and log summary:

```bash
node scripts/wordbank-pipeline.mjs --input data/raw/roots-source.sample.json --shardMode alpha
```

Recommended sync command for current fixed raw files:

```bash
node scripts/wordbank-pipeline.mjs --input data/raw/words-flat-fixed.json --rootsHierarchy data/raw/roots-hierarchy-fixed.json --shardMode alpha
```

After every raw data update, regenerate `data/index/*` and `data/shards/*` first, then re-run/rebuild the mini-program to avoid stale `unpackage` outputs.

Batch mode shard:

```bash
node scripts/wordbank-pipeline.mjs --input data/raw/roots-source.sample.json --shardMode batch --batchSize 40
```

Logs:

- Per-step logs: `logs/wordbank-pipeline/<runId>/01-validate.log`, etc.
- Run summary: `logs/wordbank-pipeline/<runId>/summary.json`
- Latest pointer: `logs/wordbank-pipeline/latest.json`
