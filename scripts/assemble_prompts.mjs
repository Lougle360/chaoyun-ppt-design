import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

/**
 * 提示词模板自动组装工具。
 *
 * 用法：
 *   node scripts/assemble_prompts.mjs <配置文件.json> <输出目录>
 *
 * 配置文件格式：
 * {
 *   "styleLock": "采用温暖扁平插画风格：暖橙色主色调...",
 *   "commonSuffix": "将背景、图片...不添加英文、伪文字、logo或水印。",
 *   "pages": [
 *     {
 *       "file": "01-cover.txt",
 *       "pageTask": "本页是封面，要让观众感受到...",
 *       "allowedText": ["标题", "副标题", "正文"],
 *       "layout": "画面左侧约45%为插画..."
 *     }
 *   ]
 * }
 *
 * 组装后的提示词结构：
 *   生成一张16:9横版完整PPT成品页。{styleLock}。本页要让观众理解：{pageTask}。
 *   画面只允许出现以下中文，不增字、不漏字、不改字：「text1」「text2」...
 *   {layout}。{commonSuffix}
 */

const DEFAULT_SUFFIX =
  "将背景、图片、插画、图形、标题和正文直接整合成同一张页面图片，图片垫底，禁止把图片与文字拆开。不要额外文字、伪字、水印、商标、无关人物或陌生品牌。";

function assemblePrompt(config, page) {
  const styleLock = config.styleLock?.trim();
  if (!styleLock) throw new Error(`配置缺少 styleLock`);

  const pageTask = page.pageTask?.trim();
  if (!pageTask) throw new Error(`页面 ${page.file} 缺少 pageTask`);

  const allowedText = Array.isArray(page.allowedText)
    ? page.allowedText.filter(Boolean)
    : [];
  if (allowedText.length === 0) throw new Error(`页面 ${page.file} 缺少 allowedText`);

  const layout = page.layout?.trim() ?? "";
  const suffix = (config.commonSuffix?.trim() || DEFAULT_SUFFIX).trim();

  const textList = allowedText.map((t) => `「${t}」`).join("");

  const lock = styleLock.endsWith("。") ? styleLock : styleLock + "。";
  const task = pageTask.endsWith("。") ? pageTask : pageTask + "。";

  const parts = [
    "生成一张16:9横版完整PPT成品页。",
    lock,
    `本页要让观众理解：${task}`,
    `画面只允许出现以下中文，不增字、不漏字、不改字：${textList}。`,
  ];

  if (layout) parts.push(layout + "。");
  parts.push(suffix);

  return parts.join("") + "\n";
}

async function main() {
  const [configPath, outputDir] = process.argv.slice(2);
  if (!configPath || !outputDir) {
    throw new Error("用法：assemble_prompts.mjs <配置文件.json> <输出目录>");
  }

  const configAbs = path.resolve(configPath);
  const outputAbs = path.resolve(outputDir);

  const configRaw = await fs.readFile(configAbs, "utf8");
  const config = JSON.parse(configRaw);

  if (!Array.isArray(config.pages) || config.pages.length === 0) {
    throw new Error("配置文件缺少 pages 数组");
  }

  await fs.mkdir(outputAbs, { recursive: true });

  const generated = [];
  for (const page of config.pages) {
    if (!page.file) throw new Error("页面缺少 file 字段");
    const prompt = assemblePrompt(config, page);
    const outPath = path.join(outputAbs, page.file);
    await fs.writeFile(outPath, prompt, "utf8");
    generated.push(page.file);
    process.stderr.write(`[assemble] ${page.file} (${prompt.length} 字)\n`);
  }

  process.stdout.write(
    JSON.stringify({ ok: true, count: generated.length, outputDir: outputAbs, files: generated }, null, 2) + "\n"
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  });
}
