# 构建清单规范

使用 UTF-8 编码的 JSON 清单组装完整图片页和简单混合页。字段名是构建脚本使用的稳定技术标识，不得翻译或改名；字段值和用户可见内容使用中文。

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
      "mode": "hybrid",
      "image": "pages/02-background.png",
      "alt": "流程逐渐缩短的编辑插画",
      "promptFile": "prompts/02-background.txt",
      "sourceAnchors": ["原文第4至第6段"],
      "coverageIds": ["CLM-02", "EVD-03"],
      "notes": "强调流程缩短，而不只是生成速度。",
      "textBlocks": [
        {
          "name": "slide-title",
          "text": "真正缩短的是交付距离",
          "position": { "left": 72, "top": 64, "width": 560, "height": 96 },
          "fontSize": 48,
          "fontFamily": "PingFang SC",
          "bold": true,
          "color": "#173B32"
        },
        {
          "name": "body-copy",
          "text": "减少工具切换\n减少重复整理\n更早看到可修改的成果",
          "position": { "left": 76, "top": 200, "width": 470, "height": 240 },
          "fontSize": 26,
          "fontFamily": "PingFang SC",
          "color": "#24342E"
        }
      ]
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
- `mode`：只能是 `full-image`、`hybrid` 或 `native-data`。
- `image`：必填页面图片路径；原生数据页可使用克制的辅助背景。
- `alt`：必填，对图片内容作有意义的中文说明。
- `promptFile`：必填，提示词记录文件路径。
- `sourceAnchors`：事实性页面必须为非空数组；封面可引用原文标题或导语。
- `coverageIds`：本页覆盖的内容单元编号数组。
- `notes`：可选，演讲者备注。
- `textBlocks`：混合页使用的原生文本块数组。

## 文本块字段

- `name`：稳定、可检查的技术名称。
- `text`：页面准确可见文字。
- `position`：在当前画布上的像素位置 `{left, top, width, height}`。
- `fontSize`：按 96 DPI 计算的像素字号；标题建议不低于约 47 像素，正文不低于约 21 像素。
- `fontFamily`、`bold`、`italic`、`color`、`alignment`：可选格式。
- `fill`：可选文本框填充，例如 `"#FFFFFFCC"`；透明时省略。
- `padding`：可选内部留白数值。

图表、表格、连接线或复杂原生布局不要强行塞进这个简单清单，应在 `Presentations` 工作流中直接使用 `@oai/artifact-tool` 制作。
