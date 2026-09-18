# 构建清单规范

使用 UTF-8 编码的 JSON 清单组装完整图片页。字段名是构建脚本使用的稳定技术标识，不得翻译或改名；字段值和用户可见内容使用中文。

## 示例

```json
{
  "deckTitle": "人工智能与个人工作流",
  "slideSize": { "width": 1280, "height": 720 },
  "slides": [
    {
      "page": 1,
      "type": "cover",
      "mode": "full-image",
      "image": "pages/01-cover.png",
      "alt": "人工智能与个人工作流封面",
      "promptFile": "prompts/01-cover.txt",
      "sourceAnchors": ["原文标题与导语"],
      "coverageIds": ["CLM-01"],
      "notes": "开场说明"
    },
    {
      "page": 2,
      "type": "key-claim",
      "mode": "full-image",
      "image": "pages/02-key-claim.png",
      "alt": "流程逐渐缩短的编辑插画",
      "promptFile": "prompts/02-key-claim.txt",
      "sourceAnchors": ["原文第4至第6段"],
      "coverageIds": ["CLM-02", "EVD-03"],
      "notes": "强调流程缩短，而不只是生成速度。"
    }
  ]
}
```

所有路径都以清单文件所在目录为基准解析。

## 顶层字段

- `deckTitle`：必填，非空字符串。
- `slideSize`：可选，默认 `1280 × 720`；用户没有另行要求时使用 16:9。
- `slides`：必填，非空数组。

## 页面字段

- `page`：必填正整数，页码必须唯一且连续。
- `type`：必填页面任务标识，例如 `cover`、`key-claim`、`process`、`comparison`、`example`、`quote`、`data`、`action`、`summary`。
- `mode`：只能是 `full-image`。本 Skill 不支持 hybrid 或 native-data。
- `image`：必填页面图片路径。
- `alt`：必填，对图片内容作有意义的中文说明。
- `promptFile`：必填，提示词记录文件路径。
- `sourceAnchors`：事实性页面必须为非空数组；封面可引用原文标题或导语。
- `coverageIds`：本页覆盖的内容单元编号数组。
- `notes`：可选，演讲者备注。

所有页面均为 full-image，文字已烘焙在图片中，不使用原生文本框。
