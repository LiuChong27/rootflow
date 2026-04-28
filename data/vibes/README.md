# Vibes 数据说明

`Vibes` 是多场景短句库，目前包含：

- `职场`
- `校园`
- `食堂`
- `游戏`
- `社交平台`
- `含妈脏话`

## 当前数据来源

- `scene-cards.json`
  - 首页场景卡片元数据
- `scene-library.json`
  - 每个场景的短句库详情

场景条目数量以当前仓库内的 `scene-library.json` 为准。

## `scene-cards.json`

每个卡片包含：

- `id`
- `title`
- `eyebrow`
- `tagline`
- `statement`
- `theme`

## `scene-library.json`

顶层结构：

```json
{
  "scenes": {
    "scene-id": {
      "title": "",
      "tagline": "",
      "intro": "",
      "sections": [],
      "entries": []
    }
  }
}
```

## `sections` 约定

- `phrases`
  - 骂人短句
- `sarcasm`
  - 阴阳讽刺
- `shutdown`
  - 补刀收尾
- `insults`
  - 高压脏话

## `entries` 字段

每条内容固定包含：

- `id`
- `sceneId`
- `section`
- `type`
- `english`
- `chinese`
- `sourcePage`
- `sourceSection`
- `sourceKind`
- `baseEntryId`

当前批量生成的数据默认：

- `type: "phrase"`
- `sourceKind: "crafted"`

## 生成命令

可通过下面命令重新生成当前场景库：

```bash
node scripts/build-vibes-expanded-library.mjs
```
