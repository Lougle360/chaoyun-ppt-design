import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

/**
 * 自动质检脚本：检查构建清单中的所有页面图片。
 *
 * 用法：
 *   node scripts/qa_check.mjs <构建清单.json>
 *
 * 检查项：
 *   - 图片文件是否存在
 *   - 图片是否可读取（非损坏）
 *   - 尺寸比例是否与 slideSize 一致（16:9）
 *   - 文件大小是否合理（>100KB，排除空白/损坏图）
 *   - 提示词文件是否存在
 *   - 页码是否连续
 */

const MIN_FILE_SIZE = 100 * 1024; // 100KB

function resolveFromManifest(manifestPath, relativePath) {
  return path.resolve(path.dirname(manifestPath), relativePath);
}

async function main() {
  const [manifestPath] = process.argv.slice(2);
  if (!manifestPath) {
    throw new Error("用法：qa_check.mjs <构建清单.json>");
  }

  const manifestAbs = path.resolve(manifestPath);
  const manifest = JSON.parse(await fs.readFile(manifestAbs, "utf8"));

  const errors = [];
  const warnings = [];
  const slideSize = manifest.slideSize ?? { width: 1280, height: 720 };
  const expectedRatio = slideSize.width / slideSize.height;
  const slides = Array.isArray(manifest.slides) ? manifest.slides : [];

  if (!manifest.deckTitle) errors.push("缺少 deckTitle");
  if (slides.length === 0) errors.push("构建清单中没有页面");

  // 检查页码连续性
  for (let i = 0; i < slides.length; i++) {
    if (slides[i].page !== i + 1) {
      errors.push(`页码不连续：第 ${i + 1} 条记录 page=${slides[i].page}，预期 ${i + 1}`);
    }
  }

  // 逐页检查
  for (const slide of slides) {
    const page = slide.page;

    // 检查 mode
    if (slide.mode !== "full-image") {
      errors.push(`第 ${page} 页 mode=${slide.mode}，必须是 full-image`);
    }

    // 检查图片
    if (!slide.image) {
      errors.push(`第 ${page} 页缺少 image`);
      continue;
    }

    const imagePath = resolveFromManifest(manifestAbs, slide.image);
    try {
      const stat = await fs.stat(imagePath);

      // 文件大小检查
      if (stat.size < MIN_FILE_SIZE) {
        errors.push(`第 ${page} 页图片过小（${(stat.size / 1024).toFixed(1)}KB），可能是空白或损坏图`);
      }

      // 图片元数据检查
      const metadata = await sharp(imagePath).metadata();
      if (!metadata.width || !metadata.height) {
        errors.push(`第 ${page} 页图片尺寸无法读取`);
      } else {
        const ratio = metadata.width / metadata.height;
        if (Math.abs(ratio - expectedRatio) > 0.01) {
          errors.push(
            `第 ${page} 页图片比例 ${metadata.width}x${metadata.height}（${ratio.toFixed(3)}）与预期 ${slideSize.width}x${slideSize.height}（${expectedRatio.toFixed(3)}）不一致`
          );
        }
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        errors.push(`第 ${page} 页图片不存在：${imagePath}`);
      } else {
        errors.push(`第 ${page} 页图片无法读取：${error.message}`);
      }
    }

    // 检查提示词文件
    if (slide.promptFile) {
      const promptPath = resolveFromManifest(manifestAbs, slide.promptFile);
      try {
        await fs.access(promptPath);
      } catch {
        warnings.push(`第 ${page} 页提示词文件不存在：${promptPath}`);
      }
    }

    // 检查 sourceAnchors
    if (!Array.isArray(slide.sourceAnchors) || slide.sourceAnchors.length === 0) {
      warnings.push(`第 ${page} 页缺少 sourceAnchors`);
    }
  }

  const report = {
    ok: errors.length === 0,
    totalPages: slides.length,
    expectedRatio: `${slideSize.width}:${slideSize.height}`,
    errors,
    warnings,
    checkedAt: new Date().toISOString(),
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");

  if (errors.length > 0) {
    process.stderr.write(`\n[QA] 发现 ${errors.length} 个错误，${warnings.length} 个警告\n`);
    process.exitCode = 1;
  } else {
    process.stderr.write(`\n[QA] 通过：${slides.length} 页全部检查合格，${warnings.length} 个警告\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  });
}
