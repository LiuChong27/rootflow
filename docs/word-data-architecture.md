# Rootflow word schema and directory design

## 1) Root-first source data

Store full word entries by root family:

```json
{
  "version": 1,
  "rootId": "spect",
  "root": "-SPECT-",
  "meaning": "look, see",
  "descriptionCn": "看",
  "updatedAt": "2026-04-06",
  "words": [
    {
      "id": "inspect",
      "word": "inspect",
      "display": "Inspect",
      "phonetic": "ɪnˈspekt",
      "translation": "v. 检查，视察",
      "sentence": "Inspect the code immediately.",
      "tags": ["junior", "cet4"],
      "level": 1
    }
  ]
}
```

Why: this matches the tree interaction model and avoids repeated storage.

## 2) Index layer

Use index files for cross-root queries:

```json
{
  "categories": {
    "cet4": {
      "label": "CET4 5500",
      "wordIds": ["inspect", "expect", "respect"],
      "rootIds": ["spect"]
    }
  }
}
```

And reverse lookup:

```json
{
  "map": {
    "inspect": "spect"
  }
}
```

Why: category sets overlap heavily; indexing avoids duplicate full records.

## 3) Runtime repository layer

`services/wordRepo.js` provides:

- `getRoot(rootId)` and `getWordsByRoot(rootId)`
- `getWordsByCategory(categoryKey, { offset, limit })`
- `setWordStatus(wordId, "mastered" | "new")`
- `listRoots()` and `listCategories()`

Progress is stored in local storage under `rf_word_progress_v1`, not in source JSON.

## 4) Scaling to 30k words

1. Keep root files around 200-800 words each for easier maintenance.
2. Generate index files in a build step to avoid manual drift.
3. If later you need cloud sync, only sync progress/state to backend; keep lexical content local.

## 5) Import command

Use the bundled script to convert your existing root-organized dataset:

```bash
node scripts/import-rootflow-wordbank.mjs --input <your-source.json>
```

For a verification-only pass:

```bash
node scripts/import-rootflow-wordbank.mjs --input <your-source.json> --dryRun
```

Script outputs:

- `data/roots/*.json`
- `data/index/root-meta.json`
- `data/index/categories.json`
- `data/index/word-to-root.json`
- `data/index/root-loaders.js`

## 6) Validation and shard slicing

Validate before import:

```bash
node scripts/validate-wordbank.mjs --input <your-source.json>
```

Slice by first letter:

```bash
node scripts/slice-wordbank-shards.mjs --mode alpha
```

Slice by root batches:

```bash
node scripts/slice-wordbank-shards.mjs --mode batch --batchSize 40
```

`wordRepo` now checks shard mapping first (`data/index/root-shards.js`) and falls back to per-root loaders when shard mapping is empty.

## 7) One-click pipeline

Run the full sequence:

```bash
node scripts/wordbank-pipeline.mjs --input <your-source.json> --shardMode alpha
```

Pipeline order:

1. `validate-wordbank.mjs`
2. `import-rootflow-wordbank.mjs`
3. `slice-wordbank-shards.mjs`

It stops immediately on failure and writes:

- `logs/wordbank-pipeline/<runId>/summary.json`
- `logs/wordbank-pipeline/<runId>/<step>.log`
- `logs/wordbank-pipeline/latest.json`
