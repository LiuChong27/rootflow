# A.pdf 转 JSON 规范

## 目标

把类似 [A.pdf] 中这类“词根/前缀笔记型资料”整理成可被当前 RootFlow 小程序直接消费的数据。

当前项目已经采用了两层数据结构：

1. `source` 源数据层：人工整理、适合校对和批量导入
2. `runtime` 运行时层：小程序页面直接读取

对于 PDF 这类非结构化内容，建议不要直接手写 `data/roots/*.json`，而是先整理成一份标准化源 JSON，再用脚本生成运行时 JSON。

## A.pdf 的内容特点

从 `A.pdf` 提取到的内容看，它不是规则表格，而是下面这种混合结构：

1. 词根/前缀标题
   例：`a`、`amphi=ambi`、`apo=ab`、`act=ag=ig`
2. 核心义
   例：`without`、`两个`、`远离`、`做/行动`
3. 派生词列表
   例：`abyss 深渊`、`apathy 冷漠`、`agent 代理人`
4. 零散标签
   例：`情感`、`物理`、`抽象`、`生物`、`交通`、`其他`
5. 变体/同源关系
   例：`act=ag=ig`、`apo=ab`

所以最关键的是把“版面信息”改造成“结构信息”。

## 推荐总架构

```text
PDF / OCR 文本
  -> 人工校对后的 source JSON
  -> validate-wordbank.mjs
  -> import-rootflow-wordbank.mjs
  -> data/roots/*.json
  -> data/index/*.json
  -> pages + services/wordRepo.js
```

## 第一层：推荐维护的源 JSON

推荐新增一份人工维护文件，例如：

`data/raw/pdf-a-source.json`

结构建议如下：

```json
{
  "version": 1,
  "updatedAt": "2026-04-08",
  "source": {
    "type": "pdf",
    "name": "A.pdf",
    "path": "c:/Users/86152/Desktop/1-英语小程序/A.pdf",
    "pageRange": "1"
  },
  "roots": [
    {
      "rootId": "a",
      "root": "a-",
      "meaning": "not/without",
      "descriptionCn": "不/无",
      "type": "prefix",
      "parentRootId": "",
      "rootLevel": 1,
      "rootPath": "a",
      "notes": "PDF 原文: a=an=without",
      "aliases": ["an"],
      "words": [
        {
          "id": "anacid",
          "word": "anacid",
          "display": "Anacid",
          "translation": "无酸的",
          "phonetic": "",
          "sentence": "",
          "tags": ["root-family"],
          "topicTags": ["chemistry"],
          "sourceLabel": "",
          "level": 1
        },
        {
          "id": "apathy",
          "word": "apathy",
          "display": "Apathy",
          "translation": "冷漠",
          "phonetic": "",
          "sentence": "",
          "tags": ["root-family", "emotion"],
          "topicTags": ["emotion"],
          "sourceLabel": "情感",
          "level": 1
        }
      ]
    },
    {
      "rootId": "ag",
      "root": "ag",
      "meaning": "do/act",
      "descriptionCn": "做/行动",
      "type": "branch",
      "parentRootId": "act",
      "rootLevel": 2,
      "rootPath": "act>ag",
      "notes": "act 的元音变体",
      "aliases": ["ig"],
      "words": [
        {
          "id": "agent",
          "word": "agent",
          "display": "Agent",
          "translation": "代理人",
          "phonetic": "",
          "sentence": "",
          "tags": ["root-family"],
          "topicTags": ["affairs"],
          "sourceLabel": "事务",
          "level": 1
        }
      ]
    }
  ]
}
```

## 为什么推荐保留这几个字段

### root 级字段

1. `rootId`
   小程序和索引文件里的唯一主键，只能用小写英文/数字/`-`
2. `root`
   页面展示文本，允许保留 `a-`、`anti-` 这类原样式
3. `meaning`
   英文核心义，供词根星图中心卡片展示
4. `descriptionCn`
   中文释义，供中文用户快速理解
5. `type`
   建议固定为 `prefix | root | suffix | branch`
6. `parentRootId`
   用于表达 `act -> ag -> ig` 这类派生关系
7. `rootLevel`
   层级深度，星图布局会用到
8. `rootPath`
   完整路径，例：`act>ag`
9. `notes`
   保存 PDF 中的补充说明，比如“元音变体”“远离义”
10. `aliases`
    保存 `a=an`、`amphi=ambi` 这类等价写法

### word 级字段

1. `id`
   单词唯一 ID，推荐直接用小写单词
2. `word`
   单词原形
3. `display`
   页面展示名，通常首字母大写
4. `translation`
   中文释义，当前页面直接依赖
5. `phonetic`
   音标，可先留空
