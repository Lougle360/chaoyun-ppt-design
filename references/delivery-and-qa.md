# 交付与质量检查

> 商业发布用途优先执行 [发布文案审核与付费门禁](publication-copy-gate.md)：内部审稿记录与成品可见文字分开，全套发布文案先确认再生图。错误页暂停后续调用，重试需有明确授权。


## 工作文件

原始资料、中间文件和最终交付分开保存：

```text
source/
  original.*
  normalized.txt
planning/
  outline.txt
  coverage-matrix.txt
  visual-bible.txt
prompts/
pages/
style-candidates/
style-candidates-contact-sheet.png
style-master.png
deck-manifest.json
qa-ledger.txt
auto-decision-log.txt
```

临时规划文件可使用 `.txt`。面向用户的最终大纲、覆盖矩阵、提示词和逐字稿可交付为 Markdown。

## 构建

所有页面均为 full-image，使用 build_ppt.mjs 组装：

```text
node scripts/build_ppt.mjs deck-manifest.json final.pptx montage.webp
```

验证确定性交付属性：

```text
node scripts/validate_delivery.mjs deck-manifest.json final.pptx
```

## 单页视觉检查

渲染每一页并放大检查：

- 标题和页面文字是否逐字正确
- 是否出现意外换行、裁切、重叠或溢出
- 图片裁切和文字安全区是否正确（必须原生 16:9，不得裁切）
- 对比度和字号是否足够
- 是否出现编造的标签、数字、品牌或人物
- 每条事实是否有来源
- 配色、材质和图像语言是否统一

不能只看检测器警告就直接接受或忽略，必须检查画面并修复所有非预期重叠。

## 整套检查

检查缩略图总览：

- 叙事是否连贯
- 风格是否统一，同时避免每页构图完全相同
- 开场是否简洁，结尾是否回应整套演示的沟通目标
- 是否存在缺页、重复页或编号错误

## 内容覆盖检查

根据覆盖矩阵核对最终页面：

- 每个核心内容单元都进入最终 PPT
- 每项核心证据仍然准确
- 被省略的内容仍有记录
- 生成视觉没有引入原文不存在的事实
- 含来源的页面在演讲者备注中保留 `[Sources]` 区块

`[Sources]` 是构建脚本使用的稳定技术标记，不得改名。

## 重试与兜底

- 单页最多重试两次。
- 每次只修一个明确问题。
- 文字仍不可靠时，调整提示词后继续重试，不得改用 hybrid 或其他模式。
- 页面仍无法达到质量要求时，保留最佳版本，只就该页向用户确认。

## 最终交付

- 最终 PPTX
- 按页码排列的页面图片
- 整套缩略图
- 使用风格比较时的候选样张总览
- 逐页大纲
- 内容覆盖矩阵
- 完整 Image2 提示词
- 需要或用户要求时提供逐字稿
- 质检记录
- 全自动模式的决策记录
- 现有 PPT 美化时额外提供 source-extracted/ 目录

所有页面均为 full-image 完整图片页，文字已烘焙在图片中，不可在 PowerPoint 中编辑文字。交付时明确说明这一点。
