import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";

/**
 * 解析 PPTX，提取每页文字、配色、图片素材，输出到指定目录。
 *
 * 用法：node scripts/extract_pptx.mjs <原PPT.pptx> <输出目录>
 *
 * 输出：
 *   source-extracted/
 *     page-01.txt, page-02.txt, ...  每页文字
 *     original-style.txt             原PPT风格摘要（配色、字体）
 *     outline.txt                    内容大纲
 *     source_images/                 原PPT中的图片素材
 */

async function main() {
  const [pptxPath, outputDir] = process.argv.slice(2);
  if (!pptxPath || !outputDir) {
    throw new Error("用法：extract_pptx.mjs <原PPT.pptx> <输出目录>");
  }

  const absPptx = path.resolve(pptxPath);
  const absOut = path.resolve(outputDir);

  const buf = await fs.readFile(absPptx);
  const zip = await JSZip.loadAsync(buf);

  // 1. 找出所有幻灯片并按序号排序
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
      return na - nb;
    });

  if (slideFiles.length === 0) {
    throw new Error("PPTX 中没有找到幻灯片");
  }

  await fs.mkdir(absOut, { recursive: true });
  await fs.mkdir(path.join(absOut, "source_images"), { recursive: true });

  const pageSummaries = [];

  // 2. 逐页提取文字
  for (let i = 0; i < slideFiles.length; i++) {
    const slideName = slideFiles[i];
    const pageNum = i + 1;
    const xml = await zip.file(slideName).async("string");
    const texts = extractTextsFromSlide(xml);
    const pageFile = path.join(absOut, `page-${String(pageNum).padStart(2, "0")}.txt`);

    const content = [
      `# 第 ${pageNum} 页`,
      "",
      `## 原始文字（按出现顺序）`,
      "",
      ...texts.map((t, idx) => `${idx + 1}. ${t}`),
      "",
    ].join("\n");

    await fs.writeFile(pageFile, content, "utf8");

    pageSummaries.push({
      page: pageNum,
      title: texts[0] || `第${pageNum}页`,
      textCount: texts.length,
      preview: texts.slice(0, 3).join(" / "),
    });

    process.stderr.write(`[extract] 第 ${pageNum} 页：${texts.length} 段文字\n`);
  }

  // 3. 提取配色（从 theme1.xml）
  const themeFile = zip.file("ppt/theme/theme1.xml");
  let palette = {};
  if (themeFile) {
    const themeXml = await themeFile.async("string");
    palette = extractPaletteFromTheme(themeXml);
  }

  // 4. 提取字体（从 theme1.xml）
  let fonts = {};
  if (themeFile) {
    const themeXml = await themeFile.async("string");
    fonts = extractFontsFromTheme(themeXml);
  }

  // 5. 提取图片素材
  const mediaFiles = Object.keys(zip.files).filter(
    (name) => /^ppt\/media\//.test(name) && !zip.files[name].dir
  );
  const savedImages = [];
  for (const mediaName of mediaFiles) {
    const ext = path.extname(mediaName).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".emf", ".wmf"].includes(ext)) continue;
    const baseName = path.basename(mediaName);
    const destPath = path.join(absOut, "source_images", baseName);
    const data = await zip.file(mediaName).async("nodebuffer");
    await fs.writeFile(destPath, data);
    savedImages.push(baseName);
  }

  // 6. 写 original-style.txt
  const styleLines = [
    "# 原 PPT 风格摘要",
    "",
    `## 基本信息`,
    `- 总页数：${slideFiles.length}`,
    `- 图片素材数量：${savedImages.length}`,
    "",
    `## 配色方案（从主题提取）`,
  ];
  for (const [key, value] of Object.entries(palette)) {
    styleLines.push(`- ${key}：${value}`);
  }
  if (Object.keys(palette).length === 0) {
    styleLines.push("- 未从主题中提取到配色，请手动从页面图片中识别");
  }
  styleLines.push("", `## 字体（从主题提取）`);
  for (const [key, value] of Object.entries(fonts)) {
    styleLines.push(`- ${key}：${value}`);
  }
  if (Object.keys(fonts).length === 0) {
    styleLines.push("- 未从主题中提取到字体信息");
  }
  styleLines.push("", `## 图片素材`, ...savedImages.map((n) => `- ${n}`));
  await fs.writeFile(path.join(absOut, "original-style.txt"), styleLines.join("\n"), "utf8");

  // 7. 写 outline.txt
  const outlineLines = [
    "# 原 PPT 内容大纲",
    "",
    `共 ${slideFiles.length} 页`,
    "",
    "| 页码 | 标题（首段文字） | 文字段数 | 内容预览 |",
    "|---:|---|---:|---|",
  ];
  for (const p of pageSummaries) {
    const preview = p.preview.replace(/\|/g, "/").slice(0, 60);
    outlineLines.push(`| ${p.page} | ${p.title.replace(/\|/g, "/")} | ${p.textCount} | ${preview} |`);
  }
  await fs.writeFile(path.join(absOut, "outline.txt"), outlineLines.join("\n"), "utf8");

  const result = {
    pptx: absPptx,
    outputDir: absOut,
    pageCount: slideFiles.length,
    imagesExtracted: savedImages.length,
    pages: pageSummaries,
  };
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

/** 从 slide XML 中提取所有 <a:t> 文字，按出现顺序，去空 */
function extractTextsFromSlide(xml) {
  const matches = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)];
  return matches
    .map((m) => m[1].trim())
    .filter((t) => t.length > 0);
}

/** 从 theme XML 提取配色方案 */
function extractPaletteFromTheme(xml) {
  const palette = {};
  // <a:srgbClr val="RRGGBB"/> 在 clrScheme 内
  const schemeMatch = xml.match(/<a:clrScheme[^>]*>[\s\S]*?<\/a:clrScheme>/);
  if (!schemeMatch) return palette;
  const scheme = schemeMatch[0];
  const colorMatches = [...scheme.matchAll(/<a:(\w+)>\s*<a:srgbClr val="([0-9A-Fa-f]{6})"/g)];
  for (const m of colorMatches) {
    palette[m[1]] = `#${m[2].toUpperCase()}`;
  }
  return palette;
}

/** 从 theme XML 提取字体 */
function extractFontsFromTheme(xml) {
  const fonts = {};
  const fontMatch = xml.match(/<a:fontScheme[^>]*>[\s\S]*?<\/a:fontScheme>/);
  if (!fontMatch) return fonts;
  const scheme = fontMatch[0];
  const major = scheme.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
  const minor = scheme.match(/<a:minorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
  if (major) fonts.major = major[1];
  if (minor) fonts.minor = minor[1];
  return fonts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  });
}