6. `sentence`
   例句，可先留空
7. `tags`
   当前项目已使用的分类字段，至少保留 `root-family`
8. `topicTags`
   建议新增但不强依赖，用于保留 PDF 里的 `情感/物理/抽象/交通...`
9. `sourceLabel`
   原 PDF 章节标签，保留原始语义，方便回查
10. `level`
    难度等级，默认 `1`

## 第二层：当前小程序真正消费的运行时 JSON

项目现状已经基本确定，建议继续沿用：

### 1. `data/roots/<rootId>.json`

每个词根一个文件，存完整词列表。

例：

```json
{
  "version": 1,
  "rootId": "a",
  "root": "a-",
  "meaning": "not/without",
  "descriptionCn": "不/无",
  "updatedAt": "2026-04-08",
  "words": [
    {
      "id": "anacid",
      "word": "anacid",
      "display": "Anacid",
      "phonetic": "",
      "translation": "无酸的",
      "sentence": "",
      "tags": ["root-family"],
      "level": 1
    }
  ],
  "parentRootId": "",
  "rootLevel": 1,
  "rootPath": "a",
  "type": "prefix",
  "notes": ""
}
```

### 2. `data/index/root-meta.json`

给列表页和概览页使用，只保留元信息，不重复整词内容。

### 3. `data/index/categories.json`

按标签聚合单词和词根。

建议至少包含：

1. `root-family`
2. `emotion`
3. `physics`
4. `abstract`
5. `biology`
6. `transport`
7. `affairs`
8. `other`

### 4. `data/index/word-to-root.json`

提供单词到词根的反查，例如：

```json
{
  "version": 1,
  "updatedAt": "2026-04-08",
  "map": {
    "apathy": "a",
    "agent": "ag"
  }
}
```

### 5. `data/shards/*.json`

如果词量继续增长，再分片给懒加载使用；当前架构已支持。

## 字段映射建议

PDF 文本里的元素，建议这样落字段：

| PDF 内容             | JSON 字段                                                    |
| -------------------- | ------------------------------------------------------------ |
| `a=an=without`       | `rootId: "a"` + `aliases: ["an"]` + `meaning: "not/without"` |
| `amphi=ambi 两个`    | 选一个主键，如 `ambi`，另一个进 `aliases`                    |
| `act=ag=ig 做、行动` | `act` 为主根，`ag` / `ig` 建 branch                          |
| `情感 / 物理 / 抽象` | `sourceLabel` 原样保留，同时映射到标准 `tags`                |
| `abyss 深渊`         | `word` + `translation`                                       |
| `abject 可怜的`      | `word` + `translation`                                       |
| `audition 视听`      | `word` + `translation`                                       |

## 数据清洗要求

导入前建议满足这些规则：

1. 一个单词只能归属一个主 `rootId`
2. `rootId`、`word.id` 统一转成小写 kebab 风格
3. 中文标签先保留原值，再做标准化映射
4. OCR 错词必须人工修正
   例如 PDF 中的 `atyical` 很可能应为 `atypical`
5. 重复词要去重
6. 含义不完整时允许留空，但 `translation` 尽量补齐

## 对当前项目的最小可行方案

如果你现在只想尽快把类似 A.pdf 的资料喂给小程序，最稳妥的最小方案是：

1. 先整理成 `grouped roots JSON`
2. 每个 root 至少保留：
   `rootId`、`root`、`meaning`、`descriptionCn`、`words`
3. 每个 word 至少保留：
   `id`、`word`、`translation`、`tags`
4. 所有词统一先打上 `tags: ["root-family"]`
5. 后续再逐步补 `phonetic`、`sentence`、专题标签、层级关系

## 推荐执行流程

1. 从 PDF 提取文本
2. 人工拆成“词根块”
3. 先整理成 `data/raw/pdf-a-source.json`
4. 跑校验脚本
5. 跑导入脚本生成 `data/roots/*.json` 和 `data/index/*.json`
6. 最后跑 shard 切片

命令可直接复用当前项目：

```bash
node scripts/validate-wordbank.mjs --input data/raw/pdf-a-source.json
node scripts/import-rootflow-wordbank.mjs --input data/raw/pdf-a-source.json
node scripts/slice-wordbank-shards.mjs --mode alpha
```

## 结论

对类似 `A.pdf` 的资料，最适合当前小程序的不是“一个超大平铺 JSON”，而是：

1. 一份便于整理的 `source JSON`
2. 一组按词根拆分的 `runtime JSON`
3. 一组索引 JSON

这样既方便人工维护，也完全符合当前 `services/wordRepo.js` 和 `pages/roots/roots.vue` 的读取方式。
