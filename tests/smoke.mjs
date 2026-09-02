import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

import { buildPpt } from "../scripts/build_ppt.mjs";
import { validateDelivery } from "../scripts/validate_delivery.mjs";

function loadSharp() {
  const modules = process.env.RUNTIME_NODE_MODULES;
  if (!modules) throw new Error("缺少 RUNTIME_NODE_MODULES");
  return createRequire(path.join(modules, "runtime-resolver.cjs"))("sharp");
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "chaoyun-ppt-design-"));
  const pages = path.join(root, "pages");
  const prompts = path.join(root, "prompts");
  await fs.mkdir(pages);
  await fs.mkdir(prompts);
  const sharp = loadSharp();

  await sharp({ create: { width: 1280, height: 720, channels: 3, background: "#EDE7D8" } }).png().toFile(path.join(pages, "01.png"));
  await sharp({ create: { width: 1280, height: 720, channels: 3, background: "#DCE7E0" } }).png().toFile(path.join(pages, "02.png"));
  await fs.writeFile(path.join(prompts, "01.txt"), "封面提示词\n");
  await fs.writeFile(path.join(prompts, "02.txt"), "混合页背景提示词\n");

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
        mode: "hybrid",
        image: "pages/02.png",
        alt: "辅助背景",
        promptFile: "prompts/02.txt",
        sourceAnchors: ["原文第2段"],
        coverageIds: ["CLM-02"],
        textBlocks: [
          {
            name: "slide-title",
            text: "高信息密度页面",
            position: { left: 72, top: 64, width: 560, height: 100 },
            fontSize: 48,
            bold: true,
            color: "#173B32",
          },
        ],
      },
    ],
  };

  const manifestPath = path.join(root, "deck-manifest.json");
  const pptxPath = path.join(root, "deck.pptx");
  const montagePath = path.join(root, "montage.webp");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  const built = await buildPpt(manifestPath, pptxPath, montagePath);
  assert.equal(built.slideCount, 2);
  const report = await validateDelivery(manifestPath, pptxPath);
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.deckSlides, 2);
  assert.ok((await fs.stat(montagePath)).size > 0);
  process.stdout.write(`${JSON.stringify({ ok: true, root, report }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
