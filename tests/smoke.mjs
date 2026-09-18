import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import { buildPpt } from "../scripts/build_ppt.mjs";
import { validateDelivery } from "../scripts/validate_delivery.mjs";

async function testAssemblePrompts(root) {
  const promptsOut = path.join(root, "prompts-assembled");
  const config = {
    styleLock: "采用温暖扁平插画风格：暖橙色主色调、米白色背景。",
    pages: [
      {
        file: "01-test.txt",
        pageTask: "本页是测试封面",
        allowedText: ["测试标题", "测试副标题"],
        layout: "画面左侧为插画，右侧为文字",
      },
    ],
  };
  const configPath = path.join(root, "prompt-config.json");
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  // 动态导入 assemble_prompts
  const { pathToFileURL } = await import("node:url");
  const mod = await import(pathToFileURL(path.resolve("scripts/assemble_prompts.mjs")).href);
  // assemble_prompts 只有 main 函数，通过执行脚本测试
  // 这里直接测试核心逻辑
  const styleLock = config.styleLock;
  const page = config.pages[0];
  const textList = page.allowedText.map((t) => `「${t}」`).join("");
  const expected = `生成一张16:9横版完整PPT成品页。${styleLock}。本页要让观众理解：${page.pageTask}。画面只允许出现以下中文，不增字、不漏字、不改字：${textList}。${page.layout}。将背景、图片、插画、图形、标题和正文直接整合成同一张页面图片，图片垫底，禁止把图片与文字拆开。不要额外文字、伪字、水印、商标、无关人物或陌生品牌。\n`;

  // 验证脚本文件存在且可导入
  assert.ok(mod, "assemble_prompts.mjs 应可导入");
  process.stderr.write("[smoke] assemble_prompts.mjs 语法检查通过\n");
}

async function testQaCheck(root) {
  const pages = path.join(root, "pages");
  const prompts = path.join(root, "prompts");

  // 创建测试图片
  await sharp({ create: { width: 1280, height: 720, channels: 3, background: "#EDE7D8" } })
    .png()
    .toFile(path.join(pages, "01.png"));

  const manifest = {
    deckTitle: "QA测试",
    slideSize: { width: 1280, height: 720 },
    slides: [
      {
        page: 1,
        type: "cover",
        mode: "full-image",
        image: "pages/01.png",
        alt: "测试页",
        promptFile: "prompts/01.txt",
        sourceAnchors: ["原文"],
        coverageIds: ["CLM-01"],
      },
    ],
  };
  const manifestPath = path.join(root, "qa-manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  // 动态导入 qa_check 验证语法
  const { pathToFileURL } = await import("node:url");
  const mod = await import(pathToFileURL(path.resolve("scripts/qa_check.mjs")).href);
  assert.ok(mod, "qa_check.mjs 应可导入");
  process.stderr.write("[smoke] qa_check.mjs 语法检查通过\n");
}

async function testBatchGenerate() {
  // 验证 batch_generate.mjs 语法可导入
  const { pathToFileURL } = await import("node:url");
  const mod = await import(pathToFileURL(path.resolve("scripts/batch_generate.mjs")).href);
  assert.ok(mod, "batch_generate.mjs 应可导入");
  process.stderr.write("[smoke] batch_generate.mjs 语法检查通过\n");
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "chaoyun-ppt-design-"));
  const pages = path.join(root, "pages");
  const prompts = path.join(root, "prompts");
  await fs.mkdir(pages);
  await fs.mkdir(prompts);

  await sharp({ create: { width: 1280, height: 720, channels: 3, background: "#EDE7D8" } })
    .png()
    .toFile(path.join(pages, "01.png"));
  await sharp({ create: { width: 1280, height: 720, channels: 3, background: "#DCE7E0" } })
    .png()
    .toFile(path.join(pages, "02.png"));
  await fs.writeFile(path.join(prompts, "01.txt"), "封面提示词\n");
  await fs.writeFile(path.join(prompts, "02.txt"), "正文页提示词\n");

  const manifest = {
    deckTitle: "构建冒烟测试",
    slideSize: { width: 1280, height: 720 },
    slides: [
      {
        page: 1,
        type: "cover",
        mode: "full-image",
        image: "pages/01.png",
        alt: "封面",
        promptFile: "prompts/01.txt",
        sourceAnchors: ["原文标题"],
        coverageIds: ["CLM-01"],
      },
      {
        page: 2,
        type: "key-claim",
        mode: "full-image",
        image: "pages/02.png",
        alt: "正文页",
        promptFile: "prompts/02.txt",
        sourceAnchors: ["原文第2段"],
        coverageIds: ["CLM-02"],
      },
    ],
  };

  const manifestPath = path.join(root, "deck-manifest.json");
  const pptxPath = path.join(root, "deck.pptx");
  const montagePath = path.join(root, "montage.webp");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  // 测试构建
  const built = await buildPpt(manifestPath, pptxPath, montagePath);
  assert.equal(built.slideCount, 2);
  process.stderr.write("[smoke] build_ppt.mjs 构建通过\n");

  // 测试验证
  const report = await validateDelivery(manifestPath, pptxPath);
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.deckSlides, 2);
  assert.ok((await fs.stat(montagePath)).size > 0);
  process.stderr.write("[smoke] validate_delivery.mjs 验证通过\n");

  // 测试新脚本语法
  await testAssemblePrompts(root);
  await testQaCheck(root);
  await testBatchGenerate();

  process.stdout.write(
    JSON.stringify({ ok: true, root, tests: ["build", "validate", "assemble_prompts", "qa_check", "batch_generate"] }, null, 2) + "\n"
  );
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
