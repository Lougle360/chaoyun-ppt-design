# 超云PPT设计

一个面向 Codex 的中文 Skill：把文章、讲稿、Markdown、TXT、DOCX 或可提取文字的 PDF，转换成高信息密度、风格统一的整页文生图 PPTX。

它采用“先拆文章，再做覆盖大纲，再写逐页完整提示词，再生成整页图片，最后组装和质检”的流程。默认让图像模型直接生成包含背景、插画、标题和正文的完整页面，不沿用传统的“图片垫底、文字另排”做法。

## 核心能力

- 先建立内容单元和覆盖矩阵，尽量保留原文的重要结论、论据、方法与边界
- 提供全自动模式和三节点把关模式，并允许中途切换；商业发布优先执行文案审核与付费确认流程
- 内置 207 种中文 PPT 风格、完整提示词和一一对应的案例预览图
- 支持客户查看预览后按编号自选，也支持助手根据文章检索全库推荐
- 商业发布先确认全套逐页文案，再生成一张正文样张；样张和批量范围确认后才批量出图
- 支持 `full-image`、`hybrid`、`native-data` 三种页面模式
- 自动组装 PPTX，并检查文字、裁切、信息覆盖和视觉一致性

## 安装

```bash
git clone https://github.com/Lougle360/chaoyun-ppt-design.git ~/.codex/skills/chaoyun-ppt-design
```

重新打开 Codex 后，可以这样调用：

```text
使用 $chaoyun-ppt-design，把这篇文章用全自动模式做成整页文生图 PPT。
```

用于商业发布时，请说明用途；即使采用全自动模式，也须按发布流程确认文案和付费范围。

## 人机交互与文件流程

查看 [skill人机交互流程.md](skill人机交互流程.md)，其中包含完整 Mermaid 流程图、文件交互表和异常处理规则。

客户提供文章 → 确认大纲 → 审核全套发布文案 → 自选或委托推荐风格 → 授权一张正文样张 → 确认样张及批量范围 → 逐页生成检查 → 交付。

- 客户查看和确认：《发布版逐页文案.md》、已有模板预览、正文样张。
- 内部单独保存：《内部审核与待确认.md》，其中的审稿说明不进入发布页面。
- 最终交付：PPTX、逐页图片、整套缩略图，以及文案、提示词、质检和付费生成记录。

选定风格编号不代表确认发布文案，也不代表授权批量付费；已确认内容不重复询问。发现错误先暂停后续付费调用，再按已授权范围修复。

## 运行依赖

- 支持 Codex Skill 的运行环境
- 可用的图像生成能力，例如 GPT Image 2
- Codex 的 `Presentations` Skill 和 `@oai/artifact-tool` 运行环境，用于组装与检查 PPTX

## 风格目录

风格名称、描述、适用场景和提示词以这张[飞书多维表格](https://xcn5phmhnu1z.feishu.cn/base/JvecbWMEwaLv8as3NGXcQxjgnn9?table=tbl1DwIeLHneaDRX&view=vew2lCosPH)为权威来源。仓库内的 [`references/style-catalog.md`](references/style-catalog.md) 是当前同步副本，[`assets/ppt-previews/`](assets/ppt-previews/) 保存按“`001-中文风格名称`”统一命名的 207 张案例预览图。

## 目录结构

```text
chaoyun-ppt-design/
├── SKILL.md
├── skill人机交互流程.md
├── agents/openai.yaml
├── assets/ppt-previews/
├── references/
├── scripts/
└── tests/
```

完整流程、把关点、页面模式、交付标准和安全边界见 [`SKILL.md`](SKILL.md)。

## 本地模板信息同步

模板介绍以飞书当前记录为准；PPT主要使用场景为8类单选（教学培训、工作汇报、商业提案、产品介绍、品牌传播、研究分析、个人分享、文化创意），推荐使用场景保留为多选标签，原适配度字段已改为建议正文容量。`references/style-index.json` 提供全库筛选信息，`references/style-catalog.md` 保留完整提示词及预览图链接。图片通过三位编号关联，旧图片文件名不影响当前模板名称。推荐时先检索全库，再核对候选提示词与预览图；主要场景用于优先匹配，不排除其他大类中的合适模板。

更新命令：`node scripts/sync_style_catalog.mjs <飞书记录.ndjson> references/style-catalog.md`。

内容表达索引新增：擅长的内容结构、页面组织方式、素材承载方式（多选）及判断依据（文本）。这些信息依据完整提示词整理，归纳建议和未验证能力单独说明，不能作为实际出图效果保证。

## 商业发布流程

大纲与发布版逐页文案 → 文案及风格确认 → 一张付费样张 → 样张及批量范围确认 → 逐页生成检查 → 成品交付。内部审稿说明单独保存，不进入发布页；发现错误暂停后续付费调用。详细规则见 [商业发布文案审核](references/publication-copy-gate.md)。

## 如何选择 PPT 风格

- 客户自选：打开 [全部 PPT 风格预览](https://xcn5phmhnu1z.feishu.cn/share/base/view/shrcnveXqYYHOnI8tcUJqkOckxc)，选好后提供编号即可。
- 助手推荐：提供文章，由助手检索全库并推荐 2—3 个匹配的风格。

选定编号后使用对应模板；发布文案确认与付费生成授权仍按商业发布流程执行。
